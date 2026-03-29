create or replace function public.enqueue_case_document_from_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document record;
  v_sha256 text;
begin
  select d.id, d.org_id, d.matter_id, d.title
    into v_document
  from public.documents d
  where d.id = new.document_id
    and d.org_id = new.org_id;

  if not found or v_document.matter_id is null then
    return new;
  end if;

  v_sha256 := encode(
    digest(
      coalesce(v_document.org_id::text, '')
      || ':' || coalesce(v_document.id::text, '')
      || ':' || coalesce(new.version_no::text, '')
      || ':' || coalesce(new.storage_path, '')
      || ':' || coalesce(new.file_size::text, '')
      || ':' || coalesce(nullif(trim(new.checksum), ''), ''),
      'sha256'
    ),
    'hex'
  );

  insert into public.case_documents (
    org_id,
    case_id,
    source_document_id,
    title,
    file_name,
    mime_type,
    storage_bucket,
    storage_path,
    sha256
  )
  values (
    v_document.org_id,
    v_document.matter_id,
    v_document.id,
    coalesce(nullif(trim(v_document.title), ''), new.file_name),
    new.file_name,
    new.mime_type,
    'documents',
    new.storage_path,
    v_sha256
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists document_versions_enqueue_case_document on public.document_versions;
create trigger document_versions_enqueue_case_document
after insert on public.document_versions
for each row
execute function public.enqueue_case_document_from_version();
