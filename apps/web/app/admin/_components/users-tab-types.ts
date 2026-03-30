export type User = {
  user_id: string;
  email?: string | null;
  full_name: string;
  phone: string | null;
  status: string;
  created_at: string;
  memberships: Array<{
    org_id: string;
    role: string;
    organizations: {
      name: string;
      status: string;
      subscription: {
        plan: string | null;
        status: string;
        current_period_end: string | null;
      } | null;
      trial: {
        ends_at: string | null;
        status: string;
      } | null;
    } | null;
  }>;
};

export type PendingUser = {
  user_id: string;
  email: string | null;
  created_at: string;
  older_than_3h: boolean;
};
