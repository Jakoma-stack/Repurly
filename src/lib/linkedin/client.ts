import { getLinkedInApiVersion, getLinkedInConfig } from '@/lib/linkedin/config';

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

export type LinkedInRequestError = Error & {
  retryable?: boolean;
  status?: number;
  body?: string;
};

const LINKEDIN_OAUTH_TIMEOUT_MS = Number(process.env.LINKEDIN_OAUTH_TIMEOUT_MS ?? 15000);
const LINKEDIN_API_TIMEOUT_MS = Number(process.env.LINKEDIN_API_TIMEOUT_MS ?? 15000);

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, timeoutLabel: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw Object.assign(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms`), { retryable: true });
    }

    throw Object.assign(
      new Error(error instanceof Error ? error.message : `${timeoutLabel} failed`),
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseText(response: Response) {
  return response.text().catch(() => '');
}

function buildLinkedInError(timeoutLabel: string, response: Response, body: string): LinkedInRequestError {
  return Object.assign(
    new Error(`${timeoutLabel} failed: ${response.status} ${body}`.trim()),
    {
      retryable: response.status >= 500 || response.status === 429 || response.status === 408,
      status: response.status,
      body,
    },
  );
}

export async function exchangeLinkedInCode(code: string, configKey?: string | null): Promise<LinkedInTokenResponse> {
  const config = getLinkedInConfig({ configKey });
  const response = await fetchWithTimeout('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  }, LINKEDIN_OAUTH_TIMEOUT_MS, 'LinkedIn token exchange');

  if (!response.ok) {
    const body = await readResponseText(response);
    throw buildLinkedInError('LinkedIn token exchange', response, body);
  }

  return response.json();
}

export async function refreshLinkedInToken(refreshToken: string, configKey?: string | null): Promise<LinkedInTokenResponse> {
  const config = getLinkedInConfig({ configKey });
  const response = await fetchWithTimeout('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  }, LINKEDIN_OAUTH_TIMEOUT_MS, 'LinkedIn token refresh');

  if (!response.ok) {
    const body = await readResponseText(response);
    throw buildLinkedInError('LinkedIn token refresh', response, body);
  }

  return response.json();
}

export async function fetchLinkedInMember(accessToken: string) {
  const response = await fetchWithTimeout('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, LINKEDIN_API_TIMEOUT_MS, 'LinkedIn userinfo lookup');

  if (!response.ok) {
    const body = await readResponseText(response);
    throw buildLinkedInError('LinkedIn userinfo lookup', response, body);
  }

  return response.json() as Promise<{ sub: string; name?: string; email?: string }>;
}

export async function fetchOrganizationAccess(accessToken: string, _configKey?: string | null) {
  const apiVersion = getLinkedInApiVersion();
  const response = await fetchWithTimeout('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  }, LINKEDIN_API_TIMEOUT_MS, 'LinkedIn organization lookup');

  if (!response.ok) {
    const body = await readResponseText(response);
    throw buildLinkedInError('LinkedIn organization lookup', response, body);
  }

  return response.json() as Promise<{ elements: Array<Record<string, unknown>> }>;
}
