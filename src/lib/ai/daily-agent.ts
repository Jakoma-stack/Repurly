export type DailyAgentPriority = 'high' | 'medium' | 'low';
export type DailyAgentActionType =
  | 'public_reply'
  | 'dm_draft'
  | 'connection_note'
  | 'tracker_update'
  | 'follow_up'
  | 'review_profile'
  | 'monitor'
  | 'no_dm_yet'
  | 'meeting_prep'
  | 'ignore'
  | 'content_idea';
export type DailyAgentRecommendedChannel =
  | 'public_reply'
  | 'dm'
  | 'connection_note'
  | 'review_profile'
  | 'monitor'
  | 'no_dm_yet'
  | 'meeting_prep'
  | 'tracker_update'
  | 'content';

export type DailyAgentPerson = {
  name: string;
  handle?: string;
  priority: DailyAgentPriority;
  reason: string;
  suggestedAction: string;
  recommendedChannel: DailyAgentRecommendedChannel;
};

export type DailyAgentAction = {
  actionType: DailyAgentActionType;
  personName?: string;
  personHandle?: string;
  priority: DailyAgentPriority;
  source: string;
  reason: string;
  recommendedChannel: DailyAgentRecommendedChannel;
  draftText?: string;
  metadata?: Record<string, unknown>;
};

export type DailyAgentBriefing = {
  generationMode: 'openai' | 'fallback';
  summary: string;
  whatChanged: string[];
  whoMatters: DailyAgentPerson[];
  replyQueue: Array<{
    personName: string;
    sourceText: string;
    intent: 'hot' | 'warm' | 'nurture' | 'spam';
    draftReply: string;
    draftDm?: string;
    priority: DailyAgentPriority;
    reason: string;
    recommendedChannel: DailyAgentRecommendedChannel;
  }>;
  ignoreList: Array<{ item: string; reason: string }>;
  trackerUpdates: Array<{
    personName: string;
    updateType: 'create_lead' | 'update_lead' | 'add_note' | 'set_follow_up';
    reason: string;
    nextAction?: string;
    priority: DailyAgentPriority;
    recommendedChannel: DailyAgentRecommendedChannel;
  }>;
  followUps: Array<{ personName: string; action: string; draft?: string; priority: DailyAgentPriority; recommendedChannel: DailyAgentRecommendedChannel }>;
  analyticsReview: {
    interpretation: string;
    signals: string[];
    reuseIdeas: string[];
  };
  tomorrowContentIdea: {
    hook: string;
    angle: string;
    draftPost: string;
    cta: string;
  };
  actions: DailyAgentAction[];
};

export type GenerateDailyAgentBriefingArgs = {
  brandName: string;
  brandTone?: string | null;
  audience?: string | null;
  primaryCta?: string | null;
  secondaryCta?: string | null;
  brandMetadata?: Record<string, unknown> | null;
  rawNotifications?: string | null;
  rawComments?: string | null;
  rawAnalytics?: string | null;
  rawProfiles?: string | null;
  rawNotes?: string | null;
};

type Signal = {
  name: string;
  text: string;
  source: string;
  priority: DailyAgentPriority;
  intent: 'hot' | 'warm' | 'nurture' | 'spam';
  reason: string;
  suggestedAction: string;
  recommendedChannel: DailyAgentRecommendedChannel;
};

const JAKOMA_TERMS = /governance|evidence|assurance|copilot|control|audit|accountability|data exposure|readiness|policy|risk|AI adoption|ownership|healthcare|NHS|NIAS|data-driven care|informal AI|safe AI/i;
const GENERIC_NOISE = /^(great post|thanks|thank you|love this|agree|interesting|liked|reacted)$/i;

function clean(value?: string | null) {
  return String(value ?? '').replace(/\r/g, '\n').trim();
}

function splitLines(value?: string | null) {
  return clean(value)
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 80);
}

function isJakoma(args: GenerateDailyAgentBriefingArgs) {
  const haystack = [args.brandName, args.brandTone, args.audience, args.primaryCta, JSON.stringify(args.brandMetadata ?? {})].join(' ').toLowerCase();
  return /jakoma|ai governance|data assurance|safe ai|ai readiness|available to being governed/.test(haystack);
}

function firstSentence(value: string) {
  return value.split(/(?<=[.!?])\s+/)[0]?.trim() || value.trim();
}

