export type LinkedInConfig = {
  key: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  apiVersion: string;
  source: 'standard' | 'legacy-suffixed';
};

type PartialLinkedInConfig = Partial<Omit<LinkedInConfig, 'apiVersion' | 'source'>>;

type ResolveLinkedInConfigOptions = {
  requestUrl?: string;
  configKey?: string | null;
};

const LINKEDIN_ENV_FIELDS = ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI', 'SCOPE'] as const;
const DEFAULT_LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION?.trim() || '202603';

export function getLinkedInApiVersion() {
  return DEFAULT_LINKEDIN_API_VERSION;
}

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readStandardConfig(): LinkedInConfig | null {
  const clientId = trimEnv(process.env.LINKEDIN_CLIENT_ID);
  const clientSecret = trimEnv(process.env.LINKEDIN_CLIENT_SECRET);
  const redirectUri = trimEnv(process.env.LINKEDIN_REDIRECT_URI);
  const scope = trimEnv(process.env.LINKEDIN_SCOPE);

  if (!clientId || !clientSecret || !redirectUri || !scope) {
    return null;
  }

  return {
    key: 'default',
    clientId,
    clientSecret,
    redirectUri,
    scope,
    apiVersion: DEFAULT_LINKEDIN_API_VERSION,
    source: 'standard',
  };
}

function readLegacyConfigs() {
  const configs = new Map<string, PartialLinkedInConfig>();

  for (const [envName, envValue] of Object.entries(process.env)) {
    const match = envName.match(/^LINKEDIN_(CLIENT_ID|CLIENT_SECRET|REDIRECT_URI|SCOPE)_(.+)$/);
    if (!match) continue;

    const [, field, suffix] = match;
    const trimmedValue = trimEnv(envValue);
    if (!trimmedValue) continue;

    const current = configs.get(suffix) ?? {};
    const key = field.toLowerCase().replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()) as keyof PartialLinkedInConfig;
    current[key] = trimmedValue;
    configs.set(suffix, current);
  }

  return Array.from(configs.entries())
    .map(([key, value]) => {
      const clientId = value.clientId?.trim();
      const clientSecret = value.clientSecret?.trim();
      const redirectUri = value.redirectUri?.trim();
      const scope = value.scope?.trim();

      if (!clientId || !clientSecret || !redirectUri || !scope) {
        return null;
      }

      return {
        key,
        clientId,
        clientSecret,
        redirectUri,
        scope,
        apiVersion: DEFAULT_LINKEDIN_API_VERSION,
        source: 'legacy-suffixed' as const,
      } satisfies LinkedInConfig;
    })
    .filter((config): config is LinkedInConfig => Boolean(config));
}

function hostFromUrl(url?: string) {
  if (!url) return null;

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function findLegacyConfigByKey(configs: LinkedInConfig[], key?: string | null) {
  if (!key) return null;
  return configs.find((config) => config.key === key) ?? null;
}

function findLegacyConfigByHost(configs: LinkedInConfig[], host?: string | null) {
  if (!host) return null;
  return configs.find((config) => hostFromUrl(config.redirectUri) === host) ?? null;
}

export function getLinkedInConfig(options: ResolveLinkedInConfigOptions = {}): LinkedInConfig {
  const standardConfig = readStandardConfig();
  const legacyConfigs = readLegacyConfigs();
  const requestedHost = hostFromUrl(options.requestUrl);
  const configuredHost = hostFromUrl(process.env.APP_URL) ?? hostFromUrl(process.env.NEXT_PUBLIC_APP_URL);
  const explicitConfigKey = trimEnv(process.env.LINKEDIN_ENV_KEY) ?? options.configKey ?? null;

  const byKey = findLegacyConfigByKey(legacyConfigs, explicitConfigKey);
  if (byKey) return byKey;

  const byRequestHost = findLegacyConfigByHost(legacyConfigs, requestedHost);
  if (byRequestHost) return byRequestHost;

  const byConfiguredHost = findLegacyConfigByHost(legacyConfigs, configuredHost);
  if (byConfiguredHost) return byConfiguredHost;

  if (standardConfig) {
    return standardConfig;
  }

  if (legacyConfigs.length === 1) {
    return legacyConfigs[0];
  }

  const availableLegacyFields = legacyConfigs.length
    ? legacyConfigs.map((config) => config.key).join(', ')
    : 'none';

  throw new Error(
    [
      'LinkedIn configuration is incomplete.',
      `Provide LINKEDIN_${LINKEDIN_ENV_FIELDS.join(', LINKEDIN_')} or set LINKEDIN_ENV_KEY to one of: ${availableLegacyFields}.`,
    ].join(' '),
  );
}
