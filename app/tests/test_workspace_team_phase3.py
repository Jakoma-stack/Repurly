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
def team_client(tmp_path, monkeypatch):
    db_path = tmp_path / "team.db"
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


def _create_active_user(conn: sqlite3.Connection, *, email: str, full_name: str, company: str = "Agency Co") -> int:
    conn.execute(
        "INSERT INTO users (email, full_name, company_name, role, status, password_hash, activated_at, email_verified_at) VALUES (?, ?, ?, 'customer', 'active', ?, '2026-03-28T21:00:00+00:00', '2026-03-28T21:00:00+00:00')",
        (email, full_name, company, hash_password("LongPassword123!")),
    )
    return int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])


def _login(client, email: str):
    response = client.post(
        "/login",
        data={"email": email, "password": "LongPassword123!", "next": "/dashboard"},
        follow_redirects=False,
    )
    assert response.status_code == 302


def test_workspace_team_invite_and_accept_flow(team_client):
    client, db_path = team_client
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    owner_id = _create_active_user(conn, email="owner@example.com", full_name="Owner User")
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, selected_plan, owner_user_id) VALUES (?, ?, ?, ?, ?)",
        ("agency-co", "Agency Co", "Agency Co", "growth", owner_id),
    )
    workspace_id = int(conn.execute("SELECT id FROM workspaces WHERE slug='agency-co'").fetchone()[0])
    conn.execute(
        "INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'owner', 'active')",
        (workspace_id, owner_id),
    )
    conn.commit()
    conn.close()

    _login(client, "owner@example.com")
    invite_response = client.post(
        "/workspace/team/invite",
        data={"email": "member@example.com", "full_name": "Member User", "membership_role": "member"},
        follow_redirects=False,
    )
    assert invite_response.status_code == 302
    assert "invite_link=" in invite_response.headers["Location"]
    token = invite_response.headers["Location"].split("/join-workspace/", 1)[1].split("&", 1)[0]

    client.get("/logout")
    join_get = client.get(f"/join-workspace/{token}")
    assert join_get.status_code == 200
    assert b"Join Agency Co" in join_get.data

    join_post = client.post(
        f"/join-workspace/{token}",
        data={"full_name": "Member User", "password": "LongPassword123!", "confirm_password": "LongPassword123!"},
        follow_redirects=False,
    )
    assert join_post.status_code == 302
    assert join_post.headers["Location"].endswith("/dashboard")

    conn = sqlite3.connect(db_path)
    membership = conn.execute(
        "SELECT membership_role FROM workspace_memberships WHERE workspace_id=? AND user_id=(SELECT id FROM users WHERE email='member@example.com')",
        (workspace_id,),
    ).fetchone()
    invite = conn.execute("SELECT accepted_at FROM workspace_invitations WHERE workspace_id=? AND email='member@example.com'", (workspace_id,)).fetchone()
    conn.close()
    assert membership[0] == "member"
    assert invite[0]


def test_workspace_owner_can_change_role_and_remove_member(team_client):
    client, db_path = team_client
    conn = sqlite3.connect(db_path)
    owner_id = _create_active_user(conn, email="owner@example.com", full_name="Owner User")
    member_id = _create_active_user(conn, email="member@example.com", full_name="Member User")
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, selected_plan, owner_user_id) VALUES (?, ?, ?, ?, ?)",
        ("agency-co", "Agency Co", "Agency Co", "growth", owner_id),
    )
    workspace_id = int(conn.execute("SELECT id FROM workspaces WHERE slug='agency-co'").fetchone()[0])
    conn.execute("INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'owner', 'active')", (workspace_id, owner_id))
    conn.execute("INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'member', 'active')", (workspace_id, member_id))
    member_membership_id = int(conn.execute("SELECT id FROM workspace_memberships WHERE user_id=?", (member_id,)).fetchone()[0])
    conn.commit()
    conn.close()

    _login(client, "owner@example.com")
    promote = client.post(f"/workspace/team/{member_membership_id}/role", data={"membership_role": "admin"}, follow_redirects=False)
    assert promote.status_code == 302
    remove = client.post(f"/workspace/team/{member_membership_id}/remove", follow_redirects=False)
    assert remove.status_code == 302

    conn = sqlite3.connect(db_path)
    role = conn.execute("SELECT membership_role, status FROM workspace_memberships WHERE id=?", (member_membership_id,)).fetchone()
    conn.close()
    assert role[0] == "admin"
    assert role[1] == "removed"


def test_member_cannot_manage_team_or_billing(team_client):
    client, db_path = team_client
    conn = sqlite3.connect(db_path)
    owner_id = _create_active_user(conn, email="owner@example.com", full_name="Owner User")
    member_id = _create_active_user(conn, email="member@example.com", full_name="Member User")
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, selected_plan, owner_user_id) VALUES (?, ?, ?, ?, ?)",
        ("agency-co", "Agency Co", "Agency Co", "growth", owner_id),
    )
    workspace_id = int(conn.execute("SELECT id FROM workspaces WHERE slug='agency-co'").fetchone()[0])
    conn.execute("INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'owner', 'active')", (workspace_id, owner_id))
    conn.execute("INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'member', 'active')", (workspace_id, member_id))
    conn.commit()
    conn.close()

    _login(client, "member@example.com")
    team_page = client.get("/workspace/team")
    assert team_page.status_code == 200
    assert b"Only workspace owners or admins can add and manage team members." in team_page.data

    invite = client.post("/workspace/team/invite", data={"email": "new@example.com"}, follow_redirects=False)
    assert invite.status_code == 403

    billing_portal = client.post("/account/billing/portal", follow_redirects=False)
    assert billing_portal.status_code == 302
    assert "/account/billing?billing=portal_error" in billing_portal.headers["Location"]
