CREATE TABLE IF NOT EXISTS "community_connections" (
 "workspace_id" uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
 "connected_by" text NOT NULL,
 "organization" text NOT NULL,
 "encrypted_token" text NOT NULL,
 "expires_at" timestamptz NOT NULL,
 "scopes" jsonb NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL
);
