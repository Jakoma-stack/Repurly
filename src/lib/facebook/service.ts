import { exchangeFacebookCode, extendFacebookToken, fetchFacebookPages } from "@/lib/facebook/client";
import { getIntegration, getValidAccessToken, syncPlatformAccounts, upsertIntegration } from "@/lib/integrations/service";

export async function connectFacebookWorkspace(workspaceId: string, code: string) {
  const shortLived = await exchangeFacebookCode(code);
  const longLived = await extendFacebookToken(shortLived.access_token);
  const pages = await fetchFacebookPages(longLived.access_token);

  const integration = await upsertIntegration({
    workspaceId,
    provider: "facebook",
    externalAccountId: pages.data[0]?.id ?? "facebook-pages",
    accessToken: longLived.access_token,
    accessTokenExpiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null,
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management"],
    metadata: { pages: pages.data },
    status: "connected",
  });

  await syncPlatformAccounts(
    workspaceId,
    integration.id,
    "facebook",
    pages.data.map((page) => ({
      provider: "facebook" as const,
      handle: page.id,
      displayName: page.name,
      targetType: "page" as const,
      publishEnabled: true,
    }))
  );

  return { pages: pages.data };
}

export async function getValidFacebookAccessToken(workspaceId: string) {
  return getValidAccessToken(workspaceId, "facebook", async (_refreshToken) => {
    const integration = await getIntegration(workspaceId, "facebook");
    if (!integration?.encryptedAccessToken) throw new Error("Facebook Pages is not connected");
    return {
      accessToken: _refreshToken,
      accessTokenExpiresAt: integration.accessTokenExpiresAt,
      metadata: integration.metadata as Record<string, unknown> | undefined,
    };
  });
}

export async function discoverFacebookAccounts(workspaceId: string) {
  const integration = await getIntegration(workspaceId, "facebook");
  const pages = Array.isArray((integration?.metadata as { pages?: unknown[] } | null)?.pages)
    ? ((integration?.metadata as { pages?: Array<{ id: string; name: string }> }).pages ?? [])
    : [];

  return pages.map((page) => ({
    provider: "facebook" as const,
    handle: page.id,
    displayName: page.name,
    targetType: "page" as const,
    publishEnabled: true,
  }));
}
