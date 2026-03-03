'use client';

import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import type { CopilotResponse } from '@/lib/copilot/schema';

type CopilotDraftsListProps = {
  drafts: CopilotResponse['drafts'];
};

export function CopilotDraftsList({ drafts }: CopilotDraftsListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!drafts.length) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد مسودات بعد.</p>;
  }

  return (
    <ul className="space-y-3">
      {drafts.map((draft, index) => (
        <li key={`${draft.title}:${index}`} className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{draft.title}</p>
            <button
              type="button"
              className={buttonVariants('ghost', 'sm')}
              onClick={async () => {
                await navigator.clipboard.writeText(draft.content_markdown);
                setCopiedIndex(index);
                setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1200);
              }}
            >
              {copiedIndex === index ? 'تم النسخ' : 'نسخ للمستند'}
            </button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{draft.content_markdown}</pre>
        </li>
      ))}
    </ul>
  );
}
