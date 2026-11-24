import type { MarketingStage } from '@/lib/marketing/portfolio';

export type StarterPost = {
  key: string;
  title: string;
  body: string;
  brief: string;
};

export type StarterPortfolioBrand = {
  name: string;
  legacyName?: string;
  tagline?: string;
  slug: string;
  website: string | null;
  marketingStage: MarketingStage;
  audience: string;
  defaultTone: string;
  primaryCta: string;
  secondaryCta: string;
  hashtags: string[];
  campaignGoal: string;
  positioning: string;
  posts: StarterPost[];
};

/**
 * Owner-project-specific starting copy. These are review-only drafts,
 * never evidence of product launch, customer results or a live integration.
 */
export const starterPortfolio: readonly StarterPortfolioBrand[] = [
  {
    name: 'Jakoma Ltd',
    legacyName: 'Jakoma',
    slug: 'jakoma',
    website: 'https://jakoma.org',
    marketingStage: 'audience_building',
    audience: 'UK business owners, professional services leaders and assurance-led organisations exploring practical AI governance, data assurance and automation.',
    defaultTone: 'Clear, evidence-led, pragmatic, confident without overclaiming.',
    primaryCta: 'Explore the AI Governance Triage',
    secondaryCta: 'Start a conversation about responsible AI and data delivery',
    hashtags: ['AIGovernance', 'DataAssurance', 'ResponsibleAI'],
    campaignGoal: 'Build relevant conversations around practical AI governance and assurance.',
    positioning: 'Practical AI, data, automation and assurance support for organisations where trust, evidence and delivery matter.',
    posts: [
      {
        key: 'jakoma-evidence-before-policy',
        title: 'An AI policy is a starting point, not proof',
        brief: 'Educational thought-leadership post about evidence and operational assurance; do not claim proven client outcomes.',
        body: `Having an AI policy is important. Knowing whether it is followed in practice is a different question.

If you were asked to demonstrate responsible AI use tomorrow, what would you show?

Start with the evidence trail: clear ownership, staff guidance, approval records, exceptions, training and periodic checks.

A policy sets the expectation. The day-to-day records help show whether that expectation is being met.

At Jakoma Ltd, this is the kind of practical governance question we think organisations should be asking before problems arise.

What is hardest to evidence in your organisation: ownership, decisions or day-to-day use?

#AIGovernance #ResponsibleAI #DataAssurance`,
      },
      {
        key: 'jakoma-triage-first',
        title: 'Start small with a governance triage',
        brief: 'Explain a risk-first AI governance discussion; avoid guarantees, endorsements or pricing claims.',
        body: `You do not need a 100-page AI strategy to identify the first control gap.

A practical triage can start with five questions:

Who is using AI? What information is involved? Who approves higher-risk uses? What evidence is retained? Who reviews exceptions?

The answers do not solve every risk, but they help clarify where attention is needed.

Jakoma Ltd takes an evidence-led approach to AI, data and operational assurance.

If you are trying to work out where to start, our AI Governance Triage is an entry point for a structured conversation.

#AIGovernance #RiskManagement #ResponsibleAI`,
      },
      {
        key: 'jakoma-automation-controls',
        title: 'Automation should make decisions easier to evidence',
        brief: 'Position responsible workflow automation without invented savings or service claims.',
        body: `The best automation does not just move work faster. It makes responsibilities and exceptions easier to see.

Before automating a process, ask:

Who owns the decision? What needs human approval? What happens when something fails? What is recorded for review?

When those questions are unanswered, even a polished workflow can create new risks.

At Jakoma Ltd, we are interested in technology that supports practical delivery and accountable decisions.

Which manual process in your organisation needs clarity before it needs automation?

#Automation #DataGovernance #OperationalAssurance`,
      },
    ],
  },
  {
    name: 'JP Bookkeeping',
    legacyName: 'Period Close Workbench',
    slug: 'period-close-workbench',
    website: null,
    marketingStage: 'private_build',
    audience: 'UK bookkeepers, accountants and owner-managed businesses organising monthly or quarterly bookkeeping and document review.',
    defaultTone: 'Practical, reassuring, precise, straightforward; avoid promises of automation or accuracy.',
    primaryCta: 'Share your biggest period-close bottleneck',
    secondaryCta: 'Discuss what a useful review checklist should include',
    hashtags: ['Bookkeeping', 'AccountingWorkflow', 'SmallBusiness'],
    campaignGoal: 'Learn how bookkeeping teams currently collect, review and resolve period-close evidence.',
    positioning: 'JP Bookkeeping is the provisional portfolio identity for the in-development Period Close Workbench (PCWB) software. The final customer-facing software name is still under review.',
    posts: [
      {
        key: 'pcwb-month-end-bottleneck',
        title: 'The hardest part of month-end is often the missing context',
        brief: 'Educational research post about bookkeeping processes. Do not claim the workbench is live.',
        body: `A missing receipt is rarely just a missing file.

It can mean another email, another reminder and another decision that nobody is sure has been made.

For small bookkeeping teams, a useful period-close checklist should make three things obvious: what arrived, what still needs attention and who owns the next step.

We are exploring these questions while developing JP Bookkeeping.

What is the slowest part of your month-end or quarter-end process: chasing documents, checking transactions or resolving exceptions?

#Bookkeeping #AccountingWorkflow #SmallBusiness`,
      },
      {
        key: 'pcwb-review-trail',
        title: 'Can someone else follow your review trail?',
        brief: 'Discuss reviewability and handover without claiming live product controls.',
        body: `Imagine a colleague had to take over a bookkeeping review tomorrow.

Could they tell which documents were checked, which items were queried and what still needed approval?

A good handover should not depend on remembering a chain of messages.

We are developing JP Bookkeeping with these workflow questions in mind. The product remains in development, and the focus right now is learning what makes a review genuinely useful.

What is one detail you wish every handover included?

#Bookkeeping #ProcessImprovement #AccountingWorkflow`,
      },
      {
        key: 'pcwb-synthetic-testing',
        title: 'Why fictional test data matters in finance software',
        brief: 'Describe responsible product development. Avoid claiming production readiness.',
        body: `Financial workflows deserve careful testing.

Before a new tool touches real client records, it should be possible to check permissions, document handling, review steps and exception reporting using fictional data.

That is the approach we are taking while developing JP Bookkeeping.

It may be less glamorous than a launch announcement, but trustworthy workflow design starts with knowing what has actually been tested.

If you review financial documents, which safeguard would you want demonstrated first?

#AccountingTechnology #DataProtection #Bookkeeping`,
      },
    ],
  },
  {
    name: "Lorri-Lou's Learning Hub",
    legacyName: 'EduSmart',
    tagline: 'Little Steps, Big Lightbulbs',
    slug: 'edusmart',
    website: null,
    marketingStage: 'private_build',
    audience: 'Secondary school learners, parents and teachers in Northern Ireland (CCEA) and Norway seeking structured revision and useful feedback.',
    defaultTone: 'Encouraging, clear, accessible, curriculum-aware, realistic about AI limits.',
    primaryCta: 'Tell us your biggest revision challenge',
    secondaryCta: 'Suggest a topic for a sample practice exercise',
    hashtags: ['Revision', 'StudySkills', 'EducationTechnology'],
    campaignGoal: 'Understand revision and feedback problems before inviting product testers.',
    positioning: 'Curriculum-aware revision platform in development, initially focused on Northern Ireland and Norway.',
    posts: [
      {
        key: 'edusmart-explain-your-working',
        title: 'A right answer does not always mean a secure understanding',
        brief: 'Study-skills post; no claim that the platform can grade exams accurately.',
        body: `Getting a maths answer right feels good. Explaining why it is right is often the better test of understanding.

A useful revision routine is simple:

Try a question. Explain your method. Check your working. Then try a similar question without the example beside you.

Lorri-Lou's Learning Hub is an in-development idea for bringing structured practice and feedback together, starting with curriculum pathways in Northern Ireland and Norway.

What helps most when revising: worked examples, short quizzes or feedback on mistakes?

#Revision #MathsRevision #StudySkills`,
      },
      {
        key: 'edusmart-feedback-over-volume',
        title: 'More practice is not always better practice',
        brief: 'Discuss targeted feedback and weak-topic review without product efficacy claims.',
        body: `Doing ten more questions can help. But if the same misunderstanding appears in all ten, feedback matters just as much as volume.

An effective practice session should help a learner notice what went wrong and what to try differently next time.

As Lorri-Lou's Learning Hub develops, we are exploring how curriculum-aware practice and clearer explanations could support that process.

Parents and teachers: where do learners get stuck most often — starting a question, understanding feedback or remembering methods later?

#StudySkills #EducationTechnology #Revision`,
      },
      {
        key: 'edusmart-curriculum-specific',
        title: 'Revision tools should understand the curriculum',
        brief: 'Validate demand across CCEA Northern Ireland and Norway without claiming official endorsement.',
        body: `A revision resource is much more useful when it matches what a learner is actually studying.

Topics, assessment styles and terminology vary across education systems. That matters when building practice questions and explaining answers.

Lorri-Lou's Learning Hub is being developed with Northern Ireland and Norway as its first curriculum tracks. It is not an official examination-board service.

Which topic would you most like to see broken down into a clear, step-by-step practice exercise?

#EducationTechnology #Revision #StudySkills`,
      },
    ],
  },
  {
    name: 'MarbriA',
    legacyName: 'Family Support',
    tagline: 'Family & Home, Connected.',
    slug: 'family-support',
    website: null,
    marketingStage: 'private_build',
    audience: 'Families and unpaid carers coordinating shared visits, practical home tasks, food supplies and handovers for relatives.',
    defaultTone: 'Warm, calm, practical, respectful, privacy-conscious; never imply clinical or emergency monitoring.',
    primaryCta: 'Share a family-care coordination challenge',
    secondaryCta: 'Suggest a feature that would simplify a handover',
    hashtags: ['FamilyCarers', 'CareCoordination', 'HomeSafety'],
    campaignGoal: 'Listen to family carers about coordination, handovers and practical home-safety tasks.',
    positioning: 'MarbriA — Family Care & Home Safety. Private early-stage development of a family coordination and home-safety planning tool, not a live monitoring service.',
    posts: [
      {
        key: 'family-support-handover',
        title: 'The handover nobody wants to forget',
        brief: 'Practical family carer coordination topic; no medical or safety monitoring claims.',
        body: `When family members share caring responsibilities, the smallest details can be the easiest to miss.

Has someone eaten? Was a shopping item used? Which appointment needs a lift? Who is covering the next visit?

A short, shared handover can reduce confusion without replacing anyone's judgement.

We are exploring practical family coordination ideas in an early-stage MarbriA app. It is not a care service or emergency monitoring system.

What one detail do you wish was always included when someone hands over?

#FamilyCarers #CareCoordination #HomeSupport`,
      },
      {
        key: 'family-support-rota-consent',
        title: 'A proposed rota is not the same as a confirmed rota',
        brief: 'Explain explicit acceptance in a shared family rota, without suggesting real safety coverage.',
        body: `Putting somebody's name beside a shift does not mean they have agreed to cover it.

That difference matters when several relatives are trying to coordinate visits around work, travel and other commitments.

In our early MarbriA development, we are focusing on the distinction between a suggested arrangement and one a person has actually accepted.

This is a planning concept, not verified coverage or a replacement for direct family communication.

What makes a shared family rota work well in practice?

#FamilyCarers #CareCoordination #SharedResponsibilities`,
      },
      {
        key: 'family-support-home-checklist',
        title: 'A practical home-safety checklist starts with observation',
        brief: 'Non-clinical housekeeping and coordination, no real-time alert claims.',
        body: `A home-safety conversation can begin with ordinary questions.

Is a walking route clear? Is lighting adequate? Are frequently used items easy to reach? Who is responsible for following up a concern?

These are prompts for family discussion, not a professional assessment.

Our MarbriA app is in private development, including ideas for shared home-action lists and handovers. It does not currently provide live sensor alerts, emergency response or clinical monitoring.

Which small household task is hardest to coordinate across the family?

#HomeSafety #FamilyCarers #CareCoordination`,
      },
    ],
  },
];

/** A prior starter draft can be refreshed only if its body still equals the
 * exact unedited original text. User-edited drafts are never overwritten. */
export function originalStarterDraftBody(starter: StarterPortfolioBrand, draft: StarterPost): string {
  return starter.legacyName ? draft.body.replaceAll(starter.name, starter.legacyName) : draft.body;
}
