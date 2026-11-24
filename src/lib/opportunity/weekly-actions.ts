/**
 * Prioritise reviewable outstanding actions. Daily Agent sessions are
 * historical evidence, not a backlog: generated items may have already been
 * completed, superseded, logged or ignored.
 */
export type WeeklyActionCandidate = {
  id: string;
  sessionId?: string;
  brandId?: string | null;
  actionType: string;
  personName: string | null;
  recommendedChannel: string;
  priority: string;
  status: string;
  draftText: string | null;
  linkedLeadId?: string | null;
  createdAt: Date;
  updatedAt?: Date;
};

export type WeeklySourceSignal = {
  name: string;
  priority: 'high' | 'medium' | 'low';
  recommendedChannel: string;
};

export type WeeklyTrackedRelationship = string | { name: string; brandId?: string | null };

export type WeeklyActionContext = {
  /** Conservative, deterministic per-session evidence from original pasted data. */
  sessionEvidence: ReadonlyMap<string, ReadonlyMap<string, WeeklySourceSignal>>;
};

function normalisePerson(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function scopedPersonKey(name: string, brandId?: string | null) {
  return String(brandId ?? '__unassigned__') + ':' + normalisePerson(name);
}

const completedStatuses = new Set(['logged', 'sent_manually', 'ignored']);
const weakChannels = new Set(['monitor', 'no_dm_yet', 'review_profile']);
const manuallyReviewedStatuses = new Set(['approved', 'copied']);

export function selectWeeklyNextActions<T extends WeeklyActionCandidate>(
  actions: readonly T[],
  knownRelationships: readonly WeeklyTrackedRelationship[] = [],
  limit = 5,
  context?: WeeklyActionContext,
): T[] {
  const trackedUnscoped = new Set<string>();
  const trackedByBrand = new Set<string>();
  for (const relationship of knownRelationships) {
    if (typeof relationship === 'string') trackedUnscoped.add(normalisePerson(relationship));
    else trackedByBrand.add(scopedPersonKey(relationship.name, relationship.brandId));
  }

  // A logged or manually sent action closes prior suggestions for that person.
  // Future sessions with genuinely new source activity may create new work.
  const completedAt = new Map<string, number>();
  for (const action of actions) {
    if (!['logged', 'sent_manually'].includes(action.status) || !action.personName) continue;
    const key = scopedPersonKey(action.personName, action.brandId);
    completedAt.set(key, Math.max(completedAt.get(key) ?? 0,
      (action.updatedAt ?? action.createdAt).getTime()));
  }

  const pending = actions.filter(action => {
    if (completedStatuses.has(action.status)) return false;
    const name = action.personName ? normalisePerson(action.personName) : '';
    if (!name || name === 'linkedin contact') return false;
    if (action.createdAt.getTime() <= (completedAt.get(scopedPersonKey(name, action.brandId)) ?? 0)) return false;

    if (context) {
      // Old AI output was sometimes hallucinated, duplicate or too aggressive.
      // Match the original named input in the same session rather than blindly
      // promoting the persisted model label.
      const evidence = action.sessionId
        ? context.sessionEvidence.get(action.sessionId)?.get(name)
        : undefined;
      if (!evidence || evidence.priority === 'low') return false;
      if (action.priority === 'high' && evidence.priority !== 'high') return false;
      if (action.actionType === 'public_reply' &&
          evidence.recommendedChannel !== 'public_reply') return false;
    }
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
        !trackedUnscoped.has(name) &&
        !trackedByBrand.has(scopedPersonKey(name, action.brandId));
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
    // One sensible next action per person and brand, even across repeated sessions.
    const identity = scopedPersonKey(action.personName!, action.brandId);
    if (seen.has(identity)) continue;
    seen.add(identity);
    selected.push(action);
    if (selected.length >= Math.max(0, limit)) break;
  }
  return selected;
}
