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
    name: 'Starter',
    eyebrow: 'For founder-led operators',
    priceLabel: '£79/mo',
    monthlyPriceGbp: 79,
    summary: 'For solo consultants and founders who need a LinkedIn-led campaign workspace, not another generic scheduler.',
    bullets: [
      '1 workspace member',
      '1 brand or offer',
      '60 planned posts per month',
      'Campaign planning, draft generation, CTA tracking, and export packs',
    ],
    ctaLabel: 'Start Starter',
    ctaHref: '/api/billing/checkout?plan=core',
    selfServe: true,
  },
  growth: {
    key: 'growth',
    name: 'Operator',
    eyebrow: 'For serious multi-offer operators',
    priceLabel: '£249/mo',
    monthlyPriceGbp: 249,
    summary: 'The launch default for consultants, fractional marketers, and small B2B teams managing multiple offers or brands.',
    bullets: [
      'Up to 3 workspace members',
      'Up to 4 brands or offers',
      '300 planned posts per month',
      'Approvals, AI drafts, campaign calendars, lead notes, reports, and notifications',
    ],
    ctaLabel: 'Start Operator',
    ctaHref: '/api/billing/checkout?plan=growth',
    featured: true,
    selfServe: true,
  },
  scale: {
    key: 'scale',
    name: 'Studio',
    eyebrow: 'For agencies and assisted growth teams',
    priceLabel: 'From £699/mo',
    summary: 'For multi-client or done-with-you content operations that need onboarding, reporting, stronger approval control, and higher-touch support.',
    bullets: [
      'Custom workspace and brand limits',
      'Higher campaign and publishing volume',
      'Priority support and onboarding',
      'Optional done-with-you content operations support',
    ],
    ctaLabel: 'Apply for Studio',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Studio%20or%20Founder%20Pilot',
    selfServe: false,
  },
};

export const PLAN_ORDER: PlanKey[] = ['core', 'growth', 'scale'];
