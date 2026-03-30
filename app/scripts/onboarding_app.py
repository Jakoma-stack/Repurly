from __future__ import annotations

import calendar
import hmac
import json
import mimetypes
import os
import random
import shutil
import sqlite3
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from time import sleep
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from flask import Flask, Response, abort, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename

from billing import (
    create_billing_portal_session,
    create_checkout_session,
    get_billing_config,
    normalise_plan_name,
    process_stripe_event,
    retrieve_checkout_session,
    subscription_allows_workspace_access,
    sync_latest_subscription_for_customer,
    verify_stripe_webhook_signature,
)

from auth import (
    create_auth_token,
    customer_login_required,
    current_customer,
    fetch_valid_token,
    generate_raw_token,
    hash_password,
    hash_token,
    login_customer,
    logout_customer,
    mark_token_used,
    utcnow_iso,
    verify_password,
)
from config import (
    ALLOWED_UPLOAD_EXTENSIONS,
    APP_BASE_URL,
    APP_DB,
    CONTENT_DIR,
    DEFAULT_WORKSPACE_ALLOWED_DOMAIN,
    ELIGIBLE_POSTING_STATUSES,
    EMAIL_FROM,
    INVITE_TOKEN_HOURS,
    MARKETING_SITE_URL,
    OPENAI_API_KEY,
    OPTIONAL_SCHEDULE_COLUMNS,
    PASSWORD_RESET_SEND_EMAILS,
    POSTING_ALLOWED_APPROVAL_STATUSES,
    PUBLIC_SUPPORT_EMAIL,
    RESET_TOKEN_HOURS,
    SCHEDULE_CSV,
    STRIPE_PRICING_TABLE_ID,
    STRIPE_PUBLISHABLE_KEY,
    TEAM_INVITE_SEND_EMAILS,
    UPLOAD_MAX_BYTES,
    WELCOME_EMAIL_SEND_EMAILS,
    WORKSPACE_BILLING_REQUIRED,
    WORKSPACE_INVITE_SEND_EMAILS,
    env_flag,
    ensure_base_dirs,
)
from post_to_linkedin import determine_linkedin_asset_mode, normalise_asset_filenames, process_linkedin_post_id
from publish_tracking import record_audit_event
from utils import (
    build_content_date_folder,
    build_schedule_row,
    get_brand_config,
    load_csv,
    normalise_optional_columns,
    read_text,
    save_brand_config,
    save_csv,
    save_text,
    slugify,
    upsert_schedule_row,
)
from validate_schedule import validate_schedule
from init_db import ensure_runtime_schema
from emails import (
    billing_email_body,
    invite_email_body,
    reset_email_body,
    welcome_email_body,
    send_replury_email,
    smtp_enabled,
)

app = Flask(__name__, template_folder=str(Path(__file__).resolve().parents[1] / "templates"))
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = UPLOAD_MAX_BYTES
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "change-me")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = env_flag("SESSION_COOKIE_SECURE", True)
app.config["PREFERRED_URL_SCHEME"] = "https"


OPS_AUDIT_LIMIT = 50
OPS_PROTECTED_PREFIXES = ("/ops", "/api/ops", "/onboarding/brand")
OPS_ATTEMPT_LIMIT = 50
OPS_EVENTS_LIMIT = 25
OPS_SIGNUPS_LIMIT = 25
PLAN_SEAT_LIMITS = {"starter": 1, "growth": 3, "pro": 10}
TEAM_ADMIN_ROLES = {"owner", "admin"}
BILLING_MANAGER_ROLES = {"owner", "admin"}
SETTINGS_MANAGER_ROLES = {"owner", "admin"}
BRAND_MANAGER_ROLES = {"owner", "admin"}
EXPORT_MANAGER_ROLES = {"owner", "admin"}
WORKSPACE_ROLE_ORDER = {"owner": 0, "admin": 1, "member": 2}


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(APP_DB)
    conn.row_factory = sqlite3.Row
    ensure_runtime_schema(conn)
    return conn


def wants_json_response() -> bool:
    accept = (request.headers.get("Accept") or "").lower()
    return "application/json" in accept and "text/html" not in accept


def billing_checkout_enabled() -> bool:
    cfg = get_billing_config()
    return bool(cfg.secret_key and (cfg.starter_price_id or cfg.growth_price_id or cfg.pro_price_id))


def secure_request_active() -> bool:
    forwarded_proto = (request.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip().lower()
    return request.is_secure or forwarded_proto == "https"


def build_beta_notes(form: Any) -> str:
    notes = (form.get("beta_notes") or "").strip()
    metadata = []
    company_website = (form.get("company_website") or "").strip()
    managed_brands = (form.get("managed_brands") or "").strip()
    team_size = (form.get("team_size") or "").strip()
    timeline = (form.get("timeline") or "").strip()
    updates_opt_in = "yes" if (form.get("updates_opt_in") or "").strip().lower() == "yes" else "no"
    privacy_consent = "yes" if (form.get("privacy_consent") or "").strip().lower() == "yes" else "no"
    if company_website:
        metadata.append(f"company_website={company_website}")
    if managed_brands:
        metadata.append(f"managed_brands={managed_brands}")
    if team_size:
        metadata.append(f"team_size={team_size}")
    if timeline:
        metadata.append(f"timeline={timeline}")
    metadata.append(f"privacy_consent={privacy_consent}")
    metadata.append(f"updates_opt_in={updates_opt_in}")
    if notes and metadata:
        return notes + "\n\n" + " | ".join(metadata)
    if metadata:
        return " | ".join(metadata)
    return notes


def validate_beta_form(form: Any) -> list[str]:
    errors: list[str] = []
    email = (form.get("email") or "").strip()
    full_name = (form.get("full_name") or "").strip()
    honeypot = (form.get("website") or "").strip()
    privacy_consent = (form.get("privacy_consent") or "").strip().lower()
    if honeypot:
        errors.append("Unable to process this signup.")
    if not email:
        errors.append("Email is required.")
    if not full_name:
        errors.append("Full name is required.")
    if privacy_consent != "yes":
        errors.append("You must confirm that you have read the privacy notice.")
    return errors


def normalised_beta_form_data(form: Any) -> dict[str, str]:
    return {
        "email": (form.get("email") or "").strip(),
        "full_name": (form.get("full_name") or "").strip(),
        "company_name": (form.get("company_name") or "").strip(),
        "company_website": (form.get("company_website") or "").strip(),
        "selected_plan": normalise_plan_name((form.get("selected_plan") or "starter")),
        "beta_notes": (form.get("beta_notes") or "").strip(),
        "managed_brands": (form.get("managed_brands") or "").strip(),
        "team_size": (form.get("team_size") or "").strip(),
        "timeline": (form.get("timeline") or "").strip(),
        "privacy_consent": "yes" if (form.get("privacy_consent") or "").strip().lower() == "yes" else "",
        "updates_opt_in": "yes" if (form.get("updates_opt_in") or "").strip().lower() == "yes" else "",
        "website": (form.get("website") or "").strip(),
    }


def render_beta_template(*, saved: str | None, errors: list[str], billing_state: str, form_data: dict[str, str] | None = None, status_code: int = 200):
    return render_template(
        "beta_signup.html",
        saved=saved,
        errors=errors,
        billing_state=billing_state,
        stripe_publishable_key=STRIPE_PUBLISHABLE_KEY,
        stripe_pricing_table_id=STRIPE_PRICING_TABLE_ID,
        checkout_enabled=billing_checkout_enabled(),
        form_data=form_data or normalised_beta_form_data({}),
        marketing_site_url=MARKETING_SITE_URL,
        support_email=PUBLIC_SUPPORT_EMAIL,
    ), status_code


def password_validation_errors(password: str, confirm_password: str) -> list[str]:
    errors: list[str] = []
    if len(password or "") < 10:
        errors.append("Password must be at least 10 characters long.")
    if password != confirm_password:
        errors.append("Passwords do not match.")
    return errors


def build_app_url(path: str) -> str:
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{APP_BASE_URL}{path}"


def store_pending_checkout_context(*, email: str, full_name: str, company_name: str, selected_plan: str, signup_id: int | None = None, user_id: int | None = None, workspace_id: int | None = None, session_id: str = "") -> None:
    session["pending_checkout"] = {
        "email": (email or "").strip().lower(),
        "full_name": (full_name or "").strip(),
        "company_name": (company_name or "").strip(),
        "selected_plan": normalise_plan_name(selected_plan or "starter") or "starter",
        "signup_id": int(signup_id) if signup_id else None,
        "user_id": int(user_id) if user_id else None,
        "workspace_id": int(workspace_id) if workspace_id else None,
        "session_id": (session_id or "").strip(),
    }



def pending_checkout_context() -> dict[str, Any]:
    raw = session.get("pending_checkout")
    return raw if isinstance(raw, dict) else {}



def clear_pending_checkout_context() -> None:
    session.pop("pending_checkout", None)



def retrieve_checkout_session_with_retry(session_id: str, *, attempts: int = 4, delay_seconds: float = 0.9) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(max(attempts, 1)):
        try:
            return retrieve_checkout_session(session_id)
        except Exception as exc:  # pragma: no cover - depends on Stripe timing/network
            last_error = exc
            if attempt < attempts - 1:
                sleep(delay_seconds)
    raise RuntimeError(str(last_error or "Unable to confirm checkout session."))



def build_signup_handoff_state(*, billing_email: str, signup_id: int | None = None, stripe_customer_id: str = "") -> dict[str, Any] | None:
    billing_email = (billing_email or "").strip().lower()
    if not billing_email and not signup_id:
        return None
    with get_conn() as conn:
        signup = None
        if signup_id:
            signup = conn.execute("SELECT * FROM founding_user_signups WHERE id=?", (int(signup_id),)).fetchone()
        if signup is None and billing_email:
            signup = conn.execute("SELECT * FROM founding_user_signups WHERE lower(email)=? ORDER BY id DESC LIMIT 1", (billing_email,)).fetchone()
        if signup is None:
            return None
        user = ensure_customer_user_for_signup(conn, signup=signup)
        workspace = ensure_workspace_for_signup(conn, signup=signup, user_id=int(user["id"]))
        conn.execute(
            "UPDATE founding_user_signups SET invite_status='invited', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (signup["id"],),
        )
        conn.commit()

    try:
        sync_latest_subscription_for_customer(
            billing_email=billing_email or ((signup["email"] or "").strip().lower()),
            user_id=int(user["id"]),
            workspace_id=int(workspace["id"]),
            stripe_customer_id=(stripe_customer_id or user["stripe_customer_id"] or "").strip(),
        )
    except Exception:
        pass

    subscription = fetch_latest_subscription(
        user_id=int(user["id"]),
        email=((user["email"] or billing_email or "").strip().lower()),
        workspace_id=int(workspace["id"]),
    )
    invite_link = build_app_url(f"/activate/{create_fresh_invite_link_token(user_id=int(user['id']))}?next=/getting-started&source=checkout")
    return {
        "signup": signup,
        "user": user,
        "workspace": workspace,
        "subscription": dict(subscription) if subscription is not None else None,
        "invite_link": invite_link,
    }



def create_fresh_invite_link_token(*, user_id: int) -> str:
    with get_conn() as conn:
        conn.execute(
            "UPDATE auth_tokens SET used_at=? WHERE user_id=? AND token_type='invite' AND used_at IS NULL",
            (utcnow_iso(), user_id),
        )
        raw_token = create_auth_token(conn, user_id=user_id, token_type="invite", expires_in_hours=INVITE_TOKEN_HOURS)
        conn.commit()
    return raw_token



def maybe_finish_signup_handoff(*, handoff_state: dict[str, Any] | None, paid_flag: str = "1"):
    if not handoff_state:
        return None
    user = handoff_state["user"]
    workspace = handoff_state["workspace"]
    signup = handoff_state["signup"]
    invite_link = handoff_state["invite_link"]
    if (user["status"] or "").strip().lower() == "active" and (user["password_hash"] or "").strip():
        login_customer(user)
        record_login_event(int(user["id"]), "checkout_completed")
        clear_pending_checkout_context()
        return redirect(url_for("getting_started", paid=paid_flag))

    send_welcome_email_if_enabled(
        recipient_email=((user["email"] or signup["email"] or "").strip().lower()),
        recipient_name=(user["full_name"] or signup["full_name"] or "").strip(),
        setup_link=invite_link,
        workspace_name=(workspace["display_name"] or workspace["company_name"] or signup["company_name"] or "your workspace").strip(),
        plan_name=normalise_plan_name((workspace["selected_plan"] or signup["selected_plan"] or "starter")),
    )
    clear_pending_checkout_context()
    return redirect(invite_link)


def send_invite_email_if_enabled(*, recipient_email: str, recipient_name: str, invite_link: str, workspace_name: str) -> dict[str, Any]:
    if not WORKSPACE_INVITE_SEND_EMAILS:
        return {"ok": False, "manual_only": True, "reason": "Invite emails disabled"}
    return send_replury_email(
        recipient_email=recipient_email,
        subject=f"You're invited to {workspace_name} in Repurly",
        body_text=invite_email_body(recipient_name=recipient_name, invite_link=invite_link, workspace_name=workspace_name),
        email_type="workspace_owner_invite",
    )


def send_reset_email_if_enabled(*, recipient_email: str, recipient_name: str, reset_link: str) -> dict[str, Any]:
    if not PASSWORD_RESET_SEND_EMAILS:
        return {"ok": False, "manual_only": True, "reason": "Password reset emails disabled"}
    return send_replury_email(
        recipient_email=recipient_email,
        subject="Reset your Repurly password",
        body_text=reset_email_body(recipient_name=recipient_name, reset_link=reset_link),
        email_type="password_reset",
    )


def send_team_invite_email_if_enabled(*, recipient_email: str, recipient_name: str, invite_link: str, workspace_name: str) -> dict[str, Any]:
    if not TEAM_INVITE_SEND_EMAILS:
        return {"ok": False, "manual_only": True, "reason": "Team invite emails disabled"}
    return send_replury_email(
        recipient_email=recipient_email,
        subject=f"Join the {workspace_name} team in Repurly",
        body_text=invite_email_body(recipient_name=recipient_name, invite_link=invite_link, workspace_name=workspace_name),
        email_type="workspace_team_invite",
    )


def send_welcome_email_if_enabled(*, recipient_email: str, recipient_name: str, setup_link: str, workspace_name: str, plan_name: str) -> dict[str, Any]:
    if not WELCOME_EMAIL_SEND_EMAILS:
        return {"ok": False, "manual_only": True, "reason": "Welcome emails disabled"}
    return send_replury_email(
        recipient_email=recipient_email,
        subject=f"Welcome to Repurly — finish setting up {workspace_name}",
        body_text=welcome_email_body(
            recipient_name=recipient_name,
            setup_link=setup_link,
            workspace_name=workspace_name,
            plan_name=plan_name,
        ),
        email_type="customer_welcome_setup",
    )


def record_login_event(user_id: int, event_type: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO login_events (user_id, event_type, ip_address, user_agent) VALUES (?, ?, ?, ?)",
            (user_id, event_type, request.remote_addr or "", request.headers.get("User-Agent", "")),
        )
        conn.commit()


def fetch_customer_user_by_email(email: str) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE lower(email)=?", ((email or "").strip().lower(),)).fetchone()


def fetch_customer_user_by_id(user_id: int) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()


def ensure_customer_user_for_signup(conn: sqlite3.Connection, *, signup: sqlite3.Row) -> sqlite3.Row:
    email = ((signup["email"] or "").strip().lower())
    full_name = (signup["full_name"] or email.split("@", 1)[0]).strip()
    company_name = (signup["company_name"] or "").strip()
    existing = conn.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
    if existing is None:
        invited_at = utcnow_iso()
        conn.execute(
            """
            INSERT INTO users (email, full_name, company_name, role, status, invited_at)
            VALUES (?, ?, ?, 'customer', 'invited', ?)
            """,
            (email, full_name, company_name, invited_at),
        )
        user_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
        return conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    next_status = "active" if (existing["status"] or "").strip().lower() == "active" else "invited"
    conn.execute(
        """
        UPDATE users
        SET full_name=?, company_name=?, role='customer', status=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        """,
        (full_name, company_name, next_status, existing["id"]),
    )
    return conn.execute("SELECT * FROM users WHERE id=?", (existing["id"],)).fetchone()


def create_fresh_invite_link(conn: sqlite3.Connection, *, user_id: int) -> str:
    conn.execute(
        "UPDATE auth_tokens SET used_at=? WHERE user_id=? AND token_type='invite' AND used_at IS NULL",
        (utcnow_iso(), user_id),
    )
    raw_token = create_auth_token(conn, user_id=user_id, token_type="invite", expires_in_hours=INVITE_TOKEN_HOURS)
    return build_app_url(f"/activate/{raw_token}?next=/getting-started&source=checkout")


def current_workspace() -> dict[str, Any] | None:
    workspace = getattr(g, "current_workspace", None)
    return workspace if isinstance(workspace, dict) else None


def current_workspace_membership() -> dict[str, Any] | None:
    membership = getattr(g, "current_workspace_membership", None)
    return membership if isinstance(membership, dict) else None


def current_membership_role() -> str:
    membership = current_workspace_membership() or {}
    return str(membership.get("membership_role") or "owner").strip().lower()


def role_allows_team_management(role: str | None) -> bool:
    return (role or "").strip().lower() in TEAM_ADMIN_ROLES


def role_allows_billing_management(role: str | None) -> bool:
    return (role or "").strip().lower() in BILLING_MANAGER_ROLES


def current_customer_can_manage_team() -> bool:
    return role_allows_team_management(current_membership_role())


def current_customer_can_manage_billing() -> bool:
    return role_allows_billing_management(current_membership_role())


def role_allows_settings_management(role: str | None) -> bool:
    return (role or "").strip().lower() in SETTINGS_MANAGER_ROLES


def role_allows_brand_management(role: str | None) -> bool:
    return (role or "").strip().lower() in BRAND_MANAGER_ROLES


def role_allows_export_management(role: str | None) -> bool:
    return (role or "").strip().lower() in EXPORT_MANAGER_ROLES


def current_customer_can_manage_settings() -> bool:
    return role_allows_settings_management(current_membership_role())


def current_customer_can_manage_brands() -> bool:
    return role_allows_brand_management(current_membership_role())


def current_customer_can_manage_content() -> bool:
    return current_workspace_membership() is not None


def current_customer_can_export_workspace_data() -> bool:
    return role_allows_export_management(current_membership_role())


def workspace_plan_name(workspace: dict[str, Any] | sqlite3.Row | None, subscription: dict[str, Any] | sqlite3.Row | None = None, fallback: str = "starter") -> str:
    if subscription is not None:
        plan = (subscription.get("plan_name") if isinstance(subscription, dict) else subscription["plan_name"]) or ""
        if str(plan).strip():
            return normalise_plan_name(str(plan))
    if workspace is not None:
        plan = (workspace.get("selected_plan") if isinstance(workspace, dict) else workspace["selected_plan"]) or ""
        if str(plan).strip():
            return normalise_plan_name(str(plan))
    return normalise_plan_name(fallback) or "starter"


def workspace_seat_limit(plan_name: str) -> int:
    return PLAN_SEAT_LIMITS.get(normalise_plan_name(plan_name), 1)


def fetch_workspace_members(workspace_id: int) -> list[dict[str, Any]]:
    members = fetch_rows(
        """
        SELECT wm.*, u.email, u.full_name, u.status AS user_status, u.last_login_at, u.activated_at
        FROM workspace_memberships wm
        JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id=? AND lower(ifnull(wm.status, 'active'))='active'
        ORDER BY CASE lower(ifnull(wm.membership_role, 'member'))
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            ELSE 2
        END, lower(u.full_name), lower(u.email)
        """,
        (workspace_id,),
    )
    return members


def fetch_workspace_pending_invites(workspace_id: int) -> list[dict[str, Any]]:
    now_iso = utcnow_iso()
    return fetch_rows(
        """
        SELECT wi.*, inviter.email AS invited_by_email, inviter.full_name AS invited_by_name
        FROM workspace_invitations wi
        LEFT JOIN users inviter ON inviter.id = wi.invited_by_user_id
        WHERE wi.workspace_id=? AND wi.accepted_at IS NULL AND wi.revoked_at IS NULL AND wi.expires_at>?
        ORDER BY wi.id DESC
        """,
        (workspace_id, now_iso),
    )


def count_workspace_active_members(conn: sqlite3.Connection, workspace_id: int) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS total FROM workspace_memberships WHERE workspace_id=? AND lower(ifnull(status, 'active'))='active'",
        (workspace_id,),
    ).fetchone()
    return int(row[0] if row else 0)


def count_workspace_pending_invites(conn: sqlite3.Connection, workspace_id: int) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS total FROM workspace_invitations WHERE workspace_id=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?",
        (workspace_id, utcnow_iso()),
    ).fetchone()
    return int(row[0] if row else 0)


def workspace_seat_summary(*, workspace: dict[str, Any] | sqlite3.Row | None, subscription: dict[str, Any] | sqlite3.Row | None = None, include_pending: bool = True) -> dict[str, Any]:
    workspace_id = None
    if workspace is not None:
        workspace_id = int(workspace.get("id") if isinstance(workspace, dict) else workspace["id"])
    plan_name = workspace_plan_name(workspace, subscription)
    seat_limit = workspace_seat_limit(plan_name)
    seats_used = 0
    pending_invites = 0
    if workspace_id is not None:
        with get_conn() as conn:
            seats_used = count_workspace_active_members(conn, workspace_id)
            pending_invites = count_workspace_pending_invites(conn, workspace_id) if include_pending else 0
    seats_reserved = seats_used + pending_invites
    return {
        "plan_name": plan_name,
        "seat_limit": seat_limit,
        "seats_used": seats_used,
        "pending_invites": pending_invites,
        "seats_reserved": seats_reserved,
        "seats_available": max(seat_limit - seats_reserved, 0),
        "at_capacity": seats_reserved >= seat_limit,
    }


