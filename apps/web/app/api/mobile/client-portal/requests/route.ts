import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClientPortalContext } from '@/lib/mobile/client-portal';

export const runtime = 'nodejs';

const bodySchema = z.object({
  subject: z.string().trim().min(2, 'عنوان الطلب مطلوب.').max(120, 'عنوان الطلب طويل جدًا.'),
  message: z.string().trim().min(5, 'وصف الطلب مطلوب.').max(2000, 'وصف الطلب طويل جدًا.'),
});

type RequestRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  firm_name: string | null;
  message: string | null;
  source: string;
};

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireClientPortalContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, session } = auth.context;
  const { data: client } = await db
    .from('clients')
    .select('id, name, phone')
    .eq('id', session.clientId)
    .eq('org_id', session.orgId)
    .maybeSingle();

  const clientRow = client as ClientRow | null;
  if (!clientRow) {
    return NextResponse.json({ items: [] });
  }

  const { data } = await db
    .from('full_version_requests')
    .select('id, created_at, full_name, email, phone, firm_name, message, source')
    .eq('org_id', session.orgId)
    .eq('email', session.email)
    .order('created_at', { ascending: false })
    .limit(25);

  const items = ((data as RequestRow[] | null) ?? []).map((item) => ({
    id: String(item.id),
    created_at: String(item.created_at ?? new Date().toISOString()),
    full_name: item.full_name ? String(item.full_name) : clientRow.name,
    email: String(item.email ?? session.email),
    phone: item.phone ? String(item.phone) : clientRow.phone,
    firm_name: item.firm_name ? String(item.firm_name) : null,
    message: item.message ? String(item.message) : null,
    source: String(item.source ?? 'contact'),
  }));

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireClientPortalContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, session } = auth.context;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const { data: client } = await db
    .from('clients')
    .select('id, name, phone')
    .eq('id', session.clientId)
    .eq('org_id', session.orgId)
    .maybeSingle();

  const clientRow = client as ClientRow | null;
  if (!clientRow) {
    return NextResponse.json({ error: 'تعذر العثور على حساب العميل المرتبط.' }, { status: 404 });
  }

  const { data: inserted, error } = await db
    .from('full_version_requests')
    .insert({
      org_id: session.orgId,
      user_id: null,
      full_name: clientRow.name,
      email: session.email,
      phone: clientRow.phone,
      firm_name: parsed.data.subject,
      message: parsed.data.message,
      source: 'contact',
    })
    .select('id, created_at, full_name, email, phone, firm_name, message, source')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: 'تعذر إرسال الطلب حاليًا.' }, { status: 500 });
  }

  const payload = inserted as RequestRow;
  return NextResponse.json({
    ok: true,
    message: 'تم إرسال طلبك إلى المكتب بنجاح.',
    request: {
      id: String(payload.id),
      created_at: String(payload.created_at ?? new Date().toISOString()),
      full_name: payload.full_name ? String(payload.full_name) : clientRow.name,
      email: String(payload.email ?? session.email),
      phone: payload.phone ? String(payload.phone) : clientRow.phone,
      firm_name: payload.firm_name ? String(payload.firm_name) : parsed.data.subject,
      message: payload.message ? String(payload.message) : parsed.data.message,
      source: String(payload.source ?? 'contact'),
    },
  });
}
