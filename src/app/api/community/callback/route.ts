import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAuthenticatedWorkspaceRole } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { canImportPilotPortfolio } from '@/server/actions/portfolio';
import { communityConfig } from '@/lib/linkedin/community-config';
import { verifyOAuthState } from '@/lib/oauth/state';
import { readCommunityStatistics } from '@/lib/linkedin/community-read';
import { encryptSecret } from '@/lib/security';
import { db } from '@/lib/db/client';
import { communityConnections } from '../../../../../drizzle/schema';
export async function GET(request:NextRequest) {
  const finish=(status:string)=>{const r=NextResponse.redirect(new URL('/app/community?connection='+status,request.url));r.cookies.set('janeomi_community_state','',{path:'/api/community/callback',maxAge:0,httpOnly:true,secure:true,sameSite:'lax'});return r;};
  try {
    const c=communityConfig(), state=request.nextUrl.searchParams.get('state'), code=request.nextUrl.searchParams.get('code');
    if(!c || !state || !code || request.cookies.get('janeomi_community_state')?.value!==state) return finish('rejected');
    const p=verifyOAuthState<{purpose:string;workspaceId:string;userId:string;organization:string}>(state);
    const {userId}=await auth();
    if(p.purpose!=='community-read'||!userId||p.userId!==userId||p.organization!==c.organization||!(await canImportPilotPortfolio())) return finish('rejected');
    const membership=await getAuthenticatedWorkspaceRole(p.workspaceId);
    if(!membership||!['owner','admin'].includes(membership.role)) return finish('rejected');
    await requirePaidWorkspaceAccess(p.workspaceId);
    const response=await fetch('https://www.linkedin.com/oauth/v2/accessToken',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri}),signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
    if(!response.ok) return finish('rejected');
    const token=await response.json();
    if(typeof token.access_token!=='string'||!Number.isSafeInteger(token.expires_in)||token.expires_in<=0||token.expires_in>31536000) return finish('rejected');
    const scopes=typeof token.scope==='string'?token.scope.split(/\s+/):['rw_organization_admin'];
    if(!scopes.includes('rw_organization_admin')) return finish('rejected');
    const check=await readCommunityStatistics({enabled:true,version:c.version,organization:c.organization,token:token.access_token,scopes});
    if(check.status!=='ok') return finish('permission-check-failed');
    const values={workspaceId:p.workspaceId,connectedBy:userId,organization:c.organization,encryptedToken:encryptSecret(token.access_token),expiresAt:new Date(Date.now()+token.expires_in*1000),scopes,updatedAt:new Date()};
    await db.insert(communityConnections).values(values).onConflictDoUpdate({target:communityConnections.workspaceId,set:values});
    return finish('connected');
  }catch{return finish('rejected');}
}
