import { Hero } from "@/components/marketing/hero";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const features = [
  ["Approval-first workflow", "Move one LinkedIn post from draft to review to scheduled publish without jumping between tools."],
  ["Target-aware publishing", "Route content to the right LinkedIn profile or company page with workspace-level visibility."],
  ["Recovery that operators trust", "See retries, reconnect nudges, and job detail before missed posts become client-facing issues."],
  ["Paid-pilot ready", "Sell a narrow operational wedge now, then expand only after demand and retention prove it."],
];

const pilotSteps = [
  "Connect LinkedIn for one workspace",
  "Set default company-page or executive targets",
  "Run draft, approval, and scheduled publish workflow",
  "Use activity and recovery tooling during the pilot",
];

export default function HomePage() {
  return (
    <div className="space-y-14 pb-20">
      <Hero />
      <section id="features" className="grid gap-5 md:grid-cols-2">
        {features.map(([title, body]) => (
          <Card key={title}>
            <CardHeader>
              <h3 className="text-xl font-semibold">{title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section id="pilot-offer" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-semibold">Pilot offer</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Repurly launches as a managed pilot for boutique agencies and B2B teams running LinkedIn content operations.
            </p>
            <p>
              The pilot covers one clear workflow: create content, choose the LinkedIn target, route it for approval, schedule it, and recover quickly if a publish job needs attention.
            </p>
            <p>
              It does not promise broad channel parity, social listening, or vanity-breadth features before the workflow earns the right to expand.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-semibold">What a good pilot looks like</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {pilotSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-border px-4 py-3">
                <span className="font-medium text-slate-900">{index + 1}.</span> {step}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section id="pricing" className="grid gap-5 lg:grid-cols-3">
        {[
          ["Pilot Starter", "£750 setup + £495/mo", "For one team proving the core LinkedIn workflow with hands-on support."],
          ["Pilot Growth", "£1,500 setup + £995/mo", "For agencies running multiple client workflows, approval paths, and queue operations."],
          ["Pilot Plus", "Custom", "For teams that need higher-touch onboarding, workflow tailoring, and operator support."],
        ].map(([name, price, body]) => (
          <Card key={name} className="border-slate-200">
            <CardHeader>
              <div className="text-sm font-medium text-primary">{name}</div>
              <div className="mt-2 text-3xl font-semibold">{price}</div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
