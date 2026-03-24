'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Download, FileSpreadsheet, MessageSquareText, MoveLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  getLawyerSurveyAnswerPairs,
  summarizeLawyerSurveyResponses,
  type LawyerSurveyResponse,
} from '@/lib/survey-utils';

const summaryCards = [
  { key: 'total', label: 'إجمالي الردود', icon: ClipboardList },
  { key: 'activeUsageCount', label: 'مستخدمون نشطون/جزئيون', icon: MessageSquareText },
  { key: 'inactiveUsageCount', label: 'لم يبدأوا أو توقفوا', icon: MessageSquareText },
  { key: 'followUpCount', label: 'طلبوا تواصلًا', icon: MessageSquareText },
] as const;

export default function AdminLawyerSurveyPage() {
  const [responses, setResponses] = useState<LawyerSurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch('/admin/api/surveys/lawyers');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تحميل الردود.');
      }
      setResponses(data.responses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الردود.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = summarizeLawyerSurveyResponses(responses);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">جارٍ تحميل الردود...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl border border-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-brand-emerald">ردود استبيان المحامين</p>
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">
              عرض كامل لإجابات المحامين والمكاتب
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              هذه الصفحة تعرض جميع ردود الاستبيان كاملة بدون اختصار، مع إمكانية التصدير إلى
              `CSV` أو `Excel` لمراجعتها أو مشاركتها مع الفريق.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin" className={buttonVariants('outline', 'md')}>
              <MoveLeft className="ms-2 h-4 w-4" />
              العودة للإدارة
            </Link>
            <a href="/admin/api/surveys/lawyers/export?format=csv" className={buttonVariants('outline', 'md')}>
              <Download className="ms-2 h-4 w-4" />
              تصدير CSV
            </a>
            <a href="/admin/api/surveys/lawyers/export?format=xlsx" className={buttonVariants('primary', 'md')}>
              <FileSpreadsheet className="ms-2 h-4 w-4" />
              تصدير Excel
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            const value = summary[card.key as keyof typeof summary] || 0;
            return (
              <article
                key={card.key}
                className="rounded-xl border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-emerald dark:bg-slate-900">
                  <Icon size={18} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-brand-navy dark:text-slate-100">
                  {value}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      {!responses.length ? (
        <div className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          لا توجد ردود لاستبيان المحامين حتى الآن.
        </div>
      ) : (
        <div className="space-y-4">
          {responses.map((response, index) => {
            const answerPairs = getLawyerSurveyAnswerPairs(response);
            return (
              <details
                key={response.id}
                open={index === 0}
                className="group overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <summary className="cursor-pointer list-none p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold text-brand-navy dark:text-slate-100">
                          {response.fullName}
                        </span>
                        <span className="rounded-full bg-brand-background px-3 py-1 text-xs font-medium text-brand-emerald dark:bg-slate-800">
                          {response.answers['حالة الاستخدام'] ?? 'غير محدد'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {response.firmName || 'بدون اسم مكتب'} • {response.email}
                        {response.phone ? ` • ${response.phone}` : ''}
                      </p>
                    </div>

                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(response.createdAt).toLocaleString('ar-SA')}
                    </div>
                  </div>
                </summary>

                <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {answerPairs.map((item) => (
                      <article
                        key={`${response.id}-${item.label}`}
                        className="rounded-xl border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-brand-navy dark:text-slate-100">
                          {item.value}
                        </p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <article className="rounded-xl border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">الرابط المرجعي</p>
                      <p className="mt-2 break-all text-sm leading-7 text-slate-700 dark:text-slate-300">
                        {response.referrer || '—'}
                      </p>
                    </article>

                    <article className="rounded-xl border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">الرسالة الخام المخزنة</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-300">
                        {response.rawMessage || '—'}
                      </pre>
                    </article>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
