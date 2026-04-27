'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { requireWorkspaceRole, type WorkspaceRole } from '@/lib/auth/workspace';
import { setWorkspaceOperatorFlag, type OperatorFlagKey } from '@/lib/ops/feature-flags';
import { auditEvents, workspaceInvites, workspaceMemberships } from '../../../drizzle/schema';

const SETTINGS_ADMIN_ROLES = ['owner', 'admin'] as const;
const INVITABLE_ROLES: readonly WorkspaceRole[] = ['owner', 'admin', 'editor', 'approver', 'viewer'];

function requiredString(formData: FormData, key: string) { return String(formData.get(key) ?? '').trim(); }

function settingsPath(ok?: string, error?: string) {
  const search = new URLSearchParams();
  if (ok) search.set('ok', ok);
  if (error) search.set('error', error);
  return `/app/settings${search.toString() ? `?${search.toString()}` : ''}` as Route;
}

async function logAudit(workspaceId: string, actorId: string | null, eventType: string, entityId: string, payload?: Record<string, unknown>) {
  await db.insert(auditEvents).values({ workspaceId, actorId, eventType, entityType: 'settings', entityId, payload: payload ?? null });
}

function normalizeInviteRole(input: string): WorkspaceRole {
  return INVITABLE_ROLES.includes(input as WorkspaceRole) ? (input as WorkspaceRole) : 'viewer';
}

export async function updateOperatorControl(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const key = requiredString(formData, 'key') as OperatorFlagKey;
  const enabled = requiredString(formData, 'enabled') === 'true';
  if (!workspaceId || !key) redirect(settingsPath(undefined, 'invalid'));
  const access = await requireWorkspaceRole(workspaceId, SETTINGS_ADMIN_ROLES);
  await setWorkspaceOperatorFlag(workspaceId, key, enabled);
  await logAudit(workspaceId, access.userId, 'operator_control_updated', key, { enabled });
  revalidatePath('/app/settings');
  revalidatePath('/app');
  redirect(settingsPath('operator-control-updated'));
}

export async function createWorkspaceInvite(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const email = requiredString(formData, 'email').toLowerCase();
  const role = normalizeInviteRole(requiredString(formData, 'role') || 'viewer');
  if (!workspaceId || !email) redirect(settingsPath(undefined, 'invalid'));
  const access = await requireWorkspaceRole(workspaceId, SETTINGS_ADMIN_ROLES);
  if (role === 'owner' && access.role !== 'owner') redirect(settingsPath(undefined, 'owner-role-required'));
  const token = crypto.randomUUID();
  await db.insert(workspaceInvites).values({ workspaceId, email, role, token, invitedById: access.userId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) });
  await logAudit(workspaceId, access.userId, 'workspace_invite_created', token, { email, role });
  revalidatePath('/app/settings');
  redirect(settingsPath('invite-created'));
}

export async function revokeWorkspaceInvite(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const inviteId = requiredString(formData, 'inviteId');
  if (!workspaceId || !inviteId) redirect(settingsPath(undefined, 'invalid'));
  const access = await requireWorkspaceRole(workspaceId, SETTINGS_ADMIN_ROLES);
  await db.update(workspaceInvites).set({ status: 'revoked' }).where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.id, inviteId)));
  await logAudit(workspaceId, access.userId, 'workspace_invite_revoked', inviteId);
  revalidatePath('/app/settings');
  redirect(settingsPath('invite-revoked'));
}

export async function removeWorkspaceMember(formData: FormData) {
  const workspaceId = requiredString(formData, 'workspaceId');
  const membershipId = requiredString(formData, 'membershipId');
  if (!workspaceId || !membershipId) redirect(settingsPath(undefined, 'invalid'));
  const access = await requireWorkspaceRole(workspaceId, SETTINGS_ADMIN_ROLES);
  const targetRows = await db.select({ id: workspaceMemberships.id, clerkUserId: workspaceMemberships.clerkUserId, role: workspaceMemberships.role }).from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.id, membershipId))).limit(1);
  const target = targetRows[0];
  if (!target) redirect(settingsPath(undefined, 'member-missing'));
  if (target.clerkUserId === access.userId) redirect(settingsPath(undefined, 'cannot-remove-self'));
  if (target.role === 'owner' && access.role !== 'owner') redirect(settingsPath(undefined, 'owner-role-required'));
  if (target.role === 'owner') {
    const ownerRows = await db.select({ id: workspaceMemberships.id }).from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.role, 'owner')));
    if (ownerRows.length <= 1) redirect(settingsPath(undefined, 'last-owner'));
  }
  await db.delete(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.id, membershipId)));
  await logAudit(workspaceId, access.userId, 'workspace_member_removed', membershipId, { removedUserId: target.clerkUserId, role: target.role });
  revalidatePath('/app/settings');
  redirect(settingsPath('member-removed'));
}

export async function acceptWorkspaceInvite(formData: FormData) {
  const token = requiredString(formData, 'token');
  const user = await currentUser();
  const { userId } = await auth();
  if (!token || !user || !userId) redirect('/sign-in' as Route);
  const email = ((user as NonNullable<typeof user>).primaryEmailAddress?.emailAddress ?? '').toLowerCase();
  const inviteRows = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token)).limit(1);
  const invite = inviteRows[0];
  if (!invite || invite.status !== 'pending') redirect('/app/settings?error=invite-missing' as Route);
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) redirect('/app/settings?error=invite-expired' as Route);
  if ((invite.email ?? '').toLowerCase() !== email) redirect('/app/settings?error=invite-email-mismatch' as Route);
  const existing = await db.select({ id: workspaceMemberships.id }).from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, invite.workspaceId), eq(workspaceMemberships.clerkUserId, userId))).limit(1);
  if (!existing[0]?.id) await db.insert(workspaceMemberships).values({ workspaceId: invite.workspaceId, clerkUserId: userId, role: invite.role });
  await db.update(workspaceInvites).set({ status: 'accepted', acceptedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
  await logAudit(invite.workspaceId, userId, 'workspace_invite_accepted', invite.id, { email });
  revalidatePath('/app/settings');
  redirect('/app?ok=invite-accepted' as Route);
}
