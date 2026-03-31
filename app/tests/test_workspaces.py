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
def workspace_client(tmp_path, monkeypatch):
    db_path = tmp_path / "workspace.db"
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


def test_brand_onboarding_assigns_workspace(workspace_client):
    client, db_path = workspace_client
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, status) VALUES (?, ?, ?, 'active')",
        ("agency-co", "Agency Co", "Agency Co"),
    )
    conn.commit()
    workspace_id = conn.execute("SELECT id FROM workspaces WHERE slug='agency-co'").fetchone()[0]
    conn.close()

    response = client.post(
        "/onboarding/brand",
        data={
            "brand": "agency-main",
            "display_name": "Agency Main",
            "workspace_id": str(workspace_id),
            "website": "https://agency.example.com",
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"linked the brand to Agency Co" in response.data

    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT workspace_id FROM brands WHERE display_name=?", ("Agency Main",)).fetchone()
    conn.close()
    assert row[0] == workspace_id


def test_invite_creates_workspace_membership(workspace_client):
    client, db_path = workspace_client
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan) VALUES (?, ?, ?, ?)",
        ("workspace-owner@example.com", "Workspace Owner", "Workspace Co", "agency"),
    )
    conn.commit()
    conn.close()

    response = client.post("/ops/signups/1/invite", follow_redirects=False)
    assert response.status_code == 302
    assert "workspace_name=Workspace+Co" in response.headers["Location"]

    conn = sqlite3.connect(db_path)
    user_id = conn.execute("SELECT id FROM users WHERE email=?", ("workspace-owner@example.com",)).fetchone()[0]
    workspace = conn.execute("SELECT display_name, selected_plan, owner_user_id FROM workspaces WHERE owner_user_id=?", (user_id,)).fetchone()
    membership = conn.execute("SELECT membership_role, status FROM workspace_memberships WHERE user_id=?", (user_id,)).fetchone()
    conn.close()

    assert workspace[0] == "Workspace Co"
    assert workspace[1] == "agency"
    assert workspace[2] == user_id
    assert membership[0] == "owner"
    assert membership[1] == "active"
