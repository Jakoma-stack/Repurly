import { compactWhitespace, trimTo } from '@/lib/ai/visual-utils';

export type GeneratedVisualImage = {
  kind: 'image';
  title: string;
  prompt: string;
  caption: string;
  dataUri: string;
};

export type GeneratedVisualSlide = {
  index: number;
  heading: string;
  body: string;
  dataUri: string;
};

export type GeneratedVisualCarousel = {
  kind: 'carousel';
  title: string;
  prompt: string;
  slides: GeneratedVisualSlide[];
};

export type GeneratedVisualAssets = {
  generatedAt: string;
  image?: GeneratedVisualImage | null;
  carousel?: GeneratedVisualCarousel | null;
};

export type GenerateVisualAssetsArgs = {
  brandName: string;
  brief: string;
  postTitle: string;
  body: string;
  tone?: string | null;
  audience?: string | null;
  primaryCta?: string | null;
  format: 'image' | 'carousel';
};

type TextResponseShape = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
};

function readOutputText(payload: TextResponseShape | null | undefined) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  if (!Array.isArray(payload.output)) return null;
  const text = payload.output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .map((item) => typeof item?.text === 'string' ? item.text.trim() : '')
    .filter(Boolean)
    .join('\n')
    .trim();
  return text || null;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapSvgText(value: string, x: number, y: number, maxChars: number, lineHeight: number, className: string) {
  const words = compactWhitespace(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines
    .slice(0, 6)
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${escapeXml(line)}</text>`)
    .join('');
}

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function buildImageSvg(args: { brandName: string; title: string; caption: string; eyebrow: string }) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${escapeXml(args.title)}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="1200" rx="48" fill="url(#bg)"/>
    <rect x="60" y="60" width="1080" height="1080" rx="40" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)"/>
    <text x="110" y="150" font-size="32" font-family="Inter, Arial, sans-serif" fill="#bfdbfe">${escapeXml(args.eyebrow)}</text>
    ${wrapSvgText(args.title, 110, 290, 22, 74, 'headline')}
    ${wrapSvgText(args.caption, 110, 660, 40, 42, 'body')}
    <text x="110" y="1080" font-size="30" font-family="Inter, Arial, sans-serif" fill="#ffffff">${escapeXml(args.brandName)}</text>
    <style>
      .headline { font: 700 64px Inter, Arial, sans-serif; fill: #ffffff; }
      .body { font: 400 32px Inter, Arial, sans-serif; fill: rgba(255,255,255,0.88); }
    </style>
  </svg>`;
  return svgToDataUri(svg);
}

function buildSlideSvg(args: { brandName: string; title: string; body: string; slideLabel: string; footer: string }) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="${escapeXml(args.title)}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" rx="42" fill="url(#bg)"/>
    <rect x="58" y="58" width="964" height="1234" rx="34" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)"/>
    <text x="110" y="148" font-size="30" font-family="Inter, Arial, sans-serif" fill="#bfdbfe">${escapeXml(args.slideLabel)}</text>
    ${wrapSvgText(args.title, 110, 308, 20, 72, 'headline')}
    ${wrapSvgText(args.body, 110, 760, 32, 46, 'body')}
    <text x="110" y="1210" font-size="28" font-family="Inter, Arial, sans-serif" fill="#ffffff">${escapeXml(args.brandName)}</text>
    <text x="970" y="1210" text-anchor="end" font-size="24" font-family="Inter, Arial, sans-serif" fill="rgba(255,255,255,0.82)">${escapeXml(args.footer)}</text>
    <style>
      .headline { font: 700 62px Inter, Arial, sans-serif; fill: #ffffff; }
      .body { font: 400 34px Inter, Arial, sans-serif; fill: rgba(255,255,255,0.9); }
    </style>
  </svg>`;
  return svgToDataUri(svg);
}

function fallbackImage(args: GenerateVisualAssetsArgs): GeneratedVisualImage {
  const caption = trimTo(
    args.body || args.brief || `A governance-first, commercially useful point of view for ${args.brandName}.`,
    180,
  );
  const title = trimTo(args.postTitle || args.brief || `${args.brandName} insight`, 90);
  const prompt = trimTo(`Create a polished LinkedIn post visual for ${args.brandName}. Tone: ${args.tone || 'clear and credible'}. Audience: ${args.audience || 'senior buyers'}. Headline: ${title}.`, 240);
  return {
    kind: 'image',
    title,
    prompt,
    caption,
    dataUri: buildImageSvg({ brandName: args.brandName, title, caption, eyebrow: args.tone || 'AI-generated visual' }),
  };
}

function fallbackCarousel(args: GenerateVisualAssetsArgs): GeneratedVisualCarousel {
  const opening = trimTo(args.postTitle || args.brief || `${args.brandName} playbook`, 90);
  const body = compactWhitespace(args.body || args.brief || 'Start with the decision, explain the risk, show the practical route, and end with a clear call to action.');
  const bodySentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const baseSlides = [
    { heading: opening, body: trimTo(bodySentences[0] || 'Start with the practical tension senior teams care about.', 150) },
    { heading: 'Why it matters', body: trimTo(bodySentences[1] || 'Show the operational, governance, or commercial risk of ignoring the issue.', 150) },
    { heading: 'What good looks like', body: trimTo(bodySentences[2] || 'Describe the better operating model in plain language.', 150) },
    { heading: 'What to do next', body: trimTo(bodySentences[3] || args.primaryCta || 'End with one clear next step.', 150) },
  ];
  const title = trimTo(`${args.brandName} carousel`, 90);
  const prompt = trimTo(`Create a 4-slide LinkedIn carousel for ${args.brandName} with a ${args.tone || 'credible'} tone aimed at ${args.audience || 'senior buyers'}.`, 240);
  return {
    kind: 'carousel',
    title,
    prompt,
    slides: baseSlides.map((slide, index) => ({
      index: index + 1,
      heading: slide.heading,
      body: slide.body,
      dataUri: buildSlideSvg({
        brandName: args.brandName,
        title: slide.heading,
        body: slide.body,
        slideLabel: `Slide ${index + 1}`,
        footer: index === baseSlides.length - 1 ? (args.primaryCta || 'Request a proposal') : 'Swipe',
      }),
    })),
  };
}

async function callOpenAi(args: GenerateVisualAssetsArgs) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = args.format === 'image'
    ? [
        'Return JSON only.',
        'Create a LinkedIn image concept.',
        'Fields: title, caption, prompt.',
        `Brand: ${args.brandName}`,
        `Tone: ${args.tone || 'clear, credible'}`,
        `Audience: ${args.audience || 'senior buyers'}`,
        `Post title: ${args.postTitle}`,
        `Brief: ${args.brief}`,
        `Body: ${args.body}`,
      ].join('\n')
    : [
        'Return JSON only.',
        'Create a LinkedIn carousel concept.',
        'Fields: title, prompt, slides (array of 4 objects with heading and body).',
        `Brand: ${args.brandName}`,
        `Tone: ${args.tone || 'clear, credible'}`,
        `Audience: ${args.audience || 'senior buyers'}`,
        `Post title: ${args.postTitle}`,
        `Brief: ${args.brief}`,
        `Body: ${args.body}`,
        `CTA: ${args.primaryCta || 'Request a proposal'}`,
      ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISUAL_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: args.format === 'image' ? 'image_visual' : 'carousel_visual',
          schema: args.format === 'image'
            ? {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'caption', 'prompt'],
                properties: {
                  title: { type: 'string' },
                  caption: { type: 'string' },
                  prompt: { type: 'string' },
                },
              }
            : {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'prompt', 'slides'],
                properties: {
                  title: { type: 'string' },
                  prompt: { type: 'string' },
                  slides: {
                    type: 'array',
                    minItems: 4,
                    maxItems: 6,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['heading', 'body'],
                      properties: {
                        heading: { type: 'string' },
                        body: { type: 'string' },
                      },
                    },
                  },
                },
              },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI visual generation failed: ${response.status}`);
  }

  const payload = await response.json() as TextResponseShape;
  const text = readOutputText(payload);
  return text ? JSON.parse(text) as Record<string, unknown> : null;
}

