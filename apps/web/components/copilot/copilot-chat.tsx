'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { sendCopilotMessage } from '@/lib/copilot/client';
import type { CopilotResponse } from '@/lib/copilot/schema';
import { CopilotTemplateButtons } from './copilot-template-buttons';
import { CopilotPanels } from './copilot-panels';
import { CopilotErrorState } from './copilot-error-state';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type CopilotChatProps = {
  caseId: string;
  caseTitle: string;
  isRestricted: boolean;
};

export function CopilotChat({ caseId, caseTitle, isRestricted }: CopilotChatProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestResponse, setLatestResponse] = useState<CopilotResponse | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const hasConversation = useMemo(() => messages.length > 0, [messages.length]);

  async function submitMessage(nextMessage: string, template?: 'summarize_case' | 'draft_response' | 'extract_timeline' | 'hearing_plan') {
    const normalized = nextMessage.trim();
    if (!normalized || isLoading) return;

    setError('');
    setIsLoading(true);

    const userBubble: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: normalized,
    };
    setMessages((current) => [...current, userBubble]);
    setMessage('');

    try {
      const result = await sendCopilotMessage({
        case_id: caseId,
        message: normalized,
        session_id: sessionId,
        template,
      });

      if (result.sessionId) {
        setSessionId(result.sessionId);
      }

      setLatestResponse(result.data);
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.data.answer_markdown,
        },
      ]);
    } catch (requestError: any) {
      const payload = requestError?.payload;
      const fallback = payload?.answer_markdown || requestError?.message || 'تعذر التواصل مع المساعد القانوني.';
      setError(fallback);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="rounded-xl2 border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-3 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">المساعد القانوني للقضية</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{caseTitle}</p>
          </div>
          {isRestricted ? <Badge variant="warning">قضية مقيّدة</Badge> : <Badge variant="default">قضية عامة</Badge>}
        </div>

        <div className="mt-4">
          <CopilotTemplateButtons
            disabled={isLoading}
            onTemplateSelect={(template, templateMessage) => {
              void submitMessage(templateMessage, template);
            }}
          />
        </div>

        {error ? (
          <div className="mt-4">
            <CopilotErrorState message={error} />
          </div>
        ) : null}

        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-brand-border bg-brand-background/40 p-3 dark:border-slate-700 dark:bg-slate-950/40">
          {!hasConversation ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">ابدأ بسؤال أو استخدم أحد القوالب الجاهزة.</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'ms-auto max-w-[85%] bg-brand-emerald text-white'
                    : 'max-w-[92%] border border-brand-border bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage(message);
          }}
        >
          <textarea
            className="min-h-20 flex-1 rounded-lg border border-brand-border bg-white p-3 text-sm outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="اكتب سؤالك القانوني هنا..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading} className={buttonVariants('primary', 'md')}>
            {isLoading ? 'جاري المعالجة...' : 'إرسال'}
          </button>
        </form>
      </section>

      <CopilotPanels response={latestResponse} />
    </div>
  );
}
