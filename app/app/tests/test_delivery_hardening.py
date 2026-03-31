from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import billing  # noqa: E402
import bootstrap_demo_data  # noqa: E402
import build_daily_queue  # noqa: E402
import init_db  # noqa: E402
import post_to_linkedin as linkedin  # noqa: E402


def test_approval_allows_posting_requires_explicit_approval():
    assert linkedin.approval_allows_posting({"approval_status": "approved"}) is True
    assert linkedin.approval_allows_posting({"approval_status": "not_required"}) is True
    assert linkedin.approval_allows_posting({"approval_status": ""}) is False
    assert linkedin.approval_allows_posting({"approval_status": "pending"}) is False


def test_build_daily_queue_excludes_blank_approval(tmp_path, monkeypatch):
    schedule_path = tmp_path / "schedule.csv"
    pd.DataFrame(
        [
            {
                "post_id": "post_1",
                "post_date": "2026-03-26",
                "post_time": "09:00",
                "brand": "jakoma",
                "platform": "linkedin",
                "post_type": "text",
                "theme": "",
                "campaign": "",
                "status": "approved",
                "content_folder": "content/jakoma/2026-03-26",
                "asset_filename": "",
                "caption_filename": "one.txt",
                "notes": "",
                "approval_status": "approved",
            },
            {
                "post_id": "post_2",
                "post_date": "2026-03-26",
                "post_time": "10:00",
                "brand": "jakoma",
                "platform": "linkedin",
                "post_type": "text",
                "theme": "",
                "campaign": "",
                "status": "approved",
                "content_folder": "content/jakoma/2026-03-26",
                "asset_filename": "",
                "caption_filename": "two.txt",
                "notes": "",
                "approval_status": "",
            },
        ]
    ).to_csv(schedule_path, index=False)

    monkeypatch.setattr(build_daily_queue, "SCHEDULE_CSV", schedule_path)
    monkeypatch.setattr(build_daily_queue, "DAILY_QUEUE_DIR", tmp_path)
    output_path = build_daily_queue.build_daily_queue("2026-03-26")
    queued = pd.read_csv(output_path, dtype=str).fillna("")

    assert queued["post_id"].tolist() == ["post_1"]


def test_normalise_plan_name_supports_founding_aliases():
    assert billing.normalise_plan_name("founding_starter") == "agency"
    assert billing.normalise_plan_name("founding_growth") == "agency"
    assert billing.normalise_plan_name("founding_plus") == "agency"


def test_bootstrap_file_copies_example_to_working_path(tmp_path):
    source = tmp_path / "example.csv"
    destination = tmp_path / "working.csv"
    source.write_text("a,b\n1,2\n", encoding="utf-8")

    result = bootstrap_demo_data.bootstrap_file(source, destination, force=False)

    assert destination.read_text(encoding="utf-8") == "a,b\n1,2\n"
    assert "copied" in result


def test_publish_tracking_tables_exist_in_schema(tmp_path):
    db_path = tmp_path / "schema.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    tables = {name for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()

    assert "publish_attempts" in tables
    assert "audit_log" in tables


def test_init_db_adds_workspace_column_to_existing_subscriptions_table(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy_subscriptions.db"
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          stripe_customer_id TEXT UNIQUE,
          stripe_subscription_id TEXT UNIQUE,
          stripe_price_id TEXT,
          plan_name TEXT,
          status TEXT NOT NULL DEFAULT 'trialing',
          billing_email TEXT,
          started_at TEXT,
          current_period_end TEXT,
          cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(init_db, "APP_DB", db_path)
    monkeypatch.setattr(init_db, "SCHEMA_SQL", ROOT / "database" / "schema.sql")

    assert init_db.main() == 0

    conn = sqlite3.connect(db_path)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(subscriptions)")}
    conn.close()
    assert "workspace_id" in columns


def test_init_db_adds_auth_columns_to_existing_users_table(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          company_name TEXT,
          role TEXT,
          status TEXT NOT NULL DEFAULT 'invited',
          stripe_customer_id TEXT UNIQUE,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(init_db, "APP_DB", db_path)
    monkeypatch.setattr(init_db, "SCHEMA_SQL", ROOT / "database" / "schema.sql")

    assert init_db.main() == 0

    conn = sqlite3.connect(db_path)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    brand_columns = {row[1] for row in conn.execute("PRAGMA table_info(brands)")}
    tables = {name for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()

    assert {"password_hash", "email_verified_at", "last_login_at", "invited_at", "activated_at", "is_ops_admin"}.issubset(columns)
    assert "workspace_id" in brand_columns
    assert "auth_tokens" in tables
    assert "login_events" in tables
    assert "workspaces" in tables
    assert "workspace_memberships" in tables
