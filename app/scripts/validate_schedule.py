from __future__ import annotations

import sys

import pandas as pd

from config import (
    ELIGIBLE_POSTING_STATUSES,
    OPTIONAL_SCHEDULE_COLUMNS,
    POSTING_ALLOWED_APPROVAL_STATUSES,
    REQUIRED_SCHEDULE_COLUMNS,
    SCHEDULE_CSV,
    ensure_base_dirs,
)
from logger_setup import get_logger
from utils import is_valid_status, load_csv, normalise_optional_columns, parse_date, parse_time, slugify

logger = get_logger("validate_schedule", "app.log")

VALID_APPROVAL_STATUSES = {"", "pending", "approved", "rejected", "not_required"}


def validate_schedule(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    missing_columns = [col for col in REQUIRED_SCHEDULE_COLUMNS if col not in df.columns]
    if missing_columns:
        errors.append(f"Missing required columns: {', '.join(missing_columns)}")
        return errors, warnings

    df = normalise_optional_columns(df, OPTIONAL_SCHEDULE_COLUMNS)

    if df["post_id"].duplicated().any():
        dupes = df.loc[df["post_id"].duplicated(), "post_id"].tolist()
        errors.append(f"Duplicate post_id values found: {', '.join(dupes)}")

    for idx, row in df.iterrows():
        row_num = idx + 2

        try:
            parse_date(row["post_date"])
        except Exception:
            errors.append(f"Row {row_num}: invalid post_date '{row['post_date']}' (expected YYYY-MM-DD)")

        try:
            parse_time(row["post_time"])
        except Exception:
            errors.append(f"Row {row_num}: invalid post_time '{row['post_time']}' (expected HH:MM)")

        if slugify(row["brand"]) != row["brand"]:
            warnings.append(
                f"Row {row_num}: brand '{row['brand']}' is not slug-safe. Suggested slug: '{slugify(row['brand'])}'"
            )

        if not is_valid_status(row["status"]):
            errors.append(f"Row {row_num}: invalid status '{row['status']}'")

        approval_status = (row.get("approval_status", "") or "").strip().lower()
        if approval_status not in VALID_APPROVAL_STATUSES:
            errors.append(f"Row {row_num}: invalid approval_status '{approval_status}'")

        if not (row["platform"] or "").strip():
            errors.append(f"Row {row_num}: platform is blank")

        if not (row["post_type"] or "").strip():
            errors.append(f"Row {row_num}: post_type is blank")

        if not (row["content_folder"] or "").strip():
            warnings.append(f"Row {row_num}: content_folder is blank")

        if not (row["caption_filename"] or "").strip():
            warnings.append(f"Row {row_num}: caption_filename is blank")

        status = (row.get("status", "") or "").strip().lower()
        if status in {"approved", "queued"} and approval_status not in POSTING_ALLOWED_APPROVAL_STATUSES:
            errors.append(
                f"Row {row_num}: status '{status}' requires approval_status to be one of "
                f"{', '.join(sorted(POSTING_ALLOWED_APPROVAL_STATUSES))}, got '{approval_status or '<blank>'}'"
            )
        elif status in ELIGIBLE_POSTING_STATUSES and approval_status not in POSTING_ALLOWED_APPROVAL_STATUSES:
            warnings.append(
                f"Row {row_num}: eligible posting status '{status}' will be excluded from queue until approval_status is set"
            )

    return errors, warnings


def main() -> int:
    ensure_base_dirs()

    if not SCHEDULE_CSV.exists():
        logger.error("Schedule CSV not found: %s", SCHEDULE_CSV)
        logger.error("Run python scripts/bootstrap_demo_data.py to create working CSVs from the bundled examples.")
        return 1

    df = load_csv(SCHEDULE_CSV)
    errors, warnings = validate_schedule(df)

    for warning in warnings:
        logger.warning(warning)

    if errors:
        for error in errors:
            logger.error(error)
        logger.error("Schedule validation failed with %s error(s).", len(errors))
        return 1

    logger.info("Schedule validation passed with %s warning(s).", len(warnings))
    return 0


if __name__ == "__main__":
    sys.exit(main())
