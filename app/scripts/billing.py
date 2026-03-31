from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
import time
from dataclasses import dataclass
from typing import Any

from config import APP_DB, BILLING_PORTAL_RETURN_PATH, STRIPE_BILLING_PORTAL_CONFIGURATION_ID
from init_db import ensure_runtime_schema

try:  # pragma: no cover - import availability varies by environment
    import stripe  # type: ignore
except ImportError:  # pragma: no cover
    stripe = None


@dataclass
class BillingConfig:
    secret_key: str
    webhook_secret: str
    agency_price_id: str
    app_base_url: str
    billing_portal_configuration_id: str
    billing_portal_return_path: str


PLAN_ALIASES = {
    "agency": "agency",
    "starter": "agency",
    "growth": "agency",
    "pro": "agency",
    "founding": "agency",
    "founding_starter": "agency",
    "founding_growth": "agency",
    "founding_plus": "agency",
    "linkedin-first": "agency",
    "linkedin_first": "agency",
    "linkedin first": "agency",
}

PLAN_TO_ENV = {
    "agency": "STRIPE_PRICE_AGENCY",
}

WORKSPACE_ACCESS_STATUSES = {"active", "trialing"}


def normalise_plan_name(plan_name: str) -> str:
    raw = (plan_name or "").strip().lower()
    return PLAN_ALIASES.get(raw, raw)


def get_billing_config() -> BillingConfig:
    return BillingConfig(
        secret_key=os.getenv("STRIPE_SECRET_KEY", "").strip(),
        webhook_secret=os.getenv("STRIPE_WEBHOOK_SECRET", "").strip(),
        agency_price_id=(os.getenv("STRIPE_PRICE_AGENCY", "").strip() or os.getenv("STRIPE_PRICE_GROWTH", "").strip() or os.getenv("STRIPE_PRICE_STARTER", "").strip() or os.getenv("STRIPE_PRICE_PRO", "").strip()),
        app_base_url=os.getenv("APP_BASE_URL", "https://app.repurly.org").rstrip("/"),
        billing_portal_configuration_id=os.getenv("STRIPE_BILLING_PORTAL_CONFIGURATION_ID", STRIPE_BILLING_PORTAL_CONFIGURATION_ID).strip(),
        billing_portal_return_path=os.getenv("BILLING_PORTAL_RETURN_PATH", BILLING_PORTAL_RETURN_PATH).strip() or "/account/billing",
    )


def price_id_for_plan(plan_name: str, cfg: BillingConfig | None = None) -> str:
    cfg = cfg or get_billing_config()
    canonical_plan = normalise_plan_name(plan_name)
    lookup = {
        "agency": cfg.agency_price_id,
    }
    return lookup.get(canonical_plan, "")


def plan_name_for_price_id(price_id: str, cfg: BillingConfig | None = None) -> str:
    cfg = cfg or get_billing_config()
    mapping = {
        cfg.agency_price_id: "agency",
    }
    return mapping.get((price_id or "").strip(), "")


def subscription_allows_workspace_access(status: str | None) -> bool:
    return (status or "").strip().lower() in WORKSPACE_ACCESS_STATUSES


def require_stripe_sdk() -> Any:
    if stripe is None:
        raise RuntimeError("Stripe SDK not installed. Add 'stripe' to requirements and install dependencies.")
    return stripe


def build_checkout_url(base_url: str, path: str) -> str:
    cleaned = (path or "").strip() or "/"
    if not cleaned.startswith("/"):
        cleaned = f"/{cleaned}"
    return f"{base_url}{cleaned}"


def normalise_public_app_base_url(candidate: str | None, fallback: str) -> str:
    value = (candidate or "").strip().rstrip("/")
    fallback_value = (fallback or "").strip().rstrip("/") or "https://app.repurly.org"
    if not value:
        return fallback_value
    lowered = value.lower()
    if "replury.org" in lowered:
        return fallback_value
    if lowered.endswith(".onrender.com") or "beta.repurly.org" in lowered:
        return fallback_value
    return value


