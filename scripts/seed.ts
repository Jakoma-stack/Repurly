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
  const brandNames = (process.env.SEED_BRAND_NAMES?.trim() || process.env.SEED_BRAND_NAME?.trim() || 'Default Brand, Client Brand B')
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

  const { db } = await import('../lib/db/client');
  const { brands, engagementComments, leadPipeline, workspaceMemberships, workspaces } = await import('../drizzle/schema');

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
      defaultTone: 'Clear, commercially realistic, and LinkedIn-first',
      audience: 'Boutique agencies and B2B marketing teams',
      primaryCta: 'Reply "workflow" and I will send the checklist.',
      secondaryCta: 'DM me if you want to pressure-test your current setup.',
      hashtags: ['linkedin', 'contentops', 'b2bmarketing'],
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
        commenterName: 'Jordan Lee',
        commenterHandle: '@jordan',
        sourcePostTitle: 'Why narrow content workflows win',
        commentText: 'This is useful. Curious how you handle multiple brands and approvals without slowing everything down?',
        intentLabel: 'warm',
        intentScore: 68,
        sentiment: 'positive',
        replyOptions: [
          'Thanks. The main fix is to keep one operating workflow while giving each brand its own voice and approval path.',
          'Appreciate that. We have found multiple brands only work when the workflow stays tight underneath.',
        ],
        suggestedDmText: 'Thanks for the comment. If helpful, I can send over the workflow we use for multi-brand approval and scheduling.',
      }).returning({ id: engagementComments.id });

      await db.insert(leadPipeline).values({
        workspaceId,
        brandId: firstBrand.id,
        commentId: inserted[0].id,
        leadName: 'Jordan Lee',
        leadHandle: '@jordan',
        stage: 'new',
        intentScore: 68,
        nextAction: 'Reply publicly, then send DM if interest continues.',
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
