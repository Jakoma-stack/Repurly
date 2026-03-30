from __future__ import annotations

import argparse
import json
import mimetypes
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from config import (
    ELIGIBLE_POSTING_STATUSES,
    OPTIONAL_SCHEDULE_COLUMNS,
    POSTING_ALLOWED_APPROVAL_STATUSES,
    SCHEDULE_CSV,
    ensure_base_dirs,
)
from logger_setup import get_logger
from publish_tracking import (
    complete_publish_attempt,
    create_publish_attempt,
    get_successful_publish_attempt,
    record_audit_event,
)
from utils import (
    build_content_date_folder,
    get_brand_config,
    load_csv,
    normalise_optional_columns,
    read_text,
    save_csv,
    today_str,
)

logger = get_logger("post_to_linkedin", "posting.log")


def linkedin_dry_run_enabled() -> bool:
    return os.getenv("LINKEDIN_DRY_RUN", "true").strip().lower() in {"1", "true", "yes", "y"}


def global_linkedin_access_token() -> str:
    return os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip()


def linkedin_api_version() -> str:
    return os.getenv("LINKEDIN_API_VERSION", "202510").strip() or "202510"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_row_schedule_datetime(row: dict[str, Any] | Any) -> datetime | None:
    post_date = (row.get("post_date") or "").strip()
    if not post_date:
        return None
    post_time = (row.get("post_time") or "00:00").strip() or "00:00"
    try:
        return datetime.strptime(f"{post_date} {post_time}", "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def schedule_row_is_due(row: dict[str, Any] | Any, *, now_utc: datetime) -> bool:
    scheduled_at = parse_row_schedule_datetime(row)
    if scheduled_at is None:
        return False
    current = now_utc.replace(tzinfo=None)
    return scheduled_at <= current


def normalise_linkedin_author_urn(value: str) -> str:
    raw = (value or "").strip()
    if raw.startswith("urn:"):
        return raw
    if raw.startswith("li:"):
        return f"urn:{raw}"
    if raw.startswith("person:") or raw.startswith("organization:"):
        return f"urn:li:{raw}"
    return raw


def resolve_linkedin_credentials(brand: str) -> tuple[str, str]:
    brand_config = get_brand_config(brand)

    author_value = (
        brand_config.get("linkedin_author_urn")
        or brand_config.get("linkedin_author")
        or brand_config.get("author_urn")
        or ""
    )
    author_urn = normalise_linkedin_author_urn(str(author_value).strip())
    if not author_urn:
        raise RuntimeError(
            f"Brand '{brand}' is missing 'linkedin_author_urn' in config/brands/{brand}.json or the brands table."
        )

    token_env_name = (brand_config.get("linkedin_token_env") or "").strip()
    if token_env_name:
        access_token = os.getenv(token_env_name, "").strip()
        if not access_token and not linkedin_dry_run_enabled():
            raise RuntimeError(
                f"Brand '{brand}' expects token from env var '{token_env_name}', but it is empty or missing."
            )
    else:
        access_token = global_linkedin_access_token()

    if not linkedin_dry_run_enabled() and not access_token:
        raise RuntimeError(
            f"No LinkedIn access token available for brand '{brand}'. "
            "Set a global LINKEDIN_ACCESS_TOKEN or add linkedin_token_env to the brand config."
        )

    return author_urn, access_token


def normalise_asset_filenames(asset_filename: str) -> list[str]:
    raw = (asset_filename or "").strip()
    if not raw:
        return []
    items: list[str] = []
    for chunk in raw.replace(";", "|").replace(",", "|").split("|"):
        item = chunk.strip()
        if item:
            items.append(item)
    return items


def determine_linkedin_asset_mode(post_type: str, asset_filename: str) -> str:
    assets = normalise_asset_filenames(asset_filename)
    post_type = (post_type or "").strip().lower()
    if post_type == "text" or not assets:
        return "text"
    if len(assets) == 1:
        return "single_image"
    return "carousel"


def linkedin_headers(token: str, *, json_content: bool = True) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Linkedin-Version": linkedin_api_version(),
        "X-Restli-Protocol-Version": "2.0.0",
    }
    if json_content:
        headers["Content-Type"] = "application/json"
    return headers


