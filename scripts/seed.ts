import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));

  const clerkUserId = process.env.CLERK_USER_ID?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const workspaceName = process.env.SEED_WORKSPACE_NAME?.trim() || "Repurly Local Workspace";
  const brandName = process.env.SEED_BRAND_NAME?.trim() || "Default Brand";

  if (!databaseUrl) {
    console.error("Missing DATABASE_URL.");
    console.error("Put DATABASE_URL in .env");
    process.exit(1);
  }

  if (!clerkUserId) {
    console.error("Missing CLERK_USER_ID.");
    console.error("Add CLERK_USER_ID=user_xxx to .env.local");
    process.exit(1);
  }

  const { db } = await import("../src/lib/db/client");
  const { brands, workspaceMemberships, workspaces } = await import("../drizzle/schema");

  function slugify(value: string) {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100) || "workspace"
    );
  }

  const baseSlug = slugify(workspaceName);

  const existingMembership = await db
    .select({
      workspaceId: workspaceMemberships.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.clerkUserId, clerkUserId))
    .limit(1);

  if (existingMembership[0]) {
    console.log(`Workspace already exists for ${clerkUserId}: ${existingMembership[0].workspaceName}`);
    return;
  }

  let workspaceSlug = baseSlug;
  let attempt = 1;

  while (true) {
    const existingWorkspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, workspaceSlug))
      .limit(1);

    if (!existingWorkspace[0]) break;
    attempt += 1;
    workspaceSlug = `${baseSlug}-${attempt}`;
  }

  const insertedWorkspace = await db
    .insert(workspaces)
    .values({
      name: workspaceName,
      slug: workspaceSlug,
      plan: "starter",
    })
    .returning({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug });

  const workspace = insertedWorkspace[0];

  await db.insert(workspaceMemberships).values({
    workspaceId: workspace.id,
    clerkUserId,
    role: "owner",
  });

  await db.insert(brands).values({
    workspaceId: workspace.id,
    name: brandName,
    defaultTone: "clear, concise, approval-first",
  });

  console.log("Seed complete.");
  console.log(`Workspace: ${workspace.name}`);
  console.log(`Slug: ${workspace.slug}`);
  console.log(`Clerk user: ${clerkUserId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
