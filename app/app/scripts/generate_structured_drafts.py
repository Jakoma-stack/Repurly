from __future__ import annotations

import json

import pandas as pd

from config import BULK_POSTS_CSV, SCHEDULE_CSV, ensure_base_dirs
from logger_setup import get_logger
from utils import (
    generated_output_path,
    get_brand_config,
    load_csv,
    normalise_optional_columns,
    save_csv,
    save_json,
)

logger = get_logger("generate_structured_drafts", "caption_generation.log")


def build_structured_draft(row: pd.Series, schedule_row: pd.Series, brand_config: dict) -> dict:
    hook = (row.get("hook", "") or "").strip()
    topic = (row.get("topic", "") or "").strip()
    key_points = [p.strip() for p in (row.get("key_points", "") or "").split(";") if p.strip()]
    cta = (row.get("cta", "") or brand_config.get("primary_cta", "") or "").strip()
    hashtags = brand_config.get("hashtags", [])

    return {
        "post_id": row["post_id"],
        "brand": row["brand"],
        "platform": row["platform"],
        "post_type": row["post_type"],
        "topic": topic,
        "headline": hook or topic,
        "hook": hook,
        "body_points": key_points,
        "cta": cta,
        "hashtags": hashtags,
        "approval_status": "pending",
        "caption_preview": "\n\n".join(part for part in [hook or topic, " ".join(key_points), cta, " ".join(hashtags)] if part).strip(),
        "schedule": {
            "post_date": schedule_row["post_date"],
            "post_time": schedule_row["post_time"],
            "theme": schedule_row["theme"],
            "campaign": schedule_row["campaign"],
        },
        "generator": {
            "mode": "local_structured_draft_v1",
            "provider": "template-first",
        },
    }


def main() -> int:
    ensure_base_dirs()
    bulk_df = load_csv(BULK_POSTS_CSV)
    schedule_df = normalise_optional_columns(load_csv(SCHEDULE_CSV), ["approval_status", "draft_payload_file"])

    generated = 0
    for _, row in bulk_df.iterrows():
        post_id = row["post_id"]
        match = schedule_df["post_id"] == post_id
        if not match.any():
            logger.warning("post_id=%s | not found in schedule | skipped", post_id)
            continue
        schedule_row = schedule_df.loc[match].iloc[0]
        brand = row["brand"]
        post_date = schedule_row["post_date"]
        try:
            brand_config = get_brand_config(brand)
        except Exception as exc:
            logger.error("post_id=%s | failed to load brand config | error=%s", post_id, exc)
            continue

        draft = build_structured_draft(row, schedule_row, brand_config)
        filename = f"{post_id}_draft.json"
        path = generated_output_path(brand, post_date, filename)
        save_json(path, draft)

        schedule_df.loc[match, "draft_payload_file"] = path.as_posix()
        schedule_df.loc[match, "approval_status"] = "pending"
        if schedule_row["status"] in {"planned", "generated"}:
            schedule_df.loc[match, "status"] = "drafted"
        generated += 1
        logger.info("post_id=%s | saved_draft=%s", post_id, path.as_posix())

    save_csv(schedule_df, SCHEDULE_CSV)
    logger.info("Structured draft generation complete | generated=%s", generated)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
