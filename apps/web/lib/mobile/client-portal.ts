import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalSessionToken } from '@/lib/client-portal/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBearerToken } from '@/lib/mobile/auth';

type ClientPortalSessionContext = {
  db: SupabaseClient;
  token: string;
  session: {
    portalUserId: string;
    clientId: string;
    orgId: string;
    email: string;
  };
};

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function requireClientPortalContext(request: NextRequest | Request) {
  const tokenFromHeader = getBearerToken(request);
  const tokenFromQuery = new URL(request.url).searchParams.get('access_token')?.trim() ?? '';
  const token = tokenFromHeader || tokenFromQuery || null;
  if (!token) {
    return { ok: false as const, status: 401, error: 'مطلوب رمز وصول صالح.' };
  }

  const session = await verifyClientPortalSessionToken(token);
  if (!session) {
    return { ok: false as const, status: 401, error: 'رمز الوصول غير صالح أو منتهي الصلاحية.' };
  }

  const db = createSupabaseServerClient();
  const { data: portalUser, error } = await db
    .from('client_portal_users')
    .select('id, status')
    .eq('id', session.portalUserId)
    .eq('org_id', session.orgId)
    .eq('client_id', session.clientId)
    .eq('email', session.email)
    .maybeSingle();

  if (error || !portalUser || String((portalUser as any).status ?? '') !== 'active') {
    return { ok: false as const, status: 401, error: 'جلسة بوابة العميل غير صالحة.' };
  }

  return {
    ok: true as const,
    status: 200,
    context: {
      db,
      token,
      session,
    } satisfies ClientPortalSessionContext,
  };
}