def stripe_object_to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    converter = getattr(obj, "to_dict_recursive", None)
    if callable(converter):
        return converter()
    if isinstance(obj, dict):
        return obj
    return dict(obj)




def retrieve_checkout_session(session_id: str) -> dict[str, Any]:
    cfg = get_billing_config()
    if not cfg.secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is missing.")
    if not (session_id or "").strip():
        raise RuntimeError("Stripe checkout session ID is missing.")
    stripe_sdk = require_stripe_sdk()
    stripe_sdk.api_key = cfg.secret_key
    session = stripe_sdk.checkout.Session.retrieve((session_id or "").strip(), expand=["subscription", "customer_details"])
    return stripe_object_to_dict(session)


def create_checkout_session(
    *,
    email: str,
    plan_name: str,
    signup_id: int | None = None,
    user_id: int | None = None,
    workspace_id: int | None = None,
    success_path: str = "/beta?billing=success",
    cancel_path: str = "/beta?billing=cancelled",
    app_base_url: str | None = None,
) -> dict[str, Any]:
    cfg = get_billing_config()
    public_app_base_url = normalise_public_app_base_url(app_base_url, cfg.app_base_url)
    canonical_plan = normalise_plan_name(plan_name)
    price_id = price_id_for_plan(canonical_plan, cfg)
    if not cfg.secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is missing.")
    if not price_id:
        raise RuntimeError(f"No Stripe price configured for plan '{plan_name}'.")

    stripe_sdk = require_stripe_sdk()
    stripe_sdk.api_key = cfg.secret_key
    metadata = {
        "signup_id": str(signup_id or ""),
        "selected_plan": canonical_plan,
        "user_id": str(user_id or ""),
        "workspace_id": str(workspace_id or ""),
        "billing_email": (email or "").strip().lower(),
    }
    session = stripe_sdk.checkout.Session.create(
        mode="subscription",
        customer_email=email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=build_checkout_url(public_app_base_url, success_path),
        cancel_url=build_checkout_url(public_app_base_url, cancel_path),
        client_reference_id=str(signup_id or workspace_id or user_id or ""),
        metadata=metadata,
        subscription_data={"metadata": metadata},
        allow_promotion_codes=True,
    )
    return {
        "id": session.id,
        "url": session.url,
        "price_id": price_id,
        "plan_name": canonical_plan,
    }


def _parse_signature_header(sig_header: str) -> tuple[int, list[str]]:
    timestamp = 0
    signatures: list[str] = []
    for part in (sig_header or "").split(","):
        key, _, value = part.partition("=")
        if key == "t" and value.isdigit():
            timestamp = int(value)
        elif key == "v1" and value:
            signatures.append(value)
    return timestamp, signatures


def verify_stripe_webhook_signature(payload: bytes, sig_header: str, secret: str, tolerance: int = 300) -> bool:
    if not secret:
        return False
    timestamp, signatures = _parse_signature_header(sig_header)
    if not timestamp or not signatures:
        return False
    if abs(int(time.time()) - timestamp) > tolerance:
        return False
    signed_payload = f"{timestamp}.".encode("utf-8") + payload
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, sig) for sig in signatures)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(APP_DB)
    conn.row_factory = sqlite3.Row
    ensure_runtime_schema(conn)
    return conn


def _normalise_billing_email(email: str) -> str:
    return (email or "").strip().lower()


def _stripe_data_list(obj: Any) -> list[Any]:
    data = getattr(obj, "data", None)
    if data is not None:
        return list(data or [])
    if isinstance(obj, dict):
        raw = obj.get("data")
        if isinstance(raw, list):
            return raw
    return []


def _customer_matches_email(customer_obj: Any, billing_email: str) -> bool:
    customer_dict = stripe_object_to_dict(customer_obj)
    return _normalise_billing_email(customer_dict.get("email") or "") == billing_email


WORKSPACE_ACCESS_STATUSES_ORDER = {"active": 0, "trialing": 1}


