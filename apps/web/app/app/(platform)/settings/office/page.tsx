import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { getTrialStatusForCurrentUser } from '@/lib/trial';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { OfficeIdentityForm } from './client';

export const metadata = {
    title: 'إعداد هوية المكتب | مسار المحامي',
};

export default async function OfficeIdentityPage() {
    const [user, trial] = await Promise.all([
        getCurrentAuthUser(),
        getTrialStatusForCurrentUser(),
    ]);

    if (!user) {
        redirect('/signin');
    }

    const orgId = trial.orgId;

    if (!orgId) {
        // If somehow a user reaches here without an org, gracefully handle it
        return (
            <Card className="p-6">
                <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100 mb-4">إعداد هوية المكتب</h2>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/20 dark:text-yellow-300">
                    يبدو أنه لا يوجد مكتب مرتبط بحسابك حالياً. يرجى التواصل مع الدعم الفني.
                </div>
            </Card>
        );
    }

    const supabase = createSupabaseServerRlsClient();

    // Fetch the current organization info
    const { data: organization } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle();

    const csrfToken = headers().get('X-CSRF-Token') || '';

    return (
        <Card className="p-6">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">إعداد هوية المكتب</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    البيانات المدخلة هنا سيتم استخدامها في ترويسات المستندات والفواتير الصادرة من النظام.
                </p>
            </div>

            <OfficeIdentityForm currentName={organization?.name || ''} csrfToken={csrfToken} />
        </Card>
    );
}