export async function getClientPortalBootstrapData(context: ClientPortalSessionContext) {
  const { db, session } = context;

  const [clientRes, mattersRes, invoicesRes, quotesRes, documentsRes] = await Promise.all([
    db
      .from('clients')
      .select('id, name, email, phone, identity_no, commercial_no')
      .eq('id', session.clientId)
      .eq('org_id', session.orgId)
      .maybeSingle(),
    db
      .from('matters')
      .select('id, title, status, summary, case_type, updated_at')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('updated_at', { ascending: false })
      .limit(50),
    db
      .from('invoices')
      .select('id, number, status, total, currency, issued_at, due_at, matter:matters(id, title)')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('issued_at', { ascending: false })
      .limit(50),
    db
      .from('quotes')
      .select('id, number, status, total, currency, created_at, matter:matters(id, title)')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('documents')
      .select('id, title, matter_id, created_at, matter:matters(id, title)')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const client = clientRes.data as {
    id: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
    identity_no?: string | null;
    commercial_no?: string | null;
  } | null;

  if (!client) {
    return null;
  }

  const matters = ((mattersRes.data as Array<Record<string, unknown>> | null) ?? []).map((matter) => ({
    id: String(matter.id ?? ''),
    title: String(matter.title ?? ''),
    status: String(matter.status ?? ''),
    summary: matter.summary ? String(matter.summary) : null,
    case_type: matter.case_type ? String(matter.case_type) : null,
    updated_at: String(matter.updated_at ?? ''),
  }));

  const matterIds = matters.map((matter) => matter.id);
  const matterEventsByMatter = new Map<string, Array<Record<string, unknown>>>();
  const communicationsByMatter = new Map<string, Array<Record<string, unknown>>>();

  if (matterIds.length) {
    const [eventsRowsRes, commsRowsRes] = await Promise.all([
      db
        .from('matter_events')
        .select('id, matter_id, type, note, event_date, created_at, creator:app_users(full_name)')
        .eq('org_id', session.orgId)
        .in('matter_id', matterIds)
        .order('created_at', { ascending: false })
        .limit(300),
      db
        .from('matter_communications')
        .select('id, matter_id, sender, message, created_at')
        .eq('org_id', session.orgId)
        .in('matter_id', matterIds)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    for (const event of (eventsRowsRes.data as Array<Record<string, unknown>> | null) ?? []) {
      const matterId = String(event.matter_id ?? '').trim();
      if (!matterId) continue;

      const bucket = matterEventsByMatter.get(matterId) ?? [];
      if (bucket.length >= 5) continue;

      const creator = pickRelation<{ full_name: string | null }>(event.creator as any);
      bucket.push({
        id: String(event.id ?? ''),
        type: String(event.type ?? ''),
        note: event.note ? String(event.note) : null,
        event_date: event.event_date ? String(event.event_date) : null,
        created_at: event.created_at ? String(event.created_at) : null,
        created_by_name: creator?.full_name ? String(creator.full_name) : null,
      });
      matterEventsByMatter.set(matterId, bucket);
    }

    for (const comm of (commsRowsRes.data as Array<Record<string, unknown>> | null) ?? []) {
      const matterId = String(comm.matter_id ?? '').trim();
      if (!matterId) continue;

      const bucket = communicationsByMatter.get(matterId) ?? [];
      bucket.push({
        id: String(comm.id ?? ''),
        sender: String(comm.sender ?? ''),
        message: String(comm.message ?? ''),
        created_at: comm.created_at ? String(comm.created_at) : null,
      });
      communicationsByMatter.set(matterId, bucket);
    }
  }

  const rawInvoices = ((invoicesRes.data as Array<Record<string, unknown>> | null) ?? []).map((invoice) => ({
    id: String(invoice.id ?? ''),
    number: String(invoice.number ?? ''),
    status: String(invoice.status ?? ''),
    total: toNumber(invoice.total as any),
    currency: invoice.currency ? String(invoice.currency) : 'SAR',
    issued_at: invoice.issued_at ? String(invoice.issued_at) : null,
    due_at: invoice.due_at ? String(invoice.due_at) : null,
    matter_title: pickRelation<{ id: string; title: string }>(invoice.matter as any)?.title ?? null,
  }));

  const invoiceIds = rawInvoices.map((invoice) => invoice.id);
  const paidByInvoice = new Map<string, number>();
  if (invoiceIds.length) {
    const { data: paymentsRows } = await db
      .from('payments')
      .select('invoice_id, amount')
      .eq('org_id', session.orgId)
      .in('invoice_id', invoiceIds);

    for (const payment of (paymentsRows as Array<Record<string, unknown>> | null) ?? []) {
      const invoiceId = String(payment.invoice_id ?? '').trim();
      if (!invoiceId) continue;
      const current = paidByInvoice.get(invoiceId) ?? 0;
      paidByInvoice.set(invoiceId, current + toNumber(payment.amount as any));
    }
  }

  const invoices = rawInvoices.map((invoice) => {
    const paid = round2(paidByInvoice.get(invoice.id) ?? 0);
    const remaining = Math.max(0, round2(invoice.total - paid));
    return {
      ...invoice,
      paid_amount: paid,
      remaining_amount: remaining,
    };
  });

  const quotes = ((quotesRes.data as Array<Record<string, unknown>> | null) ?? []).map((quote) => ({
    id: String(quote.id ?? ''),
    number: String(quote.number ?? ''),
    status: String(quote.status ?? ''),
    total: toNumber(quote.total as any),
    currency: quote.currency ? String(quote.currency) : 'SAR',
    created_at: String(quote.created_at ?? ''),
    matter_title: pickRelation<{ id: string; title: string }>(quote.matter as any)?.title ?? null,
  }));

  const rawDocuments = ((documentsRes.data as Array<Record<string, unknown>> | null) ?? []).map((document) => ({
    id: String(document.id ?? ''),
    title: String(document.title ?? ''),
    matter_id: document.matter_id ? String(document.matter_id) : null,
    matter_title: pickRelation<{ id: string; title: string }>(document.matter as any)?.title ?? null,
    created_at: String(document.created_at ?? ''),
  }));

  const documentIds = rawDocuments.map((document) => document.id);
  const latestVersionByDocument = new Map<string, Record<string, unknown>>();
  const externalDocumentMetaByDocument = new Map<string, Array<Record<string, unknown>>>();

  if (documentIds.length) {
    const [{ data: versionRows, error: versionsError }, { data: externalRows, error: externalError }] = await Promise.all([
      db
        .from('document_versions')
        .select('document_id, version_no, storage_path, file_name, file_size, mime_type, created_at')
        .eq('org_id', session.orgId)
        .in('document_id', documentIds)
        .order('version_no', { ascending: false })
        .order('created_at', { ascending: false }),
      db
        .from('external_documents')
        .select('document_id, portal_visible, document_type, synced_at, processed_at, processing_status')
        .eq('org_id', session.orgId)
        .in('document_id', documentIds),
    ]);

    if (versionsError) {
      throw versionsError;
    }
    if (externalError) {
      throw externalError;
    }

    for (const version of (versionRows as Array<Record<string, unknown>> | null) ?? []) {
      const documentId = String(version.document_id ?? '').trim();
      if (!documentId || latestVersionByDocument.has(documentId)) continue;
      latestVersionByDocument.set(documentId, version);
    }

    for (const row of (externalRows as Array<Record<string, unknown>> | null) ?? []) {
      const documentId = String(row.document_id ?? '').trim();
      if (!documentId) continue;
      const bucket = externalDocumentMetaByDocument.get(documentId) ?? [];
      bucket.push(row);
      externalDocumentMetaByDocument.set(documentId, bucket);
    }
  }

  const documents = rawDocuments
    .filter((document) => {
      const externalRows = externalDocumentMetaByDocument.get(document.id) ?? [];
      if (!externalRows.length) return true;
      return externalRows.some((row) => Boolean(row.portal_visible));
    })
    .map((document) => {
      const externalRows = externalDocumentMetaByDocument.get(document.id) ?? [];
      const primaryExternal = externalRows.find((row) => Boolean(row.portal_visible)) ?? externalRows[0] ?? null;
      const latest = latestVersionByDocument.get(document.id) ?? null;

      return {
        ...document,
        latest_version: latest
          ? {
              version_no: Number(latest.version_no ?? 1),
              storage_path: String(latest.storage_path ?? ''),
              file_name: String(latest.file_name ?? ''),
              file_size: Number(latest.file_size ?? 0),
              mime_type: latest.mime_type ? String(latest.mime_type) : null,
              created_at: latest.created_at ? String(latest.created_at) : null,
            }
          : null,
        is_external_sync: externalRows.length > 0,
        source: externalRows.length ? 'najiz' : null,
        source_document_type: primaryExternal?.document_type ? String(primaryExternal.document_type) : null,
        source_synced_at: primaryExternal?.synced_at ? String(primaryExternal.synced_at) : null,
        processing_status: primaryExternal?.processing_status ? String(primaryExternal.processing_status) : null,
      };
    });

  return {
    session: {
      portal_user_id: session.portalUserId,
      email: session.email,
    },
    client: {
      id: client.id,
      name: String(client.name ?? 'عميلنا'),
      email: client.email ? String(client.email) : session.email,
      phone: client.phone ? String(client.phone) : null,
      identity_no: client.identity_no ? String(client.identity_no) : null,
      commercial_no: client.commercial_no ? String(client.commercial_no) : null,
    },
    counts: {
      matters: matters.length,
      invoices: invoices.length,
      quotes: quotes.length,
      documents: documents.length,
      outstanding_balance: round2(invoices.reduce((sum, invoice) => sum + invoice.remaining_amount, 0)),
    },
    matters: matters.map((matter) => ({
      ...matter,
      events: matterEventsByMatter.get(matter.id) ?? [],
      communications: communicationsByMatter.get(matter.id) ?? [],
    })),
    invoices,
    quotes,
    documents,
  };
}
