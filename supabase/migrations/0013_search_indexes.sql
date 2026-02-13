-- Optional indexes to keep basic ILIKE searches snappy per org.
-- Note: ILIKE with leading wildcard (%term%) may not fully use btree indexes,
-- but these still help with org scoping and ordering in many cases.

create index if not exists idx_clients_org_name on public.clients (org_id, name);
create index if not exists idx_clients_org_email on public.clients (org_id, email);

create index if not exists idx_matters_org_title on public.matters (org_id, title);

create index if not exists idx_documents_org_title on public.documents (org_id, title);

create index if not exists idx_tasks_org_title on public.tasks (org_id, title);

