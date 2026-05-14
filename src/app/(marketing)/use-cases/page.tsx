const snapshots = [
  {
    label: "Founder Pilot",
    title: "Consultant turns expertise into a 30-day LinkedIn-led campaign workflow.",
    starting: "The consultant had expertise and offer clarity, but content was reactive and disconnected from campaign follow-up.",
    workflow: "Repurly mapped the consultant's audience, offer, content pillars, campaign rhythm, CTAs and follow-up workflow.",
    outputs: ["30-day campaign workflow", "Offer-to-content mapping", "CTA and lead follow-up structure", "Human-in-the-loop LinkedIn-led process"]
  },
  {
    label: "Small B2B team",
    title: "Multiple offers become clearer through campaign and output-channel planning.",
    starting: "The team had several offers but lacked a simple way to turn ideas into consistent LinkedIn-led campaign assets.",
    workflow: "Repurly structured brands/offers, campaign themes, approvals and output channels.",
    outputs: ["Campaign calendar", "Draft workflow", "Approval structure", "Output-channel planning"]
  },
  {
    label: "Agency / studio",
    title: "Client content moves from scattered notes to a controlled workflow.",
    starting: "Content lived across calls, notes and messages, making approvals and changes hard to track.",
    workflow: "Repurly centralised briefs, drafts, approvals, CTAs and lead notes.",
    outputs: ["Centralised workflow", "Human approval points", "Clearer client handover", "Safer non-automation positioning"]
  }
];

export default function RepurlyUseCasesPage() {
  return (
    <main className="min-h-screen bg-[#f6fbfb] px-6 py-16 text-slate-900">
      <section className="mx-auto max-w-6xl space-y-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Anonymised snapshots</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">How Repurly turns expertise into campaign workflow.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            These are anonymised, generalised snapshots based on feedback and representative use cases. They are not fabricated testimonials, guarantees or performance claims.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {snapshots.map((item) => (
            <article key={item.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">{item.label}</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">{item.title}</h2>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <p><strong className="text-slate-950">Starting point:</strong> {item.starting}</p>
                <p><strong className="text-slate-950">Workflow:</strong> {item.workflow}</p>
                <div>
                  <strong className="text-slate-950">Practical outputs:</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {item.outputs.map((output) => <li key={output}>{output}</li>)}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-[2rem] border border-teal-100 bg-white p-6 text-sm leading-6 text-slate-700 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Proof standard</h2>
          <p className="mt-3">
            Repurly should not publish invented customers, logos, testimonials, revenue claims or lead-generation guarantees. Real founder-pilot case studies should only be published after customer consent and evidence review.
          </p>
        </div>
      </section>
    </main>
  );
}
