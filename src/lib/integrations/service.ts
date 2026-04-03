import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/security";
import { integrations, platformAccounts } from "../../../drizzle/schema";
import type { PlatformAccountSummary, PlatformKey } from "@/lib/platforms/types";

export type IntegrationUpsertInput = {
  workspaceId: string;
  provider: PlatformKey;
  externalAccountId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  status?: string;
};

export async function getIntegration(workspaceId: string, provider: PlatformKey) {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, provider)))
    .limit(1);
  return integration ?? null;
}

export async function upsertIntegration(input: IntegrationUpsertInput) {
  const existing = await getIntegration(input.workspaceId, input.provider);
  const payload = {
    externalAccountId: input.externalAccountId ?? existing?.externalAccountId ?? null,
    encryptedAccessToken: input.accessToken ? encryptSecret(input.accessToken) : existing?.encryptedAccessToken ?? null,
    encryptedRefreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : existing?.encryptedRefreshToken ?? null,
    accessTokenExpiresAt: input.accessTokenExpiresAt ?? existing?.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? existing?.refreshTokenExpiresAt ?? null,
    scopes: input.scopes ?? (existing?.scopes as string[] | null) ?? [],
    metadata: input.metadata ?? (existing?.metadata as Record<string, unknown> | null) ?? {},
    status: input.status ?? existing?.status ?? "connected",
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(integrations).set(payload).where(eq(integrations.id, existing.id));
    return { ...existing, ...payload };
  }

  const [created] = await db
    .insert(integrations)
    .values({
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalAccountId: payload.externalAccountId,
      encryptedAccessToken: payload.encryptedAccessToken,
      encryptedRefreshToken: payload.encryptedRefreshToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt,
      scopes: payload.scopes,
      metadata: payload.metadata,
      status: payload.status,
    })
    .returning();
  return created;
}

export async function getValidAccessToken(
  workspaceId: string,
  provider: PlatformKey,
  refresh: (refreshToken: string) => Promise<{
    accessToken: string;
    refreshToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    refreshTokenExpiresAt?: Date | null;
    scopes?: string[];
    metadata?: Record<string, unknown>;
  }>
) {
  const integration = await getIntegration(workspaceId, provider);
  if (!integration?.encryptedAccessToken) {
    throw new Error(`${provider} is not connected`);
  }

  const shouldRefresh = integration.accessTokenExpiresAt
    ? integration.accessTokenExpiresAt.getTime() < Date.now() + 1000 * 60 * 15
    : false;

  if (!shouldRefresh) {
    return decryptSecret(integration.encryptedAccessToken);
  }

  if (!integration.encryptedRefreshToken) {
    return decryptSecret(integration.encryptedAccessToken);
  }

  const refreshed = await refresh(decryptSecret(integration.encryptedRefreshToken));
  await upsertIntegration({
    workspaceId,
    provider,
    externalAccountId: integration.externalAccountId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? decryptSecret(integration.encryptedRefreshToken),
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt ?? integration.refreshTokenExpiresAt,
    scopes: refreshed.scopes ?? (integration.scopes as string[] | undefined),
    metadata: {
      ...(integration.metadata as Record<string, unknown> | null),
      ...(refreshed.metadata ?? {}),
    },
    status: "connected",
  });

  return refreshed.accessToken;
}

export async function syncPlatformAccounts(
  workspaceId: string,
  integrationId: string,
  provider: PlatformKey,
  accounts: PlatformAccountSummary[]
) {
  const existing = await db
    .select()
    .from(platformAccounts)
    .where(and(eq(platformAccounts.workspaceId, workspaceId), eq(platformAccounts.provider, provider)));

  for (const account of accounts) {
    const match = existing.find((row) => row.externalAccountId === account.handle || row.handle === account.handle);
    if (match) {
      await db
        .update(platformAccounts)
        .set({
          displayName: account.displayName,
          handle: account.handle,
          targetType: account.targetType,
          publishEnabled: account.publishEnabled,
          updatedAt: new Date(),
        })
        .where(eq(platformAccounts.id, match.id));
    } else {
      await db.insert(platformAccounts).values({
        workspaceId,
        integrationId,
        provider,
        handle: account.handle,
        displayName: account.displayName,
        externalAccountId: account.handle,
        targetType: account.targetType,
        isDefault: existing.length === 0,
        publishEnabled: account.publishEnabled,
        metadata: {},
      });
    }
  }
}
