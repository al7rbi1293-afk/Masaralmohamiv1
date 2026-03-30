export type SubRequest = {
  id: string;
  request_kind: 'subscription_request' | 'payment_request';
  org_id: string;
  plan_requested: string;
  duration_months: number;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  notes: string | null;
  requested_at: string;
  organizations: { name: string } | null;
  requester_name: string | null;
};

export type FullVersionRequest = {
  id: string;
  created_at: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  firm_name: string | null;
  message: string | null;
  source: string;
  type: string | null;
};

export type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  firm_name: string | null;
  topic: string | null;
  message: string | null;
  referrer: string | null;
};

export type RequestsPayload = {
  requests?: SubRequest[];
  fullVersionRequests?: FullVersionRequest[];
  leads?: Lead[];
};

export type RequestsTabId = 'subscription' | 'activation' | 'leads';
export type RequestDeleteKind = SubRequest['request_kind'] | 'full_version_request' | 'lead';
