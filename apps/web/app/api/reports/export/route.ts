import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

/**
 * GET /api/reports/export?type=clients|matters|tasks
 * Returns CSV export of the requested data type.
 */
export async function GET(request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !['clients', 'matters', 'tasks'].includes(type)) {
        return NextResponse.json({ message: 'نوع التصدير غير صالح.' }, { status: 400 });
    }

    const supabase = createSupabaseServerRlsClient();

    let csvContent = '';

    if (type === 'clients') {
        const { data } = await supabase
            .from('clients')
            .select('id, name, email, phone, identity_no, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5000);

        csvContent = 'المعرف,الاسم,البريد,الهاتف,رقم الهوية,تاريخ الإنشاء\n';
        for (const row of data ?? []) {
            csvContent += `${row.id},${esc(row.name)},${esc(row.email)},${esc(row.phone)},${esc(row.identity_no)},${row.created_at}\n`;
        }
    } else if (type === 'matters') {
        const { data } = await supabase
            .from('matters')
            .select('id, title, status, matter_type, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5000);

        csvContent = 'المعرف,العنوان,الحالة,النوع,تاريخ الإنشاء\n';
        for (const row of data ?? []) {
            csvContent += `${row.id},${esc(row.title)},${esc(row.status)},${esc(row.matter_type)},${row.created_at}\n`;
        }
    } else if (type === 'tasks') {
        const { data } = await supabase
            .from('tasks')
            .select('id, title, status, priority, due_at, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5000);

        csvContent = 'المعرف,العنوان,الحالة,الأولوية,تاريخ الاستحقاق,تاريخ الإنشاء\n';
        for (const row of data ?? []) {
            csvContent += `${row.id},${esc(row.title)},${esc(row.status)},${esc(row.priority)},${row.due_at},${row.created_at}\n`;
        }
    }

    // Add BOM for Excel Arabic support
    const bom = '\uFEFF';
    return new NextResponse(bom + csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${type}-export.csv"`,
        },
    });
}

function esc(value: string | null | undefined): string {
    if (!value) return '';
    // Escape commas and quotes for CSV
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
