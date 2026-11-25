export const marketingStageOptions = [
  { value: 'private_build', label: 'Private build', guidance: 'Share development ideas, not product availability claims.' },
  { value: 'audience_building', label: 'Audience building', guidance: 'Educate and invite opt-in interest without claiming launch.' },
  { value: 'private_beta', label: 'Private beta', guidance: 'Invite testers only when real beta access and support are available.' },
  { value: 'public_launch', label: 'Public launch', guidance: 'Verify availability, pricing and product claims before publishing.' },
] as const;

export type MarketingStage = (typeof marketingStageOptions)[number]['value'];

export function getMarketingStage(metadata: unknown): MarketingStage {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'private_build';
  const value = (metadata as Record<string, unknown>).marketingStage;
  return marketingStageOptions.find(stage => stage.value === value)?.value ?? 'private_build';
}

export function getMarketingStageDetails(stage: MarketingStage) {
  return marketingStageOptions.find(item => item.value === stage) ?? marketingStageOptions[0];
}

export function missingMarketingBasics(brand: { audience?: string | null; defaultTone?: string | null; primaryCta?: string | null }): string[] {
  const missing: string[] = [];
  if (!brand.audience?.trim()) missing.push('audience');
  if (!brand.defaultTone?.trim()) missing.push('tone');
  if (!brand.primaryCta?.trim()) missing.push('call to action');
  return missing;
}
