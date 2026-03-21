import 'server-only';

import { itemsSchema, type BillingItem, type Invoice, type InvoiceStatus, type Payment, type Quote, type QuoteStatus } from '@/lib/billing';
import { isMissingColumnError } from '@/lib/shared-utils';
import type { MobileAppSessionContext } from '@/lib/mobile/auth';

type Relation<T> = T | T[] | null;

type QuoteRow = Omit<Quote, 'client' | 'matter'> & {
  client: Relation<Quote['client']>;
  matter: Relation<Quote['matter']>;
};

type InvoiceRow = Omit<Invoice, 'client' | 'matter'> & {
  client: Relation<Invoice['client']>;
  matter: Relation<Invoice['matter']>;
};

type InvoiceRowLike = Omit<InvoiceRow, 'is_archived'> & {
  tax_enabled?: boolean;
  tax_number?: string | null;
  is_archived?: boolean;
};

const QUOTE_SELECT =
  'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, tax_enabled, tax_number, created_by, created_at, client:clients(id, name), matter:matters(id, title)';
const INVOICE_SELECT =
  'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, tax_enabled, tax_number, is_archived, issued_at, due_at, created_by, client:clients(id, name), matter:matters(id, title)';
const INVOICE_SELECT_LEGACY =
  'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, tax_enabled, tax_number, issued_at, due_at, created_by, client:clients(id, name), matter:matters(id, title)';
const INVOICE_PAYMENT_SELECT =
  'id, org_id, invoice_id, amount, method, paid_at, note, created_by, created_at';

function pickRelation<T>(value: Relation<T>) {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

function normalizeQuoteRow(row: QuoteRow): Quote {
  const normalizedClient = pickRelation(row.client);
  const normalizedMatter = pickRelation(row.matter);
  const rawTaxNumber = cleanText(row.tax_number);
  const taxEnabled =
    typeof row.tax_enabled === 'boolean' ? row.tax_enabled : Number(row.tax) > 0;

  return {
    ...row,
    client: normalizedClient,
    matter: normalizedMatter,
    tax_enabled: taxEnabled,
    tax_number: taxEnabled && rawTaxNumber ? rawTaxNumber : null,
  } as Quote;
}

function normalizeInvoiceRow(row: InvoiceRowLike): Invoice {
  const normalizedClient = pickRelation(row.client);
  const normalizedMatter = pickRelation(row.matter);
  const rawTaxNumber = cleanText(row.tax_number);
  const taxEnabled =
    typeof row.tax_enabled === 'boolean' ? row.tax_enabled : Number(row.tax) > 0;

  return {
    ...row,
    client: normalizedClient,
    matter: normalizedMatter,
    tax_enabled: taxEnabled,
    tax_number: taxEnabled && rawTaxNumber ? rawTaxNumber : null,
    is_archived: Boolean(row.is_archived ?? false),
  } as Invoice;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeItems(items: BillingItem[]) {
  return items.map((item) => ({
    desc: cleanText(item.desc),
    qty: Number(item.qty),
    unit_price: Number(item.unit_price),
  }));
}

function sumItems(items: BillingItem[]) {
  return round2(items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0));
}

function normalizeTaxNumber(value: string | null | undefined) {
  const raw = cleanText(value);
  return raw || null;
}

function computeInvoiceStatus(total: number, paidAmount: number): InvoiceStatus {
  const safeTotal = Number.isFinite(total) ? total : 0;
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount + 0.0001 >= safeTotal) return 'paid';
  return 'partial';
}

function isUniqueViolation(error: any) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return code === '23505' || message.includes('duplicate key') || message.includes('unique');
}

async function resolveTaxNumber(db: MobileAppSessionContext['db'], orgId: string, taxEnabled: boolean, taxNumber?: string | null) {
  if (!taxEnabled) return null;
  const normalized = normalizeTaxNumber(taxNumber);
  if (normalized) return normalized;

  const { data } = await db.from('organizations').select('tax_number').eq('id', orgId).maybeSingle();
  const orgTaxNumber = cleanText((data as { tax_number?: string | null } | null)?.tax_number);
  return orgTaxNumber || null;
}

