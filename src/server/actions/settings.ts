'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { setWorkspaceOperatorFlag, type OperatorFlagKey } from '@/lib/ops/feature-flags';
import { auditEvents, workspaceInvites, workspaceMemberships } from '../../../drizzle/schema';

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function settingsPath(ok?: string, error?: string) {
  const search = new URLSearchParams();
  if (ok) search.set('ok', ok);
  if (error) search.set('error', error);
  return `/app/settings${search.toString() ? `?${search.toString()}` : ''}` as Route;
}

async function logAudit(workspaceId: string, actorId: string | null, eventType: string, entityId: string, payload?: Record<string, unknown>) {
  await db.insert(auditEvents).values({
    workspaceId,
    actorId,
    eventType,
    entityType: 'settings',
    entityId,
    payload: payload ?? null,
  });
}

export async function updateOperatorControl(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const key = requiredString(formData, 'key') as OperatorFlagKey;
  const enabled = requiredString(formData, 'enabled') === 'true';
  const { userId } = await auth();
  if (!workspaceId || !key) redirect(settingsPath(undefined, 'invalid'));
  await setWorkspaceOperatorFlag(workspaceId, key, enabled);
  await logAudit(workspaceId, userId ?? null, 'operator_control_updated', key, { enabled });
  revalidatePath('/app/settings');
  revalidatePath('/app');
  redirect(settingsPath('operator-control-updated'));
}

export async function createWorkspaceInvite(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const email = requiredString(formData, 'email').toLowerCase();
  const role = requiredString(formData, 'role') || 'viewer';
  const { userId } = await auth();
  if (!workspaceId || !email || !userId) redirect(settingsPath(undefined, 'invalid'));
  const token = crypto.randomUUID();
  await db.insert(workspaceInvites).values({
    workspaceId,
    email,
    role: role as 'owner' | 'admin' | 'editor' | 'approver' | 'viewer',
    token,
    invitedById: userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  });
  await logAudit(workspaceId, userId, 'workspace_invite_created', token, { email, role });
  revalidatePath('/app/settings');
  redirect(settingsPath('invite-created'));
}

export async function revokeWorkspaceInvite(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const inviteId = requiredString(formData, 'inviteId');
  const { userId } = await auth();
  if (!workspaceId || !inviteId) redirect(settingsPath(undefined, 'invalid'));
  await db.update(workspaceInvites).set({ status: 'revoked' }).where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.id, inviteId)));
  await logAudit(workspaceId, userId ?? null, 'workspace_invite_revoked', inviteId);
  revalidatePath('/app/settings');
  redirect(settingsPath('invite-revoked'));
}

export async function removeWorkspaceMember(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const membershipId = requiredString(formData, 'membershipId');
  const { userId } = await auth();
  if (!workspaceId || !membershipId) redirect(settingsPath(undefined, 'invalid'));
  await db.delete(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.id, membershipId)));
  await logAudit(workspaceId, userId ?? null, 'workspace_member_removed', membershipId);
  revalidatePath('/app/settings');
  redirect(settingsPath('member-removed'));
}

export async function acceptWorkspaceInvite(formData: FormData) {
  const token = requiredString(formData, 'token');
  const user = await currentUser();
  const { userId } = await auth();
  if (!token || !user || !userId) redirect('/sign-in' as Route);
  const email = (user.primaryEmailAddress?.emailAddress ?? '').toLowerCase();
  const inviteRows = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token)).limit(1);
  const invite = inviteRows[0];
  if (!invite || invite.status !== 'pending') redirect('/app/settings?error=invite-missing' as Route);
  if ((invite.email ?? '').toLowerCase() != email) redirect('/app/settings?error=invite-email-mismatch' as Route);

  const existing = await db.select({ id: workspaceMemberships.id }).from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, invite.workspaceId), eq(workspaceMemberships.clerkUserId, userId))).limit(1);
  if (!existing[0]?.id) {
    await db.insert(workspaceMemberships).values({ workspaceId: invite.workspaceId, clerkUserId: userId, role: invite.role });
  }
  await db.update(workspaceInvites).set({ status: 'accepted', acceptedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
  await logAudit(invite.workspaceId, userId, 'workspace_invite_accepted', invite.id, { email });
  revalidatePath('/app/settings');
  redirect('/app?ok=invite-accepted' as Route);
}
