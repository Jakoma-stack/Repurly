import type { PlanKey } from '@/lib/billing/plans';

export type PlanCatalogEntry = {
  key: PlanKey;
  name: string;
  eyebrow: string;
  priceLabel: string;
  monthlyPriceGbp?: number;
  summary: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  selfServe?: boolean;
};

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = {
  core: {
    key: 'core',
    name: 'Pro Beta',
    eyebrow: 'For solo consultants and founder-led experts',
    priceLabel: '£49/mo',
    monthlyPriceGbp: 49,
    summary: 'Daily LinkedIn Opportunity Desk for one expert brand: daily briefing, reply drafts, relationship tracker, simple analytics interpretation and weekly action plan.',
    bullets: [
      'Daily Agent with 40 monthly sessions',
      'Reply, comment and DM drafts with no-over-DM guidance',
      'Relationship tracker and follow-up reminders',
      'Tomorrow’s content idea and weekly action plan',
    ],
    ctaLabel: 'Join Pro Beta',
    ctaHref: '/api/billing/checkout?plan=core',
    selfServe: true,
  },
  growth: {
    key: 'growth',
    name: 'Assisted Beta',
    eyebrow: 'For people who want product plus weekly support',
    priceLabel: '£250/mo',
    monthlyPriceGbp: 250,
    summary: 'Repurly access plus a weekly opportunity review so early users get help turning LinkedIn activity into replies, follow-ups, content and pipeline discipline.',
    bullets: [
      'Everything in Pro Beta',
      'Weekly review of warm relationships and next actions',
      'Offer, audience and reply-rule setup support',
      'Priority feedback loop while the product matures',
    ],
    ctaLabel: 'Apply for Assisted Beta',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Assisted%20Beta',
    featured: true,
    selfServe: false,
  },
  scale: {
    key: 'scale',
    name: 'Founder / Agency Pilot',
    eyebrow: 'For expert-led teams and agencies',
    priceLabel: '£500+/mo',
    summary: 'A managed pilot for multiple brands, agencies or founder-led teams that need a repeatable LinkedIn opportunity workflow before broader rollout.',
    bullets: [
      'Multi-brand setup and workflow design',
      'Relationship and reply rules configured with you',
      'Pilot dashboard and usage review',
      'Commercial onboarding support',
    ],
    ctaLabel: 'Discuss pilot',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Founder%20or%20Agency%20Pilot',
    selfServe: false,
  },
};

export const PLAN_ORDER: PlanKey[] = ['core', 'growth', 'scale'];
