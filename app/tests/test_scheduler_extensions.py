from __future__ import annotations

import hashlib
import hmac
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import billing  # noqa: E402
import post_to_linkedin as linkedin  # noqa: E402
from utils import build_schedule_row, ensure_schedule_columns, upsert_schedule_row  # noqa: E402


def test_build_schedule_row_sets_safe_defaults():
    row = build_schedule_row(
        post_id="abc_001",
        post_date="2026-03-26",
        post_time="09:00",
        brand="My Brand",
        platform="LinkedIn",
        post_type="Text",
    )
    assert row["brand"] == "my_brand"
    assert row["platform"] == "linkedin"
    assert row["post_type"] == "text"
    assert row["content_folder"] == "content/my_brand/2026-03-26"


def test_upsert_schedule_row_adds_optional_columns_and_updates_existing_row():
    df = pd.DataFrame([
        {
            "post_id": "abc_001",
            "post_date": "2026-03-26",
            "post_time": "09:00",
            "brand": "my_brand",
            "platform": "linkedin",
            "post_type": "text",
            "theme": "",
            "campaign": "",
            "status": "planned",
            "content_folder": "content/my_brand/2026-03-26",
            "asset_filename": "",
            "caption_filename": "",
            "notes": "",
        }
    ])
    row = build_schedule_row(
        post_id="abc_001",
        post_date="2026-03-26",
        post_time="10:00",
        brand="my_brand",
        platform="linkedin",
        post_type="image",
        status="approved",
        approval_status="approved",
        asset_filename="hero.png",
    )
    updated = upsert_schedule_row(df, row)
    updated = ensure_schedule_columns(updated)
    record = updated.loc[updated["post_id"] == "abc_001"].iloc[0]
    assert record["post_time"] == "10:00"
    assert record["status"] == "approved"
    assert record["approval_status"] == "approved"
    assert record["asset_filename"] == "hero.png"


def test_determine_linkedin_asset_mode_prefers_single_image_before_carousel():
    assert linkedin.determine_linkedin_asset_mode("image", "hero.png") == "single_image"
    assert linkedin.determine_linkedin_asset_mode("image", "hero.png|detail.png") == "carousel"
    assert linkedin.determine_linkedin_asset_mode("text", "") == "text"


def test_normalise_asset_filenames_supports_common_separators():
    assert linkedin.normalise_asset_filenames("one.png, two.png;three.png| four.png") == [
        "one.png",
        "two.png",
        "three.png",
        "four.png",
    ]


def test_init_db_creates_expected_tables(tmp_path, monkeypatch):
    monkeypatch.chdir(ROOT)
    db_path = tmp_path / "test.db"
    schema_path = ROOT / "database" / "schema.sql"

    script = f"""
import sqlite3
from pathlib import Path
schema = Path(r'{schema_path.as_posix()}').read_text(encoding='utf-8')
conn = sqlite3.connect(r'{db_path.as_posix()}')
conn.executescript(schema)
conn.commit()
cur = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\")
print(','.join(name for (name,) in cur.fetchall()))
conn.close()
"""
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, check=True)
    assert "brands" in result.stdout
    assert "founding_user_signups" in result.stdout
    assert "generated_posts" in result.stdout
    assert "webhook_events" in result.stdout


def test_verify_stripe_webhook_signature_accepts_valid_signature():
    payload = b'{"id":"evt_123"}'
    secret = "whsec_test"
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.".encode("utf-8") + payload
    signature = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    header = f"t={timestamp},v1={signature}"
    assert billing.verify_stripe_webhook_signature(payload, header, secret) is True


def test_process_stripe_event_is_idempotent(tmp_path, monkeypatch):
    db_path = tmp_path / "billing.db"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    conn.close()
    monkeypatch.setattr(billing, "APP_DB", db_path)

    event = {
        "id": "evt_1",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_123",
                "customer": "cus_123",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_123"}}]},
                "metadata": {"selected_plan": "agency"},
                "current_period_end": 1770000000,
                "cancel_at_period_end": False,
            }
        },
    }

    first = billing.process_stripe_event(event)
    second = billing.process_stripe_event(event)

    assert first["duplicate"] is False
    assert second["duplicate"] is True

    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM subscriptions").fetchone()[0]
    webhook_count = conn.execute("SELECT COUNT(*) FROM webhook_events").fetchone()[0]
    conn.close()
    assert count == 1
    assert webhook_count == 1
