'use client';

import { useEffect, useState } from 'react';
import { Building, Calendar, Users, Activity, Shield, CreditCard, Search } from 'lucide-react';
import {
    SlideOver,
    SlideOverContent,
    SlideOverHeader,
    SlideOverTitle,
    SlideOverDescription,
} from '@/components/ui/slide-over';

type Org = {
    id: string;
    name: string;
    status: string;
    created_at: string;
    members_count: number;
    subscription: {
        plan: string | null;
        status: string;
        payment_status: string;
        current_period_end: string | null;
    } | null;
    trial: {
        ends_at: string | null;
        status: string;
    } | null;
};

export default function AdminOrgsPage() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
    const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 20;

    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(true);
            fetch(`/admin/api/orgs?query=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`)
                .then((r) => r.json())
                .then((d) => {
                    setOrgs(d.orgs ?? []);
                    setTotalCount(d.total_count ?? 0);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }, 400);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, page]);

    async function handleAction(orgId: string, action: 'suspend' | 'activate' | 'grant_lifetime' | 'extend_trial' | 'set_expiry' | 'activate_paid' | 'set_plan', extraData?: any) {
        if (action === 'grant_lifetime') {
            const proceed = window.confirm('هل أنت متأكد من منح هذا المكتب اشتراك مدى الحياة؟');
            if (!proceed) return;
        }

        if (action === 'set_expiry') {
            const rawDate = window.prompt('أدخل تاريخ الانتهاء الجديد (سنة-شهر-يوم) مثال: 2025-12-31', new Date().toISOString().split('T')[0]);
            if (!rawDate) return;
            const dateObj = new Date(rawDate);
            if (isNaN(dateObj.getTime())) {
                alert('تاريخ غير صحيح. الرجاء إدخال تاريخ بصيغة صحيحة (مثال: 2025-12-31)');
                return;
            }
            extraData = { ends_at: dateObj.toISOString() };
        }

        if (action === 'activate_paid') {
            const rawMonths = window.prompt('كم شهر تريد تفعيل الحساب له؟', '12');
            if (!rawMonths) return;
            const months = parseInt(rawMonths);
            if (isNaN(months) || months <= 0) {
                alert('الرجاء إدخال عدد أشهر صحيح.');
                return;
            }
            extraData = { months };
        }

        setActionId(orgId);
        await fetch('/admin/api/orgs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: orgId, action, ...extraData }),
        });
        const res = await fetch('/admin/api/orgs');
        const data = await res.json();
        setOrgs(data.orgs ?? []);
        setActionId(null);
    }

    async function handleBulkAction(action: 'suspend' | 'activate') {
        if (selectedOrgIds.size === 0) return;
        const confirmMessage = `هل أنت متأكد من تنفيذ هذا الإجراء على ${selectedOrgIds.size} مكتب؟`;

        if (!window.confirm(confirmMessage)) return;

        setActionId('bulk');

        try {
            const orgIdsArray = Array.from(selectedOrgIds);
            const res = await fetch('/admin/api/orgs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_ids: orgIdsArray, action }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((payload as { error?: string }).error || 'تعذر تنفيذ الإجراء المجمّع.');
            }
            const refreshRes = await fetch('/admin/api/orgs');
            const data = await refreshRes.json();
            setOrgs(data.orgs ?? []);
            setSelectedOrgIds(new Set());
        } catch (error) {
            const message = error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء المجمّع.';
            alert(message);
        } finally {
            setActionId(null);
        }
    }

    function toggleSelection(orgId: string) {
        const newSet = new Set(selectedOrgIds);
        if (newSet.has(orgId)) {
            newSet.delete(orgId);
        } else {
            newSet.add(orgId);
        }
        setSelectedOrgIds(newSet);
    }

    function toggleAllSelection(orgIds: string[]) {
        const allSelected = orgIds.every(id => selectedOrgIds.has(id));
        const newSet = new Set(selectedOrgIds);

        if (allSelected) {
            orgIds.forEach(id => newSet.delete(id));
        } else {
            orgIds.forEach(id => newSet.add(id));
        }
        setSelectedOrgIds(newSet);
    }

    if (loading) {
        return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">المكاتب</h1>

            {/* Global Search Bar */}
            <div className="relative mb-6 max-w-md">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                    type="text"
                    className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm placeholder-slate-400 focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
                    placeholder="البحث باسم المكتب..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {orgs.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد مكاتب.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="py-3 px-3 w-12 text-start">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                                        checked={orgs.length > 0 && orgs.every(o => selectedOrgIds.has(o.id))}
                                        onChange={() => toggleAllSelection(orgs.map(o => o.id))}
                                    />
                                </th>
                                <th className="py-3 text-start font-medium">اسم المكتب</th>
                                <th className="py-3 text-start font-medium">الأعضاء</th>
                                <th className="py-3 text-start font-medium">الخطة</th>
                                <th className="py-3 text-start font-medium">حالة الاشتراك</th>
                                <th className="py-3 text-start font-medium">حالة المكتب</th>
                                <th className="py-3 text-start font-medium">الانتهاء</th>
                                <th className="py-3 text-start font-medium">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {orgs.map((org) => (
                                <tr
                                    key={org.id}
                                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedOrgIds.has(org.id) ? 'bg-brand-emerald/5 dark:bg-emerald-500/10' : ''}`}
                                    onClick={() => setSelectedOrg(org)}
                                >
                                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                                            checked={selectedOrgIds.has(org.id)}
                                            onChange={() => toggleSelection(org.id)}
                                        />
                                    </td>
                                    <td className="py-3 font-medium">{org.name}</td>
                                    <td className="py-3">{org.members_count}</td>
                                    <td className="py-3 font-medium text-brand-navy dark:text-brand-light">
                                        {org.subscription?.plan === 'SOLO' ? 'محامي مستقل (1)' :
                                            org.subscription?.plan === 'TEAM' ? 'مكتب صغير (5)' :
                                                org.subscription?.plan === 'BUSINESS' ? 'مكتب متوسط (25)' :
                                                    org.subscription?.plan === 'ENTERPRISE' ? 'مكتب كبير' :
                                                        org.subscription?.plan ?? 'تجريبي'}
                                    </td>
                                    <td className="py-3">{org.subscription?.status ?? '—'}</td>
                                    <td className="py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${org.status === 'suspended'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                }`}
                                        >
                                            {org.status === 'suspended' ? 'معلّق' : 'نشط'}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {org.subscription?.current_period_end
                                            ? new Date(org.subscription.current_period_end).toLocaleDateString('ar-SA')
                                            : org.trial?.ends_at
                                                ? new Date(org.trial.ends_at).toLocaleDateString('ar-SA')
                                                : '—'}
                                    </td>
                                    <td className="py-3 space-x-reverse space-x-2">
                                        {org.status === 'active' ? (
                                            <button
                                                disabled={actionId === org.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAction(org.id, 'suspend');
                                                }}
                                                className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                                تعليق
                                            </button>
                                        ) : (
                                            <button
                                                disabled={actionId === org.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAction(org.id, 'activate');
                                                }}
                                                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                تفعيل
                                            </button>
                                        )}
                                        <button
                                            disabled={actionId === org.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAction(org.id, 'activate_paid');
                                            }}
                                            className="rounded bg-brand-emerald px-3 py-1 text-xs text-white hover:bg-brand-emerald/90 disabled:opacity-50"
                                        >
                                            تفعيل اشتراك
                                        </button>
                                        <button
                                            disabled={actionId === org.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAction(org.id, 'set_expiry');
                                            }}
                                            className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            تحديد تاريخ
                                        </button>
                                        <button
                                            disabled={actionId === org.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAction(org.id, 'extend_trial');
                                            }}
                                            className="rounded bg-brand-navy px-3 py-1 text-xs text-white hover:bg-brand-navy/90 disabled:opacity-50"
                                        >
                                            تمديد 14 يوم
                                        </button>
                                        <button
                                            disabled={actionId === org.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAction(org.id, 'grant_lifetime');
                                            }}
                                            className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                                        >
                                            طوال الحياة
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Footer */}
            {totalCount > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800 mt-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        إجمالي المكاتب: <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            السابق
                        </button>
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                            صفحة <span className="font-semibold">{page}</span> من <span className="font-semibold">{Math.ceil(totalCount / limit)}</span>
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= Math.ceil(totalCount / limit) || loading}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            التالي
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Bulk Action Bar */}
            {selectedOrgIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-full bg-white px-6 py-3 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom-5">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white text-xs ml-2 inline-flex">
                            {selectedOrgIds.size}
                        </span>
                        مكتب محدد
                    </span>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={actionId === 'bulk'}
                            onClick={() => handleBulkAction('activate')}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
                        >
                            تفعيل
                        </button>
                        <button
                            disabled={actionId === 'bulk'}
                            onClick={() => handleBulkAction('suspend')}
                            className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-50"
                        >
                            تعليق
                        </button>
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mr-2 ml-2"></div>
                        <button
                            onClick={() => setSelectedOrgIds(new Set())}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            إلغاء التحديد
                        </button>
                    </div>
                </div>
            )}

            {/* Slide-over specifically for Org details */}
            <SlideOver
                open={selectedOrg !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedOrg(null);
                }}
            >
                <SlideOverContent>
                    {selectedOrg && (
                        <>
                            <SlideOverHeader>
                                <SlideOverTitle>تفاصيل المكتب</SlideOverTitle>
                                <SlideOverDescription>معلومات المكتب، حالة الاشتراك، والإجراءات المتاحة.</SlideOverDescription>
                            </SlideOverHeader>

                            <div className="space-y-6">
                                {/* Basic Info */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                                    <div className="flex items-center gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-emerald/10 text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-400">
                                            <Building className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-brand-navy dark:text-slate-100">
                                                {selectedOrg.name}
                                            </h4>
                                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                                <Users className="h-3.5 w-3.5" />
                                                <span>عدد المستخدمين: {selectedOrg.members_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> تاريخ الإنشاء</p>
                                            <p className="font-medium text-slate-900 dark:text-slate-100">{new Date(selectedOrg.created_at).toLocaleDateString('ar-SA')}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> حالة المكتب</p>
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${selectedOrg.status === 'suspended'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                }`}>
                                                {selectedOrg.status === 'suspended' ? 'معلّق' : 'نشط'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Subscription Info */}
                                <div>
                                    <h4 className="flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100 mb-3">
                                        <CreditCard className="h-4 w-4 text-brand-emerald" />
                                        معلومات الاشتراك
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">الخطة الحالية</p>
                                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                                {selectedOrg.subscription?.plan === 'SOLO' ? 'محامي مستقل (1 مستخدم)' :
                                                    selectedOrg.subscription?.plan === 'TEAM' ? 'مكتب صغير (5 مستخدمين)' :
                                                        selectedOrg.subscription?.plan === 'BUSINESS' ? 'مكتب متوسط (25 مستخدم)' :
                                                            selectedOrg.subscription?.plan === 'ENTERPRISE' ? 'مكتب كبير (عدد مفتوح)' :
                                                                selectedOrg.subscription?.plan ?? 'تجريبي'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">تاريخ الانتهاء</p>
                                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                                {selectedOrg.subscription?.current_period_end
                                                    ? new Date(selectedOrg.subscription.current_period_end).toLocaleDateString('ar-SA')
                                                    : selectedOrg.trial?.ends_at
                                                        ? new Date(selectedOrg.trial.ends_at).toLocaleDateString('ar-SA')
                                                        : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div>
                                    <h4 className="flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100 mb-3">
                                        <Shield className="h-4 w-4 text-brand-emerald" />
                                        إجراءات سريعة
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                        {selectedOrg.status === 'active' ? (
                                            <button
                                                disabled={actionId === selectedOrg.id}
                                                onClick={() => {
                                                    handleAction(selectedOrg.id, 'suspend').then(() => {
                                                        setSelectedOrg({ ...selectedOrg, status: 'suspended' });
                                                    });
                                                }}
                                                className="w-full rounded-lg bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 text-sm font-medium hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors"
                                            >
                                                تعليق حساب المكتب
                                            </button>
                                        ) : (
                                            <button
                                                disabled={actionId === selectedOrg.id}
                                                onClick={() => {
                                                    handleAction(selectedOrg.id, 'activate').then(() => {
                                                        setSelectedOrg({ ...selectedOrg, status: 'active' });
                                                    });
                                                }}
                                                className="w-full rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 text-sm font-medium hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 transition-colors"
                                            >
                                                تفعيل حساب المكتب
                                            </button>
                                        )}

                                        {/* Subscription Actions */}
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="col-span-2">
                                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">تغيير خطة المكتب:</label>
                                                <select
                                                    className="w-full rounded-lg bg-white text-slate-700 border border-slate-200 px-3 py-2 text-sm focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                                                    onChange={(e) => {
                                                        if (!e.target.value) return;
                                                        if (confirm('هل أنت متأكد من تغيير الباقة؟')) {
                                                            handleAction(selectedOrg.id, 'set_plan', { plan: e.target.value }).then(() => {
                                                                if (selectedOrg.subscription) {
                                                                    setSelectedOrg({ ...selectedOrg, subscription: { ...selectedOrg.subscription, plan: e.target.value } });
                                                                }
                                                            });
                                                        }
                                                        e.target.value = ''; // Reset select
                                                    }}
                                                >
                                                    <option value="">-- اختر الباقة لتفعيلها فوراً --</option>
                                                    <option value="SOLO">محامي مستقل (1 مستخدم)</option>
                                                    <option value="TEAM">مكتب صغير (5 مستخدمين)</option>
                                                    <option value="BUSINESS">مكتب متوسط (25 مستخدم)</option>
                                                    <option value="ENTERPRISE">مكتب كبير (عدد لا محدود)</option>
                                                </select>
                                            </div>

                                            <button
                                                disabled={actionId === selectedOrg.id}
                                                onClick={() => handleAction(selectedOrg.id, 'extend_trial')}
                                                className="rounded-lg bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                                            >
                                                تمديد تجريبي 14 يوم
                                            </button>
                                            <button
                                                disabled={actionId === selectedOrg.id}
                                                onClick={() => handleAction(selectedOrg.id, 'grant_lifetime')}
                                                className="rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2.5 text-sm font-medium hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-400 transition-colors col-span-2"
                                            >
                                                اشتراك مدى الحياة
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SlideOverContent>
            </SlideOver>
        </div>
    );
}
