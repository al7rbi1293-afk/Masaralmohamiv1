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

const createQuoteSchema = z.object({
  client_id: z.string().uuid('يرجى اختيار عميل صحيح.'),
  matter_id: z.string().uuid().optional().or(z.literal('')),
  items_json: z.string().min(2, 'يرجى إضافة بنود.'),
});

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createQuoteAction(formData: FormData) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const parsed = createQuoteSchema.safeParse({
    client_id: toText(formData, 'client_id'),
    matter_id: toText(formData, 'matter_id'),
    items_json: toText(formData, 'items_json'),
  });

  if (!parsed.success) {
    redirect(`/app/billing/quotes/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const itemsResult = parseItems(parsed.data.items_json);
  if (!itemsResult.ok) {
    redirect(`/app/billing/quotes/new?error=${encodeURIComponent(itemsResult.message)}`);
  }
  const items = itemsResult.items;
  const total = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);

  const supabase = createSupabaseServerRlsClient();
  const number = await generateNextNumber(supabase, orgId, 'Q');

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      org_id: orgId,
      client_id: parsed.data.client_id,
      matter_id: parsed.data.matter_id ? parsed.data.matter_id : null,
      number,
      items,
      total: round2(total),
      currency: 'SAR',
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    redirect(`/app/billing/quotes/new?error=${encodeURIComponent('تعذر إنشاء عرض السعر. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'quote_created',
    entityType: 'quote',
    entityId: data.id,
    meta: { number },
  });

  redirect(`/app/billing/quotes/${data.id}`);
}

export async function updateQuoteStatusAction(quoteId: string, status: 'draft' | 'sent' | 'accepted' | 'rejected') {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', quoteId);

  if (error) {
    redirect(`/app/billing/quotes/${quoteId}?error=${encodeURIComponent('تعذر تحديث الحالة.')}`);
  }

  await writeAuditLog({
    action: 'quote_status_updated',
    entityType: 'quote',
    entityId: quoteId,
    meta: { status },
  });

  redirect(`/app/billing/quotes/${quoteId}?success=1`);
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
  prefix: 'Q' | 'INV',
) {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  const { count } = await supabase
    .from(prefix === 'Q' ? 'quotes' : 'invoices')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .ilike('number', `${base}%`);

  const seq = (count ?? 0) + 1;
  return `${base}${String(seq).padStart(4, '0')}`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
