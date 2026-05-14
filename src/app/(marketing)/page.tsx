import Link from 'next/link';
import { Hero } from '@/components/marketing/hero';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PLAN_CATALOG, PLAN_ORDER } from '@/lib/billing/catalog';
import type { PlanKey } from '@/lib/billing/plans';

const features = [
  [
    'Campaign and approval control',
    'Move one idea from campaign brief to draft, approval, CTA, scheduled publishing, and follow-up without losing target, timing, or accountability.',
  ],
  [
    'Multi-brand and multi-offer workspaces',
    'Run separate brand voice, audience, offer, CTA, and LinkedIn context inside one workspace without turning the product into a broad social suite.',
  ],
  [
    'AI drafting that supports revenue workflow',
    'Generate brand-aware LinkedIn drafts, repurpose them into campaign assets, and keep the commercial CTA visible.',
  ],
  [
    'Human-in-the-loop safety',
    'Support responsible campaign execution with approval steps, lead notes, recovery views, and clear boundaries: no scraping, automated DMs, or fake engagement.',
  ],
  [
    'Campaign/output channels',
    'Turn one idea into LinkedIn-led assets plus export-ready copy for Facebook Pages, Instagram, Google Business Profile, email, blog, video scripts, Threads, X, and WhatsApp without promising untested auto-posting.',
  ],
] as const;

function marketingCtaHref(plan: PlanKey) {
  if (plan === 'scale') return PLAN_CATALOG.scale.ctaHref;
  return `/sign-up?plan=${plan}`;
}

const pricing = PLAN_ORDER.map((key) => ({
  ...PLAN_CATALOG[key],
  ctaHref: marketingCtaHref(key),
}));

export default function HomePage() {
  return (
    <div className="space-y-14 pb-20">
      <Hero />

      <section id="features" className="grid gap-5 md:grid-cols-2">
        {features.map(([title, body]) => (
          <Card key={title} className="border-slate-200/80 bg-white/95">
            <CardHeader>
              <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section id="pricing" className="space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-slate-950">
            Pricing for operators who need a revenue workflow, not another cheap scheduler
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Repurly is priced for LinkedIn-led campaign operations: planning, approvals, CTAs, lead notes, output-channel exports, and human-approved follow-up. It should be used internally first, then sold through paid pilots and assisted onboarding.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Founder Pilot support is available from <strong>£950</strong> one-off. Implementation and done-with-you content operations can be sold separately once the workflow is proven.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {pricing.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.featured
                  ? 'border-teal-600 bg-white/95 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.16)] ring-2 ring-teal-600/20'
                  : 'border-slate-200/80 bg-white/95 text-slate-950'
              }
            >
              <CardHeader>
                <div className={plan.featured ? 'text-sm font-semibold text-teal-700' : 'text-sm font-medium text-primary'}>
                  {plan.name}
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{plan.priceLabel}</div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-700">
                  {plan.summary}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {plan.bullets.slice(0, 3).map((bullet) => <li key={bullet}>• {bullet}</li>)}
                </ul>
                <div className="mt-6">
                  <a
                    href={plan.ctaHref}
                    className="inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    {plan.ctaLabel}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white px-8 py-8 shadow-card lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Ready to run Repurly as a LinkedIn-led Growth OS?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Start with Starter or Operator, or apply for Studio if you manage higher-volume multi-brand or done-with-you operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up?plan=growth" className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white">
              Start with Operator
            </Link>
            <Link href="/sign-in" className="inline-flex items-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
