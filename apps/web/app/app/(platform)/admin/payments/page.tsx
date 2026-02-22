import { listPendingPaymentRequests } from '@/lib/payments';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { approveRequestAction, rejectRequestAction } from './actions';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
    // Simple Admin Check
    const user = await getCurrentAuthUser();

    // TODO: Use Env var or DB role
    const ADMIN_EMAILS = ['admin@masar.sa', 'masar.almohami@outlook.sa'];
    if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
        // Optional: Redirect or Show Error
        // return redirect('/app');
        // keeping it accessible for dev if needed, or show strict error
        return (
            <div className="p-8 text-center text-red-600">
                <h1>وصول غير مصرح به (Admin Only)</h1>
                <p>بريدك الحالي: {user?.email}</p>
            </div>
        );
    }

    const requests = await listPendingPaymentRequests();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">طلبات الدفع المعلقة</h1>

            {!requests || requests.length === 0 ? (
                <Card className="p-6 text-center text-slate-500">
                    لا توجد طلبات دفع جديدة.
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests.map((req: any) => (
                        <Card key={req.id} className="p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                            {req.organization?.name || 'منظمة غير معروفة'}
                                        </span>
                                        <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                                            {req.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        المستخدم: {req.user?.email}
                                    </p>
                                    <p className="mt-2 font-mono text-sm">
                                        الخطة: <strong>{req.plan_code}</strong> ({req.billing_period === 'yearly' ? 'سنوي' : 'شهري'})
                                    </p>
                                    <p className="text-sm">
                                        المبلغ: <strong className="text-brand-emerald">{req.amount} {req.currency}</strong>
                                    </p>

                                    {req.bank_reference && (
                                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                                            المرجع البنكي: <code className="bg-slate-100 px-1 py-0.5 rounded">{req.bank_reference}</code>
                                        </p>
                                    )}

                                    <p className="text-xs text-slate-400 mt-1">
                                        تاريخ الطلب: {new Date(req.created_at).toLocaleString('ar-SA')}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <form action={async () => {
                                        'use server';
                                        await rejectRequestAction(req.id, 'Rejected by admin');
                                    }}>
                                        <Button variant="outline" type="submit" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                                            رفض
                                        </Button>
                                    </form>

                                    <form action={async () => {
                                        'use server';
                                        await approveRequestAction(req.id);
                                    }}>
                                        <Button type="submit">
                                            قبول وتفعيل
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
