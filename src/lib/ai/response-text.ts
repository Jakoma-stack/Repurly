/**
 * Extract generated text from the raw HTTP Responses API payload or SDK convenience shape.
 * Ignore reasoning/other non-text output items; never log payloads containing user data.
 */
export function readOpenAiResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  const texts: string[] = [];
  for (const message of output) {
    if (!message || typeof message !== 'object') continue;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;
      const part = item as { type?: unknown; text?: unknown };
      if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        texts.push(part.text.trim());
      }
    }
  }
  return texts.length ? texts.join('\n') : null;
}
