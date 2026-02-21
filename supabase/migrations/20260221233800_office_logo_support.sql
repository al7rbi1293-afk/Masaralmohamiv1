-- Add logo_url to organizations
alter table public.organizations
add column if not exists logo_url text;
-- Create public storage bucket for office logos and other public assets
insert into storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
values (
        'public_assets',
        'public_assets',
        true,
        5242880,
        -- 5MB limit
        array ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    ) on conflict (id) do
update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
-- Storage Policies for public_assets
-- 1. Read access: Public (anyone can view the logo)
create policy "Public Access to public_assets" on storage.objects for
select to public using (bucket_id = 'public_assets');
-- 2. Insert/Update Access: Authenticated users can upload logos
create policy "Authenticated users can upload public assets" on storage.objects for
insert to authenticated with check (bucket_id = 'public_assets');
create policy "Authenticated users can update public assets" on storage.objects for
update to authenticated using (bucket_id = 'public_assets');
create policy "Authenticated users can delete public assets" on storage.objects for delete to authenticated using (bucket_id = 'public_assets');