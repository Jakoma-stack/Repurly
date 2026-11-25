import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackBriefing } from '../../src/lib/ai/daily-agent';

test('fallback prioritises a substantive question, not polite praise', async () => {
  const briefing = await fallbackBriefing({
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
    rawNotes: 'This is a fictional test: do not message profile viewers.',
  });
  assert.equal(briefing.generationMode, 'fallback');
  const people = briefing.whoMatters;
  assert.equal(people.filter((person) => person.name === 'Alex Sample').length, 1);
  assert.equal(people.filter((person) => person.name === 'Jordan Example').length, 1);
  assert.equal(people.filter((person) => person.name === 'Taylor Demo').length, 1);
  assert.equal(people[0].name, 'Alex Sample');
  assert.equal(people[0].priority, 'high');
  assert.equal(people.find((person) => person.name === 'Jordan Example')?.priority, 'low');
  assert.equal(people.find((person) => person.name === 'Taylor Demo')?.priority, 'low');
  assert.equal(people.some((person) => person.name === 'LinkedIn contact'), false);
  const alexReply = briefing.replyQueue.find((item) => item.personName === 'Alex Sample');
  assert.ok(alexReply);
  assert.match(alexReply.draftReply, /records|evidence/i);
  assert.match(alexReply.draftReply, /policy/i);
  assert.equal(briefing.replyQueue.some((item) => item.personName === 'Jordan Example'), false);
});
