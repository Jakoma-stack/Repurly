export interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function exchangeInstagramCode(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI ?? "",
    code,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`);
  if (!response.ok) throw new Error(`Instagram token exchange failed: ${response.status}`);
  return response.json() as Promise<MetaTokenResponse>;
}

export async function extendInstagramToken(accessToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`);
  if (!response.ok) throw new Error(`Instagram long-lived token exchange failed: ${response.status}`);
  return response.json() as Promise<MetaTokenResponse>;
}

export async function fetchInstagramBusinessAccounts(accessToken: string) {
  const params = new URLSearchParams({
    fields: "id,name,instagram_business_account{id,username,name,profile_picture_url},access_token",
    access_token: accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/me/accounts?${params.toString()}`);
  if (!response.ok) throw new Error(`Instagram account discovery failed: ${response.status}`);
  return response.json() as Promise<{
    data: Array<{
      id: string;
      name: string;
      access_token?: string;
      instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string };
    }>;
  }>;
}

export async function createInstagramMediaContainer(args: {
  igUserId: string;
  accessToken: string;
  mediaUrl: string;
  caption: string;
  isVideo?: boolean;
}) {
  const body = new URLSearchParams({
    image_url: args.isVideo ? "" : args.mediaUrl,
    video_url: args.isVideo ? args.mediaUrl : "",
    media_type: args.isVideo ? "REELS" : "IMAGE",
    caption: args.caption,
    access_token: args.accessToken,
  });
  if (!args.isVideo) body.delete("video_url");
  if (args.isVideo) body.delete("image_url");

  const response = await fetch(`https://graph.facebook.com/v22.0/${args.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Instagram media container creation failed: ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}

export async function createInstagramCarouselContainer(args: {
  igUserId: string;
  accessToken: string;
  childContainerIds: string[];
  caption: string;
}) {
  const body = new URLSearchParams({
    media_type: "CAROUSEL",
    children: args.childContainerIds.join(","),
    caption: args.caption,
    access_token: args.accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/${args.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Instagram carousel container creation failed: ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}

export async function publishInstagramContainer(igUserId: string, creationId: string, accessToken: string) {
  const body = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const response = await fetch(`https://graph.facebook.com/v22.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Instagram publish failed: ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}


export async function getInstagramContainerStatus(containerId: string, accessToken: string) {
  const params = new URLSearchParams({
    fields: "id,status_code,status,error_message,status_details",
    access_token: accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/${containerId}?${params.toString()}`);
  if (!response.ok) throw new Error(`Instagram status lookup failed: ${response.status}`);
  return response.json() as Promise<{
    id: string;
    status_code?: string;
    status?: string;
    error_message?: string;
    status_details?: string;
  }>;
}