def create_workspace_invitation(
    conn: sqlite3.Connection,
    *,
    workspace_id: int,
    email: str,
    full_name: str,
    membership_role: str,
    invited_by_user_id: int | None,
    expires_in_hours: int,
) -> str:
    raw_token = generate_raw_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
    conn.execute(
        "UPDATE workspace_invitations SET revoked_at=?, updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND lower(email)=? AND accepted_at IS NULL AND revoked_at IS NULL",
        (utcnow_iso(), workspace_id, email.strip().lower()),
    )
    conn.execute(
        """
        INSERT INTO workspace_invitations (workspace_id, email, full_name, membership_role, invited_by_user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (workspace_id, email.strip().lower(), full_name.strip(), membership_role, invited_by_user_id, hash_token(raw_token), expires_at.replace(microsecond=0).isoformat()),
    )
    return raw_token


def fetch_valid_workspace_invitation(conn: sqlite3.Connection, raw_token: str) -> sqlite3.Row | None:
    row = conn.execute(
        """
        SELECT wi.*, w.display_name AS workspace_display_name, w.company_name AS workspace_company_name,
               w.status AS workspace_status, w.selected_plan AS workspace_selected_plan
        FROM workspace_invitations wi
        JOIN workspaces w ON w.id = wi.workspace_id
        WHERE wi.token_hash=? AND wi.accepted_at IS NULL AND wi.revoked_at IS NULL
        LIMIT 1
        """,
        (hash_token(raw_token),),
    ).fetchone()
    if row is None:
        return None
    try:
        if datetime.fromisoformat((row["expires_at"] or "").replace("Z", "+00:00")) < datetime.now(timezone.utc):
            return None
    except ValueError:
        return None
    return row


def ensure_workspace_membership(conn: sqlite3.Connection, *, workspace_id: int, user_id: int, membership_role: str) -> None:
    conn.execute(
        """
        INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status)
        VALUES (?, ?, ?, 'active')
        ON CONFLICT(workspace_id, user_id) DO UPDATE SET
            membership_role=excluded.membership_role,
            status='active',
            updated_at=CURRENT_TIMESTAMP
        """,
        (workspace_id, user_id, membership_role),
    )


def workspace_allowed_domains(workspace: dict[str, Any] | sqlite3.Row | None) -> list[str]:
    if workspace is None:
        return []
    raw = (workspace.get("allowed_email_domains") if isinstance(workspace, dict) else workspace["allowed_email_domains"]) or ""
    domains = [item.strip().lower() for item in str(raw).replace(";", ",").split(",") if item.strip()]
    return list(dict.fromkeys(domains))


def email_domain(email: str) -> str:
    cleaned = (email or "").strip().lower()
    return cleaned.split("@", 1)[1] if "@" in cleaned else ""


def workspace_accepts_email(workspace: dict[str, Any] | sqlite3.Row | None, email: str) -> bool:
    domains = workspace_allowed_domains(workspace)
    if not domains:
        return True
    return email_domain(email) in domains


def fetch_workspace_brand_by_id(workspace_id: int, brand_id: int) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM brands WHERE id=? AND workspace_id=? LIMIT 1",
            (brand_id, workspace_id),
        ).fetchone()


def workspace_reporting_summary(*, workspace: dict[str, Any] | None, subscription: dict[str, Any] | None = None) -> dict[str, Any]:
    workspace_id = int(workspace["id"]) if workspace else 0
    brands = fetch_workspace_brands(workspace_id) if workspace_id else []
    brand_slugs = {str(item.get("slug") or "").strip().lower() for item in brands if str(item.get("slug") or "").strip()}
    schedule_df = load_schedule_df()
    if not schedule_df.empty and brand_slugs:
        filtered = schedule_df.loc[schedule_df["brand"].str.lower().isin(brand_slugs)].copy()
    else:
        filtered = schedule_df.iloc[0:0].copy() if not schedule_df.empty else pd.DataFrame()
    total_posts = int(len(filtered.index)) if not filtered.empty else 0
    posted_posts = int((filtered["status"].str.lower() == "posted").sum()) if total_posts else 0
    failed_posts = int((filtered["status"].str.lower() == "failed").sum()) if total_posts else 0
    ready_posts = int(filtered["status"].str.lower().isin(["approved", "generated", "queued", "drafted"]).sum()) if total_posts else 0
    upcoming_posts = []
    if total_posts:
        upcoming = filtered.sort_values(by=["post_date", "post_time", "post_id"], ascending=[False, False, True]).head(25)
        upcoming_posts = upcoming.to_dict(orient="records")
    publish_attempts = []
    audit_events = []
    if brand_slugs:
        placeholders = ",".join(["?"] * len(brand_slugs))
        publish_attempts = fetch_rows(
            f"SELECT * FROM publish_attempts WHERE lower(brand_slug) IN ({placeholders}) ORDER BY id DESC LIMIT 20",
            tuple(sorted(brand_slugs)),
        )
        audit_events = fetch_rows(
            f"SELECT * FROM audit_log WHERE lower(brand_slug) IN ({placeholders}) ORDER BY id DESC LIMIT 20",
            tuple(sorted(brand_slugs)),
        )
    campaign_breakdown = []
    format_breakdown = []
    status_breakdown = []
    best_time_windows = []
    if total_posts:
        campaign_series = filtered["campaign"].fillna("").replace({"": "Unlabelled"}).value_counts().head(8)
        campaign_breakdown = [{"label": str(idx), "count": int(val)} for idx, val in campaign_series.items()]
        format_series = filtered["post_type"].fillna("text").replace({"": "text"}).value_counts().head(8)
        format_breakdown = [{"label": str(idx), "count": int(val)} for idx, val in format_series.items()]
        status_series = filtered["status"].fillna("planned").replace({"": "planned"}).value_counts().head(8)
        status_breakdown = [{"label": str(idx), "count": int(val)} for idx, val in status_series.items()]
        time_series = filtered["post_time"].fillna("")
        if not time_series.empty:
            windows = time_series[time_series != ""].value_counts().head(5)
            best_time_windows = [{"label": str(idx), "count": int(val)} for idx, val in windows.items()]
    feedback_loop = []
    for row in format_breakdown[:3]:
        label = str(row.get("label") or "text")
        if label == "single_image":
            insight = "Single-image posts are the easiest rich-media format to keep publishing consistently."
        elif label == "carousel":
            insight = "Carousel drafts usually need the tightest review loop, so keep them in review until assets and sequencing feel strong."
        else:
            insight = "Text posts remain the fastest way to keep cadence stable while the team learns what angles resonate."
        feedback_loop.append({"label": label, "insight": insight})
    return {
        "brand_count": len(brands),
        "total_posts": total_posts,
        "posted_posts": posted_posts,
        "failed_posts": failed_posts,
        "ready_posts": ready_posts,
        "publish_attempts": publish_attempts,
        "audit_events": audit_events,
        "upcoming_posts": upcoming_posts,
        "seat_summary": workspace_seat_summary(workspace=workspace, subscription=subscription),
        "brands": brands,
        "campaign_breakdown": campaign_breakdown,
        "format_breakdown": format_breakdown,
        "status_breakdown": status_breakdown,
        "best_time_windows": best_time_windows,
        "feedback_loop": feedback_loop,
    }


def csv_response(*, filename: str, rows: list[dict[str, Any]]) -> Response:
    if rows:
        fieldnames = list(rows[0].keys())
    else:
        fieldnames = []
    import csv
    from io import StringIO
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    if fieldnames:
        writer.writeheader()
        writer.writerows(rows)
    payload = buffer.getvalue()
    response = Response(payload, mimetype="text/csv")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def billing_status_note(subscription: dict[str, Any] | None, billing_required: bool) -> str:
    if subscription is None:
        return "payment required" if billing_required else "workspace ready"
    status = str(subscription.get("status") or "").strip().lower()
    if status == "trialing":
        return "trial active"
    if status == "active" and subscription.get("cancel_at_period_end"):
        return "active — cancels at period end"
    if status == "past_due":
        return "payment issue"
    return status or ("payment required" if billing_required else "workspace ready")


def fetch_workspace_for_user(user_id: int) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT w.*, wm.membership_role, wm.status AS membership_status
            FROM workspace_memberships wm
            JOIN workspaces w ON w.id = wm.workspace_id
            WHERE wm.user_id=? AND lower(ifnull(wm.status, 'active'))='active'
            ORDER BY wm.id ASC
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()


def fetch_workspace_brands(workspace_id: int) -> list[dict[str, Any]]:
    return fetch_rows(
        """
        SELECT b.*, COUNT(s.id) AS scheduled_posts
        FROM brands b
        LEFT JOIN schedules s ON s.brand_id = b.id
        WHERE b.workspace_id=?
        GROUP BY b.id
        ORDER BY b.display_name COLLATE NOCASE ASC
        """,
        (workspace_id,),
    )


def fetch_latest_subscription(*, user_id: int, email: str, workspace_id: int | None = None) -> sqlite3.Row | None:
    lowered_email = (email or "").strip().lower()
    clauses = ["user_id=?"]
    params: list[Any] = [user_id]
    if lowered_email:
        clauses.append("lower(ifnull(billing_email, ''))=?")
        params.append(lowered_email)
    if workspace_id is not None:
        clauses.append("workspace_id=?")
        params.append(workspace_id)

    if workspace_id is not None:
        order_sql = "CASE WHEN workspace_id=? THEN 0 WHEN user_id=? THEN 1 WHEN lower(ifnull(billing_email, ''))=? THEN 2 ELSE 3 END, id DESC"
        order_params: list[Any] = [workspace_id, user_id, lowered_email]
    else:
        order_sql = "CASE WHEN user_id=? THEN 0 WHEN lower(ifnull(billing_email, ''))=? THEN 1 ELSE 2 END, id DESC"
        order_params = [user_id, lowered_email]

    query = f"SELECT * FROM subscriptions WHERE {' OR '.join(clauses)} ORDER BY {order_sql} LIMIT 1"
    with get_conn() as conn:
        return conn.execute(query, tuple(params + order_params)).fetchone()


def workspace_billing_required() -> bool:
    return WORKSPACE_BILLING_REQUIRED


def current_subscription() -> dict[str, Any] | None:
    subscription = getattr(g, "current_subscription", None)
    return subscription if isinstance(subscription, dict) else None


def current_workspace_access_allowed() -> bool:
    if not workspace_billing_required():
        return True
    subscription = current_subscription()
    return bool(subscription and subscription_allows_workspace_access(subscription.get("status")))


def fetch_workspaces() -> list[dict[str, Any]]:
    return fetch_rows(
        """
        SELECT w.*, COUNT(DISTINCT wm.user_id) AS member_count, COUNT(DISTINCT b.id) AS brand_count
        FROM workspaces w
        LEFT JOIN workspace_memberships wm ON wm.workspace_id = w.id AND lower(ifnull(wm.status, 'active'))='active'
        LEFT JOIN brands b ON b.workspace_id = w.id
        GROUP BY w.id
        ORDER BY w.display_name COLLATE NOCASE ASC
        """
    )


def build_unique_workspace_slug(conn: sqlite3.Connection, base_slug: str) -> str:
    slug_root = slugify(base_slug) or "workspace"
    candidate = slug_root
    counter = 2
    while conn.execute("SELECT 1 FROM workspaces WHERE slug=?", (candidate,)).fetchone() is not None:
        candidate = f"{slug_root}-{counter}"
        counter += 1
    return candidate


def auto_link_brands_to_workspace(conn: sqlite3.Connection, *, workspace_id: int, company_name: str, email: str) -> int:
    email_value = (email or "").strip().lower()
    company_value = (company_name or "").strip().lower()
    slug_value = slugify(company_name or "")
    clauses: list[str] = []
    params: list[Any] = [workspace_id]
    if email_value:
        clauses.append("lower(ifnull(contact_email, ''))=?")
        params.append(email_value)
    if company_value:
        clauses.append("lower(ifnull(display_name, ''))=?")
        params.append(company_value)
    if slug_value:
        clauses.append("lower(ifnull(slug, ''))=?")
        params.append(slug_value.lower())
    if not clauses:
        return 0
    query = (
        "UPDATE brands SET workspace_id=?, updated_at=CURRENT_TIMESTAMP "
        "WHERE (workspace_id IS NULL OR workspace_id='') AND (" + " OR ".join(clauses) + ")"
    )
    cursor = conn.execute(query, tuple(params))
    return int(cursor.rowcount or 0)


def ensure_workspace_for_signup(conn: sqlite3.Connection, *, signup: sqlite3.Row, user_id: int) -> sqlite3.Row:
    membership_row = conn.execute(
        """
        SELECT w.*, wm.membership_role, wm.status AS membership_status
        FROM workspace_memberships wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id=?
        ORDER BY wm.id ASC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    if membership_row is not None:
        auto_link_brands_to_workspace(
            conn,
            workspace_id=int(membership_row["id"]),
            company_name=(signup["company_name"] or "").strip(),
            email=(signup["email"] or "").strip().lower(),
        )
        return membership_row

    company_name = (signup["company_name"] or "").strip()
    full_name = (signup["full_name"] or "").strip()
    email = (signup["email"] or "").strip().lower()
    selected_plan = (signup["selected_plan"] or "").strip()
    display_name = company_name or f"{full_name or email.split('@', 1)[0]} Workspace"

    workspace = conn.execute(
        "SELECT * FROM workspaces WHERE signup_id=? OR owner_user_id=? ORDER BY id ASC LIMIT 1",
        (signup["id"], user_id),
    ).fetchone()

    if workspace is None:
        slug_value = build_unique_workspace_slug(conn, company_name or email.split("@", 1)[0])
        conn.execute(
            """
            INSERT INTO workspaces (slug, display_name, company_name, status, selected_plan, owner_user_id, signup_id)
            VALUES (?, ?, ?, 'active', ?, ?, ?)
            """,
            (slug_value, display_name, company_name, selected_plan, user_id, signup["id"]),
        )
        workspace_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
    else:
        workspace_id = int(workspace["id"])
        conn.execute(
            """
            UPDATE workspaces
            SET display_name=?, company_name=?, selected_plan=?, owner_user_id=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
            """,
            (display_name, company_name, selected_plan, user_id, workspace_id),
        )

    conn.execute(
        """
        INSERT INTO workspace_memberships (workspace_id, user_id, membership_role, status)
        VALUES (?, ?, 'owner', 'active')
        ON CONFLICT(workspace_id, user_id) DO UPDATE SET
            membership_role='owner',
            status='active',
            updated_at=CURRENT_TIMESTAMP
        """,
        (workspace_id, user_id),
    )
    auto_link_brands_to_workspace(conn, workspace_id=workspace_id, company_name=company_name, email=email)
    return conn.execute(
        """
        SELECT w.*, wm.membership_role, wm.status AS membership_status
        FROM workspaces w
        JOIN workspace_memberships wm ON wm.workspace_id = w.id AND wm.user_id=?
        WHERE w.id=?
        LIMIT 1
        """,
        (user_id, workspace_id),
    ).fetchone()


def ops_auth_enabled() -> bool:
    return bool(os.getenv("OPS_USERNAME", "").strip() and os.getenv("OPS_PASSWORD", "").strip())


def request_path_is_protected(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix + "/") for prefix in OPS_PROTECTED_PREFIXES)


def request_has_valid_ops_auth() -> bool:
    auth = request.authorization
    if auth is None:
        return False
    username = os.getenv("OPS_USERNAME", "").strip()
    password = os.getenv("OPS_PASSWORD", "").strip()
    return hmac.compare_digest(auth.username or "", username) and hmac.compare_digest(auth.password or "", password)


@app.before_request
def load_current_customer_into_context():
    g.current_customer = None
    g.current_workspace = None
    g.current_workspace_membership = None
    g.current_subscription = None
    user_id = session.get("customer_user_id")
    if not user_id:
        return None
    user = fetch_customer_user_by_id(int(user_id))
    if user is None or (user["status"] or "").strip().lower() != "active":
        logout_customer()
        return None
    workspace = fetch_workspace_for_user(int(user_id))
    g.current_customer = dict(user)
    workspace_id: int | None = None
    if workspace is not None:
        workspace_dict = dict(workspace)
        g.current_workspace = workspace_dict
        g.current_workspace_membership = {
            "membership_role": workspace_dict.get("membership_role") or "owner",
            "membership_status": workspace_dict.get("membership_status") or "active",
        }
        workspace_id = int(workspace_dict["id"])
    subscription = fetch_latest_subscription(
        user_id=int(user_id),
        email=(user["email"] or "").strip().lower(),
        workspace_id=workspace_id,
    )
    if subscription is not None:
        g.current_subscription = dict(subscription)
    return None


@app.before_request
def require_ops_basic_auth():
    if not ops_auth_enabled() or not request_path_is_protected(request.path):
        return None
    if request_has_valid_ops_auth():
        return None
    return Response(
        "Authentication required.",
        401,
        {"WWW-Authenticate": 'Basic realm="Repurly Ops"'},
    )


@app.after_request
def add_default_security_headers(response: Response) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if secure_request_active():
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request_path_is_protected(request.path):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(_: RequestEntityTooLarge):
    message = f"Upload too large. Limit is {UPLOAD_MAX_BYTES // (1024 * 1024)} MB per request."
    if wants_json_response():
        return jsonify({"ok": False, "error": message}), 413
    return message, 413


@app.context_processor
def inject_nav() -> dict[str, Any]:
    customer = current_customer()
    path = request.path or "/"
    if request_path_is_protected(path):
        app_shell = "ops"
    elif customer is not None:
        app_shell = "customer"
    else:
        app_shell = "public"
    return {
        "app_shell": app_shell,
        "current_workspace": current_workspace(),
        "current_workspace_membership": current_workspace_membership(),
        "ops_nav": [
            ("/ops", "Dashboard"),
            ("/ops/health", "Health"),
            ("/ops/schedule", "Schedule"),
            ("/ops/brands", "Brands"),
            ("/ops/assets", "Assets"),
            ("/ops/publish-attempts", "Publish attempts"),
            ("/ops/audit", "Audit log"),
            ("/ops/billing", "Billing"),
            ("/onboarding/brand", "New brand"),
        ],
        "customer_nav": [
            ("/getting-started", "Getting started"),
            ("/dashboard", "Dashboard"),
            ("/account/billing", "Billing"),
            ("/workspace/team", "Team"),
            ("/workspace/brands", "Brands"),
            ("/workspace/assets", "Assets"),
            ("/workspace/content", "Content & schedule"),
            ("/workspace/engagement", "Engagement"),
            ("/workspace/leads", "Leads"),
            ("/workspace/automation-rules", "Automation rules"),
            ("/workspace/analytics", "Analytics"),
            ("/workspace/help", "Help"),
            ("/workspace/settings", "Settings"),
            ("/logout", "Log out"),
        ],
        "public_nav": [
            ("/beta", "Start"),
            ("/login", "Log in"),
        ],
        "current_customer": customer,
        "current_subscription": current_subscription(),
        "can_manage_team": current_customer_can_manage_team(),
        "can_manage_billing": current_customer_can_manage_billing(),
        "can_manage_settings": current_customer_can_manage_settings(),
        "can_manage_brands": current_customer_can_manage_brands(),
        "can_manage_content": current_customer_can_manage_content(),
        "can_export_workspace_data": current_customer_can_export_workspace_data(),
        "support_email": PUBLIC_SUPPORT_EMAIL,
        "marketing_site_url": MARKETING_SITE_URL,
    }


@app.get("/robots.txt")
def robots_txt():
    return Response("User-agent: *\nDisallow: /\n", mimetype="text/plain")


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "service": "replury"})


