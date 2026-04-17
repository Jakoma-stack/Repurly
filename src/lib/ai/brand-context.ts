export type BrandContextInput = {
  brandName: string;
  website?: string | null;
  audience?: string | null;
  defaultTone?: string | null;
  primaryCta?: string | null;
  secondaryCta?: string | null;
  linkedinProfileUrl?: string | null;
  linkedinCompanyUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type BrandIntelligence = {
  websiteSummary: string | null;
  websiteEvidence: string[];
  proofPoints: string[];
  restrictedClaims: string[];
};

const FETCH_TIMEOUT_MS = 5000;
const MAX_TEXT_LENGTH = 5000;
const MAX_SUMMARY_LENGTH = 900;
const MAX_EVIDENCE_ITEMS = 6;

function trimTo(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => compactWhitespace(sentence))
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 260);
}

function scoreSentence(sentence: string, brandName: string) {
  const lower = sentence.toLowerCase();
  let score = 0;
  if (lower.includes(brandName.toLowerCase())) score += 4;
  if (/(help|build|design|deliver|support|create|improve|governance|ai|automation|analytics|brand|website|product)/.test(lower)) score += 3;
  if (/(for |with |through |across )/.test(lower)) score += 1;
  if (/(cookie|privacy|accept|subscribe|javascript)/.test(lower)) score -= 5;
  return score;
}

function readAiProfile(metadata?: Record<string, unknown> | null) {
  const aiProfile = metadata && typeof metadata.aiProfile === 'object' && metadata.aiProfile && !Array.isArray(metadata.aiProfile)
    ? metadata.aiProfile as Record<string, unknown>
    : null;

  const parseList = (value: unknown) => String(value ?? '')
    .split(/[\n,]/)
    .map((item) => compactWhitespace(item))
    .filter(Boolean);

  return {
    proofPoints: parseList(aiProfile?.proofPoints),
    complianceRules: parseList(aiProfile?.complianceRules),
  };
}

async function fetchWebsiteText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'RepurlyBrandContextBot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const html = await response.text();
    const text = compactWhitespace(sanitizeHtml(html));
    if (!text) return null;
    return trimTo(text, MAX_TEXT_LENGTH);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildWebsiteSummary(text: string, brandName: string) {
  const ranked = splitSentences(text)
    .map((sentence) => ({ sentence, score: scoreSentence(sentence, brandName) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.sentence);

  const fallback = splitSentences(text).slice(0, 3);
  const chosen = ranked.length ? ranked : fallback;

  return {
    websiteSummary: chosen.length ? trimTo(chosen.join(' '), MAX_SUMMARY_LENGTH) : null,
    websiteEvidence: chosen.slice(0, MAX_EVIDENCE_ITEMS),
  };
}

export async function buildBrandIntelligence(input: BrandContextInput): Promise<BrandIntelligence> {
  const aiProfile = readAiProfile(input.metadata);
  const websiteUrl = input.website?.trim();
  const websiteText = websiteUrl ? await fetchWebsiteText(websiteUrl) : null;
  const websiteInsight = websiteText ? buildWebsiteSummary(websiteText, input.brandName) : { websiteSummary: null, websiteEvidence: [] };

  return {
    websiteSummary: websiteInsight.websiteSummary,
    websiteEvidence: websiteInsight.websiteEvidence,
    proofPoints: aiProfile.proofPoints,
    restrictedClaims: aiProfile.complianceRules,
  };
}