def build_linkedin_text_payload(author_urn: str, text: str) -> dict[str, Any]:
    return {
        "author": author_urn,
        "commentary": text,
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }


def build_linkedin_single_image_payload(author_urn: str, text: str, asset_urn: str, image_alt_text: str = "") -> dict[str, Any]:
    media: dict[str, Any] = {
        "id": asset_urn,
    }
    alt_text = (image_alt_text or "").strip()
    if alt_text:
        media["altText"] = alt_text

    payload = build_linkedin_text_payload(author_urn, text)
    payload["content"] = {"media": media}
    return payload


def extract_linkedin_image_upload(data: dict[str, Any]) -> tuple[str, str]:
    value = data.get("value") or data
    image_urn = str(value.get("image") or "").strip()
    upload_url = str(value.get("uploadUrl") or "").strip()

    if image_urn and upload_url:
        return image_urn, upload_url

    raise RuntimeError(f"Unexpected LinkedIn image initializeUpload response: {json.dumps(data)}")


def extract_linkedin_asset_upload(data: dict[str, Any]) -> tuple[str, str]:
    """Compatibility wrapper for older LinkedIn asset-upload tests and payloads."""
    value = data.get("value") or data
    asset_urn = str(value.get("asset") or value.get("image") or "").strip()
    upload_url = str(value.get("uploadUrl") or "").strip()
    if not upload_url:
        mechanism = value.get("uploadMechanism") or {}
        request_payload = mechanism.get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest") or {}
        upload_url = str(request_payload.get("uploadUrl") or "").strip()

    if not asset_urn or not upload_url:
        raise RuntimeError(f"Unexpected LinkedIn asset registerUpload response: {json.dumps(data)}")

    return asset_urn, upload_url


def register_linkedin_image_upload(token: str, owner_urn: str) -> tuple[str, str]:
    payload = {
        "initializeUploadRequest": {
            "owner": owner_urn,
        }
    }
    response = requests.post(
        "https://api.linkedin.com/rest/images?action=initializeUpload",
        headers=linkedin_headers(token),
        json=payload,
        timeout=60,
    )
    if not response.ok:
        raise RuntimeError(f"LinkedIn image initializeUpload error {response.status_code}: {response.text}")
    return extract_linkedin_image_upload(response.json())


def upload_linkedin_image_bytes(token: str, upload_url: str, image_path: Path) -> None:
    mime_type, _ = mimetypes.guess_type(image_path.name)
    mime_type = mime_type or "application/octet-stream"
    with image_path.open("rb") as file_obj:
        response = requests.put(
            upload_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": mime_type,
            },
            data=file_obj.read(),
            timeout=120,
        )
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"LinkedIn upload error {response.status_code}: {response.text}")


def fetch_linkedin_image_status(token: str, image_urn: str) -> dict[str, Any]:
    encoded = requests.utils.quote(image_urn, safe="")
    response = requests.get(
        f"https://api.linkedin.com/rest/images/{encoded}",
        headers=linkedin_headers(token, json_content=False),
        timeout=60,
    )
    if not response.ok:
        raise RuntimeError(f"LinkedIn image status error {response.status_code}: {response.text}")
    return response.json()


def fetch_linkedin_asset_status(token: str, asset_urn: str) -> dict[str, Any]:
    """Compatibility wrapper retained for the older assets API flow."""
    return fetch_linkedin_image_status(token, asset_urn)


def _image_or_asset_status(image_status: dict[str, Any]) -> str:
    status = (image_status.get("status") or "").upper()
    if status:
        return status
    for recipe in image_status.get("recipes") or []:
        recipe_status = str((recipe or {}).get("status") or "").upper()
        if recipe_status:
            return recipe_status
    return ""


def _image_is_available(image_status: dict[str, Any]) -> bool:
    return _image_or_asset_status(image_status) == "AVAILABLE"


def _image_is_failed(image_status: dict[str, Any]) -> bool:
    return _image_or_asset_status(image_status) in {"CLIENT_ERROR", "SERVER_ERROR", "FAILED"}


