export type DraftAssetFormat = 'text' | 'link' | 'image' | 'multi_image' | 'video';
export type RequestedAssetFormat = DraftAssetFormat | 'auto';

export type DraftAssetPlan = {
  recommendedFormat: DraftAssetFormat;
  rationale: string;
  imagePrompt?: string;
  visualBrief?: string;
  carouselSlides?: Array<{ heading: string; body: string }>;
  videoHook?: string;
};

export type ContentDraft = {
  title: string;
  body: string;
  hashtags: string[];
  titleHint: string;
  callToAction: string;
  postFormat?: DraftAssetFormat;
  angle?: string;
  funnelStage?: 'awareness' | 'consideration' | 'conversion';
  proofPoint?: string;
  reasoning?: string;
  assetPlan?: DraftAssetPlan | null;
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
  postFormat?: RequestedAssetFormat | string | null;
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
  websiteSummary?: string | null;
  websiteEvidence?: string[] | null;
  proofPoints?: string[] | null;
};

const TITLE_MAX_LENGTH = 150;
const BODY_MAX_LENGTH = 5000;
const TITLE_HINT_MAX_LENGTH = 140;
const CTA_MAX_LENGTH = 140;
const HASHTAG_LIMIT = 6;
const MAX_DRAFTS = 6;

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function trimTo(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function parseHashtags(input?: string[] | null) {
  return unique((input ?? []).map((item) => item.replace(/^#/, '').trim()).filter(Boolean));
}

function parseTextList(input?: string[] | null) {
  return unique((input ?? []).map((item) => compactWhitespace(String(item ?? ''))).filter(Boolean));
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
  const summary = compactWhitespace(firstSentence)
    .replace(/^write\s+/i, '')
    .replace(/^create\s+/i, '');

  if (!summary) {
    return 'Use a clear, specific point of view that helps the right buyer make a sharper decision.';
  }

  return summary.length > 220 ? `${summary.slice(0, 217).trim()}...` : summary;
}

function summarizeSupportContext(input?: string | null, maxLength = 220) {
  const source = compactWhitespace(String(input ?? ''));
  if (!source) return null;
  return trimTo(
    source
      .replace(/selected examples of the work/gi, '')
      .replace(/use this source material as supporting context/gi, '')
      .replace(/one useful trust signal is this/gi, '')
      .replace(/source material to repurpose/gi, ''),
    maxLength,
  );
}

function normalizeRequestedFormat(value?: string | null): RequestedAssetFormat {
  const normalized = compactWhitespace(String(value ?? '')).toLowerCase();
  if (normalized === 'text' || normalized === 'link' || normalized === 'image' || normalized === 'multi_image' || normalized === 'video' || normalized === 'auto') {
    return normalized;
  }
  return 'auto';
}

function resolveDraftFormat(requested: RequestedAssetFormat, angle: string): DraftAssetFormat {
  if (requested !== 'auto') return requested;
  const lower = angle.toLowerCase();
  if (lower.includes('framework') || lower.includes('checklist')) return 'multi_image';
  if (lower.includes('proof') || lower.includes('case')) return 'image';
  return 'text';
}

function detectDomain(args: GenerateContentDraftsArgs) {
  const haystack = [
    args.brandName,
    args.audience,
    args.brief,
    args.websiteSummary,
    ...(args.websiteEvidence ?? []),
    ...(args.proofPoints ?? []),
    args.sourceMaterial,
    args.voiceNotes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/governance|assurance|audit|risk|accountability|public sector|regulated|board scrutiny|operational insight|ai adoption/.test(haystack)) {
    return 'governance';
  }
  if (/content|linkedin|publishing|campaign|demand gen|content ops/.test(haystack)) {
    return 'content';
  }
  return 'general';
}

function stripPlanningLeakage(body: string) {
  const bannedFragments = [
    'three linkedin posts for',
    'brand grounding',
    'selected examples of the work',
    'one useful trust signal is this',
    'use this source material',
    'source material to repurpose',
    'recommended timing',
    'proof or trust signal',
    'campaign angle',
    'funnel stage',
    'reasoning:',
  ];

  return body
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase();
      return !bannedFragments.some((fragment) => lower.includes(fragment));
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fallbackTitle(args: GenerateContentDraftsArgs, index: number) {
  return trimTo(`${args.brandName} campaign draft ${index + 1}`, TITLE_MAX_LENGTH);
}

function normalizeDraft(draft: Partial<ContentDraft> | null | undefined, args: GenerateContentDraftsArgs, index: number): ContentDraft {
  const hashtags = unique([
    ...parseHashtags(args.hashtags),
    ...((draft?.hashtags ?? []).map((tag) => String(tag ?? '').replace(/^#/, '').trim()).filter(Boolean)),
  ]).slice(0, HASHTAG_LIMIT);

  const requestedFormat = normalizeRequestedFormat(args.postFormat);
  const draftFormat = resolveDraftFormat(requestedFormat, draft?.angle || draft?.title || '');
  const callToAction = trimTo(draft?.callToAction?.trim() || args.primaryCta?.trim() || 'Request a proposal.', CTA_MAX_LENGTH);
  const title = trimTo(draft?.title?.trim() || fallbackTitle(args, index), TITLE_MAX_LENGTH);
  const titleHint = trimTo(
    draft?.titleHint?.trim() || `${(args.commercialGoal || 'Drive qualified action').trim()} · ${draftFormat}`,
    TITLE_HINT_MAX_LENGTH,
  );

  const rawBody = draft?.body?.trim();
  const cleanedBody = stripPlanningLeakage(rawBody || '');
  const body = trimTo(
    cleanedBody || [
      'Clearer decisions usually start with clearer framing.',
      '',
      summarizeBrief(args.brief),
      '',
      callToAction,
      '',
      hashtags.map((tag) => `#${tag}`).join(' '),
    ].filter(Boolean).join('\n'),
    BODY_MAX_LENGTH,
  );

  return {
    title,
    body,
    hashtags,
    titleHint,
    callToAction,
   postFormat: draft?.postFormat ?? draftFormat,
angle: draft?.angle,
funnelStage: draft?.funnelStage,
proofPoint: draft?.proofPoint,
reasoning: draft?.reasoning,
assetPlan: draft?.assetPlan ?? null,
  };
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

export function buildSuggestedSchedule(args: GenerateContentDraftsArgs): GeneratedScheduleSlot[] {
  const count = Math.max(1, Math.min(args.count ?? 3, 30));
  const campaignWindowDays = Math.max(1, Math.min(args.campaignWindowDays ?? 21, 180));
  const interval = count <= 1 ? 0 : Math.max(1, Math.floor(campaignWindowDays / Math.max(count - 1, 1)));
  return Array.from({ length: count }, (_, index) => {
    const dayOffset = Math.min(campaignWindowDays - 1, index * interval);
    return { draftNumber: index + 1, dayOffset, label: dayOffset === 0 ? 'Day 1' : `Day ${dayOffset + 1}` };
  });
}

function inferPreferredCta(performanceContext: string[]) {
  const text = performanceContext.join(' ').toLowerCase();
  if (text.includes('proposal')) return 'proposal-focused';
  if (text.includes('demo')) return 'demo-focused';
  if (text.includes('download')) return 'download-led';
  if (text.includes('reply')) return 'reply-driven';
  return 'soft-commercial';
}

function inferContentPattern(performanceContext: string[]) {
  const joined = performanceContext.join(' ').toLowerCase();
  if (joined.includes('checklist') || joined.includes('framework')) return 'framework';
  if (joined.includes('proof') || joined.includes('case')) return 'proof-led';
  if (joined.includes('mistake') || joined.includes('lesson')) return 'contrarian';
  return 'insight';
}

export function derivePerformanceInsight(performanceContext?: string[] | null): PerformanceInsight {
  const recentExamples = (performanceContext ?? []).filter(Boolean).slice(0, 5);
  const averageBodyLength = recentExamples.length
    ? Math.round(recentExamples.reduce((total, item) => total + item.length, 0) / recentExamples.length)
    : 260;

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
  let score = 62;
  if (insight.contentPattern === 'framework' && (title.includes('framework') || body.includes('checklist'))) {
    score += 8; reasons.push('Matches recent framework pattern');
  }
  if (insight.contentPattern === 'proof-led' && (body.includes('example') || body.includes('evidence') || body.includes('proof'))) {
    score += 8; reasons.push('Matches recent proof-led pattern');
  }
  if (insight.callToActionPattern === 'proposal-focused' && /proposal/.test(body)) {
    score += 6; reasons.push('CTA aligns with recent commercial pattern');
  }
  const lengthDelta = Math.abs(draft.body.length - insight.averageBodyLength);
  if (lengthDelta <= 120) { score += 6; reasons.push('Body length is close to recent winners'); }
  else if (lengthDelta > 260) { score -= 8; reasons.push('Body length is far from recent winners'); }
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

function buildFallbackAssetPlan(format: DraftAssetFormat, proofPoint?: string): DraftAssetPlan {
  if (format === 'multi_image') {
    return {
      recommendedFormat: format,
      rationale: 'A checklist or framework is easier to scan as a carousel.',
      carouselSlides: [
        { heading: 'The problem', body: 'Where weak governance or unclear positioning creates risk or hesitation.' },
        { heading: 'The sharper frame', body: proofPoint || 'A clearer way to structure the issue and next step.' },
        { heading: 'What to do next', body: 'Give the reader a practical action or decision lens.' },
      ],
      visualBrief: 'Clean, premium carousel with strong headings and minimal text.',
    };
  }
  if (format === 'image') {
    return {
      recommendedFormat: format,
      rationale: 'Proof-led or quote-led ideas work well as a single image with a strong caption.',
      imagePrompt: proofPoint || 'Create a clean, premium editorial graphic reflecting clarity, trust, and governance.',
      visualBrief: 'High-trust, senior, minimal visual with strong typography.',
    };
  }
  if (format === 'video') {
    return {
      recommendedFormat: format,
      rationale: 'A sharper point of view can work as a short talking-head or narrated explainer.',
      videoHook: 'Start with the core tension or misconception in one sentence.',
      visualBrief: 'Founder-led, direct-to-camera, calm authority.',
    };
  }
  return {
    recommendedFormat: format,
    rationale: 'This idea is strong enough to work as a text-led LinkedIn post.',
    visualBrief: 'No supporting asset required.',
  };
}

function buildFallbackDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFTS));
  const hashtags = parseHashtags(args.hashtags);
  const cta = args.primaryCta?.trim() || 'Request a proposal.';
  const audience = args.audience?.trim() || 'senior decision-makers';
  const goal = args.commercialGoal?.trim() || 'start more qualified buyer conversations';
  const cadence = args.cadence?.trim() || 'weekly';
  const preferredTimeOfDay = args.preferredTimeOfDay?.trim() || 'morning';
  const briefSummary = summarizeBrief(args.brief);
  const sourceSummary = summarizeSupportContext(args.sourceMaterial);
  const websiteSummary = summarizeSupportContext(args.websiteSummary);
  const proofPoints = parseTextList(args.proofPoints).concat(parseTextList(args.websiteEvidence));
  const domain = detectDomain(args);
  const requestedFormat = normalizeRequestedFormat(args.postFormat);

  const governancePatterns = [
    {
      title: `${args.brandName}: safer AI adoption starts before scale`,
      opener: 'Safer AI adoption is rarely blocked by ambition. It is usually blocked by weak governance, unclear accountability, and poor operational visibility.',
      middle: briefSummary,
      closer: 'The stronger move is to make the decision sharper before the work scales.',
      angle: 'governance-first AI adoption',
      funnelStage: 'awareness' as const,
      format: resolveDraftFormat(requestedFormat, 'insight'),
    },
    {
      title: `${args.brandName}: clearer governance makes better delivery possible`,
      opener: 'Good delivery often depends on clearer ownership, sharper controls, and fewer assumptions hidden in the work.',
      middle: briefSummary,
      closer: 'Teams move faster when the accountability model is understood before the pressure rises.',
      angle: 'practical governance framework',
      funnelStage: 'consideration' as const,
      format: resolveDraftFormat(requestedFormat, 'framework checklist'),
    },
    {
      title: `${args.brandName}: trust is built when decisions can stand up to scrutiny`,
      opener: 'In complex organisations, trust is not created by louder claims. It is created by decisions, controls, and delivery that hold up under scrutiny.',
      middle: briefSummary,
      closer: 'That is often the difference between movement and rework.',
      angle: 'commercial trust through operational clarity',
      funnelStage: 'conversion' as const,
      format: resolveDraftFormat(requestedFormat, 'proof case'),
    },
  ];

  const contentPatterns = [
    {
      title: `${args.brandName}: stronger positioning beats more volume`,
      opener: 'Most teams do not need more output. They need a sharper point of view.',
      middle: briefSummary,
      closer: 'Clarity creates better conversations before scale does.',
      angle: 'positioning over volume',
      funnelStage: 'awareness' as const,
      format: resolveDraftFormat(requestedFormat, 'insight'),
    },
  ];

  const generalPatterns = [
    {
      title: `${args.brandName}: clarity is often the commercial advantage`,
      opener: 'Clearer thinking usually creates stronger commercial momentum than louder messaging.',
      middle: briefSummary,
      closer: 'The sharper the frame, the easier it is for the right buyer to move.',
      angle: 'clarity as advantage',
      funnelStage: 'awareness' as const,
      format: resolveDraftFormat(requestedFormat, 'insight'),
    },
    {
      title: `${args.brandName}: specificity builds trust faster than broad claims`,
      opener: 'Generic confidence rarely earns trust. Specific thinking does.',
      middle: briefSummary,
      closer: 'Useful detail is often what makes the next conversation possible.',
      angle: 'specificity builds trust',
      funnelStage: 'consideration' as const,
      format: resolveDraftFormat(requestedFormat, 'proof'),
    },
  ];

  const patterns = domain === 'governance' ? governancePatterns : domain === 'content' ? contentPatterns : generalPatterns;

  return Array.from({ length: count }, (_, index) => {
    const pattern = patterns[index % patterns.length];
    const finalHashtags = unique(hashtags).slice(0, HASHTAG_LIMIT);
    const proofPoint = proofPoints[index % Math.max(1, proofPoints.length)] || websiteSummary || sourceSummary || briefSummary;
    const body = [
      pattern.opener,
      '',
      pattern.middle,
      proofPoint ? `\n${proofPoint}` : '',
      '',
      pattern.closer,
      '',
      cta,
      '',
      finalHashtags.map((tag) => `#${tag}`).join(' '),
    ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');

    return normalizeDraft({
      title: pattern.title,
      body,
      hashtags: finalHashtags,
      titleHint: `${goal} · ${cadence} · ${preferredTimeOfDay} (${pattern.format})`,
      callToAction: cta,
      postFormat: pattern.format,
      angle: pattern.angle,
      funnelStage: pattern.funnelStage,
      proofPoint,
      reasoning: `Uses a ${pattern.funnelStage} angle with a ${pattern.format} recommendation based on the campaign brief and available trust signals.`,
      assetPlan: buildFallbackAssetPlan(pattern.format, proofPoint),
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
  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFTS));
  const model = process.env.OPENAI_CONTENT_MODEL?.trim() || 'gpt-4.1-mini';
  const briefSummary = summarizeBrief(args.brief);
  const websiteSummary = summarizeSupportContext(args.websiteSummary);
  const sourceSummary = summarizeSupportContext(args.sourceMaterial);
  const proofPoints = parseTextList(args.proofPoints).concat(parseTextList(args.websiteEvidence)).slice(0, 5);

  const prompt = [
    `You are writing high-quality social content for ${args.brandName}.`,
    'Return strict JSON with the shape {"drafts":[{"title":"","body":"","hashtags":[""],"titleHint":"","callToAction":"","postFormat":"text","angle":"","funnelStage":"awareness","proofPoint":"","reasoning":"","assetPlan":{"recommendedFormat":"text","rationale":""}}]}.',
    'Keep the tone clear, commercially credible, senior, and natural.',
    'Do not paste the brief verbatim into the post body.',
    'Do not include internal planning labels or phrases such as: source material, trust signal, campaign angle, recommended timing, selected examples, or brand grounding.',
    'Use support context only as background knowledge.',
    'Write in natural prose with a strong opening, 2-4 short body paragraphs, and a concise CTA.',
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
    `Preferred format: ${normalizeRequestedFormat(args.postFormat)}`,
    `Planning cadence: ${args.cadence ?? 'weekly'}`,
    `Preferred time of day: ${args.preferredTimeOfDay ?? 'morning'}`,
    `Campaign window in days: ${Math.max(1, Math.min(args.campaignWindowDays ?? 21, 180))}`,
    `Target platforms: ${(args.targetPlatforms ?? ['linkedin']).join(', ')}`,
    `Brief summary: ${briefSummary}`,
    `Website summary: ${websiteSummary ?? ''}`,
    `Source summary: ${sourceSummary ?? ''}`,
    `Proof points: ${proofPoints.join(' | ')}`,
    `Recent performance context: ${(args.performanceContext ?? []).join(' | ')}`,
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
                      postFormat: { type: 'string' },
                      angle: { type: 'string' },
                      funnelStage: { type: 'string' },
                      proofPoint: { type: 'string' },
                      reasoning: { type: 'string' },
                      assetPlan: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          recommendedFormat: { type: 'string' },
                          rationale: { type: 'string' },
                          imagePrompt: { type: 'string' },
                          visualBrief: { type: 'string' },
                          videoHook: { type: 'string' },
                          carouselSlides: {
                            type: 'array',
                            items: {
                              type: 'object',
                              additionalProperties: false,
                              properties: {
                                heading: { type: 'string' },
                                body: { type: 'string' },
                              },
                              required: ['heading', 'body'],
                            },
                          },
                        },
                        required: ['recommendedFormat', 'rationale'],
                      },
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
