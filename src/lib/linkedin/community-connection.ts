import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { communityConnections, workspaceMemberships } from '../../../drizzle/schema';
import { communityConfig } from './community-config';
import { decryptSecret } from '@/lib/security';
import { readCommunityStatistics } from './community-read';
export async function communitySnapshot(workspaceId:string) {
  const config=communityConfig();
  if(!config) return {status:'disabled'} as const;
  const [row]=await db.select().from(communityConnections).where(eq(communityConnections.workspaceId,workspaceId)).limit(1);
  if(!row || row.organization!==config.organization || row.expiresAt.getTime()<=Date.now()) return {status:'disconnected'} as const;
  const [membership]=await db.select({role:workspaceMemberships.role}).from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId,workspaceId),eq(workspaceMemberships.clerkUserId,row.connectedBy))).limit(1);
  if(!membership || !['owner','admin'].includes(membership.role)) return {status:'permission-denied'} as const;
  try { return await readCommunityStatistics({enabled:true,version:config.version,organization:config.organization,token:decryptSecret(row.encryptedToken),scopes:row.scopes}); } catch { return {status:'unavailable'} as const; }
}
