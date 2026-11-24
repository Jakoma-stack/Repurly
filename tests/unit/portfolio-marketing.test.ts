import assert from 'node:assert/strict';
import test from 'node:test';
import { getMarketingStage, getMarketingStageDetails, missingMarketingBasics } from '../../src/lib/marketing/portfolio';

test('unknown or missing marketing stage defaults to private build', () => {
  assert.equal(getMarketingStage(null), 'private_build');
  assert.equal(getMarketingStage({ marketingStage: 'available' }), 'private_build');
  assert.equal(getMarketingStage({ marketingStage: 'private_beta' }), 'private_beta');
  assert.match(getMarketingStageDetails('private_beta').guidance, /real beta access/);
});

test('portfolio marketing exposes missing configuration', () => {
  assert.deepEqual(missingMarketingBasics({ audience: 'SMEs' }), ['tone', 'call to action']);
  assert.deepEqual(missingMarketingBasics({ audience: 'Families', defaultTone: 'Helpful', primaryCta: 'Join waitlist' }), []);
});
