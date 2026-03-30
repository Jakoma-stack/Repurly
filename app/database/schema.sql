PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'invited',
  password_hash TEXT,
  email_verified_at TEXT,
  last_login_at TEXT,
  invited_at TEXT,
  activated_at TEXT,
  is_ops_admin INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


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

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  workspace_id INTEGER,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  website TEXT,
  contact_email TEXT,
  brand_status TEXT NOT NULL DEFAULT 'active',
  tone TEXT,
  audience TEXT,
  primary_cta TEXT,
  secondary_cta TEXT,
  default_platforms_json TEXT NOT NULL DEFAULT '[]',
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  posting_goals_json TEXT NOT NULL DEFAULT '[]',
  content_pillars_json TEXT NOT NULL DEFAULT '[]',
  linkedin_author_urn TEXT,
  linkedin_token_env TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS connected_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  account_label TEXT,
  external_account_id TEXT,
  auth_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(brand_id) REFERENCES brands(id)
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  asset_kind TEXT NOT NULL DEFAULT 'image',
  checksum TEXT,
  alt_text TEXT,
  asset_tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(brand_id) REFERENCES brands(id)
);

CREATE TABLE IF NOT EXISTS generated_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  post_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  post_type TEXT NOT NULL,
  topic TEXT,
  hook TEXT,
  body_points_json TEXT NOT NULL DEFAULT '[]',
  cta TEXT,
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  caption_text TEXT,
  draft_payload_path TEXT,
  asset_ids_json TEXT NOT NULL DEFAULT '[]',
  review_notes TEXT,
  generation_mode TEXT NOT NULL DEFAULT 'template-first',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by_user_id INTEGER,
  prompt_brief TEXT,
  planner_label TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  last_saved_at TEXT,
  FOREIGN KEY(brand_id) REFERENCES brands(id),
  FOREIGN KEY(approved_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  generated_post_id INTEGER,
  post_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  post_type TEXT NOT NULL,
  post_date TEXT NOT NULL,
  post_time TEXT NOT NULL,
  theme TEXT,
  campaign TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  approval_status TEXT NOT NULL DEFAULT '',
  content_folder TEXT,
  asset_filename TEXT,
  caption_filename TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(brand_id) REFERENCES brands(id),
  FOREIGN KEY(generated_post_id) REFERENCES generated_posts(id)
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

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  workspace_id INTEGER,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan_name TEXT,
  status TEXT NOT NULL DEFAULT 'trialing',
  billing_email TEXT,
  started_at TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);

CREATE TABLE IF NOT EXISTS founding_user_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  selected_plan TEXT,
  beta_notes TEXT,
  invite_status TEXT NOT NULL DEFAULT 'requested',
  stripe_checkout_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
