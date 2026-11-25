/** Private community setup preview. No network requests, writes, scheduling or publishing. */
export const communityBrandProfiles = [
  {
    slug: 'everyday-harbour',
    name: 'Everyday Harbour',
    aliases: [],
    audience: 'People seeking local connection, belonging and everyday wellbeing.',
    voice: 'Warm, calm, practical, inclusive and low-pressure.',
    contentIdeas: [
      'A gentle invitation to connect with other people locally.',
      'A welcoming question about small everyday routines.',
      'A community poll to learn which activities people would like.',
    ],
  },
  {
    slug: 'dip-and-sip-ni',
    name: 'Dip & Sip NI',
    aliases: ['Dip & Sip NI | by Everyday Harbour', 'Dip and Sip NI'],
    audience: 'Northern Ireland community members interested in outdoor dips and social connection.',
    voice: 'Friendly, encouraging, conversational and grounded in local community.',
    contentIdeas: [
      'A welcoming introduction for new members.',
      'A poll about preferred future social activities; no confirmed dates.',
      'A reminder to check the organiser’s current event and safety information before attending.',
    ],
  },
] as const;

type ExistingCommunityBrand = { name: string; slug: string | null; status: string };
type CommunityProfile = (typeof communityBrandProfiles)[number];
const normalise = (value: string | null) => (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
function matches(profile: CommunityProfile, brand: ExistingCommunityBrand) {
  return normalise(brand.slug) === profile.slug ||
    [profile.name, ...profile.aliases].some(name => normalise(name) === normalise(brand.name));
}

export function communityBrandPreflight(brands: readonly ExistingCommunityBrand[]) {
  return communityBrandProfiles.map(profile => {
    const matching = brands.filter(brand => matches(profile, brand));
    // A conflicting name/slug can match both profiles; do not choose an identity.
    const conflicting = matching.some(brand =>
      communityBrandProfiles.filter(candidate => matches(candidate, brand)).length > 1);
    const state = conflicting || matching.length > 1 ? 'review-conflict' :
      matching.length === 0 ? 'not-found' : 'preserve-existing';
    return {
      profile,
      state,
      existing: state === 'preserve-existing' ? matching[0] : null,
    } as const;
  });
}

export function canPreviewCommunityBrands(role: string, approvedPilot: boolean) {
  return approvedPilot && role === 'owner';
}
