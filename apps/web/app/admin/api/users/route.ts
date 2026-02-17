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

  const { data: authUsersResult, error: authUsersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authUsersError) {
    return NextResponse.json({ error: authUsersError.message }, { status: 500 });
  }

  const authUsers = (authUsersResult?.users ?? []).map((user) => ({
    id: String(user.id),
    email: user.email ? String(user.email) : null,
    created_at: String(user.created_at ?? ''),
    email_confirmed_at: (user as any).email_confirmed_at ? String((user as any).email_confirmed_at) : null,
    confirmed_at: user.confirmed_at ? String(user.confirmed_at) : null,
  }));

  const pending = authUsers
    .filter((row) => !isUserConfirmed(row))
    .map((row) => {
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
      confirmed_at: row.confirmed_at ? String(row.confirmed_at) : null,
      older_than_3h: ageHours >= 3,
    };
    });

  const activatedUserIds = authUsers
    .filter((row) => isUserConfirmed(row))
    .map((row) => row.id);

  let profilesByUserId = new Map<string, {
    full_name: string;
    phone: string | null;
    status: string;
    created_at: string;
  }>();

  let membershipsByUserId = new Map<string, Array<{
    org_id: string;
    role: string;
    organizations: { name: string; status: string } | null;
  }>>();

  if (activatedUserIds.length) {
    const [{ data: profilesRaw, error: profilesError }, { data: membershipsRaw, error: membershipsError }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('user_id, full_name, phone, status, created_at')
        .in('user_id', activatedUserIds),
      adminClient
        .from('memberships')
        .select('user_id, org_id, role, organizations:org_id(name, status)')
        .in('user_id', activatedUserIds),
    ]);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (membershipsError) {
      return NextResponse.json({ error: membershipsError.message }, { status: 500 });
    }

    for (const profile of (profilesRaw as Array<{
      user_id: string;
      full_name: string | null;
      phone: string | null;
      status: string | null;
      created_at: string;
    }> | null) ?? []) {
      profilesByUserId.set(profile.user_id, {
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? null,
        status: profile.status ?? 'active',
        created_at: profile.created_at,
      });
    }

    for (const membership of (membershipsRaw as Array<{
      user_id: string;
      org_id: string;
      role: string;
      organizations: { name: string; status: string } | Array<{ name: string; status: string }> | null;
    }> | null) ?? []) {
      const list = membershipsByUserId.get(membership.user_id) ?? [];
      const org = Array.isArray(membership.organizations)
        ? membership.organizations[0] ?? null
        : membership.organizations ?? null;
      list.push({
        org_id: membership.org_id,
        role: membership.role,
        organizations: org,
      });
      membershipsByUserId.set(membership.user_id, list);
    }
  }

  const users = authUsers
    .filter((row) => isUserConfirmed(row))
    .map((row) => {
      const profile = profilesByUserId.get(row.id);
      return {
        user_id: row.id,
        email: row.email,
        full_name: profile?.full_name ?? '',
        phone: profile?.phone ?? null,
        status: profile?.status ?? 'active',
        created_at: profile?.created_at ?? row.created_at,
        memberships: membershipsByUserId.get(row.id) ?? [],
      };
    });

  return NextResponse.json({ users, pending });
}

function isUserConfirmed(user: { email_confirmed_at: string | null; confirmed_at: string | null }) {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
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
    const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(user_id);

    if (authUserError) {
      return NextResponse.json({ error: authUserError.message }, { status: 500 });
    }

    const authUser = authUserResult?.user ?? null;
    if (!authUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود.' }, { status: 404 });
    }

    if (isUserConfirmed({
      email_confirmed_at: (authUser as any).email_confirmed_at ? String((authUser as any).email_confirmed_at) : null,
      confirmed_at: authUser.confirmed_at ? String(authUser.confirmed_at) : null,
    })) {
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
    .upsert(
      {
        user_id,
        status: newStatus,
      },
      { onConflict: 'user_id' },
    );

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
