CREATE TABLE IF NOT EXISTS "daily_agent_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "brand_id" uuid REFERENCES "brands"("id") ON DELETE set null,
  "session_date" varchar(10) NOT NULL,
  "raw_notifications" text,
  "raw_comments" text,
  "raw_analytics" text,
  "raw_profiles" text,
  "raw_notes" text,
  "summary" text,
  "briefing_json" jsonb,
  "generation_mode" varchar(24) DEFAULT 'fallback' NOT NULL,
  "status" varchar(24) DEFAULT 'generated' NOT NULL,
  "usefulness_rating" varchar(24),
  "feedback_notes" text,
  "created_by_id" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "daily_agent_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "daily_agent_sessions"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "brand_id" uuid REFERENCES "brands"("id") ON DELETE set null,
  "action_type" varchar(48) NOT NULL,
  "person_name" varchar(160),
  "person_handle" varchar(160),
  "source" varchar(80) DEFAULT 'daily_agent' NOT NULL,
  "recommended_channel" varchar(48) DEFAULT 'tracker_update' NOT NULL,
  "priority" varchar(16) DEFAULT 'medium' NOT NULL,
  "reason" text,
  "draft_text" text,
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "linked_lead_id" uuid REFERENCES "lead_pipeline"("id") ON DELETE set null,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "daily_agent_sessions_workspace_date_idx" ON "daily_agent_sessions" ("workspace_id", "session_date");
CREATE INDEX IF NOT EXISTS "daily_agent_actions_session_idx" ON "daily_agent_actions" ("session_id");
CREATE INDEX IF NOT EXISTS "daily_agent_actions_workspace_status_idx" ON "daily_agent_actions" ("workspace_id", "status");

CREATE INDEX IF NOT EXISTS "daily_agent_actions_workspace_channel_idx" ON "daily_agent_actions" ("workspace_id", "recommended_channel");
