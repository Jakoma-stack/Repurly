import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";

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
  if (!clerkUserId) {
    console.error("Missing CLERK_USER_ID.");
    console.error("Add CLERK_USER_ID=user_xxx to .env.local");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Missing DATABASE_URL.");
    console.error("Put DATABASE_URL in .env");
    process.exit(1);
  }

  const { db } = await import("../lib/db/client");
  const { integrations, platformAccounts, workspaceMemberships, workspaces } = await import("../drizzle/schema");

  const membership = await db
    .select({
      workspaceId: workspaceMemberships.workspaceId,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.clerkUserId, clerkUserId))
    .limit(1);

  const workspace = membership[0];
  if (!workspace) {
    console.error("No workspace membership found for this Clerk user.");
    console.error("Run the workspace seed first.");
    process.exit(1);
  }

 const integration = await db
    .select({
      id: integrations.id,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspace.workspaceId),
        eq(integrations.provider, "linkedin"),
      ),
    )
    .limit(1);

  let integrationId = integration[0]?.id;

  if (!integrationId) {
    const inserted = await db
      .insert(integrations)
      .values({
        workspaceId: workspace.workspaceId,
        provider: "linkedin",
        externalAccountId: "fake-linkedin-integration",
        status: "connected",
        scopes: ["w_member_social", "r_organization_social"],
        metadata: {
          seeded: true,
          fake: true,
          providerLabel: "LinkedIn",
        },
      })
      .returning({ id: integrations.id });

    integrationId = inserted[0].id;
  }

  const existingTarget = await db
    .select({ id: platformAccounts.id, displayName: platformAccounts.displayName })
    .from(platformAccounts)
    .where(
      and(
        eq(platformAccounts.workspaceId, workspace.workspaceId),
        eq(platformAccounts.provider, "linkedin"),
      ),
    )
    .limit(1);

  if (existingTarget[0]) {
    console.log(`LinkedIn target already exists: ${existingTarget[0].displayName}`);
    return;
  }

  const insertedTarget = await db
    .insert(platformAccounts)
    .values({
      workspaceId: workspace.workspaceId,
      integrationId,
      provider: "linkedin",
      handle: "@repurly-local",
      displayName: "Repurly Local LinkedIn Page",
      externalAccountId: "fake-linkedin-page-001",
      targetType: "organization",
      isDefault: true,
      publishEnabled: true,
      metadata: {
        seeded: true,
        fake: true,
        url: "https://www.linkedin.com/company/repurly-local",
      },
    })
    .returning({
      id: platformAccounts.id,
      displayName: platformAccounts.displayName,
      handle: platformAccounts.handle,
    });

  const target = insertedTarget[0];

  console.log("Fake LinkedIn target seed complete.");
  console.log(`Workspace: ${workspace.workspaceName}`);
  console.log(`Target: ${target.displayName}`);
  console.log(`Handle: ${target.handle}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
