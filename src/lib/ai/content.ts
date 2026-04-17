export type DraftAssetFormat = 'text' | 'link' | 'image' | 'multi_image' | 'video';
export type RequestedAssetFormat = DraftAssetFormat | 'auto';
export type FunnelStage = 'awareness' | 'consideration' | 'conversion';

export type CarouselSlide = {
  heading: string;
  body: string;
};

export type DraftAssetPlan = {
  format: DraftAssetFormat;
  visualBrief?: string;
  imagePrompt?: string;
  carouselTitle?: string;
  carouselSlides?: CarouselSlide[];
  videoHook?: string;
  assetChecklist?: string[];
};

export type ContentDraft = {
  title: string;
  body: string;
  hashtags: string[];
  titleHint: string;
  callToAction: string;
  postFormat: DraftAssetFormat;
  angle: string;
  funnelStage: FunnelStage;
  proofPoint: string;
  reasoning: string;
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
  postFormat?: RequestedAssetFormat | null;
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
const CTA_MAX_LENGTH = 160;
const HASHTAG_LIMIT = 6;
const MAX_DRAFT_COUNT = 12;

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
  const summary = compactWhitespace(firstSentence).replace(/^write\s+/i, '').replace(/^create\s+/i, '');

  if (!summary) {
    return 'Use a focused publishing workflow that turns sharp ideas into approved, scheduled, high-trust content without extra sprawl.';
  }

  return summary.length > 240 ? `${summary.slice(0, 237).trim()}...` : summary;
}

function summarizeSourceMaterial(sourceMaterial?: string | null) {
  const source = compactWhitespace(sourceMaterial ?? '');
  if (!source) return null;
  return trimTo(source, 260);
}

function fallbackTitle(args: GenerateContentDraftsArgs, index: number) {
  return trimTo(`${args.brandName} campaign draft ${index + 1}`, TITLE_MAX_LENGTH);
}

function stripMetaLines(body: string) {
  return body
    .split('\n')
    .filter((line) => !/^(tone|audience|title hint|format|platform|funnel stage|angle|proof point)\s*:/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeFormat(value?: string | null): RequestedAssetFormat {
  if (value === 'text' || value === 'link' || value === 'image' || value === 'multi_image' || value === 'video') {
    return value;
  }
  return 'auto';
}

function normalizeFinalFormat(value?: string | null): DraftAssetFormat {
  if (value === 'text' || value === 'link' || value === 'image' || value === 'multi_image' || value === 'video') {
    return value;
  }
  return 'text';
}

function normalizeFunnelStage(value?: string | null): FunnelStage {
  if (value === 'awareness' || value === 'consideration' || value === 'conversion') {
    return value;
  }
  return 'awareness';
}

function makeSlides(title: string, proofPoint: string, briefSummary: string) {
  return [
    { heading: title, body: 'A sharper point of view for the right buyer.' },
    { heading: 'The problem', body: briefSummary },
    { heading: 'Why it matters', body: proofPoint || 'The cost of vague messaging or loose workflow is delay, noise, and weaker commercial follow-up.' },
    { heading: 'What strong teams do', body: 'Use clearer positioning, tighter process, and stronger proof instead of publishing more generic content.' },
    { heading: 'Next step', body: 'Turn the idea into a credible, practical action the right buyer can respond to.' },
  ];
}

type CampaignStrategy = {
  draftNumber: number;
  angle: string;
  funnelStage: FunnelStage;
  postFormat: DraftAssetFormat;
  proofPoint: string;
  titleHint: string;
};

function chooseFormat(index: number, requestedFormat: RequestedAssetFormat): DraftAssetFormat {
  if (requestedFormat !== 'auto') return normalizeFinalFormat(requestedFormat);
  const rotation: DraftAssetFormat[] = ['text', 'multi_image', 'image', 'text', 'link', 'video'];
  return rotation[index % rotation.length] ?? 'text';
}

function buildCampaignStrategies(args: GenerateContentDraftsArgs): CampaignStrategy[] {
  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFT_COUNT));
  const requestedFormat = normalizeFormat(args.postFormat);
  const briefSummary = summarizeBrief(args.brief);
  const goal = args.commercialGoal?.trim() || 'generate qualified demand';
  const evidence = parseTextList(args.websiteEvidence).slice(0, 6);
  const proofPoints = unique([...parseTextList(args.proofPoints), ...evidence]).slice(0, 6);
  const fallbackProof = briefSummary;

  const anglePool = [
    'Contrarian point of view',
    'Practical checklist',
    'Proof-led lesson',
    'Buyer-objection reframing',
    'Operational insight',
    'Framework or model',
  ];

  const funnelPool: FunnelStage[] = ['awareness', 'consideration', 'conversion'];

  return Array.from({ length: count }, (_, index) => {
    const angle = anglePool[index % anglePool.length] ?? 'Operational insight';
    const funnelStage = funnelPool[index % funnelPool.length] ?? 'awareness';
    const postFormat = chooseFormat(index, requestedFormat);
    const proofPoint = proofPoints[index % Math.max(1, proofPoints.length)] || fallbackProof;
    return {
      draftNumber: index + 1,
      angle,
      funnelStage,
      postFormat,
      proofPoint,
      titleHint: trimTo(`${goal} · ${funnelStage} · ${postFormat.replace('_', ' ')} · ${angle}`, TITLE_HINT_MAX_LENGTH),
    };
  });
}

