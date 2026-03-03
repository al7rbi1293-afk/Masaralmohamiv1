create or replace function public.is_org_member_for(p_user_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_user_id
  );
$$;

create or replace function public.is_org_owner_for(p_user_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_user_id
      and m.role = 'owner'
  );
$$;

create or replace function public.can_access_case_for(p_user_id uuid, p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matters mt
    where mt.id = p_case_id
      and (
        (
          mt.is_private = false
          and public.is_org_member_for(p_user_id, mt.org_id)
        )
        or (
          mt.is_private = true
          and (
            public.is_org_owner_for(p_user_id, mt.org_id)
            or mt.assigned_user_id = p_user_id
            or exists (
              select 1
              from public.matter_members mm
              where mm.matter_id = mt.id
                and mm.user_id = p_user_id
            )
          )
        )
      )
  );
$$;

alter table public.case_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.kb_sources enable row level security;
alter table public.kb_chunks enable row level security;
alter table public.case_briefs enable row level security;
alter table public.copilot_sessions enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.copilot_usage enable row level security;
alter table public.copilot_audit_logs enable row level security;
alter table public.copilot_cache enable row level security;
alter table public.copilot_rate_limits enable row level security;
alter table public.copilot_worker_logs enable row level security;

drop policy if exists case_documents_select_access on public.case_documents;
drop policy if exists case_documents_insert_manage on public.case_documents;
drop policy if exists case_documents_update_manage on public.case_documents;
drop policy if exists case_documents_delete_manage on public.case_documents;

create policy case_documents_select_access
on public.case_documents
for select
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy case_documents_insert_manage
on public.case_documents
for insert
to authenticated
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.matters mt
    where mt.id = case_documents.case_id
      and mt.org_id = case_documents.org_id
      and (
        public.is_org_owner_for(auth.uid(), mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
);

create policy case_documents_update_manage
on public.case_documents
for update
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.matters mt
    where mt.id = case_documents.case_id
      and mt.org_id = case_documents.org_id
      and (
        public.is_org_owner_for(auth.uid(), mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
)
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.matters mt
    where mt.id = case_documents.case_id
      and mt.org_id = case_documents.org_id
      and (
        public.is_org_owner_for(auth.uid(), mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
);

create policy case_documents_delete_manage
on public.case_documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.matters mt
    where mt.id = case_documents.case_id
      and mt.org_id = case_documents.org_id
      and public.is_org_owner_for(auth.uid(), mt.org_id)
  )
);

drop policy if exists document_chunks_select_access on public.document_chunks;
drop policy if exists document_chunks_insert_manage on public.document_chunks;
drop policy if exists document_chunks_update_manage on public.document_chunks;
drop policy if exists document_chunks_delete_manage on public.document_chunks;

create policy document_chunks_select_access
on public.document_chunks
for select
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.case_documents d
    where d.id = document_chunks.document_id
      and d.org_id = document_chunks.org_id
      and d.case_id = document_chunks.case_id
  )
);

create policy document_chunks_insert_manage
on public.document_chunks
for insert
to authenticated
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.case_documents d
    join public.matters mt on mt.id = d.case_id
    where d.id = document_chunks.document_id
      and d.org_id = document_chunks.org_id
      and d.case_id = document_chunks.case_id
      and (
        public.is_org_owner_for(auth.uid(), mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
);

create policy document_chunks_update_manage
on public.document_chunks
for update
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
)
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy document_chunks_delete_manage
on public.document_chunks
for delete
to authenticated
using (
  exists (
    select 1
    from public.case_documents d
    join public.matters mt on mt.id = d.case_id
    where d.id = document_chunks.document_id
      and mt.org_id = document_chunks.org_id
      and public.is_org_owner_for(auth.uid(), mt.org_id)
  )
);

drop policy if exists kb_sources_select_access on public.kb_sources;
drop policy if exists kb_sources_insert_owner on public.kb_sources;
drop policy if exists kb_sources_update_owner on public.kb_sources;
drop policy if exists kb_sources_delete_owner on public.kb_sources;

create policy kb_sources_select_access
on public.kb_sources
for select
to authenticated
using (
  org_id is null
  or public.is_org_member_for(auth.uid(), org_id)
);

create policy kb_sources_insert_owner
on public.kb_sources
for insert
to authenticated
with check (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
);

create policy kb_sources_update_owner
on public.kb_sources
for update
to authenticated
using (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
)
with check (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
);

create policy kb_sources_delete_owner
on public.kb_sources
for delete
to authenticated
using (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
);

drop policy if exists kb_chunks_select_access on public.kb_chunks;
drop policy if exists kb_chunks_insert_owner on public.kb_chunks;
drop policy if exists kb_chunks_update_owner on public.kb_chunks;
drop policy if exists kb_chunks_delete_owner on public.kb_chunks;

create policy kb_chunks_select_access
on public.kb_chunks
for select
to authenticated
using (
  (org_id is null or public.is_org_member_for(auth.uid(), org_id))
  and exists (
    select 1
    from public.kb_sources ks
    where ks.id = kb_chunks.source_id
      and (
        ks.org_id is null
        or ks.org_id = kb_chunks.org_id
      )
  )
);

create policy kb_chunks_insert_owner
on public.kb_chunks
for insert
to authenticated
with check (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
  and exists (
    select 1
    from public.kb_sources ks
    where ks.id = kb_chunks.source_id
      and ks.org_id = kb_chunks.org_id
  )
);

create policy kb_chunks_update_owner
on public.kb_chunks
for update
to authenticated
using (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
)
with check (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
);

create policy kb_chunks_delete_owner
on public.kb_chunks
for delete
to authenticated
using (
  org_id is not null
  and public.is_org_owner_for(auth.uid(), org_id)
);

