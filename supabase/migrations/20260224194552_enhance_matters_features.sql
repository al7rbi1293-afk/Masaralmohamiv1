-- Allow matters without a client
alter table public.matters
alter column client_id drop not null;
-- Add new fields for Case Type and Claims
alter table public.matters
add column if not exists case_type text null,
    add column if not exists claims text null;
-- Update the insert policy to allow null client_id
drop policy if exists matters_insert_member on public.matters;
create policy matters_insert_member on public.matters for
insert to authenticated with check (
        public.is_org_member(org_id)
        and (
            client_id is null
            or exists (
                select 1
                from public.clients c
                where c.id = client_id
                    and c.org_id = org_id
            )
        )
    );
-- Update the update policy to allow null client_id
drop policy if exists matters_update_owner_or_assignee on public.matters;
create policy matters_update_owner_or_assignee on public.matters for
update to authenticated using (
        public.is_org_owner(org_id)
        or assigned_user_id = auth.uid()
    ) with check (
        public.is_org_member(org_id)
        and (
            client_id is null
            or exists (
                select 1
                from public.clients c
                where c.id = client_id
                    and c.org_id = org_id
            )
        )
    );