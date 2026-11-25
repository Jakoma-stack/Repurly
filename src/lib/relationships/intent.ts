/**
 * Daily reply urgency and commercial buying intent are separate concepts.
 * A practical question can deserve an immediate public reply without being
 * evidence that its author wishes to purchase anything.
 */
export type RelationshipSignal = {
  actionType: string;
  recommendedChannel?: string | null;
};

export function classifyRelationshipInterest(signal: RelationshipSignal) {
  const action = signal.actionType.trim().toLowerCase();
  const channel = signal.recommendedChannel?.trim().toLowerCase() ?? '';

  if (action === 'ignore' || channel === 'monitor' || channel === 'no_dm_yet' ||
      action === 'monitor') return { score: 5, relationshipStage: 'monitor' };
  if (channel === 'review_profile') return { score: 10, relationshipStage: 'review_only' };
  if (action === 'public_reply' || channel === 'public_reply') {
    return { score: 25, relationshipStage: 'public_engagement' };
  }
  if (action === 'meeting_prep' || channel === 'meeting_prep') {
    // A suggested meeting alone is not a booked meeting or a sale.
    return { score: 50, relationshipStage: 'warm_relationship' };
  }
  if (action === 'connection_note' || action === 'dm_draft' ||
      channel === 'connection_note' || channel === 'dm') {
    // Draft outreach has not yet been sent or reciprocated.
    return { score: 15, relationshipStage: 'new_signal' };
  }
  return { score: 10, relationshipStage: 'new_signal' };
}
