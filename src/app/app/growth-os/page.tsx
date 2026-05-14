import { Card, CardContent, CardHeader } from '@/components/ui/card';

const portfolio = [
  {
    offer: 'Jakoma B2B consulting',
    audience: 'AI, data, governance, operations, and assurance leaders',
    cta: 'Request AI Governance Triage',
    output: 'LinkedIn posts, checklist CTAs, proposal follow-up, board-level explainers, and triage nurture.',
  },
  {
    offer: 'Independent Living Tech',
    audience: 'Families, carers, homeowners, local referral partners, and supported living settings',
    cta: 'Book Home Tech Assessment',
    output: 'Local posts, Google Business/Profile copy, WhatsApp referral messages, flyer copy, and family FAQs.',
  },
  {
    offer: 'Toolkits',
    audience: 'Operators who need templates before they are ready for consulting',
    cta: 'Download or buy toolkit',
    output: 'Checklist posts, product launches, email nurture, how-to posts, and template explainers.',
  },
  {
    offer: 'Repurly',
    audience: 'Consultants, agencies, founders, and B2B operators',
    cta: 'Apply for Founder Pilot',
    output: 'Build-in-public posts, demo CTAs, founder pilot pitches, case studies, and workflow explainers.',
  },
];


const outputChannels = [
  'LinkedIn post',
  'LinkedIn carousel outline',
  'Facebook Page post',
  'Instagram caption',
  'Google Business Profile update',
  'Email/newsletter',
  'Blog post',
  'YouTube title, description, chapters, and script',
  'TikTok/Reels hook, caption, and shot list',
  'Threads post',
  'X post/thread export',
  'WhatsApp/referral message',
];

const modules = [
  'Offer and CTA library',
  'Audience and ICP notes',
  'Campaign calendar',
  'One idea to multi-format content',
  'Approval and safety checks',
  'Lead notes and follow-up reminders',
  'Weekly performance review',
  'Export packs for LinkedIn, Facebook Page, Instagram, Google Business Profile, email, blog, YouTube/TikTok scripts, Threads, X, and WhatsApp',
];

export default function GrowthOsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">Growth OS</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950">
          Run every offer from one LinkedIn-led campaign and revenue workflow.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          Repurly should be used internally first: plan campaigns, draft content, route approvals, track CTAs, log leads, and keep follow-up human-approved across multiple offers before scaling it as SaaS or a managed service.
        </p>
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
          Human-in-the-loop rule: Repurly supports campaign workflow, drafting, approvals, and lead follow-up notes. It does not provide scraping, automated DMs, fake engagement, or account-risk automation.
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {portfolio.map((item) => (
          <Card key={item.offer}>
            <CardHeader>
              <h2 className="text-xl font-semibold text-slate-950">{item.offer}</h2>
              <p className="text-sm text-muted-foreground">Audience: {item.audience}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p><strong className="text-slate-950">Primary CTA:</strong> {item.cta}</p>
              <p><strong className="text-slate-950">Repurly should produce:</strong> {item.output}</p>
            </CardContent>
          </Card>
        ))}
      </section>


      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-950">Campaign/output channels</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Channel limits mean how many destinations Repurly helps plan, adapt, approve, export, or publish to where integrations are enabled. LinkedIn remains the primary launch workflow; supporting channels should be treated as export and campaign assets until their direct integrations are approved and tested.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {outputChannels.map((channel) => (
            <div key={channel} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{channel}</div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card">
        <h2 className="text-2xl font-semibold text-slate-950">Build priority</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          The first commercially useful version is not a full social suite. It is a campaign operating system that turns expertise into consistent content, lead capture, and human-approved follow-up.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {modules.map((module) => (
            <div key={module} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{module}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
