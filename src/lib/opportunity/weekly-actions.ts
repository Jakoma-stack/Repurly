/**
 * Prioritise reviewable outstanding actions. Daily Agent sessions are
 * historical evidence, not a backlog: generated items may have already been
 * completed, superseded, logged or ignored.
 */
export type WeeklyActionCandidate = {
  id: string;
  actionType: string;
  personName: string | null;
  recommendedChannel: string;
  priority: string;
  status: string;
  draftText: string | null;
  linkedLeadId?: string | null;
  createdAt: Date;
};

const completedStatuses = new Set(['logged', 'sent_manually', 'ignored']);
const weakChannels = new Set(['monitor', 'no_dm_yet', 'review_profile']);
const manuallyReviewedStatuses = new Set(['approved', 'copied']);

export function selectWeeklyNextActions<T extends WeeklyActionCandidate>(
  actions: readonly T[],
  knownRelationships: readonly string[] = [],
  limit = 5,
): T[] {
  const tracked = new Set(knownRelationships.map(name => name.trim().toLocaleLowerCase()));
  const pending = actions.filter(action => {
    if (completedStatuses.has(action.status)) return false;
    const name = action.personName?.trim().toLocaleLowerCase();
    if (!name || name === 'linkedin contact') return false;
    if (weakChannels.has(action.recommendedChannel)) return false;
    if (['content', 'monitor', 'ignore'].includes(action.actionType)) return false;

    if (action.actionType === 'public_reply') {
      return action.recommendedChannel === 'public_reply' &&
        Boolean(action.draftText?.trim() && action.draftText.trim().length >= 35);
    }

    if (action.actionType === 'tracker_update') {
      // Once a relationship is logged, don't keep suggesting the same update.
      return action.priority !== 'low' &&
        !action.linkedLeadId &&
        !tracked.has(name);
    }

    // Draft outreach and proposed meetings are not verified obligations.
    // Put them into a weekly plan only after explicit human review.
    if (['follow_up', 'meeting_prep', 'connection_note', 'dm_draft'].includes(action.actionType)) {
      return manuallyReviewedStatuses.has(action.status);
    }
    return false;
  });

  const kindScore = (action: T) => {
    if (action.actionType === 'public_reply') return 90;
    if (action.actionType === 'follow_up') return 65;
    if (action.actionType === 'meeting_prep') return 55;
    if (action.actionType === 'tracker_update') return 40;
    return 20;
  };
  const priorityScore = (action: T) => action.priority === 'high' ? 25 : action.priority === 'medium' ? 12 : 0;
  const statusScore = (action: T) => action.status === 'approved' ? 35 :
    action.status === 'copied' ? 25 : action.status === 'needs_edit' ? -15 : 0;

  const ordered = pending.slice().sort((a,b) =>
    (kindScore(b) + priorityScore(b) + statusScore(b)) -
    (kindScore(a) + priorityScore(a) + statusScore(a)) ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
  const seen = new Set<string>();
  const selected: T[] = [];
  for (const action of ordered) {
    const identity = `${action.personName!.trim().toLocaleLowerCase()}::${action.actionType}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    selected.push(action);
    if (selected.length >= Math.max(0, limit)) break;
  }
  return selected;
}
