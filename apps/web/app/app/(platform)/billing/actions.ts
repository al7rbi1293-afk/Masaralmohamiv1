'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { z } from 'zod';
import { createInvoice, createQuote, getInvoiceById, itemsSchema, updateInvoice, updateQuote } from '@/lib/billing';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const quoteFormSchema = z.object({
  client_id: z.string().uuid('يرجى اختيار العميل.'),
  matter_id: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
  items_json: z.string().min(2, 'يرجى إضافة بند واحد على الأقل.'),
});

export async function createQuoteAction(formData: FormData) {
  const parsed = quoteFormSchema.safeParse(toQuoteObject(formData));
  if (!parsed.success) {
    redirect(`/app/billing/quotes/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`);
  }

  const items = parseItems(parsed.data.items_json);
  if (!items) {
    redirect(`/app/billing/quotes/new?error=${encodeURIComponent('بنود عرض السعر غير صحيحة.')}`);
  }

  try {
    const created = await createQuote({
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items,
      status: parsed.data.status,
    });

    await logAudit({
      action: 'quote.created',
      entityType: 'quote',
      entityId: created.id,
      meta: { number: created.number },
    });

    logInfo('quote_created', { quoteId: created.id });
    redirect(`/app/billing/quotes/${created.id}?success=${encodeURIComponent('تم إنشاء عرض السعر.')}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('quote_create_failed', { message });
    redirect(`/app/billing/quotes/new?error=${encodeURIComponent(message)}`);
  }
}

export async function updateQuoteAction(id: string, formData: FormData) {
  const parsed = quoteFormSchema.safeParse(toQuoteObject(formData));
  if (!parsed.success) {
    redirect(`/app/billing/quotes/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`);
  }

  const items = parseItems(parsed.data.items_json);
  if (!items) {
    redirect(`/app/billing/quotes/${id}?error=${encodeURIComponent('بنود عرض السعر غير صحيحة.')}`);
  }

  try {
    const updated = await updateQuote(id, {
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items,
      status: parsed.data.status,
    });

    await logAudit({
      action: 'quote.updated',
      entityType: 'quote',
      entityId: updated.id,
      meta: { number: updated.number },
    });

    logInfo('quote_updated', { quoteId: updated.id });
    redirect(`/app/billing/quotes/${updated.id}?success=${encodeURIComponent('تم تحديث عرض السعر.')}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('quote_update_failed', { quoteId: id, message });
    redirect(`/app/billing/quotes/${id}?error=${encodeURIComponent(message)}`);
  }
}

const invoiceFormSchema = z.object({
  client_id: z.string().uuid('يرجى اختيار العميل.'),
  matter_id: z.string().uuid().optional().or(z.literal('')),
  due_at: z.string().trim().optional().or(z.literal('')),
  tax: z.string().trim().optional().or(z.literal('')),
  status: z.enum(['active', 'void']).optional().or(z.literal('')),
  items_json: z.string().min(2, 'يرجى إضافة بند واحد على الأقل.'),
});

export async function createInvoiceAction(formData: FormData) {
  const parsed = invoiceFormSchema.safeParse(toInvoiceObject(formData));
  if (!parsed.success) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`);
  }

  const items = parseItems(parsed.data.items_json);
  if (!items) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent('بنود الفاتورة غير صحيحة.')}`);
  }

  const tax = parseMoney(parsed.data.tax);
  if (tax === null) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent('قيمة الضريبة غير صحيحة.')}`);
  }

  const dueAtIso = normalizeDateTimeIso(parsed.data.due_at);
  if (parsed.data.due_at && !dueAtIso) {
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent('تاريخ الاستحقاق غير صحيح.')}`);
  }

  try {
    const created = await createInvoice({
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items,
      tax: tax ?? 0,
      due_at: dueAtIso,
    });

    await logAudit({
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: created.id,
      meta: { number: created.number },
    });

    logInfo('invoice_created', { invoiceId: created.id });
    redirect(`/app/billing/invoices/${created.id}?success=${encodeURIComponent('تم إنشاء الفاتورة.')}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('invoice_create_failed', { message });
    redirect(`/app/billing/invoices/new?error=${encodeURIComponent(message)}`);
  }
}

export async function updateInvoiceAction(id: string, formData: FormData) {
  const parsed = invoiceFormSchema.safeParse(toInvoiceObject(formData));
  if (!parsed.success) {
    redirect(`/app/billing/invoices/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`);
  }

  const items = parseItems(parsed.data.items_json);
  if (!items) {
    redirect(`/app/billing/invoices/${id}?error=${encodeURIComponent('بنود الفاتورة غير صحيحة.')}`);
  }

  const tax = parseMoney(parsed.data.tax);
  if (tax === null) {
    redirect(`/app/billing/invoices/${id}?error=${encodeURIComponent('قيمة الضريبة غير صحيحة.')}`);
  }

  const dueAtIso = normalizeDateTimeIso(parsed.data.due_at);
  if (parsed.data.due_at && !dueAtIso) {
    redirect(`/app/billing/invoices/${id}?error=${encodeURIComponent('تاريخ الاستحقاق غير صحيح.')}`);
  }

  try {
    const before = await getInvoiceById(id).catch(() => null);
    const updated = await updateInvoice(id, {
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items,
      tax: tax ?? 0,
      due_at: dueAtIso,
      status: parsed.data.status === 'void' ? 'void' : undefined,
    });

    await logAudit({
      action: 'invoice.updated',
      entityType: 'invoice',
      entityId: updated.id,
      meta: {
        number: updated.number,
        changed: diffInvoiceFields(before, updated),
      },
    });

    logInfo('invoice_updated', { invoiceId: updated.id });
    redirect(`/app/billing/invoices/${updated.id}?success=${encodeURIComponent('تم تحديث الفاتورة.')}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('invoice_update_failed', { invoiceId: id, message });
    redirect(`/app/billing/invoices/${id}?error=${encodeURIComponent(message)}`);
  }
}