function normalizeAssetPlan(assetPlan: Partial<DraftAssetPlan> | null | undefined, fallbackFormat: DraftAssetFormat, fallbackTitle: string, proofPoint: string, briefSummary: string): DraftAssetPlan | null {
  const format = normalizeFinalFormat(assetPlan?.format ?? fallbackFormat);

  if (format === 'text') {
    return null;
  }

  const normalized: DraftAssetPlan = {
    format,
    visualBrief: trimTo(assetPlan?.visualBrief?.trim() || `${fallbackTitle} in a premium, high-trust B2B visual style.`, 300),
    imagePrompt: trimTo(assetPlan?.imagePrompt?.trim() || `${fallbackTitle}. Editorial, premium, LinkedIn-ready creative. Minimal clutter. Commercially credible.`, 400),
    assetChecklist: unique((assetPlan?.assetChecklist ?? []).map((item) => compactWhitespace(String(item ?? ''))).filter(Boolean)).slice(0, 5),
  };

  if (format === 'multi_image') {
    normalized.carouselTitle = trimTo(assetPlan?.carouselTitle?.trim() || fallbackTitle, 120);
    normalized.carouselSlides = (assetPlan?.carouselSlides?.length ? assetPlan.carouselSlides : makeSlides(fallbackTitle, proofPoint, briefSummary))
      .map((slide) => ({
        heading: trimTo(compactWhitespace(slide.heading), 90),
        body: trimTo(compactWhitespace(slide.body), 220),
      }))
      .slice(0, 8);
  }

  if (format === 'video') {
    normalized.videoHook = trimTo(compactWhitespace(assetPlan?.videoHook ?? fallbackTitle), 120);
  }

  return normalized;
}