@app.get("/")
def home():
    if current_customer() is not None:
        return redirect(url_for("customer_dashboard"))
    return redirect(url_for("beta_signup"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_customer() is not None:
        return redirect(url_for("customer_dashboard"))

    error = ""
    email = ""
    next_url = (request.args.get("next") or url_for("customer_dashboard")).strip() or url_for("customer_dashboard")
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        next_url = (request.form.get("next") or next_url).strip() or url_for("customer_dashboard")
        user = fetch_customer_user_by_email(email)
        if user and (user["status"] or "").strip().lower() == "active" and verify_password(user["password_hash"], password):
            login_customer(user)
            with get_conn() as conn:
                conn.execute(
                    "UPDATE users SET last_login_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (utcnow_iso(), user["id"]),
                )
                conn.commit()
            record_login_event(int(user["id"]), "login")
            if not next_url.startswith("/"):
                next_url = url_for("customer_dashboard")
            return redirect(next_url)
        error = "We could not sign you in with those details."
    return render_template("auth/login.html", error=error, email=email, next_url=next_url)


@app.route("/logout", methods=["GET", "POST"])
def logout():
    customer = current_customer()
    if customer is not None:
        record_login_event(int(customer["id"]), "logout")
    logout_customer()
    return redirect(url_for("login"))


@app.route("/activate/<token>", methods=["GET", "POST"])
def activate_account(token: str):
    errors: list[str] = []
    token_row: sqlite3.Row | None = None
    full_name = ""
    next_url = (request.args.get("next") or request.form.get("next") or url_for("customer_dashboard")).strip() or url_for("customer_dashboard")
    if not next_url.startswith("/"):
        next_url = url_for("customer_dashboard")

    with get_conn() as conn:
        token_row = fetch_valid_token(conn, raw_token=token, token_type="invite")

    if token_row is None:
        return render_template(
            "auth/activate.html",
            token_valid=False,
            email="",
            full_name="",
            company_name="",
            next_url=next_url,
            errors=["This invite link is invalid or has expired."],
        ), 400

    full_name = (token_row["full_name"] or "").strip()
    if request.method == "POST":
        full_name = (request.form.get("full_name") or full_name).strip()
        password = request.form.get("password") or ""
        confirm_password = request.form.get("confirm_password") or ""
        errors = password_validation_errors(password, confirm_password)
        if not full_name:
            errors.append("Full name is required.")
        if not errors:
            with get_conn() as conn:
                valid_token = fetch_valid_token(conn, raw_token=token, token_type="invite")
                if valid_token is None:
                    errors.append("This invite link is invalid or has expired.")
                else:
                    conn.execute(
                        """
                        UPDATE users
                        SET full_name=?, password_hash=?, status='active',
                            email_verified_at=?, activated_at=?, updated_at=CURRENT_TIMESTAMP
                        WHERE id=?
                        """,
                        (full_name, hash_password(password), utcnow_iso(), utcnow_iso(), valid_token["user_id"]),
                    )
                    mark_token_used(conn, int(valid_token["id"]))
                    conn.execute(
                        "UPDATE founding_user_signups SET invite_status='activated', updated_at=CURRENT_TIMESTAMP WHERE lower(email)=?",
                        ((valid_token["email"] or "").strip().lower(),),
                    )
                    conn.commit()
                    user = conn.execute("SELECT * FROM users WHERE id=?", (valid_token["user_id"],)).fetchone()
                    login_customer(user)
                    record_login_event(int(valid_token["user_id"]), "activate")
                    return redirect(next_url)

    return render_template(
        "auth/activate.html",
        token_valid=True,
        email=token_row["email"],
        full_name=full_name,
        company_name=token_row["company_name"] or "",
        next_url=next_url,
        errors=errors,
    )


@app.get("/signup/complete")
def signup_complete_from_checkout():
    session_id = (request.args.get("session_id") or "").strip()
    pending = pending_checkout_context()
    if session_id:
        pending["session_id"] = session_id
        session["pending_checkout"] = pending
    if not session_id and (pending.get("session_id") or "").strip():
        session_id = str(pending.get("session_id") or "").strip()
    if not session_id:
        return redirect(url_for("beta_signup", billing="success"))

    checkout_session: dict[str, Any] | None = None
    confirmation_error = ""
    try:
        checkout_session = retrieve_checkout_session_with_retry(session_id)
    except Exception as exc:
        confirmation_error = str(exc)

    metadata = (checkout_session or {}).get("metadata") or {}
    billing_email = (
        ((checkout_session or {}).get("customer_details") or {}).get("email")
        or (checkout_session or {}).get("customer_email")
        or metadata.get("billing_email")
        or pending.get("email")
        or ""
    ).strip().lower()
    signup_id_raw = str(metadata.get("signup_id") or (checkout_session or {}).get("client_reference_id") or pending.get("signup_id") or "").strip()
    signup_id = int(signup_id_raw) if signup_id_raw.isdigit() else None

    if checkout_session is not None:
        status = ((checkout_session.get("payment_status") or checkout_session.get("status") or "").strip().lower())
        if status not in {"complete", "paid", "open", "unpaid"}:
            return render_template(
                "auth/checkout_pending.html",
                session_id=session_id,
                retry_url=url_for("signup_complete_from_checkout", session_id=session_id),
                support_email=PUBLIC_SUPPORT_EMAIL,
                billing_email=billing_email,
                error_message="Your payment is still processing. This page will work as soon as Stripe confirms the session.",
                pending_context=pending,
            ), 202
        handoff_state = build_signup_handoff_state(
            billing_email=billing_email,
            signup_id=signup_id,
            stripe_customer_id=str((checkout_session.get("customer") or "")).strip(),
        )
        handoff_response = maybe_finish_signup_handoff(handoff_state=handoff_state, paid_flag="1")
        if handoff_response is not None:
            return handoff_response

    if billing_email or signup_id:
        handoff_state = build_signup_handoff_state(
            billing_email=billing_email,
            signup_id=signup_id,
            stripe_customer_id="",
        )
        if handoff_state and handoff_state.get("subscription"):
            handoff_response = maybe_finish_signup_handoff(handoff_state=handoff_state, paid_flag="1")
            if handoff_response is not None:
                return handoff_response

    return render_template(
        "auth/checkout_pending.html",
        session_id=session_id,
        retry_url=url_for("signup_complete_from_checkout", session_id=session_id),
        support_email=PUBLIC_SUPPORT_EMAIL,
        billing_email=billing_email,
        error_message=confirmation_error or "We are still finishing your Repurly setup. Refresh in a moment or use the link in your welcome email once it arrives.",
        pending_context=pending,
    ), 202


@app.get("/getting-started")
@customer_login_required
def getting_started():
    customer = current_customer()
    workspace = current_workspace()
    subscription = current_subscription()
    brands = fetch_workspace_brands(int(workspace["id"])) if workspace is not None else []
    assets = fetch_rows(
        """
        SELECT a.*, b.display_name AS brand_name
        FROM assets a
        JOIN brands b ON b.id = a.brand_id
        WHERE b.workspace_id=?
        ORDER BY a.id DESC
        LIMIT 25
        """,
        (workspace["id"],),
    ) if workspace is not None else []
    generated_posts = fetch_rows(
        """
        SELECT gp.*, b.display_name AS brand_name
        FROM generated_posts gp
        JOIN brands b ON b.id = gp.brand_id
        WHERE b.workspace_id=?
        ORDER BY gp.id DESC
        LIMIT 20
        """,
        (workspace["id"],),
    ) if workspace is not None else []
    return render_template(
        "customer/getting_started.html",
        user=customer,
        workspace=workspace,
        subscription=subscription,
        brands=brands,
        assets=assets,
        generated_posts=generated_posts,
        step_state={
            "workspace": workspace is not None,
            "paid": bool(subscription and subscription_allows_workspace_access(subscription.get("status"))),
            "brands": bool(brands),
            "assets": bool(assets),
            "posts": bool(generated_posts),
        },
    )


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    submitted = False
    if request.method == "POST":
        submitted = True
        email = (request.form.get("email") or "").strip().lower()
        user = fetch_customer_user_by_email(email)
        if user and (user["status"] or "").strip().lower() == "active":
            with get_conn() as conn:
                raw_token = create_auth_token(conn, user_id=int(user["id"]), token_type="password_reset", expires_in_hours=RESET_TOKEN_HOURS)
                conn.commit()
            reset_link = build_app_url(f"/reset-password/{raw_token}")
            send_reset_email_if_enabled(
                recipient_email=email,
                recipient_name=(user["full_name"] or "").strip(),
                reset_link=reset_link,
            )
            record_login_event(int(user["id"]), "password_reset_requested")
    return render_template("auth/forgot_password.html", submitted=submitted, email_automation=smtp_enabled())


@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token: str):
    errors: list[str] = []
    with get_conn() as conn:
        token_row = fetch_valid_token(conn, raw_token=token, token_type="password_reset")

    if token_row is None:
        return render_template(
            "auth/reset_password.html",
            token_valid=False,
            errors=["This reset link is invalid or has expired."],
        ), 400

    if request.method == "POST":
        password = request.form.get("password") or ""
        confirm_password = request.form.get("confirm_password") or ""
        errors = password_validation_errors(password, confirm_password)
        if not errors:
            with get_conn() as conn:
                valid_token = fetch_valid_token(conn, raw_token=token, token_type="password_reset")
                if valid_token is None:
                    errors.append("This reset link is invalid or has expired.")
                else:
                    conn.execute(
                        "UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (hash_password(password), valid_token["user_id"]),
                    )
                    mark_token_used(conn, int(valid_token["id"]))
                    conn.commit()
                    record_login_event(int(valid_token["user_id"]), "password_reset_completed")
                    return redirect(url_for("login", reset="success"))

    return render_template("auth/reset_password.html", token_valid=True, errors=errors)


@app.get("/dashboard")
@customer_login_required
def customer_dashboard():
    customer = current_customer()
    workspace = current_workspace()
    membership = current_workspace_membership()
    subscription = current_subscription()
    if workspace_billing_required() and not current_workspace_access_allowed():
        return redirect(url_for("customer_billing", required="1"))

    workspace_brands: list[dict[str, Any]] = []
    workspace_members: list[dict[str, Any]] = []
    pending_invites: list[dict[str, Any]] = []
    seat_summary = workspace_seat_summary(workspace=workspace, subscription=subscription)
    reporting_summary = workspace_reporting_summary(workspace=workspace, subscription=subscription)
    if workspace is not None:
        workspace_brands = reporting_summary["brands"]
        workspace_members = fetch_workspace_members(int(workspace["id"]))
        pending_invites = fetch_workspace_pending_invites(int(workspace["id"]))
    with get_conn() as conn:
        signup = conn.execute(
            "SELECT * FROM founding_user_signups WHERE lower(email)=? ORDER BY id DESC LIMIT 1",
            ((customer.get("email") or "").strip().lower(),),
        ).fetchone()
    onboarding_items: list[dict[str, Any]] = []
    onboarding_items.append({
        "label": "Account activated",
        "done": bool(customer.get("activated_at")),
        "detail": "Your invite is active and you can access the protected Repurly workspace.",
    })
    onboarding_items.append({
        "label": "Workspace configured",
        "done": workspace is not None and bool((workspace.get("display_name") if isinstance(workspace, dict) else workspace["display_name"]) or ""),
        "detail": "Workspace profile, billing contact and allowed domains can now be edited from Settings.",
    })
    onboarding_items.append({
        "label": "Brand portfolio linked",
        "done": bool(workspace_brands),
        "detail": "Brands can now be created and edited from the customer Brands page.",
    })
    onboarding_items.append({
        "label": "Paid access",
        "done": bool(subscription and (subscription.get("status") or "").strip().lower() in {"active", "trialing"}),
        "detail": "An active Stripe subscription keeps workspace access unlocked and powers self-serve billing.",
    })
    onboarding_items.append({
        "label": "Team seats configured",
        "done": seat_summary.get("seat_limit", 0) >= seat_summary.get("seats_used", 0),
        "detail": f"Your current plan supports {seat_summary['seat_limit']} active seat(s).",
    })
    onboarding_items.append({
        "label": "Reporting ready",
        "done": reporting_summary.get("total_posts", 0) > 0 or reporting_summary.get("brand_count", 0) > 0,
        "detail": "Analytics and CSV exports are available from the Analytics page for customer reporting and compliance checks.",
    })
    return render_template(
        "customer/dashboard.html",
        user=customer,
        workspace=workspace,
        membership=membership,
        brands=workspace_brands,
        workspace_members=workspace_members,
        pending_invites=pending_invites,
        seat_summary=seat_summary,
        reporting_summary=reporting_summary,
        signup=dict(signup) if signup else None,
        subscription=subscription,
        billing_required=workspace_billing_required(),
        workspace_access_allowed=current_workspace_access_allowed(),
        onboarding_items=onboarding_items,
        can_manage_team=current_customer_can_manage_team(),
        can_manage_billing=current_customer_can_manage_billing(),
        can_manage_settings=current_customer_can_manage_settings(),
        can_manage_brands=current_customer_can_manage_brands(),
        can_export_workspace_data=current_customer_can_export_workspace_data(),
        billing_status_label=billing_status_note(subscription, workspace_billing_required()),
    )


@app.route("/account/billing", methods=["GET"])
@customer_login_required
def customer_billing():
    customer = current_customer()
    workspace = current_workspace()
    subscription = current_subscription()
    billing_state = (request.args.get("billing") or "").strip().lower()
    required = (request.args.get("required") or "").strip() == "1"
    query_error = (request.args.get("error") or "").strip()
    with get_conn() as conn:
        signup = conn.execute(
            "SELECT * FROM founding_user_signups WHERE lower(email)=? ORDER BY id DESC LIMIT 1",
            ((customer.get("email") or "").strip().lower(),),
        ).fetchone()

    selected_plan = (
        request.args.get("plan")
        or (workspace.get("selected_plan") if workspace else "")
        or (signup["selected_plan"] if signup else "")
        or "starter"
    )
    selected_plan = normalise_plan_name(selected_plan)
    access_allowed = current_workspace_access_allowed()
    customer_id = (subscription or {}).get("stripe_customer_id") or customer.get("stripe_customer_id") or ""
    manage_billing = current_customer_can_manage_billing()
    portal_enabled = bool(customer_id and billing_checkout_enabled() and manage_billing)
    seat_summary = workspace_seat_summary(workspace=workspace, subscription=subscription)
    active_subscription = bool(subscription and subscription_allows_workspace_access(subscription.get("status")))
    active_plan_name = normalise_plan_name((subscription or {}).get("plan_name") or "") if subscription else ""
    change_requested = bool(active_subscription and selected_plan and active_plan_name and selected_plan != active_plan_name)
    allow_checkout = bool(billing_checkout_enabled() and manage_billing and (not active_subscription or change_requested))
    return render_template(
        "customer/billing.html",
        user=customer,
        workspace=workspace,
        subscription=subscription,
        signup=dict(signup) if signup else None,
        selected_plan=selected_plan,
        billing_state=billing_state,
        billing_required=workspace_billing_required(),
        access_allowed=access_allowed,
        checkout_enabled=billing_checkout_enabled(),
        portal_enabled=portal_enabled,
        stripe_customer_id=customer_id,
        required=required,
        errors=[query_error] if query_error else [],
        manage_billing=manage_billing,
        seat_summary=seat_summary,
        billing_status_label=billing_status_note(subscription, workspace_billing_required()),
        active_subscription=active_subscription,
        active_plan_name=active_plan_name,
        change_requested=change_requested,
        allow_checkout=allow_checkout,
    )


@app.post("/account/billing/sync")
@customer_login_required
def customer_billing_sync():
    customer = current_customer()
    workspace = current_workspace()
    try:
        sync_result = sync_latest_subscription_for_customer(
            billing_email=(customer.get("email") or "").strip().lower(),
            user_id=int(customer["id"]),
            workspace_id=int(workspace["id"]) if workspace else None,
            stripe_customer_id=(customer.get("stripe_customer_id") or "").strip(),
        )
        return redirect(url_for("customer_billing", billing="synced", sync_count=sync_result.get("synced_count", 0)))
    except RuntimeError as exc:
        return redirect(url_for("customer_billing", billing="sync_error", error=str(exc)))


@app.post("/account/billing/portal")
@customer_login_required
def customer_billing_portal():
    if not current_customer_can_manage_billing():
        return redirect(url_for("customer_billing", billing="portal_error", error="Only workspace owners or admins can manage billing."))
    customer = current_customer()
    subscription = current_subscription() or {}
    try:
        session_payload = create_billing_portal_session(
            customer_id=(subscription.get("stripe_customer_id") or customer.get("stripe_customer_id") or "").strip(),
            email=(customer.get("email") or "").strip().lower(),
            return_path="/account/billing?billing=portal_return",
        )
    except RuntimeError as exc:
        return redirect(url_for("customer_billing", billing="portal_error", error=str(exc)))
    return redirect(session_payload["url"])


@app.post("/account/billing/create-checkout-session")
@customer_login_required
def customer_billing_create_checkout_session():
    if not current_customer_can_manage_billing():
        return redirect(url_for("customer_billing", billing="portal_error", error="Only workspace owners or admins can start checkout for this workspace."))
    customer = current_customer()
    workspace = current_workspace()
    subscription = current_subscription() or {}
    selected_plan = normalise_plan_name(request.form.get("selected_plan") or (workspace.get("selected_plan") if workspace else "") or "starter")
    allowed_plans = {"starter", "growth", "pro"}
    if selected_plan not in allowed_plans:
        selected_plan = "starter"
    active_subscription = subscription_allows_workspace_access(subscription.get("status"))
    active_plan_name = normalise_plan_name(subscription.get("plan_name") or "") if subscription else ""
    confirm_plan_change = (request.form.get("confirm_plan_change") or "").strip().lower() in {"1", "true", "yes", "on"}

    if active_subscription and selected_plan == active_plan_name:
        return redirect(url_for("customer_billing", billing="portal_return", error="This workspace already has an active subscription on that plan. Use the customer portal to manage it."))
    if active_subscription and selected_plan != active_plan_name and not confirm_plan_change:
        return redirect(url_for("customer_billing", error="Confirm that you want to start a new checkout for a plan change before continuing.", plan=selected_plan))

    with get_conn() as conn:
        signup = conn.execute(
            "SELECT * FROM founding_user_signups WHERE lower(email)=? ORDER BY id DESC LIMIT 1",
            ((customer.get("email") or "").strip().lower(),),
        ).fetchone()
        if workspace is not None:
            conn.execute(
                "UPDATE workspaces SET selected_plan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (selected_plan, workspace["id"]),
            )
        if signup is not None:
            conn.execute(
                "UPDATE founding_user_signups SET selected_plan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (selected_plan, signup["id"]),
            )
        conn.commit()

    try:
        session_payload = create_checkout_session(
            email=(customer.get("email") or "").strip().lower(),
            plan_name=selected_plan,
            signup_id=int(signup["id"]) if signup else None,
            user_id=int(customer["id"]),
            workspace_id=int(workspace["id"]) if workspace else None,
            success_path="/account/billing?billing=success",
            cancel_path="/account/billing?billing=cancelled",
        )
        store_pending_checkout_context(
            email=(customer.get("email") or "").strip().lower(),
            full_name=(customer.get("full_name") or "").strip(),
            company_name=(workspace.get("company_name") if workspace else customer.get("company_name") or "").strip(),
            selected_plan=selected_plan,
            signup_id=int(signup["id"]) if signup else None,
            user_id=int(customer["id"]),
            workspace_id=int(workspace["id"]) if workspace else None,
            session_id=str(session_payload.get("id") or ""),
        )
    except RuntimeError as exc:
        return render_template(
            "customer/billing.html",
            user=customer,
            workspace=workspace,
            subscription=current_subscription(),
            signup=dict(signup) if signup else None,
            selected_plan=selected_plan,
            billing_state="",
            billing_required=workspace_billing_required(),
            access_allowed=current_workspace_access_allowed(),
            checkout_enabled=billing_checkout_enabled(),
            portal_enabled=False,
            stripe_customer_id=(current_subscription() or {}).get("stripe_customer_id") or customer.get("stripe_customer_id") or "",
            required=True,
            errors=[str(exc)],
            manage_billing=True,
            seat_summary=workspace_seat_summary(workspace=workspace, subscription=current_subscription()),
            billing_status_label=billing_status_note(current_subscription(), workspace_billing_required()),
            active_subscription=active_subscription,
            active_plan_name=active_plan_name,
            change_requested=bool(active_subscription and selected_plan != active_plan_name),
            allow_checkout=True,
        ), 400

    if wants_json_response():
        return jsonify({"ok": True, **session_payload})
    return redirect(session_payload["url"])


@app.route("/workspace/settings", methods=["GET", "POST"])
@customer_login_required
def workspace_settings():
    customer = current_customer()
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    saved = (request.args.get("saved") or "").strip().lower()
    error = (request.args.get("error") or "").strip()
    if request.method == "POST":
        if not current_customer_can_manage_settings():
            abort(403)
        action = (request.form.get("action") or "save").strip().lower()
        display_name = (request.form.get("display_name") or workspace.get("display_name") or "").strip()
        company_name = (request.form.get("company_name") or workspace.get("company_name") or "").strip()
        billing_contact_email = (request.form.get("billing_contact_email") or customer.get("email") or "").strip().lower()
        reporting_email = (request.form.get("reporting_email") or "").strip().lower()
        allowed_email_domains = ", ".join([item.strip().lower().lstrip("@") for item in (request.form.get("allowed_email_domains") or "").replace(";", ",").split(",") if item.strip()])
        onboarding_stage = (request.form.get("onboarding_stage") or workspace.get("onboarding_stage") or "onboarding").strip().lower()
        if not display_name:
            return redirect(url_for("workspace_settings", saved="error", error="Workspace name is required."))
        if not allowed_email_domains and DEFAULT_WORKSPACE_ALLOWED_DOMAIN:
            allowed_email_domains = DEFAULT_WORKSPACE_ALLOWED_DOMAIN
        with get_conn() as conn:
            conn.execute(
                """
                UPDATE workspaces
                SET display_name=?, company_name=?, billing_contact_email=?, reporting_email=?, allowed_email_domains=?, onboarding_stage=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """,
                (display_name, company_name, billing_contact_email, reporting_email, allowed_email_domains, onboarding_stage, workspace["id"]),
            )
            conn.commit()
        record_audit_event(
            "workspace_settings_updated",
            actor=(customer.get("email") or "workspace_admin"),
            message=f"Workspace settings updated for {display_name}.",
            payload={"workspace_id": workspace["id"], "onboarding_stage": onboarding_stage},
        )
        if action == "continue_brands":
            return redirect(url_for("workspace_brands_page"))
        return redirect(url_for("workspace_settings", saved="updated"))
    reporting_summary = workspace_reporting_summary(workspace=workspace, subscription=current_subscription())
    recent_email_events = fetch_rows(
        "SELECT * FROM email_delivery_log ORDER BY id DESC LIMIT 10"
    )
    return render_template(
        "customer/settings.html",
        user=customer,
        workspace=workspace,
        saved=saved,
        error=error,
        manage_settings=current_customer_can_manage_settings(),
        can_export=current_customer_can_export_workspace_data(),
        reporting_summary=reporting_summary,
        recent_email_events=recent_email_events,
        smtp_enabled=smtp_enabled(),
        email_from=EMAIL_FROM,
    )


@app.route("/workspace/brands", methods=["GET"])
@customer_login_required
def workspace_brands_page():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    brands = fetch_workspace_brands(int(workspace["id"]))
    edit_brand_id = (request.args.get("brand_id") or "").strip()
    editing_brand = None
    if edit_brand_id.isdigit():
        row = fetch_workspace_brand_by_id(int(workspace["id"]), int(edit_brand_id))
        editing_brand = dict(row) if row is not None else None
    return render_template(
        "customer/brands.html",
        workspace=workspace,
        brands=brands,
        editing_brand=editing_brand,
        manage_brands=current_customer_can_manage_brands(),
        saved=(request.args.get("saved") or "").strip().lower(),
        error=(request.args.get("error") or "").strip(),
    )


@app.post("/workspace/brands")
@customer_login_required
def workspace_brands_save():
    if not current_customer_can_manage_brands():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    brand_id_raw = (request.form.get("brand_id") or "").strip()
    brand_id = int(brand_id_raw) if brand_id_raw.isdigit() else None
    action = (request.form.get("action") or "save").strip().lower()
    slug = slugify(request.form.get("slug", ""))
    display_name = (request.form.get("display_name") or "").strip()
    website = (request.form.get("website") or "").strip()
    contact_email = (request.form.get("contact_email") or "").strip().lower()
    tone = (request.form.get("tone") or "").strip()
    audience = (request.form.get("audience") or "").strip()
    primary_cta = (request.form.get("primary_cta") or "").strip()
    secondary_cta = (request.form.get("secondary_cta") or "").strip()
    if not slug or not display_name:
        return redirect(url_for("workspace_brands_page", saved="error", error="Brand slug and display name are required."))
    config = {
        "brand": slug,
        "display_name": display_name,
        "website": website,
        "contact_email": contact_email,
        "tone": tone,
        "audience": audience,
        "primary_cta": primary_cta,
        "secondary_cta": secondary_cta,
        "default_platforms": ["linkedin"],
        "hashtags": [],
        "posting_goals": [],
        "content_pillars": [],
        "linkedin_author_urn": "",
        "linkedin_token_env": "",
    }
    save_brand_config(slug, config)
    with get_conn() as conn:
        if brand_id is None:
            conn.execute(
                """
                INSERT INTO brands (workspace_id, slug, display_name, website, contact_email, brand_status, tone, audience, primary_cta, secondary_cta, default_platforms_json, hashtags_json, posting_goals_json, content_pillars_json, settings_json)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, '[]', '[]', '[]', '[]', ?)
                ON CONFLICT(slug) DO UPDATE SET workspace_id=excluded.workspace_id, display_name=excluded.display_name, website=excluded.website, contact_email=excluded.contact_email, brand_status='active', tone=excluded.tone, audience=excluded.audience, primary_cta=excluded.primary_cta, secondary_cta=excluded.secondary_cta, settings_json=excluded.settings_json, updated_at=CURRENT_TIMESTAMP
                """,
                (workspace["id"], slug, display_name, website, contact_email, tone, audience, primary_cta, secondary_cta, json.dumps(config)),
            )
        else:
            conn.execute(
                """
                UPDATE brands SET slug=?, display_name=?, website=?, contact_email=?, tone=?, audience=?, primary_cta=?, secondary_cta=?, brand_status='active', settings_json=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=? AND workspace_id=?
                """,
                (slug, display_name, website, contact_email, tone, audience, primary_cta, secondary_cta, json.dumps(config), brand_id, workspace["id"]),
            )
        conn.commit()
    record_audit_event(
        "workspace_brand_saved",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"Saved brand {display_name}.",
        payload={"workspace_id": workspace["id"], "slug": slug},
    )
    if action == "continue_assets":
        return redirect(url_for("workspace_assets_page"))
    if action == "continue_content":
        return redirect(url_for("workspace_content_page"))
    return redirect(url_for("workspace_brands_page", saved="brand_saved"))


@app.post("/workspace/brands/<int:brand_id>/archive")
@customer_login_required
def workspace_brands_archive(brand_id: int):
    if not current_customer_can_manage_brands():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        conn.execute(
            "UPDATE brands SET brand_status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?",
            (brand_id, workspace["id"]),
        )
        conn.commit()
    record_audit_event("workspace_brand_archived", actor=(customer.get("email") or "workspace_admin"), message=f"Archived brand {brand_id}.", payload={"workspace_id": workspace["id"], "brand_id": brand_id})
    return redirect(url_for("workspace_brands_page", saved="brand_archived"))


@app.post("/workspace/brands/<int:brand_id>/restore")
@customer_login_required
def workspace_brands_restore(brand_id: int):
    if not current_customer_can_manage_brands():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        conn.execute(
            "UPDATE brands SET brand_status='active', updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?",
            (brand_id, workspace["id"]),
        )
        conn.commit()
    record_audit_event("workspace_brand_restored", actor=(customer.get("email") or "workspace_admin"), message=f"Restored brand {brand_id}.", payload={"workspace_id": workspace["id"], "brand_id": brand_id})
    return redirect(url_for("workspace_brands_page", saved="brand_restored"))


@app.get("/workspace/assets")
@customer_login_required
def workspace_assets_page():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    brands = fetch_workspace_brands(int(workspace["id"]))
    assets = fetch_workspace_assets(int(workspace["id"]))
    return render_template(
        "customer/assets.html",
        workspace=workspace,
        brands=brands,
        assets=assets,
        saved=(request.args.get("saved") or "").strip().lower(),
        error=(request.args.get("error") or "").strip(),
        manage_brands=current_customer_can_manage_brands(),
    )


@app.post("/workspace/assets/upload")
@customer_login_required
def workspace_assets_upload():
    if not current_customer_can_manage_brands():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    brand_id_raw = (request.form.get("brand_id") or "").strip()
    if not brand_id_raw.isdigit():
        return redirect(url_for("workspace_assets_page", saved="error", error="Choose a brand before uploading assets."))
    brand = fetch_workspace_brand_by_id(int(workspace["id"]), int(brand_id_raw))
    if brand is None:
        return redirect(url_for("workspace_assets_page", saved="error", error="That brand could not be found in this workspace."))
    action = (request.form.get("action") or "upload").strip().lower()
    uploaded_files = request.files.getlist("assets")
    if not uploaded_files:
        return redirect(url_for("workspace_assets_page", saved="error", error="Choose at least one logo or brand asset to upload."))

    asset_dir = CONTENT_DIR / brand["slug"] / "workspace_assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    saved_count = 0
    try:
        with get_conn() as conn:
            for storage in uploaded_files:
                if storage is None or not getattr(storage, "filename", ""):
                    continue
                output_name = build_unique_upload_name(asset_dir, storage.filename)
                mime_type, asset_kind, _size_bytes = validate_uploaded_asset(storage, output_name)
                target_path = asset_dir / output_name
                storage.save(target_path)
                conn.execute(
                    """
                    INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status, alt_text, asset_tags_json)
                    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                    """,
                    (brand["id"], output_name, str(target_path), mime_type, asset_kind, f"{brand['display_name']} brand asset", json.dumps([slugify(str(brand['display_name'])).replace('-', ''), 'brand', 'asset'])),
                )
                saved_count += 1
            conn.commit()
    except ValueError as exc:
        return redirect(url_for("workspace_assets_page", saved="error", error=str(exc)))
    if not saved_count:
        return redirect(url_for("workspace_assets_page", saved="error", error="We could not save any files from that upload."))
    record_audit_event(
        "workspace_assets_uploaded",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"Uploaded {saved_count} brand asset(s) for {brand['display_name']}.",
        payload={"workspace_id": workspace["id"], "brand_id": brand["id"], "file_count": saved_count},
    )
    if action == "continue_content":
        return redirect(url_for("workspace_content_page"))
    return redirect(url_for("workspace_assets_page", saved="uploaded"))


@app.post("/workspace/assets/<int:asset_id>/meta")
@customer_login_required
def workspace_assets_update_meta(asset_id: int):
    if not current_customer_can_manage_brands():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    alt_text = (request.form.get("alt_text") or "").strip()
    tags = [item.strip() for item in (request.form.get("tags_text") or "").replace(";", ",").split(",") if item.strip()]
    with get_conn() as conn:
        asset = conn.execute(
            "SELECT a.id FROM assets a JOIN brands b ON b.id = a.brand_id WHERE a.id=? AND b.workspace_id=? LIMIT 1",
            (asset_id, workspace["id"]),
        ).fetchone()
        if asset is None:
            abort(404)
        conn.execute("UPDATE assets SET alt_text=?, asset_tags_json=? WHERE id=?", (alt_text, json.dumps(tags), asset_id))
        conn.commit()
    record_audit_event(
        "workspace_asset_updated",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"Updated asset metadata for asset {asset_id}.",
        payload={"workspace_id": workspace["id"], "asset_id": asset_id, "tags": tags},
    )
    return redirect(url_for("workspace_assets_page", saved="asset_updated"))


def parse_json_array(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    try:
        loaded = json.loads(str(raw) or "[]")
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return loaded if isinstance(loaded, list) else []


def posting_format_choices() -> list[tuple[str, str]]:
    return [
        ("text", "Text only"),
        ("single_image", "Single image"),
        ("video", "Video"),
        ("carousel", "Carousel / multi-asset"),
    ]


def posting_format_label(post_type: str) -> str:
    mapping = {key: label for key, label in posting_format_choices()}
    return mapping.get((post_type or "").strip().lower(), "Text only")


def _asset_thumbnail_url(asset: dict[str, Any]) -> str:
    file_path = str(asset.get("file_path") or "").strip()
    if not file_path:
        return ""
    marker = "/content/"
    if marker in file_path:
        return file_path[file_path.index(marker) + 1:]
    return file_path


def fetch_workspace_assets(workspace_id: int, brand_id: int | None = None) -> list[dict[str, Any]]:
    query = """
        SELECT a.*, b.display_name AS brand_name, b.slug AS brand_slug
        FROM assets a
        JOIN brands b ON b.id = a.brand_id
        WHERE b.workspace_id=?
    """
    params: list[Any] = [workspace_id]
    if brand_id is not None:
        query += " AND a.brand_id=?"
        params.append(brand_id)
    query += " ORDER BY lower(b.display_name), a.id DESC"
    rows = fetch_rows(query, tuple(params))
    for row in rows:
        row["asset_tags"] = [str(item).strip() for item in parse_json_array(row.get("asset_tags_json") or "[]") if str(item).strip()]
        row["thumbnail_url"] = _asset_thumbnail_url(row)
        row["preview_is_image"] = row.get("asset_kind") == "image"
    return rows


def _best_time_suggestion(brand: dict[str, Any]) -> dict[str, str]:
    audience = str(brand.get("audience") or "").lower()
    tone = str(brand.get("tone") or "").lower()
    if any(token in audience for token in ["founder", "executive", "leadership", "c-suite"]):
        return {"time": "07:45", "label": "Early executive window", "reason": "Senior decision-makers often scan LinkedIn before the day gets busy."}
    if any(token in audience for token in ["marketing", "agency", "growth", "sales"]):
        return {"time": "10:30", "label": "Mid-morning demand-gen slot", "reason": "Commercial teams tend to catch up after the morning rush."}
    if any(token in audience for token in ["operations", "technical", "engineer", "product"]):
        return {"time": "14:15", "label": "Post-lunch operations slot", "reason": "Specialist audiences often engage later in the workday."}
    if "authoritative" in tone or "executive" in tone:
        return {"time": "08:30", "label": "Authority-building slot", "reason": "Earlier posts help thought leadership feel more intentional and agenda-setting."}
    return {"time": "09:00", "label": "Default workday slot", "reason": "A safe weekday posting time for most B2B brands."}


def _ai_copy_variants(topic: str, hook: str, caption_text: str, cta: str) -> list[dict[str, str]]:
    base_hook = hook or topic
    return [
        {"label": "Safer", "hook": base_hook, "caption_text": caption_text, "cta": cta},
        {"label": "Bolder", "hook": f"A stronger point of view on {topic.lower()}", "caption_text": f"Stop treating {topic.lower()} like a box-ticking exercise.\n\n{caption_text}", "cta": cta or "Start the conversation"},
        {"label": "More commercial", "hook": f"How {topic.lower()} turns into pipeline", "caption_text": f"The real value of {topic.lower()} is not more activity. It is better commercial momentum.\n\n{caption_text}", "cta": cta or "Book a call"},
    ]


def _smart_asset_suggestions(assets: list[dict[str, Any]], text_seed: str, post_type: str) -> list[dict[str, Any]]:
    seed = (text_seed or "").lower()
    ranked: list[tuple[int, dict[str, Any]]] = []
    for asset in assets:
        score = 0
        tags = [tag.lower() for tag in asset.get("asset_tags", [])]
        if any(tag and tag in seed for tag in tags):
            score += 8
        alt_text = str(asset.get("alt_text") or "").lower()
        if alt_text and alt_text in seed:
            score += 5
        asset_kind = str(asset.get("asset_kind") or "").lower()
        if post_type == "single_image" and asset_kind == "image":
            score += 3
        elif post_type == "video" and asset_kind == "video":
            score += 3
        elif post_type == "carousel" and asset_kind in {"image", "video"}:
            score += 3
        ranked.append((score, asset))
    ranked.sort(key=lambda item: (-item[0], -(item[1].get("id") or 0)))
    return [item[1] for item in ranked[:6] if item[0] > 0] or [item[1] for item in ranked[:3]]


def _calendar_weeks_for_rows(schedule_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not schedule_rows:
        return []
    parsed = []
    for row in schedule_rows:
        try:
            dt = datetime.strptime(f"{row.get('post_date','')} {row.get('post_time','00:00')}", "%Y-%m-%d %H:%M")
        except Exception:
            continue
        parsed.append((dt, row))
    parsed.sort(key=lambda item: item[0])
    grouped: dict[tuple[int, int], list[tuple[datetime, dict[str, Any]]]] = defaultdict(list)
    for dt, row in parsed:
        iso = dt.isocalendar()
        grouped[(iso.year, iso.week)].append((dt, row))
    weeks = []
    for (year, week), items in grouped.items():
        monday = min(item[0].date() - timedelta(days=item[0].weekday()) for item in items)
        days = []
        for offset in range(7):
            current = monday + timedelta(days=offset)
            day_items = [{**row, "calendar_time": dt.strftime("%H:%M")} for dt, row in items if dt.date() == current]
            days.append({"date": current.isoformat(), "label": current.strftime("%a %d %b"), "items": day_items})
        weeks.append({"label": f"Week {week}, {year}", "days": days})
    return weeks


def fetch_campaign_templates(workspace_id: int) -> list[dict[str, Any]]:
    return fetch_rows(
        """
        SELECT ct.*, b.display_name AS brand_name
        FROM campaign_templates ct
        LEFT JOIN brands b ON b.id = ct.brand_id
        WHERE ct.workspace_id=?
        ORDER BY ct.updated_at DESC, ct.id DESC
        """,
        (workspace_id,),
    )


def fetch_posting_strategies(workspace_id: int) -> list[dict[str, Any]]:
    rows = fetch_rows(
        "SELECT * FROM posting_strategies WHERE workspace_id=? ORDER BY updated_at DESC, id DESC",
        (workspace_id,),
    )
    for row in rows:
        row["focus_keywords"] = [str(item).strip() for item in parse_json_array(row.get("focus_keywords_json") or "[]") if str(item).strip()]
    return rows


def fetch_content_feedback(workspace_id: int, draft_id: int) -> list[dict[str, Any]]:
    return fetch_rows(
        """
        SELECT cf.*, u.full_name AS author_name, u.email AS author_email
        FROM content_feedback cf
        LEFT JOIN users u ON u.id = cf.author_user_id
        WHERE cf.workspace_id=? AND cf.generated_post_id=?
        ORDER BY cf.id DESC
        """,
        (workspace_id, draft_id),
    )


def fetch_workspace_schedule_rows(workspace_id: int, limit: int = 50) -> list[dict[str, Any]]:
    return fetch_rows(
        """
        SELECT s.*, b.display_name AS brand_name, b.slug AS brand_slug,
               gp.topic AS generated_topic, gp.post_type AS generated_post_type,
               gp.approval_status AS draft_status
        FROM schedules s
        JOIN brands b ON b.id = s.brand_id
        LEFT JOIN generated_posts gp ON gp.id = s.generated_post_id
        WHERE b.workspace_id=?
        ORDER BY s.post_date DESC, s.post_time DESC, s.id DESC
        LIMIT ?
        """,
        (workspace_id, limit),
    )


def _enrich_generated_post(post: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(post)
    selected_asset_ids = [int(item) for item in parse_json_array(enriched.get("asset_ids_json") or "[]") if str(item).isdigit()]
    enriched["selected_asset_ids"] = selected_asset_ids
    enriched["selected_asset_count"] = len(selected_asset_ids)
    enriched["format_label"] = posting_format_label(enriched.get("post_type") or "text")
    enriched["hashtags"] = [str(item).strip() for item in parse_json_array(enriched.get("hashtags_json") or "[]") if str(item).strip()]
    enriched["body_points"] = [str(item).strip() for item in parse_json_array(enriched.get("body_points_json") or "[]") if str(item).strip()]
    if selected_asset_ids:
        placeholders = ",".join(["?"] * len(selected_asset_ids))
        rows = fetch_rows(
            f"SELECT a.*, b.display_name AS brand_name FROM assets a JOIN brands b ON b.id=a.brand_id WHERE a.id IN ({placeholders}) ORDER BY a.id ASC",
            tuple(selected_asset_ids),
        )
        for row in rows:
            row["asset_tags"] = [str(item).strip() for item in parse_json_array(row.get("asset_tags_json") or "[]") if str(item).strip()]
            row["thumbnail_url"] = _asset_thumbnail_url(row)
        row["preview_is_image"] = row.get("asset_kind") == "image"
        enriched["thumbnail_assets"] = rows
    else:
        enriched["thumbnail_assets"] = []
    return enriched


def fetch_workspace_generated_posts(workspace_id: int, limit: int = 100) -> list[dict[str, Any]]:
    rows = fetch_rows(
        """
        SELECT gp.*, b.display_name AS brand_name, b.slug AS brand_slug,
               s.post_date, s.post_time, s.status AS schedule_status,
               s.approval_status AS schedule_approval_status, s.campaign AS schedule_campaign,
               s.notes AS schedule_notes
        FROM generated_posts gp
        JOIN brands b ON b.id = gp.brand_id
        LEFT JOIN schedules s ON s.generated_post_id = gp.id
        WHERE b.workspace_id=?
        ORDER BY gp.id DESC
        LIMIT ?
        """,
        (workspace_id, limit),
    )
    return [_enrich_generated_post(row) for row in rows]


def fetch_workspace_generated_post(workspace_id: int, draft_id: int) -> dict[str, Any] | None:
    rows = fetch_rows(
        """
        SELECT gp.*, b.display_name AS brand_name, b.slug AS brand_slug,
               s.post_date, s.post_time, s.status AS schedule_status,
               s.approval_status AS schedule_approval_status, s.campaign AS schedule_campaign,
               s.notes AS schedule_notes
        FROM generated_posts gp
        JOIN brands b ON b.id = gp.brand_id
        LEFT JOIN schedules s ON s.generated_post_id = gp.id
        WHERE gp.id=? AND b.workspace_id=?
        LIMIT 1
        """,
        (draft_id, workspace_id),
    )
    if not rows:
        return None
    return _enrich_generated_post(rows[0])


def _validate_post_assets(post_type: str, asset_rows: list[dict[str, Any]], *, context: str = "post") -> list[str]:
    errors: list[str] = []
    post_type = (post_type or "text").strip().lower()
    asset_kinds = [str(row.get("asset_kind") or "").lower() for row in asset_rows]
    if post_type == "text":
        if asset_rows:
            errors.append(f"Text-only {context}s should not have assets attached. Switch the format to single image, video, or carousel.")
        return errors
    if post_type == "single_image":
        if len(asset_rows) != 1 or asset_kinds != ["image"]:
            errors.append("Single-image posts need exactly one selected image asset.")
        return errors
    if post_type == "video":
        if len(asset_rows) != 1 or asset_kinds != ["video"]:
            errors.append("Video posts need exactly one selected video asset.")
        return errors
    if post_type == "carousel":
        if len(asset_rows) < 2:
            errors.append("Carousel posts need at least two selected visual assets.")
        elif any(kind not in {"image", "video"} for kind in asset_kinds):
            errors.append("Carousel posts only support image or video assets.")
        return errors
    errors.append("Choose whether this is a text, image, video, or carousel post.")
    return errors


def _workspace_asset_rows_for_ids(workspace_id: int, brand_id: int, asset_ids: list[int]) -> list[dict[str, Any]]:
    if not asset_ids:
        return []
    placeholders = ",".join(["?"] * len(asset_ids))
    return fetch_rows(
        f"""
        SELECT a.*, b.display_name AS brand_name, b.slug AS brand_slug
        FROM assets a
        JOIN brands b ON b.id = a.brand_id
        WHERE b.workspace_id=? AND a.brand_id=? AND a.id IN ({placeholders})
        ORDER BY a.id ASC
        """,
        tuple([workspace_id, brand_id] + asset_ids),
    )


def _customer_content_defaults(*, brands: list[dict[str, Any]], selected_draft: dict[str, Any] | None) -> dict[str, Any]:
    selected_brand_id = ""
    if selected_draft is not None:
        selected_brand_id = str(selected_draft.get("brand_id") or "")
    elif brands:
        selected_brand_id = str(brands[0].get("id") or "")
    return {
        "draft_id": str(selected_draft.get("id") or "") if selected_draft else "",
        "brand_id": selected_brand_id,
        "topic": (selected_draft.get("topic") or "") if selected_draft else "",
        "hook": (selected_draft.get("hook") or "") if selected_draft else "",
        "caption_text": (selected_draft.get("caption_text") or "") if selected_draft else "",
        "cta": (selected_draft.get("cta") or "") if selected_draft else "",
        "hashtags_text": ", ".join(parse_json_array(selected_draft.get("hashtags_json") or "[]")) if selected_draft else "",
        "post_type": (selected_draft.get("post_type") or "text") if selected_draft else "text",
        "post_date": (selected_draft.get("post_date") or "") if selected_draft else "",
        "post_time": (selected_draft.get("post_time") or "") if selected_draft else "09:00",
        "campaign": (selected_draft.get("schedule_campaign") or "") if selected_draft else "",
        "notes": (selected_draft.get("schedule_notes") or "") if selected_draft else "",
        "review_notes": (selected_draft.get("review_notes") or "") if selected_draft else "",
        "prompt_brief": (selected_draft.get("prompt_brief") or selected_draft.get("topic") or "") if selected_draft else "",
        "planner_label": (selected_draft.get("planner_label") or "") if selected_draft else "",
    }


def _new_customer_post_id(brand_slug: str) -> str:
    return f"{slugify(brand_slug)}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}_customer"


def _sync_generated_post_to_schedule(*, conn: sqlite3.Connection, draft: dict[str, Any], brand: dict[str, Any], asset_rows: list[dict[str, Any]], post_date: str, post_time: str, campaign: str, notes: str, schedule_status: str, approval_status: str) -> None:
    content_folder = build_content_date_folder(slugify(str(brand.get("slug") or "")), post_date)
    (content_folder / "captions").mkdir(parents=True, exist_ok=True)
    (content_folder / "assets").mkdir(parents=True, exist_ok=True)
    caption_filename = f"{draft['post_id']}.txt"
    save_text(content_folder / "captions" / caption_filename, (draft.get("caption_text") or "").strip() + "\n")

    copied_asset_names: list[str] = []
    for asset in asset_rows:
        source_path = Path(str(asset.get("file_path") or "").strip())
        if not source_path.exists():
            raise FileNotFoundError(f"Asset file is missing: {source_path}")
        destination_path = content_folder / "assets" / source_path.name
        if source_path.resolve() != destination_path.resolve():
            shutil.copy2(source_path, destination_path)
        copied_asset_names.append(source_path.name)

    asset_filename = "|".join(copied_asset_names)
    asset_mode = determine_linkedin_asset_mode(str(draft.get("post_type") or "text"), asset_filename)
    row = build_schedule_row(
        post_id=str(draft.get("post_id") or ""),
        post_date=post_date,
        post_time=post_time,
        brand=str(brand.get("slug") or ""),
        platform="linkedin",
        post_type=str(draft.get("post_type") or "text"),
        theme=str(draft.get("topic") or "").strip(),
        campaign=campaign,
        status=schedule_status,
        content_folder=f"content/{slugify(str(brand.get('slug') or ''))}/{post_date}",
        asset_filename=asset_filename,
        caption_filename=caption_filename,
        notes=notes,
        approval_status=approval_status,
        asset_mode=asset_mode,
        platform_post_format=str(draft.get("post_type") or "text"),
    )
    schedule_df = load_schedule_df()
    updated_df = upsert_schedule_row(schedule_df, row)
    save_csv(updated_df, SCHEDULE_CSV)
    conn.execute(
        """
        INSERT INTO schedules (brand_id, generated_post_id, post_id, platform, post_type, post_date, post_time, theme, campaign, status, approval_status, content_folder, asset_filename, caption_filename, notes)
        VALUES (?, ?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(post_id) DO UPDATE SET
            brand_id=excluded.brand_id,
            generated_post_id=excluded.generated_post_id,
            post_type=excluded.post_type,
            post_date=excluded.post_date,
            post_time=excluded.post_time,
            theme=excluded.theme,
            campaign=excluded.campaign,
            status=excluded.status,
            approval_status=excluded.approval_status,
            content_folder=excluded.content_folder,
            asset_filename=excluded.asset_filename,
            caption_filename=excluded.caption_filename,
            notes=excluded.notes,
            updated_at=CURRENT_TIMESTAMP
        """,
        (
            brand["id"],
            draft["id"],
            draft["post_id"],
            draft.get("post_type") or "text",
            post_date,
            post_time,
            draft.get("topic") or "",
            campaign,
            schedule_status,
            approval_status,
            f"content/{slugify(str(brand.get('slug') or ''))}/{post_date}",
            asset_filename,
            caption_filename,
            notes,
        ),
    )


def _remove_schedule_for_post(conn: sqlite3.Connection, post_id: str) -> None:
    conn.execute("DELETE FROM schedules WHERE post_id=?", (post_id,))
    schedule_df = load_schedule_df()
    if not schedule_df.empty and "post_id" in schedule_df.columns:
        filtered = schedule_df.loc[schedule_df["post_id"] != post_id].copy()
        save_csv(filtered, SCHEDULE_CSV)


def _focus_keywords(brief: str) -> list[str]:
    cleaned = (brief or "").replace("/", " ").replace("-", " ")
    parts = [item.strip().lower() for item in cleaned.split() if item.strip()]
    return list(dict.fromkeys(parts))[:4]


def _hashtag_suggestions(brand: dict[str, Any], brief: str) -> list[str]:
    tags: list[str] = []
    slug = slugify(str(brand.get("slug") or brand.get("display_name") or "brand")).replace("_", "")
    if slug:
        tags.append(f"#{slug}")
    for word in _focus_keywords(brief):
        compact = ''.join(ch for ch in word.title() if ch.isalnum())
        if compact:
            tags.append(f"#{compact}")
    audience = str(brand.get("audience") or "").strip().split()
    if audience:
        compact = ''.join(ch for ch in audience[0].title() if ch.isalnum())
        if compact:
            tags.append(f"#{compact}")
    tags.append("#LinkedIn")
    return list(dict.fromkeys(tags))[:5]


def _schedule_dates_for_frequency(*, base_date: date, count: int, frequency: str) -> list[date]:
    frequency = (frequency or "custom_count").strip().lower()
    if frequency == "daily_week":
        return [base_date + timedelta(days=offset) for offset in range(count)]
    if frequency == "weekdays_two_weeks":
        dates: list[date] = []
        current = base_date
        while len(dates) < count:
            if current.weekday() < 5:
                dates.append(current)
            current += timedelta(days=1)
        return dates
    if frequency == "three_per_week":
        target_weekdays = [0, 2, 4]
        dates: list[date] = []
        current = base_date
        while len(dates) < count:
            if current.weekday() in target_weekdays:
                dates.append(current)
            current += timedelta(days=1)
        return dates
    if frequency == "weekly":
        return [base_date + timedelta(days=7 * offset) for offset in range(count)]
    return [base_date + timedelta(days=offset) for offset in range(count)]


def _time_slots_for_generation(*, start_time: str, count: int, time_mode: str) -> list[str]:
    raw = (start_time or "09:00").strip() or "09:00"
    try:
        hours, minutes = [int(part) for part in raw.split(":", 1)]
    except Exception:
        hours, minutes = 9, 0
    base_minutes = max(0, min(23 * 60 + 59, hours * 60 + minutes))
    time_mode = (time_mode or "same_time").strip().lower()
    slots: list[str] = []
    for index in range(count):
        current_minutes = base_minutes
        if time_mode == "staggered":
            current_minutes = min(23 * 60 + 30, base_minutes + (index % 4) * 45)
        elif time_mode == "smart_random":
            seed = f"{raw}:{count}:{index}"
            rng = random.Random(seed)
            jitter = rng.randint(-75, 120)
            current_minutes = max(8 * 60, min(17 * 60 + 30, base_minutes + jitter))
        slots.append(f"{current_minutes // 60:02d}:{current_minutes % 60:02d}")
    return slots


def _generation_plan_label(frequency: str, time_mode: str, count: int) -> str:
    frequency_labels = {
        "custom_count": f"{count} draft{'s' if count != 1 else ''}",
        "daily_week": "daily for 1 week",
        "weekdays_two_weeks": "weekdays for 2 weeks",
        "three_per_week": "3 times per week",
        "weekly": "weekly",
    }
    time_labels = {
        "same_time": "same time each post",
        "staggered": "staggered through the day",
        "smart_random": "randomised workday times",
    }
    return f"{frequency_labels.get((frequency or '').strip().lower(), frequency_labels['custom_count'])} · {time_labels.get((time_mode or '').strip().lower(), 'same time each post')}"


def _ai_blueprints_for_brand(*, brand: dict[str, Any], workspace: dict[str, Any], brief: str, count: int) -> list[dict[str, Any]]:
    brand_name = (brand.get("display_name") or brand.get("slug") or "Your brand").strip()
    audience = (brand.get("audience") or "buyers evaluating your service").strip()
    tone = (brand.get("tone") or "clear, helpful, commercially confident").strip()
    primary_cta = (brand.get("primary_cta") or "Book a call").strip()
    secondary_cta = (brand.get("secondary_cta") or "Learn more").strip()
    website = (brand.get("website") or workspace.get("company_name") or "your website").strip()
    focus = (brief or f"how {brand_name} helps {audience}").strip()
    patterns = [
        (
            "Practical how-to",
            lambda i: f"A simple way {brand_name} approaches {focus}",
            lambda i: [
                f"Start with the pain point {audience} already feel around {focus}.",
                f"Explain the system or step-by-step process {brand_name} uses in a {tone.lower()} tone.",
                f"End with one clear next step: {primary_cta}."
            ],
        ),
        (
            "Point of view",
            lambda i: f"Our view on {focus}: keep it simpler than most teams think",
            lambda i: [
                f"State one opinion {brand_name} believes about {focus}.",
                f"Back it up with two reasons that matter to {audience}.",
                f"Invite readers to respond, then offer {secondary_cta or primary_cta}."
            ],
        ),
        (
            "Proof / outcomes",
            lambda i: f"What better {focus} should look like for {audience}",
            lambda i: [
                f"List the two or three outcomes {brand_name} wants from {focus}.",
                f"Translate each outcome into a simple business benefit.",
                f"Close with {primary_cta} and point readers to {website}."
            ],
        ),
        (
            "Checklist",
            lambda i: f"A quick {focus} checklist for busy teams",
            lambda i: [
                f"Give a short checklist readers can use this week.",
                f"Keep the language {tone.lower()} and action-led.",
                f"Wrap with {primary_cta}."
            ],
        ),
        (
            "Behind the scenes",
            lambda i: f"Behind the scenes: how {brand_name} plans {focus}",
            lambda i: [
                f"Describe the workflow or operating rhythm used by {brand_name}.",
                f"Mention how this helps {audience} avoid wasted effort.",
                f"Finish with {secondary_cta or primary_cta}."
            ],
        ),
    ]
    blueprints: list[dict[str, Any]] = []
    for idx in range(count):
        label, hook_builder, body_builder = patterns[idx % len(patterns)]
        hook = hook_builder(idx)
        body_points = body_builder(idx)
        topic = f"{focus.title()} #{idx + 1}"
        hashtags = _hashtag_suggestions(brand, brief)
        caption_text = f"{hook}\n\n" + "\n".join(f"• {item}" for item in body_points) + f"\n\n{primary_cta}\n"
        blueprints.append({
            "topic": topic,
            "hook": hook,
            "body_points": body_points,
            "caption_text": caption_text,
            "cta": primary_cta,
            "hashtags": hashtags,
            "label": label,
        })
    return blueprints


@app.get("/workspace/help")
@customer_login_required
def workspace_help_page():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    return render_template("customer/help.html", workspace=workspace)


@app.get("/workspace/content")
@customer_login_required
def workspace_content_page():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    brands = fetch_workspace_brands(int(workspace["id"]))
    selected_draft = None
    draft_raw = (request.args.get("draft") or "").strip()
    if draft_raw.isdigit():
        selected_draft = fetch_workspace_generated_post(int(workspace["id"]), int(draft_raw))
    drafts = fetch_workspace_generated_posts(int(workspace["id"]))
    schedule_rows = fetch_workspace_schedule_rows(int(workspace["id"]))
    workspace_assets = fetch_workspace_assets(int(workspace["id"]))
    campaign_templates = fetch_campaign_templates(int(workspace["id"]))
    posting_strategies = fetch_posting_strategies(int(workspace["id"]))
    selected_asset_ids = selected_draft.get("selected_asset_ids") if selected_draft else []
    best_time_hint = _best_time_suggestion(dict(brands[0])) if brands else {"time": "09:00", "label": "Default workday slot", "reason": "A safe weekday time."}
    ai_defaults = {
        "brand_id": str(brands[0]["id"]) if brands else "",
        "brief": (selected_draft.get("prompt_brief") or selected_draft.get("topic") or "") if selected_draft else "",
        "count": "7",
        "post_type": (selected_draft.get("post_type") or "text") if selected_draft else "text",
        "post_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "post_time": (selected_draft.get("post_time") or best_time_hint["time"]) if selected_draft else best_time_hint["time"],
        "campaign": (selected_draft.get("schedule_campaign") or selected_draft.get("planner_label") or "") if selected_draft else "",
        "delivery_mode": "save_draft",
        "frequency": "daily_week",
        "time_mode": "same_time",
    }
    if selected_draft:
        selected_draft["feedback_items"] = fetch_content_feedback(int(workspace["id"]), int(selected_draft["id"]))
        selected_draft["copy_variants"] = _ai_copy_variants(str(selected_draft.get("topic") or ""), str(selected_draft.get("hook") or ""), str(selected_draft.get("caption_text") or ""), str(selected_draft.get("cta") or ""))
    recommended_assets = _smart_asset_suggestions(
        workspace_assets,
        ((selected_draft.get("caption_text") if selected_draft else request.args.get("q") or "") or "") + " " + ((selected_draft.get("topic") if selected_draft else "") or ""),
        (selected_draft.get("post_type") if selected_draft else ai_defaults["post_type"]),
    )
    return render_template(
        "customer/content.html",
        workspace=workspace,
        brands=brands,
        drafts=drafts,
        schedule_rows=schedule_rows,
        workspace_assets=workspace_assets,
        selected_draft=selected_draft,
        selected_asset_ids=selected_asset_ids,
        form_defaults=_customer_content_defaults(brands=brands, selected_draft=selected_draft),
        ai_defaults=ai_defaults,
        saved=(request.args.get("saved") or "").strip().lower(),
        message=(request.args.get("message") or "").strip(),
        error=(request.args.get("error") or "").strip(),
        can_manage_content=current_customer_can_manage_content(),
        can_manage_brands=current_customer_can_manage_brands(),
        format_choices=posting_format_choices(),
        carousel_live_supported=env_flag("LINKEDIN_DRY_RUN", True),
        calendar_weeks=_calendar_weeks_for_rows(schedule_rows),
        campaign_templates=campaign_templates,
        posting_strategies=posting_strategies,
        best_time_hint=best_time_hint,
        recommended_assets=recommended_assets,
    )


@app.post("/workspace/content/save")
@customer_login_required
def workspace_content_save():
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)

    brand_id_raw = (request.form.get("brand_id") or "").strip()
    if not brand_id_raw.isdigit():
        return redirect(url_for("workspace_content_page", saved="error", error="Choose a brand before saving this post."))
    brand = fetch_workspace_brand_by_id(int(workspace["id"]), int(brand_id_raw))
    if brand is None:
        return redirect(url_for("workspace_content_page", saved="error", error="That brand could not be found in this workspace."))
    brand_dict = dict(brand)

    topic = (request.form.get("topic") or "").strip()
    hook = (request.form.get("hook") or "").strip()
    caption_text = (request.form.get("caption_text") or "").strip()
    cta = (request.form.get("cta") or "").strip()
    hashtags_text = (request.form.get("hashtags_text") or "").strip()
    post_type = (request.form.get("post_type") or "text").strip().lower()
    post_date = (request.form.get("post_date") or "").strip()
    post_time = (request.form.get("post_time") or "").strip() or "09:00"
    campaign = (request.form.get("campaign") or "").strip()
    notes = (request.form.get("notes") or "").strip()
    review_notes = (request.form.get("review_notes") or "").strip()
    prompt_brief = (request.form.get("prompt_brief") or topic or "").strip()
    planner_label = (request.form.get("planner_label") or campaign or "").strip()
    draft_id_raw = (request.form.get("draft_id") or "").strip()
    action = (request.form.get("action") or "save_draft").strip().lower()

    selected_asset_ids = [int(item) for item in request.form.getlist("asset_ids") if str(item).isdigit()]
    asset_rows = _workspace_asset_rows_for_ids(int(workspace["id"]), int(brand["id"]), selected_asset_ids)

    errors: list[str] = []
    if not caption_text:
        errors.append("Add the post copy before saving.")
    if post_type not in {"text", "single_image", "video", "carousel"}:
        errors.append("Choose whether this is a text, image, video or carousel post.")
    if not topic:
        topic = hook or f"{brand_dict.get('display_name') or 'Brand'} update"
    errors.extend(_validate_post_assets(post_type, asset_rows))
    if action in {"submit_review", "schedule_publish"}:
        if not post_date:
            errors.append("Choose a schedule date before submitting this post.")
        if not post_time:
            errors.append("Choose a schedule time before submitting this post.")
    if action == "schedule_publish" and post_type in {"carousel", "video"} and not env_flag("LINKEDIN_DRY_RUN", True):
        errors.append("Live carousel and video publishing are not enabled yet. Save the draft or submit it for review instead.")

    if errors:
        draft_param = draft_id_raw if draft_id_raw.isdigit() else ""
        return redirect(url_for("workspace_content_page", draft=draft_param, saved="error", error=" ".join(errors)))

    hashtags = [item.strip() for item in hashtags_text.replace(";", ",").split(",") if item.strip()]
    approval_status = {
        "save_draft": "draft",
        "submit_review": "submitted",
        "schedule_publish": "approved",
    }.get(action, "draft")

    with get_conn() as conn:
        existing = None
        if draft_id_raw.isdigit():
            existing = conn.execute(
                "SELECT gp.* FROM generated_posts gp JOIN brands b ON b.id = gp.brand_id WHERE gp.id=? AND b.workspace_id=? LIMIT 1",
                (int(draft_id_raw), int(workspace["id"])),
            ).fetchone()
        post_id = (existing["post_id"] if existing is not None else _new_customer_post_id(str(brand_dict.get("slug") or brand_dict.get("display_name") or "brand")))
        if existing is None:
            conn.execute(
                """
                INSERT INTO generated_posts (brand_id, post_id, platform, post_type, topic, hook, body_points_json, cta, hashtags_json, caption_text, generation_mode, approval_status, asset_ids_json, review_notes, prompt_brief, planner_label, last_saved_at)
                VALUES (?, ?, 'linkedin', ?, ?, ?, '[]', ?, ?, ?, 'customer_editor', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    brand["id"],
                    post_id,
                    post_type,
                    topic,
                    hook,
                    cta,
                    json.dumps(hashtags),
                    caption_text,
                    approval_status,
                    json.dumps(selected_asset_ids),
                    review_notes,
                    prompt_brief,
                    planner_label,
                ),
            )
            draft_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
        else:
            draft_id = int(existing["id"])
            conn.execute(
                """
                UPDATE generated_posts
                SET brand_id=?, post_type=?, topic=?, hook=?, cta=?, hashtags_json=?, caption_text=?, generation_mode='customer_editor', approval_status=?, asset_ids_json=?, review_notes=?, prompt_brief=?, planner_label=?, last_saved_at=CURRENT_TIMESTAMP
                WHERE id=?
                """,
                (
                    brand["id"],
                    post_type,
                    topic,
                    hook,
                    cta,
                    json.dumps(hashtags),
                    caption_text,
                    approval_status,
                    json.dumps(selected_asset_ids),
                    review_notes,
                    prompt_brief,
                    planner_label,
                    draft_id,
                ),
            )
        conn.commit()
        draft = fetch_workspace_generated_post(int(workspace["id"]), draft_id)
        if draft is None:
            raise RuntimeError("Draft could not be loaded after saving.")
        if action == "save_draft":
            saved_key = "draft_saved"
        elif action == "submit_review":
            _sync_generated_post_to_schedule(
                conn=conn,
                draft=draft,
                brand=brand_dict,
                asset_rows=asset_rows,
                post_date=post_date,
                post_time=post_time,
                campaign=campaign,
                notes=notes,
                schedule_status="drafted",
                approval_status="pending",
            )
            saved_key = "submitted"
        else:
            _sync_generated_post_to_schedule(
                conn=conn,
                draft=draft,
                brand=brand_dict,
                asset_rows=asset_rows,
                post_date=post_date,
                post_time=post_time,
                campaign=campaign,
                notes=notes,
                schedule_status="approved",
                approval_status="approved",
            )
            saved_key = "scheduled"
        conn.commit()

    record_audit_event(
        "workspace_content_saved",
        actor=(customer.get("email") or "workspace_user"),
        brand_slug=str(brand_dict.get("slug") or ""),
        message=f"Saved customer post draft '{topic}' with action '{action}'.",
        payload={"workspace_id": workspace["id"], "brand_id": brand_dict["id"], "draft_id": draft_id, "action": action, "post_type": post_type},
    )
    return redirect(url_for("workspace_content_page", draft=draft_id, saved=saved_key))


@app.post("/workspace/content/<int:draft_id>/delete")
@customer_login_required
def workspace_content_delete(draft_id: int):
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT gp.*, b.slug AS brand_slug FROM generated_posts gp JOIN brands b ON b.id = gp.brand_id WHERE gp.id=? AND b.workspace_id=? LIMIT 1",
            (draft_id, int(workspace["id"])),
        ).fetchone()
        if row is None:
            abort(404)
        post_id = str(row["post_id"] or "")
        _remove_schedule_for_post(conn, post_id)
        conn.execute("DELETE FROM generated_posts WHERE id=?", (draft_id,))
        conn.commit()
    record_audit_event(
        "workspace_content_deleted",
        actor=(customer.get("email") or "workspace_user"),
        brand_slug=str(row["brand_slug"] or ""),
        message=f"Deleted customer draft {post_id}.",
        payload={"workspace_id": workspace["id"], "draft_id": draft_id, "post_id": post_id},
    )
    return redirect(url_for("workspace_content_page", saved="deleted"))


@app.post("/workspace/content/<int:draft_id>/unschedule")
@customer_login_required
def workspace_content_unschedule(draft_id: int):
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT gp.*, b.slug AS brand_slug FROM generated_posts gp JOIN brands b ON b.id = gp.brand_id WHERE gp.id=? AND b.workspace_id=? LIMIT 1",
            (draft_id, int(workspace["id"])),
        ).fetchone()
        if row is None:
            abort(404)
        post_id = str(row["post_id"] or "")
        _remove_schedule_for_post(conn, post_id)
        conn.execute(
            "UPDATE generated_posts SET approval_status='draft', last_saved_at=CURRENT_TIMESTAMP WHERE id=?",
            (draft_id,),
        )
        conn.commit()
    record_audit_event(
        "workspace_content_unscheduled",
        actor=(customer.get("email") or "workspace_user"),
        brand_slug=str(row["brand_slug"] or ""),
        message=f"Removed draft {post_id} from the schedule.",
        payload={"workspace_id": workspace["id"], "draft_id": draft_id, "post_id": post_id},
    )
    return redirect(url_for("workspace_content_page", draft=draft_id, saved="unscheduled"))


@app.post("/workspace/content/generate")
@customer_login_required
def workspace_content_generate():
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    brand_id_raw = (request.form.get("brand_id") or "").strip()
    if not brand_id_raw.isdigit():
        return redirect(url_for("workspace_content_page", saved="error", error="Choose a brand before generating posts."))
    brand = fetch_workspace_brand_by_id(int(workspace["id"]), int(brand_id_raw))
    if brand is None:
        return redirect(url_for("workspace_content_page", saved="error", error="That brand could not be found in this workspace."))
    brand = dict(brand)
    brief = (request.form.get("brief") or "").strip()
    post_type = (request.form.get("post_type") or "text").strip().lower()
    delivery_mode = (request.form.get("delivery_mode") or "save_draft").strip().lower()
    campaign = (request.form.get("campaign") or "").strip()
    post_time = (request.form.get("post_time") or "09:00").strip() or "09:00"
    post_date = (request.form.get("post_date") or "").strip()
    frequency = (request.form.get("frequency") or "custom_count").strip().lower()
    time_mode = (request.form.get("time_mode") or "same_time").strip().lower()
    action = (request.form.get("action") or "generate_drafts").strip().lower()
    overwrite_mode = (request.form.get("overwrite_mode") or "create_new").strip().lower()
    target_draft_raw = (request.form.get("target_draft_id") or "").strip()
    count_raw = (request.form.get("count") or "5").strip()
    try:
        count = max(1, min(28, int(count_raw)))
    except ValueError:
        count = 5
    if action == "generate_week":
        frequency = "daily_week"
        count = 7
    elif action == "generate_weekdays":
        frequency = "weekdays_two_weeks"
        count = 10
    elif action == "generate_month":
        frequency = "three_per_week"
        count = 12
    frequency = frequency if frequency in {"custom_count", "daily_week", "weekdays_two_weeks", "three_per_week", "weekly"} else "custom_count"
    time_mode = time_mode if time_mode in {"same_time", "staggered", "smart_random"} else "same_time"
    if delivery_mode not in {"save_draft", "submit_review", "schedule_publish"}:
        delivery_mode = "save_draft"
    if post_type not in {"text", "single_image", "video", "carousel"}:
        post_type = "text"
    if overwrite_mode not in {"create_new", "overwrite_selected"}:
        overwrite_mode = "create_new"

    selected_asset_ids = [int(item) for item in request.form.getlist("asset_ids") if str(item).isdigit()]
    asset_rows = _workspace_asset_rows_for_ids(int(workspace["id"]), int(brand["id"]), selected_asset_ids)
    errors: list[str] = []
    errors.extend(_validate_post_assets(post_type, asset_rows, context="generated post"))
    if delivery_mode in {"submit_review", "schedule_publish"} and not post_date:
        errors.append("Choose a start date when you want generated posts added to the schedule.")
    if frequency != "custom_count" and delivery_mode == "save_draft" and not brief:
        errors.append("Add a campaign brief so the AI can vary the generated posts across the chosen cadence.")
    target_draft = None
    if overwrite_mode == "overwrite_selected":
        if not target_draft_raw.isdigit():
            errors.append("Choose an existing draft to overwrite, or switch overwrite off.")
        else:
            target_draft = fetch_workspace_generated_post(int(workspace["id"]), int(target_draft_raw))
            if target_draft is None:
                errors.append("The selected draft could not be found in this workspace.")
            elif str(target_draft.get("brand_id") or "") != str(brand["id"]):
                errors.append("You can only overwrite a draft from the same brand.")
        count = 1
    if delivery_mode == "schedule_publish" and post_type in {"carousel", "video"} and not env_flag("LINKEDIN_DRY_RUN", True):
        errors.append("Live carousel and video publishing are not enabled yet. Save the drafts or submit them for review instead.")
    if errors:
        draft_param = target_draft_raw if overwrite_mode == "overwrite_selected" and target_draft_raw.isdigit() else ""
        return redirect(url_for("workspace_content_page", draft=draft_param, saved="error", error=" ".join(errors)))

    blueprints = _ai_blueprints_for_brand(brand=brand, workspace=workspace, brief=brief, count=count)
    base_date = None
    if post_date:
        try:
            base_date = datetime.strptime(post_date, "%Y-%m-%d").date()
        except ValueError:
            return redirect(url_for("workspace_content_page", saved="error", error="Use a valid start date for generated posts."))

    schedule_dates: list[date] = []
    schedule_times: list[str] = []
    cadence_label = _generation_plan_label(frequency, time_mode, count)
    if base_date is not None:
        schedule_dates = _schedule_dates_for_frequency(base_date=base_date, count=count, frequency=frequency)
        schedule_times = _time_slots_for_generation(start_time=post_time, count=count, time_mode=time_mode)

    created = 0
    scheduled = 0
    review_only = 0
    first_draft_id: int | None = None
    with get_conn() as conn:
        for idx, blueprint in enumerate(blueprints):
            approval_value = "draft" if delivery_mode == "save_draft" else ("submitted" if delivery_mode == "submit_review" else "approved")
            if overwrite_mode == "overwrite_selected" and target_draft is not None:
                draft_id = int(target_draft["id"])
                post_id = str(target_draft.get("post_id") or _new_customer_post_id(str(brand.get("slug") or brand.get("display_name") or "brand")))
                conn.execute(
                    """
                    UPDATE generated_posts
                    SET brand_id=?, post_type=?, topic=?, hook=?, body_points_json=?, cta=?, hashtags_json=?, caption_text=?, generation_mode='ai_assisted', approval_status=?, asset_ids_json=?, review_notes=?, prompt_brief=?, planner_label=?, last_saved_at=CURRENT_TIMESTAMP
                    WHERE id=?
                    """,
                    (
                        brand["id"],
                        post_type,
                        blueprint["topic"],
                        blueprint["hook"],
                        json.dumps(blueprint["body_points"]),
                        blueprint["cta"],
                        json.dumps(blueprint["hashtags"]),
                        blueprint["caption_text"],
                        approval_value,
                        json.dumps(selected_asset_ids),
                        f"AI-assisted draft overwritten from brand settings and brief: {brief or blueprint['label']}",
                        brief,
                        campaign or cadence_label,
                        draft_id,
                    ),
                )
                _remove_schedule_for_post(conn, post_id)
            else:
                post_id = _new_customer_post_id(str(brand.get("slug") or brand.get("display_name") or "brand"))
                conn.execute(
                    """
                    INSERT INTO generated_posts (brand_id, post_id, platform, post_type, topic, hook, body_points_json, cta, hashtags_json, caption_text, generation_mode, approval_status, asset_ids_json, review_notes, prompt_brief, planner_label, last_saved_at)
                    VALUES (?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, ?, 'ai_assisted', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        brand["id"],
                        post_id,
                        post_type,
                        blueprint["topic"],
                        blueprint["hook"],
                        json.dumps(blueprint["body_points"]),
                        blueprint["cta"],
                        json.dumps(blueprint["hashtags"]),
                        blueprint["caption_text"],
                        approval_value,
                        json.dumps(selected_asset_ids),
                        f"AI-assisted draft generated from brand settings and brief: {brief or blueprint['label']}",
                        brief,
                        campaign or cadence_label,
                    ),
                )
                draft_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
                created += 1
            if first_draft_id is None:
                first_draft_id = draft_id
            draft = fetch_workspace_generated_post(int(workspace["id"]), draft_id)
            if draft is None:
                continue
            if delivery_mode in {"submit_review", "schedule_publish"} and base_date is not None:
                scheduled_date = schedule_dates[idx].strftime("%Y-%m-%d") if idx < len(schedule_dates) else base_date.strftime("%Y-%m-%d")
                scheduled_time = schedule_times[idx] if idx < len(schedule_times) else post_time
                _sync_generated_post_to_schedule(
                    conn=conn,
                    draft=draft,
                    brand=brand,
                    asset_rows=asset_rows,
                    post_date=scheduled_date,
                    post_time=scheduled_time,
                    campaign=campaign,
                    notes=f"AI-assisted plan generated from workspace content workflow ({cadence_label}).",
                    schedule_status="drafted" if delivery_mode == "submit_review" else "approved",
                    approval_status="pending" if delivery_mode == "submit_review" else "approved",
                )
                if delivery_mode == "submit_review":
                    review_only += 1
                else:
                    scheduled += 1
        conn.commit()

    result_count = 1 if overwrite_mode == "overwrite_selected" and target_draft is not None else created
    result_verb = "Overwrote" if overwrite_mode == "overwrite_selected" and target_draft is not None else "Generated"
    record_audit_event(
        "workspace_posts_generated",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"{result_verb} {result_count} AI-assisted draft post(s) for {(brand.get('display_name') or brand.get('slug') or 'brand')}.",
        payload={"workspace_id": workspace["id"], "brand_id": brand["id"], "count": result_count, "brief": brief, "delivery_mode": delivery_mode, "action": action, "post_type": post_type, "frequency": frequency, "time_mode": time_mode, "overwrite_mode": overwrite_mode, "target_draft_id": int(target_draft_raw) if target_draft_raw.isdigit() else None},
    )
    if scheduled:
        if overwrite_mode == "overwrite_selected" and target_draft is not None:
            message = f"AI regenerated the selected draft, overwrote its existing content, and scheduled it using the {cadence_label} plan."
        else:
            message = f"Generated and scheduled {scheduled} post(s) using the {cadence_label} plan. Open the queue below to review them."
        return redirect(url_for("workspace_content_page", draft=first_draft_id, saved="scheduled", message=message))
    if review_only:
        if overwrite_mode == "overwrite_selected" and target_draft is not None:
            message = f"AI regenerated the selected draft, overwrote its existing content, and sent it for review using the {cadence_label} plan."
        else:
            message = f"Generated {review_only} AI-assisted post(s) and sent them for review using the {cadence_label} plan."
        return redirect(url_for("workspace_content_page", draft=first_draft_id, saved="submitted", message=message))
    if overwrite_mode == "overwrite_selected" and target_draft is not None:
        message = "AI regenerated the selected draft and overwrote its existing content. Review and refine it below."
    else:
        message = f"Generated {created} AI-assisted draft post(s) using the {cadence_label} plan. Open a draft below and overwrite any copy you want to change."
    return redirect(url_for("workspace_content_page", draft=first_draft_id, saved="generated", message=message))


@app.post("/workspace/content/templates/save")
@customer_login_required
def workspace_content_template_save():
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    name = (request.form.get("template_name") or request.form.get("name") or "").strip() or "Untitled template"
    brand_id_raw = (request.form.get("brand_id") or "").strip()
    brand_id = int(brand_id_raw) if brand_id_raw.isdigit() else None
    default_count_raw = (request.form.get("count") or "7").strip()
    try:
        default_count = int(default_count_raw)
    except ValueError:
        default_count = 7
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO campaign_templates (workspace_id, brand_id, name, objective, prompt_brief, post_type, cadence, time_mode, default_count, campaign_label, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                workspace["id"],
                brand_id,
                name,
                (request.form.get("objective") or request.form.get("brief") or "").strip(),
                (request.form.get("brief") or "").strip(),
                (request.form.get("post_type") or "text").strip(),
                (request.form.get("frequency") or "daily_week").strip(),
                (request.form.get("time_mode") or "same_time").strip(),
                default_count,
                (request.form.get("campaign") or "").strip(),
                int(customer["id"]),
            ),
        )
        conn.commit()
    return redirect(url_for("workspace_content_page", saved="generated", message="Campaign template saved."))


@app.post("/workspace/content/strategies/save")
@customer_login_required
def workspace_content_strategy_save():
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    name = (request.form.get("strategy_name") or request.form.get("name") or request.form.get("campaign") or "").strip() or "Untitled strategy"
    keywords = [item.strip() for item in (request.form.get("keywords_text") or request.form.get("brief") or "").replace(";", ",").split(",") if item.strip()]
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO posting_strategies (workspace_id, name, summary, cadence, time_mode, best_time_hint, focus_keywords_json, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                workspace["id"],
                name,
                (request.form.get("summary") or request.form.get("brief") or "").strip(),
                (request.form.get("frequency") or "daily_week").strip(),
                (request.form.get("time_mode") or "same_time").strip(),
                (request.form.get("post_time") or "09:00").strip(),
                json.dumps(keywords),
                int(customer["id"]),
            ),
        )
        conn.commit()
    return redirect(url_for("workspace_content_page", saved="generated", message="Posting strategy saved."))


@app.post("/workspace/content/<int:draft_id>/feedback")
@customer_login_required
def workspace_content_feedback_add(draft_id: int):
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    draft = fetch_workspace_generated_post(int(workspace["id"]), draft_id)
    if draft is None:
        abort(404)
    feedback_type = (request.form.get("feedback_type") or "comment").strip().lower()
    if feedback_type not in {"comment", "change_request", "approval_comment"}:
        feedback_type = "comment"
    comment_text = (request.form.get("comment_text") or "").strip()
    if not comment_text:
        return redirect(url_for("workspace_content_page", draft=draft_id, saved="error", error="Add a comment before posting feedback."))
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO content_feedback (generated_post_id, workspace_id, author_user_id, feedback_type, comment_text) VALUES (?, ?, ?, ?, ?)",
            (draft_id, workspace["id"], int(customer["id"]), feedback_type, comment_text),
        )
        if feedback_type == "change_request":
            conn.execute("UPDATE generated_posts SET approval_status='changes_requested' WHERE id=?", (draft_id,))
        conn.commit()
    return redirect(url_for("workspace_content_page", draft=draft_id, saved="draft_saved", message="Feedback added to the draft history."))


