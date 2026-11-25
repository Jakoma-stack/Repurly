import assert from 'node:assert/strict';
import test from 'node:test';
import { canPreviewCommunityBrands, communityBrandPreflight, communityBrandProfiles } from '../../src/lib/marketing/community-brand-preflight';

test('two community brands remain distinct and contain only proposed evergreen content', () => {
  assert.deepEqual(communityBrandProfiles.map(profile => profile.slug), ['everyday-harbour', 'dip-and-sip-ni']);
  assert.equal(new Set(communityBrandProfiles.map(profile => profile.voice)).size, 2);
  const result = communityBrandPreflight([]);
  assert.deepEqual(result.map(row => row.state), ['not-found', 'not-found']);
  assert.ok(result.every(row => row.existing === null));
  assert.ok(communityBrandProfiles.every(profile => profile.contentIdeas.length === 3));
});

test('existing custom, paused and inactive brand records are preserved without mutation', () => {
  const brands = [
    { name: 'Everyday Harbour', slug: 'legacy-harbour', status: 'paused', logo: 'owner-supplied' },
    { name: '  Dip & Sip NI | by Everyday Harbour ', slug: null, status: 'active' },
    { name: 'Distant Kitchens, Close Hearts', slug: 'distant-kitchens', status: 'inactive' },
  ];
  const before = JSON.stringify(brands);
  const result = communityBrandPreflight(brands);
  assert.deepEqual(result.map(row => row.state), ['preserve-existing', 'preserve-existing']);
  assert.equal(result[0].existing?.status, 'paused');
  assert.equal(result[1].existing?.slug, null);
  assert.equal(JSON.stringify(brands), before);
  assert.equal(brands.length, 3);
});

test('stable slug matches custom display name; duplicate matches require review', () => {
  const bySlug = communityBrandPreflight([{ name: 'Custom Harbour Name', slug: 'everyday-harbour', status: 'active' }]);
  assert.equal(bySlug[0].state, 'preserve-existing');
  assert.equal(bySlug[0].existing?.name, 'Custom Harbour Name');
  const duplicated = communityBrandPreflight([
    { name: 'Everyday Harbour', slug: 'original', status: 'active' },
    { name: 'Duplicate', slug: 'everyday-harbour', status: 'active' },
  ]);
  assert.equal(duplicated[0].state, 'review-conflict');
  assert.equal(duplicated[0].existing, null);
});

test('one conflicting record must never bind both communities', () => {
  const result = communityBrandPreflight([{ name: 'Everyday Harbour', slug: 'dip-and-sip-ni', status: 'active' }]);
  assert.deepEqual(result.map(row => row.state), ['review-conflict', 'review-conflict']);
  assert.ok(result.every(row => row.existing === null));
});

test('community preflight is restricted to the approved private pilot owner', () => {
  for (const role of ['admin', 'editor', 'member', 'viewer', '']) {
    assert.equal(canPreviewCommunityBrands(role, true), false);
  }
  assert.equal(canPreviewCommunityBrands('owner', false), false);
  assert.equal(canPreviewCommunityBrands('owner', true), true);
});
