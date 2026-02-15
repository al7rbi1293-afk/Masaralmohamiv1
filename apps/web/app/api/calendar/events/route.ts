import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

const createEventSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
    all_day: z.boolean().default(false),
    matter_id: z.string().uuid().optional(),
});

// GET — list events for org (optionally filtered by month)
export async function GET(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = createSupabaseServerRlsClient();
    let query = supabase
        .from('calendar_events')
        .select('*, matters(title)')
        .eq('org_id', orgId)
        .order('start_at', { ascending: true })
        .limit(500);

    if (from) query = query.gte('start_at', from);
    if (to) query = query.lt('start_at', to);

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: 'فشل تحميل الأحداث.' }, { status: 500 });

    return NextResponse.json({ events: data });
}

// POST — create event + schedule reminders
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

    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'خطأ.' }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    const { data: event, error } = await supabase
        .from('calendar_events')
        .insert({
            org_id: orgId,
            title: parsed.data.title,
            description: parsed.data.description ?? null,
            location: parsed.data.location ?? null,
            start_at: parsed.data.start_at,
            end_at: parsed.data.end_at,
            all_day: parsed.data.all_day,
            matter_id: parsed.data.matter_id ?? null,
            created_by: user.id,
        })
        .select('id, title, start_at, end_at')
        .single();

    if (error) return NextResponse.json({ message: 'فشل إنشاء الحدث.' }, { status: 500 });

    // Schedule reminder jobs (24h and 2h before)
    const startAt = new Date(parsed.data.start_at);
    const reminders = [
        { offsetMs: 24 * 60 * 60 * 1000, label: '24h' },
        { offsetMs: 2 * 60 * 60 * 1000, label: '2h' },
    ];

    const jobInserts = reminders
        .map((r) => {
            const runAt = new Date(startAt.getTime() - r.offsetMs);
            if (runAt <= new Date()) return null; // skip past reminders
            return {
                org_id: orgId,
                type: 'event_reminder',
                payload: {
                    event_id: event.id,
                    event_title: event.title,
                    start_at: event.start_at,
                    reminder_label: r.label,
                    user_id: user.id,
                },
                run_at: runAt.toISOString(),
                status: 'queued' as const,
            };
        })
        .filter(Boolean);

    if (jobInserts.length > 0) {
        await supabase.from('notification_jobs').insert(jobInserts);
    }

    return NextResponse.json({ success: true, event });
}
