alter table public.tasks
add column if not exists is_archived boolean not null default false;

alter table public.documents
add column if not exists is_archived boolean not null default false;

alter table public.invoices
add column if not exists is_archived boolean not null default false;

create index if not exists idx_tasks_org_archived
  on public.tasks (org_id, is_archived, updated_at desc);

create index if not exists idx_documents_org_archived
  on public.documents (org_id, is_archived, created_at desc);

create index if not exists idx_invoices_org_archived
  on public.invoices (org_id, is_archived, issued_at desc);

create or replace function public.ensure_org_owner(
  p_org_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_actor_id
      and m.role = 'owner'
  ) then
    raise exception 'not_allowed';
  end if;
end;
$$;

create or replace function public.delete_task_cascade(
  p_org_id uuid,
  p_actor_id uuid,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_org_owner(p_org_id, p_actor_id);

  if not exists (
    select 1
    from public.tasks t
    where t.org_id = p_org_id
      and t.id = p_task_id
  ) then
    raise exception 'not_found';
  end if;

  delete from public.tasks
  where org_id = p_org_id
    and id = p_task_id;

  return jsonb_build_object('storage_paths', '[]'::jsonb);
end;
$$;

create or replace function public.delete_document_cascade(
  p_org_id uuid,
  p_actor_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_storage_paths text[] := array[]::text[];
begin
  perform public.ensure_org_owner(p_org_id, p_actor_id);

  if not exists (
    select 1
    from public.documents d
    where d.org_id = p_org_id
      and d.id = p_document_id
  ) then
    raise exception 'not_found';
  end if;

  select coalesce(array_agg(distinct dv.storage_path), array[]::text[])
    into v_storage_paths
  from public.document_versions dv
  where dv.org_id = p_org_id
    and dv.document_id = p_document_id;

  delete from public.documents
  where org_id = p_org_id
    and id = p_document_id;

  return jsonb_build_object('storage_paths', to_jsonb(v_storage_paths));
end;
$$;

create or replace function public.delete_invoice_cascade(
  p_org_id uuid,
  p_actor_id uuid,
  p_invoice_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_org_owner(p_org_id, p_actor_id);

  if not exists (
    select 1
    from public.invoices i
    where i.org_id = p_org_id
      and i.id = p_invoice_id
  ) then
    raise exception 'not_found';
  end if;

  delete from public.invoices
  where org_id = p_org_id
    and id = p_invoice_id;

  return jsonb_build_object('storage_paths', '[]'::jsonb);
end;
$$;

create or replace function public.delete_matter_cascade(
  p_org_id uuid,
  p_actor_id uuid,
  p_matter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_storage_paths text[] := array[]::text[];
begin
  perform public.ensure_org_owner(p_org_id, p_actor_id);

  if not exists (
    select 1
    from public.matters m
    where m.org_id = p_org_id
      and m.id = p_matter_id
  ) then
    raise exception 'not_found';
  end if;

  select coalesce(array_agg(distinct dv.storage_path), array[]::text[])
    into v_storage_paths
  from public.document_versions dv
  inner join public.documents d
    on d.id = dv.document_id
  where d.org_id = p_org_id
    and d.matter_id = p_matter_id;

  delete from public.invoices
  where org_id = p_org_id
    and matter_id = p_matter_id;

  delete from public.quotes
  where org_id = p_org_id
    and matter_id = p_matter_id;

  delete from public.tasks
  where org_id = p_org_id
    and matter_id = p_matter_id;

  delete from public.documents
  where org_id = p_org_id
    and matter_id = p_matter_id;

  delete from public.matters
  where org_id = p_org_id
    and id = p_matter_id;

  return jsonb_build_object('storage_paths', to_jsonb(v_storage_paths));
end;
$$;

create or replace function public.delete_client_cascade(
  p_org_id uuid,
  p_actor_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_storage_paths text[] := array[]::text[];
  v_matter_ids uuid[] := array[]::uuid[];
begin
  perform public.ensure_org_owner(p_org_id, p_actor_id);

  if not exists (
    select 1
    from public.clients c
    where c.org_id = p_org_id
      and c.id = p_client_id
  ) then
    raise exception 'not_found';
  end if;

  select coalesce(array_agg(m.id), array[]::uuid[])
    into v_matter_ids
  from public.matters m
  where m.org_id = p_org_id
    and m.client_id = p_client_id;

  select coalesce(array_agg(distinct dv.storage_path), array[]::text[])
    into v_storage_paths
  from public.document_versions dv
  inner join public.documents d
    on d.id = dv.document_id
  where d.org_id = p_org_id
    and (
      d.client_id = p_client_id
      or d.matter_id = any(v_matter_ids)
    );

  delete from public.invoices
  where org_id = p_org_id
    and (
      client_id = p_client_id
      or matter_id = any(v_matter_ids)
    );

  delete from public.quotes
  where org_id = p_org_id
    and (
      client_id = p_client_id
      or matter_id = any(v_matter_ids)
    );

  delete from public.tasks
  where org_id = p_org_id
    and matter_id = any(v_matter_ids);

  delete from public.documents
  where org_id = p_org_id
    and (
      client_id = p_client_id
      or matter_id = any(v_matter_ids)
    );

  delete from public.matters
  where org_id = p_org_id
    and client_id = p_client_id;

  delete from public.clients
  where org_id = p_org_id
    and id = p_client_id;

  return jsonb_build_object('storage_paths', to_jsonb(v_storage_paths));
end;
$$;
