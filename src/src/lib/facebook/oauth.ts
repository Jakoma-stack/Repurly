import { randomBytes } from "crypto";

export function buildFacebookAuthUrl(workspaceId: string) {
  const state = Buffer.from(JSON.stringify({ workspaceId, nonce: randomBytes(8).toString("hex") })).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI ?? "",
    state,
    scope: process.env.FACEBOOK_SCOPE ?? "pages_show_list,pages_manage_posts,pages_read_engagement,business_management",
    response_type: "code",
  });
  return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
}

export function parseFacebookState(state: string) {
  return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { workspaceId: string; nonce: string };
}