async function ensureClientExists(db: MobileAppSessionContext['db'], orgId: string, clientId: string) {
  const { data, error } = await db.from('clients').select('id').eq('org_id', orgId).eq('id', clientId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('client_not_found');
}

async function ensureMatterExists(db: MobileAppSessionContext['db'], orgId: string, matterId: string) {
  const { data, error } = await db.from('matters').select('id').eq('org_id', orgId).eq('id', matterId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('matter_not_found');
}

async function getQuoteById(db: MobileAppSessionContext['db'], orgId: string, id: string) {
  let { data, error } = await db
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeQuoteRow(data as QuoteRow);
}

async function getInvoiceById(db: MobileAppSessionContext['db'], orgId: string, id: string) {
  let { data, error } = await db
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'invoices', 'is_archived')) {
    ({ data, error } = await db
      .from('invoices')
      .select(INVOICE_SELECT_LEGACY)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle());
  }

  if (error) throw error;
  if (!data) return null;

  return normalizeInvoiceRow(data as InvoiceRowLike);
}

async function computeInvoicePaidAmount(db: MobileAppSessionContext['db'], orgId: string, invoiceId: string) {
  const { data, error } = await db
    .from('payments')
    .select('amount')
    .eq('org_id', orgId)
    .eq('invoice_id', invoiceId);

  if (error) throw error;

  const paid = ((data as Array<{ amount: string | number }> | null) ?? []).reduce((sum, row) => {
    const value = typeof row.amount === 'number' ? row.amount : Number(row.amount);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return round2(paid);
}

async function generateNextNumber(params: {
  db: MobileAppSessionContext['db'];
  table: 'quotes' | 'invoices';
  orgId: string;
  prefix: string;
}) {
  const year = new Date().getFullYear();
  const basePrefix = `${params.prefix}-${year}-`;
  const orderCol = params.table === 'quotes' ? 'created_at' : 'issued_at';

  const { data, error } = await params.db
    .from(params.table)
    .select('number')
    .eq('org_id', params.orgId)
    .like('number', `${basePrefix}%`)
    .order(orderCol as any, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const last = typeof (data as { number?: string } | null)?.number === 'string'
    ? parseNumberSuffix((data as { number: string }).number)
    : 0;

  return `${basePrefix}${String(Math.max(0, last) + 1).padStart(4, '0')}`;
}

function parseNumberSuffix(value: string) {
  const match = value.match(/(\d{4})$/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
}

async function createQuoteCore(
  context: MobileAppSessionContext,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    status?: QuoteStatus;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود عرض السعر غير صحيحة.');
  }

  await ensureClientExists(context.db, orgId, payload.client_id);
  if (payload.matter_id) await ensureMatterExists(context.db, orgId, payload.matter_id);

  const items = normalizeItems(parsedItems.data);
  const subtotal = sumItems(items);
  const taxEnabled = Boolean(payload.tax_enabled);
  const tax = taxEnabled ? round2(Math.max(0, payload.tax ?? 0)) : 0;
  const taxNumber = await resolveTaxNumber(context.db, orgId, taxEnabled, payload.tax_number);
  const total = round2(subtotal + tax);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const number = await generateNextNumber({
      db: context.db,
      table: 'quotes',
      orgId,
      prefix: 'Q',
    });

    const { data, error } = await context.db
      .from('quotes')
      .insert({
        org_id: orgId,
        client_id: payload.client_id,
        matter_id: payload.matter_id ?? null,
        number,
        items,
        subtotal,
        tax,
        total,
        tax_enabled: taxEnabled,
        tax_number: taxNumber,
        currency: 'SAR',
        status: payload.status ?? 'draft',
        created_by: context.user.id,
      })
      .select(QUOTE_SELECT)
      .single();

    if (!error && data) {
      return normalizeQuoteRow(data as QuoteRow);
    }

    if (error && isUniqueViolation(error)) {
      continue;
    }

    throw error ?? new Error('تعذر إنشاء عرض السعر.');
  }

  throw new Error('تعذر إنشاء عرض السعر.');
}

async function updateQuoteCore(
  context: MobileAppSessionContext,
  id: string,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    status: QuoteStatus;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود عرض السعر غير صحيحة.');
  }

  await ensureClientExists(context.db, orgId, payload.client_id);
  if (payload.matter_id) await ensureMatterExists(context.db, orgId, payload.matter_id);

  const items = normalizeItems(parsedItems.data);
  const subtotal = sumItems(items);
  const taxEnabled = Boolean(payload.tax_enabled);
  const tax = taxEnabled ? round2(Math.max(0, payload.tax ?? 0)) : 0;
  const taxNumber = await resolveTaxNumber(context.db, orgId, taxEnabled, payload.tax_number);
  const total = round2(subtotal + tax);

  const { data, error } = await context.db
    .from('quotes')
    .update({
      client_id: payload.client_id,
      matter_id: payload.matter_id ?? null,
      items,
      subtotal,
      tax,
      total,
      tax_enabled: taxEnabled,
      tax_number: taxNumber,
      status: payload.status,
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(QUOTE_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('not_found');

  return normalizeQuoteRow(data as QuoteRow);
}

async function createInvoiceCore(
  context: MobileAppSessionContext,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    due_at?: string | null;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود الفاتورة غير صحيحة.');
  }

  await ensureClientExists(context.db, orgId, payload.client_id);
  if (payload.matter_id) await ensureMatterExists(context.db, orgId, payload.matter_id);

  const items = normalizeItems(parsedItems.data);
  const subtotal = sumItems(items);
  const taxEnabled = Boolean(payload.tax_enabled);
  const tax = taxEnabled ? round2(Math.max(0, payload.tax ?? 0)) : 0;
  const taxNumber = await resolveTaxNumber(context.db, orgId, taxEnabled, payload.tax_number);
  const total = round2(subtotal + tax);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const number = await generateNextNumber({
      db: context.db,
      table: 'invoices',
      orgId,
      prefix: 'INV',
    });

    const { data, error } = await context.db
      .from('invoices')
      .insert({
        org_id: orgId,
        client_id: payload.client_id,
        matter_id: payload.matter_id ?? null,
        number,
        items,
        subtotal,
        tax,
        total,
        tax_enabled: taxEnabled,
        tax_number: taxNumber,
        currency: 'SAR',
        status: 'unpaid',
        due_at: payload.due_at ?? null,
        created_by: context.user.id,
      })
      .select('id')
      .single();

    if (!error && data) {
      const insertedId = String((data as { id: string }).id);
      const selected = await getInvoiceById(context.db, orgId, insertedId);
      if (!selected) throw new Error('تعذر إنشاء الفاتورة.');
      return selected;
    }

    if (error && isUniqueViolation(error)) {
      continue;
    }

    throw error ?? new Error('تعذر إنشاء الفاتورة.');
  }

  throw new Error('تعذر إنشاء الفاتورة.');
}

async function updateInvoiceCore(
  context: MobileAppSessionContext,
  id: string,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    due_at?: string | null;
    status?: InvoiceStatus;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const existing = await getInvoiceById(context.db, orgId, id);
  if (!existing) throw new Error('not_found');

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود الفاتورة غير صحيحة.');
  }

  await ensureClientExists(context.db, orgId, payload.client_id);
  if (payload.matter_id) await ensureMatterExists(context.db, orgId, payload.matter_id);

  const items = normalizeItems(parsedItems.data);
  const subtotal = sumItems(items);
  const taxEnabled = Boolean(payload.tax_enabled);
  const tax = taxEnabled ? round2(Math.max(0, payload.tax ?? 0)) : 0;
  const taxNumber = await resolveTaxNumber(context.db, orgId, taxEnabled, payload.tax_number);
  const total = round2(subtotal + tax);
  const paidAmount = await computeInvoicePaidAmount(context.db, orgId, id);
  const effectiveStatus =
    payload.status === 'void' || existing.status === 'void'
      ? 'void'
      : computeInvoiceStatus(total, paidAmount);

  const { data, error } = await context.db
    .from('invoices')
    .update({
      client_id: payload.client_id,
      matter_id: payload.matter_id ?? null,
      items,
      subtotal,
      tax,
      total,
      tax_enabled: taxEnabled,
      tax_number: taxNumber,
      due_at: payload.due_at ?? null,
      status: effectiveStatus,
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(INVOICE_SELECT)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'invoices', 'is_archived')) {
    const legacy = await context.db
      .from('invoices')
      .update({
        client_id: payload.client_id,
        matter_id: payload.matter_id ?? null,
        items,
        subtotal,
        tax,
        total,
        tax_enabled: taxEnabled,
        tax_number: taxNumber,
        due_at: payload.due_at ?? null,
        status: effectiveStatus,
      })
      .eq('org_id', orgId)
      .eq('id', id)
      .select(INVOICE_SELECT_LEGACY)
      .maybeSingle();

    if (legacy.error) throw legacy.error;
    if (!legacy.data) throw new Error('not_found');
    return normalizeInvoiceRow(legacy.data as InvoiceRowLike);
  }

  if (error) throw error;
  if (!data) throw new Error('not_found');

  return normalizeInvoiceRow(data as InvoiceRowLike);
}

async function setInvoiceArchivedCore(context: MobileAppSessionContext, id: string, archived: boolean) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const { data, error } = await context.db
    .from('invoices')
    .update({ is_archived: archived })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(INVOICE_SELECT)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'invoices', 'is_archived')) {
    throw new Error('archive_not_supported');
  }

  if (error) throw error;
  if (!data) throw new Error('not_found');

  return normalizeInvoiceRow(data as InvoiceRowLike);
}

