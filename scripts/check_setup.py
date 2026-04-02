from __future__ import annotations

import sqlite3
import sys

from config import APP_DB, BULK_POSTS_CSV, SCHEDULE_CSV, SCHEMA_SQL, ensure_base_dirs
from logger_setup import get_logger

logger = get_logger("check_setup", "app.log")


def main() -> int:
    ensure_base_dirs()
    errors: list[str] = []
    warnings: list[str] = []

    if not SCHEMA_SQL.exists():
        errors.append(f"Missing schema file: {SCHEMA_SQL}")

    if not SCHEDULE_CSV.exists():
        errors.append(
            f"Missing working schedule CSV: {SCHEDULE_CSV}. Run python scripts/bootstrap_demo_data.py first."
        )
    if not BULK_POSTS_CSV.exists():
        errors.append(
            f"Missing working bulk-posts CSV: {BULK_POSTS_CSV}. Run python scripts/bootstrap_demo_data.py first."
        )

    if APP_DB.exists():
        try:
            with sqlite3.connect(APP_DB) as conn:
                conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").fetchone()
        except sqlite3.DatabaseError as exc:
            errors.append(f"Database file exists but could not be opened: {exc}")
    else:
        warnings.append(f"Database not initialised yet: {APP_DB}. Run python scripts/init_db.py.")

    for warning in warnings:
        logger.warning(warning)
    for error in errors:
        logger.error(error)

    if errors:
        logger.error("Setup check failed with %s error(s).", len(errors))
        return 1

    logger.info("Setup check passed with %s warning(s).", len(warnings))
    return 0


if __name__ == "__main__":
    sys.exit(main())