@app.post("/workspace/content/bulk-regenerate")
@customer_login_required
def workspace_content_bulk_regenerate():
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    draft_ids = [int(item) for item in request.form.getlist("draft_ids") if str(item).isdigit()]
    if not draft_ids:
        return redirect(url_for("workspace_content_page", saved="error", error="Select at least one draft to regenerate."))
    created = 0
    first_new = None
    with get_conn() as conn:
        for draft_id in draft_ids[:12]:
            row = fetch_workspace_generated_post(int(workspace["id"]), draft_id)
            if row is None:
                continue
            brand = fetch_workspace_brand_by_id(int(workspace["id"]), int(row["brand_id"]))
            if brand is None:
                continue
            variant = _ai_blueprints_for_brand(brand=dict(brand), workspace=workspace, brief=str(row.get("prompt_brief") or row.get("topic") or ""), count=1)[0]
            post_id = _new_customer_post_id(str(row.get("brand_slug") or row.get("brand_name") or "brand"))
            conn.execute(
                "INSERT INTO generated_posts (brand_id, post_id, platform, post_type, topic, hook, body_points_json, cta, hashtags_json, caption_text, generation_mode, approval_status, asset_ids_json, review_notes, prompt_brief, planner_label, last_saved_at) VALUES (?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, ?, 'ai_regenerated', 'draft', ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                (
                    row["brand_id"],
                    post_id,
                    row.get("post_type") or "text",
                    row.get("topic") or variant["topic"],
                    f"Another angle: {variant['hook']}",
                    json.dumps(variant["body_points"]),
                    row.get("cta") or variant["cta"],
                    row.get("hashtags_json") or json.dumps(variant["hashtags"]),
                    variant["caption_text"],
                    row.get("asset_ids_json") or '[]',
                    f"Regenerated from draft {draft_id}",
                    row.get("prompt_brief") or row.get("topic") or "",
                    row.get("planner_label") or row.get("schedule_campaign") or "",
                ),
            )
            new_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
            if first_new is None:
                first_new = new_id
            created += 1
        conn.commit()
    record_audit_event("workspace_drafts_regenerated", actor=(customer.get("email") or "workspace_admin"), message=f"Regenerated {created} draft(s).", payload={"workspace_id": workspace["id"], "source_draft_ids": draft_ids})
    return redirect(url_for("workspace_content_page", draft=first_new, saved="generated", message=f"Created {created} regenerated draft variant(s)."))


