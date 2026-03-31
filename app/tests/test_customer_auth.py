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


@pytest.fixture()
def auth_client(tmp_path, monkeypatch):
    db_path = tmp_path / "auth.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    conn.close()

    monkeypatch.delenv("OPS_USERNAME", raising=False)
    monkeypatch.delenv("OPS_PASSWORD", raising=False)
    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    onboarding_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    with onboarding_app.app.test_client() as client:
        yield client, db_path


def test_dashboard_requires_customer_login(auth_client):
    client, _ = auth_client
    response = client.get("/dashboard", follow_redirects=False)
    assert response.status_code == 302
    assert "/login" in response.headers["Location"]


def test_invite_activation_login_and_logout_flow(auth_client):
    client, db_path = auth_client

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan) VALUES (?, ?, ?, ?)",
        ("owner@example.com", "Casey Owner", "Agency Co", "starter"),
    )
    conn.commit()
    conn.close()

    invite_response = client.post("/ops/signups/1/invite", follow_redirects=False)
    assert invite_response.status_code == 302
    location = invite_response.headers["Location"]
    assert "invite_link=" in location
    token = location.split("/activate/", 1)[1].split("&", 1)[0]

    activate_get = client.get(f"/activate/{token}")
    assert activate_get.status_code == 200
    assert b"Set your Repurly password" in activate_get.data

    activate_post = client.post(
        f"/activate/{token}",
        data={
            "full_name": "Casey Owner",
            "password": "LongPassword123!",
            "confirm_password": "LongPassword123!",
        },
        follow_redirects=False,
    )
    assert activate_post.status_code == 302
    assert activate_post.headers["Location"].endswith("/dashboard")

    conn = sqlite3.connect(db_path)
    workspace_id = conn.execute("SELECT id FROM workspaces WHERE owner_user_id=(SELECT id FROM users WHERE email=?)", ("owner@example.com",)).fetchone()[0]
    conn.execute(
        "INSERT INTO brands (workspace_id, slug, display_name, website) VALUES (?, ?, ?, ?)",
        (workspace_id, "agency-co-main", "Agency Co Main", "https://agency.example.com"),
    )
    conn.commit()
    conn.close()

    dashboard = client.get("/dashboard")
    assert dashboard.status_code == 200
    assert b"Agency Co" in dashboard.data
    assert b"owner@example.com" in dashboard.data
    assert b"Agency Co Main" in dashboard.data

    logout_response = client.get("/logout", follow_redirects=False)
    assert logout_response.status_code == 302
    assert logout_response.headers["Location"].endswith("/login")

    login_response = client.post(
        "/login",
        data={"email": "owner@example.com", "password": "LongPassword123!", "next": "/dashboard"},
        follow_redirects=False,
    )
    assert login_response.status_code == 302
    assert login_response.headers["Location"].endswith("/dashboard")

    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT status, password_hash, activated_at FROM users WHERE email=?", ("owner@example.com",)).fetchone()
    signup = conn.execute("SELECT invite_status FROM founding_user_signups WHERE email=?", ("owner@example.com",)).fetchone()
    conn.close()
    assert row[0] == "active"
    assert row[1]
    assert row[2]
    assert signup[0] == "activated"


def test_reset_link_flow_updates_password(auth_client):
    client, db_path = auth_client
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO users (email, full_name, company_name, role, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
        ("reset@example.com", "Reset User", "Agency Co", "customer", "active", "scrypt:32768:8:1$dummy$dummy"),
    )
    conn.commit()
    user_id = conn.execute("SELECT id FROM users WHERE email=?", ("reset@example.com",)).fetchone()[0]
    conn.close()

    response = client.post(f"/ops/users/{user_id}/reset-link", follow_redirects=False)
    assert response.status_code == 302
    token = response.headers["Location"].split("/reset-password/", 1)[1].split("&", 1)[0]

    reset_post = client.post(
        f"/reset-password/{token}",
        data={"password": "NewPassword123!", "confirm_password": "NewPassword123!"},
        follow_redirects=False,
    )
    assert reset_post.status_code == 302
    assert "/login?reset=success" in reset_post.headers["Location"]

    login_response = client.post(
        "/login",
        data={"email": "reset@example.com", "password": "NewPassword123!", "next": "/dashboard"},
        follow_redirects=False,
    )
    assert login_response.status_code == 302
    assert login_response.headers["Location"].endswith("/dashboard")