function extractName(line: string) {
  const cleaned = line.replace(/^\d+[.)]\s*/, '').trim();
  const split = cleaned.split(/\s+[—-]\s+|:\s+/)[0]?.trim();
  if (split && split.length <= 70 && /^[A-Za-z0-9][A-Za-z0-9À-ž' .-]+$/.test(split) && !/post|analytics|notification|comment|profile|followers|impressions/i.test(split)) return split;

  const activity = cleaned.match(/^([A-Z][A-Za-zÀ-ž' .-]{1,70})\s+(?:commented|liked|viewed|followed|reposted|reacted|accepted|connected|replied|asked|said)/i);
  if (activity?.[1]) return activity[1].trim();

  const fromPossessive = cleaned.match(/^([A-Z][A-Za-zÀ-ž' .-]{1,70})['’]s\s+/);
  if (fromPossessive?.[1]) return fromPossessive[1].trim();

  return 'LinkedIn contact';
}

function knownRelationshipRule(name: string, text: string): Partial<Signal> | null {
  const lowerName = name.toLowerCase();
  const lower = `${name} ${text}`.toLowerCase();

  if (lowerName.includes('anthony tabbiruka') || lower.includes('anthony tabbiruka')) {
    return {
      priority: 'high',
      intent: 'hot',
      reason: 'Highest-priority partner/referral conversation. Keep the focus on AI readiness handing off to evidence/control/audit layer.',
      suggestedAction: 'Prepare the partner/referral agenda. Do not overstate the meeting as confirmed unless invite/dial-in is received.',
      recommendedChannel: 'meeting_prep',
    };
  }

  if (lowerName.includes('rob macphee') || lower.includes('rob macphee')) {
    return {
      priority: 'high',
      intent: 'warm',
      reason: 'Warm conversation around NIAS, data-driven care and digital operations.',
      suggestedAction: 'If there has been no reply after two working days, send a light follow-up only.',
      recommendedChannel: 'dm',
    };
  }

  if (lowerName.includes('juan pedro') || lower.includes('juan pedro')) {
    return {
      priority: 'high',
      intent: 'warm',
      reason: 'High-value Copilot governance contact. Relevant to Jakoma’s AI governance/evidence lane.',
      suggestedAction: 'Keep engaging publicly. Do not DM yet unless he engages again or there is a natural reason.',
      recommendedChannel: 'no_dm_yet',
    };
  }

  if (lowerName.includes('mostafa') || lower.includes('mostafa el baroudy')) {
    return {
      priority: 'medium',
      intent: 'nurture',
      reason: 'Relevant new follower. Useful to review and track, but not enough signal to pitch.',
      suggestedAction: 'Review profile only and track context. No pitch.',
      recommendedChannel: 'review_profile',
    };
  }

  if (lowerName.includes('surya') || lower.includes('surya s')) {
    return {
      priority: 'low',
      intent: 'nurture',
      reason: 'Profile view is an awareness signal only.',
      suggestedAction: 'Monitor only. Do not DM from a profile view alone.',
      recommendedChannel: 'monitor',
    };
  }

  if (lowerName.includes('ricardo j flores') || lower.includes('ricardo j flores')) {
    return {
      priority: 'low',
      intent: 'nurture',
      reason: 'Reaction-only signal. Useful to notice, not enough to act on.',
      suggestedAction: 'Monitor only.',
      recommendedChannel: 'monitor',
    };
  }

  if (lowerName.includes('thomas list') || lower.includes('thomas list')) {
    return {
      priority: 'low',
      intent: 'nurture',
      reason: 'Repeated profile views are awareness signals, but not enough to DM without further engagement.',
      suggestedAction: 'Track repeated views; no action unless he comments, connects or creates a natural reason.',
      recommendedChannel: 'monitor',
    };
  }

  if (lowerName.includes('promise tembe') || lower.includes('promise tembe')) {
    return {
      priority: 'medium',
      intent: 'nurture',
      reason: 'Relevant AI Law / Governance / Ethics / Data Protection contact.',
      suggestedAction: 'Review profile and track. No pitch.',
      recommendedChannel: 'review_profile',
    };
  }

  if (/judith cousineau|11protocol|faith toyambi|roberta de lorenzis|mukul dakwale|zaynab atwi/i.test(lower)) {
    return {
      priority: 'medium',
      intent: 'warm',
      reason: 'Warm/relevant engagement already in the Jakoma relationship map.',
      suggestedAction: 'Reply publicly where meaningful and track the relationship. Do not over-DM.',
      recommendedChannel: 'public_reply',
    };
  }

  return null;
}

function scoreSignal(line: string, source: string, jakoma: boolean): Signal {
  const name = extractName(line);
  const known = knownRelationshipRule(name, line);
  if (known) {
    return {
      name,
      text: line,
      source,
      priority: known.priority ?? 'medium',
      intent: known.intent ?? 'nurture',
      reason: known.reason ?? 'Known relationship rule matched.',
      suggestedAction: known.suggestedAction ?? 'Review manually.',
      recommendedChannel: known.recommendedChannel ?? 'monitor',
    };
  }

  const lower = line.toLowerCase();
  const isProfileView = /viewed.*profile|profile viewer|viewed profile/.test(lower);
  const isFollower = /followed|new follower/.test(lower);
  const isComment = source === 'comment' || /commented|replied|asked|said|:/.test(lower);
  const isGeneric = GENERIC_NOISE.test(lower) || /great post|love this|thanks for sharing|liked|reacted/.test(lower);
  const hasJakomaSignal = jakoma && JAKOMA_TERMS.test(line);
  const hasCommercialSignal = /struggle|need|looking|interested|call|framework|help|problem|client|budget|proposal|referral|partner|meeting|triage|sprint|retainer/i.test(line);

  if (isProfileView) {
    return {
      name,
      text: line,
      source,
      priority: hasJakomaSignal ? 'medium' : 'low',
      intent: 'nurture',
      reason: hasJakomaSignal ? 'Relevant profile-view context, but profile views alone are not enough to DM.' : 'Profile view only. Awareness signal, not a conversation signal.',
      suggestedAction: hasJakomaSignal ? 'Review profile and track. No DM unless further engagement appears.' : 'Monitor only.',
      recommendedChannel: hasJakomaSignal ? 'review_profile' : 'monitor',
    };
  }

  if (isFollower) {
    return {
      name,
      text: line,
      source,
      priority: hasJakomaSignal ? 'medium' : 'low',
      intent: 'nurture',
      reason: hasJakomaSignal ? 'Relevant follower. Worth reviewing and tracking first.' : 'New follower without enough context for outreach.',
      suggestedAction: 'Review profile and track. No pitch.',
      recommendedChannel: 'review_profile',
    };
  }

  if (isGeneric && !hasJakomaSignal && !hasCommercialSignal) {
    return {
      name,
      text: line,
      source,
      priority: 'low',
      intent: 'spam',
      reason: 'Generic or low-intent activity. Do not let it distract from meaningful relationship work.',
      suggestedAction: 'Ignore or lightly acknowledge only if already in conversation.',
      recommendedChannel: 'monitor',
    };
  }

  if (hasCommercialSignal || /anthony|rob macphee|partner|referral|meeting/i.test(line)) {
    return {
      name,
      text: line,
      source,
      priority: 'high',
      intent: 'hot',
      reason: hasJakomaSignal ? 'Strong Jakoma-fit signal with governance/evidence/commercial context.' : 'Specific commercial or partner signal worth prioritising.',
      suggestedAction: isComment ? 'Reply publicly first; only move to DM if there is repeated engagement or a natural reason.' : 'Log and plan the next human-approved follow-up.',
      recommendedChannel: isComment ? 'public_reply' : 'tracker_update',
    };
  }

  if (hasJakomaSignal || isComment) {
    return {
      name,
      text: line,
      source,
      priority: hasJakomaSignal ? 'high' : 'medium',
      intent: 'warm',
      reason: hasJakomaSignal ? 'Meaningful Jakoma signal: governance, evidence, Copilot, readiness or controls.' : 'Comment signal worth considering for a public reply.',
      suggestedAction: 'Reply publicly if there is a real point to answer. Do not DM unless the relationship warms further.',
      recommendedChannel: 'public_reply',
    };
  }

  return {
    name,
    text: line,
    source,
    priority: 'low',
    intent: 'nurture',
    reason: 'Light awareness signal only.',
    suggestedAction: 'Monitor. No DM yet.',
    recommendedChannel: 'monitor',
  };
}

function jakomaReply(signal: Signal) {
  const name = signal.name === 'LinkedIn contact' ? '' : ` ${signal.name.split(' ')[0]}`;
  const text = signal.text.toLowerCase();

  if (/copilot|informal ai|microsoft/i.test(signal.text)) {
    return `Thanks${name} — Copilot is a good example of the shift from “AI is available” to “AI is governed”. The practical question is whether ownership, access, data exposure and evidence are visible enough to manage.`;
  }
  if (/policy|proof|evidence|assurance/i.test(signal.text)) {
    return `Thanks${name} — exactly. A policy can show intent, but evidence shows whether governance is actually operating. That gap is where a lot of AI adoption risk sits.`;
  }
  if (/readiness|scale|adoption|available|governed/i.test(signal.text)) {
    return `Thanks${name} — that is the key distinction for me: availability is not readiness. Before organisations scale AI use, they need visibility, ownership, controls and an evidence trail.`;
  }
  if (/healthcare|NHS|NIAS|care/i.test(signal.text)) {
    return `Thanks${name} — especially in health and care settings, the question is not just whether AI can help, but whether use, data exposure, ownership and assurance are clear enough to rely on.`;
  }
  if (text.includes('great post') || text.includes('thanks')) {
    return `Thanks${name} — appreciated.`;
  }
  return `Thanks${name} — useful point. For me, the practical gap is moving from AI being available to AI being governed: clear ownership, controls, evidence and an operating rhythm people can actually follow.`;
}

function genericReply(signal: Signal, brandName: string) {
  const name = signal.name === 'LinkedIn contact' ? '' : ` ${signal.name.split(' ')[0]}`;
  if (signal.priority === 'high') {
    return `Thanks${name} — that is exactly the gap ${brandName} is focused on: turning attention into a clear next action, without jumping straight to aggressive outreach.`;
  }
  return `Thanks${name} — useful point. The main thing is keeping the workflow practical: reply where there is real context, track the relationship, and avoid chasing weak signals.`;
}

function analyticsSignals(args: GenerateDailyAgentBriefingArgs, jakoma: boolean) {
  const raw = clean(args.rawAnalytics);
  if (!raw) {
    return {
      interpretation: 'No analytics were provided today. Treat this as a signal-led briefing from notifications, comments and relationship context rather than a performance-led review.',
      signals: ['No manual analytics input supplied.'],
      reuseIdeas: ['Capture impressions, comments, profile views and follower changes tomorrow for sharper interpretation.'],
    };
  }

  const lines = splitLines(raw).slice(0, 12);
  const joined = raw.toLowerCase();
  const hasSeniorAudience = /senior|director|cxo|chief|founder|leader/.test(joined);
  const hasGovernanceLane = /governance|readiness|evidence|policy|copilot|assurance|controls/.test(joined);
  const hasComments = /comment|reply|discussion/.test(joined);
  const hasProfile = /profile|viewer|view/.test(joined);

  if (jakoma) {
    return {
      interpretation: hasGovernanceLane
        ? 'The strongest content lane is still AI governance, readiness and evidence. Prioritise audience quality and seniority over raw impressions.'
        : 'Use the analytics to identify which AI governance angle created quality attention. Raw reach matters less than senior/relevant engagement and profile-view follow-through.',
      signals: [
        ...lines,
        hasSeniorAudience ? 'Audience seniority is commercially useful for Jakoma; keep writing for leaders, not generic AI users.' : 'Add audience seniority/sector notes when available.',
        hasComments ? 'Comments are the strongest signal because they reveal the practical governance question people are reacting to.' : 'Few/no comments supplied; use profile views and follower changes as weaker supporting signals.',
        hasProfile ? 'Profile views are useful awareness signals, but not enough to DM on their own.' : 'Add profile-view movement if available.',
      ].slice(0, 10),
      reuseIdeas: [
        'Repeat the available vs governed lane with a sharper example.',
        'Turn policy is not proof into a practical evidence checklist.',
        'Use Copilot/informal AI as the concrete entry point into governance risk.',
      ],
    };
  }

  return {
    interpretation: hasComments
      ? 'Conversation quality is the strongest useful signal. Prioritise the people who asked specific questions or described a business problem.'
      : 'The analytics provide directional context. Use them to identify the theme worth repeating and the relationship follow-up worth logging.',
    signals: lines.length ? lines : ['Manual analytics were supplied but no clear metric lines were detected.'],
    reuseIdeas: ['Reuse the clearest pain point as tomorrow’s hook.', 'Turn the best comment or question into a practical framework post.'],
  };
}

function jakomaPost(args: GenerateDailyAgentBriefingArgs, signals: Signal[]) {
  const cta = args.primaryCta || 'Review the AI Governance Triage: https://jakoma.org/ai-governance-triage.html';
  const signalText = firstSentence(signals.find((signal) => JAKOMA_TERMS.test(signal.text))?.text || 'AI is becoming available inside organisations faster than governance evidence is being created.');
  const hook = 'AI being available is not the same as AI being governed.';
  const draftPost = [
    hook,
    '',
    'A lot of organisations are moving quickly with AI tools, pilots and Copilot-style adoption.',
    '',
    'That can be useful progress. But availability is not the same as readiness.',
    '',
    `Today’s signal: ${signalText}`,
    '',
    'The practical questions are:',
    '• who owns the AI use case?',
    '• what data is being exposed?',
    '• what controls are actually operating?',
    '• what evidence would stand up to review?',
    '• what rhythm keeps this visible after launch?',
    '',
    'Policy matters, but policy is not proof.',
    '',
    'Governance becomes real when ownership, controls, evidence and operating rhythm are visible enough to manage.',
    '',
    cta,
  ].join('\n');
  return {
    hook,
    angle: 'Use the available vs governed distinction to pull today’s LinkedIn signals back to Jakoma’s AI governance/readiness lane.',
    draftPost,
    cta,
  };
}

function genericPost(args: GenerateDailyAgentBriefingArgs, signals: Signal[]) {
  const cta = args.primaryCta || 'Reply if you want the practical follow-up framework.';
  const signalText = firstSentence(signals[0]?.text || 'LinkedIn activity only creates value when it turns into relationship follow-up.');
  const hook = 'LinkedIn visibility is not the same as pipeline.';
  const draftPost = [
    hook,
    '',
    'A post can get attention and still create very little commercial progress if there is no follow-up system behind it.',
    '',
    `Today’s signal: ${signalText}`,
    '',
    'The practical question is not only “what should we post next?”',
    '',
    'It is:',
    '• who engaged with a real problem?',
    '• who should get a thoughtful reply?',
    '• who should be saved for follow-up?',
    '• what did the market tell us to write about tomorrow?',
    '',
    'That is the operating gap: turning LinkedIn activity into useful next actions, not just more content.',
    '',
    cta,
  ].join('\n');
  return { hook, angle: 'Visibility only matters when it becomes relationship follow-up.', draftPost, cta };
}

function uniqueSignals(signals: Signal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.name.toLowerCase()}-${signal.source}-${signal.text.slice(0, 40).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function openAiSchema() {
  const priority = { type: 'string', enum: ['high', 'medium', 'low'] };
  const channel = { type: 'string', enum: ['public_reply', 'dm', 'connection_note', 'review_profile', 'monitor', 'no_dm_yet', 'meeting_prep', 'tracker_update', 'content'] };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      generationMode: { type: 'string', enum: ['openai', 'fallback'] },
      summary: { type: 'string' },
      whatChanged: { type: 'array', items: { type: 'string' } },
      whoMatters: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, handle: { type: 'string' }, priority, reason: { type: 'string' }, suggestedAction: { type: 'string' }, recommendedChannel: channel }, required: ['name', 'priority', 'reason', 'suggestedAction', 'recommendedChannel'] },
      },
      replyQueue: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { personName: { type: 'string' }, sourceText: { type: 'string' }, intent: { type: 'string', enum: ['hot', 'warm', 'nurture', 'spam'] }, draftReply: { type: 'string' }, draftDm: { type: 'string' }, priority, reason: { type: 'string' }, recommendedChannel: channel }, required: ['personName', 'sourceText', 'intent', 'draftReply', 'priority', 'reason', 'recommendedChannel'] },
      },
      ignoreList: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { item: { type: 'string' }, reason: { type: 'string' } }, required: ['item', 'reason'] } },
      trackerUpdates: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { personName: { type: 'string' }, updateType: { type: 'string', enum: ['create_lead', 'update_lead', 'add_note', 'set_follow_up'] }, reason: { type: 'string' }, nextAction: { type: 'string' }, priority, recommendedChannel: channel }, required: ['personName', 'updateType', 'reason', 'priority', 'recommendedChannel'] },
      },
      followUps: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { personName: { type: 'string' }, action: { type: 'string' }, draft: { type: 'string' }, priority, recommendedChannel: channel }, required: ['personName', 'action', 'priority', 'recommendedChannel'] },
      },
      analyticsReview: { type: 'object', additionalProperties: false, properties: { interpretation: { type: 'string' }, signals: { type: 'array', items: { type: 'string' } }, reuseIdeas: { type: 'array', items: { type: 'string' } } }, required: ['interpretation', 'signals', 'reuseIdeas'] },
      tomorrowContentIdea: { type: 'object', additionalProperties: false, properties: { hook: { type: 'string' }, angle: { type: 'string' }, draftPost: { type: 'string' }, cta: { type: 'string' } }, required: ['hook', 'angle', 'draftPost', 'cta'] },
      actions: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, properties: { actionType: { type: 'string', enum: ['public_reply', 'dm_draft', 'connection_note', 'tracker_update', 'follow_up', 'review_profile', 'monitor', 'no_dm_yet', 'meeting_prep', 'ignore', 'content_idea'] }, personName: { type: 'string' }, personHandle: { type: 'string' }, priority, source: { type: 'string' }, reason: { type: 'string' }, recommendedChannel: channel, draftText: { type: 'string' }, metadata: { type: 'object' } }, required: ['actionType', 'priority', 'source', 'reason', 'recommendedChannel'] },
      },
    },
    required: ['generationMode', 'summary', 'whatChanged', 'whoMatters', 'replyQueue', 'ignoreList', 'trackerUpdates', 'followUps', 'analyticsReview', 'tomorrowContentIdea', 'actions'],
  };
}