@app.post("/workspace/content/bulk-reschedule")
@customer_login_required
def workspace_content_bulk_reschedule():
    if not current_customer_can_manage_content():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    draft_ids = [int(item) for item in request.form.getlist("draft_ids") if str(item).isdigit()]
    if not draft_ids:
        return redirect(url_for("workspace_content_page", saved="error", error="Select at least one draft to reschedule."))
    start_date_raw = (request.form.get("post_date") or "").strip()
    start_time = (request.form.get("post_time") or "09:00").strip() or "09:00"
    frequency = (request.form.get("frequency") or "daily_week").strip().lower()
    time_mode = (request.form.get("time_mode") or "same_time").strip().lower()
    try:
        base_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
    except Exception:
        return redirect(url_for("workspace_content_page", saved="error", error="Use a valid start date when rescheduling posts."))
    dates = _schedule_dates_for_frequency(base_date=base_date, count=len(draft_ids), frequency=frequency)
    times = _time_slots_for_generation(start_time=start_time, count=len(draft_ids), time_mode=time_mode)
    updated = 0
    with get_conn() as conn:
        for index, draft_id in enumerate(draft_ids):
            draft = fetch_workspace_generated_post(int(workspace["id"]), draft_id)
            if draft is None:
                continue
            brand = fetch_workspace_brand_by_id(int(workspace["id"]), int(draft["brand_id"]))
            if brand is None:
                continue
            asset_rows = _workspace_asset_rows_for_ids(int(workspace["id"]), int(brand["id"]), draft.get("selected_asset_ids") or [])
            _sync_generated_post_to_schedule(
                conn=conn,
                draft=draft,
                brand=dict(brand),
                asset_rows=asset_rows,
                post_date=dates[index].strftime("%Y-%m-%d"),
                post_time=times[index],
                campaign=str(draft.get("schedule_campaign") or draft.get("planner_label") or ""),
                notes=str(draft.get("schedule_notes") or "Bulk rescheduled from content workspace."),
                schedule_status="approved" if draft.get("approval_status") == "approved" else "drafted",
                approval_status="approved" if draft.get("approval_status") == "approved" else "pending",
            )
            updated += 1
        conn.commit()
    record_audit_event("workspace_posts_bulk_rescheduled", actor=(customer.get("email") or "workspace_admin"), message=f"Bulk rescheduled {updated} post(s).", payload={"workspace_id": workspace["id"], "draft_ids": draft_ids, "frequency": frequency, "time_mode": time_mode})
    return redirect(url_for("workspace_content_page", saved="scheduled", message=f"Bulk rescheduled {updated} post(s)."))




def _parse_json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    raw = (value or "").strip() if isinstance(value, str) else value
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def workspace_engagement_summary(workspace_id: int) -> dict[str, Any]:
    comments = fetch_rows(
        """
        SELECT c.*, b.display_name AS brand_name
        FROM engagement_comments c
        LEFT JOIN brands b ON b.id = c.brand_id
        WHERE c.workspace_id=?
        ORDER BY
          CASE c.intent_label WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 WHEN 'nurture' THEN 2 ELSE 3 END,
          c.created_at DESC,
          c.id DESC
        """,
        (workspace_id,),
    )
    leads = fetch_rows(
        """
        SELECT l.*, c.commenter_name, c.comment_text, b.display_name AS brand_name
        FROM lead_pipeline l
        LEFT JOIN engagement_comments c ON c.id = l.comment_id
        LEFT JOIN brands b ON b.id = l.brand_id
        WHERE l.workspace_id=?
        ORDER BY
          CASE l.stage WHEN 'qualified' THEN 0 WHEN 'contacted' THEN 1 WHEN 'new' THEN 2 WHEN 'nurture' THEN 3 ELSE 4 END,
          l.intent_score DESC,
          l.updated_at DESC,
          l.id DESC
        """,
        (workspace_id,),
    )
    rules = fetch_rows(
        "SELECT * FROM engagement_rules WHERE workspace_id=? ORDER BY id ASC",
        (workspace_id,),
    )
    comments_total = len(comments)
    pending_replies = sum(1 for item in comments if (item.get('reply_status') or '').lower() != 'sent')
    hot_leads = sum(1 for item in leads if (item.get('stage') or '').lower() in {'new', 'contacted', 'qualified'} and int(item.get('intent_score') or 0) >= 70)
    reply_ready = []
    for item in comments:
        options = _parse_json_list(item.get('reply_options_json'))
        if options:
            enriched = dict(item)
            enriched['reply_options'] = options
            reply_ready.append(enriched)
    return {
        'comments': comments,
        'leads': leads,
        'rules': rules,
        'metrics': {
            'comments_total': comments_total,
            'pending_replies': pending_replies,
            'hot_leads': hot_leads,
            'active_rules': sum(1 for item in rules if int(item.get('is_enabled') or 0) == 1),
        },
        'reply_ready': reply_ready[:8],
    }


def _utcnow_z() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _first_name(value: str) -> str:
    cleaned = (value or '').strip()
    return cleaned.split()[0] if cleaned else 'there'


def ensure_workspace_engagement_setup(workspace_id: int) -> None:
    existing = fetch_rows("SELECT id FROM engagement_integrations WHERE workspace_id=? LIMIT 1", (workspace_id,))
    if existing:
        return
    now = _utcnow_z()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO engagement_integrations (workspace_id, platform, connection_label, status, sync_mode, auto_reply_enabled, auto_dm_enabled, moderation_level, last_synced_at, metadata_json, created_at, updated_at)
            VALUES (?, 'linkedin', 'Primary founder account', 'demo_ready', 'manual_review', 0, 0, 'balanced', ?, ?, ?, ?)
            """,
            (workspace_id, now, json.dumps({'source': 'seed', 'webhook_ready': True, 'dm_assist_ready': True}), now, now),
        )
        conn.commit()


def _score_comment_intent(comment_text: str) -> tuple[str, int, str]:
    text = (comment_text or '').strip().lower()
    if not text:
        return 'cold', 10, 'neutral'
    hot_tokens = ['price', 'pricing', 'demo', 'interested', 'dm me', 'send details', 'how much', 'book', 'trial']
    warm_tokens = ['workflow', 'tool', 'stack', 'reviewing', 'quarter', 'curious', 'plug into', 'team']
    spam_tokens = ['promo', 'bitcoin', 'agency for you', 'guaranteed followers']
    hot_hits = sum(1 for token in hot_tokens if token in text)
    warm_hits = sum(1 for token in warm_tokens if token in text)
    spam_hits = sum(1 for token in spam_tokens if token in text)
    sentiment = 'positive' if any(token in text for token in ['love', 'great', 'useful', 'exactly', 'interested']) else 'neutral'
    if spam_hits:
        return 'cold', 5, 'spam'
    if hot_hits:
        return 'hot', min(96, 74 + hot_hits * 8 + warm_hits * 2), sentiment
    if warm_hits:
        return 'warm', min(72, 46 + warm_hits * 7), sentiment
    return 'nurture', 34 if '?' in text else 22, sentiment


def _generate_reply_options_with_ai(*, commenter_name: str, comment_text: str, brand_name: str, tone: str, primary_cta: str) -> list[str]:
    if not OPENAI_API_KEY:
        return []
    payload = {
        'model': 'gpt-4.1-mini',
        'input': [
            {
                'role': 'system',
                'content': [
                    {'type': 'input_text', 'text': 'You write concise, professional social media replies for SaaS founders. Return JSON with key options containing exactly 3 safe reply strings under 220 characters each.'}
                ],
            },
            {
                'role': 'user',
                'content': [
                    {'type': 'input_text', 'text': f'Brand: {brand_name}\nTone: {tone or "clear and helpful"}\nPrimary CTA: {primary_cta or "book a demo"}\nCommenter: {commenter_name}\nComment: {comment_text}'}
                ],
            },
        ],
        'text': {'format': {'type': 'json_schema', 'name': 'reply_options', 'schema': {'type': 'object', 'properties': {'options': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 3}}, 'required': ['options'], 'additionalProperties': False}}},
    }
    try:
        response = requests.post(
            'https://api.openai.com/v1/responses',
            headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
            data=json.dumps(payload),
            timeout=12,
        )
        response.raise_for_status()
        data = response.json()
        raw_text = data.get('output_text') or ''
        parsed = json.loads(raw_text) if raw_text else {}
        options = parsed.get('options') if isinstance(parsed, dict) else []
        return [str(item).strip() for item in options if str(item).strip()][:3]
    except Exception:
        return []


def _build_reply_options(*, commenter_name: str, comment_text: str, brand_name: str, tone: str, primary_cta: str, intent_label: str) -> list[str]:
    ai_options = _generate_reply_options_with_ai(
        commenter_name=commenter_name,
        comment_text=comment_text,
        brand_name=brand_name,
        tone=tone,
        primary_cta=primary_cta,
    )
    if ai_options:
        return ai_options
    first_name = _first_name(commenter_name)
    cta = primary_cta or 'book a demo'
    if intent_label == 'hot':
        return [
            f"Thanks {first_name} — yes, I can send details and pricing. If useful, the fastest next step is to {cta.lower()}.",
            f"Appreciate it {first_name}. Happy to send the short version with workflow, pricing bands, and what setup looks like.",
            f"Absolutely — I can outline how {brand_name} handles content, engagement, and lead routing without adding more admin overhead.",
        ]
    if intent_label == 'warm':
        return [
            f"Thanks {first_name} — good question. {brand_name} is designed to help content teams and founders keep publishing and follow-up in one place.",
            f"Appreciate it {first_name}. We can share the workflow we use and where the engagement inbox fits if that helps.",
            f"Helpful prompt, thanks. We usually recommend starting with reply assist first, then adding lead routing once the team is ready.",
        ]
    return [
        f"Thanks {first_name} — appreciate you reading. Happy to keep sharing what is working for {brand_name}.",
        f"Appreciate it {first_name}. We are building this to keep content and follow-up cleaner for lean teams.",
        f"Thanks {first_name}. We will keep posting more of the operator playbook behind this workflow.",
    ]


def _build_dm_draft(*, commenter_name: str, source_post_title: str, brand_name: str, intent_label: str) -> str:
    first_name = _first_name(commenter_name)
    if intent_label == 'hot':
        return f"Hi {first_name}, thanks for commenting on our post about {source_post_title}. I can send a concise overview of the {brand_name} workflow, pricing, and what rollout usually looks like. Want the quick summary or a demo outline?"
    if intent_label == 'warm':
        return f"Hi {first_name}, thanks for the comment on {source_post_title}. Sharing a quick note in case it helps: we usually start teams on reply assist and lead scoring, then layer in DM follow-up once the workflow is stable."
    return f"Hi {first_name}, thanks again for engaging with our post on {source_post_title}. Happy to send over more examples when useful."


def _log_lead_activity(conn: sqlite3.Connection, *, workspace_id: int, lead_id: int, comment_id: int | None, activity_type: str, activity_text: str, created_by_user_id: int | None = None) -> None:
    conn.execute(
        """
        INSERT INTO lead_activity (workspace_id, lead_id, comment_id, activity_type, activity_text, created_by_user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (workspace_id, lead_id, comment_id, activity_type, activity_text, created_by_user_id, _utcnow_z()),
    )


