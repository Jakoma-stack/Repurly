export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokenResponse> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI ?? "",
    }),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed: ${response.status}`);
  }

  return response.json();
}

export async function refreshLinkedInToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    }),
  });

  if (!response.ok) throw new Error(`LinkedIn refresh failed: ${response.status}`);
  return response.json();
}

export async function fetchLinkedInMember(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`LinkedIn userinfo failed: ${response.status}`);
  return response.json() as Promise<{ sub: string; name?: string; email?: string }>;
}

export async function fetchOrganizationAccess(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202503",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!response.ok) return { elements: [] };
  return response.json() as Promise<{ elements: Array<Record<string, unknown>> }>;
}
