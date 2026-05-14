export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Repurly</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Terms of Service</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Last updated: 14 May 2026. These terms are an early-stage B2B SaaS baseline and should be solicitor-reviewed before broad self-serve launch.</p>
      </div>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">1. Service scope</h2>
        <p>Repurly provides a LinkedIn-led campaign, content planning, approval, output-channel and lead workflow for consultants, agencies, founders and B2B teams.</p>
        <p>Repurly supports human-approved marketing operations. It does not guarantee leads, sales, platform reach, impressions, booked calls or account outcomes.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">2. Human-in-the-loop and platform safety</h2>
        <p>Repurly is designed for human review and approval. It does not provide scraping, automated direct messages, fake engagement, auto-connecting, auto-commenting, account-risk automation, or any workflow intended to bypass platform rules.</p>
        <p>Customers remain responsible for complying with LinkedIn and other platform terms, marketing rules, privacy law and their own internal approvals.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">3. Customer responsibilities</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Review and approve all content before publication or use.</li>
          <li>Ensure claims are accurate, lawful, substantiated and not misleading.</li>
          <li>Ensure outreach, follow-up and lead handling complies with privacy and marketing rules.</li>
          <li>Use only data you are authorised to upload, process or store in Repurly.</li>
          <li>Do not enter unnecessary sensitive personal data into briefs, prompts, campaign notes or lead notes.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">4. Subscriptions, pilots and billing</h2>
        <p>Subscription access is based on the plan purchased. Plan limits may include workspace members, brands/offers, monthly posts or drafts, campaign/output channels, approval workflows and support level.</p>
        <p>Founder pilots, implementation and done-with-you support may be sold separately from self-serve subscriptions. They may have separate statements of work, timelines, deliverables and fees.</p>
        <p>Unless otherwise stated, subscriptions renew until cancelled. Customers should be able to cancel through the billing portal or by contacting support. Cancellation stops future renewals but does not normally refund past periods already used, unless required by law or agreed in writing.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">5. Acceptable use</h2>
        <p>Customers must not use Repurly for spam, unlawful marketing, harassment, impersonation, misleading claims, regulated promotions without approval, scraping, fake engagement, unauthorised data collection, malware, infringement, or activity that breaches third-party platform terms.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">6. AI-assisted outputs</h2>
        <p>AI-assisted drafts may be incomplete, inaccurate, unsuitable or require editing. Customers must review outputs before use and remain responsible for final content, approvals and publication decisions.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">7. Availability and changes</h2>
        <p>Repurly may change features, limits, integrations and workflows over time. Third-party platform APIs, permissions, policies and outages may affect availability. Repurly will take reasonable steps to maintain service reliability but does not guarantee uninterrupted access.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">8. Data, confidentiality and deletion</h2>
        <p>Repurly will handle customer data as described in the Privacy Notice and, for business customers processing personal data through the service, any applicable Data Processing Addendum. Customers should export important content before closing an account.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">9. Liability</h2>
        <p>Repurly is not responsible for loss caused by customer content decisions, platform enforcement, account restrictions, unauthorised customer data, third-party outages, or use outside the agreed service scope. Nothing in these terms excludes liability that cannot legally be excluded.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">10. Support</h2>
        <p>For support or account queries, contact support@repurly.com. Replace this address before production launch if a different support address is used.</p>
      </section>
    </article>
  );
}
