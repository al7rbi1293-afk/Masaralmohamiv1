import { buildApiUrl } from '../../lib/api';

export type AdminRequestItem = {
  id: string;
  request_kind: 'subscription_request' | 'payment_request';
  org_id: string;
  plan_requested: string;
  duration_months: number;
  payment_method: string | null;
  payment_reference: string | null;
  proof_file_path: string | null;
  status: string;
  notes: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  organizations: { id: string; name: string } | null;
  requester_name: string | null;
  amount: number | null;
  currency: string | null;
};

export type AdminActivationRequest = {
  id: string;
  created_at: string;
  org_id: string | null;
  user_id: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  firm_name: string | null;
  message: string | null;
  source: string;
  type: string | null;
};

export type AdminLead = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  firm_name: string | null;
  topic: string | null;
  message: string | null;
  referrer: string | null;
  utm: unknown;
};

export type AdminRequestsPayload = {
  requests: AdminRequestItem[];
  fullVersionRequests: AdminActivationRequest[];
  leads: AdminLead[];
};

export type AdminUser = {
  user_id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  status: string;
  created_at: string;
  memberships: Array<{
    org_id: string;
    role: string;
    organizations: { name: string; status: string } | null;
  }>;
};

export type AdminPendingUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  older_than_3h: boolean;
};

export type AdminUsersPayload = {
  users: AdminUser[];
  pending: AdminPendingUser[];
  total_count: number;
  page: number;
  limit: number;
};

export type AdminOrg = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  members_count: number;
  subscription: {
    plan: string | null;
    status: string;
    payment_status: string;
    current_period_end: string | null;
  } | null;
  trial: {
    ends_at: string | null;
    status: string;
  } | null;
  linked_accounts: Array<{
    membership_id: string;
    role: string | null;
    user_id: string;
    email: string | null;
    full_name: string | null;
    status: string | null;
    email_verified: boolean | null;
    is_app_admin: boolean;
  }>;
  primary_account: {
    membership_id: string;
    role: string | null;
    user_id: string;
    email: string | null;
    full_name: string | null;
    status: string | null;
    email_verified: boolean | null;
    is_app_admin: boolean;
  } | null;
  has_admin_account: boolean;
};

export type AdminOrgsPayload = {
  orgs: AdminOrg[];
  total_count: number;
  page: number;
  limit: number;
};

export type AdminAuditLog = {
  id: string;
  created_at: string | null;
  org_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
};

type ApiMessage = {
  error?: string;
  success?: boolean;
  count?: number;
  status?: string;
  ends_at?: string;
  request_kind?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text().catch(() => '');
  let payload = {} as T & { error?: string };

  if (contentType.includes('application/json') && raw) {
    try {
      payload = JSON.parse(raw) as T & { error?: string };
    } catch {
      payload = {} as T & { error?: string };
    }
  }

  if (!response.ok) {
    if ((payload as { error?: string }).error) {
      throw new Error((payload as { error?: string }).error as string);
    }

    if (raw.includes('<!DOCTYPE html>') || raw.includes('<html')) {
      throw new Error('الخدمة المطلوبة غير متاحة على هذا الرابط حالياً. حدّث بيئة التطبيق ثم أعد المحاولة.');
    }

    throw new Error(`تعذر إكمال الطلب. (${response.status})`);
  }

  return payload;
}

async function requestJson<T>(path: string, token: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  return parseJson<T>(response);
}

export async function fetchAdminRequests(token: string) {
  return requestJson<AdminRequestsPayload>('/api/mobile/admin/requests', token);
}

export async function reviewAdminRequest(
  token: string,
  payload: {
    id: string;
    action: 'approve' | 'reject';
    request_kind: 'subscription_request' | 'payment_request';
    notes?: string;
  },
) {
  return requestJson<ApiMessage>('/api/mobile/admin/requests', token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminUsers(token: string, query = '', page = 1, limit = 50) {
  const search = new URLSearchParams();
  if (query.trim()) {
    search.set('query', query.trim());
  }
  search.set('page', String(page));
  search.set('limit', String(limit));
  return requestJson<AdminUsersPayload>(`/api/mobile/admin/users?${search.toString()}`, token);
}

export async function updateAdminUsers(
  token: string,
  payload: {
    action: 'suspend' | 'activate' | 'delete_pending' | 'delete';
    user_id?: string;
    user_ids?: string[];
  },
) {
  return requestJson<ApiMessage>('/api/mobile/admin/users', token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOrgs(token: string, query = '', page = 1, limit = 50) {
  const search = new URLSearchParams();
  if (query.trim()) {
    search.set('query', query.trim());
  }
  search.set('page', String(page));
  search.set('limit', String(limit));
  return requestJson<AdminOrgsPayload>(`/api/mobile/admin/orgs?${search.toString()}`, token);
}

export async function updateAdminOrg(
  token: string,
  payload: {
    org_id: string;
    action:
      | 'suspend'
      | 'activate'
      | 'delete'
      | 'extend_trial'
      | 'activate_subscription'
      | 'grant_lifetime'
      | 'activate_paid'
      | 'set_plan';
    extra_data?: Record<string, unknown>;
  },
) {
  return requestJson<ApiMessage>('/api/mobile/admin/orgs', token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminAudit(token: string) {
  return requestJson<{ logs: AdminAuditLog[] }>('/api/mobile/admin/audit', token);
}
