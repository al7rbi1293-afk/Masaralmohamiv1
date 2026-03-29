create or replace function public.consume_copilot_rate_limit_for_user(
  p_org_id uuid,
  p_user_id uuid,
  p_limit int,
  p_window_seconds int default 60
)
returns table(
  allowed boolean,
  current_count int,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_new_count int;
  v_window int := greatest(30, least(coalesce(p_window_seconds, 60), 3600));
  v_limit int := greatest(1, coalesce(p_limit, 20));
begin
  if p_user_id is null then
    raise exception 'user_id_required';
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
    p_user_id,
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

create or replace function public.consume_copilot_quota_for_user(
  p_org_id uuid,
  p_user_id uuid,
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
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', timezone('utc', now()))::date;
  v_request_inc int := greatest(0, coalesce(p_request_inc, 0));
  v_token_inc bigint := greatest(0, coalesce(p_token_inc, 0));
  v_request_limit int := greatest(1, coalesce(p_request_limit, 500));
  v_token_limit bigint := greatest(1, coalesce(p_token_limit, 1000000));
  v_usage_id uuid;
  v_requests_used int;
  v_tokens_used bigint;
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  insert into public.copilot_usage (org_id, user_id, month_start, requests_used, tokens_used)
  values (p_org_id, p_user_id, v_month_start, 0, 0)
  on conflict (org_id, user_id, month_start) do nothing;

  select u.id, u.requests_used, u.tokens_used
  into v_usage_id, v_requests_used, v_tokens_used
  from public.copilot_usage u
  where u.org_id = p_org_id
    and u.user_id = p_user_id
    and u.month_start = v_month_start
  for update;

  if (v_requests_used + v_request_inc) > v_request_limit
     or (v_tokens_used + v_token_inc) > v_token_limit then
    allowed := false;
    requests_used := v_requests_used;
    tokens_used := v_tokens_used;
    month_start := v_month_start;
    return next;
    return;
  end if;

  update public.copilot_usage u
  set
    requests_used = u.requests_used + v_request_inc,
    tokens_used = u.tokens_used + v_token_inc,
    updated_at = now()
  where u.id = v_usage_id
  returning u.requests_used, u.tokens_used
  into requests_used, tokens_used;

  allowed := true;
  month_start := v_month_start;
  return next;
end;
$$;

revoke all on function public.consume_copilot_rate_limit_for_user(uuid, uuid, int, int) from public;
revoke all on function public.consume_copilot_quota_for_user(uuid, uuid, int, bigint, int, bigint) from public;

grant execute on function public.consume_copilot_rate_limit_for_user(uuid, uuid, int, int) to service_role;
grant execute on function public.consume_copilot_quota_for_user(uuid, uuid, int, bigint, int, bigint) to service_role;
