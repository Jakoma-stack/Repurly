export type ContentDraft = {
  title: string;
  body: string;
  hashtags: string[];
  titleHint: string;
  callToAction: string;
};

export type GeneratedScheduleSlot = {
  draftNumber: number;
  dayOffset: number;
  label: string;
};

export type PerformanceInsight = {
  contentPattern: string;
  callToActionPattern: string;
  averageBodyLength: number;
  recentExamples: string[];
};

export type GenerateContentDraftsArgs = {
  brandName: string;
  brandTone?: string | null;
  audience?: string | null;
  primaryCta?: string | null;
  secondaryCta?: string | null;
  hashtags?: string[] | null;
  brief: string;
  postFormat?: string | null;
  commercialGoal?: string | null;
  cadence?: string | null;
  preferredTimeOfDay?: string | null;
  count?: number;
  campaignWindowDays?: number;
  sourceMaterial?: string | null;
  voiceNotes?: string | null;
  blockedTerms?: string[] | null;
  targetPlatforms?: string[] | null;
  performanceContext?: string[] | null;
  complianceRules?: string[] | null;
};

const TITLE_MAX_LENGTH = 150;
const BODY_MAX_LENGTH = 5000;
const TITLE_HINT_MAX_LENGTH = 120;
const CTA_MAX_LENGTH = 140;
const HASHTAG_LIMIT = 5;

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function parseHashtags(input?: string[] | null) {
  return unique((input ?? []).map((item) => item.replace(/^#/, '').trim()).filter(Boolean));
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function trimTo(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trim()}...`;
}

function summarizeBrief(brief: string) {
  const normalized = brief
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^audience\s*:/i.test(line))
    .filter((line) => !/^goal\s*:/i.test(line))
    .filter((line) => !/^positioning\s*:/i.test(line))
    .filter((line) => !/^important constraints\s*:/i.test(line))
    .filter((line) => !/^tone\s*:/i.test(line))
    .filter((line) => !/^create \d+/i.test(line))
    .filter((line) => !/^each post should\s*:/i.test(line))
    .filter((line) => !line.startsWith('-'))
    .join(' ');

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  const summary = cleanSentence(firstSentence).replace(/^write\s+/i, '').replace(/^create\s+/i, '');

  if (!summary) {
    return 'Use a narrow, reliable social workflow that gets good posts approved, published, and turned into pipeline without extra tool sprawl.';
  }

  return summary.length > 220 ? `${summary.slice(0, 217).trim()}...` : summary;
}

function fallbackTitle(args: GenerateContentDraftsArgs, index: number) {
  return trimTo(`${args.brandName} campaign draft ${index + 1}`, TITLE_MAX_LENGTH);
}

function stripMetaLines(body: string) {
  return body
    .split('\n')
    .filter((line) => !/^(tone|audience|title hint|format|platform)\s*:/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeDraft(draft: Partial<ContentDraft> | null | undefined, args: GenerateContentDraftsArgs, index: number): ContentDraft {
  const hashtags = unique([
    ...parseHashtags(args.hashtags),
    ...((draft?.hashtags ?? []).map((tag) => String(tag ?? '').replace(/^#/, '').trim()).filter(Boolean)),
  ]).slice(0, HASHTAG_LIMIT);

  const callToAction = trimTo(draft?.callToAction?.trim() || args.primaryCta?.trim() || 'Book a demo.', CTA_MAX_LENGTH);
  const title = trimTo(draft?.title?.trim() || fallbackTitle(args, index), TITLE_MAX_LENGTH);
  const targetPlatforms = (args.targetPlatforms ?? []).filter(Boolean);
  const titleHint = trimTo(
    draft?.titleHint?.trim() || `${(args.commercialGoal || 'Drive qualified action').trim()} · ${(targetPlatforms.join('/') || 'LinkedIn').trim()} · ${(args.postFormat || 'text').trim()}`,
    TITLE_HINT_MAX_LENGTH,
  );

  const rawBody = draft?.body?.trim();
  const body = trimTo(
    stripMetaLines(
      rawBody || [
        'Most teams do not need more posts. They need a cleaner way to brief, approve, publish, and follow up on the right post without delay.',
        '',
        summarizeBrief(args.brief),
        '',
        callToAction,
        '',
        hashtags.map((tag) => `#${tag}`).join(' '),
      ].filter(Boolean).join('\n'),
    ),
    BODY_MAX_LENGTH,
  );

  return { title, body, hashtags, titleHint, callToAction };
}

function readOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;

  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const output = (payload as { output?: Array<{ content?: Array<{ text?: string; type?: string }> }> }).output;
  if (!Array.isArray(output)) return null;

  const text = output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((item) => item?.type === 'output_text' || typeof item?.text === 'string')
    .map((item) => item.text?.trim() ?? '')
    .filter(Boolean)
    .join('');

  return text || null;
}

function summarizeSourceMaterial(sourceMaterial?: string | null) {
  const source = (sourceMaterial ?? '').trim();
  if (!source) return null;
  return trimTo(cleanSentence(source.replace(/\n+/g, ' ')), 260);
}

export function buildSuggestedSchedule(args: GenerateContentDraftsArgs): GeneratedScheduleSlot[] {
  const count = Math.max(1, Math.min(args.count ?? 3, 30));
  const campaignWindowDays = Math.max(1, Math.min(args.campaignWindowDays ?? 30, 180));
  const interval = count <= 1 ? 0 : Math.max(1, Math.floor(campaignWindowDays / Math.max(count - 1, 1)));

  return Array.from({ length: count }, (_, index) => {
    const dayOffset = Math.min(campaignWindowDays - 1, index * interval);
    return { draftNumber: index + 1, dayOffset, label: dayOffset === 0 ? 'Day 1' : `Day ${dayOffset + 1}` };
  });
}


function inferPreferredCta(performanceContext: string[]) {
  const text = performanceContext.join(' ').toLowerCase();
  if (text.includes('demo')) return 'demo-focused';
  if (text.includes('call')) return 'call-focused';
  if (text.includes('reply')) return 'reply-driven';
  if (text.includes('download')) return 'download-led';
  return 'soft-commercial';
}

function inferContentPattern(performanceContext: string[]) {
  const joined = performanceContext.join(' ').toLowerCase();
  if (joined.includes('how ') || joined.includes('how-to')) return 'educational';
  if (joined.includes('mistake') || joined.includes('lesson')) return 'contrarian';
  if (joined.includes('case study') || joined.includes('proof')) return 'proof-led';
  return 'operational-insight';
}

export function derivePerformanceInsight(performanceContext?: string[] | null): PerformanceInsight {
  const recentExamples = (performanceContext ?? []).filter(Boolean).slice(0, 5);
  const averageBodyLength = recentExamples.length
    ? Math.round(recentExamples.reduce((total, item) => total + item.length, 0) / recentExamples.length)
    : 240;

  return {
    contentPattern: inferContentPattern(recentExamples),
    callToActionPattern: inferPreferredCta(recentExamples),
    averageBodyLength,
    recentExamples,
  };
}

function evaluatePerformanceFit(args: GenerateContentDraftsArgs, draft: ContentDraft) {
  const insight = derivePerformanceInsight(args.performanceContext);
  const body = draft.body.toLowerCase();
  const title = draft.title.toLowerCase();
  const reasons: string[] = [];
  let score = 58;

  if (insight.contentPattern === 'educational' && (title.includes('how') || body.includes('how '))) {
    score += 8;
    reasons.push('Matches recent educational pattern');
  }
  if (insight.contentPattern === 'contrarian' && (title.includes('mistake') || body.includes('miss'))) {
    score += 8;
    reasons.push('Matches recent contrarian pattern');
  }
  if (insight.contentPattern === 'proof-led' && (body.includes('proof') || body.includes('evidence') || body.includes('example'))) {
    score += 8;
    reasons.push('Matches recent proof-led pattern');
  }

  if (insight.callToActionPattern === 'demo-focused' && /demo|book/.test(body)) {
    score += 6;
    reasons.push('CTA aligns with recent commercial pattern');
  } else if (insight.callToActionPattern === 'reply-driven' && /reply|comment|message/.test(body)) {
    score += 6;
    reasons.push('CTA aligns with recent engagement pattern');
  }

  const lengthDelta = Math.abs(draft.body.length - insight.averageBodyLength);
  if (lengthDelta <= 120) {
    score += 6;
    reasons.push('Body length is close to recent winners');
  } else if (lengthDelta > 260) {
    score -= 8;
    reasons.push('Body length is far from recent winners');
  }

  if (draft.hashtags.length <= 4) {
    score += 2;
  }

  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4), insight };
}

