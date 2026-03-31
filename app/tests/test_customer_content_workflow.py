from __future__ import annotations

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
from auth import hash_password  # noqa: E402


@pytest.fixture()
def content_client(tmp_path, monkeypatch):
    db_path = tmp_path / "content.db"
    schedule_path = tmp_path / "schedule.csv"
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.execute(
        "INSERT INTO users (email, full_name, company_name, role, status, password_hash, activated_at, email_verified_at) VALUES (?, ?, ?, 'customer', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ("owner@example.com", "Owner User", "Agency Co", hash_password("LongPassword123!")),
    )
    user_id = conn.execute("SELECT id FROM users WHERE email='owner@example.com'").fetchone()[0]
    conn.execute(
        "INSERT INTO workspaces (slug, display_name, company_name, status, selected_plan, owner_user_id) VALUES ('agency-co', 'Agency Co', 'Agency Co', 'active', 'agency', ?)",
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
    brand_id = conn.execute("SELECT id FROM brands WHERE workspace_id=?", (workspace_id,)).fetchone()[0]
    asset_dir = tmp_path / "uploads"
    asset_dir.mkdir(parents=True, exist_ok=True)
    logo_path = asset_dir / "logo.png"
    logo_path.write_bytes(b"pngdata")
    slide1_path = asset_dir / "slide1.png"
    slide1_path.write_bytes(b"slide1")
    slide2_path = asset_dir / "slide2.png"
    slide2_path.write_bytes(b"slide2")
    teaser_video_path = asset_dir / "teaser.mp4"
    teaser_video_path.write_bytes(b"mp4data")
    conn.execute(
        "INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status, alt_text) VALUES (?, 'logo.png', ?, 'image/png', 'image', 'active', 'Logo')",
        (brand_id, str(logo_path)),
    )
    conn.execute(
        "INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status, alt_text) VALUES (?, 'slide1.png', ?, 'image/png', 'image', 'active', 'Slide one')",
        (brand_id, str(slide1_path)),
    )
    conn.execute(
        "INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status, alt_text) VALUES (?, 'slide2.png', ?, 'image/png', 'image', 'active', 'Slide two')",
        (brand_id, str(slide2_path)),
    )
    conn.execute(
        "INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status, alt_text) VALUES (?, 'teaser.mp4', ?, 'video/mp4', 'video', 'active', 'Launch teaser video')",
        (brand_id, str(teaser_video_path)),
    )
    conn.commit()
    conn.close()

    monkeypatch.delenv("OPS_USERNAME", raising=False)
    monkeypatch.delenv("OPS_PASSWORD", raising=False)
    monkeypatch.setattr(onboarding_app, "APP_DB", db_path)
    monkeypatch.setattr(onboarding_app, "SCHEDULE_CSV", schedule_path)
    monkeypatch.setattr(onboarding_app, "build_content_date_folder", lambda brand, post_date: tmp_path / "content" / brand / post_date)
    onboarding_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
    with onboarding_app.app.test_client() as client:
        client.post("/login", data={"email": "owner@example.com", "password": "LongPassword123!", "next": "/dashboard"})
        yield client, db_path, schedule_path, workspace_id, brand_id, tmp_path




def test_workspace_content_page_loads(content_client):
    client, *_ = content_client
    response = client.get("/workspace/content")
    assert response.status_code == 200
    assert b"AI weekly planner" in response.data
    assert b"Visual schedule" in response.data

def test_workspace_help_page_loads(content_client):
    client, *_ = content_client
    response = client.get("/workspace/help")
    assert response.status_code == 200
    assert b"Choosing the right format" in response.data
    assert b"Schedule for publishing" in response.data


def test_customer_can_schedule_single_image_post(content_client):
    client, db_path, schedule_path, _workspace_id, brand_id, tmp_path = content_client
    conn = sqlite3.connect(db_path)
    asset_id = conn.execute("SELECT id FROM assets WHERE file_name='logo.png'").fetchone()[0]
    conn.close()

    response = client.post(
        "/workspace/content/save",
        data={
            "brand_id": str(brand_id),
            "topic": "Launch update",
            "hook": "Big release week",
            "caption_text": "We have launched a new workflow for client onboarding.",
            "cta": "Book a call",
            "hashtags_text": "#launch,#agency",
            "post_type": "single_image",
            "asset_ids": [str(asset_id)],
            "post_date": "2026-04-02",
            "post_time": "09:30",
            "campaign": "launch",
            "notes": "Priority post",
            "review_notes": "Check the CTA",
            "action": "schedule_publish",
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "saved=scheduled" in response.headers["Location"]

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    draft = conn.execute("SELECT * FROM generated_posts ORDER BY id DESC LIMIT 1").fetchone()
    schedule = conn.execute("SELECT * FROM schedules ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()

    assert draft is not None
    assert schedule is not None
    assert draft["post_type"] == "single_image"
    assert draft["approval_status"] == "approved"
    assert schedule["status"] == "approved"
    assert schedule["approval_status"] == "approved"
    assert schedule["asset_filename"] == "logo.png"

    scheduled_df = pd.read_csv(schedule_path, dtype=str).fillna("")
    assert scheduled_df.iloc[0]["post_type"] == "single_image"
    assert scheduled_df.iloc[0]["approval_status"] == "approved"
    assert (tmp_path / "content" / "client_one" / "2026-04-02" / "captions" / f"{draft['post_id']}.txt").exists()
    assert (tmp_path / "content" / "client_one" / "2026-04-02" / "assets" / "logo.png").exists()


def test_customer_can_submit_carousel_for_review(content_client):
    client, db_path, schedule_path, _workspace_id, brand_id, _tmp_path = content_client
    conn = sqlite3.connect(db_path)
    asset_ids = [str(row[0]) for row in conn.execute("SELECT id FROM assets WHERE brand_id=? AND file_name IN ('slide1.png', 'slide2.png') ORDER BY file_name ASC", (brand_id,)).fetchall()]
    conn.close()

    response = client.post(
        "/workspace/content/save",
        data={
            "brand_id": str(brand_id),
            "topic": "Carousel explainer",
            "hook": "How the workflow works",
            "caption_text": "Swipe through the workflow steps.",
            "post_type": "carousel",
            "asset_ids": asset_ids,
            "post_date": "2026-04-03",
            "post_time": "11:00",
            "campaign": "education",
            "action": "submit_review",
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "saved=submitted" in response.headers["Location"]

    conn = sqlite3.connect(db_path)
    schedule = conn.execute("SELECT post_type, status, approval_status, asset_filename FROM schedules ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    assert schedule[0] == "carousel"
    assert schedule[1] == "drafted"
    assert schedule[2] == "pending"
    assert schedule[3] == "slide1.png|slide2.png"

    scheduled_df = pd.read_csv(schedule_path, dtype=str).fillna("")
    assert scheduled_df.iloc[-1]["post_type"] == "carousel"
    assert scheduled_df.iloc[-1]["status"] == "drafted"


def test_ai_generation_can_overwrite_selected_draft(content_client):
    client, db_path, schedule_path, _workspace_id, brand_id, _tmp_path = content_client
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO generated_posts (brand_id, post_id, platform, post_type, topic, hook, body_points_json, cta, hashtags_json, caption_text, generation_mode, approval_status, asset_ids_json, review_notes, prompt_brief, planner_label, last_saved_at)
        VALUES (?, 'client-one-001', 'linkedin', 'text', 'Old topic', 'Old hook', '[]', 'Old CTA', '["#old"]', 'Old caption', 'customer_editor', 'draft', '[]', '', 'Old brief', 'Old campaign', CURRENT_TIMESTAMP)
        """,
        (brand_id,),
    )
    draft_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()

    response = client.post(
        "/workspace/content/generate",
        data={
            "brand_id": str(brand_id),
            "brief": "fresh launch angle",
            "post_type": "text",
            "overwrite_mode": "overwrite_selected",
            "target_draft_id": str(draft_id),
            "count": "7",
            "action": "generate_week",
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert f"draft={draft_id}" in response.headers["Location"]

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, topic, hook, caption_text, generation_mode, planner_label FROM generated_posts WHERE brand_id=? ORDER BY id ASC", (brand_id,)).fetchall()
    conn.close()

    assert len(rows) == 1
    assert rows[0]["id"] == draft_id
    assert rows[0]["generation_mode"] == "ai_assisted"
    assert rows[0]["topic"] != "Old topic"
    assert rows[0]["caption_text"] != "Old caption"
    assert rows[0]["planner_label"]


def test_content_page_shows_overwrite_option_for_selected_draft(content_client):
    client, db_path, _schedule_path, _workspace_id, brand_id, _tmp_path = content_client
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO generated_posts (brand_id, post_id, platform, post_type, topic, hook, body_points_json, cta, hashtags_json, caption_text, generation_mode, approval_status, asset_ids_json, review_notes, prompt_brief, planner_label, last_saved_at)
        VALUES (?, 'client-one-002', 'linkedin', 'text', 'Draft to overwrite', '', '[]', '', '[]', 'Existing caption', 'customer_editor', 'draft', '[]', '', 'Existing brief', 'Existing campaign', CURRENT_TIMESTAMP)
        """,
        (brand_id,),
    )
    draft_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()

    response = client.get(f"/workspace/content?draft={draft_id}")
    assert response.status_code == 200
    assert b"Overwrite selected draft with AI" in response.data
    assert b"target_draft_id" in response.data
    assert b"Replace this draft with 1-week AI plan" in response.data
    assert b"Warning:" in response.data
    assert b"This will replace the current draft content with AI-generated copy." in response.data


def test_customer_can_save_video_draft(content_client):
    client, db_path, _schedule_path, _workspace_id, brand_id, _tmp_path = content_client
    conn = sqlite3.connect(db_path)
    asset_id = conn.execute("SELECT id FROM assets WHERE file_name='teaser.mp4'").fetchone()[0]
    conn.close()

    response = client.post(
        "/workspace/content/save",
        data={
            "brand_id": str(brand_id),
            "topic": "Product teaser",
            "hook": "A faster way to launch",
            "caption_text": "Watch the short launch teaser.",
            "post_type": "video",
            "asset_ids": [str(asset_id)],
            "action": "save_draft",
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "saved=draft_saved" in response.headers["Location"]

    conn = sqlite3.connect(db_path)
    draft = conn.execute("SELECT post_type, asset_ids_json FROM generated_posts ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    assert draft[0] == "video"
    assert str(asset_id) in draft[1]


def test_ai_generation_supports_video_posts(content_client):
    client, db_path, _schedule_path, _workspace_id, brand_id, _tmp_path = content_client
    conn = sqlite3.connect(db_path)
    asset_id = conn.execute("SELECT id FROM assets WHERE file_name='teaser.mp4'").fetchone()[0]
    conn.close()

    response = client.post(
        "/workspace/content/generate",
        data={
            "brand_id": str(brand_id),
            "brief": "launch teaser campaign",
            "post_type": "video",
            "asset_ids": [str(asset_id)],
            "count": "3",
            "action": "generate_week",
        },
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert "saved=generated" in response.headers["Location"]

    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT post_type, asset_ids_json FROM generated_posts ORDER BY id DESC LIMIT 3").fetchall()
    conn.close()
    assert rows
    assert all(row[0] == "video" for row in rows)
    assert all(str(asset_id) in row[1] for row in rows)


def test_content_page_shows_video_format_options(content_client):
    client, *_ = content_client
    response = client.get("/workspace/content")
    assert response.status_code == 200
    assert b">Video<" in response.data
    assert b"Images, videos, and carousel sequences are all supported in the draft workflow." in response.data
