import type { ActivationDurationMode } from './orgs-tab-utils';

export type Org = {
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
  linked_accounts: {
    membership_id: string;
    role: string | null;
    user_id: string;
    email: string | null;
    full_name: string | null;
    status: string | null;
    email_verified: boolean | null;
    is_app_admin: boolean;
  }[];
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

export type OrgAction = 'suspend' | 'activate' | 'delete' | 'grant_lifetime' | 'extend_trial' | 'activate_subscription';

export type ConfirmActionState = {
  org: Org;
  action: Extract<OrgAction, 'suspend' | 'activate' | 'delete' | 'grant_lifetime'>;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

export type ActivationDialogState = {
  org: Org;
  plan: string;
  durationMode: ActivationDurationMode;
  durationValue: string;
};

export type TrialDialogState = {
  org: Org;
  days: string;
};