function normalizeDraft(draft: Partial<ContentDraft> | null | undefined, args: GenerateContentDraftsArgs, index: number, strategy: CampaignStrategy): ContentDraft {
  const hashtags = unique([
    ...parseHashtags(args.hashtags),
    ...((draft?.hashtags ?? []).map((tag) => String(tag ?? '').replace(/^#/, '').trim()).filter(Boolean)),
  ]).slice(0, HASHTAG_LIMIT);

  const callToAction = trimTo(draft?.callToAction?.trim() || args.primaryCta?.trim() || 'Start a conversation.', CTA_MAX_LENGTH);
  const title = trimTo(draft?.title?.trim() || fallbackTitle(args, index), TITLE_MAX_LENGTH);
  const titleHint = trimTo(draft?.titleHint?.trim() || strategy.titleHint, TITLE_HINT_MAX_LENGTH);
  const postFormat = normalizeFinalFormat(draft?.postFormat ?? strategy.postFormat);
  const angle = trimTo(draft?.angle?.trim() || strategy.angle, 80);
  const funnelStage = normalizeFunnelStage(draft?.funnelStage ?? strategy.funnelStage);
  const proofPoint = trimTo(draft?.proofPoint?.trim() || strategy.proofPoint || summarizeBrief(args.brief), 240);
  const reasoning = trimTo(draft?.reasoning?.trim() || `Built for ${funnelStage} using a ${postFormat.replace('_', ' ')} format to make the angle feel distinct within the batch.`, 260);
  const briefSummary = summarizeBrief(args.brief);

  const rawBody = draft?.body?.trim();
  const body = trimTo(
    stripMetaLines(
      rawBody || [
        `${angle} for ${args.brandName}.`,
        '',
        briefSummary,
        '',
        proofPoint,
        '',
        callToAction,
        '',
        hashtags.map((tag) => `#${tag}`).join(' '),
      ].filter(Boolean).join('\n'),
    ),
    BODY_MAX_LENGTH,
  );

  const assetPlan = normalizeAssetPlan(draft?.assetPlan, postFormat, title, proofPoint, briefSummary);

  return {
    title,
    body,
    hashtags,
    titleHint,
    callToAction,
    postFormat,
    angle,
    funnelStage,
    proofPoint,
    reasoning,
    assetPlan,
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
  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFT_COUNT));
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
  if (text.includes('proposal')) return 'proposal-led';
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
  let score = 60;

  if (draft.postFormat === 'multi_image') {
    score += 4;
    reasons.push('Format creates stronger variation inside the batch');
  }

  if (insight.contentPattern === 'educational' && (title.includes('how') || body.includes('how '))) {
    score += 8;
    reasons.push('Matches recent educational pattern');
  }
  if (insight.contentPattern === 'contrarian' && (title.includes('mistake') || body.includes('most teams') || body.includes('what buyers'))) {
    score += 8;
    reasons.push('Matches recent contrarian pattern');
  }
  if (insight.contentPattern === 'proof-led' && (body.includes('proof') || body.includes('example') || body.includes('evidence'))) {
    score += 8;
    reasons.push('Matches recent proof-led pattern');
  }

  if (insight.callToActionPattern === 'demo-focused' && /demo|book/.test(body)) {
    score += 6;
    reasons.push('CTA aligns with recent commercial pattern');
  } else if (insight.callToActionPattern === 'reply-driven' && /reply|comment|message/.test(body)) {
    score += 6;
    reasons.push('CTA aligns with recent engagement pattern');
  } else if (insight.callToActionPattern === 'proposal-led' && /proposal|conversation/.test(body)) {
    score += 6;
    reasons.push('CTA aligns with proposal-led pattern');
  }

  const lengthDelta = Math.abs(draft.body.length - insight.averageBodyLength);
  if (lengthDelta <= 140) {
    score += 6;
    reasons.push('Body length is close to recent winners');
  } else if (lengthDelta > 300) {
    score -= 8;
    reasons.push('Body length is far from recent winners');
  }

  if (draft.hashtags.length <= 4) score += 2;
  if (draft.proofPoint) score += 4;

  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4), insight };
}