drop policy if exists case_briefs_select_access on public.case_briefs;
drop policy if exists case_briefs_insert_manage on public.case_briefs;
drop policy if exists case_briefs_update_manage on public.case_briefs;
drop policy if exists case_briefs_delete_owner on public.case_briefs;

create policy case_briefs_select_access
on public.case_briefs
for select
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy case_briefs_insert_manage
on public.case_briefs
for insert
to authenticated
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.matters mt
    where mt.id = case_briefs.case_id
      and mt.org_id = case_briefs.org_id
      and (
        public.is_org_owner_for(auth.uid(), mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
);

create policy case_briefs_update_manage
on public.case_briefs
for update
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
)
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy case_briefs_delete_owner
on public.case_briefs
for delete
to authenticated
using (
  public.is_org_owner_for(auth.uid(), org_id)
);

drop policy if exists copilot_sessions_select_own on public.copilot_sessions;
drop policy if exists copilot_sessions_insert_own on public.copilot_sessions;
drop policy if exists copilot_sessions_update_own on public.copilot_sessions;
drop policy if exists copilot_sessions_delete_own on public.copilot_sessions;

create policy copilot_sessions_select_own
on public.copilot_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy copilot_sessions_insert_own
on public.copilot_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy copilot_sessions_update_own
on public.copilot_sessions
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy copilot_sessions_delete_own
on public.copilot_sessions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists copilot_messages_select_own on public.copilot_messages;
drop policy if exists copilot_messages_insert_own on public.copilot_messages;
drop policy if exists copilot_messages_update_own on public.copilot_messages;
drop policy if exists copilot_messages_delete_own on public.copilot_messages;

create policy copilot_messages_select_own
on public.copilot_messages
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
);

create policy copilot_messages_insert_own
on public.copilot_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and public.can_access_case_for(auth.uid(), case_id)
  and exists (
    select 1
    from public.copilot_sessions s
    where s.id = copilot_messages.session_id
      and s.user_id = auth.uid()
      and s.org_id = copilot_messages.org_id
      and s.case_id = copilot_messages.case_id
  )
);

create policy copilot_messages_update_own
on public.copilot_messages
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy copilot_messages_delete_own
on public.copilot_messages
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists copilot_usage_select_own on public.copilot_usage;
drop policy if exists copilot_usage_insert_own on public.copilot_usage;
drop policy if exists copilot_usage_update_own on public.copilot_usage;

create policy copilot_usage_select_own
on public.copilot_usage
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

create policy copilot_usage_insert_own
on public.copilot_usage
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

create policy copilot_usage_update_own
on public.copilot_usage
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

drop policy if exists copilot_audit_logs_select_visible on public.copilot_audit_logs;
drop policy if exists copilot_audit_logs_insert_own on public.copilot_audit_logs;

create policy copilot_audit_logs_select_visible
on public.copilot_audit_logs
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_owner_for(auth.uid(), org_id)
);

create policy copilot_audit_logs_insert_own
on public.copilot_audit_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
  and (
    case_id is null
    or public.can_access_case_for(auth.uid(), case_id)
  )
);

drop policy if exists copilot_cache_select_scope on public.copilot_cache;
drop policy if exists copilot_cache_insert_scope on public.copilot_cache;
drop policy if exists copilot_cache_update_scope on public.copilot_cache;
drop policy if exists copilot_cache_delete_scope on public.copilot_cache;

create policy copilot_cache_select_scope
on public.copilot_cache
for select
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and (user_id is null or user_id = auth.uid())
  and (case_id is null or public.can_access_case_for(auth.uid(), case_id))
);

create policy copilot_cache_insert_scope
on public.copilot_cache
for insert
to authenticated
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and (user_id is null or user_id = auth.uid())
  and (case_id is null or public.can_access_case_for(auth.uid(), case_id))
);

create policy copilot_cache_update_scope
on public.copilot_cache
for update
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and (user_id is null or user_id = auth.uid())
  and (case_id is null or public.can_access_case_for(auth.uid(), case_id))
)
with check (
  public.is_org_member_for(auth.uid(), org_id)
  and (user_id is null or user_id = auth.uid())
  and (case_id is null or public.can_access_case_for(auth.uid(), case_id))
);

create policy copilot_cache_delete_scope
on public.copilot_cache
for delete
to authenticated
using (
  public.is_org_member_for(auth.uid(), org_id)
  and (user_id is null or user_id = auth.uid())
);

drop policy if exists copilot_rate_limits_select_own on public.copilot_rate_limits;
drop policy if exists copilot_rate_limits_insert_own on public.copilot_rate_limits;
drop policy if exists copilot_rate_limits_update_own on public.copilot_rate_limits;
drop policy if exists copilot_rate_limits_delete_own on public.copilot_rate_limits;

create policy copilot_rate_limits_select_own
on public.copilot_rate_limits
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

create policy copilot_rate_limits_insert_own
on public.copilot_rate_limits
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

create policy copilot_rate_limits_update_own
on public.copilot_rate_limits
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

create policy copilot_rate_limits_delete_own
on public.copilot_rate_limits
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member_for(auth.uid(), org_id)
);

drop policy if exists copilot_worker_logs_select_owner on public.copilot_worker_logs;

create policy copilot_worker_logs_select_owner
on public.copilot_worker_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.case_documents d
    where d.id = copilot_worker_logs.case_document_id
      and d.org_id = copilot_worker_logs.org_id
      and public.is_org_owner_for(auth.uid(), d.org_id)
      and public.can_access_case_for(auth.uid(), d.case_id)
  )
);
