import Link from 'next/link';
import { Hero } from '@/components/marketing/hero';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PLAN_CATALOG, PLAN_ORDER } from '@/lib/billing/catalog';

const features = [
  [
    'Approval and routing control',
    'Move one LinkedIn post from draft to approval to scheduled publishing without losing target, timing, or accountability.',
  ],
  [
    'Multi-brand workspaces',
    'Run separate brand voice, audience, CTA, and LinkedIn context inside one workspace without turning the product into a broad social suite.',
  ],
  [
    'AI drafting that stays useful',
    'Generate brand-aware LinkedIn drafts, review the batch, and tighten the best one inside the same workflow.',
  ],
  [
    'Recovery operators can trust',
    'Use queue visibility, publish history, reconnect nudges, and job detail before missed posts become customer-facing failures.',
  ],
];

const platformRows = [
  ['LinkedIn-first workflow', 'Repurly is intentionally strongest where agencies and B2B teams feel the most workflow drag: company pages, executive posting, approvals, scheduling, and recovery.'],
  ['Engagement to lead follow-up', 'Keep comments, reply drafting, and lightweight lead tracking close to the publishing workflow instead of splitting them across disconnected tools.'],
  ['Premium focus over feature sprawl', 'Repurly is priced and presented as a focused operating system for high-value LinkedIn work, not a cheap scheduler and not a faux-enterprise social suite.'],
];

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

      <section id="platform" className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200/80 bg-white/95">
          <CardHeader>
            <h2 className="text-2xl font-semibold text-slate-950">A focused platform for premium LinkedIn operations</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Repurly is built for teams that care about commercial control as much as post output: approvals, target selection,
              queue management, publish reliability, and clear recovery when something breaks.
            </p>
            <p>
              The product includes the workflow surface most teams actually need to run high-value LinkedIn operations: multi-brand
              setup, AI-assisted draft creation, queue visibility, engagement handling, and a lightweight lead pipeline.
            </p>
            <p>
              It stays intentionally narrower than a broad social suite, which lets the experience feel sharper, more premium, and more
              operationally trustworthy.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95">
          <CardHeader>
            <h2 className="text-2xl font-semibold text-slate-950">What the platform is strongest at</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {platformRows.map(([title, body], index) => (
              <div key={title} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="text-sm font-semibold text-slate-950">{index + 1}. {title}</div>
                <div className="mt-1 leading-6">{body}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="pricing" className="space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-slate-950">Pricing for focused teams that need a premium workflow, not a bloated suite</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Repurly is priced above lightweight scheduling tools and below heavyweight enterprise social suites. The commercial posture is
            simple: charge for workflow control, multi-brand operations, and operational confidence.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((key) => {
            const plan = PLAN_CATALOG[key];
            return (
              <Card
                key={plan.key}
                className={plan.featured ? 'border-slate-950 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]' : 'border-slate-200/80 bg-white/95'}
              >
                <CardHeader>
                  <div className={plan.featured ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>{plan.eyebrow}</div>
                  <div className="mt-2 text-3xl font-semibold">{plan.name}</div>
                  <div className={plan.featured ? 'mt-2 text-2xl font-semibold text-white' : 'mt-2 text-2xl font-semibold text-slate-950'}>{plan.priceLabel}</div>
                </CardHeader>
                <CardContent>
                  <p className={plan.featured ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-slate-600'}>{plan.summary}</p>
                  <div className="mt-5 space-y-2">
                    {plan.bullets.map((item) => (
                      <div key={item} className={plan.featured ? 'rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-200' : 'rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700'}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    {plan.ctaHref.startsWith('mailto:') ? (
                      <a href={plan.ctaHref} className={plan.featured ? 'inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950' : 'inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white'}>
                        {plan.ctaLabel}
                      </a>
                    ) : (
                      <a href={plan.ctaHref} className={plan.featured ? 'inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950' : 'inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white'}>
                        {plan.ctaLabel}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white px-8 py-8 shadow-card lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Ready to run Repurly as your LinkedIn operating system?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Start in the app, configure your workspace, add your brands, connect LinkedIn, and move from drafts to approvals to scheduled publishing in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white">
              Create an account
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