async function openAiBriefing(args: GenerateDailyAgentBriefingArgs): Promise<DailyAgentBriefing | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const jakoma = isJakoma(args);
  const prompt = [
    'You are Repurly Daily LinkedIn Agent for consultants, founders and expert-led businesses.',
    'Operating principle: Repurly drafts. The user approves. The user posts/sends. Repurly logs and learns.',
    'Do not recommend automated LinkedIn scraping, auto-comments, auto-DMs, auto-connection requests or profile automation.',
    'Prefer public replies, review-only, monitor, no-DM-yet and tracker updates over cold DMs.',
    'A 10/10 output is specific, conservative, relationship-led and commercially useful. It must clearly separate reply publicly, review only, monitor, no DM yet, meeting prep, tracker update and content idea actions.',
    'Every DM draft must include a natural reason. If the reason is weak, do not draft a DM; recommend no_dm_yet or monitor instead.',
    'Use the brand metadata/opportunityDesk settings as hard constraints: offer, ideal customers, warm signals, ignore signals, DM policy, content lanes, no-go topics and relationship rules.',
    jakoma
      ? 'Jakoma-specific guardrails: public content must focus on AI governance, data assurance and safe AI adoption. Do not create public Jakoma posts about Repurly, LinkedIn operating systems, Smart Stay or Independent Living. Prioritise evidence, governance, Copilot, readiness, controls, audit trail, data exposure, accountability and healthcare/IT services relevance. Profile views alone are review/monitor only. New followers are review/track only. Move to DM only after repeated engagement, clear relevance or a natural reason.'
      : 'For non-Jakoma brands, stay focused on the selected brand context and relationship-led LinkedIn next actions.',
    'Known Jakoma relationship rules when names appear: Anthony Tabbiruka = highest-priority partner/referral prep, do not overstate confirmed meeting without invite/dial-in. Rob MacPhee = warm NIAS/data-driven care conversation, light follow-up only after two working days. Juan Pedro Marquez Castorina = high-value Copilot governance contact, public engagement/no DM yet. Mostafa El Baroudy = review only/no pitch. Surya S, Ricardo J Flores, Thomas List = monitor only unless stronger signal appears. Promise Tembe = review/no pitch. Judith Cousineau, 11Protocol, Faith Toyambi and other warm commenters = public reply where meaningful, no over-DM.',
    'Return strict JSON only. Drafts must use UK spelling, calm practical tone and concise expert wording. Avoid hype, flattery, fake familiarity and overclaiming.',
    `Brand: ${args.brandName}`,
    `Tone of voice: ${args.brandTone ?? 'clear, practical, commercially focused, UK spelling'}`,
    `Audience: ${args.audience ?? 'B2B consultants, founders and expert-led businesses'}`,
    `Primary offer/CTA: ${args.primaryCta ?? 'start a useful conversation'}`,
    `Secondary CTA: ${args.secondaryCta ?? ''}`,
    `Brand metadata/rules: ${JSON.stringify(args.brandMetadata ?? {})}`,
    `Notifications:\n${clean(args.rawNotifications) || 'None provided'}`,
    `Comments:\n${clean(args.rawComments) || 'None provided'}`,
    `Analytics:\n${clean(args.rawAnalytics) || 'None provided'}`,
    `Profiles/contacts:\n${clean(args.rawProfiles) || 'None provided'}`,
    `Notes:\n${clean(args.rawNotes) || 'None provided'}`,
  ].join('\n\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_DAILY_AGENT_MODEL?.trim() || 'gpt-4.1-mini',
        input: prompt,
        text: { format: { type: 'json_schema', name: 'repurly_daily_agent_briefing', schema: openAiSchema() } },
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) return null;
    return { ...(JSON.parse(payload.output_text) as DailyAgentBriefing), generationMode: 'openai' };
  } catch {
    return null;
  }
}

