'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type PacketStatus = 'preparing' | 'review' | 'ready' | 'submitted_manual';

type PacketItemDraft = {
  id: string;
  item_type: 'document' | 'field' | 'note';
  label: string;
  value: string;
  document_id: string;
};

type PacketItemRow = {
  id: string;
  item_type: 'document' | 'field' | 'note';
  label: string;
  value: string | null;
  document_id: string | null;
  created_at?: string;
};

type PacketRow = {
  id: string;
  title: string;
  status: PacketStatus;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  najiz_packet_items?: PacketItemRow[] | null;
};

type NajizPacketsClientProps = {
  matterId: string;
  matterTitle: string;
  caseNumber?: string | null;
};

const statusMeta: Record<PacketStatus, { label: string; tone: 'default' | 'success' | 'warning' | 'danger' }> = {
  preparing: { label: 'جاري التجهيز', tone: 'warning' },
  review: { label: 'قيد المراجعة', tone: 'default' },
  ready: { label: 'جاهزة', tone: 'success' },
  submitted_manual: { label: 'مقدمة يدويًا', tone: 'danger' },
};

export function NajizPacketsClient({ matterId, matterTitle, caseNumber }: NajizPacketsClientProps) {
  const [packets, setPackets] = useState<PacketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(`حزمة ناجز - ${matterTitle}`);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PacketItemDraft[]>(() => buildInitialItems(caseNumber));
  const [draftStatuses, setDraftStatuses] = useState<Record<string, PacketStatus>>({});
  const [savingPacketIds, setSavingPacketIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadPackets();
  }, [matterId]);

  async function loadPackets() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/najiz/packets?matter_id=${encodeURIComponent(matterId)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; packets?: PacketRow[] };

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل الحزم.');
      }

      const nextPackets = Array.isArray(payload.packets) ? payload.packets : [];
      setPackets(nextPackets);
      setDraftStatuses(Object.fromEntries(nextPackets.map((packet) => [packet.id, packet.status])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الحزم.');
    } finally {
      setLoading(false);
    }
  }

  function updateItem(index: number, patch: Partial<PacketItemDraft>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => [...current, createBlankItem()]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function createPacket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');

    try {
      const normalizedItems = items
        .map((item) => ({
          item_type: item.item_type,
          label: item.label.trim(),
          value: item.value.trim(),
          document_id: item.document_id.trim(),
        }))
        .filter((item) => item.label || item.value || item.document_id)
        .map((item) => ({
          item_type: item.item_type,
          label: item.label,
          value: item.value || undefined,
          document_id: item.document_id || undefined,
        }));

      const response = await fetch('/api/najiz/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_id: matterId,
          title: title.trim(),
          notes: notes.trim() || undefined,
          items: normalizedItems,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || 'تعذر إنشاء الحزمة.');
      }

      setMessage('تم إنشاء الحزمة بنجاح.');
      setTitle(`حزمة ناجز - ${matterTitle}`);
      setNotes('');
      setItems(buildInitialItems(caseNumber));
      await loadPackets();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'تعذر إنشاء الحزمة.');
    } finally {
      setCreating(false);
    }
  }

  async function savePacketStatus(packetId: string) {
    const status = draftStatuses[packetId];
    if (!status) {
      return;
    }

    setSavingPacketIds((current) => ({ ...current, [packetId]: true }));
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/najiz/packets?id=${encodeURIComponent(packetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || 'تعذر تحديث حالة الحزمة.');
      }

      setMessage('تم تحديث حالة الحزمة.');
      await loadPackets();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذر تحديث حالة الحزمة.');
    } finally {
      setSavingPacketIds((current) => ({ ...current, [packetId]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">حزم ناجز</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              جهّز حزمة العمل للقضية، أضف عناصرها الأساسية، وحدث حالتها أثناء سير الإجراء.
            </p>
          </div>
          <Badge variant="default">{packets.length} حزمة</Badge>
        </div>

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold text-brand-navy dark:text-slate-100">إنشاء حزمة جديدة</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            الحزمة تبدأ بقالب بسيط، ويمكنك تعديل العناصر قبل الحفظ.
          </p>
        </div>

        <form className="space-y-4" onSubmit={createPacket}>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                عنوان الحزمة <span className="text-red-600">*</span>
              </span>
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظات الحزمة</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="اختياري"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-brand-navy dark:text-slate-100">العناصر الأساسية</h4>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                إضافة عنصر
              </Button>
            </div>

            {items.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-xl border border-brand-border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40 lg:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_160px_auto]"
              >
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">النوع</span>
                  <select
                    value={item.item_type}
                    onChange={(event) => updateItem(index, { item_type: event.target.value as PacketItemDraft['item_type'] })}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="field">حقل</option>
                    <option value="note">ملاحظة</option>
                    <option value="document">مستند</option>
                  </select>
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">العنوان</span>
                  <input
                    value={item.label}
                    onChange={(event) => updateItem(index, { label: event.target.value })}
                    placeholder="مثال: رقم القضية في ناجز"
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">القيمة</span>
                  <input
                    value={item.value}
                    onChange={(event) => updateItem(index, { value: event.target.value })}
                    placeholder="اختياري"
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Document ID</span>
                  <input
                    value={item.document_id}
                    onChange={(event) => updateItem(index, { document_id: event.target.value })}
                    placeholder={item.item_type === 'document' ? 'اختياري' : 'يُترك فارغًا'}
                    disabled={item.item_type !== 'document'}
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    className={buttonVariants('ghost', 'sm')}
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="md" disabled={creating || !title.trim()}>
              {creating ? 'جارٍ الإنشاء...' : 'إنشاء الحزمة'}
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ستُرسل العناصر غير الفارغة فقط إلى الحزمة.
            </span>
          </div>
        </form>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-brand-navy dark:text-slate-100">الحزم الحالية</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              راجع محتوى كل حزمة وغيّر حالتها عند الحاجة.
            </p>
          </div>
          <button
            type="button"
            className={buttonVariants('outline', 'sm')}
            onClick={() => void loadPackets()}
          >
            تحديث القائمة
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">جارٍ تحميل الحزم...</p>
        ) : null}

        {!loading && !packets.length ? (
          <div className="rounded-xl border border-dashed border-brand-border px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            لا توجد حزم لهذه القضية بعد. أنشئ أول حزمة من الأعلى لبدء التجهيز.
          </div>
        ) : null}

        <div className="space-y-4">
          {packets.map((packet) => {
            const itemsList = Array.isArray(packet.najiz_packet_items) ? packet.najiz_packet_items : [];
            const currentStatus = draftStatuses[packet.id] ?? packet.status;
            const status = statusMeta[currentStatus];

            return (
              <article
                key={packet.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{packet.title}</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      أنشئت في {formatDate(packet.created_at)}
                      {packet.submitted_at ? ` • أُرسلت في ${formatDate(packet.submitted_at)}` : ''}
                    </p>
                  </div>
                  <Badge variant={status.tone}>{status.label}</Badge>
                </div>

                {packet.notes ? (
                  <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{packet.notes}</p>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-3">
                  {itemsList.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-brand-border bg-brand-background/60 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.label}</p>
                        <Badge variant="default">{item.item_type}</Badge>
                      </div>
                      {item.value ? (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.value}</p>
                      ) : null}
                      {item.document_id ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Document ID: {item.document_id}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">حالة الحزمة</span>
                    <select
                      value={currentStatus}
                      onChange={(event) =>
                        setDraftStatuses((current) => ({
                          ...current,
                          [packet.id]: event.target.value as PacketStatus,
                        }))
                      }
                      className="h-11 w-64 rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="preparing">جاري التجهيز</option>
                      <option value="review">قيد المراجعة</option>
                      <option value="ready">جاهزة</option>
                      <option value="submitted_manual">مقدمة يدويًا</option>
                    </select>
                  </label>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={savingPacketIds[packet.id]}
                    onClick={() => void savePacketStatus(packet.id)}
                  >
                    {savingPacketIds[packet.id] ? 'جارٍ الحفظ...' : 'حفظ الحالة'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function buildInitialItems(caseNumber?: string | null): PacketItemDraft[] {
  return [
    {
      id: createId(),
      item_type: 'field',
      label: 'رقم القضية في ناجز',
      value: caseNumber ?? '',
      document_id: '',
    },
    {
      id: createId(),
      item_type: 'field',
      label: 'اسم المحكمة',
      value: '',
      document_id: '',
    },
    {
      id: createId(),
      item_type: 'note',
      label: 'ملاحظات داخلية',
      value: '',
      document_id: '',
    },
  ];
}

function createBlankItem(): PacketItemDraft {
  return {
    id: createId(),
    item_type: 'field',
    label: '',
    value: '',
    document_id: '',
  };
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pkt_${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return value;
  }
}
