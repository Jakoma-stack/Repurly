from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from config import APP_DB, ensure_base_dirs

PUBLISH_TRACKING_SCHEMA = """
CREATE TABLE IF NOT EXISTS publish_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  brand_slug TEXT NOT NULL,
  platform TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  response_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  platform_post_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publish_attempts_post_platform ON publish_attempts(post_id, platform);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  post_id TEXT,
  brand_slug TEXT,
  platform TEXT,
  actor TEXT,
  message TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_post_id ON audit_log(post_id);
"""


def ensure_tracking_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(PUBLISH_TRACKING_SCHEMA)
    conn.commit()


def get_conn() -> sqlite3.Connection:
    ensure_base_dirs()
    conn = sqlite3.connect(APP_DB)
    conn.row_factory = sqlite3.Row
    ensure_tracking_tables(conn)
    return conn


def serialise_payload(payload: dict[str, Any] | None) -> str:
    return json.dumps(payload or {}, sort_keys=True, ensure_ascii=False)


def request_fingerprint(payload: dict[str, Any]) -> str:
    return hashlib.sha256(serialise_payload(payload).encode("utf-8")).hexdigest()


def create_publish_attempt(post_id: str, brand_slug: str, platform: str, request_payload: dict[str, Any]) -> int:
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO publish_attempts (post_id, brand_slug, platform, request_fingerprint, status, response_json)
            VALUES (?, ?, ?, ?, 'started', ?)
            """,
            (
                post_id,
                brand_slug,
                platform,
                request_fingerprint(request_payload),
                serialise_payload(request_payload),
            ),
        )
        conn.commit()
        return int(cursor.lastrowid)


def complete_publish_attempt(
    attempt_id: int,
    *,
    status: str,
    response_payload: dict[str, Any] | None = None,
    error_message: str = "",
    platform_post_id: str = "",
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE publish_attempts
            SET status=?, response_json=?, error_message=?, platform_post_id=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
            """,
            (
                status,
                serialise_payload(response_payload),
                error_message,
                platform_post_id,
                attempt_id,
            ),
        )
        conn.commit()


def get_successful_publish_attempt(post_id: str, platform: str) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT *
            FROM publish_attempts
            WHERE post_id=? AND platform=? AND status='success'
            ORDER BY id DESC
            LIMIT 1
            """,
            (post_id, platform),
        ).fetchone()


def record_audit_event(
    event_type: str,
    *,
    post_id: str = "",
    brand_slug: str = "",
    platform: str = "",
    actor: str = "system",
    message: str = "",
    payload: dict[str, Any] | None = None,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO audit_log (event_type, post_id, brand_slug, platform, actor, message, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (event_type, post_id, brand_slug, platform, actor, message, serialise_payload(payload)),
        )
        conn.commit()
