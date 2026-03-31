from __future__ import annotations

import pandas as pd

from config import BULK_POSTS_CSV, REQUIRED_BULK_POSTS_COLUMNS, SCHEDULE_CSV, ensure_base_dirs
from logger_setup import get_logger
from utils import (
    caption_output_path,
    first_non_empty,
    generated_output_path,
    get_brand_config,
    load_csv,
    save_csv,
    save_json,
    save_text,
)

logger = get_logger("generate_captions", "caption_generation.log")

def validate_bulk_posts(df: pd.DataFrame) -> list[str]:
    errors: list[str] = []
    missing_columns = [col for col in REQUIRED_BULK_POSTS_COLUMNS if col not in df.columns]
    if missing_columns:
        errors.append(f"Missing required columns: {', '.join(missing_columns)}")
    return errors

def render_caption(row: pd.Series, brand_config: dict) -> str:
    hook = (row.get("hook", "") or "").strip()
    topic = (row.get("topic", "") or "").strip()
    key_points_raw = (row.get("key_points", "") or "").strip()
    cta = first_non_empty(row.get("cta", ""), brand_config.get("primary_cta", ""))
    hashtags = " ".join(brand_config.get("hashtags", []))

    key_points = [point.strip() for point in key_points_raw.split(";") if point.strip()]

    paragraphs = []
    if hook:
        paragraphs.append(hook)
    elif topic:
        paragraphs.append(topic)

    if key_points:
        paragraphs.append(" ".join(key_points))

    if cta:
        paragraphs.append(cta)

    if hashtags:
        paragraphs.append(hashtags)

    return "\n\n".join(paragraphs).strip() + "\n"

def sync_schedule_caption_filename(schedule_df: pd.DataFrame, post_id: str, caption_filename: str) -> pd.DataFrame:
    mask = schedule_df["post_id"] == post_id
    if mask.any():
        schedule_df.loc[mask, "caption_filename"] = caption_filename
        schedule_df.loc[mask & (schedule_df["status"] == "planned"), "status"] = "generated"
    return schedule_df

def main() -> int:
    ensure_base_dirs()

    bulk_df = load_csv(BULK_POSTS_CSV)
    errors = validate_bulk_posts(bulk_df)
    if errors:
        for error in errors:
            logger.error(error)
        return 1

    schedule_df = load_csv(SCHEDULE_CSV) if SCHEDULE_CSV.exists() else pd.DataFrame()
    generated_count = 0

    for _, row in bulk_df.iterrows():
        post_id = row["post_id"]
        brand = row["brand"]
        platform = row["platform"]
        post_type = row["post_type"]

        try:
            brand_config = get_brand_config(brand)
        except Exception as exc:
            logger.error("post_id=%s | failed to load brand config | error=%s", post_id, exc)
            continue

        if schedule_df.empty or post_id not in schedule_df["post_id"].values:
            logger.warning("post_id=%s | not found in master schedule | skipped", post_id)
            continue

        schedule_row = schedule_df.loc[schedule_df["post_id"] == post_id].iloc[0]
        post_date = schedule_row["post_date"]

        caption_filename = schedule_row["caption_filename"].strip() or f"{post_id}.txt"

        caption_text = render_caption(row, brand_config)
        caption_path = caption_output_path(brand, post_date, caption_filename)
        debug_path = generated_output_path(brand, post_date, f"{post_id}.json")

        debug_payload = {
            "post_id": post_id,
            "brand": brand,
            "platform": platform,
            "post_type": post_type,
            "topic": row.get("topic", ""),
            "hook": row.get("hook", ""),
            "key_points": row.get("key_points", ""),
            "caption_filename": caption_filename,
        }

        try:
            save_text(caption_path, caption_text)
            save_json(debug_path, debug_payload)
            schedule_df = sync_schedule_caption_filename(schedule_df, post_id, caption_filename)
            generated_count += 1
            logger.info(
                "post_id=%s | saved=%s | debug=%s",
                post_id,
                caption_path.as_posix(),
                debug_path.as_posix(),
            )
        except Exception as exc:
            logger.error("post_id=%s | failed to save caption | error=%s", post_id, exc)

    if not schedule_df.empty:
        save_csv(schedule_df, SCHEDULE_CSV)

    logger.info("Caption generation complete | generated=%s", generated_count)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