def ensure_workspace_growth_seed_data(workspace_id: int) -> None:
    ensure_workspace_engagement_setup(workspace_id)
    existing = fetch_rows("SELECT id FROM engagement_comments WHERE workspace_id=? LIMIT 1", (workspace_id,))
    if existing:
        return
    brands = fetch_rows("SELECT id, display_name, primary_cta, tone FROM brands WHERE workspace_id=? ORDER BY id ASC", (workspace_id,))
    if not brands:
        return
    now = _utcnow_z()
    sample_comments = [
        {
            'commenter_name': 'Olivia Grant',
            'commenter_handle': '@oliviagrantops',
            'platform': 'linkedin',
            'source_post_title': 'Operational content workflows for founders',
            'comment_text': 'This is exactly what we need. How much is it and can you send details?',
            'lead_stage': 'new',
            'dm_status': 'ready',
        },
        {
            'commenter_name': 'Marcus Bell',
            'commenter_handle': '@marcusbell',
            'platform': 'linkedin',
            'source_post_title': 'How to repurpose a single founder post',
            'comment_text': 'Interested. Happy for you to DM me the workflow you use.',
            'lead_stage': 'contacted',
            'dm_status': 'drafted',
        },
        {
            'commenter_name': 'Priya Shah',
            'commenter_handle': '@priyashahgrowth',
            'platform': 'linkedin',
            'source_post_title': 'AI assisted content ops stack',
            'comment_text': 'Love this. We are reviewing tools next quarter so keep me posted.',
            'lead_stage': 'nurture',
            'dm_status': 'not_started',
        },
        {
            'commenter_name': 'Dan Morris',
            'commenter_handle': '@danmorrisrevops',
            'platform': 'linkedin',
            'source_post_title': 'From comments to pipeline',
            'comment_text': 'Can this plug into our outbound workflow or is it only for content teams?',
            'lead_stage': 'new',
            'dm_status': 'ready',
        },
    ]
    with get_conn() as conn:
        for index, comment in enumerate(sample_comments):
            brand = brands[index % len(brands)]
            intent_label, intent_score, sentiment = _score_comment_intent(comment['comment_text'])
            reply_options = _build_reply_options(
                commenter_name=comment['commenter_name'],
                comment_text=comment['comment_text'],
                brand_name=str(brand['display_name']),
                tone=str(brand.get('tone') or 'clear and commercial'),
                primary_cta=str(brand.get('primary_cta') or 'Book a demo'),
                intent_label=intent_label,
            )
            dm_draft = _build_dm_draft(
                commenter_name=comment['commenter_name'],
                source_post_title=comment['source_post_title'],
                brand_name=str(brand['display_name']),
                intent_label=intent_label,
            )
            conn.execute(
                """
                INSERT INTO engagement_comments (workspace_id, brand_id, platform, commenter_name, commenter_handle, source_post_title, comment_text, sentiment, intent_label, intent_score, reply_options_json, suggested_dm_text, reply_status, dm_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?, ?)
                """,
                (
                    workspace_id, int(brand['id']), comment['platform'], comment['commenter_name'], comment['commenter_handle'],
                    comment['source_post_title'], comment['comment_text'], sentiment, intent_label, intent_score, json.dumps(reply_options), dm_draft,
                    comment['dm_status'], now, now,
                ),
            )
            comment_id = int(conn.execute('SELECT last_insert_rowid()').fetchone()[0])
            conn.execute(
                """
                INSERT INTO lead_pipeline (workspace_id, brand_id, comment_id, lead_name, lead_handle, stage, intent_score, owner_name, next_action, last_contact_at, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    workspace_id, int(brand['id']), comment_id, comment['commenter_name'], comment['commenter_handle'], comment['lead_stage'], intent_score,
                    'Founder queue', 'Review reply and send DM', now if comment['lead_stage'] == 'contacted' else '', 'Seeded demo lead for the engagement workspace.', now, now,
                ),
            )
            lead_id = int(conn.execute('SELECT last_insert_rowid()').fetchone()[0])
            _log_lead_activity(conn, workspace_id=workspace_id, lead_id=lead_id, comment_id=comment_id, activity_type='system', activity_text='Lead created from engagement signal.')
        conn.execute(
            """
            INSERT INTO engagement_rules (workspace_id, rule_name, rule_type, trigger_condition, action_summary, approval_mode, is_enabled, created_at, updated_at)
            VALUES
            (?, 'High-intent comment routing', 'lead_scoring', 'intent_score >= 80 OR comment contains price, demo, interested, DM me', 'Route to hot lead queue and prepare DM draft', 'approval_required', 1, ?, ?),
            (?, 'Warm comment nurture', 'reply_assist', 'intent_score between 50 and 79', 'Generate three reply options and schedule follow-up reminder', 'approval_required', 1, ?, ?),
            (?, 'Low-value comment filter', 'moderation', 'sentiment = spam OR intent_score < 20', 'Hide from lead inbox and mark as filtered', 'automatic', 1, ?, ?)
            """,
            (workspace_id, now, now, workspace_id, now, now, workspace_id, now, now),
        )
        conn.commit()


def sync_workspace_demo_engagement(workspace_id: int) -> int:
    ensure_workspace_growth_seed_data(workspace_id)
    brands = fetch_rows("SELECT id, display_name, primary_cta, tone FROM brands WHERE workspace_id=? ORDER BY id ASC", (workspace_id,))
    if not brands:
        return 0
    today_key = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    existing = fetch_rows("SELECT id FROM engagement_comments WHERE workspace_id=? AND source_post_title LIKE ?", (workspace_id, f'%{today_key}%'))
    if existing:
        with get_conn() as conn:
            conn.execute("UPDATE engagement_integrations SET last_synced_at=?, updated_at=? WHERE workspace_id=?", (_utcnow_z(), _utcnow_z(), workspace_id))
            conn.commit()
        return 0
    inbound = [
        ('Ava Collins', '@avacollins', f'Founder pipeline ideas {today_key}', 'Curious how this handles approval before any reply goes out.'),
        ('Noah Reed', '@noahreedgrowth', f'Lead capture workflow {today_key}', 'This looks useful. Do you support agencies managing multiple brands?'),
    ]
    inserted = 0
    with get_conn() as conn:
        for index, (name, handle, title, text_value) in enumerate(inbound):
            brand = brands[index % len(brands)]
            intent_label, intent_score, sentiment = _score_comment_intent(text_value)
            reply_options = _build_reply_options(
                commenter_name=name,
                comment_text=text_value,
                brand_name=str(brand['display_name']),
                tone=str(brand.get('tone') or 'clear and commercial'),
                primary_cta=str(brand.get('primary_cta') or 'Book a demo'),
                intent_label=intent_label,
            )
            dm_draft = _build_dm_draft(commenter_name=name, source_post_title=title, brand_name=str(brand['display_name']), intent_label=intent_label)
            now = _utcnow_z()
            conn.execute(
                """
                INSERT INTO engagement_comments (workspace_id, brand_id, platform, commenter_name, commenter_handle, source_post_title, comment_text, sentiment, intent_label, intent_score, reply_options_json, suggested_dm_text, reply_status, dm_status, created_at, updated_at)
                VALUES (?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', 'ready', ?, ?)
                """,
                (workspace_id, int(brand['id']), name, handle, title, text_value, sentiment, intent_label, intent_score, json.dumps(reply_options), dm_draft, now, now),
            )
            comment_id = int(conn.execute('SELECT last_insert_rowid()').fetchone()[0])
            conn.execute(
                """
                INSERT INTO lead_pipeline (workspace_id, brand_id, comment_id, lead_name, lead_handle, stage, intent_score, owner_name, next_action, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Founder queue', 'Review fresh comment and approve best reply', 'Synced from engagement connector.', ?, ?)
                """,
                (workspace_id, int(brand['id']), comment_id, name, handle, 'new' if intent_score >= 55 else 'nurture', intent_score, now, now),
            )
            lead_id = int(conn.execute('SELECT last_insert_rowid()').fetchone()[0])
            _log_lead_activity(conn, workspace_id=workspace_id, lead_id=lead_id, comment_id=comment_id, activity_type='sync', activity_text='Imported from engagement sync.')
            inserted += 1
        conn.execute("UPDATE engagement_integrations SET status='connected', last_synced_at=?, updated_at=? WHERE workspace_id=?", (_utcnow_z(), _utcnow_z(), workspace_id))
        conn.commit()
    return inserted


def workspace_engagement_summary(workspace_id: int) -> dict[str, Any]:
    comments = fetch_rows(
        """
        SELECT c.*, b.display_name AS brand_name
        FROM engagement_comments c
        LEFT JOIN brands b ON b.id = c.brand_id
        WHERE c.workspace_id=?
        ORDER BY
          CASE c.intent_label WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 WHEN 'nurture' THEN 2 ELSE 3 END,
          c.created_at DESC,
          c.id DESC
        """,
        (workspace_id,),
    )
    leads = fetch_rows(
        """
        SELECT l.*, c.commenter_name, c.comment_text, c.suggested_dm_text, c.reply_status, b.display_name AS brand_name
        FROM lead_pipeline l
        LEFT JOIN engagement_comments c ON c.id = l.comment_id
        LEFT JOIN brands b ON b.id = l.brand_id
        WHERE l.workspace_id=?
        ORDER BY
          CASE l.stage WHEN 'qualified' THEN 0 WHEN 'contacted' THEN 1 WHEN 'new' THEN 2 WHEN 'nurture' THEN 3 ELSE 4 END,
          l.intent_score DESC,
          l.updated_at DESC,
          l.id DESC
        """,
        (workspace_id,),
    )
    rules = fetch_rows("SELECT * FROM engagement_rules WHERE workspace_id=? ORDER BY id ASC", (workspace_id,))
    integrations = fetch_rows("SELECT * FROM engagement_integrations WHERE workspace_id=? ORDER BY id ASC", (workspace_id,))
    recent_activity = fetch_rows(
        """
        SELECT a.*, l.lead_name
        FROM lead_activity a
        LEFT JOIN lead_pipeline l ON l.id = a.lead_id
        WHERE a.workspace_id=?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 8
        """,
        (workspace_id,),
    )
    comments_total = len(comments)
    pending_replies = sum(1 for item in comments if (item.get('reply_status') or '').lower() != 'sent')
    hot_leads = sum(1 for item in leads if (item.get('stage') or '').lower() in {'new', 'contacted', 'qualified'} and int(item.get('intent_score') or 0) >= 70)
    qualified_leads = sum(1 for item in leads if (item.get('stage') or '').lower() == 'qualified')
    reply_ready = []
    for item in comments:
        options = _parse_json_list(item.get('reply_options_json'))
        enriched = dict(item)
        enriched['reply_options'] = options
        reply_ready.append(enriched)
    return {
        'comments': comments,
        'leads': leads,
        'rules': rules,
        'integrations': integrations,
        'recent_activity': recent_activity,
        'metrics': {
            'comments_total': comments_total,
            'pending_replies': pending_replies,
            'hot_leads': hot_leads,
            'qualified_leads': qualified_leads,
            'active_rules': sum(1 for item in rules if int(item.get('is_enabled') or 0) == 1),
            'connected_channels': sum(1 for item in integrations if (item.get('status') or '').lower() in {'connected', 'demo_ready'}),
        },
        'reply_ready': reply_ready[:8],
    }


def fetch_workspace_lead_detail(workspace_id: int, lead_id: int) -> dict[str, Any] | None:
    rows = fetch_rows(
        """
        SELECT l.*, c.comment_text, c.commenter_name, c.commenter_handle, c.source_post_title, c.selected_reply_text, c.suggested_dm_text, c.reply_status, c.dm_status, b.display_name AS brand_name
        FROM lead_pipeline l
        LEFT JOIN engagement_comments c ON c.id = l.comment_id
        LEFT JOIN brands b ON b.id = l.brand_id
        WHERE l.workspace_id=? AND l.id=?
        LIMIT 1
        """,
        (workspace_id, lead_id),
    )
    return rows[0] if rows else None


@app.get("/workspace/engagement")
@customer_login_required
def workspace_engagement():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    ensure_workspace_growth_seed_data(int(workspace['id']))
    summary = workspace_engagement_summary(int(workspace['id']))
    filter_value = (request.args.get('filter') or '').strip().lower()
    comments = summary['comments']
    if filter_value in {'hot', 'warm', 'nurture', 'cold'}:
        comments = [item for item in comments if (item.get('intent_label') or '').lower() == filter_value]
    return render_template(
        'customer/engagement.html',
        workspace=workspace,
        summary=summary,
        comments=comments,
        metrics=summary['metrics'],
        active_filter=filter_value,
        integrations=summary['integrations'],
        recent_activity=summary['recent_activity'],
        saved=(request.args.get('saved') or '').strip(),
        message=(request.args.get('message') or '').strip(),
    )


@app.post("/workspace/engagement/sync")
@customer_login_required
def workspace_engagement_sync():
    workspace = current_workspace()
    if workspace is None:
        abort(404)
    inserted = sync_workspace_demo_engagement(int(workspace['id']))
    message = f'Synced {inserted} new engagement item(s).' if inserted else 'Sync completed. No new engagement items were found.'
    return redirect(url_for('workspace_engagement', saved='synced', message=message))


@app.post("/workspace/engagement/<int:comment_id>/generate")
@customer_login_required
def workspace_generate_engagement_reply(comment_id: int):
    workspace = current_workspace()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT c.*, b.display_name AS brand_name, b.tone, b.primary_cta
            FROM engagement_comments c
            LEFT JOIN brands b ON b.id = c.brand_id
            WHERE c.id=? AND c.workspace_id=?
            """,
            (comment_id, int(workspace['id'])),
        ).fetchone()
        if row is None:
            abort(404)
        item = dict(row)
        options = _build_reply_options(
            commenter_name=str(item.get('commenter_name') or ''),
            comment_text=str(item.get('comment_text') or ''),
            brand_name=str(item.get('brand_name') or workspace.get('display_name') or 'Repurly'),
            tone=str(item.get('tone') or 'clear and commercial'),
            primary_cta=str(item.get('primary_cta') or 'Book a demo'),
            intent_label=str(item.get('intent_label') or 'warm'),
        )
        dm_draft = _build_dm_draft(
            commenter_name=str(item.get('commenter_name') or ''),
            source_post_title=str(item.get('source_post_title') or 'your recent post'),
            brand_name=str(item.get('brand_name') or workspace.get('display_name') or 'Repurly'),
            intent_label=str(item.get('intent_label') or 'warm'),
        )
        conn.execute("UPDATE engagement_comments SET reply_options_json=?, suggested_dm_text=?, reply_status='suggested', updated_at=? WHERE id=?", (json.dumps(options), dm_draft, _utcnow_z(), comment_id))
        conn.commit()
    return redirect(url_for('workspace_engagement', saved='generated'))


@app.post("/workspace/engagement/<int:comment_id>/reply")
@customer_login_required
def workspace_send_engagement_reply(comment_id: int):
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    reply_text = (request.form.get('reply_text') or '').strip()
    if not reply_text:
        return redirect(url_for('workspace_engagement', saved='error'))
    with get_conn() as conn:
        comment = conn.execute('SELECT * FROM engagement_comments WHERE id=? AND workspace_id=?', (comment_id, int(workspace['id']))).fetchone()
        if comment is None:
            abort(404)
        now = _utcnow_z()
        conn.execute(
            "INSERT INTO engagement_reply_drafts (comment_id, workspace_id, reply_text, status, approved_by_user_id, approved_at, created_at) VALUES (?, ?, ?, 'sent', ?, ?, ?)",
            (comment_id, int(workspace['id']), reply_text, int(customer['id']), now, now),
        )
        conn.execute(
            "UPDATE engagement_comments SET selected_reply_text=?, reply_status='sent', updated_at=? WHERE id=?",
            (reply_text, now, comment_id),
        )
        lead_row = conn.execute("SELECT id, stage FROM lead_pipeline WHERE comment_id=? AND workspace_id=?", (comment_id, int(workspace['id']))).fetchone()
        if lead_row is not None:
            conn.execute(
                "UPDATE lead_pipeline SET stage=CASE WHEN stage='new' THEN 'contacted' ELSE stage END, next_action='Monitor reply and send DM', updated_at=? WHERE comment_id=? AND workspace_id=?",
                (now, comment_id, int(workspace['id'])),
            )
            _log_lead_activity(conn, workspace_id=int(workspace['id']), lead_id=int(lead_row['id']), comment_id=comment_id, activity_type='reply_sent', activity_text='Approved reply and marked as sent.', created_by_user_id=int(customer['id']))
        conn.commit()
    record_audit_event('engagement_reply_sent', actor=(customer.get('email') or 'workspace_user'), message='Marked engagement reply as sent.', payload={'workspace_id': workspace['id'], 'comment_id': comment_id})
    return redirect(url_for('workspace_engagement', saved='reply_sent'))


@app.post("/workspace/engagement/<int:comment_id>/dm")
@customer_login_required
def workspace_send_engagement_dm(comment_id: int):
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    dm_text = (request.form.get('dm_text') or '').strip()
    if not dm_text:
        return redirect(url_for('workspace_engagement', saved='error'))
    with get_conn() as conn:
        comment = conn.execute('SELECT * FROM engagement_comments WHERE id=? AND workspace_id=?', (comment_id, int(workspace['id']))).fetchone()
        if comment is None:
            abort(404)
        now = _utcnow_z()
        conn.execute("UPDATE engagement_comments SET suggested_dm_text=?, dm_status='drafted', updated_at=? WHERE id=?", (dm_text, now, comment_id))
        lead_row = conn.execute("SELECT id FROM lead_pipeline WHERE comment_id=? AND workspace_id=?", (comment_id, int(workspace['id']))).fetchone()
        if lead_row is not None:
            conn.execute("UPDATE lead_pipeline SET stage=CASE WHEN stage='new' THEN 'contacted' ELSE stage END, next_action='Send DM and track response', last_contact_at=?, updated_at=? WHERE id=?", (now, now, int(lead_row['id'])))
            _log_lead_activity(conn, workspace_id=int(workspace['id']), lead_id=int(lead_row['id']), comment_id=comment_id, activity_type='dm_drafted', activity_text='Prepared DM follow-up draft.', created_by_user_id=int(customer['id']))
        conn.commit()
    return redirect(url_for('workspace_engagement', saved='dm_ready'))


@app.get("/workspace/leads")
@customer_login_required
def workspace_leads():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    ensure_workspace_growth_seed_data(int(workspace['id']))
    summary = workspace_engagement_summary(int(workspace['id']))
    stage = (request.args.get('stage') or '').strip().lower()
    leads = summary['leads']
    if stage:
        leads = [item for item in leads if (item.get('stage') or '').lower() == stage]
    return render_template('customer/leads.html', workspace=workspace, leads=leads, metrics=summary['metrics'], active_stage=stage, saved=(request.args.get('saved') or '').strip())


@app.get("/workspace/leads/<int:lead_id>")
@customer_login_required
def workspace_lead_detail(lead_id: int):
    workspace = current_workspace()
    if workspace is None:
        abort(404)
    ensure_workspace_growth_seed_data(int(workspace['id']))
    lead = fetch_workspace_lead_detail(int(workspace['id']), lead_id)
    if lead is None:
        abort(404)
    activity = fetch_rows("SELECT * FROM lead_activity WHERE workspace_id=? AND lead_id=? ORDER BY created_at DESC, id DESC", (int(workspace['id']), lead_id))
    return render_template('customer/lead_detail.html', workspace=workspace, lead=lead, activity=activity, saved=(request.args.get('saved') or '').strip())


@app.post("/workspace/leads/<int:lead_id>/stage")
@customer_login_required
def workspace_lead_stage(lead_id: int):
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    stage = (request.form.get('stage') or 'new').strip().lower()
    if stage not in {'new', 'contacted', 'qualified', 'nurture', 'closed'}:
        stage = 'new'
    now = _utcnow_z()
    with get_conn() as conn:
        lead = conn.execute("SELECT id, comment_id FROM lead_pipeline WHERE id=? AND workspace_id=?", (lead_id, int(workspace['id']))).fetchone()
        if lead is None:
            abort(404)
        conn.execute(
            "UPDATE lead_pipeline SET stage=?, updated_at=?, next_action=? WHERE id=? AND workspace_id=?",
            (stage, now, 'Review conversation history' if stage in {'contacted', 'qualified'} else 'Await next signal', lead_id, int(workspace['id'])),
        )
        _log_lead_activity(conn, workspace_id=int(workspace['id']), lead_id=lead_id, comment_id=int(lead['comment_id']) if lead['comment_id'] else None, activity_type='stage_change', activity_text=f'Lead stage updated to {stage}.', created_by_user_id=int(customer['id']))
        conn.commit()
    record_audit_event('lead_stage_updated', actor=(customer.get('email') or 'workspace_user'), message=f'Updated lead stage to {stage}.', payload={'workspace_id': workspace['id'], 'lead_id': lead_id})
    return redirect(url_for('workspace_leads', saved='updated'))


@app.post("/workspace/leads/<int:lead_id>/note")
@customer_login_required
def workspace_lead_note(lead_id: int):
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    note_text = (request.form.get('note_text') or '').strip()
    if not note_text:
        return redirect(url_for('workspace_lead_detail', lead_id=lead_id, saved='error'))
    with get_conn() as conn:
        lead = conn.execute("SELECT id, comment_id FROM lead_pipeline WHERE id=? AND workspace_id=?", (lead_id, int(workspace['id']))).fetchone()
        if lead is None:
            abort(404)
        conn.execute("UPDATE lead_pipeline SET notes=?, updated_at=? WHERE id=?", (note_text, _utcnow_z(), lead_id))
        _log_lead_activity(conn, workspace_id=int(workspace['id']), lead_id=lead_id, comment_id=int(lead['comment_id']) if lead['comment_id'] else None, activity_type='note', activity_text=note_text, created_by_user_id=int(customer['id']))
        conn.commit()
    return redirect(url_for('workspace_lead_detail', lead_id=lead_id, saved='noted'))


@app.get("/workspace/automation-rules")
@customer_login_required
def workspace_automation_rules():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    ensure_workspace_growth_seed_data(int(workspace['id']))
    summary = workspace_engagement_summary(int(workspace['id']))
    return render_template('customer/automation_rules.html', workspace=workspace, rules=summary['rules'], metrics=summary['metrics'], integrations=summary['integrations'], saved=(request.args.get('saved') or '').strip())


@app.post("/workspace/automation-rules/<int:rule_id>/toggle")
@customer_login_required
def workspace_toggle_automation_rule(rule_id: int):
    workspace = current_workspace()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        rule = conn.execute("SELECT is_enabled FROM engagement_rules WHERE id=? AND workspace_id=?", (rule_id, int(workspace['id']))).fetchone()
        if rule is None:
            abort(404)
        new_value = 0 if int(rule['is_enabled'] or 0) == 1 else 1
        conn.execute("UPDATE engagement_rules SET is_enabled=?, updated_at=? WHERE id=?", (new_value, _utcnow_z(), rule_id))
        conn.commit()
    return redirect(url_for('workspace_automation_rules', saved='updated'))


@app.get("/workspace/analytics")
@customer_login_required
def workspace_analytics():
    workspace = current_workspace()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    reporting_summary = workspace_reporting_summary(workspace=workspace, subscription=current_subscription())
    return render_template(
        "customer/analytics.html",
        workspace=workspace,
        reporting_summary=reporting_summary,
        can_export=current_customer_can_export_workspace_data(),
    )


@app.get("/workspace/analytics/export.csv")
@customer_login_required
def workspace_analytics_export():
    if not current_customer_can_export_workspace_data():
        abort(403)
    workspace = current_workspace()
    summary = workspace_reporting_summary(workspace=workspace, subscription=current_subscription())
    rows = []
    for item in summary["upcoming_posts"]:
        rows.append({
            "post_id": item.get("post_id"),
            "brand": item.get("brand"),
            "post_date": item.get("post_date"),
            "post_time": item.get("post_time"),
            "status": item.get("status"),
            "approval_status": item.get("approval_status"),
            "campaign": item.get("campaign"),
            "theme": item.get("theme"),
        })
    return csv_response(filename="workspace_analytics.csv", rows=rows)


@app.get("/workspace/settings/audit-export.csv")
@customer_login_required
def workspace_audit_export():
    if not current_customer_can_export_workspace_data():
        abort(403)
    workspace = current_workspace()
    summary = workspace_reporting_summary(workspace=workspace, subscription=current_subscription())
    rows = [
        {
            "event_type": item.get("event_type"),
            "post_id": item.get("post_id"),
            "brand_slug": item.get("brand_slug"),
            "platform": item.get("platform"),
            "actor": item.get("actor"),
            "message": item.get("message"),
            "created_at": item.get("created_at"),
        }
        for item in summary["audit_events"]
    ]
    return csv_response(filename="workspace_audit_export.csv", rows=rows)


@app.route("/workspace/team", methods=["GET"])
@customer_login_required
def workspace_team():
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        return redirect(url_for("customer_dashboard"))
    members = fetch_workspace_members(int(workspace["id"]))
    pending_invites = fetch_workspace_pending_invites(int(workspace["id"]))
    subscription = current_subscription()
    seat_summary = workspace_seat_summary(workspace=workspace, subscription=subscription)
    saved = (request.args.get("saved") or "").strip().lower()
    error = (request.args.get("error") or "").strip()
    invite_link = (request.args.get("invite_link") or "").strip()
    return render_template(
        "customer/team.html",
        user=customer,
        workspace=workspace,
        members=members,
        pending_invites=pending_invites,
        seat_summary=seat_summary,
        manage_team=current_customer_can_manage_team(),
        manage_billing=current_customer_can_manage_billing(),
        saved=saved,
        error=error,
        invite_link=invite_link,
        current_role=current_membership_role(),
    )


@app.post("/workspace/team/invite")
@customer_login_required
def workspace_team_invite():
    if not current_customer_can_manage_team():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    email = (request.form.get("email") or "").strip().lower()
    full_name = (request.form.get("full_name") or "").strip()
    membership_role = (request.form.get("membership_role") or "member").strip().lower()
    if membership_role not in {"admin", "member"}:
        membership_role = "member"
    if not email:
        return redirect(url_for("workspace_team", saved="invite_error", error="Team member email is required."))
    if not workspace_accepts_email(workspace, email):
        return redirect(url_for("workspace_team", saved="invite_error", error="That email domain is not allowed for this workspace. Update Settings first if you need to allow it."))

    with get_conn() as conn:
        existing_user = conn.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
        if existing_user is not None:
            existing_membership = conn.execute(
                "SELECT membership_role FROM workspace_memberships WHERE workspace_id=? AND user_id=? AND lower(ifnull(status, 'active'))='active'",
                (workspace["id"], existing_user["id"]),
            ).fetchone()
            if existing_membership is not None:
                return redirect(url_for("workspace_team", saved="invite_error", error="That email already has access to this workspace."))
        seat_summary = workspace_seat_summary(workspace=workspace, subscription=current_subscription())
        if seat_summary["at_capacity"]:
            return redirect(url_for("workspace_team", saved="invite_error", error="This workspace is already using all available seats for the selected plan."))
        raw_token = create_workspace_invitation(
            conn,
            workspace_id=int(workspace["id"]),
            email=email,
            full_name=full_name,
            membership_role=membership_role,
            invited_by_user_id=int(customer["id"]),
            expires_in_hours=INVITE_TOKEN_HOURS,
        )
        conn.commit()
    invite_link = build_app_url(f"/join-workspace/{raw_token}")
    delivery = send_team_invite_email_if_enabled(
        recipient_email=email,
        recipient_name=full_name,
        invite_link=invite_link,
        workspace_name=(workspace.get("display_name") or "Repurly workspace"),
    )
    record_audit_event(
        "workspace_member_invited",
        actor=(customer.get("email") or "workspace_owner"),
        message=f"Workspace invitation created for {email}.",
        payload={"workspace_id": workspace["id"], "email": email, "membership_role": membership_role, "email_delivery": delivery},
    )
    return redirect(url_for("workspace_team", saved="invite_created", invite_link=invite_link))


@app.post("/workspace/team/<int:membership_id>/role")
@customer_login_required
def workspace_team_update_role(membership_id: int):
    if not current_customer_can_manage_team():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    desired_role = (request.form.get("membership_role") or "member").strip().lower()
    if desired_role not in {"admin", "member"}:
        return redirect(url_for("workspace_team", saved="role_error", error="Choose a valid role."))
    with get_conn() as conn:
        membership = conn.execute(
            "SELECT wm.*, u.email FROM workspace_memberships wm JOIN users u ON u.id = wm.user_id WHERE wm.id=? AND wm.workspace_id=?",
            (membership_id, workspace["id"]),
        ).fetchone()
        if membership is None:
            abort(404)
        current_role = (membership["membership_role"] or "member").strip().lower()
        actor_role = current_membership_role()
        if current_role == "owner":
            return redirect(url_for("workspace_team", saved="role_error", error="Owner role cannot be changed from the team page."))
        if actor_role != "owner" and current_role == "admin":
            return redirect(url_for("workspace_team", saved="role_error", error="Only the workspace owner can change another admin."))
        conn.execute(
            "UPDATE workspace_memberships SET membership_role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (desired_role, membership_id),
        )
        conn.commit()
    record_audit_event(
        "workspace_role_updated",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"Updated workspace role for {membership['email']} to {desired_role}.",
        payload={"workspace_id": workspace["id"], "membership_id": membership_id, "membership_role": desired_role},
    )
    return redirect(url_for("workspace_team", saved="role_updated"))


@app.post("/workspace/team/<int:membership_id>/remove")
@customer_login_required
def workspace_team_remove_member(membership_id: int):
    if not current_customer_can_manage_team():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        membership = conn.execute(
            "SELECT wm.*, u.email FROM workspace_memberships wm JOIN users u ON u.id = wm.user_id WHERE wm.id=? AND wm.workspace_id=?",
            (membership_id, workspace["id"]),
        ).fetchone()
        if membership is None:
            abort(404)
        current_role = (membership["membership_role"] or "member").strip().lower()
        actor_role = current_membership_role()
        if current_role == "owner":
            return redirect(url_for("workspace_team", saved="remove_error", error="Owner access cannot be removed from the team page."))
        if actor_role != "owner" and current_role == "admin":
            return redirect(url_for("workspace_team", saved="remove_error", error="Only the workspace owner can remove another admin."))
        conn.execute(
            "UPDATE workspace_memberships SET status='removed', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (membership_id,),
        )
        conn.commit()
    record_audit_event(
        "workspace_member_removed",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"Removed workspace access for {membership['email']}.",
        payload={"workspace_id": workspace["id"], "membership_id": membership_id},
    )
    return redirect(url_for("workspace_team", saved="member_removed"))


@app.post("/workspace/team/invitations/<int:invite_id>/revoke")
@customer_login_required
def workspace_team_revoke_invite(invite_id: int):
    if not current_customer_can_manage_team():
        abort(403)
    workspace = current_workspace()
    customer = current_customer()
    if workspace is None:
        abort(404)
    with get_conn() as conn:
        invitation = conn.execute(
            "SELECT * FROM workspace_invitations WHERE id=? AND workspace_id=?",
            (invite_id, workspace["id"]),
        ).fetchone()
        if invitation is None:
            abort(404)
        conn.execute(
            "UPDATE workspace_invitations SET revoked_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (utcnow_iso(), invite_id),
        )
        conn.commit()
    record_audit_event(
        "workspace_invite_revoked",
        actor=(customer.get("email") or "workspace_admin"),
        message=f"Revoked workspace invite for {(invitation['email'] or '').strip().lower()}.",
        payload={"workspace_id": workspace["id"], "invite_id": invite_id},
    )
    return redirect(url_for("workspace_team", saved="invite_revoked"))


@app.route("/join-workspace/<token>", methods=["GET", "POST"])
def join_workspace(token: str):
    errors: list[str] = []
    invitation: sqlite3.Row | None
    with get_conn() as conn:
        invitation = fetch_valid_workspace_invitation(conn, token)
    if invitation is None:
        return render_template(
            "auth/join_workspace.html",
            token_valid=False,
            invitation=None,
            existing_user=None,
            errors=["This workspace invite is invalid or has expired."],
        ), 400

    email = (invitation["email"] or "").strip().lower()
    full_name = (invitation["full_name"] or "").strip()
    existing_user = fetch_customer_user_by_email(email)
    signed_in_customer = current_customer()

    if request.method == "POST":
        with get_conn() as conn:
            valid_invite = fetch_valid_workspace_invitation(conn, token)
            if valid_invite is None:
                errors.append("This workspace invite is invalid or has expired.")
            else:
                existing = conn.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
                if existing is not None and (existing["status"] or "").strip().lower() == "active":
                    if signed_in_customer is None or int(signed_in_customer["id"]) != int(existing["id"]):
                        errors.append("This email already has a Repurly account. Sign in with that account first, then reopen the invite link.")
                    else:
                        ensure_workspace_membership(conn, workspace_id=int(valid_invite["workspace_id"]), user_id=int(existing["id"]), membership_role=(valid_invite["membership_role"] or "member").strip().lower())
                        conn.execute(
                            "UPDATE workspace_invitations SET accepted_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                            (utcnow_iso(), valid_invite["id"]),
                        )
                        conn.commit()
                        return redirect(url_for("workspace_team", saved="member_joined"))
                else:
                    chosen_name = (request.form.get("full_name") or full_name).strip()
                    password = request.form.get("password") or ""
                    confirm_password = request.form.get("confirm_password") or ""
                    errors = password_validation_errors(password, confirm_password)
                    if not chosen_name:
                        errors.append("Full name is required.")
                    if not errors:
                        if existing is None:
                            conn.execute(
                                """
                                INSERT INTO users (email, full_name, company_name, role, status, password_hash, email_verified_at, activated_at, invited_at)
                                VALUES (?, ?, ?, 'customer', 'active', ?, ?, ?, ?)
                                """,
                                (email, chosen_name, valid_invite["workspace_company_name"] or "", hash_password(password), utcnow_iso(), utcnow_iso(), utcnow_iso()),
                            )
                            user_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
                        else:
                            user_id = int(existing["id"])
                            conn.execute(
                                """
                                UPDATE users SET full_name=?, company_name=?, role='customer', status='active', password_hash=?, email_verified_at=COALESCE(email_verified_at, ?), activated_at=COALESCE(activated_at, ?), updated_at=CURRENT_TIMESTAMP
                                WHERE id=?
                                """,
                                (chosen_name, valid_invite["workspace_company_name"] or "", hash_password(password), utcnow_iso(), utcnow_iso(), user_id),
                            )
                        ensure_workspace_membership(conn, workspace_id=int(valid_invite["workspace_id"]), user_id=user_id, membership_role=(valid_invite["membership_role"] or "member").strip().lower())
                        conn.execute(
                            "UPDATE workspace_invitations SET accepted_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                            (utcnow_iso(), valid_invite["id"]),
                        )
                        conn.commit()
                        user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
                        login_customer(user)
                        record_login_event(user_id, "workspace_invite_accepted")
                        return redirect(url_for("customer_dashboard"))

    join_state = "existing_account" if existing_user is not None and (existing_user["status"] or "").strip().lower() == "active" else "new_account"
    return render_template(
        "auth/join_workspace.html",
        token_valid=True,
        invitation=invitation,
        existing_user=existing_user,
        join_state=join_state,
        full_name=full_name,
        errors=errors,
    )


@app.route("/onboarding/brand", methods=["GET", "POST"])
def brand_onboarding():
    saved = None
    errors: list[str] = []
    selected_workspace_id = (request.form.get("workspace_id") or "").strip()
    workspace_id = int(selected_workspace_id) if selected_workspace_id.isdigit() else None
    workspaces = fetch_workspaces()
    if request.method == "POST":
        slug = slugify(request.form.get("brand", ""))
        display_name = request.form.get("display_name", "").strip()
        if not slug:
            errors.append("Brand slug is required.")
        if not display_name:
            errors.append("Display name is required.")
        if selected_workspace_id and workspace_id is None:
            errors.append("Select a valid workspace or leave the field blank.")

        config = {
            "brand": slug,
            "display_name": display_name,
            "website": request.form.get("website", "").strip(),
            "contact_email": request.form.get("contact_email", "").strip(),
            "tone": request.form.get("tone", "").strip(),
            "audience": request.form.get("audience", "").strip(),
            "primary_cta": request.form.get("primary_cta", "").strip(),
            "secondary_cta": request.form.get("secondary_cta", "").strip(),
            "default_platforms": ["linkedin"],
            "hashtags": [item.strip() for item in request.form.get("hashtags", "").split(",") if item.strip()],
            "posting_goals": [item.strip() for item in request.form.get("posting_goals", "").split(",") if item.strip()],
            "content_pillars": [item.strip() for item in request.form.get("content_pillars", "").split(",") if item.strip()],
            "linkedin_author_urn": request.form.get("linkedin_author_urn", "").strip(),
            "linkedin_token_env": request.form.get("linkedin_token_env", "").strip(),
        }

        if not errors:
            path = save_brand_config(slug, config)
            with get_conn() as conn:
                conn.execute(
                    """
                    INSERT INTO brands (
                        workspace_id, slug, display_name, website, contact_email, tone, audience, primary_cta, secondary_cta,
                        default_platforms_json, hashtags_json, posting_goals_json, content_pillars_json,
                        linkedin_author_urn, linkedin_token_env, settings_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(slug) DO UPDATE SET
                        workspace_id=excluded.workspace_id,
                        display_name=excluded.display_name,
                        website=excluded.website,
                        contact_email=excluded.contact_email,
                        tone=excluded.tone,
                        audience=excluded.audience,
                        primary_cta=excluded.primary_cta,
                        secondary_cta=excluded.secondary_cta,
                        default_platforms_json=excluded.default_platforms_json,
                        hashtags_json=excluded.hashtags_json,
                        posting_goals_json=excluded.posting_goals_json,
                        content_pillars_json=excluded.content_pillars_json,
                        linkedin_author_urn=excluded.linkedin_author_urn,
                        linkedin_token_env=excluded.linkedin_token_env,
                        settings_json=excluded.settings_json,
                        updated_at=CURRENT_TIMESTAMP
                    """,
                    (
                        workspace_id,
                        slug,
                        config["display_name"],
                        config["website"],
                        config["contact_email"],
                        config["tone"],
                        config["audience"],
                        config["primary_cta"],
                        config["secondary_cta"],
                        json.dumps(config["default_platforms"]),
                        json.dumps(config["hashtags"]),
                        json.dumps(config["posting_goals"]),
                        json.dumps(config["content_pillars"]),
                        config["linkedin_author_urn"],
                        config["linkedin_token_env"],
                        json.dumps(config),
                    ),
                )
                conn.commit()
            saved = f"Saved brand settings to {path.as_posix()} and SQLite"
            if workspace_id:
                workspace_name = next((item["display_name"] for item in workspaces if int(item["id"]) == workspace_id), "workspace")
                saved += f" and linked the brand to {workspace_name}."
    return render_template(
        "brand_onboarding.html",
        saved=saved,
        errors=errors,
        workspaces=workspaces,
        selected_workspace_id=selected_workspace_id,
    )


@app.route("/beta", methods=["GET", "POST"])
def beta_signup():
    saved = None
    billing_state = (request.args.get("billing") or "").strip().lower()
    form_data = normalised_beta_form_data(request.form if request.method == "POST" else {})
    errors: list[str] = []

    if request.method == "POST":
        errors = validate_beta_form(request.form)
        email = form_data["email"]
        full_name = form_data["full_name"]
        company_name = form_data["company_name"]
        selected_plan = form_data["selected_plan"]
        beta_notes = build_beta_notes(request.form)

        if not errors:
            with get_conn() as conn:
                conn.execute(
                    """
                    INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan, beta_notes)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                        full_name=excluded.full_name,
                        company_name=excluded.company_name,
                        selected_plan=excluded.selected_plan,
                        beta_notes=excluded.beta_notes,
                        updated_at=CURRENT_TIMESTAMP
                    """,
                    (email, full_name, company_name, selected_plan, beta_notes),
                )
                conn.commit()
            saved = "Beta request saved. We will follow up using the details you provided."
            form_data = normalised_beta_form_data({})

    return render_beta_template(saved=saved, errors=errors, billing_state=billing_state, form_data=form_data)


@app.route("/billing/create-checkout-session", methods=["POST"])
def billing_create_checkout_session():
    form_data = normalised_beta_form_data(request.form)
    errors = validate_beta_form(request.form)
    if errors:
        return render_beta_template(
            saved=None,
            errors=errors,
            billing_state="",
            form_data=form_data,
            status_code=400,
        )

    email = form_data["email"]
    selected_plan = form_data["selected_plan"]
    full_name = form_data["full_name"]
    company_name = form_data["company_name"]
    beta_notes = build_beta_notes(request.form)

    try:
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO founding_user_signups (email, full_name, company_name, selected_plan, beta_notes)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    full_name=excluded.full_name,
                    company_name=excluded.company_name,
                    selected_plan=excluded.selected_plan,
                    beta_notes=excluded.beta_notes,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (email, full_name, company_name, selected_plan, beta_notes),
            )
            conn.commit()
            row = conn.execute("SELECT id FROM founding_user_signups WHERE email=?", (email,)).fetchone()

        if row is None:
            raise RuntimeError("Unable to save your signup details before checkout. Please try again.")

        session = create_checkout_session(email=email, plan_name=selected_plan, signup_id=int(row["id"]), success_path="/signup/complete?session_id={CHECKOUT_SESSION_ID}")
        store_pending_checkout_context(
            email=email,
            full_name=full_name,
            company_name=company_name,
            selected_plan=selected_plan,
            signup_id=int(row["id"]),
            session_id=str(session.get("id") or ""),
        )
    except RuntimeError as exc:
        return render_beta_template(
            saved=None,
            errors=[str(exc)],
            billing_state="",
            form_data=form_data,
            status_code=400,
        )
    except sqlite3.Error as exc:
        app.logger.exception("Database error while starting checkout")
        return render_beta_template(
            saved=None,
            errors=[f"Database error while starting checkout: {exc}"],
            billing_state="",
            form_data=form_data,
            status_code=500,
        )
    except Exception as exc:
        app.logger.exception("Unexpected error while starting checkout")
        return render_beta_template(
            saved=None,
            errors=[f"Unable to start checkout: {exc}"],
            billing_state="",
            form_data=form_data,
            status_code=500,
        )

    if wants_json_response():
        return jsonify({"ok": True, **session})
    return redirect(session["url"])


@app.post("/stripe/webhook")
def stripe_webhook():
    payload = request.data
    signature = request.headers.get("Stripe-Signature", "")
    cfg = get_billing_config()
    if not verify_stripe_webhook_signature(payload, signature, cfg.webhook_secret):
        return jsonify({"ok": False, "error": "invalid signature"}), 400
    event = request.get_json(force=True, silent=False)
    result = process_stripe_event(event)
    return jsonify(result)


@app.get("/ops")
def ops_dashboard():
    schedule_df = load_schedule_df()
    status_counts = count_values(schedule_df, "status")
    approval_counts = count_values(schedule_df, "approval_status")
    brand_counts = count_values(schedule_df, "brand")

    summary = {
        "brands": len(fetch_brands()),
        "scheduled_posts": len(schedule_df.index),
        "ready_to_publish": int(
            (
                schedule_df["status"].isin(["approved", "generated", "queued"])
                & schedule_df["approval_status"].isin(POSTING_ALLOWED_APPROVAL_STATUSES)
            ).sum()
        )
        if not schedule_df.empty
        else 0,
        "failed_posts": int((schedule_df["status"] == "failed").sum()) if not schedule_df.empty else 0,
        "pending_review": int((schedule_df["approval_status"].isin(["", "pending"])).sum()) if not schedule_df.empty else 0,
    }

    recent_failures = []
    if not schedule_df.empty:
        failure_df = schedule_df.loc[schedule_df["status"] == "failed"].copy()
        if not failure_df.empty:
            failure_df = failure_df.sort_values(by=["post_date", "post_time", "post_id"], ascending=[False, False, False])
            recent_failures = failure_df.head(10).to_dict(orient="records")

    with get_conn() as conn:
        recent_attempts = [dict(row) for row in conn.execute(
            "SELECT * FROM publish_attempts ORDER BY id DESC LIMIT ?", (10,)
        ).fetchall()]
        recent_audit = [dict(row) for row in conn.execute(
            "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (10,)
        ).fetchall()]
        recent_signups = [dict(row) for row in conn.execute(
            "SELECT * FROM founding_user_signups ORDER BY id DESC LIMIT ?", (10,)
        ).fetchall()]

    return render_template(
        "ops/dashboard.html",
        summary=summary,
        status_counts=status_counts,
        approval_counts=approval_counts,
        brand_counts=brand_counts,
        recent_failures=recent_failures,
        recent_attempts=recent_attempts,
        recent_audit=recent_audit,
        recent_signups=recent_signups,
    )


@app.get("/ops/health")
def ops_health():
    checks: list[dict[str, str]] = []

    if SCHEDULE_CSV.exists():
        checks.append({"name": "schedule_csv", "status": "ok", "detail": SCHEDULE_CSV.as_posix()})
        schedule_df = load_schedule_df()
        errors, warnings = validate_schedule(schedule_df)
        for warning in warnings:
            checks.append({"name": "schedule_warning", "status": "warning", "detail": warning})
        if errors:
            for error in errors:
                checks.append({"name": "schedule_error", "status": "error", "detail": error})
        else:
            checks.append({"name": "schedule_validation", "status": "ok", "detail": "Schedule validation passed."})
    else:
        checks.append({"name": "schedule_csv", "status": "error", "detail": "Schedule CSV is missing."})

    with get_conn() as conn:
        for table_name in ["brands", "founding_user_signups", "publish_attempts", "audit_log"]:
            try:
                count = conn.execute(f"SELECT COUNT(*) AS total FROM {table_name}").fetchone()["total"]
                checks.append({"name": table_name, "status": "ok", "detail": f"{count} row(s) present."})
            except sqlite3.Error as exc:
                checks.append({"name": table_name, "status": "error", "detail": str(exc)})

    overall_status = "ok"
    if any(item["status"] == "error" for item in checks):
        overall_status = "error"
    elif any(item["status"] == "warning" for item in checks):
        overall_status = "warning"

    return render_template("ops/health.html", checks=checks, overall_status=overall_status)


@app.get("/ops/brands")
def ops_brands():
    brands = fetch_brands()
    return render_template("ops/brands.html", brands=brands)


@app.get("/ops/assets")
def ops_assets():
    brand = (request.args.get("brand") or "").strip().lower()
    status = (request.args.get("status") or "").strip().lower()
    asset_kind = (request.args.get("asset_kind") or "").strip().lower()
    post_id = (request.args.get("post_id") or "").strip()
    search = (request.args.get("q") or "").strip().lower()

    query = """
        SELECT a.*, b.slug AS brand_slug, b.display_name AS brand_display_name
        FROM assets a
        JOIN brands b ON b.id = a.brand_id
    """
    clauses: list[str] = []
    params: list[Any] = []
    if brand:
        clauses.append("lower(b.slug)=?")
        params.append(brand)
    if status:
        clauses.append("lower(a.status)=?")
        params.append(status)
    if asset_kind:
        clauses.append("lower(a.asset_kind)=?")
        params.append(asset_kind)
    if search:
        clauses.append("(lower(a.file_name) LIKE ? OR lower(a.file_path) LIKE ? OR lower(ifnull(a.alt_text, '')) LIKE ?)")
        like_value = f"%{search}%"
        params.extend([like_value, like_value, like_value])
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY a.id DESC LIMIT 200"
    assets = fetch_rows(query, tuple(params))

    target_post = None
    if post_id:
        try:
            target_post = get_schedule_row(post_id)
        except Exception:
            target_post = None

    return render_template(
        "ops/assets.html",
        assets=assets,
        filters={"brand": brand, "status": status, "asset_kind": asset_kind, "q": request.args.get("q", "").strip(), "post_id": post_id},
        brands=sorted({row["brand_slug"] for row in assets} | set(all_brand_slugs())),
        statuses=sorted({(row.get("status") or "").strip() for row in assets if (row.get("status") or "").strip()}),
        asset_kinds=sorted({(row.get("asset_kind") or "").strip() for row in assets if (row.get("asset_kind") or "").strip()}),
        target_post=target_post,
    )


@app.get("/ops/schedule")
def ops_schedule():
    schedule_df = load_schedule_df()
    brand = (request.args.get("brand") or "").strip().lower()
    status = (request.args.get("status") or "").strip().lower()
    approval_status = (request.args.get("approval_status") or "").strip().lower()
    post_date = (request.args.get("post_date") or "").strip()
    search = (request.args.get("q") or "").strip().lower()

    filters = {
        "brand": brand,
        "status": status,
        "approval_status": approval_status,
        "post_date": post_date,
        "q": request.args.get("q", "").strip(),
    }

    schedule_df = apply_schedule_filters(
        schedule_df,
        brand=brand,
        status=status,
        approval_status=approval_status,
        post_date=post_date,
        search=search,
    )
    if not schedule_df.empty:
        schedule_df = schedule_df.sort_values(by=["post_date", "post_time", "brand", "post_id"], ascending=[False, False, True, True])

    posts = schedule_df.head(200).to_dict(orient="records") if not schedule_df.empty else []
    return render_template(
        "ops/schedule.html",
        posts=posts,
        filters=filters,
        brands=sorted({row["brand"] for row in posts} | set(all_schedule_values("brand"))),
        statuses=sorted(set(all_schedule_values("status"))),
        approval_statuses=sorted(set(all_schedule_values("approval_status"))),
        retryable_statuses=sorted(ELIGIBLE_POSTING_STATUSES | {"failed"}),
    )


@app.get("/ops/schedule/<post_id>")
def ops_schedule_detail(post_id: str):
    row = get_schedule_row(post_id)
    caption_text = ""
    caption_error = ""
    asset_paths: list[dict[str, Any]] = []
    try:
        content_folder = build_content_date_folder(row["brand"], row["post_date"])
        caption_filename = (row.get("caption_filename") or "").strip()
        if caption_filename:
            caption_path = content_folder / "captions" / caption_filename
            caption_text = read_text(caption_path).strip()
        raw_assets = (row.get("asset_filename") or "").replace(";", "|").replace(",", "|")
        for item in [part.strip() for part in raw_assets.split("|") if part.strip()]:
            path = content_folder / "assets" / item
            asset_paths.append({"name": item, "path": path.as_posix(), "exists": path.exists()})
    except Exception as exc:
        caption_error = str(exc)

    audit_events = fetch_rows(
        "SELECT * FROM audit_log WHERE post_id=? ORDER BY id DESC LIMIT ?",
        (post_id, OPS_EVENTS_LIMIT),
    )
    publish_attempts = fetch_rows(
        "SELECT * FROM publish_attempts WHERE post_id=? ORDER BY id DESC LIMIT ?",
        (post_id, OPS_EVENTS_LIMIT),
    )

    brand_config = {}
    try:
        brand_config = get_brand_config(row["brand"])
    except Exception:
        brand_config = {}

    current_status = (row.get("status") or "").strip().lower()
    can_retry = (row.get("platform") or "").strip().lower() == "linkedin" and current_status in (ELIGIBLE_POSTING_STATUSES | {"failed"})
    retry_label = "Retry publish" if current_status == "failed" else "Publish now"

    return render_template(
        "ops/post_detail.html",
        post=row,
        caption_text=caption_text,
        caption_error=caption_error,
        asset_paths=asset_paths,
        audit_events=audit_events,
        publish_attempts=publish_attempts,
        brand_config=brand_config,
        can_retry=can_retry,
        retry_label=retry_label,
    )


@app.post("/ops/schedule/<post_id>/approve")
def ops_schedule_approve(post_id: str):
    actor = (request.form.get("actor") or "ops_console").strip()
    update_schedule_review_status(post_id, approval_status="approved", status="approved", actor=actor)
    return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="approved"))


