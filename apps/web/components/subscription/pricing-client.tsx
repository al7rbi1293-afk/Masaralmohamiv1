'use client';

import { useState } from 'react';
import { Plan } from '@/lib/subscriptions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { BankTransferForm } from './bank-transfer-form';

export function PricingClient({ plans }: { plans: Plan[] }) {
    const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
                <span className={period === 'monthly' ? 'font-bold text-brand-navy' : 'text-slate-600'}>
                    شهري
                </span>
                <Switch
                    checked={period === 'yearly'}
                    onCheckedChange={(checked) => setPeriod(checked ? 'yearly' : 'monthly')}
                />
                <span className={period === 'yearly' ? 'font-bold text-brand-navy' : 'text-slate-600'}>
                    سنوي <span className="text-xs text-brand-emerald">(خصم شهرين)</span>
                </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                    const isContactSales = !plan.price_monthly;
                    const basePrice = plan.price_monthly ? Number(plan.price_monthly) : 0;

                    // Yearly logic: Pay for 10 months, get 12.
                    // Monthly logic: Pay nominal price.
                    const displayedPrice = period === 'yearly'
                        ? Math.round((basePrice * 10) / 12) // Show equivalent monthly cost? Or total? 
                        // Usually showing "per month" equivalent is better marketing.
                        // Let's show the PER MONTH equivalent.
                        : basePrice;

                    const totalBilled = period === 'yearly' ? basePrice * 10 : basePrice;

                    return (
                        <div
                            key={plan.code}
                            className="flex flex-col rounded-lg border border-brand-border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                        >
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">
                                    {plan.name_ar}
                                </h2>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{plan.code}</p>
                            </div>

                            <div className="mb-4">
                                <p className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-brand-navy dark:text-slate-100">
                                        {isContactSales ? 'تواصل معنا' : displayedPrice}
                                    </span>
                                    {!isContactSales && (
                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                            {plan.currency} / شهرياً
                                        </span>
                                    )}
                                </p>
                                {period === 'yearly' && !isContactSales && (
                                    <p className="mt-1 text-xs text-brand-emerald">يُفوتر {totalBilled} {plan.currency} سنوياً</p>
                                )}
                            </div>

                            <ul className="mb-6 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <li>
                                    {plan.seat_limit ? `حد المقاعد: ${plan.seat_limit}` : 'مستخدمين غير محدود'}
                                </li>
                                {/* IDK what features json has, skipping for safety or showing strict usage limits */}
                            </ul>

                            <div className="mt-auto">
                                {isContactSales ? (
                                    <a
                                        className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                        href={`mailto:masar.almohami@outlook.sa?subject=${encodeURIComponent(
                                            `طلب اشتراك - ${plan.code}`,
                                        )}`}
                                    >
                                        تواصل معنا
                                    </a>
                                ) : (
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="w-full">
                                                اشترك الآن
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>الاشتراك في خطة {plan.name_ar}</DialogTitle>
                                                <DialogDescription>
                                                    أكمل عملية الدفع عبر التحويل البنكي لتفعيل اشتراكك.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <BankTransferForm
                                                planCode={plan.code}
                                                planName={plan.name_ar}
                                                price={basePrice}
                                                period={period}
                                            />
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
