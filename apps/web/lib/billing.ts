import 'server-only';

import { z } from 'zod';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'void';

export type BillingItem = {
  desc: string;
  qty: number;
  unit_price: number;
};

export type Quote = {
  id: string;
  org_id: string;
  client_id: string;
  matter_id: string | null;
  number: string;
  items: BillingItem[];
  total: string; // numeric -> string from PostgREST
  currency: string;
  status: QuoteStatus;
  created_by: string;
  created_at: string;
  client: { id: string; name: string } | null;
  matter: { id: string; title: string } | null;
};

type QuoteRow = Omit<Quote, 'client' | 'matter'> & {
  client: { id: string; name: string } | { id: string; name: string }[] | null;
  matter: { id: string; title: string } | { id: string; title: string }[] | null;
};

export type Invoice = {
  id: string;
  org_id: string;
  client_id: string;
  matter_id: string | null;
  number: string;
  items: BillingItem[];
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  created_by: string;
  client: { id: string; name: string } | null;
  matter: { id: string; title: string } | null;
};

type InvoiceRow = Omit<Invoice, 'client' | 'matter'> & {
  client: { id: string; name: string } | { id: string; name: string }[] | null;
  matter: { id: string; title: string } | { id: string; title: string }[] | null;
};

export type Payment = {
  id: string;
  org_id: string;
  invoice_id: string;
  amount: string;
  method: string | null;
  paid_at: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

const itemSchema = z.object({
  desc: z.string().trim().min(1, 'وصف البند مطلوب.').max(400, 'وصف البند طويل جدًا.'),
  qty: z.preprocess((value) => Number(value), z.number().positive('الكمية يجب أن تكون أكبر من 0.')),
  unit_price: z.preprocess((value) => Number(value), z.number().min(0, 'سعر الوحدة غير صالح.')),
});

export const itemsSchema = z.array(itemSchema).min(1, 'أضف بندًا واحدًا على الأقل.').max(50, 'عدد البنود كبير جدًا.');

function normalizeItems(items: BillingItem[]) {
  return items.map((item) => ({
    desc: item.desc.trim(),
    qty: Number(item.qty),
    unit_price: Number(item.unit_price),
  }));
}

function sumItems(items: BillingItem[]) {
  const total = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  return round2(total);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeRowClient<T extends { client: any }>(row: T) {
  const raw = row.client;
  const client = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  return { ...row, client };
}

function normalizeRowMatter<T extends { matter: any }>(row: T) {
  const raw = row.matter;
  const matter = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  return { ...row, matter };
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, org_id, client_id, matter_id, number, items, total, currency, status, created_by, created_at, client:clients(id, name), matter:matters(id, title)',
    )
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = normalizeRowMatter(normalizeRowClient(data as QuoteRow));
  return row as unknown as Quote;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, issued_at, due_at, created_by, client:clients(id, name), matter:matters(id, title)',
    )
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = normalizeRowMatter(normalizeRowClient(data as InvoiceRow));
  return row as unknown as Invoice;
}

export type ListQuotesParams = {
  status?: QuoteStatus | 'all';
  clientId?: string;
  page?: number;
  limit?: number;
};

export async function listQuotes(params: ListQuotesParams = {}): Promise<PaginatedResult<Quote>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'all';
  const clientId = params.clientId?.trim();

  let query = supabase
    .from('quotes')
    .select(
      'id, org_id, client_id, matter_id, number, items, total, currency, status, created_by, created_at, client:clients(id, name), matter:matters(id, title)',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') query = query.eq('status', status);
  if (clientId) query = query.eq('client_id', clientId);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: ((data as QuoteRow[] | null) ?? []).map((row) => normalizeRowMatter(normalizeRowClient(row)) as unknown as Quote),
    page,
    limit,
    total: count ?? 0,
  };
}

export type CreateQuotePayload = {
  client_id: string;
  matter_id?: string | null;
  items: BillingItem[];
  status?: QuoteStatus;
};

