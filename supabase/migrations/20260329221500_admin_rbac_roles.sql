-- ============================================================
-- 20260329221500: Admin RBAC roles + permissions
-- ============================================================

alter table public.app_admins
  add column if not exists role text,
  add column if not exists permissions text[] not null default '{}';

update public.app_admins
set role = 'super_admin'
where role is null;

alter table public.app_admins
  alter column role set default 'super_admin',
  alter column role set not null;

alter table public.app_admins
  drop constraint if exists app_admins_role_check;

alter table public.app_admins
  add constraint app_admins_role_check
  check (role in ('super_admin', 'operations', 'support', 'finance', 'readonly'));

comment on column public.app_admins.role is 'Admin RBAC role. Defaults to super_admin for legacy admins.';
comment on column public.app_admins.permissions is 'Optional additional permissions to extend role defaults.';
