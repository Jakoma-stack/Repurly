import assert from 'node:assert/strict';
import test from 'node:test';
import { selectWeeklyNextActions, type WeeklyActionCandidate } from '../../src/lib/opportunity/weekly-actions';

function action(id: string, changes: Partial<WeeklyActionCandidate> = {}): WeeklyActionCandidate {
  return {
    id, actionType: 'public_reply', personName: 'Alex Sample',
    recommendedChannel: 'public_reply', priority: 'high', status: 'draft',
    draftText: 'Thanks for this question. Here are concrete audit records and approval checks that demonstrate the policy in practice.',
    createdAt: new Date('2026-11-23T17:00:00.000Z'),
    linkedLeadId: null, ...changes,
  };
}

test('finished work, monitoring and generic content never appear as outstanding actions', () => {
  const result = selectWeeklyNextActions([
    action('logged', { status: 'logged' }),
    action('sent', { status: 'sent_manually' }),
    action('ignored', { status: 'ignored' }),
    action('monitor', { actionType: 'monitor', personName: 'Taylor Demo', recommendedChannel: 'monitor' }),
    action('content', { actionType: 'content', personName: 'LinkedIn contact', recommendedChannel: 'content' }),
    action('real', { personName: 'Another Person' }),
  ]);
  assert.deepEqual(result.map(x => x.id), ['real']);
});

test('a genuine public reply is ahead of unlogged tracker notes; logged relationships do not need another update', () => {
  const result = selectWeeklyNextActions([
    action('tracker', { actionType: 'tracker_update', personName: 'Alex Sample', recommendedChannel: 'tracker_update' }),
    action('reply', { personName: 'Alex Sample' }),
    action('other-tracker', { actionType: 'tracker_update', personName: 'New Person', recommendedChannel: 'tracker_update' }),
  ], ['Alex Sample']);
  assert.deepEqual(result.map(x => x.id), ['reply', 'other-tracker']);
});

test('the newest of multiple uncompleted replies for one person is selected', () => {
  const result = selectWeeklyNextActions([
    action('old', { createdAt: new Date('2026-11-21T12:00:00Z') }),
    action('new', { createdAt: new Date('2026-11-23T12:00:00Z') }),
    action('other', { personName: 'Another Person', priority: 'medium' }),
  ], [], 2);
  assert.deepEqual(result.map(x => x.id), ['new', 'other']);
});

test('unapproved or weak-signal outreach is not promoted to weekly recommendations', () => {
  const result = selectWeeklyNextActions([
    action('jordan', { personName: 'Jordan Example', actionType: 'connection_note', recommendedChannel: 'connection_note', priority: 'medium' }),
    action('dm', { personName: 'Unverified Person', actionType: 'dm_draft', recommendedChannel: 'dm', priority: 'high' }),
    action('follow', { personName: 'Existing Contact', actionType: 'follow_up', recommendedChannel: 'dm', status: 'approved' }),
  ]);
  assert.deepEqual(result.map(x => x.id), ['follow']);
});

test('historical AI contacts must match their actual session inputs', () => {
  const evidence = new Map([
    ['old-session', new Map([
      ['alex sample', { name: 'Alex Sample', priority: 'high' as const, recommendedChannel: 'public_reply' }],
      ['jordan example', { name: 'Jordan Example', priority: 'low' as const, recommendedChannel: 'review_profile' }],
    ])],
  ]);
  const result = selectWeeklyNextActions([
    action('alex', { sessionId: 'old-session' }),
    action('false-jordan', { sessionId: 'old-session', personName: 'Jordan Example', priority: 'high' }),
    action('fragment', { sessionId: 'old-session', personName: 'Alex Sample commented on my post about AI governance. They', priority: 'medium' }),
    action('invented', { sessionId: 'missing-session', personName: 'Unknown Person' }),
  ], [], 5, { sessionEvidence: evidence });
  assert.deepEqual(result.map(x => x.id), ['alex']);
});

test('logging a reply closes previous proposals for that person across all sessions', () => {
  const evidence = new Map([
    ['one', new Map([['alex sample', { name: 'Alex Sample', priority: 'high' as const, recommendedChannel: 'public_reply' }]])],
    ['two', new Map([['alex sample', { name: 'Alex Sample', priority: 'high' as const, recommendedChannel: 'public_reply' }]])],
    ['three', new Map([['alex sample', { name: 'Alex Sample', priority: 'high' as const, recommendedChannel: 'public_reply' }]])],
  ]);
  const result = selectWeeklyNextActions([
    action('old-one', { sessionId: 'one', createdAt: new Date('2026-11-23T19:00:00Z') }),
    action('old-two', { sessionId: 'two', createdAt: new Date('2026-11-23T20:00:00Z') }),
    action('logged', { sessionId: 'two', status: 'logged', updatedAt: new Date('2026-11-23T21:00:00Z') }),
    action('new-conversation', { sessionId: 'three', createdAt: new Date('2026-11-23T22:00:00Z') }),
  ], ['Alex Sample'], 5, { sessionEvidence: evidence });
  assert.deepEqual(result.map(x => x.id), ['new-conversation']);
});

test('brand-specific completed work does not hide a genuinely new action', () => {
  const signal = { name: 'Alex Sample', priority: 'high' as const, recommendedChannel: 'public_reply' };
  const evidence = new Map([
    ['original', new Map([['alex sample', signal]])],
    ['new-jakoma', new Map([['alex sample', signal]])],
    ['new-edusmart', new Map([['alex sample', signal]])],
  ]);
  const result = selectWeeklyNextActions([
    action('old', { brandId: 'jakoma', sessionId: 'original', createdAt: new Date('2026-11-23T19:00:00Z') }),
    action('logged', { brandId: 'jakoma', sessionId: 'original', status: 'logged',
      createdAt: new Date('2026-11-23T19:00:00Z'), updatedAt: new Date('2026-11-23T20:00:00Z') }),
    action('fresh-jakoma', { brandId: 'jakoma', sessionId: 'new-jakoma', createdAt: new Date('2026-11-23T22:00:00Z') }),
    action('fresh-edusmart', { brandId: 'edusmart', sessionId: 'new-edusmart', createdAt: new Date('2026-11-23T21:00:00Z') }),
  ], [{ name: 'Alex Sample', brandId: 'jakoma' }], 5, { sessionEvidence: evidence });
  assert.deepEqual(result.map(x => x.id), ['fresh-jakoma', 'fresh-edusmart']);
});

test('tracked relationships do not suppress another brand\'s tracker updates', () => {
  const result = selectWeeklyNextActions([
    action('jakoma', { brandId: 'jakoma', actionType: 'tracker_update', recommendedChannel: 'tracker_update' }),
    action('edusmart', { brandId: 'edusmart', actionType: 'tracker_update', recommendedChannel: 'tracker_update' }),
  ], [{ name: 'Alex Sample', brandId: 'jakoma' }]);
  assert.deepEqual(result.map(x => x.id), ['edusmart']);
});

test('one strong action per person is selected even across different action types', () => {
  const evidence = new Map([
    ['one', new Map([['alex sample', { name: 'Alex Sample', priority: 'high' as const, recommendedChannel: 'public_reply' }]])],
  ]);
  const result = selectWeeklyNextActions([
    action('tracker', { sessionId: 'one', actionType: 'tracker_update', recommendedChannel: 'tracker_update' }),
    action('reply', { sessionId: 'one' }),
  ], [], 5, { sessionEvidence: evidence });
  assert.deepEqual(result.map(x => x.id), ['reply']);
});
