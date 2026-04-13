export type IntentSummary = {
  intentLabel: 'hot' | 'warm' | 'nurture' | 'spam';
  intentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
};

export type EngagementSuggestions = {
  replies: string[];
  dm: string;
  qualificationSummary: string;
  nextBestAction: string;
  escalationRecommendation: string;
  leadNotes: string;
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

  if (containsAny(text, spamTokens)) return { intentLabel: 'spam', intentScore: 0, sentiment: 'negative' };

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
}): EngagementSuggestions {
  const cta = args.primaryCta?.trim() || 'Happy to send more detail.';
  const replies = args.intentLabel === 'hot'
    ? [
        `Thanks for the interest. ${cta}`,
        `Appreciate the comment. This is exactly the workflow problem we help teams tighten. ${cta}`,
        'Glad this landed. I can share the practical setup and what it looks like in use.',
      ]
    : args.intentLabel === 'warm'
      ? [
          'Thanks. The main point is to keep the workflow narrow enough that the team actually uses it.',
          'Appreciate that. We have found approvals, target selection, and recovery are usually the biggest friction points.',
          `Exactly. ${args.sourcePostTitle ? `That is the same issue behind ${args.sourcePostTitle}. ` : ''}${cta}`,
        ]
      : [
          'Thanks for reading. We are focused on practical workflow improvements rather than adding more surface area.',
          'Appreciate it. A reliable content process usually beats a broader but messier setup.',
          'Thanks for the comment. We are deliberately keeping the operating model tight first.',
        ];

  return {
    replies,
    dm: buildDmDraft(args),
    qualificationSummary: args.intentLabel === 'hot'
      ? 'High-intent signal. The commenter is asking for specifics or showing clear buying interest.'
      : args.intentLabel === 'warm'
        ? 'Moderate buying signal. The commenter understands the problem and may be open to follow-up.'
        : 'Low-pressure nurture signal. Keep the conversation helpful and public first.',
    nextBestAction: args.intentLabel === 'hot'
      ? 'Reply publicly, then send a DM with a practical next step or resource.'
      : args.intentLabel === 'warm'
        ? 'Reply in-thread, then see whether a DM or lead capture is warranted.'
        : 'Reply helpfully in public and monitor for any follow-up question.',
    escalationRecommendation: args.intentLabel === 'hot' ? 'Sales or founder follow-up recommended within one business day.' : 'Keep with marketing or community workflow for now.',
    leadNotes: `Source signal from comment on ${args.sourcePostTitle ?? 'a recent post'}. Intent=${args.intentLabel}. Preserve context and respond with a practical next step.`,
  };
}

function readOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const direct = (payload as { output_text?: unknown }).output_text;
  return typeof direct === 'string' && direct.trim() ? direct : null;
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
  const model = process.env.OPENAI_ENGAGEMENT_MODEL?.trim() || 'gpt-4.1-mini';

  const prompt = [
    'You create short social replies and lead guidance for B2B brands.',
    'Return strict JSON with the shape {"replies":["...","...","..."],"dm":"...","qualificationSummary":"...","nextBestAction":"...","escalationRecommendation":"...","leadNotes":"..."}.',
    'Keep replies natural, commercially realistic, and not pushy.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? 'clear, calm, commercially realistic'}`,
    `Intent label: ${args.intentLabel}`,
    `Source post: ${args.sourcePostTitle ?? 'Recent social post'}`,
    `Comment: ${args.commentText}`,
    `Primary CTA: ${args.primaryCta ?? ''}`,
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
            name: 'repurly_reply_suggestions',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                replies: { type: 'array', items: { type: 'string' } },
                dm: { type: 'string' },
                qualificationSummary: { type: 'string' },
                nextBestAction: { type: 'string' },
                escalationRecommendation: { type: 'string' },
                leadNotes: { type: 'string' },
              },
              required: ['replies', 'dm', 'qualificationSummary', 'nextBestAction', 'escalationRecommendation', 'leadNotes'],
            },
          },
        },
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const outputText = readOutputText(payload);
    if (!outputText) return null;
    const parsed = JSON.parse(outputText) as Partial<EngagementSuggestions>;
    if (!parsed.replies || !parsed.dm || !parsed.qualificationSummary || !parsed.nextBestAction || !parsed.escalationRecommendation || !parsed.leadNotes) return null;
    return parsed as EngagementSuggestions;
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
  if (ai?.replies?.length && ai.dm) return { ...ai, replies: ai.replies.slice(0, 3) };
  return fallbackReplyOptions(args);
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
