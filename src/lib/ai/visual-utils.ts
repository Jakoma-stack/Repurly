export function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function trimTo(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
