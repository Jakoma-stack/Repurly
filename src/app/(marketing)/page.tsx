import Link from 'next/link';
import { Hero } from '@/components/marketing/hero';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const features = [
  [
    'Approval-led execution',
    'Move one post from draft to approval to scheduled publishing without losing target, timing, or accountability.',
  ],
  [
    'Multi-brand workspaces',
    'Run separate brand voice, audience, CTA, and LinkedIn context inside one workspace without pretending to be a broad social suite.',
  ],
  [
    'AI that stays useful',
    'Generate brand-aware drafts, review the batch, and tighten the best one inside the same workflow.',
  ],
  [
    'Recovery operators can trust',
    'Use queue visibility, publish history, reconnect nudges, and job detail before missed posts become customer-facing failures.',
  ],
] as const;

const pricing = [
  {
    name: 'Solo',
    price: '£59/mo',
    body: 'For founder-led or solo workflows that need cleaner planning, scheduling, and AI drafting without team complexity.',
    bullets: ['1 workspace', '1 brand', 'Core drafting and scheduling', 'Starter AI allowance'],
    ctaLabel: 'Start Solo',
    ctaHref: '/sign-up?plan=core',
  },
  {
    name: 'Team',
    price: '£199/mo',
    body: 'For agencies and B2B teams that need approvals, queue visibility, engagement workflow, and operational reporting.',
    bullets: ['Multi-user workspace', 'Approvals and team workflow', 'Reports and notifications', 'Higher AI and publishing allowance'],
    ctaLabel: 'Start Team',
    ctaHref: '/sign-up?plan=growth',
    featured: true,
  },
  {
    name: 'Agency',
    price: '£499/mo',
    body: 'For multi-brand operators who want stronger workflow control, client visibility, and more capacity without enterprise overhead.',
    bullets: ['Multi-brand workspaces', 'Priority support', 'Higher usage limits', 'Commercial onboarding support'],
    ctaLabel: 'Talk to Jakoma',
    ctaHref: 'mailto:support@jakoma.org?subject=Repurly%20Agency%20plan',
  },
] as const;

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
            Pricing for focused teams that need a premium workflow, not a bloated suite
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Repurly is priced above lightweight scheduling tools and below heavyweight enterprise social suites. The commercial posture is
            simple: charge for workflow control, multi-brand operations, and operational confidence.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            For guided implementation, offer a one-off pilot or onboarding package from <strong>£1,500</strong>.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {pricing.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.featured
                  ? 'border-slate-950 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]'
                  : 'border-slate-200/80 bg-white/95'
              }
            >
              <CardHeader>
                <div className={plan.featured ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>
                  {plan.name}
                </div>
                <div className="mt-2 text-3xl font-semibold">{plan.price}</div>
              </CardHeader>
              <CardContent>
                <p className={plan.featured ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-slate-600'}>
                  {plan.body}
                </p>
                <ul className={plan.featured ? 'mt-4 space-y-2 text-sm text-slate-200' : 'mt-4 space-y-2 text-sm text-slate-600'}>
                  {plan.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
                </ul>
                <div className="mt-6">
                  <a
                    href={plan.ctaHref}
                    className={
                      plan.featured
                        ? 'inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950'
                        : 'inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white'
                    }
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
            <h2 className="text-2xl font-semibold text-slate-950">Ready to run Repurly as your LinkedIn operating system?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Start with Solo or Team, or talk to Jakoma if you need a multi-brand pilot with stronger workflow support.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up?plan=growth" className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white">
              Start with Team
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