export async function createQuote(payload: CreateQuotePayload): Promise<Quote> {
  const orgId = await requireOrgIdForUser();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('not_authenticated');

  const supabase = createSupabaseServerRlsClient();

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود عرض السعر غير صحيحة.');
  }

  const items = normalizeItems(parsedItems.data);
  const total = sumItems(items);

  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 6; attempt++) {
    const number = await generateNextNumber({
      table: 'quotes',
      orgId,
      prefix: 'Q',
      year,
      supabase,
    });

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        org_id: orgId,
        client_id: payload.client_id,
        matter_id: payload.matter_id ?? null,
        number,
        items,
        total,
        currency: 'SAR',
        status: payload.status ?? 'draft',
        created_by: user.id,
      })
      .select(
        'id, org_id, client_id, matter_id, number, items, total, currency, status, created_by, created_at, client:clients(id, name), matter:matters(id, title)',
      )
      .single();

    if (!error && data) {
      const row = normalizeRowMatter(normalizeRowClient(data as QuoteRow));
      return row as unknown as Quote;
    }

    if (error && isUniqueViolation(error)) {
      continue;
    }

    throw error ?? new Error('تعذر إنشاء عرض السعر.');
  }

  throw new Error('تعذر إنشاء عرض السعر.');
}

export type UpdateQuotePayload = {
  client_id: string;
  matter_id?: string | null;
  items: BillingItem[];
  status: QuoteStatus;
};

export async function updateQuote(id: string, payload: UpdateQuotePayload): Promise<Quote> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود عرض السعر غير صحيحة.');
  }

  const items = normalizeItems(parsedItems.data);
  const total = sumItems(items);

  const { data, error } = await supabase
    .from('quotes')
    .update({
      client_id: payload.client_id,
      matter_id: payload.matter_id ?? null,
      items,
      total,
      status: payload.status,
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(
      'id, org_id, client_id, matter_id, number, items, total, currency, status, created_by, created_at, client:clients(id, name), matter:matters(id, title)',
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('not_found');

  const row = normalizeRowMatter(normalizeRowClient(data as QuoteRow));
  return row as unknown as Quote;
}

export type ListInvoicesParams = {
  status?: InvoiceStatus | 'all';
  clientId?: string;
  page?: number;
  limit?: number;
};

export async function listInvoices(params: ListInvoicesParams = {}): Promise<PaginatedResult<Invoice>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'all';
  const clientId = params.clientId?.trim();

  let query = supabase
    .from('invoices')
    .select(
      'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, issued_at, due_at, created_by, client:clients(id, name), matter:matters(id, title)',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .order('issued_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') query = query.eq('status', status);
  if (clientId) query = query.eq('client_id', clientId);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: ((data as InvoiceRow[] | null) ?? []).map((row) => normalizeRowMatter(normalizeRowClient(row)) as unknown as Invoice),
    page,
    limit,
    total: count ?? 0,
  };
}

export type CreateInvoicePayload = {
  client_id: string;
  matter_id?: string | null;
  items: BillingItem[];
  tax?: number;
  due_at?: string | null;
};

export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  const orgId = await requireOrgIdForUser();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('not_authenticated');

  const supabase = createSupabaseServerRlsClient();

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود الفاتورة غير صحيحة.');
  }

  const items = normalizeItems(parsedItems.data);
  const subtotal = sumItems(items);
  const tax = round2(Math.max(0, payload.tax ?? 0));
  const total = round2(subtotal + tax);

  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 6; attempt++) {
    const number = await generateNextNumber({
      table: 'invoices',
      orgId,
      prefix: 'INV',
      year,
      supabase,
    });

    const { data, error } = await supabase
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
        currency: 'SAR',
        status: 'unpaid',
        due_at: payload.due_at ?? null,
        created_by: user.id,
      })
      .select(
        'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, issued_at, due_at, created_by, client:clients(id, name), matter:matters(id, title)',
      )
      .single();

    if (!error && data) {
      const row = normalizeRowMatter(normalizeRowClient(data as InvoiceRow));
      return row as unknown as Invoice;
    }

    if (error && isUniqueViolation(error)) {
      continue;
    }

    throw error ?? new Error('تعذر إنشاء الفاتورة.');
  }

  throw new Error('تعذر إنشاء الفاتورة.');
}

export type UpdateInvoicePayload = {
  client_id: string;
  matter_id?: string | null;
  items: BillingItem[];
  tax?: number;
  due_at?: string | null;
  status?: InvoiceStatus;
};

