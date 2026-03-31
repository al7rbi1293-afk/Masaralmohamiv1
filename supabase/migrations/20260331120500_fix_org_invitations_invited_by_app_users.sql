alter table public.org_invitations
drop constraint if exists org_invitations_invited_by_fkey;

alter table public.org_invitations
add constraint org_invitations_invited_by_fkey
foreign key (invited_by)
references public.app_users(id);
