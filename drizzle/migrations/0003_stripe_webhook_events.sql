CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "event_type" varchar(128) NOT NULL,
  "payload" jsonb,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
