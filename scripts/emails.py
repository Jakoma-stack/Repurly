from __future__ import annotations

import smtplib
import sqlite3
from email.message import EmailMessage
from typing import Any

from config import (
    APP_DB,
    APP_BASE_URL,
    EMAIL_FROM,
    EMAIL_REPLY_TO,
    PUBLIC_SUPPORT_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_USE_TLS,
)
from init_db import ensure_runtime_schema


def smtp_enabled() -> bool:
    return bool(SMTP_HOST and EMAIL_FROM)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(APP_DB)
    conn.row_factory = sqlite3.Row
    ensure_runtime_schema(conn)
    return conn


def _record_delivery(email_type: str, recipient_email: str, subject: str, status: str, error_message: str = "") -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO email_delivery_log (email_type, recipient_email, subject, delivery_status, provider, error_message) VALUES (?, ?, ?, ?, 'smtp', ?)",
            (email_type, recipient_email, subject, status, error_message),
        )
        conn.commit()


def send_replury_email(*, recipient_email: str, subject: str, body_text: str, email_type: str) -> dict[str, Any]:
    recipient_email = (recipient_email or "").strip().lower()
    if not recipient_email:
        raise RuntimeError("Recipient email is required.")
    if not smtp_enabled():
        _record_delivery(email_type, recipient_email, subject, "manual_only", "SMTP not configured")
        return {"ok": False, "manual_only": True, "reason": "SMTP not configured"}

    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = recipient_email
    message["Subject"] = subject
    if EMAIL_REPLY_TO:
        message["Reply-To"] = EMAIL_REPLY_TO
    message.set_content(body_text)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception as exc:  # pragma: no cover - network/provider dependent
        _record_delivery(email_type, recipient_email, subject, "failed", str(exc))
        return {"ok": False, "manual_only": False, "reason": str(exc)}

    _record_delivery(email_type, recipient_email, subject, "sent")
    return {"ok": True, "manual_only": False}


def invite_email_body(*, recipient_name: str, invite_link: str, workspace_name: str) -> str:
    greeting = recipient_name.strip() or "there"
    return (
        f"Hi {greeting},\n\n"
        f"You have been invited to join the {workspace_name} workspace in Repurly.\n\n"
        f"Open this secure invite link to set your password and access the workspace:\n{invite_link}\n\n"
        f"If you were not expecting this invite, reply to {PUBLIC_SUPPORT_EMAIL}.\n\n"
        f"Repurly\n{APP_BASE_URL}"
    )


def reset_email_body(*, recipient_name: str, reset_link: str) -> str:
    greeting = recipient_name.strip() or "there"
    return (
        f"Hi {greeting},\n\n"
        "We received a request to reset your Repurly password.\n\n"
        f"Open this secure reset link to choose a new password:\n{reset_link}\n\n"
        f"If you did not request this, you can ignore this email or contact {PUBLIC_SUPPORT_EMAIL}.\n\n"
        f"Repurly\n{APP_BASE_URL}"
    )




def welcome_email_body(*, recipient_name: str, setup_link: str, workspace_name: str, plan_name: str) -> str:
    greeting = recipient_name.strip() or "there"
    return (
        f"Hi {greeting},\n\n"
        f"Welcome to Repurly. Your {workspace_name} workspace is ready on the {plan_name} plan.\n\n"
        "Finish setting up your account using this secure link:\n"
        f"{setup_link}\n\n"
        "Once you are in, Repurly will walk you through these steps:\n"
        "1. Set your password and sign in\n"
        "2. Add your brand details\n"
        "3. Upload your logo and starter assets\n"
        "4. Generate your first draft posts\n\n"
        f"Need help? Reply to {PUBLIC_SUPPORT_EMAIL}.\n\n"
        f"Repurly\n{APP_BASE_URL}"
    )


def billing_email_body(*, recipient_name: str, workspace_name: str, plan_name: str, portal_url: str) -> str:
    greeting = recipient_name.strip() or "there"
    return (
        f"Hi {greeting},\n\n"
        f"Your {workspace_name} workspace is active on the {plan_name} plan.\n\n"
        f"You can manage payment method, invoices and subscription changes here:\n{portal_url}\n\n"
        f"Need help? Reply to {PUBLIC_SUPPORT_EMAIL}.\n\n"
        f"Repurly\n{APP_BASE_URL}"
    )
