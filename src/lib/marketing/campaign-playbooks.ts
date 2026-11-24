import { starterPortfolio } from '@/lib/marketing/portfolio-starters';

export type CampaignWeek = {
  week: 1 | 2 | 3 | 4;
  theme: string;
  outcome: string;
  draftKey: string | null;
  reviewNote: string;
};

export type CampaignPlaybook = {
  brandSlug: string;
  focus: string;
  goal: string;
  primaryAudience: string;
  conversion: string;
  guardrail: string;
  publicOfferUrl: string | null;
  holdProductLaunchClaims: boolean;
  weeks: readonly CampaignWeek[];
};

/**
 * Editorial playbooks only. Nothing in this module schedules, approves or
 * publishes content, creates a real lead, or establishes a customer result.
 * Week four is intentionally reserved for feedback, not an invented post.
 */
export const campaignPlaybooks: readonly CampaignPlaybook[] = [
  {
    brandSlug: 'jakoma',
    focus: 'Evidence-led AI governance, with a real triage enquiry route',
    goal: 'Useful conversations with leaders who need to understand AI ownership, control gaps and evidence.',
    primaryAudience: 'UK leadership, data, risk, assurance and operational decision-makers',
    conversion: 'Relevant response or an AI Governance Triage enquiry',
    guardrail: 'Verify the destination, scope and price on the live Jakoma page before publishing. Do not invent customer outcomes, certifications or endorsements.',
    publicOfferUrl: 'https://jakoma.org/ai-governance-triage.html',
    holdProductLaunchClaims: false,
    weeks: [
      {
        week: 1,
        theme: 'An AI policy is not evidence of implementation',
        outcome: 'Help prospects recognise an assurance problem',
        draftKey: 'jakoma-evidence-before-policy',
        reviewNote: 'Strong educational opener. Keep it practical; avoid fictional case studies or claims of proven results.',
      },
      {
        week: 2,
        theme: 'The five questions in an AI governance triage',
        outcome: 'Give interested leaders a real enquiry route',
        draftKey: 'jakoma-triage-first',
        reviewNote: 'Ensure the final post links to Jakoma’s request form, not an assumed instant booking or direct payment.',
      },
      {
        week: 3,
        theme: 'Better automation starts with decision ownership',
        outcome: 'Show the breadth of Jakoma’s evidence-led approach',
        draftKey: 'jakoma-automation-controls',
        reviewNote: 'Good third topic. Retain a conversation prompt, with no unsupported savings or impact percentages.',
      },
      {
        week: 4,
        theme: 'Review enquiries and recurring objections',
        outcome: 'Turn genuine audience questions into the next content cycle',
        draftKey: null,
        reviewNote: 'Check actual comments and enquiry quality. Draft an FAQ only from questions that genuinely arose.',
      },
    ],
  },
  {
    brandSlug: 'period-close-workbench',
    focus: 'Bookkeeping pain points and workflow discovery',
    goal: 'Understand the document, exception and sign-off problems bookkeepers would want solved.',
    primaryAudience: 'UK bookkeepers, accountants and owner-managed businesses',
    conversion: 'Specific workflow feedback and opt-in early interest, not sales',
    guardrail: 'JP Bookkeeping is a provisional portfolio name honouring John Potts. PCWB remains internal. Do not claim the software is launched or that the public product name is cleared.',
    publicOfferUrl: null,
    holdProductLaunchClaims: true,
    weeks: [
      {
        week: 1,
        theme: 'Missing context at period close',
        outcome: 'Identify the most common bottleneck',
        draftKey: 'pcwb-month-end-bottleneck',
        reviewNote: 'Ask about existing work, without promoting an unavailable product or requesting confidential documents.',
      },
      {
        week: 2,
        theme: 'Could another bookkeeper follow your review trail?',
        outcome: 'Understand handover and audit-trail requirements',
        draftKey: 'pcwb-review-trail',
        reviewNote: 'Frame this as discovery, not evidence that the app already delivers the feature.',
      },
      {
        week: 3,
        theme: 'Why fictional data matters in financial workflow testing',
        outcome: 'Build confidence in the product development approach',
        draftKey: 'pcwb-synthetic-testing',
        reviewNote: 'Keep claims restricted to work actually verified; do not suggest real customer data is in production.',
      },
      {
        week: 4,
        theme: 'Review top three customer workflow problems',
        outcome: 'Prioritise features and decide whether to invite genuine testers',
        draftKey: null,
        reviewNote: 'Record only consented feedback. Do not announce a public beta without a supported beta process.',
      },
    ],
  },
  {
    brandSlug: 'edusmart',
    focus: 'Helpful revision advice before a software launch',
    goal: 'Learn what parents, educators and learners find missing in ordinary revision tools.',
    primaryAudience: 'Parents, teachers and other adults supporting CCEA and Norwegian secondary education',
    conversion: 'Opt-in adult feedback about study challenges',
    guardrail: 'Lorri-Lou’s Learning Hub is in private build. Do not imply CCEA or Norwegian authority endorsement, verified marks improvement, or access to a finished app. Avoid collecting children’s data.',
    publicOfferUrl: null,
    holdProductLaunchClaims: true,
    weeks: [
      {
        week: 1,
        theme: 'Explain your working',
        outcome: 'Share a usable revision technique',
        draftKey: 'edusmart-explain-your-working',
        reviewNote: 'Direct discussion towards parents and teachers, not collecting individual student details.',
      },
      {
        week: 2,
        theme: 'Feedback matters as much as more practice',
        outcome: 'Discover which explanations learners need',
        draftKey: 'edusmart-feedback-over-volume',
        reviewNote: 'Make this educational, without claiming measured learning gains from an untested product.',
      },
      {
        week: 3,
        theme: 'Curriculum-specific revision',
        outcome: 'Validate interest across Northern Ireland and Norway',
        draftKey: 'edusmart-curriculum-specific',
        reviewNote: 'CCEA and Norway are curricular references, not claims of official partnership.',
      },
      {
        week: 4,
        theme: 'Collect topic suggestions from adults',
        outcome: 'Choose two sample practice topics for future validation',
        draftKey: null,
        reviewNote: 'Use adult opt-in only; do not collect identifiable pupil work or personal information.',
      },
    ],
  },
  {
    brandSlug: 'family-support',
    focus: 'Family handovers and non-clinical home coordination',
    goal: 'Understand the practical challenges shared carers have with information and responsibilities.',
    primaryAudience: 'Adult family members and unpaid carers',
    conversion: 'Opt-in feature suggestions from adults',
    guardrail: 'MarbriA is in private build. Do not present it as live fall monitoring, emergency response, clinical advice or verified care coverage. Avoid inviting personal medical stories.',
    publicOfferUrl: null,
    holdProductLaunchClaims: true,
    weeks: [
      {
        week: 1,
        theme: 'The handover nobody wants to forget',
        outcome: 'Understand daily communication needs',
        draftKey: 'family-support-handover',
        reviewNote: 'Focus on general routines; do not ask families to reveal a relative’s private health information.',
      },
      {
        week: 2,
        theme: 'A proposed rota is not an accepted rota',
        outcome: 'Understand acceptance and cover expectations',
        draftKey: 'family-support-rota-consent',
        reviewNote: 'Do not suggest a digital rota guarantees that someone is present or safe.',
      },
      {
        week: 3,
        theme: 'A practical home-safety conversation',
        outcome: 'Test demand for shared follow-up tasks',
        draftKey: 'family-support-home-checklist',
        reviewNote: 'Keep advice general and non-clinical. Never imply connected sensors or emergency dispatch are already working.',
      },
      {
        week: 4,
        theme: 'Group feedback into practical needs',
        outcome: 'Identify which features deserve usability testing',
        draftKey: null,
        reviewNote: 'Discuss anonymised themes, not identifiable patient or household information.',
      },
    ],
  },
  {
    brandSlug: 'repurly',
    focus: 'Validate the opportunity desk with expert-led businesses',
    goal: 'Find suitable prospective pilot users and test whether human-reviewed follow-up solves a recurring problem.',
    primaryAudience: 'B2B consultants, fractional leaders, agency founders and expert-led businesses',
    conversion: 'Relevant conversations and opt-in pilot interest; not a paid conversion until access and billing are verified',
    guardrail: 'Repurly is in private testing. Do not claim a public launch, a working checkout, autonomous outreach or proven sales results. Obtain explicit approval for every external action.',
    publicOfferUrl: null,
    holdProductLaunchClaims: true,
    weeks: [
      { week: 1, theme: 'Engagement versus commercial intent', outcome: 'Identify follow-up problems', draftKey: 'repurly-engagement-to-opportunity', reviewNote: 'Ask about real workflow challenges; do not infer buying intent from likes.' },
      { week: 2, theme: 'Human-approved follow-up', outcome: 'Validate appetite for assisted decisions', draftKey: 'repurly-human-approved-followup', reviewNote: 'Keep the user in control of every reply, direct message and publication.' },
      { week: 3, theme: 'One workflow for separate brands', outcome: 'Identify suitable supervised pilot users', draftKey: 'repurly-one-marketing-workflow', reviewNote: 'Describe private testing accurately; do not promise an available paid subscription.' },
      { week: 4, theme: 'Review pilot interest and objections', outcome: 'Decide whether a supported paid pilot is ready', draftKey: null, reviewNote: 'Record genuine feedback and verify onboarding, pricing and billing before making an offer.' },
    ],
  },
];

export function findPlaybook(slug: string) {
  return campaignPlaybooks.find(plan => plan.brandSlug === slug) ?? null;
}

export function findStarterDraftBody(brandSlug: string, starterKey: string) {
  const starter = starterPortfolio.find(item => item.slug === brandSlug);
  return starter?.posts.find(item => item.key === starterKey)?.body ?? null;
}

/**
 * Revised copy for a real, source-verified Jakoma enquiry route.
 * This can be applied only to an untouched original draft and only via a
 * user-triggered, authenticated review action.
 */
export const reviewedJakomaTriagePost = `Before AI use expands, can your organisation demonstrate who owns the risks?

A practical first check needs five answers:

1. Which AI tools and use cases are already in use?
2. What information goes into them?
3. Who owns decisions and approves higher-risk uses?
4. Which controls and records provide assurance?
5. Who reviews exceptions as use changes?

When the answers are unclear, it helps to identify priorities before starting a major transformation programme.

Jakoma Ltd offers an AI Governance Triage focused on current use, risk, ownership, controls and practical next steps. Start with the request form so the fit can be checked before booking:

https://jakoma.org/ai-governance-triage.html

#AIGovernance #ResponsibleAI #DataAssurance`;
