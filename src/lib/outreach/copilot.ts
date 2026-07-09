export type OutreachChannel = 'linkedin' | 'facebook' | 'email' | 'website' | 'phone' | 'manual';
export type OutreachOffer =
  | 'AI/Data Governance Triage'
  | 'AI Governance & Readiness Sprint'
  | 'Repurly LinkedIn Ops Pilot'
  | 'Home / Property Technology Review'
  | 'Referral Partner'
  | 'General';

export type OutreachDecision = 'send_now' | 'warm_up_first' | 'save_for_later' | 'skip';

export type OutreachDrafts = {
  connectionNote: string;
  firstMessage: string;
  publicComment: string;
  followUp: string;
  referralAsk: string;
};

export type OutreachMetadata = {
  copilotVersion: 'manual-v1';
  source?: string;
  sourceUrl?: string;
  channel?: OutreachChannel;
  offerFit?: OutreachOffer | string;
  relationship?: string;
  roleOrBusinessType?: string;
  sector?: string;
  whyRelevant?: string;
  nextActionDate?: string;
  scoreBreakdown?: string[];
  decision?: OutreachDecision;
  actionType?: string;
  messageDrafts?: OutreachDrafts;
  lastOutcome?: string;
  guardrailNote?: string;
};

const decisionMakerTerms = [
  'founder', 'owner', 'director', 'ceo', 'coo', 'cto', 'head', 'lead', 'manager', 'partner', 'principal', 'consultant', 'agency', 'trustee', 'board',
];

const relevantSectorTerms = [
  'sme', 'small business', 'charity', 'nonprofit', 'care', 'housing', 'supported living', 'property', 'landlord', 'letting', 'estate agent', 'maintenance', 'repairs', 'cctv', 'security', 'digital', 'transformation', 'data', 'governance', 'risk', 'compliance', 'consulting', 'agency',
];

