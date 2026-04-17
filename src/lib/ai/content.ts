export type DraftAssetFormat = 'text' | 'link' | 'image' | 'multi_image' | 'video';
export type RequestedAssetFormat = DraftAssetFormat | 'auto';

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

  const summary = compactWhitespace(normalized)
    .replace(/^write\s+/i, '')
    .replace(/^create\s+/i, '');

  if (!summary) {
    return 'Turn a strong brief into clear, useful, trust-building social posts.';
  }

  return trimTo(summary, 220);
}

function summarizeSourceMaterial(sourceMaterial?: string | null) {
  const source = compactWhitespace(sourceMaterial ?? '');
  if (!source) return null;
  return trimTo(source, 220);
}

function inferBrandDomain(args: GenerateContentDraftsArgs) {
  const joined = [
    args.brandName,
    args.brief,
    args.audience,
    args.websiteSummary,
    summarizeSourceMaterial(args.sourceMaterial),
    ...(args.websiteEvidence ?? []),
    ...(args.proofPoints ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(governance|audit|assurance|risk|board|regulat|public sector|operational insight|analytics|transformation|ai adoption|data governance|accountability)/.test(joined)) {
    return 'governance';
  }

  if (/(linkedin|content|campaign|publishing|social|demand gen|lead gen|creator|posting)/.test(joined)) {
    return 'content';
  }

  return 'general';
}

function normalizeRequestedFormat(value?: string | null): RequestedAssetFormat {
  return value === 'text' || value === 'link' || value === 'image' || value === 'multi_image' || value === 'video'
    ? value
    : 'auto';
}

function fallbackTitle(args: GenerateContentDraftsArgs, index: number) {
  return trimTo(`${args.brandName} post ${index + 1}`, TITLE_MAX_LENGTH);
}

function stripPlanningLeakage(body: string) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(tone|audience|title hint|format|platform|brand grounding|source material to repurpose|proof or trust signal|recommended timing|campaign angle|funnel stage|reasoning)\s*:/i.test(line))
    .filter((line) => !/(three linkedin posts for|selected examples of the work|one useful trust signal is this|use this source material|source material to repurpose|recommended timing|campaign angle)/i.test(line))
    .join('\n\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMetaFromInlineText(body: string) {
  return body
    .replace(/\bFor\s+[^.\n]{0,240},\s*this campaign angle is about\s+/gi, '')
    .replace(/\bBrand grounding:\s*/gi, '')
    .replace(/\bSource material to repurpose:\s*/gi, '')
    .replace(/\bUse this source material as supporting context:\s*/gi, '')
    .replace(/\bProof or trust signal:\s*/gi, '')
    .replace(/\bOne useful trust signal is this:\s*/gi, '')
    .replace(/\bRecommended timing:\s*Day\s*\d+[^.\n]*\.?/gi, '')
    .replace(/\bthree LinkedIn posts for\s+[^.\n]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function containsPlanningLeakage(body: string) {
  return /(three linkedin posts for|brand grounding|selected examples of the work|one useful trust signal is this|use this source material|source material to repurpose|recommended timing|campaign angle)/i.test(body);
}

function containsContentOpsLeakage(body: string) {
  return /(content problem|workflow problem|content system|publishing like an operational process|lead follow-up|more posts|brief, approve, and publish|posting everywhere|content operations?)/i.test(body);
}

function cleanDraftBody(body: string, args: GenerateContentDraftsArgs) {
  const domain = inferBrandDomain(args);
  const cleaned = trimTo(
    stripMetaFromInlineText(stripPlanningLeakage(body)),
    BODY_MAX_LENGTH,
  );

  if (containsPlanningLeakage(cleaned)) return '';
  if (domain === 'governance' && containsContentOpsLeakage(cleaned)) return '';
  return cleaned;
}

function normalizeDraft(draft: Partial<ContentDraft> | null | undefined, args: GenerateContentDraftsArgs, index: number): ContentDraft {
  const hashtags = unique([
    ...parseHashtags(args.hashtags),
    ...((draft?.hashtags ?? []).map((tag) => String(tag ?? '').replace(/^#/, '').trim()).filter(Boolean)),
  ]).slice(0, HASHTAG_LIMIT);

  const callToAction = trimTo(
    draft?.callToAction?.trim() || args.primaryCta?.trim() || 'Start a conversation.',
    CTA_MAX_LENGTH,
  );

  const title = trimTo(
    draft?.title?.trim() || fallbackTitle(args, index),
    TITLE_MAX_LENGTH,
  );

  const requestedFormat = normalizeRequestedFormat(args.postFormat);
  const finalFormat = requestedFormat === 'auto' ? 'text' : requestedFormat;

  const titleHint = trimTo(
    draft?.titleHint?.trim() || `${(args.commercialGoal || 'Drive qualified action').trim()} (${finalFormat})`,
    TITLE_HINT_MAX_LENGTH,
  );

  const bodyCandidate = cleanDraftBody(draft?.body?.trim() || '', args);
  const body = bodyCandidate || '';

  return {
    title,
    body,
    hashtags,
    titleHint,
    callToAction,
    postFormat: finalFormat,
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

function buildFallbackDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFTS));
  const hashtags = parseHashtags(args.hashtags);
  const cta = args.primaryCta?.trim() || 'Start a conversation.';
  const audience = args.audience?.trim() || 'ambitious teams';
  const goal = args.commercialGoal?.trim() || 'start more qualified buyer conversations';
  const format = normalizeRequestedFormat(args.postFormat) === 'auto' ? 'text' : normalizeRequestedFormat(args.postFormat);
  const cadence = args.cadence?.trim() || 'weekly';
  const preferredTimeOfDay = args.preferredTimeOfDay?.trim() || 'morning';
  const briefSummary = summarizeBrief(args.brief);
  const sourceSummary = summarizeSourceMaterial(args.sourceMaterial);
  const websiteSummary = compactWhitespace(args.websiteSummary ?? '');
  const proofPoints = unique([...parseTextList(args.proofPoints), ...parseTextList(args.websiteEvidence)]).slice(0, HASHTAG_LIMIT);
  const domain = inferBrandDomain(args);

  const governancePatterns = [
    {
      title: `${args.brandName}: safer AI adoption starts with clearer accountability`,
      opener: 'Safer AI adoption is rarely blocked by ambition. It is blocked by weak governance, unclear accountability, and poor operational visibility.',
      middle: `Leaders in complex environments usually do not need more activity. They need a decision structure that makes risk, ownership, and delivery clearer. ${briefSummary}`,
      closer: 'The stronger move is to make the decision sharper before the work scales.',
    },
    {
      title: `${args.brandName}: governance gets easier when the operating picture is clearer`,
      opener: 'A lot of governance pressure is really a visibility problem.',
      middle: `When leaders cannot see where accountability sits, where risk is building, or where delivery is drifting, assurance gets harder and decisions get slower. ${briefSummary}`,
      closer: 'Better governance often starts with clearer operational sightlines, not bigger policy decks.',
    },
    {
      title: `${args.brandName}: practical delivery is a trust signal`,
      opener: 'In high-accountability organisations, credibility is built through practical delivery, not confident language.',
      middle: `What matters is whether decisions, controls, and delivery can stand up to scrutiny when the pressure rises. ${briefSummary}`,
      closer: 'That is why strong delivery is as much a trust issue as it is an execution issue.',
    },
  ];

  const contentPatterns = [
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
      title: `${args.brandName}: proof-driven post idea`,
      opener: 'One of the fastest ways to improve content performance is to reduce workflow drag before you increase volume.',
      middle: `Less time lost in approvals means more time refining the message. ${briefSummary}`,
      closer: 'Teams that treat publishing like an operational process usually outperform teams that treat it like ad hoc posting.',
    },
  ];

  const generalPatterns = [
    {
      title: `${args.brandName}: a sharper point of view for ${audience}`,
      opener: 'The strongest positioning usually makes the next decision easier for the buyer.',
      middle: `${briefSummary}`,
      closer: 'Clarity matters because it reduces hesitation before the commercial conversation starts.',
    },
    {
      title: `${args.brandName}: trust is usually built through specificity`,
      opener: 'Generic confidence rarely earns trust. Specific thinking does.',
      middle: `${briefSummary}`,
      closer: 'The sharper the frame, the easier it is for the right buyer to recognise the value.',
    },
    {
      title: `${args.brandName}: practical clarity beats vague ambition`,
      opener: 'Strong offers tend to convert better when the practical value is easy to see.',
      middle: `${briefSummary}`,
      closer: 'A useful next step is often more persuasive than a louder claim.',
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
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    return {
      title: trimTo(pattern.title, TITLE_MAX_LENGTH),
      body: trimTo(cleanDraftBody(body, args), BODY_MAX_LENGTH),
      hashtags: finalHashtags,
      titleHint: trimTo(`${goal} · ${cadence} · ${preferredTimeOfDay} (${format})`, TITLE_HINT_MAX_LENGTH),
      callToAction: trimTo(cta, CTA_MAX_LENGTH),
      postFormat: format,
    };
  });
}

export function buildFallbackContentDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  return buildFallbackDrafts(args);
}

async function generateWithOpenAi(args: GenerateContentDraftsArgs): Promise<ContentDraft[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const count = Math.max(1, Math.min(args.count ?? 3, MAX_DRAFTS));
  const prompt = [
    `You are writing LinkedIn-first B2B posts for ${args.brandName}.`,
    'Return strict JSON with the shape {"drafts":[{"title":"","body":"","hashtags":[""],"titleHint":"","callToAction":""}]}.',
    'Keep the tone commercially realistic and avoid hype.',
    'Write natural LinkedIn prose only.',
    'Do not paste the brief, audience description, website summary, source material, or proof points verbatim into the post body.',
    'Do not include internal planning language or labels in the post body.',
    'Never output phrases such as: brand grounding, source material, proof or trust signal, recommended timing, campaign angle, selected examples of the work, or three LinkedIn posts for.',
    'Never include internal labels like Tone:, Audience:, Format:, or Title Hint: inside the post body.',
    'Turn the brief into original post copy with a strong opening line, 2-4 short body paragraphs, and a concise CTA.',
    'If supporting context is provided, use it as background knowledge only and rewrite it into clean prose.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? 'clear, sharp, commercially realistic'}`,
    `Audience: ${args.audience ?? 'B2B teams'}`,
    `Voice notes: ${args.voiceNotes ?? ''}`,
    `Primary CTA: ${args.primaryCta ?? ''}`,
    `Secondary CTA: ${args.secondaryCta ?? ''}`,
    `Hashtags: ${(args.hashtags ?? []).join(', ')}`,
    `Commercial goal: ${args.commercialGoal ?? ''}`,
    `Preferred format: ${normalizeRequestedFormat(args.postFormat)}`,
    `Planning cadence: ${args.cadence ?? 'weekly'}`,
    `Preferred time of day: ${args.preferredTimeOfDay ?? 'morning'}`,
    `Website summary: ${args.websiteSummary ?? ''}`,
    `Proof points: ${(args.proofPoints ?? []).join(' | ')}`,
    `Website evidence: ${(args.websiteEvidence ?? []).join(' | ')}`,
    `Source material: ${summarizeSourceMaterial(args.sourceMaterial) ?? ''}`,
    `Blocked terms: ${(args.blockedTerms ?? []).join(', ')}`,
    `Compliance rules: ${(args.complianceRules ?? []).join(', ')}`,
    `Brief: ${args.brief}`,
    `Draft count: ${count}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CONTENT_MODEL?.trim() || 'gpt-4.1-mini',
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

    const normalized = parsed.drafts
      .slice(0, count)
      .map((draft, index) => normalizeDraft(draft, args, index))
      .filter((draft) => draft.body.length > 0);

    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

export async function generateContentDrafts(args: GenerateContentDraftsArgs): Promise<ContentDraft[]> {
  const aiDrafts = await generateWithOpenAi(args);
  if (aiDrafts?.length) return aiDrafts;
  return buildFallbackDrafts(args);
}
