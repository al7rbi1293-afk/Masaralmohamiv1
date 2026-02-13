create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid null references public.matters(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  title text not null,
  description text null,
  folder text not null default '/',
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version_no int not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text null,
  checksum text null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_org on public.documents (org_id);
create index if not exists idx_documents_org_matter on public.documents (org_id, matter_id);
create index if not exists idx_doc_versions_org_doc on public.document_versions (org_id, document_id);
create index if not exists idx_doc_shares_org_doc on public.document_shares (org_id, document_id);

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_versions to authenticated;
grant select, insert, delete on public.document_shares to authenticated;

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_shares enable row level security;

-- documents
drop policy if exists documents_select_visible on public.documents;
drop policy if exists documents_insert_visible on public.documents;
drop policy if exists documents_update_visible on public.documents;
drop policy if exists documents_delete_owner on public.documents;

create policy documents_select_visible
on public.documents
for select
to authenticated
using (
  (
    matter_id is null
    and public.is_org_member(org_id)
  )
  or (
    matter_id is not null
    and exists (
      select 1
      from public.matters mt
      where mt.id = documents.matter_id
        and mt.org_id = documents.org_id
        and (
          (mt.is_private = false and public.is_org_member(mt.org_id))
          or (
            mt.is_private = true
            and (
              public.is_org_owner(mt.org_id)
              or public.is_matter_member(mt.id)
            )
          )
        )
    )
  )
);

create policy documents_insert_visible
on public.documents
for insert
to authenticated
with check (
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
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = documents.matter_id
        and mt.org_id = documents.org_id
        and (
          (mt.is_private = false and public.is_org_member(mt.org_id))
          or (
            mt.is_private = true
            and (
              public.is_org_owner(mt.org_id)
              or public.is_matter_member(mt.id)
            )
          )
        )
    )
  )
);

create policy documents_update_visible
on public.documents
for update
to authenticated
using (
  (
    matter_id is null
    and public.is_org_member(org_id)
  )
  or (
    matter_id is not null
    and exists (
      select 1
      from public.matters mt
      where mt.id = documents.matter_id
        and mt.org_id = documents.org_id
        and (
          (mt.is_private = false and public.is_org_member(mt.org_id))
          or (
            mt.is_private = true
            and (
              public.is_org_owner(mt.org_id)
              or public.is_matter_member(mt.id)
            )
          )
        )
    )
  )
)
with check (
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
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = documents.matter_id
        and mt.org_id = documents.org_id
        and (
          (mt.is_private = false and public.is_org_member(mt.org_id))
          or (
            mt.is_private = true
            and (
              public.is_org_owner(mt.org_id)
              or public.is_matter_member(mt.id)
            )
          )
        )
    )
  )
);

create policy documents_delete_owner
on public.documents
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- document_versions
drop policy if exists doc_versions_select_visible on public.document_versions;
drop policy if exists doc_versions_insert_visible on public.document_versions;
drop policy if exists doc_versions_update_owner_or_uploader on public.document_versions;
drop policy if exists doc_versions_delete_owner_or_uploader on public.document_versions;

create policy doc_versions_select_visible
on public.document_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_versions.document_id
      and d.org_id = document_versions.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);

create policy doc_versions_insert_visible
on public.document_versions
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_versions.document_id
      and d.org_id = document_versions.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);

create policy doc_versions_update_owner_or_uploader
on public.document_versions
for update
to authenticated
using (
  (public.is_org_owner(org_id) or uploaded_by = auth.uid())
  and exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_versions.document_id
      and d.org_id = document_versions.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
)
with check (
  (public.is_org_owner(org_id) or uploaded_by = auth.uid())
  and exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_versions.document_id
      and d.org_id = document_versions.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);

create policy doc_versions_delete_owner_or_uploader
on public.document_versions
for delete
to authenticated
using (
  (public.is_org_owner(org_id) or uploaded_by = auth.uid())
  and exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_versions.document_id
      and d.org_id = document_versions.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);

-- document_shares
drop policy if exists doc_shares_select_visible on public.document_shares;
drop policy if exists doc_shares_insert_visible on public.document_shares;
drop policy if exists doc_shares_delete_owner_or_creator on public.document_shares;

create policy doc_shares_select_visible
on public.document_shares
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_shares.document_id
      and d.org_id = document_shares.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);

create policy doc_shares_insert_visible
on public.document_shares
for insert
to authenticated
with check (
  created_by = auth.uid()
  and expires_at > now()
  and exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_shares.document_id
      and d.org_id = document_shares.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);

create policy doc_shares_delete_owner_or_creator
on public.document_shares
for delete
to authenticated
using (
  (public.is_org_owner(org_id) or created_by = auth.uid())
  and exists (
    select 1
    from public.documents d
    left join public.matters mt on mt.id = d.matter_id
    where d.id = document_shares.document_id
      and d.org_id = document_shares.org_id
      and (
        (d.matter_id is null and public.is_org_member(d.org_id))
        or (
          d.matter_id is not null
          and (
            (mt.is_private = false and public.is_org_member(d.org_id))
            or (
              mt.is_private = true
              and (
                public.is_org_owner(d.org_id)
                or public.is_matter_member(mt.id)
              )
            )
          )
        )
      )
  )
);
