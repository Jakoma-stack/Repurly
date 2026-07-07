import {
  exchangeLinkedInCode,
  fetchLinkedInMember,
  fetchOrganizationAccess,
  refreshLinkedInToken,
  type LinkedInRequestError,
} from '@/lib/linkedin/client';
import { getLinkedInConfig } from '@/lib/linkedin/config';
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

function parseGrantedScopes(scope?: string) {
  return new Set((scope ?? '').split(/\s+/).map((entry) => entry.trim()).filter(Boolean));
}

function buildOrganizationSyncWarning(error: unknown, grantedScopes: Set<string>) {
  const linkedInError = error as LinkedInRequestError | undefined;
  const details = linkedInError?.body?.trim();

  if (grantedScopes.size > 0 && !grantedScopes.has('w_organization_social') && !grantedScopes.has('rw_organization_admin')) {
    return 'linkedin-company-pages-missing-scopes';
  }

  if (linkedInError?.status === 403) {
    return 'linkedin-company-pages-forbidden';
  }

  if (linkedInError?.status === 401) {
    return 'linkedin-company-pages-unauthorized';
  }

  if (details && /organization|company|page/i.test(details)) {
    return 'linkedin-company-pages-unavailable';
  }

  return 'linkedin-company-pages-sync-failed';
}

export async function connectLinkedInWorkspace(workspaceId: string, code: string, configKey?: string | null) {
  const config = getLinkedInConfig({ configKey });
  const tokens = await exchangeLinkedInCode(code, config.key);
  const member = await fetchLinkedInMember(tokens.access_token);
  const grantedScopes = parseGrantedScopes(tokens.scope);

  let organizations: { elements: Array<Record<string, unknown>> } = { elements: [] };
  let organizationSyncWarning: string | null = null;

  try {
    organizations = await fetchOrganizationAccess(tokens.access_token, config.key);
  } catch (error) {
    organizationSyncWarning = buildOrganizationSyncWarning(error, grantedScopes);
  }

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

  const memberHandle = `urn:li:person:${member.sub}`;
  const preferredDefaultHandle = organizationAccounts[0]?.handle ?? memberHandle;

  const integration = await upsertIntegration({
    workspaceId,
    provider: 'linkedin',
    externalAccountId: member.sub,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    refreshTokenExpiresAt: tokens.refresh_token_expires_in ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000) : null,
    scopes: tokens.scope?.split(' ') ?? [],
    metadata: {
      member,
      organizations,
      linkedInConfigKey: config.key,
      organizationSyncWarning,
    },
    status: 'connected',
  });

  await syncPlatformAccounts(workspaceId, integration.id, 'linkedin', [
    {
      provider: 'linkedin',
      handle: memberHandle,
      displayName: member.name ?? member.email ?? 'LinkedIn member',
      targetType: 'member',
      publishEnabled: true,
    },
    ...organizationAccounts,
  ], {
    preferredDefaultHandle,
    replaceDefaultWhenAvailable: organizationAccounts.length > 0,
  });

  return { member, organizations, organizationSyncWarning };
}

export async function getValidLinkedInAccessToken(workspaceId: string) {
  return getValidAccessToken(workspaceId, 'linkedin', async (refreshToken, integration) => {
    const metadata = integration.metadata as Record<string, unknown> | null;
    const configKey = typeof metadata?.linkedInConfigKey === 'string' ? metadata.linkedInConfigKey : null;
    const refreshed = await refreshLinkedInToken(refreshToken, configKey);
    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      refreshTokenExpiresAt: refreshed.refresh_token_expires_in ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000) : null,
      scopes: refreshed.scope?.split(' '),
      metadata: configKey ? { linkedInConfigKey: configKey } : undefined,
    };
  });
}