def _subscription_sort_key(subscription_obj: dict[str, Any]) -> tuple[int, int, str]:
    status = (subscription_obj.get("status") or "").strip().lower()
    created = int(subscription_obj.get("created") or 0)
    return (WORKSPACE_ACCESS_STATUSES_ORDER.get(status, 9), -created, (subscription_obj.get("id") or "").strip())


def _list_customer_candidates(stripe_sdk: Any, billing_email: str, preferred_customer_id: str = "") -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_customer(raw_customer: Any) -> None:
        customer = stripe_object_to_dict(raw_customer)
        customer_id = (customer.get("id") or "").strip()
        if not customer_id or customer_id in seen:
            return
        if billing_email and _normalise_billing_email(customer.get("email") or "") != billing_email:
            return
        seen.add(customer_id)
        candidates.append(customer)

    if preferred_customer_id:
        try:
            add_customer(stripe_sdk.Customer.retrieve(preferred_customer_id))
        except Exception:
            pass

    search_api = getattr(stripe_sdk.Customer, "search", None)
    if callable(search_api) and billing_email:
        try:
            query = "email:'{}'".format(billing_email.replace("'", r"\'"))
            for customer in _stripe_data_list(search_api(query=query, limit=20)):
                add_customer(customer)
        except Exception:
            pass

    if billing_email:
        try:
            for customer in _stripe_data_list(stripe_sdk.Customer.list(email=billing_email, limit=20)):
                add_customer(customer)
        except Exception:
            pass

    if billing_email and not candidates:
        try:
            for customer in _stripe_data_list(stripe_sdk.Customer.list(limit=100)):
                add_customer(customer)
        except Exception:
            pass

    return candidates


def _list_subscriptions_for_customer(stripe_sdk: Any, customer_id: str) -> list[dict[str, Any]]:
    subscriptions = stripe_sdk.Subscription.list(customer=customer_id, status="all", limit=20)
    items = [stripe_object_to_dict(item) for item in _stripe_data_list(subscriptions)]
    items.sort(key=_subscription_sort_key)
    return items


def resolve_customer_and_subscriptions_for_email(
    *,
    billing_email: str,
    preferred_customer_id: str = "",
) -> tuple[str, list[dict[str, Any]]]:
    billing_email = _normalise_billing_email(billing_email)
    if not billing_email and not preferred_customer_id:
        return "", []

    stripe_sdk = require_stripe_sdk()
    cfg = get_billing_config()
    if not cfg.secret_key:
        return "", []
    stripe_sdk.api_key = cfg.secret_key

    candidates = _list_customer_candidates(stripe_sdk, billing_email, preferred_customer_id)
    if not candidates:
        return "", []

    ranked: list[tuple[tuple[int, int, str], dict[str, Any], list[dict[str, Any]]]] = []
    for customer in candidates:
        customer_id = (customer.get("id") or "").strip()
        if not customer_id:
            continue
        try:
            subscriptions = _list_subscriptions_for_customer(stripe_sdk, customer_id)
        except Exception:
            subscriptions = []
        if subscriptions:
            top_key = _subscription_sort_key(subscriptions[0])
        else:
            top_key = (99, -int(customer.get("created") or 0), customer_id)
        ranked.append((top_key, customer, subscriptions))

    if not ranked:
        return "", []

    ranked.sort(key=lambda item: item[0])
    _, best_customer, best_subscriptions = ranked[0]
    return (best_customer.get("id") or "").strip(), best_subscriptions


def fetch_stripe_customer_id_by_email(email: str) -> str:
    customer_id, _ = resolve_customer_and_subscriptions_for_email(billing_email=email)
    return customer_id


def create_billing_portal_session(*, customer_id: str = "", email: str = "", return_path: str | None = None) -> dict[str, Any]:
    cfg = get_billing_config()
    if not cfg.secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is missing.")
    stripe_sdk = require_stripe_sdk()
    stripe_sdk.api_key = cfg.secret_key

    resolved_customer_id = (customer_id or "").strip() or fetch_stripe_customer_id_by_email(email)
    if not resolved_customer_id:
        raise RuntimeError("No Stripe customer record was found for this account yet.")

    payload: dict[str, Any] = {
        "customer": resolved_customer_id,
        "return_url": build_checkout_url(cfg.app_base_url, return_path or cfg.billing_portal_return_path),
    }
    if cfg.billing_portal_configuration_id:
        payload["configuration"] = cfg.billing_portal_configuration_id
    session = stripe_sdk.billing_portal.Session.create(**payload)
    return {
        "id": session.id,
        "url": session.url,
        "customer_id": resolved_customer_id,
    }


