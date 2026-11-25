-- The original baseline was committed before these four subscription
-- columns and the usage-events keys were added to drizzle/schema.ts.
-- Reconcile existing databases without deleting tables or losing data.
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "stripe_price_id" varchar(128);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "stripe_subscription_status" varchar(64);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "stripe_current_period_end" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "stripe_cancel_at_period_end" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "metric_key" varchar(64);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN IF NOT EXISTS "period_key" varchar(16);
--> statement-breakpoint
-- Preserve any existing usage rows created before the column rename.
UPDATE "usage_events"
SET "metric_key" = COALESCE("metric_key", "metric"),
    "period_key" = COALESCE("period_key", to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM'));
--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "metric_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "usage_events" ALTER COLUMN "period_key" SET NOT NULL;
