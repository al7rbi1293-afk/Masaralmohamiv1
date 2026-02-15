import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /admin/api/users — list all users with org/status
 * PATCH /admin/api/users — suspend/activate a user
 */
export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const adminClient = createSupabaseServerClient();

    const { data, error } = await adminClient
        .from('profiles')
        .select(`
      user_id, full_name, phone, status, created_at,
      memberships ( org_id, role, organizations:org_id ( name, status ) )
    `)
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(request: NextRequest) {
    let adminId: string;
    try {
        adminId = await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, action } = body as { user_id: string; action: 'suspend' | 'activate' };

    if (!user_id || !['suspend', 'activate'].includes(action)) {
        return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const adminClient = createSupabaseServerClient();
    const newStatus = action === 'suspend' ? 'suspended' : 'active';

    const { error } = await adminClient
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', user_id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get org_id for audit log
    const { data: membership } = await adminClient
        .from('memberships')
        .select('org_id')
        .eq('user_id', user_id)
        .limit(1)
        .maybeSingle();

    await adminClient.from('audit_logs').insert({
        org_id: (membership as any)?.org_id || null,
        user_id: adminId,
        action: action === 'suspend' ? 'user_suspended' : 'user_activated',
        entity_type: 'profile',
        entity_id: user_id,
        meta: { target_user_id: user_id },
    });

    return NextResponse.json({ success: true, status: newStatus });
}
