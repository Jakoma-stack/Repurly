from __future__ import annotations

from config import ensure_base_dirs
from post_to_linkedin import process_due_linkedin_posts


def main() -> int:
    ensure_base_dirs()
    return process_due_linkedin_posts()


if __name__ == "__main__":
    raise SystemExit(main())