function includesAny(value: string | undefined, terms: string[]) {
  const haystack = (value ?? '').toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function titleCaseDecision(decision: OutreachDecision) {
  switch (decision) {
    case 'send_now': return 'Send now';
    case 'warm_up_first': return 'Warm up first';
    case 'save_for_later': return 'Save for later';
    case 'skip': return 'Skip';
  }
}

export function scoreOutreachProspect(input: {
  relationship?: string;
  roleOrBusinessType?: string;
  sector?: string;
  whyRelevant?: string;
  channel?: string;
  source?: string;
}) {
  let score = 15;
  const breakdown: string[] = ['Base manual prospect score +15'];
  const relationship = (input.relationship ?? '').toLowerCase();
  const role = input.roleOrBusinessType ?? '';
  const sector = input.sector ?? '';
  const whyRelevant = input.whyRelevant ?? '';
  const channel = (input.channel ?? '').toLowerCase();
  const source = (input.source ?? '').toLowerCase();

  if (relationship.includes('warm') || relationship.includes('existing') || relationship.includes('knows')) {
    score += 30;
    breakdown.push('Warm/existing relationship +30');
  }
  if (relationship.includes('comment') || relationship.includes('replied') || relationship.includes('asked')) {
    score += 30;
    breakdown.push('Visible engagement or question +30');
  }
  if (relationship.includes('mutual') || relationship.includes('referral')) {
    score += 20;
    breakdown.push('Mutual connection or referral route +20');
  }
  if (relationship.includes('cold') || relationship.includes('unknown')) {
    score -= 15;
    breakdown.push('Cold/unknown contact -15');
  }
  if (includesAny(role, decisionMakerTerms)) {
    score += 20;
    breakdown.push('Decision-maker or referrer role +20');
  }
  if (includesAny(`${sector} ${whyRelevant}`, relevantSectorTerms)) {
    score += 20;
    breakdown.push('Relevant sector/problem language +20');
  }
  if (channel === 'linkedin' || source.includes('linkedin')) {
    score += 5;
    breakdown.push('LinkedIn route +5');
  }
  if (channel === 'facebook' || source.includes('facebook')) {
    score += 5;
    breakdown.push('Facebook/local route +5');
  }
  if (!whyRelevant.trim()) {
    score -= 10;
    breakdown.push('No relevance note yet -10');
  }

  const cappedScore = Math.max(0, Math.min(100, score));
  let decision: OutreachDecision = 'skip';
  if (cappedScore >= 70) decision = 'send_now';
  else if (cappedScore >= 45) decision = 'warm_up_first';
  else if (cappedScore >= 25) decision = 'save_for_later';

  return {
    score: cappedScore,
    decision,
    decisionLabel: titleCaseDecision(decision),
    breakdown,
  };
}

function chooseOffer(offerFit?: string) {
  const offer = offerFit || 'General';
  if (offer.includes('Home') || offer.includes('Property')) return 'home_property';
  if (offer.includes('Repurly')) return 'repurly';
  if (offer.includes('Referral')) return 'referral';
  if (offer.includes('AI') || offer.includes('Governance') || offer.includes('Data')) return 'ai_governance';
  return 'general';
}

function cleanName(name?: string) {
  return name?.trim() || '[Name]';
}

function relevanceLine(whyRelevant?: string) {
  const trimmed = whyRelevant?.trim();
  return trimmed ? `I noticed ${trimmed}.` : 'I noticed your work and thought it looked relevant.';
}

export function buildOutreachDrafts(input: {
  leadName?: string;
  offerFit?: string;
  channel?: string;
  whyRelevant?: string;
  roleOrBusinessType?: string;
}): OutreachDrafts {
  const name = cleanName(input.leadName);
  const fit = chooseOffer(input.offerFit);
  const relevant = relevanceLine(input.whyRelevant);

  if (fit === 'home_property') {
    return {
      connectionNote: `Hi ${name}, ${relevant} I run Jakoma Home & Property Tech and thought it would be useful to connect.`,
      firstMessage: `Hi ${name}, ${relevant}\n\nI run Jakoma Home & Property Tech and I am opening a few practical home/property technology review slots - things like Wi-Fi reach, smart lighting, cameras, doorbells, alarms and making property tech simpler to use.\n\nThis is not medical or care advice and I am not a trades service. It is a practical review of what is already there, what is awkward, and what sensible next steps would help.\n\nDo you ever come across people who need that kind of help?`,
      publicComment: 'Looks really useful - property upgrades often work best when practical things like lighting, access, Wi-Fi, cameras and usability are thought through properly too.',
      followUp: `Hi ${name}, just checking back on my note about practical home/property technology reviews. Is this something you ever see customers, landlords or families asking about?`,
      referralAsk: `Hi ${name}, quick ask. I am opening a few practical home/property technology review slots locally - Wi-Fi reach, cameras, doorbells, alarms, smart lighting and making property tech easier to use. Who should I speak to?`,
    };
  }

  if (fit === 'repurly') {
    return {
      connectionNote: `Hi ${name}, ${relevant} I help B2B teams make LinkedIn content, approval and follow-up workflow more reliable. Thought it would be useful to connect.`,
      firstMessage: `Hi ${name}, ${relevant}\n\nI am opening a small number of Repurly Managed LinkedIn Ops Pilot places for B2B teams or agencies that need a more reliable draft-to-approval-to-schedule workflow.\n\nIt is LinkedIn-first rather than a broad social suite, and it includes a human-approved outreach/follow-up queue rather than scraping or auto-DMs.\n\nWould seeing the pilot outline be useful?`,
      publicComment: 'Useful point - the hidden work is often not just content creation, but approval rhythm, scheduling confidence and knowing which comments or leads need a human follow-up.',
      followUp: `Hi ${name}, quick follow-up on the Repurly LinkedIn Ops Pilot. Is LinkedIn content workflow or approval/follow-up discipline something worth looking at, or not a priority right now?`,
      referralAsk: `Hi ${name}, quick ask. I am opening a few Repurly LinkedIn Ops Pilot places for B2B teams or agencies that need cleaner content approval, scheduling and human-approved follow-up workflow. Who should I speak to?`,
    };
  }

  if (fit === 'referral') {
    return {
      connectionNote: `Hi ${name}, ${relevant} I work around practical tech, governance and workflow problems and thought it would be useful to connect.`,
      firstMessage: `Hi ${name}, ${relevant}\n\nI am looking for sensible referral partners rather than trying to pitch everyone cold. My current offers are practical AI/data governance triage for organisations and home/property technology reviews for local property or support contexts.\n\nDo you ever come across people who need either kind of help?`,
      publicComment: 'This looks like the sort of practical work where trusted referral partners make a real difference.',
      followUp: `Hi ${name}, just checking whether you ever come across people who need practical AI/data governance help or home/property technology reviews. Happy to keep it low-pressure.`,
      referralAsk: `Hi ${name}, quick ask. I am opening a few slots for practical AI/data governance triage and home/property technology reviews. Who should I speak to?`,
    };
  }

  return {
    connectionNote: `Hi ${name}, ${relevant} I help organisations turn AI, data and transformation activity into clearer governance, ownership and delivery rhythm. Thought it would be useful to connect.`,
    firstMessage: `Hi ${name}, ${relevant}\n\nI am opening a few practical AI/data governance triage slots for organisations that are using, testing or discussing AI/data work but do not yet have clear ownership, risk controls or delivery rhythm.\n\nThe first step is small: a paid triage that gives a clear view of risks, owners and next actions before anyone commits to a bigger sprint.\n\nWould a short conversation be useful?`,
    publicComment: 'This is where it helps to separate the tool from the governance around it - who owns the decision, what data is involved, what risk needs checking, and what outcome the organisation actually wants.',
    followUp: `Hi ${name}, just checking whether AI/data governance or delivery confidence is something worth looking at this month. The small first step is a paid triage, not a big project. Worth a 20-minute conversation?`,
    referralAsk: `Hi ${name}, quick ask. I am opening a few slots for practical AI/data governance triage - mainly for organisations where AI, data or transformation work is moving but ownership and controls are not yet clear. Who should I speak to?`,
  };
}

export function defaultNextActionForDecision(decision: OutreachDecision, channel?: string) {
  if (decision === 'send_now') {
    if (channel === 'facebook') return 'Leave a helpful comment or use the public contact route; do not cold-DM if there is no permission.';
    if (channel === 'linkedin') return 'Send human-approved connection note or message manually.';
    return 'Send the human-approved message manually using the available contact route.';
  }
  if (decision === 'warm_up_first') return 'Warm up first: follow, comment helpfully, or wait for a relevant post before messaging.';
  if (decision === 'save_for_later') return 'Save for later and review again during the next prospecting block.';
  return 'Skip for now. Do not spend more time on this contact.';
}

export function outreachGuardrailNote() {
  return 'Human-approved only: no scraping, no auto-DMs, no fake engagement, no bulk sending. Repurly prepares and tracks actions; a person decides and sends.';
}
