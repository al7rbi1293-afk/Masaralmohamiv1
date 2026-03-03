create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'copilot_doc_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.copilot_doc_status as enum ('queued', 'processing', 'ready', 'failed');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'copilot_cache_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.copilot_cache_type as enum ('embedding', 'retrieval', 'answer');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'copilot_message_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.copilot_message_role as enum ('user', 'assistant', 'system');
  end if;
end;
$$;

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.matters(id) on delete cascade,
  source_document_id uuid null references public.documents(id) on delete set null,
  title text not null default '',
  file_name text not null,
  mime_type text null,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  sha256 text not null,
  status public.copilot_doc_status not null default 'queued',
  attempt_count int not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz not null default now(),
  started_at timestamptz null,
  processed_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  duplicate_of_document_id uuid null references public.case_documents(id) on delete set null,
  extraction_meta jsonb not null default '{}'::jsonb,
  created_by uuid null references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.matters(id) on delete cascade,
  document_id uuid not null references public.case_documents(id) on delete cascade,
  chunk_index int not null check (chunk_index >= 0),
  page_no int null,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('simple', coalesce(content, ''))) stored,
  token_count int not null default 0 check (token_count >= 0),
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.kb_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete cascade,
  title text not null,
  reference_code text null,
  source_type text not null default 'law',
  storage_bucket text null,
  storage_path text null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid null references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.kb_sources(id) on delete cascade,
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('simple', coalesce(content, ''))) stored,
  token_count int not null default 0 check (token_count >= 0),
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create table if not exists public.case_briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null unique references public.matters(id) on delete cascade,
  brief_markdown text not null default '',
  facts jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  source_chunk_ids uuid[] not null default '{}'::uuid[],
  is_stale boolean not null default true,
  built_at timestamptz null,
  created_by uuid null references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.copilot_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  title text null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.copilot_sessions(id) on delete cascade,
  case_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role public.copilot_message_role not null,
  message_markdown text not null,
  citations jsonb not null default '[]'::jsonb,
  token_input int not null default 0,
  token_output int not null default 0,
  model text null,
  latency_ms int null,
  created_at timestamptz not null default now()
);

create table if not exists public.copilot_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  month_start date not null,
  requests_used int not null default 0 check (requests_used >= 0),
  tokens_used bigint not null default 0 check (tokens_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, month_start)
);

create table if not exists public.copilot_audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  case_id uuid null references public.matters(id) on delete set null,
  session_id uuid null references public.copilot_sessions(id) on delete set null,
  message_id uuid null references public.copilot_messages(id) on delete set null,
  status text not null check (status in ('ok', 'validation_failed', 'quota_exceeded', 'rate_limited', 'forbidden', 'error')),
  model text null,
  intent text null,
  cached boolean not null default false,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  latency_ms int null,
  error_code text null,
  error_message text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.copilot_cache (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.app_users(id) on delete cascade,
  case_id uuid null references public.matters(id) on delete cascade,
  cache_type public.copilot_cache_type not null,
  cache_key text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, cache_type, cache_key)
);

create table if not exists public.copilot_rate_limits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, window_start)
);

create table if not exists public.copilot_worker_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_document_id uuid not null references public.case_documents(id) on delete cascade,
  stage text not null,
  status text not null check (status in ('started', 'completed', 'failed')),
  duration_ms int null,
  error_code text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_documents_org_case_status
  on public.case_documents (org_id, case_id, status, next_retry_at);
create index if not exists idx_case_documents_org_sha
  on public.case_documents (org_id, sha256);
create unique index if not exists uq_case_documents_active_sha
  on public.case_documents (org_id, case_id, sha256)
  where status in ('queued', 'processing', 'ready');

create index if not exists idx_document_chunks_org_case
  on public.document_chunks (org_id, case_id);
create index if not exists idx_document_chunks_document
  on public.document_chunks (document_id, chunk_index);
create index if not exists idx_document_chunks_content_tsv
  on public.document_chunks using gin (content_tsv);
create index if not exists idx_document_chunks_embedding
  on public.document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_kb_sources_org_status
  on public.kb_sources (org_id, status, updated_at desc);

create index if not exists idx_kb_chunks_org_source
  on public.kb_chunks (org_id, source_id);
create index if not exists idx_kb_chunks_content_tsv
  on public.kb_chunks using gin (content_tsv);
create index if not exists idx_kb_chunks_embedding
  on public.kb_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_case_briefs_org_case
  on public.case_briefs (org_id, case_id);
create index if not exists idx_case_briefs_stale
  on public.case_briefs (org_id, is_stale, updated_at desc);

create index if not exists idx_copilot_sessions_org_user
  on public.copilot_sessions (org_id, user_id, last_message_at desc);
create index if not exists idx_copilot_sessions_case
  on public.copilot_sessions (case_id, updated_at desc);

create index if not exists idx_copilot_messages_session
  on public.copilot_messages (session_id, created_at asc);
