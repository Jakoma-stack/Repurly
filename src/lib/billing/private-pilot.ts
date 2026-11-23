/**
 * Private one-person test mode. Never grants access in Railway production.
 * No public client configuration or secret is used to authenticate the user:
 * Clerk identity and workspace membership are checked by workspace-billing.
 */
export type PrivatePilotSettings = {
  enabled?: string;
  environment?: string;
  allowedEmail?: string;
};

function settingsFromEnvironment(): PrivatePilotSettings {
  return {
    enabled: process.env.REPURLY_PRIVATE_PILOT_MODE,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME,
    allowedEmail: process.env.REPURLY_PILOT_EMAIL,
  };
}

export function isPrivatePilotMode(settings: PrivatePilotSettings = settingsFromEnvironment()) {
  return settings.enabled === 'true' && settings.environment === 'staging';
}

export function isPrivatePilotEmailAllowed(
  userEmail: string | null | undefined,
  settings: PrivatePilotSettings = settingsFromEnvironment(),
) {
  const expected = settings.allowedEmail?.trim().toLowerCase();
  return Boolean(expected) && isPrivatePilotMode(settings) &&
    userEmail?.trim().toLowerCase() === expected;
}
