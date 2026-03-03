create or replace function public.match_case_chunks(
  p_org_id uuid,
  p_case_id uuid,
  p_query_embedding vector(1536),
  p_match_count int,
  p_min_similarity float default null,
  p_keyword_terms text[] default null
)
returns table(
  chunk_id uuid,
  source_label text,
  content text,
  page_no int,
  document_id uuid,
  source_id uuid,
  similarity float8
)
language sql
stable
set search_path = public
as $$
  with ranked as (
    select
      dc.id as chunk_id,
      coalesce(cd.file_name, nullif(cd.title, ''), 'Case document') as source_label,
      dc.content,
      dc.page_no,
      dc.document_id,
      null::uuid as source_id,
      (1 - (dc.embedding <=> p_query_embedding))::float8 as similarity,
      case
        when coalesce(array_length(p_keyword_terms, 1), 0) = 0 then 0
        when exists (
          select 1
          from unnest(p_keyword_terms) as t(term)
          where length(trim(t.term)) > 0
            and dc.content ilike ('%' || trim(t.term) || '%')
        ) then 1
        else 0
      end as keyword_hit
    from public.document_chunks dc
    join public.case_documents cd
      on cd.id = dc.document_id
    where dc.org_id = p_org_id
      and dc.case_id = p_case_id
      and cd.status = 'ready'
      and (
        p_min_similarity is null
        or (1 - (dc.embedding <=> p_query_embedding)) >= p_min_similarity
      )
  )
  select
    ranked.chunk_id,
    ranked.source_label,
    ranked.content,
    ranked.page_no,
    ranked.document_id,
    ranked.source_id,
    ranked.similarity
  from ranked
  order by ranked.keyword_hit desc, ranked.similarity desc
  limit greatest(1, least(p_match_count, 50));
$$;

create or replace function public.match_kb_chunks(
  p_org_id uuid,
  p_query_embedding vector(1536),
  p_match_count int,
  p_min_similarity float default null,
  p_keyword_terms text[] default null
)
returns table(
  chunk_id uuid,
  source_label text,
  content text,
  page_no int,
  document_id uuid,
  source_id uuid,
  similarity float8
)
language sql
stable
set search_path = public
as $$
  with ranked as (
    select
      kc.id as chunk_id,
      coalesce(ks.title, ks.reference_code, 'Legal KB') as source_label,
      kc.content,
      null::int as page_no,
      null::uuid as document_id,
      kc.source_id,
      (1 - (kc.embedding <=> p_query_embedding))::float8 as similarity,
      case
        when coalesce(array_length(p_keyword_terms, 1), 0) = 0 then 0
        when exists (
          select 1
          from unnest(p_keyword_terms) as t(term)
          where length(trim(t.term)) > 0
            and kc.content ilike ('%' || trim(t.term) || '%')
        ) then 1
        else 0
      end as keyword_hit
    from public.kb_chunks kc
    join public.kb_sources ks
      on ks.id = kc.source_id
    where (kc.org_id is null or kc.org_id = p_org_id)
      and ks.status = 'active'
      and (
        p_min_similarity is null
        or (1 - (kc.embedding <=> p_query_embedding)) >= p_min_similarity
      )
  )
  select
    ranked.chunk_id,
    ranked.source_label,
    ranked.content,
    ranked.page_no,
    ranked.document_id,
    ranked.source_id,
    ranked.similarity
  from ranked
  order by ranked.keyword_hit desc, ranked.similarity desc
  limit greatest(1, least(p_match_count, 50));
$$;

