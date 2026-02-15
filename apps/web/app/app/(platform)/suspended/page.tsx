import Link from 'next/link';

export default function SuspendedPage() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-900/40 dark:bg-slate-900">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold text-red-700 dark:text-red-300">تم تعليق الحساب</h1>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    تم تعليق حسابك أو مكتبك. للاستفسار، يرجى التواصل مع إدارة النظام.
                </p>
                <div className="mt-6">
                    <Link
                        href="/contact"
                        className="inline-block rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-navy/90"
                    >
                        تواصل معنا
                    </Link>
                </div>
            </div>
        </div>
    );
}
