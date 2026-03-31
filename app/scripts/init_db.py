from __future__ import annotations

import sqlite3

from config import APP_DB, SCHEMA_SQL, ensure_base_dirs
from logger_setup import get_logger

logger = get_logger("init_db", "app.log")


AUTH_USER_COLUMNS = {
    "password_hash": "TEXT",
    "email_verified_at": "TEXT",
    "last_login_at": "TEXT",
    "invited_at": "TEXT",
    "activated_at": "TEXT",
    "is_ops_admin": "INTEGER NOT NULL DEFAULT 0",
}

BRAND_COLUMNS = {
    "workspace_id": "INTEGER",
    "brand_status": "TEXT NOT NULL DEFAULT 'active'",
}

ASSET_COLUMNS = {
    "asset_tags_json": "TEXT NOT NULL DEFAULT '[]'",
}

SUBSCRIPTION_COLUMNS = {
    "workspace_id": "INTEGER",
}

GENERATED_POST_COLUMNS = {
    "asset_ids_json": "TEXT NOT NULL DEFAULT '[]'",
    "review_notes": "TEXT",
    "last_saved_at": "TEXT",
    "prompt_brief": "TEXT",
    "planner_label": "TEXT",
}

WORKSPACE_COLUMNS = {
    "billing_contact_email": "TEXT",
    "reporting_email": "TEXT",
    "allowed_email_domains": "TEXT",
    "onboarding_stage": "TEXT NOT NULL DEFAULT 'onboarding'",
}


CORE_RUNTIME_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  status TEXT NOT NULL DEFAULT 'invited',
  stripe_customer_id TEXT,
  password_hash TEXT,
  email_verified_at TEXT,
  last_login_at TEXT,
  invited_at TEXT,
  activated_at TEXT,
  is_ops_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS founding_user_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  selected_plan TEXT,
  beta_notes TEXT,
  invite_status TEXT NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  workspace_id INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan_name TEXT,
  status TEXT,
  billing_email TEXT,
  started_at TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT,
  payload_hash TEXT,
  payload_json TEXT,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table_name})")}


