import assert from 'node:assert/strict';
import test from 'node:test';
import { directorBrandEligibility, directorContext, directorContextHash, directorPlanSchema, directorPlanIsCurrent, rankDirectorBrands, savedDirectorPlan, type DirectorBrand } from '../../src/lib/marketing/director';
import { marketingDirectorInput } from '../../src/lib/ai/marketing-director';

const brand: DirectorBrand = {
  id: 'brand-1', name: 'Example Studio', slug: 'example', status: 'active',
  audience: 'Local independent businesses', defaultTone: 'Practical', primaryCta: 'Share feedback',
  secondaryCta: null, website: null, metadata: { marketingStage: 'private_build', privateContact: 'DO NOT SEND', opportunityDesk: { offer: 'Workflow review', relationshipRules: ['SECRET'] } },
};
const plan = {
  objective: 'Discover workflow needs', positioning: 'Practical advice', channel: 'LinkedIn',
  rationale: 'Test interest in useful workflows', evidenceToVerify: ['Check the offer is available'],
  weeks: Array.from({ length: 4 }, (_, i) => ({ theme: 'Theme ' + i, action: 'Review a proposed educational post', measure: 'Count genuine responses' })),
  firstDraft: { title: 'A useful workflow', body: 'What would make reviewing your workflow more straightforward? Share a general example.' },
  ownerAction: 'Review the first draft',
};
test('marketing inputs are brand-scoped and deliberately omit unrelated metadata', () => {
  const input = marketingDirectorInput(brand);
  assert.match(input.input, /Example Studio/);
  assert.match(input.input, /Workflow review/);
  assert.doesNotMatch(input.input, /DO NOT SEND|SECRET|privateContact|relationshipRules/);
  assert.match(input.instructions, /private_build/);
  assert.match(input.instructions, /No automatic scraping/);
  assert.equal(directorContext(brand).stage, 'private_build');
});
test('strict validation rejects wrong week counts, extra fields and oversized draft titles', () => {
  assert.ok(directorPlanSchema.safeParse(plan).success);
  assert.ok(!directorPlanSchema.safeParse({ ...plan, weeks: plan.weeks.slice(0, 2) }).success);
  assert.ok(!directorPlanSchema.safeParse({ ...plan, inventedRevenue: 999 }).success);
  assert.ok(!directorPlanSchema.safeParse({ ...plan, firstDraft: { ...plan.firstDraft, title: 'X'.repeat(161) } }).success);
});
test('plan freshness is tied to the approved brand fields, stage, status and age', () => {
  const saved = { id: '12345678-1234-4123-8123-123456789abc', generatedAt: new Date().toISOString(), contextHash: directorContextHash(brand), plan: directorPlanSchema.parse(plan) };
  const withPlan = { ...brand, metadata: { ...brand.metadata, marketingDirector: saved } };
  assert.deepEqual(savedDirectorPlan(withPlan), saved);
  assert.ok(directorPlanIsCurrent(withPlan, saved));
  assert.ok(!directorPlanIsCurrent({ ...withPlan, primaryCta: 'Buy today' }, saved));
  assert.ok(!directorPlanIsCurrent({ ...withPlan, metadata: { ...withPlan.metadata, marketingStage: 'public_launch' } }, saved));
  assert.ok(!directorPlanIsCurrent({ ...withPlan, status: 'archived' }, saved));
  assert.ok(!directorPlanIsCurrent(withPlan, { ...saved, generatedAt: new Date(Date.now() - 31 * 86400000).toISOString() }));
});
test('owner-specific priority and research restriction never leak into generic customer workspaces', () => {
  const research = { ...brand, slug: 'averyquant-one' };
  const repurly = { ...brand, slug: 'repurly', name: 'Repurly' };
  const live = { ...brand, slug: 'live', name: 'Live product', metadata: { marketingStage: 'public_launch' } };
  assert.match(directorBrandEligibility(research, true) ?? '', /Research only/);
  assert.equal(directorBrandEligibility(research, false), null);
  assert.equal(rankDirectorBrands([live, repurly], true)[0].slug, 'repurly');
  assert.equal(rankDirectorBrands([repurly, live], false)[0].slug, 'live');
  assert.ok(directorBrandEligibility({ ...brand, audience: null }, false));
});
