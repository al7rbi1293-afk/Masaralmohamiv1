'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { sendLawyerReplyAction } from '@/app/app/(platform)/matters/[id]/communications.actions';

export type CommunicationDisplay = {
  id: string;
  sender: 'CLIENT' | 'LAWYER';
  message: string;
  created_at: string;
  user_name: string | null;
};

type Props = {
  matterId: string;
  clientId: string;
  communications: CommunicationDisplay[];
};

export function MatterCommunicationsClient({ matterId, clientId, communications }: Props) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState('');

  // Group communications somewhat logically
  // For a simple chronological view, we just list them out.

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const text = replyText.trim();
    if (!text) {
      setError('يرجى كتابة الرد.');
      return;
    }

    setIsReplying(true);
    try {
      const result = await sendLawyerReplyAction(
        matterId,
        text,
        clientId,
        `/app/matters/${matterId}?tab=communications`
      );

      if (!result.success) {
        setError(result.error || 'نشأ خطأ أثناء إرسال الرد.');
      } else {
        setReplyText('');
      }
    } catch {
      setError('تعذر إرسال الرد. يرجى المحاولة لاحقاً.');
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {communications.map((comm) => (
          <li
            key={comm.id}
            className={`rounded-lg p-4 ${
              comm.sender === 'CLIENT'
                ? 'border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20'
                : 'border border-emerald-200 bg-emerald-50/50 ms-8 sm:ms-16 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            }`}
          >
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {comm.sender === 'CLIENT' ? 'سؤال الموكل' : 'رد المحامي'}
                </span>
                {comm.sender === 'CLIENT' ? (
                  <Badge variant="default" className="text-[10px]">استفسار</Badge>
                ) : null}
                {comm.user_name && comm.sender === 'LAWYER' ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">({comm.user_name})</span>
                ) : null}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(comm.created_at).toLocaleString('ar-SA')}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {comm.message}
            </p>
          </li>
        ))}
      </ul>

      {/* Reply Form */}
      <div className="mt-8 rounded-lg border border-brand-border p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
        <h3 className="font-semibold text-brand-navy dark:text-slate-100">إضافة رد</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          سيتم إرسال إشعار للموكل بالرد مباشرة.
        </p>

        <form onSubmit={handleReply} className="mt-4 space-y-3">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <textarea
            placeholder="اكتب ردك المستشار هنا..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[120px] w-full resize-y rounded-lg border border-brand-border p-3 text-sm outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-950"
            required
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isReplying}
              className={buttonVariants('primary', 'sm')}
            >
              {isReplying ? 'جاري الإرسال...' : 'إرسال الرد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