function assessComplianceRisk(args: GenerateContentDraftsArgs, draft: ContentDraft) {
  const text = `${draft.title}\n${draft.body}`.toLowerCase();
  const blockedTerms = parseTextList(args.blockedTerms).map((term) => term.toLowerCase());
  const complianceRules = parseTextList(args.complianceRules).map((rule) => rule.toLowerCase());
  const riskyClaims = ['guarantee', 'guaranteed', 'best', 'always', 'never', 'instant', 'effortless', 'revolutionary', 'market-leading'];

  const violations = [
    ...blockedTerms.filter((term) => term && text.includes(term)).map((term) => `Uses blocked term: ${term}`),
    ...riskyClaims.filter((term) => text.includes(term)).map((term) => `Contains absolute claim: ${term}`),
    ...complianceRules.filter((rule) => rule && text.includes(rule)).map((rule) => `Mentions restricted phrase: ${rule}`),
  ];

  return { level: violations.length >= 2 ? 'medium' : violations.length === 1 ? 'low' : 'none', notes: violations.slice(0, 4) };
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

function buildFallbackDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFT_COUNT));
  const hashtags = parseHashtags(args.hashtags);
  const cta = args.primaryCta?.trim() || 'Start a conversation.';
  const audience = args.audience?.trim() || 'ambitious teams';
  const goal = args.commercialGoal?.trim() || 'start more qualified buyer conversations';
  const cadence = args.cadence?.trim() || 'weekly';
  const preferredTimeOfDay = args.preferredTimeOfDay?.trim() || 'morning';
  const briefSummary = summarizeBrief(args.brief);
  const sourceSummary = summarizeSourceMaterial(args.sourceMaterial);
  const websiteSummary = args.websiteSummary?.trim() || '';
  const proofPoints = unique([...parseTextList(args.proofPoints), ...parseTextList(args.websiteEvidence)]).slice(0, 6);
  const strategies = buildCampaignStrategies({ ...args, count });
  const schedule = buildSuggestedSchedule({ ...args, count });

  return Array.from({ length: count }, (_, index) => {
    const strategy = strategies[index];
    const finalHashtags = unique([...hashtags, 'contentstrategy', 'contentops']).slice(0, HASHTAG_LIMIT);
    const proofPoint = strategy.proofPoint || proofPoints[index % Math.max(1, proofPoints.length)] || briefSummary;
    const slot = schedule[index];

    const opener = strategy.angle === 'Contrarian point of view'
      ? 'Most teams do not need more content. They need a stronger point of view and a cleaner operating system.'
      : strategy.angle === 'Practical checklist'
        ? 'A useful campaign usually gets stronger when you make the next decision easier for the buyer.'
        : strategy.angle === 'Proof-led lesson'
          ? 'Strong content is rarely the result of volume alone. It usually comes from sharper positioning and better proof.'
          : strategy.angle === 'Buyer-objection reframing'
            ? 'A lot of hesitation from buyers is not a budget problem. It is a trust problem.'
            : strategy.angle === 'Framework or model'
              ? 'Good campaigns get easier to run when the team can see the structure behind the message.'
              : 'The strongest social content usually comes from operational clarity, not last-minute inspiration.';

    const middle = [
      `For ${audience}, this campaign angle is about ${briefSummary}`,
      websiteSummary ? `Brand grounding: ${websiteSummary}` : '',
      sourceSummary ? `Source material to repurpose: ${sourceSummary}` : '',
      proofPoint ? `Proof or trust signal: ${proofPoint}` : '',
      `Recommended timing: ${slot.label} of a ${Math.max(1, Math.min(args.campaignWindowDays ?? 30, 180))}-day campaign.`,
    ].filter(Boolean).join(' ');

    const closer = strategy.funnelStage === 'conversion'
      ? `Use the post to create a commercially useful next step rather than chasing empty engagement. ${cta}`
      : strategy.funnelStage === 'consideration'
        ? 'Make the idea concrete enough that the right buyer can picture what better execution looks like.'
        : 'Give the audience a sharper frame they can carry into their next decision or meeting.';

    return normalizeDraft({
      title: `${args.brandName}: ${strategy.angle.toLowerCase()} for ${goal}`,
      titleHint: `${goal} · ${cadence} · ${preferredTimeOfDay} · ${strategy.funnelStage}`,
      callToAction: cta,
      hashtags: finalHashtags,
      postFormat: strategy.postFormat,
      angle: strategy.angle,
      funnelStage: strategy.funnelStage,
      proofPoint,
      reasoning: `Chosen as ${strategy.postFormat.replace('_', ' ')} to make this draft distinct inside the batch.`,
      assetPlan: strategy.postFormat === 'text' ? null : {
        format: strategy.postFormat,
        visualBrief: `${strategy.angle} for ${args.brandName} in a premium, editorial LinkedIn style.`,
        imagePrompt: `${args.brandName} ${strategy.angle.toLowerCase()}, premium B2B creative, trustworthy, minimal clutter, campaign-ready.`,
        carouselTitle: strategy.postFormat === 'multi_image' ? `${args.brandName}: ${strategy.angle}` : undefined,
        carouselSlides: strategy.postFormat === 'multi_image' ? makeSlides(`${args.brandName}: ${strategy.angle}`, proofPoint, briefSummary) : undefined,
        videoHook: strategy.postFormat === 'video' ? `${args.brandName}: ${strategy.angle}` : undefined,
        assetChecklist: ['Keep the opening visual clean', 'Make the proof point obvious', 'Match CTA to funnel stage'],
      },
      body: [
        opener,
        '',
        middle,
        '',
        closer,
        strategy.funnelStage !== 'conversion' ? '' : '',
        strategy.funnelStage !== 'conversion' ? cta : '',
        '',
        finalHashtags.map((tag) => `#${tag}`).join(' '),
      ].filter(Boolean).join('\n'),
    }, args, index, strategy);
  });
}

export function buildFallbackContentDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  return buildFallbackDrafts(args);
}

