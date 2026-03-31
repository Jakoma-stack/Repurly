from __future__ import annotations

import base64
import io
import sqlite3
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import onboarding_app  # noqa: E402
import publish_tracking  # noqa: E402
from utils import save_text  # noqa: E402


@pytest.fixture()
def app_client(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    schedule_path = tmp_path / "schedule.csv"

    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.execute(
        """
        INSERT INTO brands (slug, display_name, website, contact_email, linkedin_author_urn, linkedin_token_env, settings_json)
        VALUES ('jakoma', 'Jakoma', 'https://example.com', 'team@example.com', 'urn:li:person:test', 'LINKEDIN_TEST', '{}')
        """
    )
    conn.commit()
    conn.close()

    pd.DataFrame(
        [
            {
                "post_id": "jakoma_2026-03-26_linkedin_001",
                "post_date": "2026-03-26",
                "post_time": "09:00",
                "brand": "jakoma",
                "platform": "linkedin",
                "post_type": "text",
                "theme": "spring refresh",
                "campaign": "launch",
                "status": "drafted",
                "content_folder": "content/jakoma/2026-03-26",
                "asset_filename": "",
                "caption_filename": "caption.txt",
                "notes": "",
                "approval_status": "pending",
                "platform_post_id": "",
                "last_publish_error": "",
            }
        ]
    ).to_csv(schedule_path, index=False)

    content_dir = tmp_path / "content"
    content_folder = content_dir / "jakoma" / "2026-03-26"
    (content_folder / "captions").mkdir(parents=True, exist_ok=True)
    (content_folder / "assets").mkdir(parents=True, exist_ok=True)
    save_text(content_folder / "captions" / "caption.txt", "Hello LinkedIn")

    monkeypatch.delenv("OPS_USERNAME", raising=False)
    monkeypatch.delenv("OPS_PASSWORD", raising=False)
    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    monkeypatch.setattr(onboarding_app, "SCHEDULE_CSV", schedule_path)
    monkeypatch.setattr(publish_tracking, "APP_DB", db_path)
    monkeypatch.setattr(onboarding_app, "build_content_date_folder", lambda brand, post_date: content_folder)

    onboarding_app.app.config.update(TESTING=True)
    with onboarding_app.app.test_client() as client:
        yield client, db_path, schedule_path


def test_ops_dashboard_and_detail_pages_render(app_client):
    client, _, _ = app_client

    dashboard = client.get("/ops")
    assert dashboard.status_code == 200
    assert b"Ops dashboard" in dashboard.data
    assert b"jakoma_2026-03-26_linkedin_001" not in dashboard.data

    detail = client.get("/ops/schedule/jakoma_2026-03-26_linkedin_001")
    assert detail.status_code == 200
    assert b"Post detail: jakoma_2026-03-26_linkedin_001" in detail.data
    assert b"Hello LinkedIn" in detail.data


def test_ops_approve_action_updates_schedule_and_audit_log(app_client):
    client, db_path, schedule_path = app_client

    response = client.post(
        "/ops/schedule/jakoma_2026-03-26_linkedin_001/approve",
        data={"actor": "qa_reviewer"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Draft approved." in response.data

    updated = pd.read_csv(schedule_path, dtype=str).fillna("")
    row = updated.iloc[0].to_dict()
    assert row["approval_status"] == "approved"
    assert row["status"] == "approved"

    conn = sqlite3.connect(db_path)
    audit_row = conn.execute(
        "SELECT event_type, actor FROM audit_log WHERE post_id=? ORDER BY id DESC LIMIT 1",
        ("jakoma_2026-03-26_linkedin_001",),
    ).fetchone()
    conn.close()
    assert audit_row == ("draft_approved", "qa_reviewer")


def test_ops_reject_action_adds_reason_to_notes(app_client):
    client, db_path, schedule_path = app_client

    response = client.post(
        "/ops/schedule/jakoma_2026-03-26_linkedin_001/reject",
        data={"actor": "qa_reviewer", "reason": "Needs a stronger CTA"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Draft rejected." in response.data

    updated = pd.read_csv(schedule_path, dtype=str).fillna("")
    row = updated.iloc[0].to_dict()
    assert row["approval_status"] == "rejected"
    assert row["status"] == "rejected"
    assert "Needs a stronger CTA" in row["notes"]

    conn = sqlite3.connect(db_path)
    audit_row = conn.execute(
        "SELECT event_type, actor, message FROM audit_log WHERE post_id=? ORDER BY id DESC LIMIT 1",
        ("jakoma_2026-03-26_linkedin_001",),
    ).fetchone()
    conn.close()
    assert audit_row == ("draft_rejected", "qa_reviewer", "Needs a stronger CTA")


def test_ops_health_and_summary_api(app_client):
    client, _, _ = app_client

    health = client.get("/ops/health")
    assert health.status_code == 200
    assert b"Setup and data health" in health.data
    assert b"schedule_validation" in health.data

    summary = client.get("/api/ops/summary")
    assert summary.status_code == 200
    payload = summary.get_json()
    assert payload["brands"] == 1
    assert payload["scheduled_posts"] == 1
    assert payload["status_counts"][0]["label"] == "drafted"


def test_ops_asset_upload_updates_schedule_and_assets_table(app_client):
    client, db_path, schedule_path = app_client

    response = client.post(
        "/ops/schedule/jakoma_2026-03-26_linkedin_001/upload-assets",
        data={
            "actor": "qa_reviewer",
            "merge_mode": "append",
            "switch_post_type": "1",
            "assets": [(io.BytesIO(b"fake image bytes"), "hero image.png")],
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Uploaded 1 asset(s)" in response.data

    updated = pd.read_csv(schedule_path, dtype=str).fillna("")
    row = updated.iloc[0].to_dict()
    assert row["asset_filename"] == "hero_image.png"
    assert row["post_type"] == "image"
    assert row["asset_mode"] == "single_image"

    conn = sqlite3.connect(db_path)
    asset_row = conn.execute(
        "SELECT file_name, mime_type FROM assets ORDER BY id DESC LIMIT 1"
    ).fetchone()
    audit_row = conn.execute(
        "SELECT event_type, actor FROM audit_log WHERE post_id=? ORDER BY id DESC LIMIT 1",
        ("jakoma_2026-03-26_linkedin_001",),
    ).fetchone()
    conn.close()
    assert asset_row == ("hero_image.png", "image/png")
    assert audit_row == ("assets_uploaded", "qa_reviewer")


def test_ops_retry_publish_route_updates_status_and_audit(app_client, monkeypatch):
    client, db_path, schedule_path = app_client

    failed = pd.read_csv(schedule_path, dtype=str).fillna("")
    failed.loc[failed["post_id"] == "jakoma_2026-03-26_linkedin_001", "status"] = "failed"
    failed.loc[failed["post_id"] == "jakoma_2026-03-26_linkedin_001", "approval_status"] = "approved"
    failed.loc[failed["post_id"] == "jakoma_2026-03-26_linkedin_001", "last_publish_error"] = "Missing asset files"
    failed.to_csv(schedule_path, index=False)

    def fake_process(post_id: str, *, allow_retry_failed: bool = True):
        assert post_id == "jakoma_2026-03-26_linkedin_001"
        assert allow_retry_failed is True
        updated = pd.read_csv(schedule_path, dtype=str).fillna("")
        mask = updated["post_id"] == post_id
        updated.loc[mask, "status"] = "posted"
        updated.loc[mask, "platform_post_id"] = "urn:li:share:123"
        updated.loc[mask, "last_publish_error"] = ""
        updated.to_csv(schedule_path, index=False)
        return {
            "post_id": post_id,
            "action": "success",
            "posted_count": 1,
            "failed_count": 0,
            "row": updated.loc[mask].iloc[0].to_dict(),
        }

    monkeypatch.setattr(onboarding_app, "process_linkedin_post_id", fake_process)

    response = client.post(
        "/ops/schedule/jakoma_2026-03-26_linkedin_001/retry-publish",
        data={"actor": "ops_runner"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"LinkedIn publish completed successfully." in response.data

    updated = pd.read_csv(schedule_path, dtype=str).fillna("")
    row = updated.iloc[0].to_dict()
    assert row["status"] == "posted"
    assert row["platform_post_id"] == "urn:li:share:123"

    conn = sqlite3.connect(db_path)
    audit_rows = conn.execute(
        "SELECT event_type, actor FROM audit_log WHERE post_id=? ORDER BY id DESC LIMIT 2",
        ("jakoma_2026-03-26_linkedin_001",),
    ).fetchall()
    conn.close()
    assert audit_rows[0] == ("publish_retry_completed", "ops_runner")
    assert audit_rows[1] == ("publish_retry_requested", "ops_runner")


def test_asset_library_page_and_attach_existing_asset(app_client):
    client, db_path, schedule_path = app_client

    library_file = Path(schedule_path).parent / "library_asset.png"
    library_file.write_bytes(b"existing asset bytes")

    conn = sqlite3.connect(db_path)
    brand_id = conn.execute("SELECT id FROM brands WHERE slug='jakoma'").fetchone()[0]
    conn.execute(
        "INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status) VALUES (?, ?, ?, ?, 'image', 'active')",
        (brand_id, "library_asset.png", str(library_file), "image/png"),
    )
    asset_id = conn.execute("SELECT id FROM assets ORDER BY id DESC LIMIT 1").fetchone()[0]
    conn.commit()
    conn.close()

    page = client.get("/ops/assets?brand=jakoma&post_id=jakoma_2026-03-26_linkedin_001")
    assert page.status_code == 200
    assert b"Asset library" in page.data
    assert b"library_asset.png" in page.data

    response = client.post(
        "/ops/schedule/jakoma_2026-03-26_linkedin_001/attach-assets",
        data={
            "actor": "asset_operator",
            "merge_mode": "append",
            "switch_post_type": "1",
            "asset_ids": [str(asset_id)],
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Attached 1 existing asset(s)" in response.data

    updated = pd.read_csv(schedule_path, dtype=str).fillna("")
    row = updated.iloc[0].to_dict()
    assert row["asset_filename"] == "library_asset.png"
    assert row["post_type"] == "image"
    assert row["asset_mode"] == "single_image"

    copied_path = Path(schedule_path).parent / "content" / "jakoma" / "2026-03-26" / "assets" / "library_asset.png"
    assert copied_path.exists()

    conn = sqlite3.connect(db_path)
    audit_row = conn.execute(
        "SELECT event_type, actor FROM audit_log WHERE post_id=? ORDER BY id DESC LIMIT 1",
        ("jakoma_2026-03-26_linkedin_001",),
    ).fetchone()
    conn.close()
    assert audit_row == ("assets_attached", "asset_operator")



def test_bulk_retry_route_processes_selected_posts(app_client, monkeypatch):
    client, db_path, schedule_path = app_client

    schedule_df = pd.concat(
        [
            pd.read_csv(schedule_path, dtype=str).fillna(""),
            pd.DataFrame(
                [
                    {
                        "post_id": "jakoma_2026-03-26_linkedin_002",
                        "post_date": "2026-03-26",
                        "post_time": "10:00",
                        "brand": "jakoma",
                        "platform": "linkedin",
                        "post_type": "text",
                        "theme": "spring refresh",
                        "campaign": "launch",
                        "status": "failed",
                        "content_folder": "content/jakoma/2026-03-26",
                        "asset_filename": "",
                        "caption_filename": "caption.txt",
                        "notes": "",
                        "approval_status": "approved",
                        "platform_post_id": "",
                        "last_publish_error": "API error",
                    }
                ]
            ),
        ],
        ignore_index=True,
    )
    schedule_df.loc[schedule_df["post_id"] == "jakoma_2026-03-26_linkedin_001", "status"] = "failed"
    schedule_df.loc[schedule_df["post_id"] == "jakoma_2026-03-26_linkedin_001", "approval_status"] = "approved"
    schedule_df.to_csv(schedule_path, index=False)

    def fake_process(post_id: str, *, allow_retry_failed: bool = True):
        assert allow_retry_failed is True
        updated = pd.read_csv(schedule_path, dtype=str).fillna("")
        mask = updated["post_id"] == post_id
        updated.loc[mask, "status"] = "posted"
        updated.loc[mask, "platform_post_id"] = f"urn:li:share:{post_id[-3:]}"
        updated.loc[mask, "last_publish_error"] = ""
        updated.to_csv(schedule_path, index=False)
        return {
            "post_id": post_id,
            "action": "success",
            "posted_count": 1,
            "failed_count": 0,
            "row": updated.loc[mask].iloc[0].to_dict(),
        }

    monkeypatch.setattr(onboarding_app, "process_linkedin_post_id", fake_process)

    response = client.post(
        "/ops/schedule/bulk-retry",
        data={
            "actor": "bulk_runner",
            "post_ids": ["jakoma_2026-03-26_linkedin_001", "jakoma_2026-03-26_linkedin_002"],
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Requested 2 retries. Success=2, failed=0, skipped=0" in response.data

    updated = pd.read_csv(schedule_path, dtype=str).fillna("")
    assert set(updated["status"].tolist()) == {"posted"}

    conn = sqlite3.connect(db_path)
    audit_rows = conn.execute(
        "SELECT event_type, actor FROM audit_log WHERE actor=? ORDER BY id DESC LIMIT 4",
        ("bulk_runner",),
    ).fetchall()
    conn.close()
    assert audit_rows[0] == ("publish_retry_completed", "bulk_runner")
    assert audit_rows[1] == ("publish_retry_requested", "bulk_runner")


def test_ops_routes_require_basic_auth_when_credentials_are_configured(app_client, monkeypatch):
    client, _, _ = app_client
    monkeypatch.setenv("OPS_USERNAME", "ops_admin")
    monkeypatch.setenv("OPS_PASSWORD", "super-secret")

    response = client.get("/ops")
    assert response.status_code == 401
    assert "Basic" in response.headers["WWW-Authenticate"]

    token = base64.b64encode(b"ops_admin:super-secret").decode("ascii")
    authed = client.get("/ops", headers={"Authorization": f"Basic {token}"})
    assert authed.status_code == 200


def test_ops_asset_upload_rejects_unsupported_file_types(app_client):
    client, _, _ = app_client

    response = client.post(
        "/ops/schedule/jakoma_2026-03-26_linkedin_001/upload-assets",
        data={
            "actor": "qa_reviewer",
            "merge_mode": "append",
            "switch_post_type": "1",
            "assets": [(io.BytesIO(b"not an image"), "notes.txt")],
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Unsupported file type" in response.data


def test_public_root_redirects_to_signup_and_health_routes_render(app_client):
    client, _, _ = app_client

    root_response = client.get("/", follow_redirects=False)
    assert root_response.status_code == 302
    assert root_response.headers["Location"].endswith("/")

    robots = client.get("/robots.txt")
    assert robots.status_code == 200
    assert b"Disallow: /" in robots.data

    health = client.get("/healthz")
    assert health.status_code == 200
    assert health.get_json()["ok"] is True


def test_beta_signup_requires_privacy_consent(app_client):
    client, db_path, _ = app_client

    response = client.post(
        "/beta",
        data={
            "email": "buyer@example.com",
            "full_name": "Buyer Person",
            "company_name": "Agency Co",
            "selected_plan": "agency",
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"You must confirm that you have read the privacy notice." in response.data

    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM founding_user_signups").fetchone()[0]
    conn.close()
    assert count == 0


def test_billing_checkout_session_route_fails_cleanly_when_stripe_not_configured(app_client, monkeypatch):
    client, _, _ = app_client
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_STARTER", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_AGENCY", raising=False)
    monkeypatch.delenv("STRIPE_PRICE_PRO", raising=False)

    response = client.post(
        "/billing/create-checkout-session",
        data={
            "email": "buyer@example.com",
            "full_name": "Buyer Person",
            "company_name": "Agency Co",
            "selected_plan": "agency",
            "privacy_consent": "yes",
        },
        follow_redirects=True,
    )
    assert response.status_code == 400
    assert b"STRIPE_SECRET_KEY is missing." in response.data
