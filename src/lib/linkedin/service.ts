import { and, desc, eq } from 'drizzle-orm';

import {
  exchangeLinkedInCode,
  fetchLinkedInMember,
  fetchOrganizationAccess,
  refreshLinkedInToken,
} from '@/lib/linkedin/client';
import { getValidAccessToken, upsertIntegration } from '@/lib/integrations/service';
import { db } from '@/lib/db/client';
import { integrations, platformAccounts } from '../../../drizzle/schema';

type LinkedInOrganization = {
  id?: string | number;
  organization?: string;
  urn?: string;
  name?: string;
  localizedName?: string;
  vanityName?: string;
  handle?: string;
};

function normalizeOrganizationId(raw: unknown) {
  if (typeof raw === 'string' && raw.length) return raw;
  if (typeof raw === 'number') return String(raw);
  return null;
}

function normalizeLinkedInHandle(org: LinkedInOrganization) {
  if (typeof org.handle === 'string' && org.handle.length) return org.handle;
  if (typeof org.vanityName === 'string' && org.vanityName.length) return `@${org.vanityName}`;
  const orgId = normalizeOrganizationId(org.id ?? org.organization ?? org.urn);
  return orgId ? `urn:${orgId}` : '@linkedin';
}

function normalizeLinkedInDisplayName(org: LinkedInOrganization, fallback: string) {
  if (typeof org.localizedName === 'string' && org.localizedName.length) return org.localizedName;
  if (typeof org.name === 'string' && org.name.length) return org.name;
  return fallback;
}

function coerceOrganizations(value: unknown): LinkedInOrganization[] {
  if (Array.isArray(value)) return value as LinkedInOrganization[];
  if (value && typeof value === 'object') {
    const maybeElements = (value as { elements?: unknown }).elements;
    if (Array.isArray(maybeElements)) return maybeElements as LinkedInOrganization[];
  }
  return [];
}

async function materializeLinkedInTargets(
  workspaceId: string,
  integrationId: string,
  organizations: unknown,
  member: { sub: string; name?: string; email?: string },
) {
  const items = coerceOrganizations(organizations);

  if (items.length) {
    let index = 0;

    for (const org of items) {
      const externalAccountId = normalizeOrganizationId(org.id ?? org.organization ?? org.urn);
      if (!externalAccountId) continue;

      const displayName = normalizeLinkedInDisplayName(org, 'LinkedIn organization');
      const handle = normalizeLinkedInHandle(org);

      const existing = await db
        .select({ id: platformAccounts.id })
        .from(platformAccounts)
        .where(
          and(
            eq(platformAccounts.workspaceId, workspaceId),
            eq(platformAccounts.provider, 'linkedin'),
            eq(platformAccounts.externalAccountId, externalAccountId),
          ),
        )
        .limit(1);

      if (existing[0]?.id) {
        await db
          .update(platformAccounts)
          .set({
            integrationId,
            displayName,
            handle,
            targetType: 'organization',
            publishEnabled: true,
            isDefault: index === 0,
            metadata: { raw: org, seeded: false, fake: false, source: 'linkedin-oauth' },
            updatedAt: new Date(),
          })
          .where(eq(platformAccounts.id, existing[0].id));
      } else {
        await db.insert(platformAccounts).values({
          workspaceId,
          integrationId,
          provider: 'linkedin',
          handle,
          displayName,
          externalAccountId,
          targetType: 'organization',
          isDefault: index === 0,
          publishEnabled: true,
          metadata: { raw: org, seeded: false, fake: false, source: 'linkedin-oauth' },
        });
      }

      index += 1;
    }

    return;
  }

  const handle = member.email ? `@${member.email.split('@')[0]}` : '@linkedin-member';
  const displayName = member.name || member.email || 'LinkedIn member';

  await db
    .update(platformAccounts)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(platformAccounts.workspaceId, workspaceId),
        eq(platformAccounts.provider, 'linkedin'),
      ),
    );

  const existingLinkedInTargets = await db
    .select({
      id: platformAccounts.id,
      externalAccountId: platformAccounts.externalAccountId,
      metadata: platformAccounts.metadata,
    })
    .from(platformAccounts)
    .where(
      and(
        eq(platformAccounts.workspaceId, workspaceId),
        eq(platformAccounts.provider, 'linkedin'),
      ),
    );

  const existingMember = existingLinkedInTargets.find(
    (row) => row.externalAccountId === member.sub,
  );

  const seededFake = existingLinkedInTargets.find((row) => {
    const metadata = row.metadata as Record<string, unknown> | null | undefined;
    return metadata?.seeded === true || metadata?.fake === true;
  });

  const rowToReuse = existingMember ?? seededFake;

  if (rowToReuse?.id) {
    await db
      .update(platformAccounts)
      .set({
        integrationId,
        externalAccountId: member.sub,
        displayName,
        handle,
        targetType: 'member',
        publishEnabled: true,
        isDefault: true,
        metadata: {
          raw: member,
          seeded: false,
          fake: false,
          source: 'linkedin-oauth',
          materializedFrom: 'member-fallback',
        },
        updatedAt: new Date(),
      })
      .where(eq(platformAccounts.id, rowToReuse.id));
  } else {
    await db.insert(platformAccounts).values({
      workspaceId,
      integrationId,
      provider: 'linkedin',
      externalAccountId: member.sub,
      displayName,
      handle,
      targetType: 'member',
      isDefault: true,
      publishEnabled: true,
      metadata: {
        raw: member,
        seeded: false,
        fake: false,
        source: 'linkedin-oauth',
        materializedFrom: 'member-fallback',
      },
    });
  }
}

export async function connectLinkedInWorkspace(workspaceId: string, code: string) {
  const tokens = await exchangeLinkedInCode(code);
  const member = await fetchLinkedInMember(tokens.access_token);
  const organizations = await fetchOrganizationAccess(tokens.access_token);

  await upsertIntegration({
    workspaceId,
    provider: 'linkedin',
    externalAccountId: member.sub,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    refreshTokenExpiresAt: tokens.refresh_token_expires_in
      ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000)
      : null,
    scopes: tokens.scope?.split(' ') ?? [],
    metadata: { member, organizations },
    status: 'connected',
  });

  const integrationRow = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, 'linkedin')))
    .orderBy(desc(integrations.updatedAt))
    .limit(1);

  const integrationId = integrationRow[0]?.id;
  if (integrationId) {
    await materializeLinkedInTargets(workspaceId, integrationId, organizations, member);
  }

  return { member, organizations };
}

export async function getValidLinkedInAccessToken(workspaceId: string) {
  return getValidAccessToken(workspaceId, 'linkedin', async (refreshToken) => {
    const refreshed = await refreshLinkedInToken(refreshToken);
    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      refreshTokenExpiresAt: refreshed.refresh_token_expires_in
        ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)
        : null,
      scopes: refreshed.scope?.split(' '),
    };
  });
}
