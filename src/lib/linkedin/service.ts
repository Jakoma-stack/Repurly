import { exchangeLinkedInCode, fetchLinkedInMember, fetchOrganizationAccess, refreshLinkedInToken } from '@/lib/linkedin/client';
import { getValidAccessToken, syncPlatformAccounts, upsertIntegration } from '@/lib/integrations/service';

function getOrganizationTargetId(value: unknown) {
  if (typeof value !== 'string') return null;
  const id = value.split(':').pop();
  return id ? `urn:li:organization:${id}` : null;
}

function readOrganizationName(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { localizedName?: unknown; name?: unknown };
  if (typeof candidate.localizedName === 'string') return candidate.localizedName;
  if (typeof candidate.name === 'string') return candidate.name;
  return null;
}

export async function connectLinkedInWorkspace(workspaceId: string, code: string) {
  const tokens = await exchangeLinkedInCode(code);
  const member = await fetchLinkedInMember(tokens.access_token);
  const organizations = await fetchOrganizationAccess(tokens.access_token);

  const integration = await upsertIntegration({
    workspaceId,
    provider: 'linkedin',
    externalAccountId: member.sub,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    refreshTokenExpiresAt: tokens.refresh_token_expires_in ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000) : null,
    scopes: tokens.scope?.split(' ') ?? [],
    metadata: { member, organizations },
    status: 'connected',
  });

  const organizationAccounts = (Array.isArray(organizations.elements) ? organizations.elements : [])
    .map((entry) => {
      const candidate = entry as Record<string, unknown>;
      const handle = getOrganizationTargetId(candidate.organization ?? candidate.organizationalTarget);
      if (!handle) return null;

      const displayName =
        readOrganizationName(candidate['organization~']) ??
        readOrganizationName(candidate['organizationalTarget~']) ??
        `LinkedIn organization ${handle.split(':').pop()}`;

      return {
        provider: 'linkedin' as const,
        handle,
        displayName,
        targetType: 'organization' as const,
        publishEnabled: true,
      };
    })
    .filter((account): account is NonNullable<typeof account> => Boolean(account));

  await syncPlatformAccounts(workspaceId, integration.id, 'linkedin', [
    {
      provider: 'linkedin',
      handle: `urn:li:person:${member.sub}`,
      displayName: member.name ?? member.email ?? 'LinkedIn member',
      targetType: 'member',
      publishEnabled: true,
    },
    ...organizationAccounts,
  ]);

  return { member, organizations };
}

export async function getValidLinkedInAccessToken(workspaceId: string) {
  return getValidAccessToken(workspaceId, 'linkedin', async (refreshToken) => {
    const refreshed = await refreshLinkedInToken(refreshToken);
    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      refreshTokenExpiresAt: refreshed.refresh_token_expires_in ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000) : null,
      scopes: refreshed.scope?.split(' '),
    };
  });
}
