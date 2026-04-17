export type BuildBrandIntelligenceArgs = {
  brandName: string;
  website?: string | null;
  audience?: string | null;
  defaultTone?: string | null;
  primaryCta?: string | null;
  secondaryCta?: string | null;
  linkedinProfileUrl?: string | null;
  linkedinCompanyUrl?: string | null;
  metadata?: unknown;
};

export type BrandIntelligence = {
  websiteSummary: string | null;
  websiteEvidence: string[];
  proofPoints: string[];
  restrictedClaims: string[];
};

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitLines(value: unknown) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => compact(item))
    .filter(Boolean);
}

export async function buildBrandIntelligence(args: BuildBrandIntelligenceArgs): Promise<BrandIntelligence> {
  const aiProfile = (args.metadata && typeof args.metadata === 'object'
    ? (args.metadata as Record<string, unknown>).aiProfile
    : null) as Record<string, unknown> | null;

  const proofPoints = splitLines(aiProfile?.proofPoints);
  const restrictedClaims = splitLines(aiProfile?.complianceRules);

  const websiteSummaryParts = [
    args.brandName,
    args.audience,
    args.defaultTone,
    args.primaryCta,
    args.secondaryCta,
  ].filter(Boolean).map((item) => compact(String(item)));

  const websiteSummary = websiteSummaryParts.length
    ? websiteSummaryParts.join(' · ')
    : null;

  const websiteEvidence = [args.website, args.linkedinProfileUrl, args.linkedinCompanyUrl]
    .filter(Boolean)
    .map((item) => compact(String(item)));

  return {
    websiteSummary,
    websiteEvidence,
    proofPoints,
    restrictedClaims,
  };
}