async function listInvoicePaymentsCore(context: MobileAppSessionContext, invoiceId: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const { data, error } = await context.db
    .from('payments')
    .select(INVOICE_PAYMENT_SELECT)
    .eq('org_id', orgId)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Payment[] | null) ?? [];
}

async function addInvoicePaymentCore(
  context: MobileAppSessionContext,
  invoiceId: string,
  payload: { amount: number; method?: string | null; paid_at?: string | null; note?: string | null },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const amount = round2(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('قيمة الدفعة غير صحيحة.');
  }

  const invoice = await getInvoiceById(context.db, orgId, invoiceId);
  if (!invoice) throw new Error('not_found');
  if (invoice.status === 'void') {
    throw new Error('لا يمكن تسجيل دفعات لفاتورة ملغاة.');
  }

  const { data: payment, error } = await context.db
    .from('payments')
    .insert({
      org_id: orgId,
      invoice_id: invoiceId,
      amount,
      method: cleanText(payload.method) ? cleanText(payload.method).slice(0, 80) : null,
      paid_at: payload.paid_at ?? null,
      note: cleanText(payload.note) ? cleanText(payload.note).slice(0, 500) : null,
      created_by: context.user.id,
    })
    .select(INVOICE_PAYMENT_SELECT)
    .single();

  if (error || !payment) {
    throw error ?? new Error('تعذر تسجيل الدفعة.');
  }

  const paidAmount = await computeInvoicePaidAmount(context.db, orgId, invoiceId);
  const newStatus = computeInvoiceStatus(Number(invoice.total), paidAmount);

  const { error: statusError } = await context.db
    .from('invoices')
    .update({ status: newStatus })
    .eq('org_id', orgId)
    .eq('id', invoiceId);

  if (statusError) {
    console.error('Failed to update invoice status after mobile payment:', statusError.message);
  }

  const updatedInvoice = await getInvoiceById(context.db, orgId, invoiceId);
  if (!updatedInvoice) throw new Error('not_found');

  return {
    payment: payment as Payment,
    invoice: updatedInvoice,
    paidAmount,
  };
}

