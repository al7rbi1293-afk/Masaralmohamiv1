import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClientAction } from '../actions';

type ClientNewPageProps = {
  searchParams?: { error?: string };
};

export default function ClientNewPage({ searchParams }: ClientNewPageProps) {
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">عميل جديد</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أدخل بيانات العميل لحفظه داخل المكتب.
          </p>
        </div>
        <Link href="/app/clients" className={buttonVariants('outline', 'sm')}>
          إلغاء
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={createClientAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">النوع</span>
          <select
            name="type"
            defaultValue="person"
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="person">فرد</option>
            <option value="company">شركة</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الاسم</span>
          <input
            required
            name="name"
            minLength={2}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الهوية (اختياري)</span>
          <input
            name="identity_no"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم السجل التجاري (اختياري)</span>
          <input
            name="commercial_no"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">البريد (اختياري)</span>
          <input
            name="email"
            type="email"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الجوال (اختياري)</span>
          <input
            name="phone"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظات (اختياري)</span>
          <textarea
            name="notes"
            rows={5}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className={buttonVariants('primary', 'md')}>
            حفظ
          </button>
          <Link href="/app/clients" className={buttonVariants('outline', 'md')}>
            إلغاء
          </Link>
        </div>
      </form>
    </Card>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

