import assert from 'node:assert/strict';
import test from 'node:test';
import { portfolioGrowthPriorities, portfolioWeeklyCadence } from '../../src/lib/marketing/portfolio-growth';
import { starterPortfolio } from '../../src/lib/marketing/portfolio-starters';
import { campaignPlaybooks } from '../../src/lib/marketing/campaign-playbooks';

test('commercial plan includes all portfolio identities, but research has no campaign', () => {
  assert.equal(portfolioGrowthPriorities.length, 6);
  assert.equal(portfolioGrowthPriorities[0].slug, 'repurly');
  assert.equal(portfolioGrowthPriorities[1].slug, 'period-close-workbench');
  assert.equal(portfolioGrowthPriorities.find(item => item.slug === 'averyquant-one')?.role, 'Research only');
  assert.ok(!starterPortfolio.some(item => item.slug === 'averyquant-one'));
  assert.ok(!campaignPlaybooks.some(item => item.brandSlug === 'averyquant-one'));
  assert.ok(portfolioGrowthPriorities.every(item => item.gate.length > 20));
});

test('shared weekly cadence allocates three review slots and never promotes research', () => {
  assert.deepEqual(portfolioWeeklyCadence.map(item => item.week), [1, 2, 3, 4]);
  const brands = new Set(starterPortfolio.map(item => item.slug));
  for (const week of portfolioWeeklyCadence) {
    assert.equal(week.slots.length, 3);
    assert.ok(week.slots.every(slot => brands.has(slot.slug) || slot.slug === 'editorial-review'));
    assert.ok(week.slots.some(slot => slot.slug === 'repurly'));
  }
  assert.equal(starterPortfolio.find(item => item.slug === 'repurly')?.marketingStage, 'private_build');
});