async function fallbackBriefing(args: GenerateDailyAgentBriefingArgs): Promise<DailyAgentBriefing> {
  const jakoma = isJakoma(args);
  const lines = [
    ...splitLines(args.rawComments).map((text) => ({ text, source: 'comment' })),
    ...splitLines(args.rawNotifications).map((text) => ({ text, source: 'notification' })),
    ...splitLines(args.rawProfiles).map((text) => ({ text, source: 'profile' })),
    ...splitLines(args.rawNotes).map((text) => ({ text, source: 'note' })),
  ];

  const signals = uniqueSignals(lines.map((line) => scoreSignal(line.text, line.source, jakoma)));
  const highSignals = signals.filter((signal) => signal.priority === 'high');
  const mediumSignals = signals.filter((signal) => signal.priority === 'medium');
  const lowSignals = signals.filter((signal) => signal.priority === 'low');
  const ordered = [...highSignals, ...mediumSignals, ...lowSignals];

  const replySignals = ordered.filter((signal) => signal.recommendedChannel === 'public_reply').slice(0, 8);
  const replyQueue = replySignals.map((signal) => ({
    personName: signal.name,
    sourceText: signal.text,
    intent: signal.intent,
    draftReply: jakoma ? jakomaReply(signal) : genericReply(signal, args.brandName),
    draftDm: signal.priority === 'high' && !jakoma ? `Hi ${signal.name}, thanks for engaging with the post. Your point stood out because it connects to the practical follow-up gap I was writing about.` : undefined,
    priority: signal.priority,
    reason: signal.reason,
    recommendedChannel: signal.recommendedChannel,
  }));

  const whoMatters = ordered.slice(0, 12).map((signal) => ({
    name: signal.name,
    priority: signal.priority,
    reason: signal.reason,
    suggestedAction: signal.suggestedAction,
    recommendedChannel: signal.recommendedChannel,
  }));

  const ignoreList = lowSignals
    .filter((signal) => signal.recommendedChannel === 'monitor' || signal.intent === 'spam')
    .slice(0, 8)
    .map((signal) => ({ item: signal.text, reason: signal.reason }));

  const trackerSignals = ordered.filter((signal) => signal.priority !== 'low' || signal.recommendedChannel === 'review_profile').slice(0, 10);
  const trackerUpdates = trackerSignals.map((signal) => ({
    personName: signal.name,
    updateType: signal.priority === 'high' ? ('create_lead' as const) : signal.recommendedChannel === 'review_profile' ? ('add_note' as const) : ('set_follow_up' as const),
    reason: signal.reason,
    nextAction: signal.suggestedAction,
    priority: signal.priority,
    recommendedChannel: signal.recommendedChannel,
  }));

  const followUps = ordered
    .filter((signal) => ['dm', 'meeting_prep', 'tracker_update', 'public_reply', 'no_dm_yet'].includes(signal.recommendedChannel))
    .slice(0, 8)
    .map((signal) => ({
      personName: signal.name,
      action: signal.suggestedAction,
      draft: signal.recommendedChannel === 'dm' && signal.priority === 'high'
        ? jakoma
          ? `Hi ${signal.name}, thanks again for the conversation. The overlap I see is around practical AI readiness, evidence, controls and where that hands off into assurance. Happy to compare notes if useful.`
          : `Hi ${signal.name}, thanks for engaging. Your point stood out because it connects to a practical follow-up gap I am seeing with expert-led LinkedIn activity.`
        : undefined,
      priority: signal.priority,
      recommendedChannel: signal.recommendedChannel,
    }));

  const analyticsReview = analyticsSignals(args, jakoma);
  const tomorrowContentIdea = jakoma ? jakomaPost(args, ordered) : genericPost(args, ordered);
  const actions: DailyAgentAction[] = [
    ...replyQueue.map((item) => ({
      actionType: 'public_reply' as const,
      personName: item.personName,
      priority: item.priority,
      source: 'comment',
      reason: item.reason,
      recommendedChannel: item.recommendedChannel,
      draftText: item.draftReply,
      metadata: { sourceText: item.sourceText, draftDm: item.draftDm, intent: item.intent },
    })),
    ...ordered
      .filter((signal) => ['review_profile', 'monitor', 'no_dm_yet', 'meeting_prep'].includes(signal.recommendedChannel))
      .slice(0, 10)
      .map((signal) => ({
        actionType: signal.recommendedChannel === 'meeting_prep' ? 'meeting_prep' as const : signal.recommendedChannel === 'no_dm_yet' ? 'no_dm_yet' as const : signal.recommendedChannel === 'review_profile' ? 'review_profile' as const : 'monitor' as const,
        personName: signal.name,
        priority: signal.priority,
        source: signal.source,
        reason: signal.reason,
        recommendedChannel: signal.recommendedChannel,
        draftText: signal.suggestedAction,
        metadata: { sourceText: signal.text },
      })),
    ...trackerUpdates.map((item) => ({
      actionType: 'tracker_update' as const,
      personName: item.personName,
      priority: item.priority,
      source: 'relationship_tracker',
      reason: item.reason,
      recommendedChannel: 'tracker_update' as const,
      draftText: item.nextAction,
      metadata: { updateType: item.updateType, originalRecommendedChannel: item.recommendedChannel },
    })),
    ...followUps
      .filter((item) => item.draft || item.recommendedChannel === 'meeting_prep')
      .map((item) => ({
        actionType: item.recommendedChannel === 'meeting_prep' ? 'meeting_prep' as const : 'follow_up' as const,
        personName: item.personName,
        priority: item.priority,
        source: 'follow_up',
        reason: item.action,
        recommendedChannel: item.recommendedChannel,
        draftText: item.draft ?? item.action,
      })),
    ...ignoreList.map((item) => ({ actionType: 'ignore' as const, priority: 'low' as const, source: 'noise_filter', reason: item.reason, recommendedChannel: 'monitor' as const, draftText: item.item })),
    { actionType: 'content_idea', priority: 'high', source: 'tomorrow_content', reason: 'Daily Agent generated tomorrow’s post from today’s signals.', recommendedChannel: 'content', draftText: tomorrowContentIdea.draftPost },
  ];

  const sourceCounts = {
    comments: splitLines(args.rawComments).length,
    notifications: splitLines(args.rawNotifications).length,
    profiles: splitLines(args.rawProfiles).length,
    notes: splitLines(args.rawNotes).length,
  };

  return {
    generationMode: 'fallback',
    summary: jakoma
      ? 'Daily Agent reviewed the pasted LinkedIn activity against Jakoma’s AI governance, data assurance and safe AI adoption rules. Prioritise governance/evidence conversations, public replies and partner follow-up; avoid DMs from weak signals.'
      : 'Daily Agent reviewed the pasted LinkedIn activity and turned it into reply drafts, relationship updates, follow-ups, ignore recommendations and a next content idea.',
    whatChanged: [
      `${sourceCounts.comments} comment line${sourceCounts.comments === 1 ? '' : 's'} reviewed for reply drafting.`,
      `${sourceCounts.notifications} notification line${sourceCounts.notifications === 1 ? '' : 's'} reviewed for priority and noise filtering.`,
      `${sourceCounts.profiles} profile/contact line${sourceCounts.profiles === 1 ? '' : 's'} reviewed for relationship scoring.`,
      analyticsReview.interpretation,
    ],
    whoMatters,
    replyQueue,
    ignoreList,
    trackerUpdates,
    followUps,
    analyticsReview,
    tomorrowContentIdea,
    actions: actions.slice(0, 45),
  };
}

export async function generateDailyAgentBriefing(args: GenerateDailyAgentBriefingArgs) {
  const ai = await openAiBriefing(args);
  if (ai) return ai;
  return fallbackBriefing(args);
}
