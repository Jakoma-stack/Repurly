import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workspaceMemberships, workspaces } from '../../../drizzle/schema';

const WORKSPACE_COOKIE = 'repurly_workspace';
const LOCAL_SETUP_WORKSPACE_ID = '__local_setup__';

export type WorkspaceSession = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: string;
  availableWorkspaces: Array<{ id: string; name: string; slug: string; role: string }>;
};

export async function listAccessibleWorkspaces(userId: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMemberships.role,
      clerkOrganizationId: workspaces.clerkOrganizationId,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.clerkUserId, userId));

  return rows;
}

export async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const [{ userId, orgId }, user] = await Promise.all([auth(), currentUser()]);
  if (!userId || !user) redirect('/sign-in' as Route);

  const available = await listAccessibleWorkspaces(userId);

  if (!available.length) {
    if (process.env.NODE_ENV !== 'development') {
      redirect('/' as Route);
    }

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      'Local user';

    return {
      userId,
      workspaceId: LOCAL_SETUP_WORKSPACE_ID,
      workspaceName: 'Set up your workspace',
      workspaceSlug: 'setup',
      role: 'owner',
      availableWorkspaces: [
        {
          id: LOCAL_SETUP_WORKSPACE_ID,
          name: `${name} workspace`,
          slug: 'setup',
          role: 'owner',
        },
      ],
    };
  }

  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const matchingOrg = orgId ? available.find((item) => item.clerkOrganizationId === orgId) : undefined;
  const selected =
    available.find((item) => item.id === requestedWorkspaceId) ??
    matchingOrg ??
    available[0];

  return {
    userId,
    workspaceId: selected.id,
    workspaceName: selected.name,
    workspaceSlug: selected.slug,
    role: selected.role,
    availableWorkspaces: available.map((item) => ({ id: item.id, name: item.name, slug: item.slug, role: item.role })),
  };
}

export async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  if (workspaceId === LOCAL_SETUP_WORKSPACE_ID && process.env.NODE_ENV === 'development') {
    return true;
  }

  const rows = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.clerkUserId, userId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);

  return Boolean(rows[0]?.id);
}