function assessComplianceRisk(args: GenerateContentDraftsArgs, draft: ContentDraft) {
  const text = `${draft.title}\n${draft.body}`.toLowerCase();
  const blockedTerms = (args.blockedTerms ?? []).map((term) => term.toLowerCase());
  const complianceRules = (args.complianceRules ?? []).map((rule) => rule.toLowerCase());
  const riskyClaims = ['guarantee', 'guaranteed', 'best', 'always', 'never', 'instant', 'effortless'];

  const violations = [
    ...blockedTerms.filter((term) => term && text.includes(term)).map((term) => `Uses blocked term: ${term}`),
    ...riskyClaims.filter((term) => text.includes(term)).map((term) => `Contains absolute claim: ${term}`),
    ...complianceRules.filter((rule) => rule && text.includes(rule)).map((rule) => `Mentions restricted phrase: ${rule}`),
  ];

  return { level: violations.length >= 2 ? 'medium' : violations.length === 1 ? 'low' : 'none', notes: violations.slice(0, 4) };
}

function buildFallbackDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  const count = Math.max(1, Math.min(args.count ?? 3, 30));
  const hashtags = parseHashtags(args.hashtags);
  const cta = args.primaryCta?.trim() || 'Book a demo.';
  const audience = args.audience?.trim() || 'B2B marketing and operations teams';
  const goal = args.commercialGoal?.trim() || 'start more qualified buyer conversations';
  const format = args.postFormat?.trim() || 'text';
  const cadence = args.cadence?.trim() || 'weekly';
  const preferredTimeOfDay = args.preferredTimeOfDay?.trim() || 'morning';
  const briefSummary = summarizeBrief(args.brief);
  const sourceSummary = summarizeSourceMaterial(args.sourceMaterial);
  const platformLabel = (args.targetPlatforms ?? []).join(', ') || 'LinkedIn';
  const performanceNudge = (args.performanceContext ?? []).slice(0, 2).join(' | ');
  const schedule = buildSuggestedSchedule(args);

  const patterns = [
    {
      title: `${args.brandName}: the workflow lesson most teams miss`,
      opener: 'Most teams do not have a content problem. They have a workflow problem.',
      middle: `When approvals, targets, and recovery steps are vague, good ideas stall and deadlines slip. ${briefSummary}`,
      closer: 'The practical fix is a tighter operating system: one owner, one target, one approval path, one queue.',
    },
    {
      title: `${args.brandName}: the buyer pain behind the brief`,
      opener: 'A lot of "we need more content" requests are really a signal that the underlying process is too loose.',
      middle: `What buyers usually want is confidence: clear messaging, reliable posting, and fewer handoff gaps. ${briefSummary}`,
      closer: 'That is why we bias toward fewer channels, higher quality, and a workflow the team will actually use.',
    },
    {
      title: `${args.brandName}: a point of view post for ${audience}`,
      opener: 'A useful content system should make commercial follow-up easier, not create more admin.',
      middle: `For ${audience}, the best workflow is the one that keeps strategy, drafting, approvals, and next actions connected. ${briefSummary}`,
      closer: 'If the system cannot help the team move from post to reply to lead follow-up, it is only solving half the problem.',
    },
    {
      title: `${args.brandName}: proof-driven post idea`,
      opener: 'One of the fastest ways to improve content performance is to reduce workflow drag before you increase volume.',
      middle: `Less time lost in approvals means more time refining the message. ${briefSummary}`,
      closer: 'Teams that treat publishing like an operational process usually outperform teams that treat it like ad hoc posting.',
    },
  ];

  return Array.from({ length: count }, (_, index) => {
    const pattern = patterns[index % patterns.length];
    const finalHashtags = unique(['contentops', 'demandgen', ...hashtags]).slice(0, HASHTAG_LIMIT);
    const slot = schedule[index];
    return normalizeDraft({
      title: pattern.title,
      titleHint: `${goal} · ${cadence} · ${preferredTimeOfDay} · ${platformLabel} · ${slot.label} (${format})`,
      callToAction: cta,
      hashtags: finalHashtags,
      body: [
        pattern.opener,
        '',
        pattern.middle,
        sourceSummary ? `Repurpose angle: ${sourceSummary}` : '',
        performanceNudge ? `What has worked recently: ${performanceNudge}` : '',
        '',
        pattern.closer,
        '',
        `Recommended timing: ${slot.label} of the ${Math.max(1, Math.min(args.campaignWindowDays ?? 30, 180))}-day campaign.`,
        '',
        cta,
        '',
        finalHashtags.map((tag) => `#${tag}`).join(' '),
      ].filter(Boolean).join('\n'),
    }, args, index);
  });
}

export function buildFallbackContentDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  return buildFallbackDrafts(args);
}

