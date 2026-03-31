from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import post_to_linkedin as linkedin  # noqa: E402


class DummyResponse:
    def __init__(self, *, ok: bool = True, status_code: int = 200, text: str = "", json_data=None):
        self.ok = ok
        self.status_code = status_code
        self.text = text
        self._json_data = json_data if json_data is not None else {}

    def json(self):
        return self._json_data


def test_resolve_linkedin_credentials_uses_brand_specific_env_token(monkeypatch):
    monkeypatch.setenv("LINKEDIN_DRY_RUN", "false")
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN_JAKOMA", "brand-token")
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN", "global-token")

    author_urn, access_token = linkedin.resolve_linkedin_credentials("jakoma")

    assert author_urn == "urn:li:person:sOF0UaJQdy"
    assert access_token == "brand-token"


def test_resolve_linkedin_credentials_falls_back_to_global_token_when_brand_has_no_token_env(monkeypatch):
    monkeypatch.setenv("LINKEDIN_DRY_RUN", "false")
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN", "global-token")

    original_get_brand_config = linkedin.get_brand_config
    monkeypatch.setattr(
        linkedin,
        "get_brand_config",
        lambda brand: {"linkedin_author_urn": "urn:li:person:testperson"},
    )

    author_urn, access_token = linkedin.resolve_linkedin_credentials("test_brand")

    assert author_urn == "urn:li:person:testperson"
    assert access_token == "global-token"
    monkeypatch.setattr(linkedin, "get_brand_config", original_get_brand_config)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("urn:li:person:abc123", "urn:li:person:abc123"),
        ("li:person:abc123", "urn:li:person:abc123"),
        ("person:abc123", "urn:li:person:abc123"),
        ("organization:987", "urn:li:organization:987"),
    ],
)
def test_normalise_linkedin_author_urn(raw, expected):
    assert linkedin.normalise_linkedin_author_urn(raw) == expected


def test_publish_text_post_dry_run_reflects_runtime_env(monkeypatch):
    monkeypatch.setenv("LINKEDIN_DRY_RUN", "true")
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN_JAKOMA", "brand-token")

    result = linkedin.publish_text_post("jakoma", "hello world")

    assert result["ok"] is True
    assert result["dry_run"] is True
    assert result["author_urn"] == "urn:li:person:sOF0UaJQdy"


def test_build_linkedin_single_image_payload_includes_media_id_and_alt_text():
    payload = linkedin.build_linkedin_single_image_payload(
        "urn:li:person:test",
        "hello",
        "urn:li:digitalmediaAsset:123",
        "Example alt",
    )
    assert payload["content"]["media"]["id"] == "urn:li:digitalmediaAsset:123"
    assert payload["content"]["media"]["altText"] == "Example alt"


def test_extract_linkedin_asset_upload_supports_expected_shape():
    asset_urn, upload_url = linkedin.extract_linkedin_asset_upload(
        {
            "value": {
                "asset": "urn:li:digitalmediaAsset:123",
                "uploadMechanism": {
                    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
                        "uploadUrl": "https://upload.example.com"
                    }
                },
            }
        }
    )
    assert asset_urn == "urn:li:digitalmediaAsset:123"
    assert upload_url == "https://upload.example.com"


def test_wait_for_linkedin_asset_ready_accepts_available_recipe(monkeypatch):
    statuses = iter([
        {"recipes": [{"status": "PROCESSING"}]},
        {"recipes": [{"status": "AVAILABLE"}]},
    ])
    monkeypatch.setattr(linkedin, "fetch_linkedin_asset_status", lambda token, asset_urn: next(statuses))
    monkeypatch.setattr(linkedin.time, "sleep", lambda _: None)
    status = linkedin.wait_for_linkedin_asset_ready("token", "urn:li:digitalmediaAsset:123", attempts=2, sleep_seconds=0)
    assert status["recipes"][0]["status"] == "AVAILABLE"


def test_publish_single_image_post_live_flow(monkeypatch, tmp_path):
    monkeypatch.setenv("LINKEDIN_DRY_RUN", "false")
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN_JAKOMA", "brand-token")

    image_path = tmp_path / "hero.png"
    image_path.write_bytes(b"fakepng")

    monkeypatch.setattr(linkedin, "register_linkedin_image_upload", lambda token, owner: ("urn:li:digitalmediaAsset:123", "https://upload.example.com"))
    uploaded = {}
    monkeypatch.setattr(linkedin, "upload_linkedin_image_bytes", lambda token, url, path: uploaded.update({"url": url, "path": path.name}))
    monkeypatch.setattr(linkedin, "wait_for_linkedin_asset_ready", lambda token, asset_urn: {"status": "AVAILABLE"})
    monkeypatch.setattr(linkedin, "create_linkedin_post", lambda token, payload: DummyResponse(ok=True, status_code=201, text="created"))

    result = linkedin.publish_image_post("jakoma", "hello", [image_path], "Alt text")

    assert result["ok"] is True
    assert result["dry_run"] is False
    assert result["asset_mode"] == "single_image"
    assert result["asset_urn"] == "urn:li:digitalmediaAsset:123"
    assert uploaded == {"url": "https://upload.example.com", "path": "hero.png"}


def test_resolve_linkedin_credentials_accepts_author_alias(monkeypatch):
    monkeypatch.setenv("LINKEDIN_DRY_RUN", "false")
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN", "global-token")
    monkeypatch.setattr(linkedin, "get_brand_config", lambda brand: {"author_urn": "person:alias123"})

    author_urn, access_token = linkedin.resolve_linkedin_credentials("alias_brand")

    assert author_urn == "urn:li:person:alias123"
    assert access_token == "global-token"


def test_schedule_row_is_due_respects_post_time():
    row = {"post_date": "2026-03-29", "post_time": "10:30"}
    assert linkedin.schedule_row_is_due(row, now_utc=linkedin.datetime(2026, 3, 29, 10, 30, tzinfo=linkedin.timezone.utc)) is True
    assert linkedin.schedule_row_is_due(row, now_utc=linkedin.datetime(2026, 3, 29, 10, 29, tzinfo=linkedin.timezone.utc)) is False


def test_process_due_linkedin_posts_only_posts_due_rows(monkeypatch, tmp_path):
    schedule_path = tmp_path / "schedule.csv"
    schedule_path.write_text(
        "post_id,post_date,post_time,brand,platform,post_type,theme,campaign,status,content_folder,asset_filename,caption_filename,notes,approval_status\n"
        "due_post,2026-03-29,09:00,jakoma,linkedin,text,theme,campaign,approved,folder,,caption.txt,notes,approved\n"
        "later_post,2026-03-29,15:00,jakoma,linkedin,text,theme,campaign,approved,folder,,caption.txt,notes,approved\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(linkedin, "SCHEDULE_CSV", schedule_path)

    calls = []
    def fake_process(schedule_df, eligible_df):
        calls.extend(list(eligible_df["post_id"]))
        return schedule_df, {"posted_count": len(calls), "failed_count": 0, "actions": {post_id: "success" for post_id in calls}}

    monkeypatch.setattr(linkedin, "_process_selected_linkedin_rows", fake_process)
    monkeypatch.setattr(linkedin, "save_csv", lambda df, path: None)

    result = linkedin.process_due_linkedin_posts(now_utc=linkedin.datetime(2026, 3, 29, 10, 0, tzinfo=linkedin.timezone.utc))

    assert result == 0
    assert calls == ["due_post"]
