import assert from 'node:assert/strict';
import test from 'node:test';
import {readCommunityStatistics, type CommunityReadConfig} from '../../src/lib/linkedin/community-read';
const config: CommunityReadConfig = {enabled:true,version:'202609',organization:'urn:li:organization:123',token:'synthetic-token',scopes:['rw_organization_admin']};
test('disabled, wrong scope and malformed organization never make requests',async()=>{
 let calls=0;const transport: typeof fetch=async()=>{calls++;return new Response()};
 assert.equal((await readCommunityStatistics({...config,enabled:false},transport)).status,'disabled');
 assert.equal((await readCommunityStatistics({...config,scopes:[]},transport)).status,'permission-denied');
 assert.equal((await readCommunityStatistics({...config,organization:'urn:li:person:123'},transport)).status,'invalid-config');
 assert.equal(calls,0);
});
test('only aggregate organization statistics are returned',async()=>{
 const transport: typeof fetch=async(input,init)=>{
 const url=new URL(String(input));assert.equal(url.hostname,'api.linkedin.com');assert.equal(url.searchParams.get('organizationalEntity'),config.organization);assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');
 return Response.json({elements:[{organizationalEntity:config.organization,totalShareStatistics:{impressionCount:100,likeCount:-1,commentCount:3,shareCount:2,clickCount:4,engagement:0.08},memberData:'discard me'}]});
 };
 const result=await readCommunityStatistics(config,transport);assert.deepEqual(result,{status:'ok',metrics:{impressions:100,likes:-1,comments:3,shares:2,clicks:4,engagement:0.08}});
});
test('permission, quota and malformed results fail closed',async()=>{
 for(const [code,status] of [[401,'permission-denied'],[403,'permission-denied'],[429,'rate-limited'],[500,'unavailable']] as const) assert.equal((await readCommunityStatistics(config,async()=>new Response(null,{status:code}))).status,status);
 assert.equal((await readCommunityStatistics(config,async()=>Response.json({elements:[{organizationalEntity:'urn:li:organization:999'}]}))).status,'invalid-response');
 assert.equal((await readCommunityStatistics(config,async()=>{throw Error('network')})).status,'unavailable');
});
