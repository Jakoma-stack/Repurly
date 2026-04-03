import { randomBytes } from "crypto";

export function buildLinkedInAuthUrl(workspaceId: string) {
  const state = Buffer.from(JSON.stringify({ workspaceId, nonce: randomBytes(8).toString("hex") })).toString("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI ?? "",
    state,
    scope: process.env.LINKEDIN_SCOPE ?? "",
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function parseLinkedInState(state: string) {
  return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    workspaceId: string;
    nonce: string;
  };
}
