'use client';

import { useEffect, useMemo, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';

export type LineItem = {
  desc: string;
  qty: number;
  unit_price: number;
};

type LineItemsEditorProps = {
  name: string;
  initialItems?: LineItem[];
};

export function LineItemsEditor({ name, initialItems }: LineItemsEditorProps) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems?.length ? initialItems : [{ desc: '', qty: 1, unit_price: 0 }],
  );

  const jsonValue = useMemo(() => JSON.stringify(items), [items]);

  useEffect(() => {
    // Keep at least 1 row.
    if (!items.length) {
      setItems([{ desc: '', qty: 1, unit_price: 0 }]);
    }
  }, [items]);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={jsonValue} />

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]">
            <input
              placeholder="الوصف"
              value={item.desc}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row, i) => (i === idx ? { ...row, desc: e.target.value } : row)),
                )
              }
              className="h-11 rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              placeholder="الكمية"
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(item.qty) ? item.qty : 1}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row, i) =>
                    i === idx ? { ...row, qty: Math.max(1, Number(e.target.value || 1)) } : row,
                  ),
                )
              }
              className="h-11 rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              placeholder="سعر الوحدة"
              type="number"
              min={0}
              step={0.01}
              value={Number.isFinite(item.unit_price) ? item.unit_price : 0}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row, i) =>
                    i === idx ? { ...row, unit_price: Math.max(0, Number(e.target.value || 0)) } : row,
                  ),
                )
              }
              className="h-11 rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              className={buttonVariants('outline', 'sm')}
            >
              حذف
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { desc: '', qty: 1, unit_price: 0 }])}
        className={buttonVariants('outline', 'sm')}
      >
        إضافة بند
      </button>
    </div>
  );
}

