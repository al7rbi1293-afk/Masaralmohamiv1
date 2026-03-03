import type { CopilotResponse } from '@/lib/copilot/schema';

type CopilotCitationListProps = {
  citations: CopilotResponse['citations'];
};

export function CopilotCitationList({ citations }: CopilotCitationListProps) {
  if (!citations.length) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد إحالات بعد.</p>;
  }

  return (
    <ul className="space-y-3">
      {citations.map((citation) => (
        <li key={`${citation.chunkId}:${citation.quote.slice(0, 40)}`} className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-brand-navy dark:text-slate-100">{citation.label}</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{citation.quote}</p>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">chunkId: {citation.chunkId}</p>
        </li>
      ))}
    </ul>
  );
}
