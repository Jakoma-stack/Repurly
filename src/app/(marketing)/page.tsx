import Link from 'next/link';
import { Hero } from '@/components/marketing/hero';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

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
] as const;

const pricing = [
  {
    name: 'Core',
    price: 'From £297/mo',
    body: 'For focused LinkedIn workflows with a tighter team, clear limits, and reliable publishing fundamentals.',
    ctaLabel: 'Choose Core',
    ctaHref: '/sign-up?plan=core',
  },
  {
    name: 'Growth',
    price: 'From £697/mo',
    body: 'For agencies and B2B teams that need approvals, more operational capacity, and stronger commercial controls.',
    ctaLabel: 'Choose Growth',
    ctaHref: '/sign-up?plan=growth',
  },
  {
    name: 'Scale',
    price: 'Custom',
    body: 'For higher-governance pilots and service-heavy accounts that should be sold deliberately rather than self-serve.',
    ctaLabel: 'Talk to sales',
    ctaHref: 'mailto:support@repurly.org?subject=Repurly%20Scale%20plan',
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
            Choose a paid plan before entering the workflow
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Repurly is sold as a premium workflow product. New workspaces must start on Core or Growth before they can use
            composer, calendar, approvals, and queue operations.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {pricing.map((plan, index) => {
            const featured = index === 1;
            return (
              <Card
                key={plan.name}
                className={
                  featured
                    ? 'border-slate-950 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]'
                    : 'border-slate-200/80 bg-white/95'
                }
              >
                <CardHeader>
                  <div className={featured ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>
                    {plan.name}
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{plan.price}</div>
                </CardHeader>
                <CardContent>
                  <p className={featured ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-slate-600'}>
                    {plan.body}
                  </p>
                  <div className="mt-6">
                    <a
                      href={plan.ctaHref}
                      className={
                        featured
                          ? 'inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950'
                          : 'inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white'
                      }
                    >
                      {plan.ctaLabel}
                    </a>
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
              Pick Core or Growth, create your account, and finish checkout before entering the workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up?plan=growth" className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white">
              Choose a plan
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
