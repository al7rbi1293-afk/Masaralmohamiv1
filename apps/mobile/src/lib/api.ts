import { loadSession } from './session';

export type OfficeSessionResponse = {
  ok?: true;
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  role: {
    name: string | null;
    is_admin: boolean;
    has_office_access: boolean;
    has_partner_access: boolean;
    partner_only: boolean;
    default_path: string;
  };
  org: {
    id: string;
    name: string | null;
    logo_url?: string | null;
  } | null;
  partner: {
    id: string;
    partner_code: string | null;
  } | null;
};

export type OfficeRolePortal = 'office' | 'partner' | 'admin';

export type OfficeSessionResolved = {
  kind: 'office';
  portal: OfficeRolePortal | 'admin';
  role: string | null;
  email: string;
  user: {
    id: string;
    full_name: string | null;
  };
};

export type ClientSessionResponse = {
  ok: true;
  token: string;
  session: {
    kind: 'client';
    portal: 'client';
    email: string;
    client_id: string;
    org_id: string;
  };
};

export type OfficeOtpRequestResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export type AuthMessageResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  redirectTo?: string;
  requestId?: string;
};

export type OfficeBootstrap = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  org: {
    id: string;
    name: string | null;
  } | null;
  role: {
    name: string | null;
    is_admin: boolean;
    has_partner_access: boolean;
  };
  counts: {
    clients: number;
    open_matters: number;
    open_tasks: number;
    unpaid_invoices: number;
  };
};

export type MatterSummary = {
  id: string;
  org_id: string;
  client_id: string | null;
  title: string;
  status: string;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
  case_type: string | null;
  claims: string | null;
  is_private: boolean;
  najiz_case_number?: string | null;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

export type MatterDetails = MatterSummary & {
  assigned_user: {
    id: string;
    full_name: string;
    email: string | null;
  } | null;
  events: Array<{
    id: string;
    type: string;
    note: string | null;
    event_date: string | null;
    created_at: string | null;
    created_by_name: string | null;
  }>;
  communications: Array<{
    id: string;
    sender: string;
    message: string;
    created_at: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string | null;
    due_at: string | null;
    updated_at?: string | null;
  }>;
  documents: Array<{
    id: string;
    title: string;
    created_at: string | null;
    latest_version: {
      version_no: number;
      file_name: string;
      file_size: number;
      mime_type: string | null;
      created_at: string | null;
      storage_path: string | null;
    } | null;
  }>;
};

export type ClientBootstrap = {
  session: {
    portal_user_id: string;
    email: string;
  };
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    identity_no: string | null;
    commercial_no: string | null;
  };
  counts: {
    matters: number;
    invoices: number;
    quotes: number;
    documents: number;
    outstanding_balance: number;
  };
  matters: Array<{
    id: string;
    title: string;
    status: string;
    summary: string | null;
    case_type?: string | null;
    updated_at: string;
    events: Array<{
      id: string;
      type: string;
      note: string | null;
      created_at: string | null;
    }>;
    communications: Array<{
      id: string;
      sender: string;
      message: string;
      created_at: string | null;
    }>;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    remaining_amount: number;
    currency: string | null;
    due_at: string | null;
  }>;
  documents: Array<{
    id: string;
    title: string;
    matter_title: string | null;
    created_at: string;
    latest_version: {
      version_no: number;
      storage_path: string;
      file_name: string;
      file_size: number;
      mime_type: string | null;
      created_at: string | null;
    } | null;
  }>;
};

export type PartnerBootstrap = {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  partner: {
    id: string;
    partner_code: string;
    referral_link: string;
  };
  kpis: {
    clicks: number;
    leads: number;
    subscribed_leads: number;
    total_commission: number;
    commission_currency: string;
  };
  payouts: Array<{
    id: string;
    total_amount: number;
    status: string;
    reference_number: string | null;
    created_at: string | null;
  }>;
};

export type AdminBootstrap = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  role: {
    is_admin: boolean;
    has_office_access: boolean;
    has_partner_access: boolean;
    default_path: string;
  };
  stats: {
    active_orgs: number;
    active_users: number;
    partners: number;
    pending_requests: number;
  };
  links: Array<{
    label: string;
    path: string;
  }>;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

async function resolveOfficeOrgId(token: string) {
  const session = await loadSession().catch(() => null);
  if (!session || session.kind !== 'office' || session.token !== token) {
    return null;
  }

  return session.orgId ?? null;
}

function buildUrl(path: string) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildApiUrl(path: string) {
  return buildUrl(path);
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || 'تعذر إكمال الطلب.');
  }
  return payload;
}

export async function postJson<T>(path: string, body: unknown, token?: string) {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return parseJson<T>(response);
}

export async function getJson<T>(path: string, token: string) {
  const orgId = await resolveOfficeOrgId(token);
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(orgId ? { 'x-org-id': orgId } : {}),
    },
  });

  return parseJson<T>(response);
}

export async function signInOffice(email: string, password: string) {
  return postJson<OfficeSessionResponse>('/api/mobile/auth/signin', {
    email,
    password,
  });
}

export async function requestOfficeOtpAfterPassword(email: string, password: string) {
  return postJson<OfficeOtpRequestResponse>('/api/mobile/auth/password-challenge', {
    email,
    password,
  });
}

export async function requestOfficeOtp(email: string) {
  return postJson<OfficeOtpRequestResponse>('/api/mobile/auth/request-otp', {
    email,
  });
}

export async function verifyOfficeOtp(email: string, code: string) {
  return postJson<OfficeSessionResponse>('/api/mobile/auth/verify-otp', {
    email,
    code,
  });
}

export async function resendOfficeActivation(email: string) {
  return postJson<AuthMessageResponse>('/api/mobile/auth/resend-activation', {
    email,
  });
}

export async function startTrialRegistration(params: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  firmName?: string;
}) {
  return postJson<AuthMessageResponse>('/api/start-trial', {
    full_name: params.fullName,
    email: params.email,
    password: params.password,
    phone: params.phone,
    firm_name: params.firmName || '',
  });
}

export async function requestClientOtp(email: string) {
  return postJson<{ ok?: boolean; message?: string; error?: string }>(
    '/api/client-portal/auth/request-otp',
    { email },
  );
}

export async function verifyClientOtp(email: string, code: string) {
  return postJson<ClientSessionResponse>('/api/mobile/client-portal/verify-otp', {
    email,
    code,
  });
}

export async function fetchOfficeBootstrap(token: string) {
  return getJson<OfficeBootstrap>('/api/mobile/office/bootstrap', token);
}

export async function fetchOfficeMatters(token: string) {
  return getJson<{ data: MatterSummary[]; page: number; limit: number; total: number }>('/api/mobile/office/matters', token);
}

export async function fetchOfficeMatterDetails(token: string, matterId: string) {
  return getJson<{ data: MatterDetails }>(`/api/mobile/office/matters/${matterId}`, token);
}

export async function fetchClientBootstrap(token: string) {
  return getJson<ClientBootstrap>('/api/mobile/client-portal/bootstrap', token);
}

export async function fetchPartnerBootstrap(token: string) {
  return getJson<PartnerBootstrap>('/api/mobile/partner/bootstrap', token);
}

export async function fetchAdminBootstrap(token: string) {
  return getJson<AdminBootstrap>('/api/mobile/admin/bootstrap', token);
}

export function buildMobileAuthBridgeUrl(token: string, nextPath = '/admin') {
  return buildUrl(
    `/api/mobile/auth/bridge?access_token=${encodeURIComponent(token)}&next=${encodeURIComponent(nextPath)}`,
  );
}
