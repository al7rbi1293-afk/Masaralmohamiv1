import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import {
  ClientPortalDashboard,
  type ClientPortalDashboardData,
  type ClientPortalDocument,
  type ClientPortalDocumentVersion,
  type ClientPortalInvoice,
  type ClientPortalQuote,
  type ClientPortalMatter,
  type ClientPortalMatterEvent,
  type ClientPortalMatterCommunication,
} from '@/components/client-portal/client-portal-dashboard';
import { getActiveClientPortalAccess } from '@/lib/client-portal/access';

export const metadata: Metadata = {
  title: 'بوابة العميل',
  description: 'لوحة متابعة القضايا والفواتير والمستندات للعميل.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/client-portal',
  },
};

export default async function ClientPortalHomePage() {
  const access = await getActiveClientPortalAccess();
  if (!access) {
    redirect('/client-portal/signin');
  }

  const { db, session } = access;

  const [clientRes, mattersRes, invoicesRes, quotesRes, documentsRes] = await Promise.all([
    db
      .from('clients')
      .select('id, name, email, phone')
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

  const client = clientRes.data as { name?: string; email?: string | null; phone?: string | null } | null;
  if (!client) {
    redirect('/client-portal/signin');
  }

  const matters = ((mattersRes.data as RawMatterRow[] | null) ?? []).map((matter) => ({
    id: String(matter.id),
    title: String(matter.title ?? ''),
    status: String(matter.status ?? ''),
    summary: matter.summary ? String(matter.summary) : null,
    case_type: matter.case_type ? String(matter.case_type) : null,
    updated_at: String(matter.updated_at ?? new Date().toISOString()),
  }));

  const matterIds = matters.map((matter) => matter.id);
  const matterEventsByMatter = new Map<string, ClientPortalMatterEvent[]>();
  const communicationsByMatter = new Map<string, ClientPortalMatterCommunication[]>();

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

    const eventsRows = eventsRowsRes.data;
    const commsRows = commsRowsRes.data;

    const events = (eventsRows as RawMatterEventRow[] | null) ?? [];
    for (const event of events) {
      const matterId = String(event.matter_id ?? '').trim();
      if (!matterId) continue;

      const current = matterEventsByMatter.get(matterId) ?? [];
      if (current.length >= 5) continue;

      const creator = pickRelation<{ full_name: string | null }>(event.creator);

      current.push({
        id: String(event.id),
        type: String(event.type ?? 'note'),
        note: event.note ? String(event.note) : null,
        event_date: event.event_date ? String(event.event_date) : null,
        created_at: String(event.created_at ?? new Date().toISOString()),
        created_by_name: creator?.full_name ? String(creator.full_name) : null,
      });
      matterEventsByMatter.set(matterId, current);
    }

    const comms = (commsRows as RawMatterCommunicationRow[] | null) ?? [];
    for (const comm of comms) {
      const matterId = String(comm.matter_id ?? '').trim();
      if (!matterId) continue;

      const current = communicationsByMatter.get(matterId) ?? [];
      
      current.push({
        id: String(comm.id),
        sender: String(comm.sender) as 'CLIENT' | 'LAWYER',
        message: String(comm.message ?? ''),
        created_at: String(comm.created_at ?? new Date().toISOString()),
      });
      communicationsByMatter.set(matterId, current);
    }
  }

  const matterData = matters.map((matter) => ({
    ...matter,
    events: matterEventsByMatter.get(matter.id) ?? [],
    communications: communicationsByMatter.get(matter.id) ?? [],
  })) satisfies ClientPortalMatter[];

  const rawInvoices = ((invoicesRes.data as RawInvoiceRow[] | null) ?? []).map((invoice) => ({
    id: String(invoice.id),
    number: String(invoice.number ?? ''),
    status: String(invoice.status ?? ''),
    total: toNumber(invoice.total),
    currency: invoice.currency ? String(invoice.currency) : 'SAR',
    issued_at: invoice.issued_at ? String(invoice.issued_at) : null,
    due_at: invoice.due_at ? String(invoice.due_at) : null,
    matter_title: pickRelation<{ id: string; title: string }>(invoice.matter)?.title ?? null,
  }));

  const invoiceIds = rawInvoices.map((invoice) => invoice.id);
  const paidByInvoice = new Map<string, number>();
  if (invoiceIds.length) {
    const { data: paymentsRows } = await db
      .from('payments')
      .select('invoice_id, amount')
      .eq('org_id', session.orgId)
      .in('invoice_id', invoiceIds);

    const payments = (paymentsRows as RawPaymentRow[] | null) ?? [];
    for (const payment of payments) {
      const invoiceId = String(payment.invoice_id ?? '').trim();
      if (!invoiceId) continue;
      const amount = toNumber(payment.amount);
      const current = paidByInvoice.get(invoiceId) ?? 0;
      paidByInvoice.set(invoiceId, current + amount);
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
  }) satisfies ClientPortalInvoice[];

  const quotes = ((quotesRes.data as RawQuoteRow[] | null) ?? []).map((quote) => ({
    id: String(quote.id),
    number: String(quote.number ?? ''),
    status: String(quote.status ?? ''),
    total: toNumber(quote.total),
    currency: quote.currency ? String(quote.currency) : 'SAR',
    created_at: String(quote.created_at ?? new Date().toISOString()),
    matter_title: pickRelation<{ id: string; title: string }>(quote.matter)?.title ?? null,
  })) satisfies ClientPortalQuote[];

  const rawDocuments = ((documentsRes.data as RawDocumentRow[] | null) ?? []).map((document) => ({
    id: String(document.id),
    title: String(document.title ?? ''),
    matter_id: document.matter_id ? String(document.matter_id) : null,
    matter_title: pickRelation<{ id: string; title: string }>(document.matter)?.title ?? null,
    created_at: String(document.created_at ?? new Date().toISOString()),
  }));

  const documentIds = rawDocuments.map((document) => document.id);
  const latestVersionByDocument = new Map<string, ClientPortalDocumentVersion>();

  if (documentIds.length) {
    const { data: versionRows } = await db
      .from('document_versions')
      .select('document_id, version_no, storage_path, file_name, file_size, mime_type, created_at')
      .eq('org_id', session.orgId)
      .in('document_id', documentIds)
      .order('version_no', { ascending: false })
      .order('created_at', { ascending: false });

    const versions = (versionRows as RawDocumentVersionRow[] | null) ?? [];
    for (const version of versions) {
      const documentId = String(version.document_id ?? '').trim();
      if (!documentId) continue;
      if (latestVersionByDocument.has(documentId)) continue;
      latestVersionByDocument.set(documentId, {
        version_no: Number(version.version_no ?? 1),
        storage_path: String(version.storage_path ?? ''),
        file_name: String(version.file_name ?? ''),
        file_size: Number(version.file_size ?? 0),
        mime_type: version.mime_type ? String(version.mime_type) : null,
        created_at: String(version.created_at ?? new Date().toISOString()),
      });
    }
  }

  const documents = rawDocuments.map((document) => ({
    ...document,
    latest_version: latestVersionByDocument.get(document.id) ?? null,
  })) satisfies ClientPortalDocument[];

  const dashboardData: ClientPortalDashboardData = {
    client: {
      name: String(client.name ?? 'عميلنا'),
      email: client.email ? String(client.email) : session.email,
      phone: client.phone ? String(client.phone) : null,
    },
    matters: matterData,
    invoices,
    quotes,
    documents,
  };

  return (
    <Section className="py-12 sm:py-16">
      <Container className="max-w-5xl">
        <ClientPortalDashboard data={dashboardData} />
      </Container>
    </Section>
  );
}

type RawMatterRow = {
  id: string;
  title: string;
  status: string;
  summary: string | null;
  case_type: string | null;
  updated_at: string;
};

type RawMatterEventRow = {
  id: string;
  matter_id: string;
  type: string;
  note: string | null;
  event_date: string | null;
  created_at: string;
  creator: { full_name: string | null } | { full_name: string | null }[] | null;
};

type RawMatterCommunicationRow = {
  id: string;
  matter_id: string;
  sender: string;
  message: string;
  created_at: string;
};

type RawInvoiceRow = {
  id: string;
  number: string;
  status: string;
  total: string | number;
  currency: string | null;
  issued_at: string | null;
  due_at: string | null;
  matter: { id: string; title: string } | { id: string; title: string }[] | null;
};

type RawQuoteRow = {
  id: string;
  number: string;
  status: string;
  total: string | number;
  currency: string | null;
  created_at: string;
  matter: { id: string; title: string } | { id: string; title: string }[] | null;
};

type RawDocumentRow = {
  id: string;
  title: string;
  matter_id: string | null;
  created_at: string;
  matter: { id: string; title: string } | { id: string; title: string }[] | null;
};

type RawDocumentVersionRow = {
  document_id: string;
  version_no: number;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
};

type RawPaymentRow = {
  invoice_id: string;
  amount: string | number;
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
