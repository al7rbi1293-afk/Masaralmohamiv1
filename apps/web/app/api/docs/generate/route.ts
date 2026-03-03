import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

const generateSchema = z.object({
    preset_code: z.string().min(1),
    title: z.string().min(1).max(200),
    matter_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    variables: z.record(z.string(), z.string()).default({}),
    format: z.enum(['pdf', 'docx']),
});

export async function POST(request: NextRequest) {
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

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ message: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? 'بيانات غير صالحة.';
        return NextResponse.json({ message: msg }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    const { data, error } = await supabase
        .from('doc_generations')
        .insert({
            org_id: orgId,
            preset_code: parsed.data.preset_code,
            title: parsed.data.title,
            matter_id: parsed.data.matter_id ?? null,
            client_id: parsed.data.client_id ?? null,
            variables: parsed.data.variables,
            format: parsed.data.format,
            status: 'draft',
            created_by: user.id,
        })
        .select('id, title, status, format, created_at')
        .single();

    if (error) {
        return NextResponse.json({ message: 'فشل إنشاء المسودة.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, generation: data });
}