async function generateWithOpenAi(args: GenerateContentDraftsArgs): Promise<ContentDraft[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFT_COUNT));
  const model = process.env.OPENAI_CONTENT_MODEL?.trim() || 'gpt-4.1-mini';
  const strategies = buildCampaignStrategies({ ...args, count });
  const schedule = buildSuggestedSchedule({ ...args, count });
  const insight = derivePerformanceInsight(args.performanceContext);

  const prompt = [
    `You are a top-tier content strategist and creative director for ${args.brandName}.`,
    'Return strict JSON with the shape {"drafts":[{"title":"","body":"","hashtags":[""],"titleHint":"","callToAction":"","postFormat":"text","angle":"","funnelStage":"awareness","proofPoint":"","reasoning":"","assetPlan":{"format":"image","visualBrief":"","imagePrompt":"","carouselTitle":"","carouselSlides":[{"heading":"","body":""}],"videoHook":"","assetChecklist":[""]}}]}.',
    'Generate a true campaign batch, not near-duplicate posts.',
    'Each draft must differ in angle, hook, funnel stage, and structure.',
    'Use the selected brand context, website grounding, proof points, and commercial goal.',
    'If the preferred format is auto, choose the best format per draft. Use multi_image for checklist/framework ideas, image for quote/proof-led ideas, text for contrarian or authority-led ideas, and video only when the idea benefits from spoken delivery.',
    'When format is multi_image, provide a carouselTitle and 4-7 strong slides.',
    'When format is image or multi_image, include a visualBrief and imagePrompt.',
    'Avoid hype, empty motivational language, generic consulting phrasing, and repeated openings.',
    'Never include internal labels like Tone:, Audience:, Format:, Title Hint:, Platform:, or Funnel Stage: inside the body text.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? 'clear, sharp, commercially credible'}`,
    `Audience: ${args.audience ?? 'B2B teams'}`,
    `Primary CTA: ${args.primaryCta ?? ''}`,
    `Secondary CTA: ${args.secondaryCta ?? ''}`,
    `Hashtags: ${(args.hashtags ?? []).join(', ')}`,
    `Commercial goal: ${args.commercialGoal ?? ''}`,
    `Preferred format: ${normalizeFormat(args.postFormat)}`,
    `Planning cadence: ${args.cadence ?? 'weekly'}`,
    `Preferred time of day: ${args.preferredTimeOfDay ?? 'morning'}`,
    `Campaign window in days: ${Math.max(1, Math.min(args.campaignWindowDays ?? 30, 180))}`,
    `Target platforms: ${(args.targetPlatforms ?? ['linkedin']).join(', ')}`,
    `Source material: ${args.sourceMaterial ?? ''}`,
    `Website summary: ${args.websiteSummary ?? ''}`,
    `Website evidence: ${(args.websiteEvidence ?? []).join(' | ')}`,
    `Proof points: ${(args.proofPoints ?? []).join(' | ')}`,
    `Voice notes: ${args.voiceNotes ?? ''}`,
    `Blocked terms: ${(args.blockedTerms ?? []).join(', ')}`,
    `Compliance rules: ${(args.complianceRules ?? []).join(', ')}`,
    `What has worked recently: ${(args.performanceContext ?? []).join(' | ')}`,
    `Recent winner pattern: ${insight.contentPattern}`,
    `Recent CTA pattern: ${insight.callToActionPattern}`,
    `Approximate high-performing body length: ${insight.averageBodyLength}`,
    `Brief: ${args.brief}`,
    `Draft count: ${count}`,
    `Campaign plan: ${JSON.stringify(strategies.map((strategy, index) => ({
      draftNumber: strategy.draftNumber,
      angle: strategy.angle,
      funnelStage: strategy.funnelStage,
      recommendedFormat: strategy.postFormat,
      proofPoint: strategy.proofPoint,
      suggestedSlot: schedule[index]?.label ?? `Day ${index + 1}`,
    })))}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'repurly_top_tier_content_drafts',
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
                      postFormat: { type: 'string', enum: ['text', 'link', 'image', 'multi_image', 'video'] },
                      angle: { type: 'string' },
                      funnelStage: { type: 'string', enum: ['awareness', 'consideration', 'conversion'] },
                      proofPoint: { type: 'string' },
                      reasoning: { type: 'string' },
                      assetPlan: {
                        anyOf: [
                          { type: 'null' },
                          {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              format: { type: 'string', enum: ['text', 'link', 'image', 'multi_image', 'video'] },
                              visualBrief: { type: 'string' },
                              imagePrompt: { type: 'string' },
                              carouselTitle: { type: 'string' },
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
                              videoHook: { type: 'string' },
                              assetChecklist: { type: 'array', items: { type: 'string' } },
                            },
                            required: ['format', 'visualBrief', 'imagePrompt', 'carouselTitle', 'carouselSlides', 'videoHook', 'assetChecklist'],
                          },
                        ],
                      },
                    },
                    required: ['title', 'body', 'hashtags', 'titleHint', 'callToAction', 'postFormat', 'angle', 'funnelStage', 'proofPoint', 'reasoning', 'assetPlan'],
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

    return parsed.drafts.slice(0, count).map((draft, index) => normalizeDraft(draft, args, index, strategies[index] ?? buildCampaignStrategies(args)[index] ?? buildCampaignStrategies({ ...args, count: index + 1 })[index]));
  } catch {
    return null;
  }
}

export async function generateContentDrafts(args: GenerateContentDraftsArgs): Promise<ContentDraft[]> {
  const aiDrafts = await generateWithOpenAi(args);
  if (aiDrafts?.length) return aiDrafts;
  return buildFallbackDrafts(args);
}
