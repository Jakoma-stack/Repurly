/** Fictional, aggregate-only rehearsal. Never mix with live LinkedIn or CRM data. */
export type CommunityMetric = { id: string; topic: string; impressions: number; reactions: number; comments: number };
export const fictionalCommunityMetrics: readonly CommunityMetric[] = [
  { id: 'fictional-1', topic: 'Practical governance checklist', impressions: 1200, reactions: 36, comments: 8 },
  { id: 'fictional-2', topic: 'Responsible automation', impressions: 800, reactions: 12, comments: 4 },
  { id: 'fictional-3', topic: 'Evidence-led assurance', impressions: 0, reactions: 0, comments: 0 },
];
export function summariseCommunityMetrics(rows: readonly CommunityMetric[]) {
  const valid = rows.filter(row => [row.impressions, row.reactions, row.comments].every(n => Number.isSafeInteger(n) && n >= 0));
  const totals = valid.reduce((sum, row) => ({ impressions: sum.impressions + row.impressions, reactions: sum.reactions + row.reactions, comments: sum.comments + row.comments }), { impressions: 0, reactions: 0, comments: 0 });
  const ranked = valid.filter(row => row.impressions > 0).map(row => ({ ...row, interactionRate: 100 * (row.reactions + row.comments) / row.impressions })).sort((a,b) => b.interactionRate - a.interactionRate || a.id.localeCompare(b.id));
  return { ...totals, interactionRate: totals.impressions > 0 ? 100 * (totals.reactions + totals.comments) / totals.impressions : null, ranked, excluded: rows.length - valid.length };
}
export function communityReviewSuggestions(rows: readonly CommunityMetric[]) {
  const summary = summariseCommunityMetrics(rows);
  return [
    summary.ranked.length ? 'Review the strongest observed topic: ' + summary.ranked[0].topic + '. Test another educational post; do not infer causation or buying intent.' : 'Collect sufficient aggregate performance evidence before comparing topics.',
    'Review company-page comments in the authorised interface and prepare public replies for human approval.',
    'Check the selected brand, page destination and factual claims before approving any content.',
  ];
}