create or replace function public.dequeue_case_documents(p_batch_size int default 10)
returns table(
  id uuid,
  org_id uuid,
  case_id uuid,
  source_document_id uuid,
  file_name text,
  mime_type text,
  storage_bucket text,
  storage_path text,
  sha256 text,
  attempt_count int,
  next_retry_at timestamptz,
  extraction_meta jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_docs as (
    select d.id
    from public.case_documents d
    where d.status = 'queued'
      and d.next_retry_at <= now()
    order by d.created_at asc
    limit greatest(1, least(coalesce(p_batch_size, 10), 100))
    for update skip locked
  ), claimed as (
    update public.case_documents d
    set
      status = 'processing',
      started_at = now(),
      attempt_count = d.attempt_count + 1,
      updated_at = now()
    where d.id in (select nd.id from next_docs nd)
    returning
      d.id,
      d.org_id,
      d.case_id,
      d.source_document_id,
      d.file_name,
      d.mime_type,
      d.storage_bucket,
      d.storage_path,
      d.sha256,
      d.attempt_count,
      d.next_retry_at,
      d.extraction_meta,
      d.created_at
  )
  select
    claimed.id,
    claimed.org_id,
    claimed.case_id,
    claimed.source_document_id,
    claimed.file_name,
    claimed.mime_type,
    claimed.storage_bucket,
    claimed.storage_path,
    claimed.sha256,
    claimed.attempt_count,
    claimed.next_retry_at,
    claimed.extraction_meta,
    claimed.created_at
  from claimed
  order by claimed.created_at asc;
end;
$$;

create or replace function public.consume_copilot_rate_limit(
  p_org_id uuid,
  p_limit int,
  p_window_seconds int default 60
)
returns table(
  allowed boolean,
  current_count int,
  reset_at timestamptz
)
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz;
  v_new_count int;
  v_window int := greatest(30, least(coalesce(p_window_seconds, 60), 3600));
  v_limit int := greatest(1, coalesce(p_limit, 20));
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);

  insert into public.copilot_rate_limits (
    org_id,
    user_id,
    window_start,
    request_count,
    expires_at
  )
  values (
    p_org_id,
    v_user_id,
    v_window_start,
    1,
    v_window_start + make_interval(secs => v_window * 2)
  )
  on conflict (org_id, user_id, window_start)
  do update set
    request_count = public.copilot_rate_limits.request_count + 1,
    expires_at = excluded.expires_at,
    updated_at = now()
  returning request_count into v_new_count;

  allowed := v_new_count <= v_limit;
  current_count := v_new_count;
  reset_at := v_window_start + make_interval(secs => v_window);
  return next;
end;
$$;

create or replace function public.consume_copilot_quota(
  p_org_id uuid,
  p_request_inc int,
  p_token_inc bigint,
  p_request_limit int,
  p_token_limit bigint
)
returns table(
  allowed boolean,
  requests_used int,
  tokens_used bigint,
  month_start date
)
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_month_start date := date_trunc('month', timezone('utc', now()))::date;
  v_request_inc int := greatest(0, coalesce(p_request_inc, 0));
  v_token_inc bigint := greatest(0, coalesce(p_token_inc, 0));
  v_request_limit int := greatest(1, coalesce(p_request_limit, 500));
  v_token_limit bigint := greatest(1, coalesce(p_token_limit, 1000000));
  v_row public.copilot_usage%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.copilot_usage (org_id, user_id, month_start, requests_used, tokens_used)
  values (p_org_id, v_user_id, v_month_start, 0, 0)
  on conflict (org_id, user_id, month_start) do nothing;

  select *
  into v_row
  from public.copilot_usage u
  where u.org_id = p_org_id
    and u.user_id = v_user_id
    and u.month_start = v_month_start
  for update;

  if (v_row.requests_used + v_request_inc) > v_request_limit
     or (v_row.tokens_used + v_token_inc) > v_token_limit then
    allowed := false;
    requests_used := v_row.requests_used;
    tokens_used := v_row.tokens_used;
    month_start := v_month_start;
    return next;
    return;
  end if;

  update public.copilot_usage u
  set
    requests_used = u.requests_used + v_request_inc,
    tokens_used = u.tokens_used + v_token_inc,
    updated_at = now()
  where u.id = v_row.id
  returning u.requests_used, u.tokens_used
  into requests_used, tokens_used;

  allowed := true;
  month_start := v_month_start;
  return next;
end;
$$;

revoke all on function public.dequeue_case_documents(int) from public;
grant execute on function public.dequeue_case_documents(int) to service_role;

revoke all on function public.cleanup_copilot_expired_cache_and_limits(int, int) from public;
grant execute on function public.cleanup_copilot_expired_cache_and_limits(int, int) to service_role;
