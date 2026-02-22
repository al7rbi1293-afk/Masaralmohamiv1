import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/app/actions';
import { Container } from '@/components/ui/container';
import { SentryClientInit } from '@/components/observability/sentry-client-init';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { isAppAdmin } from '@/lib/admin';
import { LogOut, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
    title: 'لوحة الإدارة — مسار المحامي',
    robots: { index: false, follow: false },
};

type AdminLayoutProps = {
    children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
    const user = await getCurrentAuthUser();

    if (!user) {
        redirect('/auth/login');
    }

    if (!isAppAdmin()) {
        redirect('/app');
    }

    return (
        <div className="flex min-h-screen flex-col">
            <SentryClientInit />
            <header className="border-b border-gray-200 bg-white">
                <Container className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link href="/admin" className="text-lg font-semibold text-gray-900">
                        لوحة الإدارة
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/app"
                            className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                            <ShieldAlert className="h-4 w-4" />
                            العودة للتطبيق
                        </Link>
                        <form action={signOutAction}>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800"
                            >
                                <LogOut className="h-4 w-4" />
                                تسجيل الخروج
                            </button>
                        </form>
                    </div>
                </Container>
            </header>

            <Container className="px-4 py-8 sm:px-6 lg:px-8">
                {children}
            </Container>
        </div>
    );
}
