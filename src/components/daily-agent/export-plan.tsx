'use client';

import { useMemo, useState } from 'react';
import type { DailyAgentBriefing } from '@/lib/ai/daily-agent';

export function ExportDailyPlan({ briefing, sessionDate }: { briefing: DailyAgentBriefing; sessionDate: string }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    const lines = [
      `Repurly Daily LinkedIn Plan — ${sessionDate}`,
      '',
      'Summary:',
      briefing.summary,
      '',
      'What changed:',
      ...briefing.whatChanged.map((item) => `- ${item}`),
      '',
      'Who matters:',
      ...briefing.whoMatters.map((item) => `- ${item.name} (${item.priority}, ${item.recommendedChannel.replace(/_/g, ' ')}): ${item.reason} Next: ${item.suggestedAction}`),
      '',
      'Replies:',
      ...briefing.replyQueue.map((item) => `- ${item.personName} (${item.recommendedChannel.replace(/_/g, ' ')}): ${item.draftReply}`),
      '',
      'Follow-ups:',
      ...briefing.followUps.map((item) => `- ${item.personName} (${item.recommendedChannel.replace(/_/g, ' ')}): ${item.action}${item.draft ? ` Draft: ${item.draft}` : ''}`),
      '',
      'Tomorrow content idea:',
      briefing.tomorrowContentIdea.hook,
      briefing.tomorrowContentIdea.draftPost,
    ];
    return lines.join('\n');
  }, [briefing, sessionDate]);

  async function copyPlan() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" onClick={copyPlan} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
      {copied ? 'Daily plan copied' : 'Export / copy daily plan'}
    </button>
  );
}
