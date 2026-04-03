export type ContentDraft = {
  title: string;
  body: string;
  hashtags: string[];
  titleHint: string;
  callToAction: string;
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
  count?: number;
};

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function parseHashtags(input?: string[] | null) {
  return unique((input ?? []).map((item) => item.replace(/^#/, '').trim()).filter(Boolean));
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, ' ').trim();
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
    return 'Use a narrow, reliable LinkedIn workflow that gets good posts approved and published without extra tool sprawl.';
  }

  return summary.length > 220 ? `${summary.slice(0, 217).trim()}...` : summary;
}

function buildFallbackDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  const count = Math.max(1, Math.min(args.count ?? 3, 6));
  const hashtags = parseHashtags(args.hashtags);
  const cta = args.primaryCta?.trim() || 'Book a pilot demo.';
  const tone = args.brandTone?.trim() || 'clear, sharp, commercially realistic';
  const audience = args.audience?.trim() || 'B2B marketing and operations teams';
  const goal = args.commercialGoal?.trim() || 'start more qualified buyer conversations';
  const format = args.postFormat?.trim() || 'text';
  const briefSummary = summarizeBrief(args.brief);

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
      opener: 'One of the fastest ways to improve LinkedIn performance is to reduce workflow drag before you increase volume.',
      middle: `Less time lost in approvals means more time refining the message. ${briefSummary}`,
      closer: 'Teams that treat publishing like an operational process usually outperform teams that treat it like ad hoc posting.',
    },
  ];

  return Array.from({ length: count }, (_, index) => {
    const pattern = patterns[index % patterns.length];
    const finalHashtags = unique(['linkedin', 'b2bmarketing', ...hashtags]).slice(0, 5);
    return {
      title: pattern.title,
      titleHint: `${goal} (${format})`,
      callToAction: cta,
      hashtags: finalHashtags,
      body: [
        pattern.opener,
        '',
        pattern.middle,
        '',
        pattern.closer,
        '',
        `Tone: ${tone}.`,
        cta,
        '',
        finalHashtags.map((tag) => `#${tag}`).join(' '),
      ].join('\n'),
    };
  });
}

async function generateWithOpenAi(args: GenerateContentDraftsArgs): Promise<ContentDraft[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const count = Math.max(1, Math.min(args.count ?? 3, 6));
  const prompt = [
    'You are writing LinkedIn-first B2B posts for Repurly.',
    'Return strict JSON with the shape {"drafts":[{"title":"","body":"","hashtags":[""],"titleHint":"","callToAction":""}]}',
    'Keep the tone commercially realistic and avoid hype.',
    'Do not paste the brief verbatim into the post body.',
    'Turn the brief into original post copy with a clean opening line, 2-4 short body paragraphs, and a concise CTA.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? 'clear, sharp, commercially realistic'}`,
    `Audience: ${args.audience ?? 'B2B teams'}`,
    `Primary CTA: ${args.primaryCta ?? ''}`,
    `Secondary CTA: ${args.secondaryCta ?? ''}`,
    `Hashtags: ${(args.hashtags ?? []).join(', ')}`,
    `Commercial goal: ${args.commercialGoal ?? ''}`,
    `Preferred format: ${args.postFormat ?? 'text'}`,
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
        model: 'gpt-4.1-mini',
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
    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) return null;
    const parsed = JSON.parse(payload.output_text) as { drafts?: ContentDraft[] };
    if (!parsed.drafts?.length) return null;
    return parsed.drafts.slice(0, count);
  } catch {
    return null;
  }
}

export async function generateContentDrafts(args: GenerateContentDraftsArgs): Promise<ContentDraft[]> {
  const aiDrafts = await generateWithOpenAi(args);
  if (aiDrafts?.length) return aiDrafts;
  return buildFallbackDrafts(args);
}
