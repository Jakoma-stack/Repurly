from __future__ import annotations

import argparse

from config import SCHEDULE_CSV, ensure_base_dirs
from logger_setup import get_logger
from publish_tracking import record_audit_event
from utils import load_csv, normalise_optional_columns, save_csv

logger = get_logger("reject_draft", "app.log")


def main() -> int:
    parser = argparse.ArgumentParser(description="Reject a structured draft and capture a reason.")
    parser.add_argument("--post-id", required=True)
    parser.add_argument("--reason", default="")
    parser.add_argument("--actor", default="reviewer")
    args = parser.parse_args()

    ensure_base_dirs()
    df = normalise_optional_columns(load_csv(SCHEDULE_CSV), ["approval_status", "notes"])
    mask = df["post_id"] == args.post_id
    if not mask.any():
        logger.error("post_id=%s | not found", args.post_id)
        return 1

    brand = df.loc[mask].iloc[0]["brand"]
    platform = df.loc[mask].iloc[0]["platform"]
    df.loc[mask, "approval_status"] = "rejected"
    df.loc[mask, "status"] = "rejected"
    if args.reason.strip():
        existing_notes = (df.loc[mask].iloc[0]["notes"] or "").strip()
        reason_text = f"Rejection reason: {args.reason.strip()}"
        df.loc[mask, "notes"] = f"{existing_notes}\n{reason_text}".strip()
    save_csv(df, SCHEDULE_CSV)
    record_audit_event(
        "draft_rejected",
        post_id=args.post_id,
        brand_slug=brand,
        platform=platform,
        actor=args.actor,
        message=args.reason.strip() or "Draft rejected.",
        payload={"reason": args.reason.strip()},
    )
    logger.info("post_id=%s | rejected | actor=%s", args.post_id, args.actor)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