def ensure_runtime_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(CORE_RUNTIME_SCHEMA)
    existing_tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}

    user_columns = table_columns(conn, "users") if "users" in existing_tables else set()
    if "users" in existing_tables:
        for column_name, column_def in AUTH_USER_COLUMNS.items():
            if column_name not in user_columns:
                conn.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_def}")

    brand_columns = table_columns(conn, "brands") if "brands" in existing_tables else set()
    if "brands" in existing_tables:
        for column_name, column_def in BRAND_COLUMNS.items():
            if column_name not in brand_columns:
                conn.execute(f"ALTER TABLE brands ADD COLUMN {column_name} {column_def}")

    asset_columns = table_columns(conn, "assets") if "assets" in existing_tables else set()
    if "assets" in existing_tables:
        for column_name, column_def in ASSET_COLUMNS.items():
            if column_name not in asset_columns:
                conn.execute(f"ALTER TABLE assets ADD COLUMN {column_name} {column_def}")

    subscription_columns = table_columns(conn, "subscriptions") if "subscriptions" in existing_tables else set()
    if "subscriptions" in existing_tables:
        for column_name, column_def in SUBSCRIPTION_COLUMNS.items():
            if column_name not in subscription_columns:
                conn.execute(f"ALTER TABLE subscriptions ADD COLUMN {column_name} {column_def}")

    if "generated_posts" in existing_tables:
        generated_post_columns = table_columns(conn, "generated_posts")
        for column_name, column_def in GENERATED_POST_COLUMNS.items():
            if column_name not in generated_post_columns:
                conn.execute(f"ALTER TABLE generated_posts ADD COLUMN {column_name} {column_def}")

    workspace_columns = table_columns(conn, "workspaces") if "workspaces" in existing_tables else set()

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS workspaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          company_name TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          selected_plan TEXT,
          billing_contact_email TEXT,
          reporting_email TEXT,
          allowed_email_domains TEXT,
          onboarding_stage TEXT NOT NULL DEFAULT 'onboarding',
          owner_user_id INTEGER,
          signup_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(owner_user_id) REFERENCES users(id),
          FOREIGN KEY(signup_id) REFERENCES founding_user_signups(id)
        );

        CREATE TABLE IF NOT EXISTS workspace_memberships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          membership_role TEXT NOT NULL DEFAULT 'owner',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(workspace_id, user_id),
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user ON workspace_memberships(user_id);

        CREATE TABLE IF NOT EXISTS workspace_invitations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          email TEXT NOT NULL,
          full_name TEXT,
          membership_role TEXT NOT NULL DEFAULT 'member',
          invited_by_user_id INTEGER,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          accepted_at TEXT,
          revoked_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(invited_by_user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);

        CREATE TABLE IF NOT EXISTS auth_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          token_type TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, token_type);

        CREATE TABLE IF NOT EXISTS login_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        );
        

        CREATE TABLE IF NOT EXISTS campaign_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          brand_id INTEGER,
          name TEXT NOT NULL,
          objective TEXT,
          prompt_brief TEXT,
          post_type TEXT NOT NULL DEFAULT 'text',
          cadence TEXT NOT NULL DEFAULT 'daily_week',
          time_mode TEXT NOT NULL DEFAULT 'same_time',
          default_count INTEGER NOT NULL DEFAULT 7,
          campaign_label TEXT,
          created_by_user_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(brand_id) REFERENCES brands(id),
          FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_campaign_templates_workspace ON campaign_templates(workspace_id);

        CREATE TABLE IF NOT EXISTS posting_strategies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          summary TEXT,
          cadence TEXT NOT NULL DEFAULT 'daily_week',
          time_mode TEXT NOT NULL DEFAULT 'same_time',
          best_time_hint TEXT,
          focus_keywords_json TEXT NOT NULL DEFAULT '[]',
          created_by_user_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_posting_strategies_workspace ON posting_strategies(workspace_id);

        CREATE TABLE IF NOT EXISTS content_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          generated_post_id INTEGER NOT NULL,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          feedback_type TEXT NOT NULL DEFAULT 'comment',
          comment_text TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(generated_post_id) REFERENCES generated_posts(id),
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(author_user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_content_feedback_draft ON content_feedback(generated_post_id);

        CREATE TABLE IF NOT EXISTS email_delivery_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email_type TEXT NOT NULL,
          recipient_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          delivery_status TEXT NOT NULL DEFAULT 'queued',
          provider TEXT,
          provider_message_id TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_email_delivery_log_recipient ON email_delivery_log(recipient_email);

        CREATE TABLE IF NOT EXISTS engagement_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          brand_id INTEGER,
          platform TEXT NOT NULL DEFAULT 'linkedin',
          commenter_name TEXT NOT NULL,
          commenter_handle TEXT,
          source_post_title TEXT,
          comment_text TEXT NOT NULL,
          sentiment TEXT NOT NULL DEFAULT 'neutral',
          intent_label TEXT NOT NULL DEFAULT 'cold',
          intent_score INTEGER NOT NULL DEFAULT 0,
          reply_options_json TEXT NOT NULL DEFAULT '[]',
          selected_reply_text TEXT,
          suggested_dm_text TEXT,
          reply_status TEXT NOT NULL DEFAULT 'new',
          dm_status TEXT NOT NULL DEFAULT 'not_started',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(brand_id) REFERENCES brands(id)
        );
        CREATE INDEX IF NOT EXISTS idx_engagement_comments_workspace ON engagement_comments(workspace_id);

        CREATE TABLE IF NOT EXISTS engagement_reply_drafts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comment_id INTEGER NOT NULL,
          workspace_id INTEGER NOT NULL,
          reply_text TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          approved_by_user_id INTEGER,
          approved_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(comment_id) REFERENCES engagement_comments(id),
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(approved_by_user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS lead_pipeline (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          brand_id INTEGER,
          comment_id INTEGER,
          lead_name TEXT NOT NULL,
          lead_handle TEXT,
          stage TEXT NOT NULL DEFAULT 'new',
          intent_score INTEGER NOT NULL DEFAULT 0,
          owner_name TEXT,
          next_action TEXT,
          last_contact_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(brand_id) REFERENCES brands(id),
          FOREIGN KEY(comment_id) REFERENCES engagement_comments(id)
        );
        CREATE INDEX IF NOT EXISTS idx_lead_pipeline_workspace ON lead_pipeline(workspace_id);

        CREATE TABLE IF NOT EXISTS engagement_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          rule_name TEXT NOT NULL,
          rule_type TEXT NOT NULL DEFAULT 'reply_assist',
          trigger_condition TEXT,
          action_summary TEXT,
          approval_mode TEXT NOT NULL DEFAULT 'approval_required',
          is_enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        );
        CREATE INDEX IF NOT EXISTS idx_engagement_rules_workspace ON engagement_rules(workspace_id);

        CREATE TABLE IF NOT EXISTS engagement_integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          platform TEXT NOT NULL DEFAULT 'linkedin',
          connection_label TEXT,
          status TEXT NOT NULL DEFAULT 'demo',
          sync_mode TEXT NOT NULL DEFAULT 'manual_review',
          auto_reply_enabled INTEGER NOT NULL DEFAULT 0,
          auto_dm_enabled INTEGER NOT NULL DEFAULT 0,
          moderation_level TEXT NOT NULL DEFAULT 'balanced',
          last_synced_at TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        );
        CREATE INDEX IF NOT EXISTS idx_engagement_integrations_workspace ON engagement_integrations(workspace_id);

        CREATE TABLE IF NOT EXISTS lead_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          lead_id INTEGER NOT NULL,
          comment_id INTEGER,
          activity_type TEXT NOT NULL DEFAULT 'note',
          activity_text TEXT NOT NULL,
          created_by_user_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY(lead_id) REFERENCES lead_pipeline(id),
          FOREIGN KEY(comment_id) REFERENCES engagement_comments(id),
          FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_id);
        """
    )

    refreshed_tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "subscriptions" in refreshed_tables:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id)")

    workspace_columns = table_columns(conn, "workspaces") if "workspaces" in refreshed_tables else set()
    for column_name, column_def in WORKSPACE_COLUMNS.items():
        if column_name not in workspace_columns:
            conn.execute(f"ALTER TABLE workspaces ADD COLUMN {column_name} {column_def}")
    conn.commit()


# Backwards-compatible alias for older imports.
ensure_auth_schema = ensure_runtime_schema


def main() -> int:
    ensure_base_dirs()
    schema = SCHEMA_SQL.read_text(encoding="utf-8")
    with sqlite3.connect(APP_DB) as conn:
        existing_tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "subscriptions" in existing_tables:
            subscription_columns = table_columns(conn, "subscriptions")
            if "workspace_id" not in subscription_columns:
                conn.execute("ALTER TABLE subscriptions ADD COLUMN workspace_id INTEGER")
        conn.executescript(schema)
        ensure_runtime_schema(conn)
        conn.commit()
    logger.info("Database initialised at %s", APP_DB)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
