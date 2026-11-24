/** Read-only aggregate statistics adapter. No member data, storage or AI transfer. */
export type CommunityReadConfig = { enabled: boolean; version: string; organization: string; token: string; scopes: readonly string[] };
export type CommunityReadResult = { status: 'disabled' | 'invalid-config' | 'permission-denied' | 'rate-limited' | 'unavailable' | 'invalid-response' } | {status:'ok'; metrics: {impressions:number; likes:number; comments:number; shares:number; clicks:number; engagement:number | null}};
export async function readCommunityStatistics(config: CommunityReadConfig, transport: typeof fetch = fetch): Promise<CommunityReadResult> {
  if (!config.enabled) return {status:'disabled'};
  if (!/^urn:li:organization:[0-9]+$/.test(config.organization) || !/^20[0-9]{2}(0[1-9]|1[0-2])$/.test(config.version) || !config.token.trim()) return {status:'invalid-config'};
  if (!config.scopes.includes('rw_organization_admin')) return {status:'permission-denied'};
  const url = new URL('https://api.linkedin.com/rest/organizationalEntityShareStatistics');
  url.searchParams.set('q','organizationalEntity');
  url.searchParams.set('organizationalEntity',config.organization);
  try {
    const response = await transport(url.toString(), {method:'GET',headers:{Authorization:'Bearer '+config.token,'LinkedIn-Version':config.version,'X-Restli-Protocol-Version':'2.0.0'},signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
    if (response.status === 401 || response.status === 403) return {status:'permission-denied'};
    if (response.status === 429) return {status:'rate-limited'};
    if (!response.ok) return {status:'unavailable'};
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('elements' in body) || !Array.isArray(body.elements) || body.elements.length !== 1) return {status:'invalid-response'};
    const row = body.elements[0];
    if (!row || row.organizationalEntity !== config.organization || row.share || row.ugcPost || row.timeRange) return {status:'invalid-response'};
    const m = row.totalShareStatistics;
    if (!m || !['impressionCount','likeCount','commentCount','shareCount','clickCount'].every(k=>Number.isSafeInteger(m[k]) && (k==='likeCount' || m[k]>=0))) return {status:'invalid-response'};
    return {status:'ok',metrics:{impressions:m.impressionCount,likes:m.likeCount,comments:m.commentCount,shares:m.shareCount,clicks:m.clickCount,engagement:typeof m.engagement==='number' && Number.isFinite(m.engagement) && m.engagement>=0 ? m.engagement : null}};
  } catch { return {status:'unavailable'}; }
}
