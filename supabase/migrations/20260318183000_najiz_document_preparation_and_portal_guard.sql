alter table public.external_documents
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processing_error text null,
  add column if not exists processed_at timestamptz null,
  add column if not exists last_processing_attempt_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_documents_processing_status_check'
      and conrelid = 'public.external_documents'::regclass
  ) then
    alter table public.external_documents
      add constraint external_documents_processing_status_check
      check (processing_status in ('pending', 'downloading', 'ready', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists idx_external_documents_processing_status
  on public.external_documents (org_id, processing_status, synced_at desc);

alter table public.integration_sync_jobs
  drop constraint if exists integration_sync_jobs_job_kind_check;

alter table public.integration_sync_jobs
  add constraint integration_sync_jobs_job_kind_check
  check (
    job_kind in (
      'matter_refresh',
      'health_check',
      'lawyer_verification',
      'case_sync',
      'judicial_cost_sync',
      'enforcement_request_sync',
      'document_sync',
      'document_prepare',
      'session_minutes_sync',
      'smart_notification_dispatch'
    )
  );
