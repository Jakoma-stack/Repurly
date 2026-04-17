export type IntentSummary = {
  intentLabel: 'hot' | 'warm' | 'nurture' | 'spam';
  intentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
};

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function scoreCommentIntent(commentText: string): IntentSummary {
  const text = commentText.toLowerCase();

  const hotTokens = ['price', 'pricing', 'demo', 'interested', 'dm me', 'send details', 'how much', 'book', 'trial'];
  const warmTokens = ['workflow', 'tool', 'stack', 'reviewing', 'quarter', 'curious', 'team', 'approval', 'multiple brands', 'agency'];
  const spamTokens = ['promo', 'bitcoin', 'guaranteed followers', 'buy followers'];
  const negativeTokens = ['bad', 'wrong', 'confusing', 'not useful'];
  const positiveTokens = ['great', 'helpful', 'useful', 'love this', 'smart'];

  if (containsAny(text, spamTokens)) {
    return { intentLabel: 'spam', intentScore: 0, sentiment: 'negative' };
  }

  let score = 20;
  if (containsAny(text, hotTokens)) score += 55;
  else if (containsAny(text, warmTokens)) score += 25;

  if (text.includes('?')) score += 5;
  if (text.length > 120) score += 5;

  const sentiment: IntentSummary['sentiment'] = containsAny(text, negativeTokens)
    ? 'negative'
    : containsAny(text, positiveTokens)
      ? 'positive'
      : 'neutral';

  if (score >= 75) return { intentLabel: 'hot', intentScore: Math.min(score, 100), sentiment };
  if (score >= 45) return { intentLabel: 'warm', intentScore: Math.min(score, 100), sentiment };
  return { intentLabel: 'nurture', intentScore: Math.min(score, 100), sentiment };
}

function fallbackReplyOptions(args: {
  brandName: string;
  commentText: string;
  intentLabel: IntentSummary['intentLabel'];
  sourcePostTitle?: string | null;
  primaryCta?: string | null;
}) {
  const cta = args.primaryCta?.trim() || 'Happy to send more detail.';

  if (args.intentLabel === 'hot') {
    return [
      `Thanks for the interest. ${cta}`,
      `Appreciate the comment. This is exactly the workflow problem we help teams tighten. ${cta}`,
      `Glad this landed. I can share the practical setup and what it looks like in use.`,
    ];
  }

  if (args.intentLabel === 'warm') {
    return [
      `Thanks. The main point is to keep the workflow narrow enough that the team actually uses it.`,
      `Appreciate that. We have found approvals, target selection, and recovery are usually the biggest friction points.`,
      `Exactly. ${args.sourcePostTitle ? `That is the same issue behind ${args.sourcePostTitle}. ` : ''}${cta}`,
    ];
  }

  return [
    `Thanks for reading. We are focused on practical workflow improvements rather than adding more surface area.`,
    `Appreciate it. A reliable content process usually beats a broader but messier setup.`,
    `Thanks for the comment. We are deliberately keeping the operating model tight first.`,
  ];
}

async function replyOptionsWithOpenAi(args: {
  brandName: string;
  brandTone?: string | null;
  commentText: string;
  intentLabel: IntentSummary['intentLabel'];
  sourcePostTitle?: string | null;
  primaryCta?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = [
    'You create short LinkedIn comment replies for B2B brands.',
    'Return strict JSON with the shape {"replies":["...","...","..."],"dm":"..."}.',
    'Keep replies natural, commercially realistic, and not pushy.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? 'clear, calm, commercially realistic'}`,
    `Intent label: ${args.intentLabel}`,
    `Source post: ${args.sourcePostTitle ?? 'Recent LinkedIn post'}`,
    `Comment: ${args.commentText}`,
    `Primary CTA: ${args.primaryCta ?? ''}`,
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
            name: 'repurly_reply_suggestions',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                replies: { type: 'array', items: { type: 'string' } },
                dm: { type: 'string' },
              },
              required: ['replies', 'dm'],
            },
          },
        },
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) return null;
    const parsed = JSON.parse(payload.output_text) as { replies?: string[]; dm?: string };
    if (!parsed.replies?.length || !parsed.dm) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function buildReplyOptions(args: {
  brandName: string;
  brandTone?: string | null;
  commentText: string;
  intentLabel: IntentSummary['intentLabel'];
  sourcePostTitle?: string | null;
  primaryCta?: string | null;
}) {
  const ai = await replyOptionsWithOpenAi(args);
  if (ai?.replies?.length && ai.dm) {
    return {
      replies: ai.replies.slice(0, 3),
      dm: ai.dm,
    };
  }

  return {
    replies: fallbackReplyOptions(args),
    dm: buildDmDraft(args),
  };
}

export function buildDmDraft(args: {
  brandName: string;
  commentText: string;
  intentLabel: IntentSummary['intentLabel'];
  sourcePostTitle?: string | null;
  primaryCta?: string | null;
}) {
  const softCta = args.primaryCta?.trim() || 'send over the checklist';
  const open = args.intentLabel === 'hot'
    ? `Thanks for the comment on ${args.sourcePostTitle ?? 'the post'}.`
    : `Appreciate your comment on ${args.sourcePostTitle ?? 'the post'}.`;

  return `${open} It sounded like this might be relevant to your team. If helpful, I can ${softCta.toLowerCase()} and keep it practical.`;
}
