'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireWorkspaceSession, requireWorkspaceRole } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { canImportPilotPortfolio } from './portfolio';
import { communityConfig } from '@/lib/linkedin/community-config';
import { createOAuthState } from '@/lib/oauth/state';
import { db } from '@/lib/db/client';
import { communityConnections } from '../../../drizzle/schema';
export async function connectCommunity() {
  const session=await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId,['owner','admin']);
  await requirePaidWorkspaceAccess(session.workspaceId);
  const c=communityConfig();
  if(!c || !(await canImportPilotPortfolio())) redirect('/app/community?connection=disabled');
  const state=createOAuthState({purpose:'community-read',workspaceId:session.workspaceId,userId:session.userId,organization:c.organization});
  (await cookies()).set('janeomi_community_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/api/community/callback'});
  const params=new URLSearchParams({response_type:'code',client_id:c.clientId,redirect_uri:c.redirectUri,state,scope:'rw_organization_admin'});
  redirect('https://www.linkedin.com/oauth/v2/authorization?'+params.toString());
}
export async function disconnectCommunity() {
  const session=await requireWorkspaceSession();
  await requireWorkspaceRole(session.workspaceId,['owner','admin']);
  await db.delete(communityConnections).where(eq(communityConnections.workspaceId,session.workspaceId));
  redirect('/app/community?connection=disconnected');
}
