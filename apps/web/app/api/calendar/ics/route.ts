import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/calendar/ics?token=...
 * Returns a valid ICS feed for the org identified by the token.
 * Public endpoint — uses token-based auth instead of session auth.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || token.length < 16) {
        return new NextResponse('Invalid token', { status: 401 });
    }

    const adminClient = createSupabaseServerClient();

    // Look up org by ICS token
    const { data: icsToken, error: tokenError } = await adminClient
        .from('org_ics_tokens')
        .select('org_id')
        .eq('token', token)
        .single();

    if (tokenError || !icsToken) {
        return new NextResponse('Token not found', { status: 404 });
    }

    const orgId = icsToken.org_id;

    // Fetch events for next 90 days
    const now = new Date();
    const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const { data: events } = await adminClient
        .from('calendar_events')
        .select('id, title, description, location, start_at, end_at, all_day')
        .eq('org_id', orgId)
        .gte('start_at', now.toISOString())
        .lt('start_at', end.toISOString())
        .order('start_at', { ascending: true })
        .limit(500);

    // Build ICS
    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Masar Al-Muhami//Calendar//AR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:مسار المحامي',
    ];

    for (const event of events ?? []) {
        const uid = `${event.id}@masar`;
        const dtStart = formatIcsDate(event.start_at, event.all_day);
        const dtEnd = formatIcsDate(event.end_at, event.all_day);

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`SUMMARY:${escapeIcs(event.title)}`);
        if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
        if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);

        if (event.all_day) {
            lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
            lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
        } else {
            lines.push(`DTSTART:${dtStart}`);
            lines.push(`DTEND:${dtEnd}`);
        }

        lines.push(`DTSTAMP:${formatIcsDate(new Date().toISOString(), false)}`);
        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');

    return new NextResponse(icsContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="masar-calendar.ics"',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}

function formatIcsDate(dateStr: string, allDay: boolean): string {
    const d = new Date(dateStr);
    if (allDay) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}
