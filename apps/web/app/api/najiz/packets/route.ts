import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

const createPacketSchema = z.object({
    matter_id: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    notes: z.string().max(2000).optional(),
    items: z.array(z.object({
        item_type: z.enum(['document', 'field', 'note']),
        label: z.string().min(1).max(200),
        value: z.string().max(2000).optional(),
        document_id: z.string().uuid().optional(),
    })).default([]),
});

const updatePacketSchema = z.object({
    status: z.enum(['preparing', 'review', 'ready', 'submitted_manual']).optional(),
    notes: z.string().max(2000).optional(),
    submitted_at: z.string().datetime().optional(),
});

// GET — list packets for org
export async function GET(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const matterId = searchParams.get('matter_id');

    const supabase = createSupabaseServerRlsClient();
    let query = supabase
        .from('najiz_packets')
        .select('*, najiz_packet_items(*)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (matterId) query = query.eq('matter_id', matterId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: 'فشل تحميل الحزم.' }, { status: 500 });

    return NextResponse.json({ packets: data });
}

// POST — create packet + items
export async function POST(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
        return NextResponse.json({ message: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const parsed = createPacketSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'خطأ.' }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    const { data: packet, error } = await supabase
        .from('najiz_packets')
        .insert({
            org_id: orgId,
            matter_id: parsed.data.matter_id ?? null,
            title: parsed.data.title,
            notes: parsed.data.notes ?? null,
            created_by: user.id,
        })
        .select('id')
        .single();

    if (error || !packet) return NextResponse.json({ message: 'فشل إنشاء الحزمة.' }, { status: 500 });

    // Insert items
    if (parsed.data.items.length > 0) {
        const items = parsed.data.items.map((item) => ({
            org_id: orgId,
            packet_id: packet.id,
            item_type: item.item_type,
            label: item.label,
            value: item.value ?? null,
            document_id: item.document_id ?? null,
        }));

        await supabase.from('najiz_packet_items').insert(items);
    }

    return NextResponse.json({ success: true, packet_id: packet.id });
}

// PATCH — update packet status
export async function PATCH(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
        return NextResponse.json({ message: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const packetId = searchParams.get('id');
    if (!packetId) return NextResponse.json({ message: 'معرّف الحزمة مطلوب.' }, { status: 400 });

    const parsed = updatePacketSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'خطأ.' }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status) updateData.status = parsed.data.status;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.status === 'submitted_manual') {
        updateData.submitted_at = parsed.data.submitted_at || new Date().toISOString();
    }

    const { error } = await supabase
        .from('najiz_packets')
        .update(updateData)
        .eq('id', packetId)
        .eq('org_id', orgId);

    if (error) return NextResponse.json({ message: 'فشل تحديث الحزمة.' }, { status: 500 });

    return NextResponse.json({ success: true });
}
