import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["starter", "growth", "scale"]);
export const roleEnum = pgEnum("workspace_role", ["owner", "admin", "editor", "approver", "viewer"]);
export const integrationEnum = pgEnum("integration_provider", ["linkedin", "x", "facebook", "instagram", "threads", "youtube", "tiktok"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "in_review", "approved", "scheduled", "publishing", "published", "failed"]);
export const assetTypeEnum = pgEnum("asset_type", ["image", "video", "document"]);
export const postTypeEnum = pgEnum("post_type", ["text", "image", "multi_image", "video", "link"]);
export const targetTypeEnum = pgEnum("target_type", ["member", "organization", "page", "channel", "profile"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "changes_requested"]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  clerkOrganizationId: varchar("clerk_organization_id", { length: 128 }),
  plan: planEnum("plan").notNull().default("starter"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaceMemberships = pgTable("workspace_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  clerkUserId: varchar("clerk_user_id", { length: 128 }).notNull(),
  role: roleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  website: varchar("website", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  defaultTone: text("default_tone"),
  audience: text("audience"),
  primaryCta: varchar("primary_cta", { length: 160 }),
  secondaryCta: varchar("secondary_cta", { length: 160 }),
  hashtags: jsonb("hashtags").$type<string[]>(),
  linkedinProfileUrl: varchar("linkedin_profile_url", { length: 255 }),
  linkedinCompanyUrl: varchar("linkedin_company_url", { length: 255 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  provider: integrationEnum("provider").notNull(),
  externalAccountId: varchar("external_account_id", { length: 255 }),
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scopes: jsonb("scopes").$type<string[]>(),
  status: varchar("status", { length: 32 }).notNull().default("connected"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const platformAccounts = pgTable("platform_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  integrationId: uuid("integration_id").references(() => integrations.id, { onDelete: "cascade" }).notNull(),
  provider: integrationEnum("provider").notNull(),
  handle: varchar("handle", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  externalAccountId: varchar("external_account_id", { length: 255 }).notNull(),
  targetType: targetTypeEnum("target_type").notNull().default("member"),
  isDefault: boolean("is_default").notNull().default(false),
  publishEnabled: boolean("publish_enabled").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  type: assetTypeEnum("type").notNull(),
  objectKey: varchar("object_key", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  brandId: uuid("brand_id").references(() => brands.id, { onDelete: "cascade" }).notNull(),
  authorId: varchar("author_id", { length: 128 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  status: postStatusEnum("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedExternalId: varchar("published_external_id", { length: 255 }),
  postType: postTypeEnum("post_type").notNull().default("text"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const postTargets = pgTable("post_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  platformAccountId: uuid("platform_account_id").references(() => platformAccounts.id, { onDelete: "cascade" }).notNull(),
  provider: integrationEnum("provider").notNull(),
  targetType: targetTypeEnum("target_type").notNull().default("member"),
  platformStatus: varchar("platform_status", { length: 32 }).notNull().default("queued"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedExternalId: varchar("published_external_id", { length: 255 }),
  providerCorrelationId: varchar("provider_correlation_id", { length: 255 }),
  providerContainerId: varchar("provider_container_id", { length: 255 }),
  providerUploadId: varchar("provider_upload_id", { length: 255 }),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const postAssets = pgTable("post_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  requestedById: varchar("requested_by_id", { length: 128 }).notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvalResponses = pgTable("approval_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  approvalRequestId: uuid("approval_request_id").references(() => approvalRequests.id, { onDelete: "cascade" }).notNull(),
  responderId: varchar("responder_id", { length: 128 }).notNull(),
  status: approvalStatusEnum("status").notNull(),
  note: text("note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  actorId: varchar("actor_id", { length: 128 }),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const publishJobs = pgTable("publish_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  postTargetId: uuid("post_target_id").references(() => postTargets.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
  providerCorrelationId: varchar("provider_correlation_id", { length: 255 }),
  providerContainerId: varchar("provider_container_id", { length: 255 }),
  providerUploadId: varchar("provider_upload_id", { length: 255 }),
});

export const deliveryLogs = pgTable("delivery_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  publishJobId: uuid("publish_job_id").references(() => publishJobs.id, { onDelete: "set null" }),
  postTargetId: uuid("post_target_id").references(() => postTargets.id, { onDelete: "set null" }),
  provider: integrationEnum("provider").notNull(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  level: varchar("level", { length: 16 }).notNull().default("info"),
  message: text("message").notNull(),
  correlationId: varchar("correlation_id", { length: 255 }),
  providerStatus: varchar("provider_status", { length: 32 }),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  metric: varchar("metric", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  referenceId: varchar("reference_id", { length: 255 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const engagementComments = pgTable("engagement_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
  sourcePostId: uuid("source_post_id").references(() => posts.id, { onDelete: "set null" }),
  platform: integrationEnum("platform").notNull().default("linkedin"),
  commenterName: varchar("commenter_name", { length: 160 }).notNull(),
  commenterHandle: varchar("commenter_handle", { length: 160 }),
  sourcePostTitle: varchar("source_post_title", { length: 160 }),
  commentText: text("comment_text").notNull(),
  intentLabel: varchar("intent_label", { length: 24 }).notNull().default("nurture"),
  intentScore: integer("intent_score").notNull().default(20),
  sentiment: varchar("sentiment", { length: 24 }).notNull().default("neutral"),
  replyOptions: jsonb("reply_options").$type<string[]>(),
  selectedReplyText: text("selected_reply_text"),
  suggestedDmText: text("suggested_dm_text"),
  replyStatus: varchar("reply_status", { length: 24 }).notNull().default("not_started"),
  dmStatus: varchar("dm_status", { length: 24 }).notNull().default("not_started"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const engagementReplyDrafts = pgTable("engagement_reply_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  commentId: uuid("comment_id").references(() => engagementComments.id, { onDelete: "cascade" }).notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  replyText: text("reply_text").notNull(),
  channel: varchar("channel", { length: 16 }).notNull().default("comment"),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  approvedById: varchar("approved_by_id", { length: 128 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leadPipeline = pgTable("lead_pipeline", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
  commentId: uuid("comment_id").references(() => engagementComments.id, { onDelete: "set null" }),
  leadName: varchar("lead_name", { length: 160 }).notNull(),
  leadHandle: varchar("lead_handle", { length: 160 }),
  stage: varchar("stage", { length: 24 }).notNull().default("new"),
  intentScore: integer("intent_score").notNull().default(0),
  nextAction: text("next_action"),
  notes: text("notes"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const alertDestinations = pgTable("alert_destinations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const alertEvents = pgTable("alert_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull(),
  source: varchar("source", { length: 80 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  channel: varchar("channel", { length: 24 }).notNull(),
  eventGroup: varchar("event_group", { length: 48 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  digest: varchar("digest", { length: 24 }).notNull().default("instant"),
  target: varchar("target", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  publishJobId: uuid("publish_job_id").references(() => publishJobs.id, { onDelete: "set null" }),
  deliveryLogId: uuid("delivery_log_id").references(() => deliveryLogs.id, { onDelete: "set null" }),
  channel: varchar("channel", { length: 24 }).notNull(),
  eventGroup: varchar("event_group", { length: 48 }).notNull(),
  destination: varchar("destination", { length: 255 }),
  status: varchar("status", { length: 24 }).notNull().default("queued"),
  subject: varchar("subject", { length: 160 }),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  key: varchar("key", { length: 80 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
});
