import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildOutreachDrafts, outreachGuardrailNote } from '../../src/lib/outreach/copilot';
import { PLAN_CATALOG } from '../../src/lib/billing/catalog';

const pages = [
  'src/app/app/settings/page.tsx',
  'src/app/app/billing/page.tsx',
  'src/app/app/channels/page.tsx',
  'src/app/app/opportunity-settings/page.tsx',
  'src/app/app/relationships/page.tsx',
  'src/app/app/content/page.tsx',
  'src/app/app/proof-score/page.tsx',
  'src/app/(marketing)/page.tsx',
  'src/app/(marketing)/privacy/page.tsx',
  'src/app/(marketing)/terms/page.tsx',
  'src/app/app/outreach-copilot/page.tsx',
  'src/components/marketing/hero.tsx',
  'src/lib/billing/catalog.ts',
];

test('audited Janeomi pages do not reintroduce the legacy display name', () => {
  for (const path of pages) {
    const source = readFileSync(path, 'utf8');
    const displaySource = path.includes('/outreach-copilot/')
      ? source.replaceAll("'Repurly LinkedIn Ops Pilot'", '')
      : source;
    assert.doesNotMatch(displaySource, /\bRepurly\b/, path);
    assert.match(source, /\bJaneomi\b/, path);
  }
});

test('outreach retains the stored legacy offer identifier but displays Janeomi', () => {
  const source = readFileSync('src/app/app/outreach-copilot/page.tsx', 'utf8');
  assert.match(source, /offer === 'Repurly LinkedIn Ops Pilot' \? 'Janeomi LinkedIn Ops Pilot'/);
  assert.match(source, /value=\{offer\}>\{offerDisplayLabel\(offer\)\}/);
});


test('pricing copy uses Janeomi while retaining the existing support mailbox', () => {
  assert.match(PLAN_CATALOG.growth.summary, /Janeomi/);
  for (const plan of Object.values(PLAN_CATALOG)) {
    assert.doesNotMatch(JSON.stringify(plan), /\bRepurly\b/);
  }
  assert.match(PLAN_CATALOG.growth.ctaHref, /^mailto:support@repurly\.org\?subject=Janeomi/);
});

test('both legacy and current pilot offer names produce Janeomi draft copy', () => {
  const legacy = buildOutreachDrafts({ leadName: 'Example', offerFit: 'Repurly LinkedIn Ops Pilot' });
  const current = buildOutreachDrafts({ leadName: 'Example', offerFit: 'Janeomi LinkedIn Ops Pilot' });
  assert.deepEqual(legacy, current);
  for (const draft of Object.values(legacy)) assert.doesNotMatch(draft, /\bRepurly\b/);
  for (const draft of [legacy.firstMessage, legacy.followUp, legacy.referralAsk]) assert.match(draft, /Janeomi/);
  assert.match(outreachGuardrailNote(), /Janeomi/);
  assert.doesNotMatch(outreachGuardrailNote(), /\bRepurly\b/);
});
