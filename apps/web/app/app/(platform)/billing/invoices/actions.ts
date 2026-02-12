'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { writeAuditLog } from '@/lib/audit';

const lineItemSchema = z.object({
  desc: z.string().trim().min(1).max(500),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const createInvoiceSchema = z.object({
  client_id: z.string().uuid('يرجى اختيار عميل صحيح.'),
  matter_id: z.string().uuid().optional().or(z.literal('')),
  items_json: z.string().min(2, 'يرجى إضافة بنود.'),
  tax: z.string().trim().optional().or(z.literal('')),
  due_at: z.string().trim().optional().or(z.literal('')),
});

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createInvoiceAction(formData: FormData) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const parsed = createInvoiceSchema.safeParse({
    client_id: toText(formData, 'client_id'),
    matter_id: toText(formData, 'matter_id'),
    items_json: toText(formData, 'items_json'),
    tax: toText(formData, 'tax'),
    due_at: toText(formData, 'due_at'),
  });

  if (!parsed.success) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const itemsResult = parseItems(parsed.data.items_json);
  if (!itemsResult.ok) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent(itemsResult.message)}`);
  }
  const items = itemsResult.items;
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const tax = parsed.data.tax ? Math.max(0, Number(parsed.data.tax)) : 0;
  const total = round2(subtotal + tax);

  const supabase = createSupabaseServerRlsClient();
  const number = await generateNextNumber(supabase, orgId, 'INV');

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      org_id: orgId,
      client_id: parsed.data.client_id,
      matter_id: parsed.data.matter_id ? parsed.data.matter_id : null,
      number,
      items,
      subtotal: round2(subtotal),
      tax: round2(tax),
      total,
      currency: 'SAR',
      status: 'unpaid',
      issued_at: new Date().toISOString(),
      due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent('تعذر إنشاء الفاتورة. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'invoice_created',
    entityType: 'invoice',
    entityId: data.id,
    meta: { number },
  });

  redirect(`/app/billing/invoices/${data.id}`);
}

export async function updateInvoiceStatusAction(invoiceId: string, status: 'unpaid' | 'partial' | 'paid' | 'void') {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', invoiceId);

  if (error) {
    redirect(`/app/billing/invoices/${invoiceId}?error=${encodeURIComponent('تعذر تحديث الحالة.')}`);
  }

  await writeAuditLog({
    action: 'invoice_status_updated',
    entityType: 'invoice',
    entityId: invoiceId,
    meta: { status },
  });

  redirect(`/app/billing/invoices/${invoiceId}?success=1`);
}

function parseItems(raw: string): { ok: true; items: Array<{ desc: string; qty: number; unit_price: number }> } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'صيغة البنود غير صحيحة.' };
  }

  const array = z.array(lineItemSchema).safeParse(parsed);
  if (!array.success || array.data.length < 1) {
    return { ok: false, message: 'يرجى إضافة بند واحد على الأقل.' };
  }

  return {
    ok: true,
    items: array.data.map((item) => ({
      desc: item.desc,
      qty: item.qty,
      unit_price: round2(item.unit_price),
    })),
  };
}

async function generateNextNumber(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  prefix: 'INV',
) {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .ilike('number', `${base}%`);

  const seq = (count ?? 0) + 1;
  return `${base}${String(seq).padStart(4, '0')}`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

