from __future__ import annotations

import json
import os
import re
import sqlite3
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd

from config import (
    ALLOWED_STATUSES,
    APP_DB,
    BRAND_CONFIG_DIR,
    CONTENT_DIR,
    DATE_FORMAT,
    OPTIONAL_SCHEDULE_COLUMNS,
    REQUIRED_SCHEDULE_COLUMNS,
    TIME_FORMAT,
)


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _atomic_write_text(path: Path, text: str, *, newline: str | None = None) -> None:
    ensure_dir(path.parent)
    fd, temp_path = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    temp_file = Path(temp_path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline=newline) as handle:
            handle.write(text)
        temp_file.replace(path)
    except Exception:
        try:
            temp_file.unlink(missing_ok=True)
        except Exception:
            pass
        raise


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {path}")
    return pd.read_csv(path, dtype=str).fillna("")


def save_csv(df: pd.DataFrame, path: Path) -> None:
    ensure_dir(path.parent)
    fd, temp_path = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    temp_file = Path(temp_path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            df.to_csv(handle, index=False)
        temp_file.replace(path)
    except Exception:
        try:
            temp_file.unlink(missing_ok=True)
        except Exception:
            pass
        raise


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"JSON file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict[str, Any]) -> None:
    _atomic_write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def save_text(path: Path, text: str) -> None:
    _atomic_write_text(path, text, newline="\n")


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Text file not found: {path}")
    return path.read_text(encoding="utf-8")


def parse_date(value: str) -> date:
    return datetime.strptime(value, DATE_FORMAT).date()


def parse_time(value: str):
    return datetime.strptime(value, TIME_FORMAT).time()


def is_valid_status(value: str) -> bool:
    return value in ALLOWED_STATUSES


def _normalise_brand_config(raw: dict[str, Any]) -> dict[str, Any]:
    config = dict(raw or {})
    for alias in ("linkedin_author_urn", "linkedin_author", "author_urn"):
        if alias in config and config.get(alias) and not config.get("linkedin_author_urn"):
            config["linkedin_author_urn"] = str(config.get(alias) or "").strip()
    for alias in ("linkedin_token_env", "linkedin_token"):
        if alias in config and config.get(alias) and not config.get("linkedin_token_env"):
            config["linkedin_token_env"] = str(config.get(alias) or "").strip()
    for field in ("default_platforms", "hashtags", "posting_goals", "content_pillars"):
        value = config.get(field)
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception:
                value = [item.strip() for item in value.replace(";", ",").split(",") if item.strip()]
        if value is None:
            value = []
        if not isinstance(value, list):
            value = [value]
        config[field] = [str(item).strip() for item in value if str(item).strip()]
    return config


def _load_brand_config_from_db(brand_slug: str) -> dict[str, Any]:
    if not APP_DB.exists():
        return {}
    try:
        with sqlite3.connect(APP_DB) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
                SELECT slug, display_name, website, contact_email, tone, audience, primary_cta, secondary_cta,
                       default_platforms_json, hashtags_json, posting_goals_json, content_pillars_json,
                       linkedin_author_urn, linkedin_token_env, settings_json
                FROM brands
                WHERE slug=?
                ORDER BY id DESC
                LIMIT 1
                """,
                (brand_slug,),
            ).fetchone()
    except sqlite3.Error:
        return {}
    if row is None:
        return {}
    config = {}
    settings_json = row["settings_json"] or "{}"
    try:
        config.update(json.loads(settings_json))
    except Exception:
        pass
    config.update({
        "brand": row["slug"] or brand_slug,
        "display_name": row["display_name"] or config.get("display_name") or brand_slug,
        "website": row["website"] or config.get("website") or "",
        "contact_email": row["contact_email"] or config.get("contact_email") or "",
        "tone": row["tone"] or config.get("tone") or "",
        "audience": row["audience"] or config.get("audience") or "",
        "primary_cta": row["primary_cta"] or config.get("primary_cta") or "",
        "secondary_cta": row["secondary_cta"] or config.get("secondary_cta") or "",
        "linkedin_author_urn": row["linkedin_author_urn"] or config.get("linkedin_author_urn") or "",
        "linkedin_token_env": row["linkedin_token_env"] or config.get("linkedin_token_env") or "",
        "default_platforms": row["default_platforms_json"] or config.get("default_platforms") or [],
        "hashtags": row["hashtags_json"] or config.get("hashtags") or [],
        "posting_goals": row["posting_goals_json"] or config.get("posting_goals") or [],
        "content_pillars": row["content_pillars_json"] or config.get("content_pillars") or [],
    })
    return _normalise_brand_config(config)


def get_brand_config(brand_slug: str) -> dict[str, Any]:
    brand_slug = slugify(brand_slug)
    config_path = BRAND_CONFIG_DIR / f"{brand_slug}.json"
    file_config = {}
    if config_path.exists():
        file_config = _normalise_brand_config(load_json(config_path))
    db_config = _load_brand_config_from_db(brand_slug)
    merged = dict(db_config)
    merged.update({k: v for k, v in file_config.items() if v not in ("", None, [], {})})
    if not merged:
        raise FileNotFoundError(f"JSON file not found: {config_path}")
    merged.setdefault("brand", brand_slug)
    return _normalise_brand_config(merged)


def save_brand_config(brand_slug: str, config: dict[str, Any]) -> Path:
    brand_slug = slugify(brand_slug)
    path = BRAND_CONFIG_DIR / f"{brand_slug}.json"
    save_json(path, config)
    return path


def build_content_date_folder(brand_slug: str, post_date: str) -> Path:
    brand_slug = slugify(brand_slug)
    folder = CONTENT_DIR / brand_slug / post_date
    ensure_dir(folder / "assets")
    ensure_dir(folder / "captions")
    ensure_dir(folder / "generated")
    return folder


def caption_output_path(brand_slug: str, post_date: str, filename: str) -> Path:
    date_folder = build_content_date_folder(brand_slug, post_date)
    return date_folder / "captions" / filename


def generated_output_path(brand_slug: str, post_date: str, filename: str) -> Path:
    date_folder = build_content_date_folder(brand_slug, post_date)
    return date_folder / "generated" / filename


def asset_output_path(brand_slug: str, post_date: str, filename: str) -> Path:
    date_folder = build_content_date_folder(brand_slug, post_date)
    return date_folder / "assets" / filename


def normalise_optional_columns(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for col in columns:
        if col not in df.columns:
            df[col] = ""
    return df


def ensure_schedule_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = normalise_optional_columns(df, OPTIONAL_SCHEDULE_COLUMNS)
    for col in REQUIRED_SCHEDULE_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    ordered = REQUIRED_SCHEDULE_COLUMNS + [c for c in OPTIONAL_SCHEDULE_COLUMNS if c in df.columns]
    remainder = [c for c in df.columns if c not in ordered]
    return df[ordered + remainder]


def build_schedule_row(*, post_id: str, post_date: str, post_time: str, brand: str, platform: str, post_type: str,
                       theme: str = "", campaign: str = "", status: str = "planned", content_folder: str = "",
                       asset_filename: str = "", caption_filename: str = "", notes: str = "",
                       approval_status: str = "", draft_payload_file: str = "", asset_mode: str = "",
                       image_alt_text: str = "", platform_post_format: str = "") -> dict[str, str]:
    row = {
        "post_id": post_id.strip(),
        "post_date": post_date.strip(),
        "post_time": post_time.strip(),
        "brand": slugify(brand),
        "platform": platform.strip().lower(),
        "post_type": post_type.strip().lower(),
        "theme": theme.strip(),
        "campaign": campaign.strip(),
        "status": status.strip().lower(),
        "content_folder": content_folder.strip() or f"content/{slugify(brand)}/{post_date.strip()}",
        "asset_filename": asset_filename.strip(),
        "caption_filename": caption_filename.strip(),
        "notes": notes.strip(),
        "approval_status": approval_status.strip().lower(),
        "draft_payload_file": draft_payload_file.strip(),
        "asset_mode": asset_mode.strip().lower(),
        "image_alt_text": image_alt_text.strip(),
        "platform_post_format": platform_post_format.strip().lower(),
    }
    if not is_valid_status(row["status"]):
        raise ValueError(f"Invalid status '{row['status']}'")
    parse_date(row["post_date"])
    parse_time(row["post_time"])
    return row


def upsert_schedule_row(df: pd.DataFrame, row: dict[str, str]) -> pd.DataFrame:
    df = ensure_schedule_columns(df.copy())
    row_df = pd.DataFrame([row])
    row_df = ensure_schedule_columns(row_df)
    mask = df["post_id"] == row["post_id"]
    if mask.any():
        for key, value in row.items():
            df.loc[mask, key] = value
        return ensure_schedule_columns(df)
    return ensure_schedule_columns(pd.concat([df, row_df], ignore_index=True))


def today_str() -> str:
    return date.today().strftime(DATE_FORMAT)


def first_non_empty(*values: Optional[str]) -> str:
    for value in values:
        if value and str(value).strip():
            return str(value).strip()
    return ""