async function deleteQuoteCore(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const { data, error } = await context.db
    .from('quotes')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('not_found');
}

async function deleteInvoiceCore(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const { data, error } = await context.db.rpc('delete_invoice_cascade', {
    p_org_id: orgId,
    p_actor_id: context.user.id,
    p_invoice_id: id,
  });

  if (error) {
    const message = String(error.message ?? '').toLowerCase();
    if (message.includes('not_found')) throw new Error('not_found');
    if (message.includes('not_allowed')) throw new Error('لا تملك صلاحية لهذا الإجراء.');
    throw error;
  }

  const storagePaths = normalizeStoragePaths(data as { storage_paths?: string[] | null } | null);
  if (storagePaths.length) {
    const { error: removeError } = await context.db.storage.from('documents').remove(storagePaths);
    if (removeError) {
      console.warn('invoice storage cleanup failed', removeError.message);
    }
  }
}

function normalizeStoragePaths(result: { storage_paths?: string[] | null } | null) {
  if (!result?.storage_paths || !Array.isArray(result.storage_paths)) return [];
  return result.storage_paths.map((value) => String(value ?? '').trim()).filter(Boolean);
}

export async function getOfficeBillingRecord(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const invoice = await getInvoiceById(context.db, orgId, id);
  if (invoice) {
    const payments = await listInvoicePaymentsCore(context, id);
    return {
      kind: 'invoice' as const,
      invoice,
      payments,
    };
  }

  const quote = await getQuoteById(context.db, orgId, id);
  if (quote) {
    return {
      kind: 'quote' as const,
      quote,
    };
  }

  return null;
}

