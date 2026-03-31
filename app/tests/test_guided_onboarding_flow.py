from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import onboarding_app  # noqa: E402
from auth import hash_password  # noqa: E402


@pytest.fixture()
def guided_client(tmp_path, monkeypatch):
    db_path = tmp_path / "guided.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.execute(
        "INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan, beta_notes) VALUES (?, ?, ?, ?, ?)",
        ("new@example.com", "New User", "New Co", "growth", ""),
    )
    conn.execute(
        "INSERT INTO users (email, full_name, company_name, role, status, password_hash, activated_at, email_verified_at) VALUES (?, ?, ?, 'customer', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ("owner@example.com", "Owner User", "Agency Co", hash_password("LongPassword123!")),
    )
    user_id = conn.execute("SELECT id FROM users WHERE email='owner@example.com'").fetchone()[0]
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, status, selected_plan, owner_user_id) VALUES ('agency-co', 'Agency Co', 'Agency Co', 'active', 'growth', ?)",
        (user_id,),
    )
    workspace_id = conn.execute("SELECT id FROM workspaces WHERE slug='agency-co'").fetchone()[0]
    conn.execute(
        "INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'owner', 'active')",
        (workspace_id, user_id),
    )
    conn.execute(
        "INSERT INTO brands (workspace_id, slug, display_name, website, brand_status, settings_json) VALUES (?, 'client-one', 'Client One', 'https://example.com', 'active', '{}')",
        (workspace_id,),
    )
    conn.commit()
    conn.close()

    monkeypatch.delenv("OPS_USERNAME", raising=False)
    monkeypatch.delenv("OPS_PASSWORD", raising=False)
    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    monkeypatch.setattr(onboarding_app, "send_welcome_email_if_enabled", lambda **kwargs: {"ok": True})
    onboarding_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    with onboarding_app.app.test_client() as client:
        client.post("/login", data={"email": "owner@example.com", "password": "LongPassword123!", "next": "/dashboard"})
        yield client, db_path, workspace_id


def test_signup_complete_redirects_to_activation(monkeypatch, guided_client):
    client, db_path, _ = guided_client

    monkeypatch.setattr(
        onboarding_app,
        "retrieve_checkout_session",
        lambda session_id: {
            "id": session_id,
            "status": "complete",
            "customer": "cus_test_123",
            "customer_details": {"email": "new@example.com"},
            "metadata": {"signup_id": "1", "selected_plan": "growth"},
            "client_reference_id": "1",
        },
    )
    monkeypatch.setattr(onboarding_app, "sync_latest_subscription_for_customer", lambda **kwargs: {"ok": True})

    response = client.get("/signup/complete?session_id=cs_test_123", follow_redirects=False)
    assert response.status_code == 302
    assert "/activate/" in response.headers["Location"]
    conn = sqlite3.connect(db_path)
    status = conn.execute("SELECT invite_status FROM founding_user_signups WHERE email='new@example.com'").fetchone()[0]
    conn.close()
    assert status == "invited"


def test_getting_started_loads(guided_client):
    client, _, _ = guided_client
    response = client.get("/getting-started")
    assert response.status_code == 200
    assert b"Guided setup" in response.data
    assert b"Generate your first posts" in response.data


def test_workspace_assets_and_content_routes_work(guided_client):
    client, db_path, workspace_id = guided_client
    assets_page = client.get("/workspace/assets")
    content_page = client.get("/workspace/content")
    assert assets_page.status_code == 200
    assert content_page.status_code == 200

    brand_id = sqlite3.connect(db_path).execute("SELECT id FROM brands WHERE workspace_id=?", (workspace_id,)).fetchone()[0]
    response = client.post(
        "/workspace/content/generate",
        data={"brand_id": str(brand_id), "brief": "client wins", "count": "2"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM generated_posts WHERE brand_id=?", (brand_id,)).fetchone()[0]
    conn.close()
    assert count == 2
