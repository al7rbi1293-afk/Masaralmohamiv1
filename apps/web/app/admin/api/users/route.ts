import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /admin/api/users — list all users with org/status
 * PATCH /admin/api/users — suspend/activate/delete-pending user
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const adminClient = createSupabaseServerClient();

  const [{ data, error }, { data: pendingData, error: pendingError }] = await Promise.all([
    adminClient
      .from('profiles')
      .select(`
      user_id, full_name, phone, status, created_at,
      memberships ( org_id, role, organizations:org_id ( name, status ) )
    `)
      .order('created_at', { ascending: false })
      .limit(500),
    adminClient
      .schema('auth')
      .from('users')
      .select('id, email, created_at, email_confirmed_at')
      .is('email_confirmed_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  const pending = ((pendingData as any[] | null) ?? []).map((row) => {
    const createdAt = String(row.created_at ?? '');
    const createdAtDate = new Date(createdAt);
    const ageHours = Number.isNaN(createdAtDate.getTime())
      ? 0
      : (Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60);

    return {
      user_id: String(row.id),
      email: row.email ? String(row.email) : null,
      created_at: createdAt,
      email_confirmed_at: row.email_confirmed_at ? String(row.email_confirmed_at) : null,
      older_than_3h: ageHours >= 3,
    };
  });

  return NextResponse.json({ users: data ?? [], pending });
}

export async function PATCH(request: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, action } = body as {
    user_id: string;
    action: 'suspend' | 'activate' | 'delete_pending';
  };

  if (!user_id || !['suspend', 'activate', 'delete_pending'].includes(action)) {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const adminClient = createSupabaseServerClient();

  if (action === 'delete_pending') {
    const { data: authUser, error: authUserError } = await adminClient
      .schema('auth')
      .from('users')
      .select('id, email_confirmed_at')
      .eq('id', user_id)
      .maybeSingle();

    if (authUserError) {
      return NextResponse.json({ error: authUserError.message }, { status: 500 });
    }

    if (!authUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود.' }, { status: 404 });
    }

    if ((authUser as any).email_confirmed_at) {
      return NextResponse.json({ error: 'لا يمكن حذف حساب مفعّل.' }, { status: 409 });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'deleted' });
  }

  const newStatus = action === 'suspend' ? 'suspended' : 'active';
  const { error } = await adminClient
    .from('profiles')
    .update({ status: newStatus })
    .eq('user_id', user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: membership } = await adminClient
    .from('memberships')
    .select('org_id')
    .eq('user_id', user_id)
    .limit(1)
    .maybeSingle();

  if ((membership as any)?.org_id) {
    await adminClient.from('audit_logs').insert({
      org_id: (membership as any).org_id,
      user_id: adminId,
      action: action === 'suspend' ? 'user_suspended' : 'user_activated',
      entity_type: 'profile',
      entity_id: user_id,
      meta: { target_user_id: user_id },
    });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
