import assert from 'node:assert/strict';
import test from 'node:test';

import { originalStarterDraftBody, starterPortfolio } from '../../src/lib/marketing/portfolio-starters';

test('starter portfolio covers the agreed four apps, each with three review-only posts', () => {
  assert.deepEqual(starterPortfolio.map(brand => brand.name), [
    'Jakoma Ltd', 'JP Bookkeeping', "Lorri-Lou's Learning Hub", 'MarbriA',
  ]);

  assert.equal(new Set(starterPortfolio.map(brand => brand.slug)).size, 4);
  assert.equal(starterPortfolio.reduce((sum, brand) => sum + brand.posts.length, 0), 12);

  const keys: string[] = [];
  for (const brand of starterPortfolio) {
    assert.notEqual(brand.marketingStage, 'public_launch');
    assert.ok(brand.audience.length > 30);
    assert.ok(brand.defaultTone.length > 10);
    assert.ok(brand.primaryCta.length > 10 && brand.primaryCta.length <= 160);
    assert.equal(brand.posts.length, 3);
    assert.ok(brand.name.length <= 120);

    for (const post of brand.posts) {
      keys.push(post.key);
      assert.ok(post.title.length > 10 && post.title.length <= 160);
      assert.ok(post.body.length > 100);
      assert.ok(post.brief.length > 20);
      assert.doesNotMatch(post.body, /available now|buy today|guaranteed results|now live/gi);
    }
  }
  assert.equal(new Set(keys).size, keys.length);
});

test('agreed names are distinct from the unchanged internal repository slugs', () => {
  const edu = starterPortfolio.find(brand => brand.slug === 'edusmart');
  const family = starterPortfolio.find(brand => brand.slug === 'family-support');
  const bookkeeping = starterPortfolio.find(brand => brand.slug === 'period-close-workbench');

  assert.equal(edu?.name, "Lorri-Lou's Learning Hub");
  assert.equal(edu?.legacyName, 'EduSmart');
  assert.equal(edu?.tagline, 'Little Steps, Big Lightbulbs');
  assert.equal(family?.name, 'MarbriA');
  assert.equal(family?.legacyName, 'Family Support');
  assert.equal(family?.tagline, 'Family & Home, Connected.');
  assert.equal(bookkeeping?.name, 'JP Bookkeeping');
  assert.equal(bookkeeping?.legacyName, 'Period Close Workbench');
  assert.equal(bookkeeping?.slug, 'period-close-workbench');
  assert.ok(bookkeeping.posts.every(post => post.body.includes('JP Bookkeeping')));

  for (const starter of starterPortfolio.filter(brand => brand.legacyName)) {
    for (const draft of starter.posts) {
      assert.notEqual(originalStarterDraftBody(starter, draft), draft.body,
        'Every renamed brand draft must have a recognisable original version');
      assert.ok(draft.body.includes(starter.name),
        'Every refreshed draft must include the correct product identity');
    }
  }
});

test('family care starter posts do not claim a live safety-monitoring service', () => {
  const family = starterPortfolio.find(brand => brand.slug === 'family-support');
  assert.ok(family);
  assert.equal(family.marketingStage, 'private_build');
  assert.ok(family.posts.every(post => /not |does not|early|development|exploring|planning concept/i.test(post.body)));
});
