'use client';

import { useMemo, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import type { CopilotResponse } from '@/lib/copilot/schema';
import { CopilotCitationList } from './copilot-citation-list';
import { CopilotDraftsList } from './copilot-drafts-list';
import { CopilotActionItems } from './copilot-action-items';

type CopilotPanelsProps = {
  response: CopilotResponse | null;
};

export function CopilotPanels({ response }: CopilotPanelsProps) {
  const [tab, setTab] = useState<'citations' | 'drafts' | 'actions'>('citations');

  const hasData = useMemo(
    () => Boolean(response && (response.citations.length || response.drafts.length || response.action_items.length)),
    [response],
  );

  return (
    <aside className="rounded-xl2 border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2 border-b border-brand-border pb-3 dark:border-slate-700">
        <button type="button" className={buttonVariants(tab === 'citations' ? 'primary' : 'outline', 'sm')} onClick={() => setTab('citations')}>
          الإحالات
        </button>
        <button type="button" className={buttonVariants(tab === 'drafts' ? 'primary' : 'outline', 'sm')} onClick={() => setTab('drafts')}>
          المسودات
        </button>
        <button type="button" className={buttonVariants(tab === 'actions' ? 'primary' : 'outline', 'sm')} onClick={() => setTab('actions')}>
          عناصر العمل
        </button>
      </div>

      <div className="mt-4">
        {!response || !hasData ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">ستظهر هنا الإحالات والمسودات بعد أول إجابة من المساعد.</p>
        ) : tab === 'citations' ? (
          <CopilotCitationList citations={response.citations} />
        ) : tab === 'drafts' ? (
          <CopilotDraftsList drafts={response.drafts} />
        ) : (
          <CopilotActionItems actionItems={response.action_items} missingInfoQuestions={response.missing_info_questions} />
        )}
      </div>
    </aside>
  );
}
