-- The baseline required the retired "metric" column, but current Drizzle
-- inserts metric_key + period_key instead. Keep historical rows and relax
-- only the obsolete column constraint, so new usage events can be recorded.
ALTER TABLE "usage_events" ALTER COLUMN "metric" DROP NOT NULL;
