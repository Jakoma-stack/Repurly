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
def phase456_client(tmp_path, monkeypatch):
    db_path = tmp_path / "phase456.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
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
        "INSERT INTO subscriptions (user_id, workspace_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_name, status, billing_email) VALUES (?, ?, 'cus_123', 'sub_123', 'price_growth', 'growth', 'active', 'owner@example.com')",
        (user_id, workspace_id),
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    onboarding_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    with onboarding_app.app.test_client() as client:
        client.post("/login", data={"email": "owner@example.com", "password": "LongPassword123!", "next": "/dashboard"})
        yield client, db_path, workspace_id


def test_active_subscription_guards_duplicate_checkout(phase456_client):
    client, _, _ = phase456_client
    response = client.post(
        "/account/billing/create-checkout-session",
        data={"selected_plan": "growth"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "already+has+an+active+subscription" in response.headers["Location"]


def test_workspace_settings_update(phase456_client):
    client, db_path, workspace_id = phase456_client
    response = client.post(
        "/workspace/settings",
        data={
            "display_name": "Agency Co Updated",
            "company_name": "Agency Co Ltd",
            "billing_contact_email": "billing@example.com",
            "reporting_email": "reports@example.com",
            "allowed_email_domains": "example.com",
            "onboarding_stage": "live",
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT display_name, billing_contact_email, onboarding_stage FROM workspaces WHERE id=?", (workspace_id,)).fetchone()
    conn.close()
    assert row[0] == "Agency Co Updated"
    assert row[1] == "billing@example.com"
    assert row[2] == "live"


def test_workspace_brand_self_service_create_and_archive(phase456_client):
    client, db_path, workspace_id = phase456_client
    response = client.post(
        "/workspace/brands",
        data={"slug": "client-one", "display_name": "Client One", "website": "https://example.com"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    conn = sqlite3.connect(db_path)
    brand_id = conn.execute("SELECT id FROM brands WHERE workspace_id=? AND slug='client_one'", (workspace_id,)).fetchone()[0]
    conn.close()
    archive = client.post(f"/workspace/brands/{brand_id}/archive", follow_redirects=False)
    assert archive.status_code == 302
    conn = sqlite3.connect(db_path)
    status = conn.execute("SELECT brand_status FROM brands WHERE id=?", (brand_id,)).fetchone()[0]
    conn.close()
    assert status == "archived"


def test_workspace_analytics_and_export_load(phase456_client):
    client, _, _ = phase456_client
    analytics = client.get("/workspace/analytics")
    export = client.get("/workspace/analytics/export.csv")
    assert analytics.status_code == 200
    assert b"Workspace analytics" in analytics.data
    assert export.status_code == 200
    assert export.mimetype == "text/csv"
