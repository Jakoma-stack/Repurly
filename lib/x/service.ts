import { exchangeXCode, fetchXMe, refreshXToken } from "@/lib/x/client";
import { getIntegration, getValidAccessToken, syncPlatformAccounts, upsertIntegration } from "@/lib/integrations/service";

export async function connectXWorkspace(workspaceId: string, code: string, verifier: string) {
  const tokens = await exchangeXCode(code, verifier);
  const profile = await fetchXMe(tokens.access_token);

  const integration = await upsertIntegration({
    workspaceId,
    provider: "x",
    externalAccountId: profile.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    scopes: tokens.scope?.split(" ") ?? [],
    metadata: { profile },
    status: "connected",
  });

  await syncPlatformAccounts(workspaceId, integration.id, "x", [
    {
      provider: "x",
      handle: `@${profile.username}`,
      displayName: profile.name,
      targetType: "profile",
      publishEnabled: true,
    },
  ]);

  return { profile };
}

export async function getValidXAccessToken(workspaceId: string) {
  return getValidAccessToken(workspaceId, "x", async (refreshToken) => {
    const refreshed = await refreshXToken(refreshToken);
    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      accessTokenExpiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
      scopes: refreshed.scope?.split(" "),
    };
  });
}

export async function discoverXAccounts(workspaceId: string) {
  const integration = await getIntegration(workspaceId, "x");
  const profile = integration?.metadata && typeof integration.metadata === "object" ? (integration.metadata as { profile?: { username?: string; name?: string } }).profile : undefined;
  if (!profile?.username) return [];
  return [
    {
      provider: "x" as const,
      handle: `@${profile.username}`,
      displayName: profile.name ?? profile.username,
      targetType: "profile" as const,
      publishEnabled: true,
    },
  ];
}
