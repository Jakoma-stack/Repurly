#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const requiredEnv = [
  'DATABASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_CORE',
  'STRIPE_PRICE_GROWTH',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'TOKEN_ENCRYPTION_SECRET',
  'OAUTH_STATE_SECRET',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_REDIRECT_URI',
  'LINKEDIN_SCOPE',
  'LINKEDIN_API_VERSION',
];

const recommendedEnv = [
  'STRIPE_PRICE_SCALE',
  'S3_ENDPOINT',
  'S3_PUBLIC_BASE_URL',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
];

const forbiddenCommercialCopy = [
  ['Solo plan name', /\bSolo\b/],
  ['Team plan name', /\bTeam\b/],
  ['Agency plan name', /\bAgency\b/],
  ['old low pricing', /£(?:19|49|59|99|199|499)\/?(?:month|mo)?/],
];

const copyFilesToCheck = [
  'src/app/(marketing)/page.tsx',
  'src/app/app/billing/page.tsx',
  'src/lib/billing/catalog.ts',
  'src/lib/billing/plans.ts',
  'pricing_overview.md',
  'OWNER_COMMERCIAL_READINESS_GUIDE.md',
  'docs/OWNER_COMMERCIAL_READINESS_GUIDE.md',
];

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    env[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const localEnv = readDotEnv(path.join(process.cwd(), '.env.local'));
const combined = { ...localEnv, ...process.env };
const failures = [];
const warnings = [];

for (const key of requiredEnv) {
  if (!combined[key]?.trim()) failures.push(`Missing ${key}`);
}

for (const key of recommendedEnv) {
  if (!combined[key]?.trim()) warnings.push(`Recommended for full production hardening: ${key}`);
}

for (const key of ['TOKEN_ENCRYPTION_SECRET', 'OAUTH_STATE_SECRET']) {
  const value = combined[key] ?? '';
  if (value.length < 32) failures.push(`${key} must be at least 32 characters`);
  if (/replace|placeholder|example|changeme/i.test(value)) failures.push(`${key} still looks like a placeholder`);
}

if (combined.SKIP_ENV_VALIDATION === 'true') {
  failures.push('SKIP_ENV_VALIDATION must not be true for staging or production readiness');
}

if (fs.existsSync(path.join(process.cwd(), '.git'))) {
  warnings.push('This working folder contains .git. That is normal for development, but do not include .git in buyer/customer handoff zips.');
}

for (const file of [
  'src/app/api/health/route.ts',
  'src/lib/billing/enforce-limits.ts',
  'drizzle/migrations/0003_stripe_webhook_events.sql',
  'docs/OWNER_COMMERCIAL_READINESS_GUIDE.md',
  'docs/LIVE_SITE_TEST_SCRIPT.md',
]) {
  if (!fs.existsSync(path.join(process.cwd(), file))) failures.push(`Missing expected file ${file}`);
}

for (const file of copyFilesToCheck) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const [label, pattern] of forbiddenCommercialCopy) {
    if (pattern.test(content)) failures.push(`Outdated commercial copy in ${file}: ${label}`);
  }
}

console.log('\nRepurly commercial readiness preflight\n');

if (warnings.length) {
  console.log('Warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log('');
}

if (failures.length) {
  console.log('Not ready yet:');
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log('Static preflight passed. Next run: npm ci && npm run typecheck && npm run lint && npm run build');