@app.post("/ops/schedule/<post_id>/reject")
def ops_schedule_reject(post_id: str):
    actor = (request.form.get("actor") or "ops_console").strip()
    reason = (request.form.get("reason") or "").strip()
    update_schedule_review_status(post_id, approval_status="rejected", status="rejected", actor=actor, reason=reason)
    return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="rejected"))


@app.post("/ops/schedule/<post_id>/upload-assets")
def ops_schedule_upload_assets(post_id: str):
    actor = (request.form.get("actor") or "ops_console").strip()
    replace_existing = (request.form.get("merge_mode") or "append").strip().lower() == "replace"
    switch_post_type = (request.form.get("switch_post_type") or "1").strip().lower() not in {"0", "false", "no"}
    try:
        saved_assets = save_uploaded_assets_for_post(
            post_id,
            request.files.getlist("assets"),
            actor=actor,
            replace_existing=replace_existing,
            switch_post_type=switch_post_type,
        )
        message = f"Uploaded {len(saved_assets)} asset(s): " + ", ".join(item["file_name"] for item in saved_assets)
        return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="assets_uploaded", message=message))
    except Exception as exc:
        return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="asset_upload_error", message=str(exc)))


@app.post("/ops/schedule/<post_id>/attach-assets")
def ops_schedule_attach_assets(post_id: str):
    actor = (request.form.get("actor") or "ops_console").strip()
    replace_existing = (request.form.get("merge_mode") or "append").strip().lower() == "replace"
    switch_post_type = (request.form.get("switch_post_type") or "1").strip().lower() not in {"0", "false", "no"}
    asset_ids = [item for item in request.form.getlist("asset_ids") if item.strip()]
    try:
        attached_assets = attach_existing_assets_to_post(
            post_id,
            [int(item) for item in asset_ids],
            actor=actor,
            replace_existing=replace_existing,
            switch_post_type=switch_post_type,
        )
        message = f"Attached {len(attached_assets)} existing asset(s): " + ", ".join(item["file_name"] for item in attached_assets)
        return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="assets_attached", message=message))
    except Exception as exc:
        return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="asset_attach_error", message=str(exc)))


