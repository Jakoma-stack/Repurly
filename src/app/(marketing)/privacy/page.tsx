export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Repurly</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Privacy Notice</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Last updated: 14 May 2026. This is a practical early-stage privacy baseline and should be reviewed before broad public SaaS launch.</p>
      </div>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">1. Roles</h2>
        <p>Repurly is normally controller for account, billing, support, security and service-usage data. For customer content, lead notes and campaign data uploaded by a business customer, Repurly may act as processor on that customer's behalf, subject to an applicable Data Processing Addendum.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">2. Data processed</h2>
        <p>Repurly may process account details, workspace details, brand and offer information, campaign briefs, content drafts, approval notes, lead notes, output-channel settings, billing status, integration metadata, logs and support communications.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">3. Purposes</h2>
        <p>Data is used to provide the service, manage accounts and subscriptions, support users, secure the platform, maintain reliability, operate campaign/output workflows selected by the customer, and improve the product.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">4. AI and content</h2>
        <p>Customers should avoid entering sensitive, unnecessary or unauthorised personal data into prompts, briefs, campaign notes or lead notes. Customers remain responsible for reviewing generated content before use and for ensuring they have a lawful basis for any personal data they upload.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">5. Third parties and subprocessors</h2>
        <p>Repurly may use service providers for authentication, billing, hosting, database, email, analytics, AI processing and integrations. Production deployments should maintain an up-to-date subprocessor list and data processing terms.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">6. Retention and deletion</h2>
        <p>Account and workspace data is retained while the account is active and for a reasonable period afterwards for security, billing, audit, backup and legal reasons. Customers should export important campaign data before account closure.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">7. International transfers</h2>
        <p>Some providers may process data outside the UK. Appropriate safeguards should be used where required, such as adequacy arrangements or approved contractual protections.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-700">
        <h2 className="text-xl font-semibold text-slate-950">8. Rights and contact</h2>
        <p>For privacy requests, contact support@repurly.com. Replace this address before production launch if a dedicated privacy contact is used. Individuals may have rights to access, correct, erase, restrict or object to processing depending on the circumstances.</p>
      </section>
    </article>
  );
}
