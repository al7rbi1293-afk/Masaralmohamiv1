alter table public.clients
  add column if not exists agency_number text null,
  add column if not exists agency_file_name text null,
  add column if not exists agency_storage_path text null,
  add column if not exists agency_file_size bigint null,
  add column if not exists agency_file_mime_type text null;
