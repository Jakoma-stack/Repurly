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
import billing  # noqa: E402
from auth import hash_password  # noqa: E402


@pytest.fixture()
def billing_client(tmp_path, monkeypatch):
    db_path = tmp_path / "billing_auth.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    conn.close()

    monkeypatch.delenv("OPS_USERNAME", raising=False)
    monkeypatch.delenv("OPS_PASSWORD", raising=False)
    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    monkeypatch.setattr(billing, "APP_DB", db_path)
    monkeypatch.setattr(onboarding_app, "WORKSPACE_BILLING_REQUIRED", True)
    onboarding_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    with onboarding_app.app.test_client() as client:
        yield client, db_path


def seed_customer(db_path: Path, *, active_subscription: bool = False):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "INSERT INTO users (email, full_name, company_name, role, status, password_hash, activated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        ("paid@example.com", "Paid User", "Paid Co", "customer", "active", hash_password("LongPassword123!")),
    )
    user_id = conn.execute("SELECT id FROM users WHERE email='paid@example.com'").fetchone()[0]
    conn.execute(
        "INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan, invite_status) VALUES (?, ?, ?, ?, ?)",
        ("paid@example.com", "Paid User", "Paid Co", "growth", "activated"),
    )
    signup_id = conn.execute("SELECT id FROM founding_user_signups WHERE email='paid@example.com'").fetchone()[0]
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, status, selected_plan, owner_user_id, signup_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("paid-co", "Paid Co", "Paid Co", "active", "growth", user_id, signup_id),
    )
    workspace_id = conn.execute("SELECT id FROM workspaces WHERE slug='paid-co'").fetchone()[0]
    conn.execute(
        "INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status) VALUES (?, ?, 'owner', 'active')",
        (workspace_id, user_id),
    )
    if active_subscription:
        conn.execute(
            "INSERT INTO subscriptions (user_id, workspace_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_name, status, billing_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, workspace_id, "cus_123", "sub_123", "price_growth", "growth", "active", "paid@example.com"),
        )
    conn.commit()
    conn.close()
    return user_id, workspace_id


def login(client):
    return client.post(
        "/login",
        data={"email": "paid@example.com", "password": "LongPassword123!", "next": "/dashboard"},
        follow_redirects=False,
    )


def test_dashboard_redirects_to_billing_when_paid_access_required(billing_client):
    client, db_path = billing_client
    seed_customer(db_path, active_subscription=False)

    response = login(client)
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/dashboard")

    gated = client.get("/dashboard", follow_redirects=False)
    assert gated.status_code == 302
    assert "/account/billing?required=1" in gated.headers["Location"]

    billing_page = client.get("/account/billing")
    assert billing_page.status_code == 200
    assert b"workspace access" in billing_page.data.lower()
    assert b"continue to secure checkout" in billing_page.data.lower() or b"checkout not configured yet" in billing_page.data.lower()


def test_dashboard_allows_access_with_active_subscription(billing_client):
    client, db_path = billing_client
    seed_customer(db_path, active_subscription=True)

    login(client)
    response = client.get("/dashboard")
    assert response.status_code == 200
    assert b"Paid Co" in response.data
    assert b"growth" in response.data.lower()


