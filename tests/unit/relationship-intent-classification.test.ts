import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRelationshipInterest } from '../../src/lib/relationships/intent';

test('a high-priority public response is not a qualified sales opportunity', () => {
  const result = classifyRelationshipInterest({
    actionType: 'public_reply', recommendedChannel: 'public_reply',
  });
  assert.equal(result.relationshipStage, 'public_engagement');
  assert.equal(result.score, 25);
  assert.ok(result.score < 70);
});

test('a page follow or profile view creates a review or monitor relationship only', () => {
  assert.deepEqual(
    classifyRelationshipInterest({ actionType: 'monitor', recommendedChannel: 'monitor' }),
    { score: 5, relationshipStage: 'monitor' },
  );
  assert.deepEqual(
    classifyRelationshipInterest({ actionType: 'tracker_update', recommendedChannel: 'review_profile' }),
    { score: 10, relationshipStage: 'review_only' },
  );
});

test('draft outreach and suggested meetings alone are not proof of intent', () => {
  assert.deepEqual(
    classifyRelationshipInterest({ actionType: 'connection_note', recommendedChannel: 'connection_note' }),
    { score: 15, relationshipStage: 'new_signal' },
  );
  assert.deepEqual(
    classifyRelationshipInterest({ actionType: 'meeting_prep', recommendedChannel: 'meeting_prep' }),
    { score: 50, relationshipStage: 'warm_relationship' },
  );
});
