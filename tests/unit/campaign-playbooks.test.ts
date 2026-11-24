import assert from 'node:assert/strict';
import test from 'node:test';

import { campaignPlaybooks, findPlaybook, findStarterDraftBody, reviewedJakomaTriagePost } from '../../src/lib/marketing/campaign-playbooks';
import { starterPortfolio } from '../../src/lib/marketing/portfolio-starters';

test('four playbooks match actual saved starter brands and offer three real draft keys each', () => {
  assert.equal(campaignPlaybooks.length, 4);
  assert.deepEqual(new Set(campaignPlaybooks.map(item => item.brandSlug)), new Set(starterPortfolio.map(item => item.slug)));

  for (const plan of campaignPlaybooks) {
    const starter = starterPortfolio.find(item => item.slug === plan.brandSlug);
    assert.ok(starter);
    assert.deepEqual(plan.weeks.map(item => item.week), [1, 2, 3, 4]);
    assert.equal(plan.weeks.filter(item => item.draftKey).length, 3);
    assert.equal(plan.weeks[3].draftKey, null);
    assert.ok(plan.weeks.every(item => item.reviewNote.length > 30));

    const keys = plan.weeks.slice(0, 3).map(item => item.draftKey);
    assert.equal(new Set(keys).size, 3);
    for (const key of keys) {
      assert.ok(key);
      assert.equal(typeof findStarterDraftBody(plan.brandSlug, key), 'string');
    }
  }
});

test('only Jakoma has a confirmed public enquiry route; unfinished apps never have an availability CTA', () => {
  const jakoma = findPlaybook('jakoma');
  assert.ok(jakoma);
  assert.equal(jakoma.publicOfferUrl, 'https://jakoma.org/ai-governance-triage.html');
  assert.equal(jakoma.holdProductLaunchClaims, false);

  for (const plan of campaignPlaybooks.filter(item => item.brandSlug !== 'jakoma')) {
    assert.equal(plan.holdProductLaunchClaims, true);
    assert.equal(plan.publicOfferUrl, null);
    assert.match(plan.guardrail, /not |do not|private|unavailable|launch/i);
  }
});

test('reviewed Jakoma copy uses the request-first route and cannot misrepresent instant booking', () => {
  assert.match(reviewedJakomaTriagePost, /https:\/\/jakoma\.org\/ai-governance-triage\.html/);
  assert.match(reviewedJakomaTriagePost, /request form/);
  assert.doesNotMatch(reviewedJakomaTriagePost, /book now|instant booking|guaranteed|proven results/i);
  assert.notEqual(reviewedJakomaTriagePost, findStarterDraftBody('jakoma', 'jakoma-triage-first'));
});
