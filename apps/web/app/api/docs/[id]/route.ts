import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } },
) {
    const user = await getCurrentAuthUser();
    if (!user) {
        return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });
    }

    let orgId: string;
    try {
        orgId = await requireOrgIdForUser();
    } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const supabase = createSupabaseServerRlsClient();

    const { data, error } = await supabase
        .from('doc_generations')
        .select('*')
        .eq('id', params.id)
        .eq('org_id', orgId)
        .single();

    if (error || !data) {
        return NextResponse.json({ message: 'المستند غير موجود.' }, { status: 404 });
    }

    return NextResponse.json({ generation: data });
}
