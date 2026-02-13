'use client';

import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';

export type BillingItemInput = {
  desc: string;
  qty: number;
  unit_price: number;
};

type BillingItemsEditorProps = {
  name: string;
  defaultItems?: BillingItemInput[];
  disabled?: boolean;
};

export function BillingItemsEditor({
  name,
  defaultItems = [{ desc: '', qty: 1, unit_price: 0 }],
  disabled = false,
}: BillingItemsEditorProps) {
  const [items, setItems] = useState<BillingItemInput[]>(
    defaultItems.length ? defaultItems : [{ desc: '', qty: 1, unit_price: 0 }],
  );

  const jsonValue = useMemo(() => {
    const normalized = items.map((item) => ({
      desc: String(item.desc ?? ''),
      qty: Number(item.qty ?? 0),
      unit_price: Number(item.unit_price ?? 0),
    }));
    return JSON.stringify(normalized);
  }, [items]);

  const subtotal = useMemo(() => {
    const sum = items.reduce((acc, item) => acc + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);
    return Math.round((sum + Number.EPSILON) * 100) / 100;
  }, [items]);

  function updateItem(index: number, patch: Partial<BillingItemInput>) {
    setItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addRow() {
    setItems((current) => [...current, { desc: '', qty: 1, unit_price: 0 }]);
  }

  function removeRow(index: number) {
    setItems((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [{ desc: '', qty: 1, unit_price: 0 }];
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={jsonValue} />

      <div className="overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <tr>
              <th className="px-3 py-3 text-start font-medium">الوصف</th>
              <th className="px-3 py-3 text-start font-medium">الكمية</th>
              <th className="px-3 py-3 text-start font-medium">سعر الوحدة</th>
              <th className="px-3 py-3 text-start font-medium">الإجمالي</th>
              <th className="px-3 py-3 text-start font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {items.map((item, idx) => {
              const lineTotal = (Number(item.qty) || 0) * (Number(item.unit_price) || 0);
              return (
                <tr key={idx} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-2">
                    <input
                      value={item.desc}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { desc: e.target.value })}
                      placeholder="مثال: أتعاب متابعة جلسة"
                      className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isFinite(item.qty) ? item.qty : 0}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                      className="h-10 w-24 rounded-lg border border-brand-border px-3 text-start outline-none ring-brand-emerald focus:ring-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={Number.isFinite(item.unit_price) ? item.unit_price : 0}
                      disabled={disabled}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                      className="h-10 w-32 rounded-lg border border-brand-border px-3 text-start outline-none ring-brand-emerald focus:ring-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {formatMoney(lineTotal)} SAR
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={disabled}
                      className={buttonVariants('ghost', 'sm')}
                      onClick={() => removeRow(idx)}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
          + إضافة بند
        </Button>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          المجموع: <span className="font-semibold">{formatMoney(subtotal)} SAR</span>
        </p>
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