@app.post("/ops/schedule/bulk-retry")
def ops_schedule_bulk_retry_publish():
    actor = (request.form.get("actor") or "ops_console").strip()
    selected_post_ids = [item.strip() for item in request.form.getlist("post_ids") if item.strip()]

    if not selected_post_ids and (request.form.get("apply_to_filtered") or "").strip() == "1":
        schedule_df = apply_schedule_filters(
            load_schedule_df(),
            brand=(request.form.get("brand") or "").strip().lower(),
            status=(request.form.get("status") or "").strip().lower(),
            approval_status=(request.form.get("approval_status") or "").strip().lower(),
            post_date=(request.form.get("post_date") or "").strip(),
            search=(request.form.get("q") or "").strip().lower(),
        )
        if not schedule_df.empty:
            retryable_mask = (schedule_df["platform"].str.lower() == "linkedin") & (schedule_df["status"].str.lower().isin(ELIGIBLE_POSTING_STATUSES | {"failed"}))
            selected_post_ids = schedule_df.loc[retryable_mask, "post_id"].tolist()

    if not selected_post_ids:
        return redirect(url_for("ops_schedule", bulk_status="no_selection"))

    summary = {"requested": 0, "success": 0, "failed": 0, "skipped": 0}
    for post_id in selected_post_ids:
        row = get_schedule_row(post_id)
        brand_slug = (row.get("brand") or "").strip()
        platform = (row.get("platform") or "").strip().lower()
        summary["requested"] += 1
        record_audit_event(
            "publish_retry_requested",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message="Bulk publish retry requested from ops console.",
            payload={"mode": "bulk"},
        )
        try:
            result = process_linkedin_post_id(post_id, allow_retry_failed=True)
            action = result.get("action") or "unknown"
            if action in {"success", "existing_success"}:
                summary["success"] += 1
            elif action == "failed":
                summary["failed"] += 1
            else:
                summary["skipped"] += 1
            record_audit_event(
                "publish_retry_completed",
                post_id=post_id,
                brand_slug=brand_slug,
                platform=platform,
                actor=actor,
                message=f"Bulk publish retry finished with action={action}.",
                payload={"action": action, "mode": "bulk"},
            )
        except Exception as exc:
            summary["failed"] += 1
            record_audit_event(
                "publish_retry_blocked",
                post_id=post_id,
                brand_slug=brand_slug,
                platform=platform,
                actor=actor,
                message=str(exc),
                payload={"mode": "bulk"},
            )

    return redirect(url_for("ops_schedule", bulk_status="done", bulk_message=f"Requested {summary['requested']} retries. Success={summary['success']}, failed={summary['failed']}, skipped={summary['skipped']}"))


@app.post("/ops/schedule/<post_id>/retry-publish")
def ops_schedule_retry_publish(post_id: str):
    row = get_schedule_row(post_id)
    actor = (request.form.get("actor") or "ops_console").strip()
    brand_slug = (row.get("brand") or "").strip()
    platform = (row.get("platform") or "").strip().lower()
    record_audit_event(
        "publish_retry_requested",
        post_id=post_id,
        brand_slug=brand_slug,
        platform=platform,
        actor=actor,
        message="Publish retry requested from ops console.",
    )
    try:
        result = process_linkedin_post_id(post_id, allow_retry_failed=True)
    except Exception as exc:
        record_audit_event(
            "publish_retry_blocked",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message=str(exc),
        )
        return redirect(url_for("ops_schedule_detail", post_id=post_id, saved="retry_error", message=str(exc)))

    action = result.get("action") or "unknown"
    updated_row = result.get("row") or {}
    message = updated_row.get("last_publish_error") or "Retry processed."
    saved = "retry_success"
    if action == "success":
        message = "LinkedIn publish completed successfully."
        record_audit_event(
            "publish_retry_completed",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message=message,
            payload={"action": action},
        )
    elif action == "existing_success":
        message = "A successful publish attempt already existed, so the post was marked posted."
        record_audit_event(
            "publish_retry_completed",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message=message,
            payload={"action": action},
        )
    elif action == "skipped_unapproved":
        saved = "retry_skipped"
        message = "This post is still blocked by approval status. Approve it first or mark it not_required."
        record_audit_event(
            "publish_retry_completed",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message=message,
            payload={"action": action},
        )
    elif action == "failed":
        saved = "retry_failed"
        message = updated_row.get("last_publish_error") or "LinkedIn publish retry failed."
        record_audit_event(
            "publish_retry_completed",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message=message,
            payload={"action": action},
        )
    else:
        saved = "retry_error"
        message = f"Unexpected retry result: {action}"
        record_audit_event(
            "publish_retry_completed",
            post_id=post_id,
            brand_slug=brand_slug,
            platform=platform,
            actor=actor,
            message=message,
            payload={"action": action},
        )
    return redirect(url_for("ops_schedule_detail", post_id=post_id, saved=saved, message=message))


@app.get("/ops/publish-attempts")
def ops_publish_attempts():
    status = (request.args.get("status") or "").strip().lower()
    brand = (request.args.get("brand") or "").strip().lower()
    query = "SELECT * FROM publish_attempts"
    clauses: list[str] = []
    params: list[Any] = []
    if status:
        clauses.append("lower(status)=?")
        params.append(status)
    if brand:
        clauses.append("lower(brand_slug)=?")
        params.append(brand)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(OPS_ATTEMPT_LIMIT)
    attempts = fetch_rows(query, tuple(params))
    return render_template("ops/publish_attempts.html", attempts=attempts, filters={"status": status, "brand": brand})


@app.get("/ops/audit")
def ops_audit():
    event_type = (request.args.get("event_type") or "").strip().lower()
    brand = (request.args.get("brand") or "").strip().lower()
    query = "SELECT * FROM audit_log"
    clauses: list[str] = []
    params: list[Any] = []
    if event_type:
        clauses.append("lower(event_type)=?")
        params.append(event_type)
    if brand:
        clauses.append("lower(brand_slug)=?")
        params.append(brand)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(OPS_AUDIT_LIMIT)
    events = fetch_rows(query, tuple(params))
    return render_template("ops/audit.html", events=events, filters={"event_type": event_type, "brand": brand})


def build_ops_billing_rows(conn: sqlite3.Connection, *, limit: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    signup_rows = conn.execute(
        "SELECT * FROM founding_user_signups ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    hydrated: list[dict[str, Any]] = []
    for signup in signup_rows:
        email = ((signup["email"] or "").strip().lower())
        user = conn.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
        workspace = None
        membership = None
        subscription = None
        if user is not None:
            membership = conn.execute(
                """
                SELECT * FROM workspace_memberships
                WHERE user_id=? AND lower(ifnull(status, 'active'))='active'
                ORDER BY id ASC LIMIT 1
                """,
                (user["id"],),
            ).fetchone()
            if membership is not None:
                workspace = conn.execute("SELECT * FROM workspaces WHERE id=?", (membership["workspace_id"],)).fetchone()
        if workspace is not None:
            subscription = conn.execute(
                "SELECT * FROM subscriptions WHERE workspace_id=? ORDER BY id DESC LIMIT 1",
                (workspace["id"],),
            ).fetchone()
        if subscription is None and user is not None:
            subscription = conn.execute(
                "SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1",
                (user["id"],),
            ).fetchone()
        if subscription is None:
            subscription = conn.execute(
                "SELECT * FROM subscriptions WHERE lower(ifnull(billing_email, ''))=? ORDER BY id DESC LIMIT 1",
                (email,),
            ).fetchone()

        row = dict(signup)
        row.update(
            {
                "user_id": user["id"] if user is not None else None,
                "user_status": user["status"] if user is not None else None,
                "user_role": user["role"] if user is not None else None,
                "invited_at": user["invited_at"] if user is not None and "invited_at" in user.keys() else None,
                "activated_at": user["activated_at"] if user is not None and "activated_at" in user.keys() else None,
                "workspace_id": workspace["id"] if workspace is not None else None,
                "workspace_display_name": workspace["display_name"] if workspace is not None else None,
                "workspace_status": workspace["status"] if workspace is not None and "status" in workspace.keys() else None,
                "membership_role": membership["membership_role"] if membership is not None else None,
                "subscription_plan": subscription["plan_name"] if subscription is not None else None,
                "subscription_status": subscription["status"] if subscription is not None else None,
            }
        )
        hydrated.append(row)

    subscriptions = [
        dict(row)
        for row in conn.execute("SELECT * FROM subscriptions ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    ]
    return hydrated, subscriptions


@app.get("/ops/billing")
def ops_billing():
    saved = (request.args.get("saved") or "").strip()
    invite_link = (request.args.get("invite_link") or "").strip()
    reset_link = (request.args.get("reset_link") or "").strip()
    target_email = (request.args.get("email") or "").strip()
    workspace_name = (request.args.get("workspace_name") or "").strip()
    sync_count = (request.args.get("sync_count") or "").strip()
    query_error = (request.args.get("error") or "").strip()
    with get_conn() as conn:
        signups, subscriptions = build_ops_billing_rows(conn, limit=OPS_SIGNUPS_LIMIT)
    return render_template(
        "ops/billing.html",
        signups=signups,
        subscriptions=subscriptions,
        saved=saved,
        invite_link=invite_link,
        reset_link=reset_link,
        target_email=target_email,
        workspace_name=workspace_name,
        sync_count=sync_count,
        error=query_error,
    )


@app.post("/ops/signups/<int:signup_id>/invite")
def ops_invite_signup(signup_id: int):
    actor = (request.form.get("actor") or "ops_console").strip()
    with get_conn() as conn:
        signup = conn.execute("SELECT * FROM founding_user_signups WHERE id=?", (signup_id,)).fetchone()
        if signup is None:
            abort(404)
        email = (signup["email"] or "").strip().lower()
        full_name = (signup["full_name"] or email.split("@", 1)[0]).strip()
        company_name = (signup["company_name"] or "").strip()
        existing = conn.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
        invited_at = utcnow_iso()
        if existing is None:
            conn.execute(
                """
                INSERT INTO users (email, full_name, company_name, role, status, invited_at)
                VALUES (?, ?, ?, 'customer', 'invited', ?)
                """,
                (email, full_name, company_name, invited_at),
            )
            user_id = int(conn.execute("SELECT id FROM users WHERE lower(email)=?", (email,)).fetchone()["id"])
        else:
            user_id = int(existing["id"])
            next_status = "active" if (existing["status"] or "").strip().lower() == "active" else "invited"
            conn.execute(
                """
                UPDATE users
                SET full_name=?, company_name=?, role='customer', status=?, invited_at=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """,
                (full_name, company_name, next_status, invited_at, user_id),
            )
            conn.execute(
                "UPDATE auth_tokens SET used_at=? WHERE user_id=? AND token_type='invite' AND used_at IS NULL",
                (invited_at, user_id),
            )
        workspace = ensure_workspace_for_signup(conn, signup=signup, user_id=user_id)
        raw_token = create_auth_token(conn, user_id=user_id, token_type="invite", expires_in_hours=INVITE_TOKEN_HOURS)
        conn.execute(
            "UPDATE founding_user_signups SET invite_status='invited', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (signup_id,),
        )
        conn.commit()
    invite_link = build_app_url(f"/activate/{raw_token}")
    delivery = send_invite_email_if_enabled(
        recipient_email=email,
        recipient_name=full_name,
        invite_link=invite_link,
        workspace_name=(workspace["display_name"] or "Repurly workspace"),
    )
    record_audit_event(
        "customer_invited",
        actor=actor,
        message=f"Invite link generated for {email}.",
        payload={"signup_id": signup_id, "email": email, "workspace_id": workspace["id"], "workspace": workspace["display_name"], "email_delivery": delivery},
    )
    return redirect(url_for("ops_billing", saved="invite_created", invite_link=invite_link, email=email, workspace_name=workspace["display_name"]))


@app.post("/ops/users/<int:user_id>/reset-link")
def ops_generate_reset_link(user_id: int):
    actor = (request.form.get("actor") or "ops_console").strip()
    with get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if user is None:
            abort(404)
        stamped = utcnow_iso()
        conn.execute(
            "UPDATE auth_tokens SET used_at=? WHERE user_id=? AND token_type='password_reset' AND used_at IS NULL",
            (stamped, user_id),
        )
        raw_token = create_auth_token(conn, user_id=user_id, token_type="password_reset", expires_in_hours=RESET_TOKEN_HOURS)
        conn.commit()
    reset_link = build_app_url(f"/reset-password/{raw_token}")
    delivery = send_reset_email_if_enabled(
        recipient_email=(user["email"] or "").strip().lower(),
        recipient_name=(user["full_name"] or "").strip(),
        reset_link=reset_link,
    )
    record_audit_event(
        "password_reset_link_created",
        actor=actor,
        message=f"Password reset link generated for {user['email']}.",
        payload={"user_id": user_id, "email": user["email"], "email_delivery": delivery},
    )
    return redirect(url_for("ops_billing", saved="reset_link_created", reset_link=reset_link, email=user["email"]))


@app.post("/ops/signups/<int:signup_id>/sync-billing")
def ops_sync_signup_billing(signup_id: int):
    with get_conn() as conn:
        signup = conn.execute("SELECT * FROM founding_user_signups WHERE id=?", (signup_id,)).fetchone()
        if signup is None:
            abort(404)
        user = conn.execute("SELECT * FROM users WHERE lower(email)=?", (((signup["email"] or "").strip().lower()),)).fetchone()
        workspace = None
        if user is not None:
            workspace = conn.execute(
                """
                SELECT w.*
                FROM workspace_memberships wm
                JOIN workspaces w ON w.id = wm.workspace_id
                WHERE wm.user_id=? AND lower(ifnull(wm.status, 'active'))='active'
                ORDER BY wm.id ASC LIMIT 1
                """,
                (user["id"],),
            ).fetchone()
    try:
        sync_result = sync_latest_subscription_for_customer(
            billing_email=((signup["email"] or "").strip().lower()),
            user_id=int(user["id"]) if user is not None else None,
            workspace_id=int(workspace["id"]) if workspace is not None else None,
            stripe_customer_id=(user["stripe_customer_id"] or "").strip() if user is not None and "stripe_customer_id" in user.keys() else "",
        )
        return redirect(url_for("ops_billing", saved="billing_synced", email=signup["email"], workspace_name=(workspace["display_name"] if workspace is not None else ""), sync_count=sync_result.get("synced_count", 0)))
    except RuntimeError as exc:
        return redirect(url_for("ops_billing", saved="billing_sync_error", email=signup["email"], workspace_name=(workspace["display_name"] if workspace is not None else ""), error=str(exc)))
    except Exception as exc:
        return redirect(url_for("ops_billing", saved="billing_sync_error", email=signup["email"], workspace_name=(workspace["display_name"] if workspace is not None else ""), error=f"Unexpected sync error: {exc}"))


@app.get("/api/ops/summary")
def api_ops_summary():
    schedule_df = load_schedule_df()
    payload = {
        "brands": len(fetch_brands()),
        "scheduled_posts": len(schedule_df.index),
        "status_counts": count_values(schedule_df, "status"),
        "approval_counts": count_values(schedule_df, "approval_status"),
    }
    return jsonify(payload)


def load_schedule_df() -> pd.DataFrame:
    ensure_base_dirs()
    if not SCHEDULE_CSV.exists():
        return pd.DataFrame(columns=["post_id", "brand", "status", "approval_status", "post_date", "post_time", "notes"])
    df = load_csv(SCHEDULE_CSV)
    return normalise_optional_columns(df, OPTIONAL_SCHEDULE_COLUMNS)


def count_values(df: pd.DataFrame, column: str) -> list[dict[str, Any]]:
    if df.empty or column not in df.columns:
        return []
    counts = (
        df[column]
        .fillna("")
        .replace({"": "<blank>"})
        .value_counts(dropna=False)
        .reset_index()
    )
    counts.columns = ["label", "count"]
    return counts.to_dict(orient="records")


def fetch_rows(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with get_conn() as conn:
        return [dict(row) for row in conn.execute(query, params).fetchall()]


def fetch_brands() -> list[dict[str, Any]]:
    return fetch_rows(
        """
        SELECT b.*, w.display_name AS workspace_display_name, COUNT(s.id) AS scheduled_posts
        FROM brands b
        LEFT JOIN workspaces w ON w.id = b.workspace_id
        LEFT JOIN schedules s ON s.brand_id = b.id
        GROUP BY b.id, w.display_name
        ORDER BY b.display_name COLLATE NOCASE ASC
        """
    )


def all_schedule_values(column: str) -> list[str]:
    df = load_schedule_df()
    if df.empty or column not in df.columns:
        return []
    values = []
    for item in df[column].tolist():
        item = (item or "").strip()
        if item:
            values.append(item)
    return sorted(set(values))


def all_brand_slugs() -> list[str]:
    return [row["slug"] for row in fetch_rows("SELECT slug FROM brands ORDER BY slug ASC")]


def apply_schedule_filters(
    schedule_df: pd.DataFrame,
    *,
    brand: str = "",
    status: str = "",
    approval_status: str = "",
    post_date: str = "",
    search: str = "",
) -> pd.DataFrame:
    if schedule_df.empty:
        return schedule_df
    filtered = schedule_df.copy()
    if brand:
        filtered = filtered.loc[filtered["brand"].str.lower() == brand]
    if status:
        filtered = filtered.loc[filtered["status"].str.lower() == status]
    if approval_status:
        filtered = filtered.loc[filtered["approval_status"].str.lower() == approval_status]
    if post_date:
        filtered = filtered.loc[filtered["post_date"] == post_date]
    if search:
        search_mask = (
            filtered["post_id"].str.lower().str.contains(search)
            | filtered["brand"].str.lower().str.contains(search)
            | filtered["theme"].str.lower().str.contains(search)
            | filtered["campaign"].str.lower().str.contains(search)
            | filtered["notes"].str.lower().str.contains(search)
        )
        filtered = filtered.loc[search_mask]
    return filtered


def attach_existing_assets_to_post(
    post_id: str,
    asset_ids: list[int],
    *,
    actor: str,
    replace_existing: bool = False,
    switch_post_type: bool = True,
) -> list[dict[str, Any]]:
    if not asset_ids:
        raise ValueError("Select at least one existing asset to attach.")

    schedule_df = load_schedule_df()
    mask = schedule_df["post_id"] == post_id
    if not mask.any():
        abort(404)

    row = schedule_df.loc[mask].iloc[0].to_dict()
    brand_slug = (row.get("brand") or "").strip()
    content_folder = build_content_date_folder(brand_slug, (row.get("post_date") or "").strip())
    asset_dir = content_folder / "assets"
    brand_id = get_brand_id(brand_slug)
    if brand_id is None:
        raise ValueError(f"Brand '{brand_slug}' is not present in SQLite, so existing assets cannot be attached yet.")

    placeholders = ",".join(["?"] * len(asset_ids))
    query = f"SELECT * FROM assets WHERE brand_id=? AND id IN ({placeholders}) ORDER BY id DESC"
    rows = fetch_rows(query, tuple([brand_id] + asset_ids))
    if not rows:
        raise ValueError("No matching existing assets were found for this brand.")

    copied_assets: list[dict[str, Any]] = []
    for asset in rows:
        source_path = Path(asset["file_path"]).expanduser()
        if not source_path.exists():
            raise FileNotFoundError(f"Existing asset file is missing on disk: {source_path.as_posix()}")
        if source_path.parent.resolve() == asset_dir.resolve():
            target_name = source_path.name
            target_path = source_path
        else:
            target_name = build_unique_upload_name(asset_dir, asset.get("file_name") or source_path.name)
            target_path = asset_dir / target_name
            shutil.copy2(source_path, target_path)
        mime_type = asset.get("mime_type") or detect_upload_mime_type(target_path.name)
        copied_assets.append({
            "asset_id": asset["id"],
            "file_name": target_name,
            "file_path": target_path.as_posix(),
            "mime_type": mime_type,
            "asset_kind": asset.get("asset_kind") or classify_asset_kind(mime_type),
        })

    existing_assets = [] if replace_existing else normalise_asset_filenames(row.get("asset_filename", ""))
    combined_assets = existing_assets + [item["file_name"] for item in copied_assets]
    updated_post_type = (row.get("post_type") or "").strip().lower()
    contains_image_asset = any(item["asset_kind"] == "image" for item in copied_assets)
    if switch_post_type and combined_assets and contains_image_asset and updated_post_type in {"", "text"}:
        updated_post_type = "image"

    schedule_df.loc[mask, "asset_filename"] = "|".join(combined_assets)
    if updated_post_type:
        schedule_df.loc[mask, "post_type"] = updated_post_type
    schedule_df.loc[mask, "asset_mode"] = determine_linkedin_asset_mode(updated_post_type, "|".join(combined_assets))
    save_csv(schedule_df, SCHEDULE_CSV)

    record_audit_event(
        "assets_attached",
        post_id=post_id,
        brand_slug=brand_slug,
        platform=(row.get("platform") or "").strip().lower(),
        actor=actor or "ops_console",
        message=f"Attached {len(copied_assets)} existing asset(s) from the asset library.",
        payload={
            "replace_existing": replace_existing,
            "switch_post_type": switch_post_type,
            "asset_ids": asset_ids,
            "files": [item["file_name"] for item in copied_assets],
        },
    )
    return copied_assets


def build_unique_upload_name(directory: Path, raw_name: str) -> str:
    cleaned = secure_filename(raw_name or "")
    if not cleaned:
        raise ValueError("Uploaded file is missing a valid filename.")
    candidate = cleaned
    stem = Path(cleaned).stem or "asset"
    suffix = Path(cleaned).suffix
    counter = 2
    while (directory / candidate).exists():
        candidate = f"{stem}_{counter}{suffix}"
        counter += 1
    return candidate


def allowed_upload_extensions() -> set[str]:
    return {item.strip().lower().lstrip(".") for item in ALLOWED_UPLOAD_EXTENSIONS if item.strip()}


def detect_upload_mime_type(filename: str, declared_mime_type: str = "") -> str:
    guessed = mimetypes.guess_type(filename)[0] or ""
    declared = (declared_mime_type or "").split(";", 1)[0].strip().lower()
    return guessed or declared or "application/octet-stream"


def classify_asset_kind(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("video/"):
        return "video"
    if mime_type == "application/pdf":
        return "document"
    return "file"


def uploaded_file_size(storage: Any) -> int:
    stream = getattr(storage, "stream", None)
    if stream is None or not hasattr(stream, "seek") or not hasattr(stream, "tell"):
        return 0
    current = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current)
    return max(size, 0)


def validate_uploaded_asset(storage: Any, target_name: str) -> tuple[str, str, int]:
    extension = Path(target_name).suffix.lower().lstrip(".")
    allowed_extensions = allowed_upload_extensions()
    if allowed_extensions and extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise ValueError(f"Unsupported file type '.{extension}'. Allowed: {allowed}.")

    mime_type = detect_upload_mime_type(target_name, getattr(storage, "mimetype", ""))
    asset_kind = classify_asset_kind(mime_type)
    if asset_kind not in {"image", "video", "document"}:
        raise ValueError("Only image, video, and PDF uploads are supported right now.")

    size_bytes = uploaded_file_size(storage)
    if size_bytes > UPLOAD_MAX_BYTES:
        raise ValueError(f"File '{target_name}' exceeds the {UPLOAD_MAX_BYTES // (1024 * 1024)} MB upload limit.")

    return mime_type, asset_kind, size_bytes


def get_brand_id(brand_slug: str) -> int | None:
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM brands WHERE slug=?", (brand_slug,)).fetchone()
    return None if row is None else int(row["id"])


def save_uploaded_assets_for_post(
    post_id: str,
    uploaded_files: list[Any],
    *,
    actor: str,
    replace_existing: bool = False,
    switch_post_type: bool = True,
) -> list[dict[str, Any]]:
    schedule_df = load_schedule_df()
    mask = schedule_df["post_id"] == post_id
    if not mask.any():
        abort(404)

    row = schedule_df.loc[mask].iloc[0].to_dict()
    brand_slug = (row.get("brand") or "").strip()
    content_folder = build_content_date_folder(brand_slug, (row.get("post_date") or "").strip())
    asset_dir = content_folder / "assets"

    saved_assets: list[dict[str, Any]] = []
    for storage in uploaded_files:
        if storage is None or not getattr(storage, "filename", ""):
            continue
        output_name = build_unique_upload_name(asset_dir, storage.filename)
        mime_type, asset_kind, size_bytes = validate_uploaded_asset(storage, output_name)
        target_path = asset_dir / output_name
        storage.save(target_path)
        saved_assets.append(
            {
                "file_name": output_name,
                "file_path": target_path.as_posix(),
                "mime_type": mime_type,
                "asset_kind": asset_kind,
                "size_bytes": size_bytes,
            }
        )

    if not saved_assets:
        raise ValueError("Select at least one asset file to upload.")

    existing_assets = [] if replace_existing else normalise_asset_filenames(row.get("asset_filename", ""))
    combined_assets = existing_assets + [item["file_name"] for item in saved_assets]
    updated_post_type = (row.get("post_type") or "").strip().lower()
    contains_image_asset = any(item["asset_kind"] == "image" for item in saved_assets)
    if switch_post_type and combined_assets and contains_image_asset and updated_post_type in {"", "text"}:
        updated_post_type = "image"

    schedule_df.loc[mask, "asset_filename"] = "|".join(combined_assets)
    if updated_post_type:
        schedule_df.loc[mask, "post_type"] = updated_post_type
    schedule_df.loc[mask, "asset_mode"] = determine_linkedin_asset_mode(updated_post_type, "|".join(combined_assets))
    save_csv(schedule_df, SCHEDULE_CSV)

    brand_id = get_brand_id(brand_slug)
    if brand_id is not None:
        with get_conn() as conn:
            for item in saved_assets:
                conn.execute(
                    """
                    INSERT INTO assets (brand_id, file_name, file_path, mime_type, asset_kind, status)
                    VALUES (?, ?, ?, ?, ?, 'active')
                    """,
                    (brand_id, item["file_name"], item["file_path"], item["mime_type"], item["asset_kind"]),
                )
            conn.commit()

    record_audit_event(
        "assets_uploaded",
        post_id=post_id,
        brand_slug=brand_slug,
        platform=(row.get("platform") or "").strip().lower(),
        actor=actor or "ops_console",
        message=f"Uploaded {len(saved_assets)} asset(s) from ops console.",
        payload={
            "replace_existing": replace_existing,
            "switch_post_type": switch_post_type,
            "files": [item["file_name"] for item in saved_assets],
        },
    )
    return saved_assets


def get_schedule_row(post_id: str) -> dict[str, Any]:
    schedule_df = load_schedule_df()
    match = schedule_df.loc[schedule_df["post_id"] == post_id]
    if match.empty:
        abort(404)
    return match.iloc[0].to_dict()


def update_schedule_review_status(
    post_id: str,
    *,
    approval_status: str,
    status: str,
    actor: str,
    reason: str = "",
) -> None:
    schedule_df = load_schedule_df()
    mask = schedule_df["post_id"] == post_id
    if not mask.any():
        abort(404)

    row = schedule_df.loc[mask].iloc[0]
    schedule_df.loc[mask, "approval_status"] = approval_status
    schedule_df.loc[mask, "status"] = status
    if reason:
        existing_notes = (row.get("notes") or "").strip()
        reason_text = f"Rejection reason: {reason}"
        schedule_df.loc[mask, "notes"] = f"{existing_notes}\n{reason_text}".strip()

    save_csv(schedule_df, SCHEDULE_CSV)
    record_audit_event(
        "draft_approved" if approval_status == "approved" else "draft_rejected",
        post_id=post_id,
        brand_slug=(row.get("brand") or "").strip(),
        platform=(row.get("platform") or "").strip(),
        actor=actor or "ops_console",
        message=reason or ("Draft approved from ops console." if approval_status == "approved" else "Draft rejected from ops console."),
        payload={"approval_status": approval_status, "status": status, "reason": reason},
    )


if __name__ == "__main__":
    ensure_base_dirs()
    port = int(os.getenv("PORT", "5050"))
    debug = os.getenv("FLASK_DEBUG", "false").strip().lower() in {"1", "true", "yes", "y", "on"}
    app.run(debug=debug, port=port)
