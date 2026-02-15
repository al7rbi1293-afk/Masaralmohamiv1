import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { Section } from '@/components/ui/section';
import { Container } from '@/components/ui/container';
import { UpgradeRequestForm } from '@/components/sections/upgrade-request-form';

export const metadata: Metadata = {
    title: 'ترقية الاشتراك',
    description: 'ترقية اشتراكك في منصة مسار المحامي للوصول الكامل.',
    robots: { index: false, follow: false },
};

export default function UpgradePage() {
    return (
        <Section className="py-16 sm:py-20">
            <Container className="max-w-2xl">
                <div className="text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 text-amber-600 dark:text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">
                        انتهت فترة التجربة المجانية
                    </h1>
                    <p className="mt-3 text-slate-600 dark:text-slate-300">
                        شكرًا لتجربتك منصة مسار المحامي. للاستمرار في استخدام المنصة، يمكنك ترقية اشتراكك
                        عبر التواصل مع فريقنا.
                    </p>
                </div>

                {/* Contact options */}
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <a
                        href="https://wa.me/966599222396"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 rounded-xl border border-brand-border bg-white p-5 text-center shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                        <MessageCircle className="h-6 w-6 text-green-600" />
                        <span className="text-sm font-semibold text-brand-navy dark:text-slate-100">
                            واتساب
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">أسرع طريقة للتواصل</span>
                    </a>

                    <a
                        href="mailto:masar.almohami@outlook.sa?subject=طلب ترقية اشتراك"
                        className="flex flex-col items-center gap-2 rounded-xl border border-brand-border bg-white p-5 text-center shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                        <Mail className="h-6 w-6 text-brand-emerald" />
                        <span className="text-sm font-semibold text-brand-navy dark:text-slate-100">
                            البريد الإلكتروني
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            masar.almohami@outlook.sa
                        </span>
                    </a>

                    <a
                        href="/contact?topic=activation"
                        className="flex flex-col items-center gap-2 rounded-xl border border-brand-border bg-white p-5 text-center shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                        <Phone className="h-6 w-6 text-blue-600" />
                        <span className="text-sm font-semibold text-brand-navy dark:text-slate-100">
                            حجز مكالمة
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">عرض سريع 10 دقائق</span>
                    </a>
                </div>

                {/* Upgrade request form */}
                <UpgradeRequestForm />

                <div className="mt-6 text-center">
                    <Link href="/" className="text-sm text-brand-emerald hover:underline">
                        العودة للموقع الرئيسي
                    </Link>
                </div>
            </Container>
        </Section>
    );
}
