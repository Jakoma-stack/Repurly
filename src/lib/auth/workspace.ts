import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { workspaceMemberships, workspaces } from '../../../drizzle/schema';

const WORKSPACE_COOKIE = 'repurly_workspace';

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

type AccessibleWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
  clerkOrganizationId: string | null;
};

export type WorkspaceSession = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: string;
  availableWorkspaces: Array<{ id: string; name: string; slug: string; role: string }>;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}

export async function listAccessibleWorkspaces(userId: string): Promise<AccessibleWorkspace[]> {
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

function buildWorkspaceName(user: ClerkUser) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  if (fullName) {
    return `${fullName}'s workspace`;
  }

  return `${user.username || user.primaryEmailAddress?.emailAddress || 'Repurly'} workspace`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'workspace'
  );
}

function buildWorkspaceSlug(baseSlug: string, suffix: string) {
  return `${baseSlug}-${suffix}`.slice(0, 120);
}

async function createWorkspaceMembership(workspaceId: string, userId: string) {
  const existingMembership = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.clerkUserId, userId)))
    .limit(1);

  if (!existingMembership[0]) {
    await db.insert(workspaceMemberships).values({
      workspaceId,
      clerkUserId: userId,
      role: 'owner',
    });
  }
}

async function findWorkspaceBySlug(workspaceSlug: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      clerkOrganizationId: workspaces.clerkOrganizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, workspaceSlug))
    .limit(1);

  return rows[0] ?? null;
}

async function findWorkspaceByOrgId(orgId: string | null) {
  if (!orgId) {
    return null;
  }

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      clerkOrganizationId: workspaces.clerkOrganizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.clerkOrganizationId, orgId))
    .limit(1);

  return rows[0] ?? null;
}

async function repairWorkspaceAccess(args: {
  userId: string;
  workspaceId: string;
}) {
  await createWorkspaceMembership(args.workspaceId, args.userId);
  const repaired = await listAccessibleWorkspaces(args.userId);
  return repaired[0] ?? null;
}

async function createStarterWorkspaceForUser(args: {
  userId: string;
  orgId: string | null;
  user: ClerkUser;
}): Promise<AccessibleWorkspace> {
  const { userId, orgId, user } = args;

  const existing = await listAccessibleWorkspaces(userId);
  if (existing.length) {
    return existing[0];
  }

  const orgWorkspace = await findWorkspaceByOrgId(orgId);
  if (orgWorkspace) {
    const repaired = await repairWorkspaceAccess({ userId, workspaceId: orgWorkspace.id });
    if (repaired) {
      return repaired;
    }
  }

  const workspaceName = buildWorkspaceName(user);
  const baseSlug = slugify(workspaceName.replace(/'s workspace$/i, ''));
  const userSuffix = userId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-6) || 'owner';
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const timestampSuffix = Date.now().toString(36);
  const slugCandidates = [
    buildWorkspaceSlug(baseSlug, userSuffix),
    buildWorkspaceSlug(baseSlug, timestampSuffix),
    buildWorkspaceSlug(baseSlug, randomSuffix),
    buildWorkspaceSlug(baseSlug, `${userSuffix}${randomSuffix}`),
  ];

  for (const workspaceSlug of slugCandidates) {
    try {
      const created = await db.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(workspaces)
          .values({
            name: workspaceName,
            slug: workspaceSlug,
            clerkOrganizationId: orgId,
          })
          .returning({
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            clerkOrganizationId: workspaces.clerkOrganizationId,
          });

        await tx.insert(workspaceMemberships).values({
          workspaceId: workspace.id,
          clerkUserId: userId,
          role: 'owner',
        });

        return workspace;
      });

      return {
        ...created,
        role: 'owner',
      };
    } catch (error) {
      console.error('Workspace bootstrap attempt failed', {
        userId,
        orgId,
        workspaceName,
        workspaceSlug,
        error: serializeError(error),
      });

      const raced = await listAccessibleWorkspaces(userId);
      if (raced.length) {
        return raced[0];
      }

      const existingOrgWorkspace = await findWorkspaceByOrgId(orgId);
      if (existingOrgWorkspace) {
        const repaired = await repairWorkspaceAccess({ userId, workspaceId: existingOrgWorkspace.id });
        if (repaired) {
          return repaired;
        }
      }

      const existingWorkspace = await findWorkspaceBySlug(workspaceSlug);
      if (existingWorkspace) {
        try {
          const repaired = await repairWorkspaceAccess({ userId, workspaceId: existingWorkspace.id });
          if (repaired) {
            return repaired;
          }
        } catch (repairError) {
          console.error('Workspace bootstrap repair failed', {
            userId,
            workspaceId: existingWorkspace.id,
            workspaceSlug,
            error: serializeError(repairError),
          });
        }
      }
    }
  }

  throw new Error('Workspace setup failed');
}

export async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const [{ userId, orgId }, user] = await Promise.all([auth(), currentUser()]);

  if (!userId || !user) {
    redirect('/sign-in');
  }

  let available = await listAccessibleWorkspaces(userId);

  if (!available.length) {
    const createdWorkspace = await createStarterWorkspaceForUser({
      userId,
      orgId: orgId ?? null,
      user,
    });

    available = [createdWorkspace];
  }

  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const matchingOrg = orgId
    ? available.find((item) => item.clerkOrganizationId === orgId)
    : undefined;

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
    availableWorkspaces: available.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      role: item.role,
    })),
  };
}

export async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const rows = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.clerkUserId, userId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);

  return Boolean(rows[0]?.id);
}
