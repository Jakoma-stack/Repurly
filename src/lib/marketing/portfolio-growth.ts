/** Owner-pilot editorial recommendations. Not a source of live launch status,
 * financial results or approval. Render only behind the private-pilot guard. */
export const portfolioGrowthPriorities = [
  { slug: 'repurly', name: 'Repurly', role: 'Subscription pilot', nextStep: 'Validate the daily workflow and recruit suitable supervised pilot users.', gate: 'Authenticated onboarding, workspace isolation, billing verification and a supported pilot.' },
  { slug: 'period-close-workbench', name: 'JP Bookkeeping', role: 'Commercial validation', nextStep: 'Complete a controlled period-close pilot and learn which workflow problems are worth paying to solve.', gate: 'Permission, financial-data handling, reconciliation, audit evidence and a verified pilot result.' },
  { slug: 'jakoma', name: 'Jakoma Ltd', role: 'Service enquiries', nextStep: 'Review the existing triage enquiry campaign and follow up on genuine interest.', gate: 'Verify the live enquiry route, current offer and claims before publishing.' },
  { slug: 'edusmart', name: "Lorri-Lou's Learning Hub", role: 'Seasonal audience building', nextStep: 'Focus on curriculum-specific practice and collect adult feedback before recruiting learners.', gate: 'Curriculum accuracy, safeguarding, privacy and supported learner onboarding.' },
  { slug: 'family-support', name: 'MarbriA', role: 'Controlled usability testing', nextStep: 'Validate family coordination and practical home tasks before offering a wider pilot.', gate: 'Verified safety limits, consent, permissions and reliable handovers; no monitoring claims.' },
  { slug: 'averyquant-one', name: 'AveryQuant One', role: 'Research only', nextStep: 'Keep out of active marketing and sales campaigns.', gate: 'Separate evidence, risk and regulatory review before any future commercial decision.' },
] as const;

export const portfolioWeeklyCadence = [
  { week: 1, slots: [{ slug: 'jakoma', label: 'Jakoma Ltd' }, { slug: 'repurly', label: 'Repurly' }, { slug: 'period-close-workbench', label: 'JP Bookkeeping' }] },
  { week: 2, slots: [{ slug: 'jakoma', label: 'Jakoma Ltd' }, { slug: 'edusmart', label: "Lorri-Lou's Learning Hub" }, { slug: 'repurly', label: 'Repurly' }] },
  { week: 3, slots: [{ slug: 'period-close-workbench', label: 'JP Bookkeeping' }, { slug: 'family-support', label: 'MarbriA' }, { slug: 'repurly', label: 'Repurly' }] },
  { week: 4, slots: [{ slug: 'jakoma', label: 'Jakoma Ltd' }, { slug: 'repurly', label: 'Repurly' }, { slug: 'editorial-review', label: 'Evidence-based development update or feedback review' }] },
] as const;
