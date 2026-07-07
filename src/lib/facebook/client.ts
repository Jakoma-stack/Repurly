export interface FacebookTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function exchangeFacebookCode(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI ?? "",
    code,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`);
  if (!response.ok) throw new Error(`Facebook token exchange failed: ${response.status}`);
  return response.json() as Promise<FacebookTokenResponse>;
}

export async function extendFacebookToken(accessToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`);
  if (!response.ok) throw new Error(`Facebook long-lived token exchange failed: ${response.status}`);
  return response.json() as Promise<FacebookTokenResponse>;
}

export async function fetchFacebookPages(accessToken: string) {
  const params = new URLSearchParams({
    fields: "name,id,access_token",
    access_token: accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v22.0/me/accounts?${params.toString()}`);
  if (!response.ok) throw new Error(`Facebook page discovery failed: ${response.status}`);
  return response.json() as Promise<{ data: Array<{ id: string; name: string; access_token?: string }> }>;
}

export async function publishFacebookPagePost(pageAccessToken: string, pageId: string, message: string, link?: string) {
  const body = new URLSearchParams({ message, access_token: pageAccessToken });
  if (link) body.set("link", link);
  const response = await fetch(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Facebook page publish failed: ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}
