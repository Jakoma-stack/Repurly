CREATE TABLE IF NOT EXISTS "workspace_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "role" "workspace_role" DEFAULT 'viewer' NOT NULL,
  "token" varchar(255) NOT NULL,
  "invited_by_id" varchar(128) NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