def test_customer_billing_checkout_uses_workspace_context(billing_client, monkeypatch):
    client, db_path = billing_client
    _, workspace_id = seed_customer(db_path, active_subscription=False)
    login(client)

    captured = {}

    def fake_create_checkout_session(**kwargs):
        captured.update(kwargs)
        return {"id": "cs_test", "url": "https://checkout.example.com", "price_id": "price_growth", "plan_name": kwargs["plan_name"]}

    monkeypatch.setattr(onboarding_app, "create_checkout_session", fake_create_checkout_session)

    response = client.post(
        "/account/billing/create-checkout-session",
        data={"selected_plan": "growth"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert response.headers["Location"] == "https://checkout.example.com"
    assert captured["plan_name"] == "growth"
    assert captured["workspace_id"] == workspace_id
    assert captured["user_id"] > 0
    assert captured["success_path"] == "/account/billing?billing=success"

    conn = sqlite3.connect(db_path)
    selected_plan = conn.execute("SELECT selected_plan FROM workspaces WHERE id=?", (workspace_id,)).fetchone()[0]
    conn.close()
    assert selected_plan == "growth"


def test_process_stripe_event_persists_workspace_subscription(tmp_path, monkeypatch):
    db_path = tmp_path / "stripe_workspace.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.execute("INSERT INTO users (email, full_name, status) VALUES ('ws@example.com', 'Ws User', 'active')")
    user_id = conn.execute("SELECT id FROM users WHERE email='ws@example.com'").fetchone()[0]
    conn.execute("INSERT INTO workspaces (slug, display_name, status, owner_user_id) VALUES ('ws-co', 'Ws Co', 'active', ?)", (user_id,))
    workspace_id = conn.execute("SELECT id FROM workspaces WHERE slug='ws-co'").fetchone()[0]
    conn.commit()
    conn.close()

    monkeypatch.setattr(billing, "APP_DB", db_path)
    monkeypatch.setenv("STRIPE_PRICE_GROWTH", "price_growth")

    event = {
        "id": "evt_workspace_1",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_workspace_1",
                "customer": "cus_workspace_1",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_growth"}}]},
                "metadata": {
                    "selected_plan": "growth",
                    "user_id": str(user_id),
                    "workspace_id": str(workspace_id),
                    "billing_email": "ws@example.com",
                },
                "current_period_end": 1770000000,
                "cancel_at_period_end": False,
            }
        },
    }

    result = billing.process_stripe_event(event)
    assert result["ok"] is True

    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT workspace_id, user_id, plan_name, status, billing_email FROM subscriptions WHERE stripe_subscription_id='sub_workspace_1'"
    ).fetchone()
    conn.close()

    assert row[0] == workspace_id
    assert row[1] == user_id
    assert row[2] == "growth"
    assert row[3] == "active"
    assert row[4] == "ws@example.com"


