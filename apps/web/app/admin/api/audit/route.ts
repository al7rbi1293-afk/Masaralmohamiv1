import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /admin/api/audit — list all audit logs (admin only)
 */
export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const adminClient = createSupabaseServerClient();

    const { data, error } = await adminClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data ?? [] });
}
