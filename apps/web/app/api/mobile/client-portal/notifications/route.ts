import { NextRequest, NextResponse } from 'next/server';
import { requireClientPortalContext } from '@/lib/mobile/client-portal';

export const runtime = 'nodejs';

type MatterRow = {
  id: string;
  title: string;
  updated_at: string;
  status: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  due_at: string | null;
  total: string | number;
  currency: string | null;
  matter: { id: string; title: string } | null;
};

type DocumentRow = {
  id: string;
  title: string;
  created_at: string;
  matter: { id: string; title: string } | null;
};

type EventRow = {
  id: string;
  matter_id: string;
  type: string;
  note: string | null;
  created_at: string;
  matter: { id: string; title: string } | null;
};

type RequestRow = {
  id: string;
  created_at: string;
  firm_name: string | null;
  message: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireClientPortalContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, session } = auth.context;

  const mattersRes = await db
    .from('matters')
    .select('id, title, updated_at, status')
    .eq('org_id', session.orgId)
    .eq('client_id', session.clientId)
    .order('updated_at', { ascending: false })
    .limit(20);

  const matterIds = ((mattersRes.data as MatterRow[] | null) ?? []).map((item) => item.id);

  const [invoicesRes, documentsRes, eventsRes, requestsRes] = await Promise.all([
    db
      .from('invoices')
      .select('id, number, status, due_at, total, currency, matter:matters(id, title)')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('issued_at', { ascending: false })
      .limit(20),
    db
      .from('documents')
      .select('id, title, created_at, matter:matters(id, title)')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('created_at', { ascending: false })
      .limit(20),
    matterIds.length
      ? db
          .from('matter_events')
          .select('id, matter_id, type, note, created_at, matter:matters(id, title)')
          .eq('org_id', session.orgId)
          .in('matter_id', matterIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as EventRow[] }),
    db
      .from('full_version_requests')
      .select('id, created_at, firm_name, message')
      .eq('org_id', session.orgId)
      .eq('email', session.email)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const items = [
    ...((eventsRes.data as EventRow[] | null) ?? []).map((item) => ({
      id: `event:${item.id}`,
      kind: 'matter_event' as const,
      title: item.matter?.title ? `${item.matter.title}` : 'تحديث قضية',
      body: item.note || `تم تسجيل تحديث جديد من نوع ${item.type}.`,
      created_at: item.created_at,
      status: 'new',
      matter_title: item.matter?.title ?? null,
      invoice_number: null,
      document_title: null,
    })),
    ...((invoicesRes.data as InvoiceRow[] | null) ?? []).map((item) => ({
      id: `invoice:${item.id}`,
      kind: 'invoice' as const,
      title: `فاتورة ${item.number}`,
      body: `الحالة ${item.status}${item.due_at ? ` · الاستحقاق ${item.due_at}` : ''}.`,
      created_at: item.due_at ?? new Date().toISOString(),
      status: item.status,
      matter_title: item.matter?.title ?? null,
      invoice_number: item.number,
      document_title: null,
    })),
    ...((documentsRes.data as DocumentRow[] | null) ?? []).map((item) => ({
      id: `document:${item.id}`,
      kind: 'document' as const,
      title: item.title,
      body: item.matter?.title ? `مرتبط بـ ${item.matter.title}.` : 'مستند معتمد في بوابة العميل.',
      created_at: item.created_at,
      status: 'available',
      matter_title: item.matter?.title ?? null,
      invoice_number: null,
      document_title: item.title,
    })),
    ...((requestsRes.data as RequestRow[] | null) ?? []).map((item) => ({
      id: `request:${item.id}`,
      kind: 'request' as const,
      title: item.firm_name ? String(item.firm_name) : 'طلب جديد',
      body: item.message || 'تم استلام طلب من بوابة العميل.',
      created_at: item.created_at,
      status: 'submitted',
      matter_title: null,
      invoice_number: null,
      document_title: null,
    })),
  ]
    .sort((a, b) => {
      const left = new Date(b.created_at).getTime();
      const right = new Date(a.created_at).getTime();
      return left - right;
    })
    .slice(0, 40);

  return NextResponse.json({ items });
}
