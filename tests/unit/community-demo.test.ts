import assert from 'node:assert/strict';
import test from 'node:test';
import { fictionalCommunityMetrics, summariseCommunityMetrics, communityReviewSuggestions } from '../../src/lib/linkedin/community-demo';
test('fictional metrics are aggregated and zero denominators excluded', () => {
  const summary = summariseCommunityMetrics(fictionalCommunityMetrics);
  assert.equal(summary.impressions, 2000);
  assert.equal(summary.comments, 12);
  assert.equal(summary.interactionRate, 3);
  assert.equal(summary.ranked.length, 2);
  assert.equal(summary.ranked[0].id, 'fictional-1');
  assert.equal(summariseCommunityMetrics([]).interactionRate, null);
});
test('invalid counts are excluded and suggestions do not infer sales intent', () => {
  assert.equal(summariseCommunityMetrics([{id:'bad',topic:'bad',impressions:-1,reactions:0,comments:0}]).excluded, 1);
  assert.match(communityReviewSuggestions(fictionalCommunityMetrics).join(' '), /do not infer causation or buying intent/);
});
