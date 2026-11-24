import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getMarketingStage, missingMarketingBasics } from './portfolio';

export type DirectorBrand = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  audience: string | null;
  defaultTone: string | null;
  primaryCta: string | null;
  secondaryCta: string | null;
  website: string | null;
  metadata: Record<string, unknown> | null;
};

const short = z.string().trim().min(1).max(500);
export const directorPlanSchema = z.object({
  objective: short,
  positioning: short,
  channel: z.enum(['LinkedIn', 'Email', 'Website', 'Community', 'Direct conversations']),
  rationale: short,
  evidenceToVerify: z.array(short).min(1).max(4),
  weeks: z.array(z.object({
    theme: short,
    action: short,
    measure: short,
  }).strict()).length(4),
  firstDraft: z.object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(40).max(1800),
  }).strict(),
  ownerAction: short,
}).strict();

export type DirectorPlan = z.infer<typeof directorPlanSchema>;
const savedPlanSchema = z.object({
  id: z.string().uuid(),
  contextHash: z.string().regex(/^[a-f0-9]{64}$/),
  generatedAt: z.string().datetime(),
  plan: directorPlanSchema,
}).strict();
export type SavedDirectorPlan = z.infer<typeof savedPlanSchema>;

function bounded(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
export function directorContext(brand: DirectorBrand) {
  const desk = brand.metadata?.opportunityDesk;
  const offer = desk && typeof desk === 'object' && !Array.isArray(desk)
    ? bounded((desk as Record<string, unknown>).offer, 600) : '';
  const rawKnowledge = brand.metadata?.portfolioMarketingKnowledge;
  const knowledge = rawKnowledge && typeof rawKnowledge === 'object' && !Array.isArray(rawKnowledge) ? rawKnowledge as Record<string, unknown> : {};
  return {
    brandName: bounded(brand.name, 120),
    stage: getMarketingStage(brand.metadata),
    audience: bounded(brand.audience, 600),
    tone: bounded(brand.defaultTone, 300),
    primaryCta: bounded(brand.primaryCta, 160),
    secondaryCta: bounded(brand.secondaryCta, 160),
    website: bounded(brand.website, 255),
    positioning: bounded(brand.metadata?.starterPositioning, 600),
    objective: bounded(brand.metadata?.starterCampaignGoal, 400),
    offer,
    portfolioPositioning: bounded(knowledge.positioning, 300),
    portfolioVoice: bounded(knowledge.voice, 300),
    portfolioObjective: bounded(knowledge.objective, 500),
    portfolioGuardrails: bounded(knowledge.guardrails, 800),
  };
}

export function directorContextHash(brand: DirectorBrand) {
  return createHash('sha256').update(JSON.stringify(directorContext(brand))).digest('hex');
}

export function savedDirectorPlan(brand: DirectorBrand): SavedDirectorPlan | null {
  const parsed = savedPlanSchema.safeParse(brand.metadata?.marketingDirector);
  return parsed.success ? parsed.data : null;
}

export function directorPlanIsCurrent(brand: DirectorBrand, saved: SavedDirectorPlan) {
  return brand.status === 'active' && saved.contextHash === directorContextHash(brand) &&
    Date.parse(saved.generatedAt) <= Date.now() &&
    Date.now() - Date.parse(saved.generatedAt) < 30 * 86_400_000;
}

export function directorBrandEligibility(brand: DirectorBrand, ownerPilot: boolean) {
  if (brand.status !== 'active') return 'Activate the brand before planning.';
  if (ownerPilot && ['averyquant-one', 'jakoma-risk-intelligence'].includes(brand.slug ?? '')) return 'Research only: no marketing plan until separately cleared.';
  const missing = missingMarketingBasics(brand);
  if (missing.length) return 'Complete brand settings: ' + missing.join(', ') + '.';
  return null;
}

/** Editorial triage only; never a commercial-intent score or live market assessment. */
export function rankDirectorBrands<T extends DirectorBrand>(brands: T[], ownerPilot: boolean): T[] {
  const pilotOrder = ['repurly', 'period-close-workbench', 'jakoma', 'edusmart', 'family-support'];
  const stageOrder = ['public_launch', 'private_beta', 'audience_building', 'private_build'];
  function rank(brand: T) {
    if (directorBrandEligibility(brand, ownerPilot)) return 100;
    const pilotRank = pilotOrder.indexOf(brand.slug ?? '');
    if (ownerPilot && pilotRank >= 0) return pilotRank;
    return 10 + stageOrder.indexOf(getMarketingStage(brand.metadata));
  }
  return [...brands].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