export async function generateVisualAssets(args: GenerateVisualAssetsArgs): Promise<GeneratedVisualAssets> {
  try {
    const result = await callOpenAi(args);
    if (args.format === 'image' && result) {
      const title = trimTo(String(result.title || args.postTitle || `${args.brandName} visual`), 90);
      const caption = trimTo(String(result.caption || args.body || args.brief), 180);
      const prompt = trimTo(String(result.prompt || `Create a premium image for ${args.brandName}`), 240);
      return {
        generatedAt: new Date().toISOString(),
        image: {
          kind: 'image',
          title,
          caption,
          prompt,
          dataUri: buildImageSvg({ brandName: args.brandName, title, caption, eyebrow: args.tone || 'AI-generated visual' }),
        },
      };
    }
    if (args.format === 'carousel' && result) {
      const slides = Array.isArray(result.slides) ? result.slides : [];
      const title = trimTo(String(result.title || `${args.brandName} carousel`), 90);
      const prompt = trimTo(String(result.prompt || `Create a LinkedIn carousel for ${args.brandName}`), 240);
      return {
        generatedAt: new Date().toISOString(),
        carousel: {
          kind: 'carousel',
          title,
          prompt,
          slides: slides.slice(0, 6).map((slide, index) => {
            const heading = trimTo(String((slide as Record<string, unknown>).heading || `Slide ${index + 1}`), 90);
            const body = trimTo(String((slide as Record<string, unknown>).body || args.body || args.brief), 170);
            return {
              index: index + 1,
              heading,
              body,
              dataUri: buildSlideSvg({
                brandName: args.brandName,
                title: heading,
                body,
                slideLabel: `Slide ${index + 1}`,
                footer: index === Math.min(slides.length, 6) - 1 ? (args.primaryCta || 'Request a proposal') : 'Swipe',
              }),
            };
          }),
        },
      };
    }
  } catch (error) {
    console.error('generateVisualAssets failed, using fallback assets', error);
  }

  return args.format === 'image'
    ? { generatedAt: new Date().toISOString(), image: fallbackImage(args) }
    : { generatedAt: new Date().toISOString(), carousel: fallbackCarousel(args) };
}