def sync_latest_subscription_for_customer(
    *,
    billing_email: str,
    user_id: int | None = None,
    workspace_id: int | None = None,
    stripe_customer_id: str = "",
) -> dict[str, Any]:
    cfg = get_billing_config()
    if not cfg.secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is missing.")

    try:
        resolved_customer_id, subscriptions = resolve_customer_and_subscriptions_for_email(
            billing_email=billing_email,
            preferred_customer_id=(stripe_customer_id or "").strip(),
        )
    except Exception as exc:
        raise RuntimeError(f"Stripe customer lookup failed: {exc}") from exc
    if not resolved_customer_id:
        raise RuntimeError("No Stripe customer was found for this billing email yet.")

    if user_id is not None:
        with get_conn() as conn:
            conn.execute(
                "UPDATE users SET stripe_customer_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (resolved_customer_id, user_id),
            )
            conn.commit()

    synced_count = 0
    latest_status = ""
    latest_plan = ""
    for subscription_dict in subscriptions:
        metadata = subscription_dict.setdefault("metadata", {})
        if user_id is not None and not metadata.get("user_id"):
            metadata["user_id"] = str(user_id)
        if workspace_id is not None and not metadata.get("workspace_id"):
            metadata["workspace_id"] = str(workspace_id)
        if billing_email and not metadata.get("billing_email"):
            metadata["billing_email"] = billing_email.strip().lower()
        upsert_subscription_from_event(subscription_dict)
        synced_count += 1
        if not latest_status:
            latest_status = (subscription_dict.get("status") or "").strip()
            price = (((subscription_dict.get("items") or {}).get("data") or [{}])[0].get("price") or {})
            latest_plan = normalise_plan_name(metadata.get("selected_plan", "")) or plan_name_for_price_id((price.get("id") or "").strip())

    return {
        "ok": True,
        "customer_id": resolved_customer_id,
        "synced_count": synced_count,
        "status": latest_status,
        "plan_name": latest_plan,
    }


def store_checkout_session_reference(session_obj: dict[str, Any]) -> None:
    metadata = session_obj.get("metadata") or {}
    signup_id = str(session_obj.get("client_reference_id") or metadata.get("signup_id") or "").strip()
    billing_email = (session_obj.get("customer_details") or {}).get("email") or metadata.get("billing_email") or ""
    if signup_id.isdigit():
        with get_conn() as conn:
            conn.execute(
                "UPDATE founding_user_signups SET stripe_checkout_session_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (session_obj.get("id", ""), int(signup_id)),
            )
            if billing_email:
                conn.execute(
                    "UPDATE founding_user_signups SET email=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND (email IS NULL OR email='')",
                    ((billing_email or "").strip().lower(), int(signup_id)),
                )
            conn.commit()


