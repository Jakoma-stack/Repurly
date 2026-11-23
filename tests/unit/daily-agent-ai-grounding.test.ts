import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackBriefing, isAiBriefingGrounded } from '../../src/lib/ai/daily-agent';

const input = {
  brandName: 'Your organisation',
  rawNotifications: [
    'Alex Sample commented on my post about AI governance. They asked how organisations prove staff follow AI policies.',
    'Jordan Example followed my company page.',
    'Taylor Demo viewed my profile.',
  ].join('\n'),
  rawComments: [
    'Alex Sample: We have an AI policy, but how can we prove that staff are following it in practice?',
    'Jordan Example: Really useful framework, thanks.',
  ].join('\n'),
};

test('rejects a valid-looking but empty AI result when contacts are provided', async () => {
  const baseline = await fallbackBriefing(input);
  const empty = { ...baseline, summary: 'No new interactions or signals received today.', whoMatters: [], actions: [], replyQueue: [] };
  assert.equal(isAiBriefingGrounded(empty, input), false);
});

test('requires every named input contact to be represented once', async () => {
  const baseline = await fallbackBriefing(input);
  assert.equal(isAiBriefingGrounded(baseline, input), true);
  const missing = { ...baseline, whoMatters: baseline.whoMatters.filter(person => person.name !== 'Alex Sample') };
  assert.equal(isAiBriefingGrounded(missing, input), false);
  const duplicate = { ...baseline, whoMatters: [...baseline.whoMatters, baseline.whoMatters[0]] };
  assert.equal(isAiBriefingGrounded(duplicate, input), false);
});

test('blocks a high-priority follower and loss of actionable answer', async () => {
  const baseline = await fallbackBriefing(input);
  const inflated = { ...baseline, whoMatters: baseline.whoMatters.map(person => person.name === 'Jordan Example' ? {...person,priority: 'high' as const} : person) };
  assert.equal(isAiBriefingGrounded(inflated, input), false);
  const noReply = { ...baseline, replyQueue: [] };
  assert.equal(isAiBriefingGrounded(noReply, input), false);
});

test('allows zero-people analytics-only sessions to give content insight', async () => {
  const analyticsOnly = { brandName: 'Example', rawAnalytics: '300 impressions', rawNotes: 'Only analytics today' };
  const baseline = await fallbackBriefing(analyticsOnly);
  assert.equal(isAiBriefingGrounded(baseline, analyticsOnly), true);
});
