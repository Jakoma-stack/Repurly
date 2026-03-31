from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from config import (
    BULK_POSTS_CSV,
    BULK_POSTS_EXAMPLE_CSV,
    SCHEDULE_CSV,
    SCHEDULE_EXAMPLE_CSV,
    ensure_base_dirs,
)
from logger_setup import get_logger

logger = get_logger("bootstrap_demo_data", "app.log")


def bootstrap_file(source: Path, destination: Path, *, force: bool) -> str:
    if destination.exists() and not force:
        return f"skipped existing {destination.name}"
    if not source.exists():
        raise FileNotFoundError(f"Example file not found: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    return f"copied {source.name} -> {destination.name}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Create working CSV files from the bundled example files.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing working CSV files.")
    args = parser.parse_args()

    ensure_base_dirs()
    results = [
        bootstrap_file(SCHEDULE_EXAMPLE_CSV, SCHEDULE_CSV, force=args.force),
        bootstrap_file(BULK_POSTS_EXAMPLE_CSV, BULK_POSTS_CSV, force=args.force),
    ]
    for result in results:
        logger.info(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
