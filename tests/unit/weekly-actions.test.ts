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
