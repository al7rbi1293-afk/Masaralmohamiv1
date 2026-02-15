import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { z } from 'zod';

const RequestSchema = z.object({
    plan_requested: z.enum(['SOLO', 'TEAM', 'BUSINESS', 'ENTERPRISE']),
    duration_months: z.number().int().min(1).max(36),
    payment_method: z.string().optional(),
    payment_reference: z.string().optional(),
    proof_file_path: z.string().optional(),
});

/**
 * POST /api/subscription/request — org member submits a subscription request
 */
export async function POST(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try {
        orgId = await requireOrgIdForUser();
    } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: 'بيانات غير صالحة.', errors: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    const { data, error } = await supabase
        .from('subscription_requests')
        .insert({
            org_id: orgId,
            requester_user_id: user.id,
            plan_requested: parsed.data.plan_requested,
            duration_months: parsed.data.duration_months,
            payment_method: parsed.data.payment_method || null,
            payment_reference: parsed.data.payment_reference || null,
            proof_file_path: parsed.data.proof_file_path || null,
        })
        .select('id')
        .single();

    if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}
