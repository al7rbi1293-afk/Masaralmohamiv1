-- Align documents-related user references with custom users table (app_users)
-- to prevent FK violations when saving document versions and creating share links.

-- Remove orphan rows that cannot be linked to app_users before swapping FKs.
delete from public.document_versions dv
where not exists (
  select 1
  from public.app_users u
  where u.id = dv.uploaded_by
);

delete from public.document_shares ds
where not exists (
  select 1
  from public.app_users u
  where u.id = ds.created_by
);

alter table public.document_versions
drop constraint if exists document_versions_uploaded_by_fkey;

alter table public.document_versions
add constraint document_versions_uploaded_by_fkey
foreign key (uploaded_by)
references public.app_users(id)
on delete restrict;

alter table public.document_shares
drop constraint if exists document_shares_created_by_fkey;

alter table public.document_shares
add constraint document_shares_created_by_fkey
foreign key (created_by)
references public.app_users(id)
on delete restrict;
