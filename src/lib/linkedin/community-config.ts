export function communityConfig(env: Record<string,string|undefined> = process.env) {
  if (env.COMMUNITY_LINKEDIN_ENABLED !== 'true' || env.RAILWAY_ENVIRONMENT_NAME !== 'staging') return null;
  const clientId=env.COMMUNITY_LINKEDIN_CLIENT_ID?.trim(), clientSecret=env.COMMUNITY_LINKEDIN_CLIENT_SECRET?.trim(), redirectUri=env.COMMUNITY_LINKEDIN_REDIRECT_URI?.trim(), organization=env.COMMUNITY_LINKEDIN_ORGANIZATION?.trim(), version=env.COMMUNITY_LINKEDIN_VERSION?.trim();
  if (!clientId || !clientSecret || !redirectUri || !organization || !version || !/^urn:li:organization:[0-9]+$/.test(organization) || !/^20[0-9]{2}(0[1-9]|1[0-2])$/.test(version)) return null;
  try { const u=new URL(redirectUri); if(u.protocol!=='https:' || u.pathname!=='/api/community/callback' || u.search || u.hash || u.username || u.password) return null; } catch { return null; }
  return {clientId,clientSecret,redirectUri,organization,version};
}
