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

const ACCESS_TOKEN_REFRESH_WINDOW_MS = 1000 * 60 * 15;
const refreshInflight = new Map<string, Promise<string>>();

function buildRefreshKey(workspaceId: string, provider: PlatformKey) {
  return `${workspaceId}:${provider}`;
}

function shouldRefreshAccessToken(expiresAt: Date | null | undefined) {
  return expiresAt ? expiresAt.getTime() < Date.now() + ACCESS_TOKEN_REFRESH_WINDOW_MS : false;
}

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

  if (!shouldRefreshAccessToken(integration.accessTokenExpiresAt)) {
    return decryptSecret(integration.encryptedAccessToken);
  }

  if (!integration.encryptedRefreshToken) {
    return decryptSecret(integration.encryptedAccessToken);
  }

  const refreshKey = buildRefreshKey(workspaceId, provider);
  const inFlightRefresh = refreshInflight.get(refreshKey);
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const refreshPromise = (async () => {
    const latestIntegration = await getIntegration(workspaceId, provider);
    if (!latestIntegration?.encryptedAccessToken) {
      throw new Error(`${provider} is not connected`);
    }

    if (!shouldRefreshAccessToken(latestIntegration.accessTokenExpiresAt)) {
      return decryptSecret(latestIntegration.encryptedAccessToken);
    }

    if (!latestIntegration.encryptedRefreshToken) {
      return decryptSecret(latestIntegration.encryptedAccessToken);
    }

    const decryptedRefreshToken = decryptSecret(latestIntegration.encryptedRefreshToken);
    const refreshed = await refresh(decryptedRefreshToken);
    await upsertIntegration({
      workspaceId,
      provider,
      externalAccountId: latestIntegration.externalAccountId,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? decryptedRefreshToken,
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
      refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt ?? latestIntegration.refreshTokenExpiresAt,
      scopes: refreshed.scopes ?? (latestIntegration.scopes as string[] | undefined),
      metadata: {
        ...(latestIntegration.metadata as Record<string, unknown> | null),
        ...(refreshed.metadata ?? {}),
      },
      status: "connected",
    });

    return refreshed.accessToken;
  })().finally(() => {
    refreshInflight.delete(refreshKey);
  });

  refreshInflight.set(refreshKey, refreshPromise);
  return refreshPromise;
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
