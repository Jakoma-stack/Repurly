export interface XTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function getBasicAuth() {
  const id = process.env.X_CLIENT_ID ?? "";
  const secret = process.env.X_CLIENT_SECRET ?? "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export async function exchangeXCode(code: string, codeVerifier: string): Promise<XTokenResponse> {
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: getBasicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.X_REDIRECT_URI ?? "",
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) throw new Error(`X token exchange failed: ${response.status}`);
  return response.json();
}

export async function refreshXToken(refreshToken: string): Promise<XTokenResponse> {
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: getBasicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(`X token refresh failed: ${response.status}`);
  return response.json();
}

export async function fetchXMe(accessToken: string) {
  const response = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`X profile fetch failed: ${response.status}`);
  const json = (await response.json()) as { data: { id: string; username: string; name: string } };
  return json.data;
}

export async function publishXPost(accessToken: string, body: string, mediaIds: string[] = []) {
  const payload: Record<string, unknown> = { text: body };
  if (mediaIds.length) payload.media = { media_ids: mediaIds };
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`X publish failed: ${response.status}`);
  return response.json() as Promise<{ data: { id: string; text: string } }>;
}
