ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "slug" varchar(120);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "status" varchar(24) DEFAULT 'active' NOT NULL;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "website" varchar(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "contact_email" varchar(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "audience" text;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "primary_cta" varchar(160);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "secondary_cta" varchar(160);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "hashtags" jsonb;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "linkedin_profile_url" varchar(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "linkedin_company_url" varchar(255);
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
UPDATE "brands" SET "slug" = regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g') WHERE "slug" IS NULL;

CREATE TABLE IF NOT EXISTS "engagement_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "brand_id" uuid REFERENCES "brands"("id") ON DELETE set null,
  "source_post_id" uuid REFERENCES "posts"("id") ON DELETE set null,
  "platform" "integration_provider" DEFAULT 'linkedin' NOT NULL,
  "commenter_name" varchar(160) NOT NULL,
  "commenter_handle" varchar(160),
  "source_post_title" varchar(160),
  "comment_text" text NOT NULL,
  "intent_label" varchar(24) DEFAULT 'nurture' NOT NULL,
  "intent_score" integer DEFAULT 20 NOT NULL,
  "sentiment" varchar(24) DEFAULT 'neutral' NOT NULL,
  "reply_options" jsonb,
  "selected_reply_text" text,
  "suggested_dm_text" text,
  "reply_status" varchar(24) DEFAULT 'not_started' NOT NULL,
  "dm_status" varchar(24) DEFAULT 'not_started' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "engagement_reply_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "comment_id" uuid NOT NULL REFERENCES "engagement_comments"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "reply_text" text NOT NULL,
  "channel" varchar(16) DEFAULT 'comment' NOT NULL,
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "approved_by_id" varchar(128),
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lead_pipeline" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "brand_id" uuid REFERENCES "brands"("id") ON DELETE set null,
  "comment_id" uuid REFERENCES "engagement_comments"("id") ON DELETE set null,
  "lead_name" varchar(160) NOT NULL,
  "lead_handle" varchar(160),
  "stage" varchar(24) DEFAULT 'new' NOT NULL,
  "intent_score" integer DEFAULT 0 NOT NULL,
  "next_action" text,
  "notes" text,
  "last_contact_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "engagement_comments_workspace_idx" ON "engagement_comments" ("workspace_id");
CREATE INDEX IF NOT EXISTS "engagement_reply_drafts_workspace_idx" ON "engagement_reply_drafts" ("workspace_id");
CREATE INDEX IF NOT EXISTS "lead_pipeline_workspace_idx" ON "lead_pipeline" ("workspace_id");
