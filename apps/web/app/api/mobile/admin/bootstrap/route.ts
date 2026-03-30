import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAppContext } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAppContext(request, 'admin.overview.read');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = auth.context.db;

  const [orgsRes, usersRes, partnersRes, requestsRes] = await Promise.all([
    db.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('app_users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('partners').select('*', { count: 'exact', head: true }),
    db.from('subscription_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return NextResponse.json({
    user: auth.context.user,
    role: {
      is_admin: auth.context.isAdmin,
      has_office_access: auth.context.hasOfficeAccess,
      has_partner_access: auth.context.hasPartnerAccess,
      default_path: auth.context.defaultPath,
    },
    stats: {
      active_orgs: orgsRes.error ? 0 : orgsRes.count || 0,
      active_users: usersRes.error ? 0 : usersRes.count || 0,
      partners: partnersRes.error ? 0 : partnersRes.count || 0,
      pending_requests: requestsRes.error ? 0 : requestsRes.count || 0,
    },
    links: [
      { label: 'لوحة الإدارة', path: '/admin' },
      { label: 'طلبات الاشتراك', path: '/admin/requests' },
      { label: 'المستخدمون', path: '/admin/users' },
      { label: 'المكاتب', path: '/admin/orgs' },
      { label: 'سجل التدقيق', path: '/admin/audit' },
    ],
  });
}
