import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /admin/api/users — list all users with org/status
 * PATCH /admin/api/users — suspend/activate/delete-pending user
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim() || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = (page - 1) * limit;

  const adminClient = createSupabaseServerClient();

  // Base query on the unified app_users table
  let dbQuery = adminClient
    .from('app_users')
    .select(`
      id,
      email,
      full_name,
      phone,
      status,
      created_at,
      email_confirmed_at,
      memberships (
        org_id,
        role,
        organizations (name, status)
      )
    `, { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.or(`email.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%`);
  }

  // Execute query safely
  const { data: usersData, error: usersError, count } = await dbQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const allUsers = usersData ?? [];

  // Separate active/confirmed users and pending users
  // Note: pending users are those without email_confirmed_at
  const pending = allUsers
    .filter((user) => !user.email_confirmed_at)
    .map((user) => {
      const createdAtDate = new Date(user.created_at);
      const ageHours = Number.isNaN(createdAtDate.getTime())
        ? 0
        : (Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60);

      return {
        user_id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
        older_than_3h: ageHours >= 3,
      };
    });

  const users = allUsers
    .filter((user) => user.email_confirmed_at)
    .map((user) => ({
      user_id: user.id,
      email: user.email,
      full_name: user.full_name ?? '',
      phone: user.phone ?? null,
      status: user.status ?? 'active',
      created_at: user.created_at,
      memberships: (user.memberships as any[]).map(m => ({
        org_id: m.org_id,
        role: m.role,
        organizations: Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
      })),
    }));

  return NextResponse.json({
    users,
    pending,
    total_count: count ?? 0,
    page,
    limit
  });
}

export async function PATCH(request: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, user_ids, action } = body as {
    user_id?: string;
    user_ids?: string[];
    action: 'suspend' | 'activate' | 'delete_pending';
  };

  const targetIds = user_ids || (user_id ? [user_id] : []);

  if (targetIds.length === 0 || !['suspend', 'activate', 'delete_pending'].includes(action)) {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const adminClient = createSupabaseServerClient();

  if (action === 'delete_pending') {
    // 1. Fetch users from app_users
    const { data: userRows, error: userError } = await adminClient
      .from('app_users')
      .select('id, email_confirmed_at')
      .in('id', targetIds);

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: 'المستخدم غير موجود.' }, { status: 404 });
    }

    const hasConfirmedUser = userRows.some(row => row.email_confirmed_at !== null);
    if (hasConfirmedUser) {
      return NextResponse.json({ error: 'لا يمكن حذف حساب مفعّل.' }, { status: 409 });
    }

    // 2. Delete users from app_users (cascades to profiles, memberships, etc.)
    const { error: deleteError } = await adminClient
      .from('app_users')
      .delete()
      .in('id', targetIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'deleted', count: targetIds.length });
  }

  const newStatus = action === 'suspend' ? 'suspended' : 'active';
  const { error } = await adminClient
    .from('app_users')
    .update({ status: newStatus })
    .in('id', targetIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: memberships } = await adminClient
    .from('memberships')
    .select('org_id, user_id')
    .in('user_id', targetIds);

  if (memberships && memberships.length > 0) {
    const auditLogs = memberships.map((m: any) => ({
      org_id: m.org_id,
      user_id: adminId,
      action: action === 'suspend' ? 'user_suspended' : 'user_activated',
      entity_type: 'profile',
      entity_id: m.user_id,
      meta: { target_user_id: m.user_id, bulk: true },
    }));
    await adminClient.from('audit_logs').insert(auditLogs);
  }

  return NextResponse.json({ success: true, status: newStatus, count: targetIds.length });
}
