import { createHash, randomBytes } from "crypto";

export type XStatePayload = {
  workspaceId: string;
  nonce: string;
  verifier: string;
};

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function buildPkcePair() {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildXAuthUrl(workspaceId: string) {
  const pkce = buildPkcePair();
  const statePayload: XStatePayload = {
    workspaceId,
    nonce: randomBytes(8).toString("hex"),
    verifier: pkce.verifier,
  };
  const state = toBase64Url(JSON.stringify(statePayload));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID ?? "",
    redirect_uri: process.env.X_REDIRECT_URI ?? "",
    state,
    scope: process.env.X_SCOPE ?? "tweet.read tweet.write users.read offline.access media.write",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export function parseXState(state: string) {
  return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as XStatePayload;
}
