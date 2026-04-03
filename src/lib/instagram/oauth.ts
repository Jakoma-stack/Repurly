export function buildInstagramAuthUrl(workspaceId: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI ?? "",
    scope: process.env.INSTAGRAM_SCOPE ?? "instagram_basic,instagram_content_publish,pages_show_list,business_management",
    response_type: "code",
    state: Buffer.from(JSON.stringify({ workspaceId, provider: "instagram" })).toString("base64url"),
  });

  return new URL(`https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`);
}

export function parseInstagramState(state: string): { workspaceId: string; provider: "instagram" } {
  const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { workspaceId: string; provider: "instagram" };
  if (!parsed?.workspaceId) throw new Error("Invalid Instagram OAuth state");
  return parsed;
}