export async function createOfficeQuote(
  context: MobileAppSessionContext,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    status?: QuoteStatus;
  },
) {
  return createQuoteCore(context, payload);
}

export async function updateOfficeQuote(
  context: MobileAppSessionContext,
  id: string,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    status: QuoteStatus;
  },
) {
  return updateQuoteCore(context, id, payload);
}

export async function createOfficeInvoice(
  context: MobileAppSessionContext,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    due_at?: string | null;
  },
) {
  return createInvoiceCore(context, payload);
}

export async function updateOfficeInvoice(
  context: MobileAppSessionContext,
  id: string,
  payload: {
    client_id: string;
    matter_id?: string | null;
    items: BillingItem[];
    tax?: number;
    tax_enabled?: boolean;
    tax_number?: string | null;
    due_at?: string | null;
    status?: InvoiceStatus;
  },
) {
  return updateInvoiceCore(context, id, payload);
}

export async function setOfficeInvoiceArchived(context: MobileAppSessionContext, id: string, archived: boolean) {
  return setInvoiceArchivedCore(context, id, archived);
}

export async function deleteOfficeBillingRecord(context: MobileAppSessionContext, id: string) {
  const record = await getOfficeBillingRecord(context, id);
  if (!record) throw new Error('not_found');

  if (record.kind === 'invoice') {
    await deleteInvoiceCore(context, id);
    return { kind: 'invoice' as const };
  }

  await deleteQuoteCore(context, id);
  return { kind: 'quote' as const };
}

export async function listOfficeInvoicePayments(context: MobileAppSessionContext, invoiceId: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const invoice = await getInvoiceById(context.db, orgId, invoiceId);
  if (!invoice) throw new Error('not_found');
  return listInvoicePaymentsCore(context, invoiceId);
}

export async function addOfficeInvoicePayment(
  context: MobileAppSessionContext,
  invoiceId: string,
  payload: { amount: number; method?: string | null; paid_at?: string | null; note?: string | null },
) {
  return addInvoicePaymentCore(context, invoiceId, payload);
}