def wait_for_linkedin_image_ready(token: str, image_urn: str, *, attempts: int = 10, sleep_seconds: float = 2.0) -> dict[str, Any]:
    last_status: dict[str, Any] = {}
    for _ in range(attempts):
        last_status = fetch_linkedin_image_status(token, image_urn)
        if _image_is_available(last_status):
            return last_status
        if _image_is_failed(last_status):
            raise RuntimeError(f"LinkedIn image processing failed: {json.dumps(last_status)}")
        time.sleep(sleep_seconds)
    raise RuntimeError(f"LinkedIn image did not become ready in time: {json.dumps(last_status)}")


def wait_for_linkedin_asset_ready(token: str, asset_urn: str, *, attempts: int = 10, sleep_seconds: float = 2.0) -> dict[str, Any]:
    """Compatibility wrapper retained for the older assets API flow."""
    last_status: dict[str, Any] = {}
    for _ in range(attempts):
        last_status = fetch_linkedin_asset_status(token, asset_urn)
        if _image_is_available(last_status):
            return last_status
        if _image_is_failed(last_status):
            raise RuntimeError(f"LinkedIn asset processing failed: {json.dumps(last_status)}")
        time.sleep(sleep_seconds)
    raise RuntimeError(f"LinkedIn asset did not become ready in time: {json.dumps(last_status)}")


def create_linkedin_post(token: str, payload: dict[str, Any]) -> requests.Response:
    return requests.post(
        "https://api.linkedin.com/rest/posts",
        headers=linkedin_headers(token),
        json=payload,
        timeout=60,
    )


def extract_linkedin_post_id_from_response(response: requests.Response) -> str:
    header_id = ""
    if getattr(response, "headers", None):
        header_id = str(response.headers.get("x-restli-id") or response.headers.get("location") or "").strip()
    if header_id:
        return header_id

    try:
        data = response.json()
    except Exception:
        return ""

    candidates = [
        data.get("id"),
        data.get("urn"),
        (data.get("value") or {}).get("id"),
        (data.get("value") or {}).get("urn"),
    ]
    for candidate in candidates:
        if candidate:
            return str(candidate).strip()
    return ""


def publish_text_post(brand: str, text: str) -> dict[str, Any]:
    author_urn, access_token = resolve_linkedin_credentials(brand)

    if linkedin_dry_run_enabled():
        return {
            "ok": True,
            "dry_run": True,
            "brand": brand,
            "author_urn": author_urn,
            "platform_post_id": "",
            "message": "Dry run enabled. No live LinkedIn request made.",
        }

    payload = build_linkedin_text_payload(author_urn, text)
    response = create_linkedin_post(access_token, payload)
    if not response.ok:
        raise RuntimeError(f"LinkedIn API error {response.status_code}: {response.text}")

    return {
        "ok": True,
        "dry_run": False,
        "brand": brand,
        "author_urn": author_urn,
        "platform_post_id": extract_linkedin_post_id_from_response(response),
        "status_code": response.status_code,
        "response_text": response.text,
    }