export function buildAiReview(args: GenerateContentDraftsArgs, draft: ContentDraft, draftNumber: number) {
  const schedule = buildSuggestedSchedule({ ...args, count: Math.max(draftNumber, args.count ?? draftNumber) })[draftNumber - 1];
  const compliance = assessComplianceRisk(args, draft);
  const performanceFit = evaluatePerformanceFit(args, draft);
  const requiresHumanReview = compliance.level !== 'none' || performanceFit.score < 60;
  const approvalRecommendation = compliance.level === 'medium'
    ? 'Needs compliance edit before approval'
    : requiresHumanReview
      ? 'Human review recommended before scheduling'
      : 'Ready for approval queue';

  return {
    suggestedDayOffset: schedule?.dayOffset ?? 0,
    suggestedScheduleLabel: schedule?.label ?? 'Day 1',
    complianceRisk: compliance.level,
    complianceNotes: compliance.notes,
    platformPlan: args.targetPlatforms ?? ['linkedin'],
    performanceFitScore: performanceFit.score,
    performanceFitReasons: performanceFit.reasons,
    approvalRecommendation,
    requiresHumanReview,
    recentWinnerPattern: performanceFit.insight.contentPattern,
    recentCtaPattern: performanceFit.insight.callToActionPattern,
  };
}

async function generateWithOpenAi(args: GenerateContentDraftsArgs): Promise<ContentDraft[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const count = Math.max(1, Math.min(args.count ?? 3, 30));
  const model = process.env.OPENAI_CONTENT_MODEL?.trim() || 'gpt-4.1-mini';
  const prompt = [
    `You are writing social content for ${args.brandName}.`,
    'Return strict JSON with the shape {"drafts":[{"title":"","body":"","hashtags":[""],"titleHint":"","callToAction":""}]}.',
    'Keep the tone commercially realistic and avoid hype.',
    'Do not paste the brief verbatim into the post body.',
    'Never include internal labels like Tone:, Audience:, Format:, Title Hint:, or Platform: inside the post body.',
    'Turn the brief into original post copy with a clean opening line, 2-4 short body paragraphs, and a concise CTA.',
    'Vary the hooks across the batch. Do not produce near-duplicates.',
    'Plan the batch like a coherent campaign across the requested window in days.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? 'clear, sharp, commercially realistic'}`,
    `Audience: ${args.audience ?? 'B2B teams'}`,
    `Voice notes: ${args.voiceNotes ?? ''}`,
    `Blocked terms: ${(args.blockedTerms ?? []).join(', ')}`,
    `Compliance rules: ${(args.complianceRules ?? []).join(', ')}`,
    `Primary CTA: ${args.primaryCta ?? ''}`,
    `Secondary CTA: ${args.secondaryCta ?? ''}`,
    `Hashtags: ${(args.hashtags ?? []).join(', ')}`,
    `Commercial goal: ${args.commercialGoal ?? ''}`,
    `Preferred format: ${args.postFormat ?? 'text'}`,
    `Planning cadence: ${args.cadence ?? 'weekly'}`,
    `Preferred time of day: ${args.preferredTimeOfDay ?? 'morning'}`,
    `Campaign window in days: ${Math.max(1, Math.min(args.campaignWindowDays ?? 30, 180))}`,
    `Target platforms: ${(args.targetPlatforms ?? ['linkedin']).join(', ')}`,
    `Repurposing source material: ${args.sourceMaterial ?? ''}`,
    `What has worked recently: ${(args.performanceContext ?? []).join(' | ')}`,
    `Recent winner pattern: ${derivePerformanceInsight(args.performanceContext).contentPattern}`,
    `Recent CTA pattern: ${derivePerformanceInsight(args.performanceContext).callToActionPattern}`,
    `Approximate high-performing body length: ${derivePerformanceInsight(args.performanceContext).averageBodyLength}`,
    `Brief: ${args.brief}`,
    `Draft count: ${count}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'repurly_content_drafts',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                drafts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      body: { type: 'string' },
                      hashtags: { type: 'array', items: { type: 'string' } },
                      titleHint: { type: 'string' },
                      callToAction: { type: 'string' },
                    },
                    required: ['title', 'body', 'hashtags', 'titleHint', 'callToAction'],
                  },
                },
              },
              required: ['drafts'],
            },
          },
        },
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const outputText = readOutputText(payload);
    if (!outputText) return null;

    const parsed = JSON.parse(outputText) as { drafts?: Array<Partial<ContentDraft>> };
    if (!parsed.drafts?.length) return null;

    return parsed.drafts.slice(0, count).map((draft, index) => normalizeDraft(draft, args, index));
  } catch {
    return null;
  }
}

export async function generateContentDrafts(args: GenerateContentDraftsArgs): Promise<ContentDraft[]> {
  const aiDrafts = await generateWithOpenAi(args);
  if (aiDrafts?.length) return aiDrafts;
  return buildFallbackDrafts(args);
}
