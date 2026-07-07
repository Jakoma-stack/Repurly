function svgDataUri(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(value: string, maxChars = 34) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

function renderTextBlock(lines: string[], x: number, y: number, size: number, color: string) {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * (size + 10)}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${index === 0 ? 700 : 500}" fill="${color}">${escapeXml(line)}</text>`)
    .join('');
}

function buildImageSvg(title: string, caption: string, brandName: string) {
  const titleLines = wrapLines(title || 'Generated visual', 22);
  const captionLines = wrapLines(caption || 'Generated from the draft brief', 38).slice(0, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#312e81"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" rx="56" fill="url(#bg)"/>
  <rect x="72" y="72" width="1056" height="1056" rx="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)"/>
  <text x="108" y="150" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="#cbd5e1">${escapeXml(brandName)}</text>
  ${renderTextBlock(titleLines,108,320,78,'#ffffff')}
  ${renderTextBlock(captionLines,108,760,34,'#dbeafe')}
  <rect x="108" y="960" width="280" height="72" rx="36" fill="#ffffff" fill-opacity="0.14"/>
  <text x="148" y="1006" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="#ffffff">Repurly AI visual</text>
</svg>`;
}

function buildSlideSvg(title: string, body: string, brandName: string, index: number, total: number) {
  const titleLines = wrapLines(title || `Slide ${index}`, 18);
  const bodyLines = wrapLines(body || '', 26).slice(0, 5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="slidebg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" rx="48" fill="url(#slidebg)"/>
  <rect x="60" y="60" width="960" height="960" rx="36" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)"/>
  <text x="96" y="130" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="#bfdbfe">${escapeXml(brandName)} • Slide ${index}/${total}</text>
  ${renderTextBlock(titleLines,96,280,72,'#ffffff')}
  ${renderTextBlock(bodyLines,96,620,34,'#e2e8f0')}
</svg>`;
}

export async function generateVisualAssets({
  brandName,
  brief,
  postTitle,
  body,
  format,
}: {
  brandName: string;
  brief: string;
  postTitle: string;
  body: string;
  tone?: string | null;
  audience?: string | null;
  primaryCta?: string | null;
  format: 'image' | 'carousel';
}) {
  const generatedAt = new Date().toISOString();
  const summary = (brief || body || postTitle).replace(/\s+/g, ' ').trim();

  if (format === 'image') {
    return {
      generatedAt,
      image: {
        title: postTitle || `${brandName} visual`,
        caption: summary.slice(0, 180),
        prompt: summary,
        dataUri: svgDataUri(buildImageSvg(postTitle || `${brandName} visual`, summary.slice(0, 180), brandName)),
      },
    };
  }

  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const slides = Array.from({ length: Math.max(3, Math.min(5, sentences.length || 3)) }, (_, idx) => {
    const sentence = sentences[idx] || summary || `Point ${idx + 1}`;
    const [heading, ...rest] = sentence.split(/[:.-]\s+/);
    const slideTitle = idx === 0 ? (postTitle || `${brandName} carousel`) : heading || `Point ${idx + 1}`;
    const slideBody = idx === 0 ? sentence : (rest.join(' ') || sentence);
    return {
      index: idx + 1,
      heading: slideTitle.slice(0, 80),
      body: slideBody.slice(0, 180),
      dataUri: svgDataUri(buildSlideSvg(slideTitle, slideBody, brandName, idx + 1, Math.max(3, Math.min(5, sentences.length || 3)))),
    };
  });

  return {
    generatedAt,
    carousel: {
      title: postTitle || `${brandName} carousel`,
      prompt: summary,
      slides,
    },
  };
}