def publish_image_post(brand: str, text: str, asset_paths: list[Path], image_alt_text: str = "") -> dict[str, Any]:
    author_urn, access_token = resolve_linkedin_credentials(brand)
    mode = "single_image" if len(asset_paths) == 1 else "carousel"
    missing = [path.as_posix() for path in asset_paths if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing asset files: {', '.join(missing)}")
    if linkedin_dry_run_enabled():
        return {
            "ok": True,
            "dry_run": True,
            "brand": brand,
            "author_urn": author_urn,
            "asset_mode": mode,
            "asset_count": len(asset_paths),
            "image_alt_text": image_alt_text,
            "platform_post_id": "",
            "assets": [path.as_posix() for path in asset_paths],
            "message": "Dry run enabled. Media upload not attempted.",
        }
    if mode != "single_image":
        raise NotImplementedError("Live LinkedIn carousel upload is not implemented yet.")

    image_path = asset_paths[0]
    image_urn, upload_url = register_linkedin_image_upload(access_token, author_urn)
    upload_linkedin_image_bytes(access_token, upload_url, image_path)
    wait_for_linkedin_asset_ready(access_token, image_urn)
    payload = build_linkedin_single_image_payload(author_urn, text, image_urn, image_alt_text)
    response = create_linkedin_post(access_token, payload)
    if not response.ok:
        raise RuntimeError(f"LinkedIn API error {response.status_code}: {response.text}")
    return {
        "ok": True,
        "dry_run": False,
        "brand": brand,
        "author_urn": author_urn,
        "asset_mode": mode,
        "asset_urn": image_urn,
        "platform_post_id": extract_linkedin_post_id_from_response(response),
        "status_code": response.status_code,
        "response_text": response.text,
    }


def approval_allows_posting(row: dict[str, str] | Any) -> bool:
    approval_status = (row.get("approval_status", "") or "").strip().lower()
    return approval_status in POSTING_ALLOWED_APPROVAL_STATUSES


def validate_linkedin_post_row(row: dict[str, Any] | Any) -> dict[str, Any]:
    brand = (row.get("brand") or "").strip()
    post_date = (row.get("post_date") or "").strip()
    post_type = (row.get("post_type") or "").strip().lower()
    caption_filename = (row.get("caption_filename") or "").strip()

    if not brand:
        raise RuntimeError("brand is blank in schedule")
    if not post_date:
        raise RuntimeError("post_date is blank in schedule")
    if not caption_filename:
        raise FileNotFoundError("caption_filename is blank in schedule")

    resolve_linkedin_credentials(brand)

    content_folder = build_content_date_folder(brand, post_date)
    caption_path = content_folder / "captions" / caption_filename
    caption_text = read_text(caption_path).strip()
    if not caption_text:
        raise RuntimeError(f"Caption file is empty: {caption_path}")

    asset_mode = determine_linkedin_asset_mode(post_type, row.get("asset_filename", ""))
    asset_names = normalise_asset_filenames(row.get("asset_filename", ""))
    asset_paths = [content_folder / "assets" / name for name in asset_names]

    if asset_mode == "single_image" and len(asset_paths) != 1:
        raise RuntimeError("Single-image post must resolve to exactly one asset file.")
    if asset_mode == "carousel" and len(asset_paths) < 2:
        raise RuntimeError("Carousel post must resolve to at least two asset files.")
    if asset_mode != "text":
        missing_assets = [path.as_posix() for path in asset_paths if not path.exists()]
        if missing_assets:
            raise FileNotFoundError(f"Missing asset files: {', '.join(missing_assets)}")
        if asset_mode == "carousel" and not linkedin_dry_run_enabled():
            raise NotImplementedError("Live LinkedIn carousel upload is not implemented yet.")

    return {
        "brand": brand,
        "post_date": post_date,
        "caption_path": caption_path,
        "caption_text": caption_text,
        "content_folder": content_folder,
        "asset_mode": asset_mode,
        "asset_paths": asset_paths,
    }


def build_publish_request_payload(post_id: str, row: dict[str, Any] | Any, validation_context: dict[str, Any]) -> dict[str, Any]:
    return {
        "post_id": post_id,
        "brand": validation_context["brand"],
        "platform": (row.get("platform") or "").strip().lower(),
        "post_type": (row.get("post_type") or "").strip().lower(),
        "asset_mode": validation_context["asset_mode"],
        "caption_text": validation_context["caption_text"],
        "image_alt_text": (row.get("image_alt_text") or "").strip(),
        "assets": [path.name for path in validation_context["asset_paths"]],
    }


def _process_selected_linkedin_rows(schedule_df, eligible_df):
    posted_count = 0
    failed_count = 0
    actions: dict[str, str] = {}

    for _, row in eligible_df.iterrows():
        post_id = row["post_id"]
        brand = row["brand"]
        platform = "linkedin"
        attempt_id: int | None = None

        if not approval_allows_posting(row):
            message = f"approval_status={row.get('approval_status', '') or '<blank>'}"
            logger.warning("post_id=%s | %s | skipped", post_id, message)
            record_audit_event(
                "publish_skipped_unapproved",
                post_id=post_id,
                brand_slug=brand,
                platform=platform,
                message=message,
                payload={"approval_status": row.get("approval_status", "")},
            )
            actions[post_id] = "skipped_unapproved"
            continue

        prior_success = get_successful_publish_attempt(post_id, platform)
        if prior_success is not None:
            schedule_df.loc[schedule_df["post_id"] == post_id, "status"] = "posted"
            schedule_df.loc[schedule_df["post_id"] == post_id, "platform_post_id"] = prior_success["platform_post_id"] or ""
            schedule_df.loc[schedule_df["post_id"] == post_id, "posted_at"] = prior_success["updated_at"] or utc_now_iso()
            schedule_df.loc[schedule_df["post_id"] == post_id, "last_publish_error"] = ""
            logger.warning("post_id=%s | already has successful publish attempt recorded | marking posted", post_id)
            record_audit_event(
                "publish_skip_existing_success",
                post_id=post_id,
                brand_slug=brand,
                platform=platform,
                message="Skipped duplicate publish because a prior successful publish attempt exists.",
                payload={"platform_post_id": prior_success["platform_post_id"] or ""},
            )
            actions[post_id] = "existing_success"
            continue

        try:
            validation_context = validate_linkedin_post_row(row)
            request_payload = build_publish_request_payload(post_id, row, validation_context)
            attempt_id = create_publish_attempt(post_id, brand, platform, request_payload)
            schedule_df.loc[schedule_df["post_id"] == post_id, "status"] = "posting"
            schedule_df.loc[schedule_df["post_id"] == post_id, "asset_mode"] = validation_context["asset_mode"]

            if validation_context["asset_mode"] == "text":
                result = publish_text_post(brand, validation_context["caption_text"])
            else:
                result = publish_image_post(
                    brand,
                    validation_context["caption_text"],
                    validation_context["asset_paths"],
                    row.get("image_alt_text", ""),
                )

            platform_post_id = (result.get("platform_post_id") or "").strip()
            complete_publish_attempt(
                attempt_id,
                status="success",
                response_payload=result,
                platform_post_id=platform_post_id,
            )

            schedule_df.loc[schedule_df["post_id"] == post_id, "status"] = "posted"
            schedule_df.loc[schedule_df["post_id"] == post_id, "asset_mode"] = validation_context["asset_mode"]
            schedule_df.loc[schedule_df["post_id"] == post_id, "platform_post_id"] = platform_post_id
            schedule_df.loc[schedule_df["post_id"] == post_id, "posted_at"] = utc_now_iso()
            schedule_df.loc[schedule_df["post_id"] == post_id, "last_publish_error"] = ""
            posted_count += 1
            actions[post_id] = "success"

            logger.info(
                "post_id=%s | brand=%s | result=%s",
                post_id,
                brand,
                json.dumps(result, ensure_ascii=False),
            )
            record_audit_event(
                "publish_succeeded",
                post_id=post_id,
                brand_slug=brand,
                platform=platform,
                message="LinkedIn publish completed successfully.",
                payload=result,
            )
        except Exception as exc:
            if attempt_id is not None:
                complete_publish_attempt(
                    attempt_id,
                    status="failed",
                    response_payload={"error": str(exc), "error_type": exc.__class__.__name__},
                    error_message=str(exc),
                )
            schedule_df.loc[schedule_df["post_id"] == post_id, "status"] = "failed"
            schedule_df.loc[schedule_df["post_id"] == post_id, "last_publish_error"] = str(exc)
            failed_count += 1
            actions[post_id] = "failed"
            logger.error("post_id=%s | brand=%s | error=%s", post_id, brand, exc)
            record_audit_event(
                "publish_failed",
                post_id=post_id,
                brand_slug=brand,
                platform=platform,
                message=str(exc),
                payload={"error_type": exc.__class__.__name__},
            )

    return schedule_df, {"posted_count": posted_count, "failed_count": failed_count, "actions": actions}



def process_linkedin_post_id(post_id: str, *, allow_retry_failed: bool = True) -> dict[str, Any]:
    schedule_df = normalise_optional_columns(load_csv(SCHEDULE_CSV), OPTIONAL_SCHEDULE_COLUMNS)
    mask = schedule_df["post_id"] == post_id
    if not mask.any():
        raise RuntimeError(f"Post not found in schedule: {post_id}")

    row = schedule_df.loc[mask].iloc[0]
    if (row.get("platform") or "").strip().lower() != "linkedin":
        raise RuntimeError(f"Post '{post_id}' is not a LinkedIn post.")

    allowed_statuses = set(ELIGIBLE_POSTING_STATUSES)
    if allow_retry_failed:
        allowed_statuses.add("failed")
    current_status = (row.get("status") or "").strip().lower()
    if current_status not in allowed_statuses:
        raise RuntimeError(
            f"Post '{post_id}' is not in a publishable state. Expected one of {sorted(allowed_statuses)}, got '{current_status or '<blank>'}'."
        )

    eligible_df = schedule_df.loc[mask].copy()
    updated_df, summary = _process_selected_linkedin_rows(schedule_df, eligible_df)
    save_csv(updated_df, SCHEDULE_CSV)
    updated_row = updated_df.loc[updated_df["post_id"] == post_id].iloc[0].to_dict()
    return {
        "post_id": post_id,
        "action": summary["actions"].get(post_id, "unknown"),
        "failed_count": summary["failed_count"],
        "posted_count": summary["posted_count"],
        "row": updated_row,
    }



def process_linkedin_posts(run_date: str, *, due_only: bool = False, now_utc: datetime | None = None) -> int:
    schedule_df = normalise_optional_columns(load_csv(SCHEDULE_CSV), OPTIONAL_SCHEDULE_COLUMNS)

    mask = (
        (schedule_df["post_date"] == run_date)
        & (schedule_df["platform"].str.lower() == "linkedin")
        & (schedule_df["status"].isin(ELIGIBLE_POSTING_STATUSES))
    )

    eligible_df = schedule_df.loc[mask].copy().sort_values(by=["post_time", "brand", "post_id"])
    if due_only:
        current = now_utc or datetime.now(timezone.utc)
        eligible_df = eligible_df.loc[eligible_df.apply(lambda row: schedule_row_is_due(row, now_utc=current), axis=1)]

    if eligible_df.empty:
        logger.info("No eligible LinkedIn posts found for %s%s. Exiting quietly.", run_date, " that are due now" if due_only else "")
        return 0

    schedule_df, summary = _process_selected_linkedin_rows(schedule_df, eligible_df)
    save_csv(schedule_df, SCHEDULE_CSV)
    logger.info("LinkedIn processing complete | posted=%s | failed=%s", summary["posted_count"], summary["failed_count"])
    return 0 if summary["failed_count"] == 0 else 1


def process_due_linkedin_posts(*, now_utc: datetime | None = None) -> int:
    schedule_df = normalise_optional_columns(load_csv(SCHEDULE_CSV), OPTIONAL_SCHEDULE_COLUMNS)
    current = now_utc or datetime.now(timezone.utc)
    eligible_df = schedule_df.loc[
        (schedule_df["platform"].str.lower() == "linkedin")
        & (schedule_df["status"].isin(ELIGIBLE_POSTING_STATUSES))
        & (schedule_df.apply(lambda row: schedule_row_is_due(row, now_utc=current), axis=1))
    ].copy().sort_values(by=["post_date", "post_time", "brand", "post_id"])

    if eligible_df.empty:
        logger.info("No due LinkedIn posts found as of %s. Exiting quietly.", current.isoformat())
        return 0

    schedule_df, summary = _process_selected_linkedin_rows(schedule_df, eligible_df)
    save_csv(schedule_df, SCHEDULE_CSV)
    logger.info("LinkedIn due-post processing complete | posted=%s | failed=%s", summary["posted_count"], summary["failed_count"])
    return 0 if summary["failed_count"] == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Post eligible LinkedIn posts for a given date or for posts due right now.")
    parser.add_argument("--date", dest="run_date", default=today_str(), help="Run date in YYYY-MM-DD format")
    parser.add_argument("--due-only", action="store_true", help="Only publish LinkedIn rows that are due at or before the current UTC time.")
    parser.add_argument("--now-utc", dest="now_utc", default="", help="Optional override for the current UTC timestamp, in ISO format, for testing due-post logic.")
    args = parser.parse_args()

    ensure_base_dirs()
    now_utc = None
    if args.now_utc:
        try:
            now_utc = datetime.fromisoformat(args.now_utc.replace("Z", "+00:00"))
        except ValueError as exc:
            raise SystemExit(f"Invalid --now-utc value: {exc}")
    if args.due_only:
        return process_due_linkedin_posts(now_utc=now_utc)
    return process_linkedin_posts(args.run_date, now_utc=now_utc)


if __name__ == "__main__":
    raise SystemExit(main())