export async function updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<Invoice> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const parsedItems = itemsSchema.safeParse(payload.items);
  if (!parsedItems.success) {
    throw new Error(parsedItems.error.issues[0]?.message ?? 'بنود الفاتورة غير صحيحة.');
  }

  const items = normalizeItems(parsedItems.data);
  const subtotal = sumItems(items);
  const tax = round2(Math.max(0, payload.tax ?? 0));
  const total = round2(subtotal + tax);

  const existing = await getInvoiceById(id);
  if (!existing) throw new Error('not_found');

  const paidAmount = await computeInvoicePaidAmount(id);
  const effectiveStatus =
    payload.status === 'void' || existing.status === 'void'
      ? 'void'
      : computeInvoiceStatus(total, paidAmount);

  const { data, error } = await supabase
    .from('invoices')
    .update({
      client_id: payload.client_id,
      matter_id: payload.matter_id ?? null,
      items,
      subtotal,
      tax,
      total,
      due_at: payload.due_at ?? null,
      status: effectiveStatus,
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(
      'id, org_id, client_id, matter_id, number, items, subtotal, tax, total, currency, status, issued_at, due_at, created_by, client:clients(id, name), matter:matters(id, title)',
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('not_found');

  const row = normalizeRowMatter(normalizeRowClient(data as InvoiceRow));
  return row as unknown as Invoice;
}

export type AddPaymentPayload = {
  amount: number;
  method?: string | null;
  paid_at?: string | null;
  note?: string | null;
};

export async function addPayment(invoiceId: string, payload: AddPaymentPayload): Promise<{
  payment: Payment;
  invoice: Invoice;
  paidAmount: number;
}> {
  const orgId = await requireOrgIdForUser();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('not_authenticated');

  const supabase = createSupabaseServerRlsClient();

  const amount = round2(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('قيمة الدفعة غير صحيحة.');
  }

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error('not_found');
  if (invoice.status === 'void') {
    throw new Error('لا يمكن تسجيل دفعات لفاتورة ملغاة.');
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      org_id: orgId,
      invoice_id: invoiceId,
      amount,
      method: payload.method?.trim() ? payload.method.trim().slice(0, 80) : null,
      paid_at: payload.paid_at ?? null,
      note: payload.note?.trim() ? payload.note.trim().slice(0, 500) : null,
      created_by: user.id,
    })
    .select('id, org_id, invoice_id, amount, method, paid_at, note, created_by, created_at')
    .single();

  if (paymentError || !payment) {
    throw paymentError ?? new Error('تعذر تسجيل الدفعة.');
  }

  const paidAmount = await computeInvoicePaidAmount(invoiceId);
  const total = Number(invoice.total);
  const status = computeInvoiceStatus(total, paidAmount);

  const updatedInvoice = await updateInvoice(invoiceId, {
    client_id: invoice.client_id,
    matter_id: invoice.matter_id,
    items: invoice.items,
    tax: Number(invoice.tax),
    due_at: invoice.due_at,
    status,
  });

  return {
    payment: payment as Payment,
    invoice: updatedInvoice,
    paidAmount,
  };
}

export async function listPayments(invoiceId: string): Promise<Payment[]> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('payments')
    .select('id, org_id, invoice_id, amount, method, paid_at, note, created_by, created_at')
    .eq('org_id', orgId)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Payment[] | null) ?? [];
}

export async function computeInvoicePaidAmount(invoiceId: string): Promise<number> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
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

function computeInvoiceStatus(total: number, paidAmount: number): InvoiceStatus {
  const safeTotal = Number.isFinite(total) ? total : 0;
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount + 0.0001 >= safeTotal) return 'paid';
  return 'partial';
}

async function generateNextNumber(params: {
  table: 'quotes' | 'invoices';
  orgId: string;
  prefix: string;
  year: number;
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
}) {
  const basePrefix = `${params.prefix}-${params.year}-`;
  const orderCol = params.table === 'quotes' ? 'created_at' : 'issued_at';

  const { data, error } = await params.supabase
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

  const last = typeof data?.number === 'string' ? parseNumberSuffix(data.number) : 0;
  const next = Math.max(0, last) + 1;

  return `${basePrefix}${String(next).padStart(4, '0')}`;
}

function parseNumberSuffix(value: string) {
  const match = value.match(/(\d{4})$/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
}

function isUniqueViolation(error: any) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return code === '23505' || message.includes('duplicate key') || message.includes('unique');
}

