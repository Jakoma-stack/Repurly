from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

ROOT_DIR = Path(__file__).resolve().parents[1]


def env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def env_csv(name: str, default: str) -> tuple[str, ...]:
    raw = os.getenv(name, default)
    items = []
    for item in raw.split(","):
        cleaned = item.strip().lower().lstrip(".")
        if cleaned:
            items.append(cleaned)
    return tuple(dict.fromkeys(items))


if load_dotenv is not None and env_flag("POSTENGINE_LOAD_DOTENV", True):
    dotenv_path = ROOT_DIR / ".env"
    if dotenv_path.exists():
        load_dotenv(dotenv_path)

CONFIG_DIR = ROOT_DIR / "config"
BRAND_CONFIG_DIR = CONFIG_DIR / "brands"
PLATFORM_CONFIG_DIR = CONFIG_DIR / "platforms"

CONTENT_DIR = ROOT_DIR / "content"
DATA_DIR = ROOT_DIR / "data"
LOGS_DIR = ROOT_DIR / "logs"
OUTPUT_DIR = ROOT_DIR / "output"
DAILY_QUEUE_DIR = OUTPUT_DIR / "daily_queue"
EXPORTS_DIR = OUTPUT_DIR / "exports"
DATABASE_DIR = ROOT_DIR / "database"
TEMPLATES_DIR = ROOT_DIR / "templates"

SCHEDULE_CSV = DATA_DIR / "social_post_schedule.csv"
BULK_POSTS_CSV = DATA_DIR / "bulk_posts.csv"
SCHEDULE_EXAMPLE_CSV = DATA_DIR / "social_post_schedule_example.csv"
BULK_POSTS_EXAMPLE_CSV = DATA_DIR / "bulk_posts_example.csv"

APP_DB = Path(
    os.getenv(
        "APP_DB_PATH",
        str(DATABASE_DIR / "socials_scheduler.db"),
    )
)

SCHEMA_SQL = DATABASE_DIR / "schema.sql"

DATE_FORMAT = "%Y-%m-%d"
TIME_FORMAT = "%H:%M"

ALLOWED_STATUSES = {
    "planned",
    "drafted",
    "approved",
    "generated",
    "queued",
    "posting",
    "posted",
    "failed",
    "skipped",
    "rejected",
}

ELIGIBLE_POSTING_STATUSES = {"approved", "generated", "queued"}
POSTING_ALLOWED_APPROVAL_STATUSES = {"approved", "not_required"}
OPTIONAL_SCHEDULE_COLUMNS = [
    "approval_status",
    "draft_payload_file",
    "asset_mode",
    "image_alt_text",
    "platform_post_format",
    "platform_post_id",
    "posted_at",
    "last_publish_error",
]

LINKEDIN_DRY_RUN = env_flag("LINKEDIN_DRY_RUN", True)
LINKEDIN_ACCESS_TOKEN = os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip()
LINKEDIN_AUTHOR_URN = os.getenv("LINKEDIN_AUTHOR_URN", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
STRIPE_PRICING_TABLE_ID = os.getenv("STRIPE_PRICING_TABLE_ID", "").strip()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
STRIPE_PRICE_STARTER = os.getenv("STRIPE_PRICE_STARTER", "").strip()
STRIPE_PRICE_GROWTH = os.getenv("STRIPE_PRICE_GROWTH", "").strip()
STRIPE_PRICE_PRO = os.getenv("STRIPE_PRICE_PRO", "").strip()
STRIPE_BILLING_PORTAL_CONFIGURATION_ID = os.getenv("STRIPE_BILLING_PORTAL_CONFIGURATION_ID", "").strip()
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://beta.repurly.org").strip().rstrip("/")
BILLING_PORTAL_RETURN_PATH = os.getenv("BILLING_PORTAL_RETURN_PATH", "/account/billing").strip() or "/account/billing"
MARKETING_SITE_URL = os.getenv("MARKETING_SITE_URL", "https://repurly.org").strip().rstrip("/")
PUBLIC_SUPPORT_EMAIL = os.getenv("PUBLIC_SUPPORT_EMAIL", "support@repurly.org").strip()
PRIVATE_BETA_NOTIFY_EMAIL = os.getenv("PRIVATE_BETA_NOTIFY_EMAIL", "").strip()
EMAIL_FROM = os.getenv("EMAIL_FROM", PUBLIC_SUPPORT_EMAIL).strip()
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = env_int("SMTP_PORT", 587)
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_USE_TLS = env_flag("SMTP_USE_TLS", True)
EMAIL_REPLY_TO = os.getenv("EMAIL_REPLY_TO", PUBLIC_SUPPORT_EMAIL).strip()
WORKSPACE_INVITE_SEND_EMAILS = env_flag("WORKSPACE_INVITE_SEND_EMAILS", False)
PASSWORD_RESET_SEND_EMAILS = env_flag("PASSWORD_RESET_SEND_EMAILS", False)
TEAM_INVITE_SEND_EMAILS = env_flag("TEAM_INVITE_SEND_EMAILS", False)
WELCOME_EMAIL_SEND_EMAILS = env_flag("WELCOME_EMAIL_SEND_EMAILS", True)
DEFAULT_WORKSPACE_ALLOWED_DOMAIN = os.getenv("DEFAULT_WORKSPACE_ALLOWED_DOMAIN", "").strip().lower()
INVITE_TOKEN_HOURS = env_int("INVITE_TOKEN_HOURS", 72)
RESET_TOKEN_HOURS = env_int("RESET_TOKEN_HOURS", 1)
WORKSPACE_BILLING_REQUIRED = env_flag("WORKSPACE_BILLING_REQUIRED", False)
UPLOAD_MAX_BYTES = env_int("UPLOAD_MAX_BYTES", 10 * 1024 * 1024)
ALLOWED_UPLOAD_EXTENSIONS = env_csv("ALLOWED_UPLOAD_EXTENSIONS", "png,jpg,jpeg,webp,gif")

REQUIRED_SCHEDULE_COLUMNS = [
    "post_id",
    "post_date",
    "post_time",
    "brand",
    "platform",
    "post_type",
    "theme",
    "campaign",
    "status",
    "content_folder",
    "asset_filename",
    "caption_filename",
    "notes",
]

REQUIRED_BULK_POSTS_COLUMNS = [
    "post_id",
    "brand",
    "platform",
    "post_type",
    "topic",
    "hook",
    "key_points",
    "cta",
    "offer",
    "audience",
    "tone_override",
]


def ensure_base_dirs() -> None:
    for path in [
        CONFIG_DIR,
        BRAND_CONFIG_DIR,
        PLATFORM_CONFIG_DIR,
        CONTENT_DIR,
        DATA_DIR,
        LOGS_DIR,
        OUTPUT_DIR,
        DAILY_QUEUE_DIR,
        EXPORTS_DIR,
        DATABASE_DIR,
        TEMPLATES_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)
