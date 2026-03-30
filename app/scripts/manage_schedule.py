from __future__ import annotations

import argparse

import pandas as pd

from config import SCHEDULE_CSV, ensure_base_dirs
from logger_setup import get_logger
from utils import build_schedule_row, load_csv, save_csv, upsert_schedule_row

logger = get_logger("manage_schedule", "app.log")


def main() -> int:
    parser = argparse.ArgumentParser(description="Safely add or update a schedule row without editing CSV manually.")
    parser.add_argument("--post-id", required=True)
    parser.add_argument("--post-date", required=True)
    parser.add_argument("--post-time", required=True)
    parser.add_argument("--brand", required=True)
    parser.add_argument("--platform", required=True)
    parser.add_argument("--post-type", required=True)
    parser.add_argument("--theme", default="")
    parser.add_argument("--campaign", default="")
    parser.add_argument("--status", default="planned")
    parser.add_argument("--asset-filename", default="")
    parser.add_argument("--caption-filename", default="")
    parser.add_argument("--notes", default="")
    parser.add_argument("--approval-status", default="")
    args = parser.parse_args()

    ensure_base_dirs()
    df = load_csv(SCHEDULE_CSV) if SCHEDULE_CSV.exists() else pd.DataFrame()
    row = build_schedule_row(
        post_id=args.post_id,
        post_date=args.post_date,
        post_time=args.post_time,
        brand=args.brand,
        platform=args.platform,
        post_type=args.post_type,
        theme=args.theme,
        campaign=args.campaign,
        status=args.status,
        asset_filename=args.asset_filename,
        caption_filename=args.caption_filename,
        notes=args.notes,
        approval_status=args.approval_status,
    )
    updated = upsert_schedule_row(df, row)
    save_csv(updated, SCHEDULE_CSV)
    logger.info("Schedule row upserted | post_id=%s", args.post_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