def upsert_subscription_from_event(subscription_obj: dict[str, Any]) -> None:
    customer_id = (subscription_obj.get("customer") or "").strip()
    subscription_id = (subscription_obj.get("id") or "").strip()
    if not customer_id or not subscription_id:
        return

    price = (((subscription_obj.get("items") or {}).get("data") or [{}])[0].get("price") or {})
    price_id = (price.get("id") or "").strip()
    metadata = subscription_obj.get("metadata") or {}
    user_id_raw = str(metadata.get("user_id") or "").strip()
    workspace_id_raw = str(metadata.get("workspace_id") or "").strip()
    user_id = int(user_id_raw) if user_id_raw.isdigit() else None
    workspace_id = int(workspace_id_raw) if workspace_id_raw.isdigit() else None
    canonical_plan = normalise_plan_name(metadata.get("selected_plan", "")) or plan_name_for_price_id(price_id)
    billing_email = (
        (subscription_obj.get("customer_email") or "").strip().lower()
        or str(metadata.get("billing_email") or "").strip().lower()
    )

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO subscriptions (
                user_id, workspace_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
                plan_name, status, billing_email, started_at, current_period_end,
                cancel_at_period_end, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(stripe_subscription_id) DO UPDATE SET
                user_id=excluded.user_id,
                workspace_id=excluded.workspace_id,
                stripe_customer_id=excluded.stripe_customer_id,
                stripe_price_id=excluded.stripe_price_id,
                plan_name=excluded.plan_name,
                status=excluded.status,
                billing_email=excluded.billing_email,
                started_at=excluded.started_at,
                current_period_end=excluded.current_period_end,
                cancel_at_period_end=excluded.cancel_at_period_end,
                metadata_json=excluded.metadata_json,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                user_id,
                workspace_id,
                customer_id,
                subscription_id,
                price_id,
                canonical_plan,
                (subscription_obj.get("status") or "").strip(),
                billing_email,
                str(subscription_obj.get("start_date") or ""),
                str(subscription_obj.get("current_period_end") or ""),
                1 if subscription_obj.get("cancel_at_period_end") else 0,
                json.dumps(subscription_obj),
            ),
        )
        if user_id is not None:
            conn.execute(
                "UPDATE users SET stripe_customer_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (customer_id, user_id),
            )
        elif billing_email:
            conn.execute(
                "UPDATE users SET stripe_customer_id=?, updated_at=CURRENT_TIMESTAMP WHERE lower(email)=? AND (stripe_customer_id IS NULL OR stripe_customer_id='')",
                (customer_id, billing_email),
            )
        if workspace_id is not None:
            conn.execute(
                "UPDATE workspaces SET selected_plan=COALESCE(?, selected_plan), updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (canonical_plan or None, workspace_id),
            )
        conn.commit()


def record_webhook_event(event_id: str, event_type: str, payload: dict[str, Any]) -> bool:
    if not event_id:
        return True
    payload_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM webhook_events WHERE stripe_event_id=?", (event_id,)).fetchone()
        if existing:
            return False
        conn.execute(
            "INSERT INTO webhook_events (stripe_event_id, event_type, payload_hash, payload_json) VALUES (?, ?, ?, ?)",
            (event_id, event_type, payload_hash, json.dumps(payload)),
        )
        conn.commit()
    return True


def mark_subscription_status_by_stripe_id(subscription_id: str, status: str) -> None:
    if not subscription_id:
        return
    with get_conn() as conn:
        conn.execute(
            "UPDATE subscriptions SET status=?, updated_at=CURRENT_TIMESTAMP WHERE stripe_subscription_id=?",
            ((status or "").strip(), subscription_id),
        )
        conn.commit()


def process_stripe_event(event: dict[str, Any]) -> dict[str, Any]:
    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "")
    if not record_webhook_event(event_id, event_type, event):
        return {"ok": True, "duplicate": True, "event_type": event_type}

    obj = (event.get("data") or {}).get("object") or {}
    if event_type == "checkout.session.completed":
        store_checkout_session_reference(obj)
    elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        upsert_subscription_from_event(obj)
    elif event_type == "invoice.payment_failed":
        subscription_id = str(obj.get("subscription") or "").strip()
        mark_subscription_status_by_stripe_id(subscription_id, "past_due")
    elif event_type == "invoice.payment_succeeded":
        subscription_id = str(obj.get("subscription") or "").strip()
        if subscription_id:
            with get_conn() as conn:
                current = conn.execute(
                    "SELECT status FROM subscriptions WHERE stripe_subscription_id=?",
                    (subscription_id,),
                ).fetchone()
            current_status = (current[0] if current else "").strip().lower()
            if current_status not in WORKSPACE_ACCESS_STATUSES:
                mark_subscription_status_by_stripe_id(subscription_id, "active")
    return {"ok": True, "duplicate": False, "event_type": event_type}
