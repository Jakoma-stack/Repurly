from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

def run_step(label: str, script_name: str, args: list[str] | None = None) -> int:
    if args is None:
        args = []

    command = [sys.executable, str(SCRIPTS_DIR / script_name), *args]

    print(f"\n=== {label} ===")
    print("Running:", " ".join(command))

    result = subprocess.run(command, cwd=ROOT_DIR)
    return result.returncode

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the daily social posting pipeline in a safe order."
    )
    parser.add_argument(
        "--date",
        dest="run_date",
        required=True,
        help="Run date in YYYY-MM-DD format",
    )
    parser.add_argument(
        "--skip-post",
        action="store_true",
        help="Run validation, caption generation, and queue build only.",
    )
    args = parser.parse_args()

    steps = [
        ("Validate schedule", "validate_schedule.py", []),
        ("Generate captions", "generate_captions.py", []),
        ("Build daily queue", "build_daily_queue.py", ["--date", args.run_date]),
    ]

    if not args.skip_post:
        steps.append(
            ("Post to LinkedIn", "post_to_linkedin.py", ["--date", args.run_date])
        )

    for label, script_name, script_args in steps:
        code = run_step(label, script_name, script_args)
        if code != 0:
            print(f"\nPipeline stopped at step: {label}")
            print(f"Exit code: {code}")
            return code

    print("\nPipeline completed successfully.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
