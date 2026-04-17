function normalizeOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getAppOrigin(requestUrl?: string) {
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.BETTER_AUTH_URL,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  if (configured) {
    return normalizeOrigin(configured);
  }

  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  const vercelOrigin = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  if (vercelOrigin) {
    return normalizeOrigin(vercelOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }

  throw new Error('App origin is not configured. Set NEXT_PUBLIC_APP_URL, APP_URL, or BETTER_AUTH_URL in production.');
}

export function buildAppUrl(path: string, requestUrl?: string) {
  return new URL(path, `${getAppOrigin(requestUrl)}/`).toString();
}
