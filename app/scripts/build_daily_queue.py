from __future__ import annotations

import argparse
from pathlib import Path

from config import (
    DAILY_QUEUE_DIR,
    ELIGIBLE_POSTING_STATUSES,
    OPTIONAL_SCHEDULE_COLUMNS,
    POSTING_ALLOWED_APPROVAL_STATUSES,
    SCHEDULE_CSV,
    ensure_base_dirs,
)
from logger_setup import get_logger
from utils import load_csv, normalise_optional_columns, save_csv, today_str

logger = get_logger("build_daily_queue", "app.log")


def build_daily_queue(run_date: str) -> Path:
    df = normalise_optional_columns(load_csv(SCHEDULE_CSV), OPTIONAL_SCHEDULE_COLUMNS)

    queue_df = df[
        (df["post_date"] == run_date)
        & (df["status"].isin(ELIGIBLE_POSTING_STATUSES))
        & (df["approval_status"].str.strip().str.lower().isin(POSTING_ALLOWED_APPROVAL_STATUSES))
    ].copy()

    queue_df = queue_df.sort_values(by=["post_time", "brand", "platform", "post_id"])

    output_path = DAILY_QUEUE_DIR / f"daily_queue_{run_date}.csv"
    save_csv(queue_df, output_path)

    logger.info(
        "Built daily queue for %s | rows=%s | output=%s",
        run_date,
        len(queue_df),
        output_path,
    )
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a daily queue CSV from the master schedule.")
    parser.add_argument("--date", dest="run_date", default=today_str(), help="Run date in YYYY-MM-DD format")
    args = parser.parse_args()

    ensure_base_dirs()
    build_daily_queue(args.run_date)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
