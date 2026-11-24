import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
