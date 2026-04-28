import { exchangeInstagramCode, extendInstagramToken, fetchInstagramBusinessAccounts } from "@/lib/instagram/client";
import { getIntegration, getValidAccessToken, syncPlatformAccounts, upsertIntegration } from "@/lib/integrations/service";

export async function connectInstagramWorkspace(workspaceId: string, code: string) {
  const shortLived = await exchangeInstagramCode(code);
  const longLived = await extendInstagramToken(shortLived.access_token);
  const pages = await fetchInstagramBusinessAccounts(longLived.access_token);
  const instagramAccounts = pages.data
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      instagramId: page.instagram_business_account!.id,
      username: page.instagram_business_account!.username ?? page.instagram_business_account!.name ?? page.name,
      displayName: page.instagram_business_account!.name ?? page.name,
      profilePictureUrl: page.instagram_business_account!.profile_picture_url,
    }));

  const integration = await upsertIntegration({
    workspaceId,
    provider: "instagram",
    externalAccountId: instagramAccounts[0]?.instagramId ?? "instagram-business",
    accessToken: longLived.access_token,
    accessTokenExpiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null,
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list", "business_management"],
    metadata: { instagramAccounts },
    status: instagramAccounts.length > 0 ? "connected" : "needs_page_mapping",
  });

  await syncPlatformAccounts(
    workspaceId,
    integration.id,
    "instagram",
    instagramAccounts.map((account) => ({
      provider: "instagram" as const,
      handle: account.instagramId,
      displayName: `@${account.username}`,
      targetType: "organization" as const,
      publishEnabled: true,
    }))
  );

  return { instagramAccounts };
}

export async function getValidInstagramAccessToken(workspaceId: string) {
  return getValidAccessToken(workspaceId, "instagram", async (refreshToken) => {
    const refreshed = await extendInstagramToken(refreshToken);
    const integration = await getIntegration(workspaceId, "instagram");
    return {
      accessToken: refreshed.access_token,
      refreshToken,
      accessTokenExpiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
      metadata: (integration?.metadata as Record<string, unknown> | undefined) ?? {},
    };
  });
}

export async function discoverInstagramAccounts(workspaceId: string) {
  const integration = await getIntegration(workspaceId, "instagram");
  const instagramAccounts = Array.isArray((integration?.metadata as { instagramAccounts?: unknown[] } | null)?.instagramAccounts)
    ? ((integration?.metadata as { instagramAccounts?: Array<{ instagramId: string; username: string }> }).instagramAccounts ?? [])
    : [];

  return instagramAccounts.map((account) => ({
    provider: "instagram" as const,
    handle: account.instagramId,
    displayName: `@${account.username}`,
    targetType: "organization" as const,
    publishEnabled: true,
  }));
}