function toQuoteObject(formData: FormData) {
  return {
    client_id: String(formData.get('client_id') ?? ''),
    matter_id: String(formData.get('matter_id') ?? ''),
    status: String(formData.get('status') ?? 'draft'),
    items_json: String(formData.get('items_json') ?? ''),
  };
}

function toInvoiceObject(formData: FormData) {
  return {
    client_id: String(formData.get('client_id') ?? ''),
    matter_id: String(formData.get('matter_id') ?? ''),
    due_at: String(formData.get('due_at') ?? ''),
    tax: String(formData.get('tax') ?? ''),
    status: String(formData.get('status') ?? 'active'),
    items_json: String(formData.get('items_json') ?? ''),
  };
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseItems(json: string) {
  try {
    const parsed = JSON.parse(json);
    const validated = itemsSchema.safeParse(parsed);
    if (!validated.success) return null;
    return validated.data;
  } catch {
    return null;
  }
}

function parseMoney(value?: string) {
  const raw = (value ?? '').trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normalizeDateTimeIso(value?: string) {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toUserMessage(error: unknown) {
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error && 'message' in error) {
    message = String((error as any).message);
  } else {
    message = String(error);
  }

  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) return message;

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  if (normalized.includes('not_found') || normalized.includes('no rows')) {
    return 'العنصر غير موجود.';
  }

  return message || 'تعذر الحفظ. حاول مرة أخرى.';
}

function diffInvoiceFields(
  before: Awaited<ReturnType<typeof getInvoiceById>>,
  after: Awaited<ReturnType<typeof updateInvoice>>,
): string[] {
  if (!before || !after) return [];
  const changed: string[] = [];

  if (before.client_id !== after.client_id) changed.push('client_id');
  if (before.matter_id !== after.matter_id) changed.push('matter_id');
  if (before.due_at !== after.due_at) changed.push('due_at');
  if (String(before.tax) !== String(after.tax)) changed.push('tax');
  if (before.status !== after.status) changed.push('status');

  try {
    const beforeItems = JSON.stringify(before.items ?? null);
    const afterItems = JSON.stringify(after.items ?? null);
    if (beforeItems !== afterItems) changed.push('items');
  } catch {
    // If items aren't comparable, still mark as changed conservatively.
    changed.push('items');
  }

  return changed;
}