def test_customer_billing_portal_redirects_to_stripe(billing_client, monkeypatch):
    client, db_path = billing_client
    seed_customer(db_path, active_subscription=True)
    login(client)

    def fake_portal(**kwargs):
        assert kwargs["customer_id"] == "cus_123"
        return {"id": "bps_123", "url": "https://billing.example.com/session"}

    monkeypatch.setattr(onboarding_app, "create_billing_portal_session", fake_portal)
    response = client.post("/account/billing/portal", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["Location"] == "https://billing.example.com/session"


def test_ops_sync_billing_redirects_with_success(billing_client, monkeypatch):
    client, db_path = billing_client
    seed_customer(db_path, active_subscription=False)

    def fake_sync(**kwargs):
        assert kwargs["billing_email"] == "paid@example.com"
        return {"ok": True, "synced_count": 1}

    monkeypatch.setattr(onboarding_app, "sync_latest_subscription_for_customer", fake_sync)
    response = client.post(
        "/ops/signups/1/sync-billing",
        headers={"Authorization": "Basic b3BzOnB3"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "saved=billing_synced" in response.headers["Location"]


def test_ops_billing_handles_legacy_db_without_workspace_subscription_column(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy_billing.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, full_name TEXT, company_name TEXT, role TEXT, status TEXT);
        CREATE TABLE founding_user_signups (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, full_name TEXT, company_name TEXT, selected_plan TEXT, beta_notes TEXT, invite_status TEXT DEFAULT 'requested', stripe_checkout_session_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, stripe_customer_id TEXT UNIQUE, stripe_subscription_id TEXT UNIQUE, stripe_price_id TEXT, plan_name TEXT, status TEXT, billing_email TEXT, started_at TEXT, current_period_end TEXT, cancel_at_period_end INTEGER DEFAULT 0, metadata_json TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE brands (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, slug TEXT UNIQUE, display_name TEXT);
        CREATE TABLE schedules (id INTEGER PRIMARY KEY AUTOINCREMENT, brand_id INTEGER, post_id TEXT UNIQUE, platform TEXT, post_type TEXT, post_date TEXT, post_time TEXT, theme TEXT, campaign TEXT, status TEXT DEFAULT 'planned', approval_status TEXT DEFAULT '', content_folder TEXT, asset_filename TEXT, caption_filename TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE publish_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id TEXT, brand_slug TEXT, platform TEXT, request_fingerprint TEXT, status TEXT DEFAULT 'started', response_json TEXT DEFAULT '{}', error_message TEXT, platform_post_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, post_id TEXT, brand_slug TEXT, platform TEXT, actor TEXT, message TEXT, payload_json TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan) VALUES ('legacy@example.com', 'Legacy User', 'Legacy Co', 'starter');
        """
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    monkeypatch.setattr(billing, "APP_DB", db_path)
    monkeypatch.setenv("OPS_USERNAME", "ops")
    monkeypatch.setenv("OPS_PASSWORD", "pw")
    onboarding_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    with onboarding_app.app.test_client() as client:
        response = client.get(
            "/ops/billing",
            headers={"Authorization": "Basic b3BzOnB3"},
        )
    assert response.status_code == 200
    assert b"legacy@example.com" in response.data


class _FakeListObject:
    def __init__(self, data):
        self.data = data


class _FakeStripeCustomerAPI:
    def __init__(self, customers):
        self.customers = customers

    def retrieve(self, customer_id):
        for customer in self.customers:
            if customer["id"] == customer_id:
                return customer
        raise RuntimeError("missing customer")

    def search(self, query, limit=20):
        needle = query.split("email:'", 1)[1].rsplit("'", 1)[0]
        data = [item for item in self.customers if item.get("email") == needle][:limit]
        return _FakeListObject(data)

    def list(self, email=None, limit=20):
        data = self.customers
        if email is not None:
            data = [item for item in data if item.get("email") == email]
        return _FakeListObject(data[:limit])


class _FakeStripeSubscriptionAPI:
    def __init__(self, mapping):
        self.mapping = mapping

    def list(self, customer, status="all", limit=20):
        return _FakeListObject(self.mapping.get(customer, [])[:limit])


class _FakeStripeSDK:
    def __init__(self, customers, subscriptions):
        self.Customer = _FakeStripeCustomerAPI(customers)
        self.Subscription = _FakeStripeSubscriptionAPI(subscriptions)
        self.api_key = ""


def test_sync_latest_subscription_prefers_customer_with_active_subscription(tmp_path, monkeypatch):
    db_path = tmp_path / "sync_prefers_active.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.execute(
        "INSERT INTO users (email, full_name, company_name, role, status) VALUES (?, ?, ?, ?, ?)",
        ("paid@example.com", "Paid User", "Paid Co", "customer", "active"),
    )
    user_id = conn.execute("SELECT id FROM users WHERE email='paid@example.com'").fetchone()[0]
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, status, owner_user_id) VALUES (?, ?, ?, ?, ?)",
        ("paid-co", "Paid Co", "Paid Co", "active", user_id),
    )
    workspace_id = conn.execute("SELECT id FROM workspaces WHERE slug='paid-co'").fetchone()[0]
    conn.commit()
    conn.close()

    monkeypatch.setattr(billing, "APP_DB", db_path)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_example")
    monkeypatch.setenv("STRIPE_PRICE_GROWTH", "price_growth")

    customers = [
        {"id": "cus_old", "email": "paid@example.com", "created": 100},
        {"id": "cus_live", "email": "paid@example.com", "created": 200},
    ]
    subscriptions = {
        "cus_old": [],
        "cus_live": [
            {
                "id": "sub_live",
                "customer": "cus_live",
                "status": "active",
                "created": 300,
                "items": {"data": [{"price": {"id": "price_growth"}}]},
                "metadata": {},
                "current_period_end": 1770000000,
                "cancel_at_period_end": False,
            }
        ],
    }
    monkeypatch.setattr(billing, "require_stripe_sdk", lambda: _FakeStripeSDK(customers, subscriptions))

    result = billing.sync_latest_subscription_for_customer(
        billing_email="paid@example.com",
        user_id=user_id,
        workspace_id=workspace_id,
    )

    assert result["customer_id"] == "cus_live"
    assert result["synced_count"] == 1
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT stripe_customer_id, stripe_subscription_id, workspace_id, user_id, status FROM subscriptions WHERE stripe_subscription_id='sub_live'"
    ).fetchone()
    user_row = conn.execute("SELECT stripe_customer_id FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()

    assert row == ("cus_live", "sub_live", workspace_id, user_id, "active")
    assert user_row[0] == "cus_live"