create index if not exists idx_copilot_messages_org_case
  on public.copilot_messages (org_id, case_id, created_at desc);

create index if not exists idx_copilot_usage_org_month
  on public.copilot_usage (org_id, month_start);

create index if not exists idx_copilot_audit_logs_org_created
  on public.copilot_audit_logs (org_id, created_at desc);
create index if not exists idx_copilot_audit_logs_org_user_created
  on public.copilot_audit_logs (org_id, user_id, created_at desc);
create index if not exists idx_copilot_audit_logs_status
  on public.copilot_audit_logs (status, created_at desc);

create index if not exists idx_copilot_cache_expires_at
  on public.copilot_cache (expires_at);
create index if not exists idx_copilot_cache_org_case_type
  on public.copilot_cache (org_id, case_id, cache_type, expires_at desc);

create index if not exists idx_copilot_rate_limits_expires
  on public.copilot_rate_limits (expires_at);

create index if not exists idx_copilot_worker_logs_doc_created
  on public.copilot_worker_logs (case_document_id, created_at desc);
create index if not exists idx_copilot_worker_logs_org_created
  on public.copilot_worker_logs (org_id, created_at desc);

grant select, insert, update, delete on public.case_documents to authenticated;
grant select, insert, update, delete on public.document_chunks to authenticated;
grant select, insert, update, delete on public.kb_sources to authenticated;
grant select, insert, update, delete on public.kb_chunks to authenticated;
grant select, insert, update, delete on public.case_briefs to authenticated;
grant select, insert, update, delete on public.copilot_sessions to authenticated;
grant select, insert, update, delete on public.copilot_messages to authenticated;
grant select, insert, update, delete on public.copilot_usage to authenticated;
grant select, insert, update, delete on public.copilot_audit_logs to authenticated;
grant select, insert, update, delete on public.copilot_cache to authenticated;
grant select, insert, update, delete on public.copilot_rate_limits to authenticated;
grant select, insert, update, delete on public.copilot_worker_logs to authenticated;

drop trigger if exists case_documents_set_updated_at on public.case_documents;
create trigger case_documents_set_updated_at
before update on public.case_documents
for each row
execute function public.set_updated_at();

drop trigger if exists kb_sources_set_updated_at on public.kb_sources;
create trigger kb_sources_set_updated_at
before update on public.kb_sources
for each row
execute function public.set_updated_at();

drop trigger if exists case_briefs_set_updated_at on public.case_briefs;
create trigger case_briefs_set_updated_at
before update on public.case_briefs
for each row
execute function public.set_updated_at();

drop trigger if exists copilot_sessions_set_updated_at on public.copilot_sessions;
create trigger copilot_sessions_set_updated_at
before update on public.copilot_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists copilot_usage_set_updated_at on public.copilot_usage;
create trigger copilot_usage_set_updated_at
before update on public.copilot_usage
for each row
execute function public.set_updated_at();

drop trigger if exists copilot_cache_set_updated_at on public.copilot_cache;
create trigger copilot_cache_set_updated_at
before update on public.copilot_cache
for each row
execute function public.set_updated_at();

drop trigger if exists copilot_rate_limits_set_updated_at on public.copilot_rate_limits;
create trigger copilot_rate_limits_set_updated_at
before update on public.copilot_rate_limits
for each row
execute function public.set_updated_at();

create or replace function public.mark_case_brief_stale_on_document_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ready' and old.status is distinct from new.status then
    insert into public.case_briefs (org_id, case_id, is_stale, updated_at)
    values (new.org_id, new.case_id, true, now())
    on conflict (case_id) do update
      set is_stale = true,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists case_documents_mark_brief_stale on public.case_documents;
create trigger case_documents_mark_brief_stale
after update of status on public.case_documents
for each row
when (new.status = 'ready')
execute function public.mark_case_brief_stale_on_document_ready();

create or replace function public.cleanup_copilot_expired_cache_and_limits(
  p_cache_delete_limit int default 2000,
  p_rate_delete_limit int default 2000
)
returns table(cache_deleted int, rate_limit_deleted int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cache_deleted int := 0;
  v_rate_deleted int := 0;
begin
  with deleted_cache as (
    delete from public.copilot_cache c
    where c.id in (
      select id
      from public.copilot_cache
      where expires_at < now()
      order by expires_at asc
      limit greatest(0, p_cache_delete_limit)
    )
    returning 1
  )
  select count(*) into v_cache_deleted from deleted_cache;

  with deleted_rates as (
    delete from public.copilot_rate_limits r
    where r.id in (
      select id
      from public.copilot_rate_limits
      where expires_at < now()
      order by expires_at asc
      limit greatest(0, p_rate_delete_limit)
    )
    returning 1
  )
  select count(*) into v_rate_deleted from deleted_rates;

  cache_deleted := v_cache_deleted;
  rate_limit_deleted := v_rate_deleted;
  return next;
end;
$$;
