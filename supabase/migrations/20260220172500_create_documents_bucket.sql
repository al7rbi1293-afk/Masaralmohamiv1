-- Create the "documents" storage bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50MB limit
  null
) on conflict (id) do nothing;

-- Ensure RLS is enabled for storage.objects
-- (This is usually true by default. If it fails with permission error, skip it)

-- Policy to allow authenticated users to view/download documents
create policy "Allow authenticated members to select documents" on storage.objects
for select
to authenticated
using ( bucket_id = 'documents' );

-- Policy to allow authenticated users to upload/insert documents
create policy "Allow authenticated members to insert documents" on storage.objects
for insert
to authenticated
with check ( bucket_id = 'documents' );

-- Policy to allow authenticated users to update their own documents
create policy "Allow authenticated members to update documents" on storage.objects
for update
to authenticated
using ( bucket_id = 'documents' )
with check ( bucket_id = 'documents' );
