import Link from 'next/link';
import { Hero } from '@/components/marketing/hero';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PLAN_CATALOG, PLAN_ORDER } from '@/lib/billing/catalog';
import type { PlanKey } from '@/lib/billing/plans';

const features = [
  [
    'Daily Agent intake',
    'Paste LinkedIn notifications, comments, analytics, profile names and context. Repurly turns the noise into a clear daily action plan.',
  ],
  [
    'Reply operating system',
    'Get public reply drafts, DM drafts where appropriate, no-DM-yet guidance, ignore recommendations and copy-ready wording.',
  ],
  [
    'Relationship memory',
    'Log warm signals, next actions, relationship stages and follow-up reminders so LinkedIn activity does not disappear after the notification clears.',
  ],
  [
    'Content from signals',
    'Convert comments, questions and analytics into tomorrow’s strongest post idea and a weekly next-action plan.',
  ],
] as const;

const workflow = [
  'Paste what happened on LinkedIn today.',
  'Review who matters and what can be ignored.',
  'Approve, edit and copy replies or follow-ups.',
  'Log useful people to the relationship tracker.',
  'Use the daily and weekly plans to decide what to post next.',
] as const;

function marketingCtaHref(plan: PlanKey) {
  if (plan === 'core') return '/sign-up?plan=core';
  return PLAN_CATALOG[plan].ctaHref;
}

const pricing = PLAN_ORDER.map((key) => ({
  ...PLAN_CATALOG[key],
  ctaHref: marketingCtaHref(key),
}));

export default function HomePage() {
  return (
    <div className="space-y-14 pb-20">
      <Hero />

      <section className="rounded-[2rem] border border-slate-200 bg-white px-8 py-8 shadow-card lg:px-10">
        <div className="max-w-3xl">
          <div className="eyebrow">The wedge</div>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Repurly owns the gap between LinkedIn engagement and commercial follow-up.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Consultants and founders do not need another generic scheduling tool. They need to know who is worth replying to, when to avoid a weak DM, what to follow up, and which relationship signals should be remembered.
          </p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {workflow.map((item, index) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</div>
              {item}
            </div>
          ))}
        </div>
      </section>

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

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader><h3 className="text-xl font-semibold text-emerald-950">Best-fit users</h3></CardHeader>
          <CardContent className="text-sm leading-6 text-emerald-900">
            B2B consultants, fractional leaders, agency founders, advisors, coaches with high-ticket offers and founder-led experts who already get LinkedIn activity but miss follow-up opportunities.
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader><h3 className="text-xl font-semibold text-amber-950">Safe by design</h3></CardHeader>
          <CardContent className="text-sm leading-6 text-amber-900">
            Repurly does not auto-send comments, DMs, connection requests or profile actions. The user approves and acts manually; Repurly logs and learns.
          </CardContent>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader><h3 className="text-xl font-semibold text-indigo-950">Sellable beta promise</h3></CardHeader>
          <CardContent className="text-sm leading-6 text-indigo-900">
            Save daily review time, spot warm relationships sooner, avoid over-DM mistakes, and turn real engagement into content and next actions.
          </CardContent>
        </Card>
      </section>

      <section id="pricing" className="space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-slate-950">Private beta pricing</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Start with a low-friction self-serve beta, then sell assisted pilots where the product plus weekly review creates stronger outcomes and better learning.
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
                <div className={plan.featured ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-primary'}>{plan.eyebrow}</div>
                <h3 className="mt-2 text-2xl font-semibold">{plan.name}</h3>
                <div className="mt-2 text-3xl font-semibold">{plan.priceLabel}</div>
              </CardHeader>
              <CardContent>
                <p className={plan.featured ? 'text-sm leading-6 text-slate-300' : 'text-sm leading-6 text-slate-600'}>{plan.summary}</p>
                <ul className={plan.featured ? 'mt-4 space-y-2 text-sm text-slate-300' : 'mt-4 space-y-2 text-sm text-slate-600'}>
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
            <h2 className="text-2xl font-semibold text-slate-950">Ready to run your LinkedIn opportunity desk?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Join the private beta if LinkedIn already creates useful signals for you, but you need a better operating rhythm for replies, relationships and follow-up.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up?plan=core" className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white">
              Join Pro Beta
            </Link>
            <Link href="mailto:support@repurly.org?subject=Repurly%20Assisted%20Beta" className="inline-flex items-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
              Ask about assisted beta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
