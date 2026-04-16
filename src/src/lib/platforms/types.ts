export type PlatformKey = "linkedin" | "x" | "facebook" | "instagram" | "threads" | "youtube" | "tiktok";
export type PostType = "text" | "image" | "multi_image" | "video" | "link";
export type TargetType = "member" | "organization" | "page" | "channel" | "profile";

export type PlatformCapabilityMap = {
  text: boolean;
  image: boolean;
  multiImage: boolean;
  video: boolean;
  link: boolean;
  scheduling: boolean;
  analytics: boolean;
  memberPublishing: boolean;
  organizationPublishing: boolean;
};

export type PublishMedia = {
  type: "image" | "video";
  objectKey?: string;
  publicUrl?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  providerMediaId?: string;
};

export type PublishRequest = {
  workspaceId: string;
  provider: PlatformKey;
  authorUrnOrId: string;
  targetType: TargetType;
  postType: PostType;
  body: string;
  title?: string;
  media?: PublishMedia[];
  metadata?: Record<string, unknown>;
};

export type PublishResult = {
  id: string;
  status: "published" | "queued" | "failed";
  url?: string;
  raw?: Record<string, unknown>;
};

export type PlatformAccountSummary = {
  provider: PlatformKey;
  handle: string;
  displayName: string;
  targetType: TargetType;
  publishEnabled: boolean;
};

export interface PlatformAdapter {
  key: PlatformKey;
  label: string;
  capabilities: PlatformCapabilityMap;
  connectPath: string;
  getAuthScopes(): string[];
  discoverAccounts?(workspaceId: string): Promise<PlatformAccountSummary[]>;
  refreshAccessToken?(workspaceId: string): Promise<void>;
  publish(input: PublishRequest): Promise<PublishResult>;
}
