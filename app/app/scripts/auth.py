from __future__ import annotations

import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable

from flask import g, redirect, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


SESSION_USER_ID_KEY = "customer_user_id"
SESSION_AUTH_KEY = "customer_authenticated"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        return False
    return check_password_hash(password_hash, password)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def create_auth_token(conn: sqlite3.Connection, *, user_id: int, token_type: str, expires_in_hours: int) -> str:
    raw_token = generate_raw_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
    conn.execute(
        """
        INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, hash_token(raw_token), token_type, expires_at.replace(microsecond=0).isoformat()),
    )
    return raw_token


def fetch_valid_token(conn: sqlite3.Connection, *, raw_token: str, token_type: str) -> sqlite3.Row | None:
    row = conn.execute(
        """
        SELECT at.*, u.email, u.full_name, u.company_name, u.status AS user_status
        FROM auth_tokens at
        JOIN users u ON u.id = at.user_id
        WHERE at.token_hash=? AND at.token_type=? AND at.used_at IS NULL
        """,
        (hash_token(raw_token), token_type),
    ).fetchone()
    if row is None:
        return None
    expires_at = row["expires_at"] or ""
    try:
        if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < datetime.now(timezone.utc):
            return None
    except ValueError:
        return None
    return row


def mark_token_used(conn: sqlite3.Connection, token_id: int) -> None:
    conn.execute(
        "UPDATE auth_tokens SET used_at=? WHERE id=?",
        (utcnow_iso(), token_id),
    )


def login_customer(user: sqlite3.Row | dict[str, Any]) -> None:
    session[SESSION_USER_ID_KEY] = int(user["id"])
    session[SESSION_AUTH_KEY] = True
    session.permanent = True


def logout_customer() -> None:
    session.pop(SESSION_USER_ID_KEY, None)
    session.pop(SESSION_AUTH_KEY, None)


def current_customer() -> dict[str, Any] | None:
    customer = getattr(g, "current_customer", None)
    return customer if isinstance(customer, dict) else None


def customer_login_required(view: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        if not session.get(SESSION_AUTH_KEY) or current_customer() is None:
            return redirect(url_for("login", next=url_for(view.__name__, **kwargs)))
        return view(*args, **kwargs)

    return wrapped
