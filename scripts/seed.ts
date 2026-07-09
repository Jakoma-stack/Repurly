import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'workspace';
}

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, '.env.local'));

  const clerkUserId = process.env.CLERK_USER_ID?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const workspaceName = process.env.SEED_WORKSPACE_NAME?.trim() || 'Repurly Local Workspace';
  const brandNames = (process.env.SEED_BRAND_NAMES?.trim() || process.env.SEED_BRAND_NAME?.trim() || 'Jakoma')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!databaseUrl) {
    console.error('Missing DATABASE_URL.');
    process.exit(1);
  }

  if (!clerkUserId) {
    console.error('Missing CLERK_USER_ID.');
    process.exit(1);
  }

  const { db } = await import("../src/lib/db/client");
  const { brands, engagementComments, leadPipeline, workspaceMemberships, workspaces } = await import("../drizzle/schema");

  const existingMembership = await db
    .select({ workspaceId: workspaceMemberships.workspaceId, workspaceName: workspaces.name })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.clerkUserId, clerkUserId))
    .limit(1);

  let workspaceId: string;

  if (existingMembership[0]) {
    workspaceId = existingMembership[0].workspaceId;
    console.log(`Workspace already exists for ${clerkUserId}: ${existingMembership[0].workspaceName}`);
  } else {
    const baseSlug = slugify(workspaceName);
    let workspaceSlug = baseSlug;
    let attempt = 1;

    while (true) {
      const existingWorkspace = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, workspaceSlug)).limit(1);
      if (!existingWorkspace[0]) break;
      attempt += 1;
      workspaceSlug = `${baseSlug}-${attempt}`;
    }

    const insertedWorkspace = await db
      .insert(workspaces)
      .values({
        name: workspaceName,
        slug: workspaceSlug,
        plan: 'core',
      })
      .returning({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug });

    const workspace = insertedWorkspace[0];
    workspaceId = workspace.id;

    await db.insert(workspaceMemberships).values({
      workspaceId: workspace.id,
      clerkUserId,
      role: 'owner',
    });

    console.log(`Workspace created: ${workspace.name}`);
  }

  const existingBrands = await db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.workspaceId, workspaceId));
  const existingBrandNames = new Set(existingBrands.map((brand) => brand.name));

  for (const brandName of brandNames) {
    if (existingBrandNames.has(brandName)) continue;
    await db.insert(brands).values({
      workspaceId,
      name: brandName,
      slug: slugify(brandName),
      status: 'active',
      defaultTone: 'Calm, credible, expert, practical and commercially focused. UK spelling. No hype, no fearmongering, no generic AI tips.',
      audience: 'Senior leaders, directors, CXOs, healthcare leaders, IT services leaders and organisations adopting AI who need governance, data assurance and practical controls.',
      primaryCta: 'Review the AI Governance Triage: https://jakoma.org/ai-governance-triage.html',
      secondaryCta: 'Reply if you want to pressure-test whether your AI use is available or actually governed.',
      hashtags: ['aigovernance', 'dataassurance', 'safeaiadoption', 'aireadiness'],
      linkedinProfileUrl: 'https://www.linkedin.com/in/tracy-avery',
      linkedinCompanyUrl: 'https://www.linkedin.com/company/jakoma',
      metadata: {
        betaTemplate: 'jakoma',
        publicFocus: 'AI Governance, Data Assurance, Safe AI Adoption',
        coreMessage: 'Helping organisations move from AI being available to being governed.',
        owner: 'Tracy Avery',
        website: 'https://jakoma.org',
        email: 'tracy@jakoma.org',
        offers: [
          'AI Governance Triage - £950 fixed fee',
          'AI Governance Readiness Sprint - around £3,500+ depending scope',
          'Fractional AI, Data & Transformation Leadership - £2k+/month+',
        ],
        themes: [
          'Policy is not proof',
          'Available vs governed',
          'AI readiness before scale',
          'Visibility before governance',
          'Evidence before assurance',
          'Ownership, controls, evidence and operating rhythm',
          'Copilot/informal AI use',
          'Data exposure',
          'Audit trail',
          'Practical governance',
        ],
        avoidPublicFocus: ['Repurly', 'Smart Stay', 'Independent Living', 'generic AI content tips'],
        actionRules: [
          'Do not over-DM',
          'Reply publicly to meaningful comments',
          'Profile views alone are not enough to DM',
          'New relevant followers should usually be reviewed and tracked first',
          'Move to DM only after repeated engagement, clear relevance or a natural reason',
          'Company page is credibility layer; personal LinkedIn profile is main distribution channel',
        ],
        knownRelationships: {
          'Anthony Tabbiruka': 'Highest priority partner/referral conversation. Prep agenda around readiness handing off to evidence/control/audit layer.',
          'Rob MacPhee': 'Warm NIAS/data-driven care/digital operations conversation. Light follow-up only after two working days.',
          'Juan Pedro Marquez Castorina': 'High-value Copilot governance contact. Engage publicly; no DM yet unless natural reason.',
          'Mostafa El Baroudy': 'New relevant follower. Review only, no pitch.',
          'Surya S': 'Profile view. Awareness signal only.',
          'Ricardo J Flores': 'Reaction-only signal. Monitor.',
          'Thomas List': 'Repeated profile views. No action unless stronger engagement appears.',
          'Promise Tembe': 'Relevant AI Law/Governance/Ethics/Data Protection contact. Review, no pitch.',
        },
      },
    });
  }

  const workspaceBrands = await db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.workspaceId, workspaceId));
  const firstBrand = workspaceBrands[0];

  if (firstBrand) {
    const existingComments = await db.select({ id: engagementComments.id }).from(engagementComments).where(eq(engagementComments.workspaceId, workspaceId)).limit(1);
    if (!existingComments[0]) {
      const inserted = await db.insert(engagementComments).values({
        workspaceId,
        brandId: firstBrand.id,
        platform: 'linkedin',
        commenterName: 'Judith Cousineau',
        commenterHandle: '@judith',
        sourcePostTitle: 'Policy is not proof',
        commentText: 'This distinction between policy and evidence really matters. A lot of organisations think a policy means governance is covered.',
        intentLabel: 'warm',
        intentScore: 72,
        sentiment: 'positive',
        replyOptions: [
          'Thanks Judith - exactly. A policy can show intent, but evidence shows whether governance is actually operating. That gap is where a lot of AI adoption risk sits.',
          'Completely agree. Governance becomes real when ownership, controls, evidence and operating rhythm are visible enough to manage.',
        ],
        suggestedDmText: null,
      }).returning({ id: engagementComments.id });

      await db.insert(leadPipeline).values({
        workspaceId,
        brandId: firstBrand.id,
        commentId: inserted[0].id,
        leadName: 'Judith Cousineau',
        leadHandle: '@judith',
        stage: 'warm_relationship',
        intentScore: 72,
        nextAction: 'Reply publicly where meaningful. No DM unless a natural reason appears.',
      });
    }
  }

  console.log('Seed complete.');
  console.log(`Clerk user: ${clerkUserId}`);
  console.log(`Workspace ID: ${workspaceId}`);
  console.log(`Brands: ${workspaceBrands.map((brand) => brand.name).join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
