-- Phase 7.2: Search supporting indexes (lightweight)

-- Note: These btree indexes help when scoping by org_id and ordering.
-- For advanced substring search performance, consider pg_trgm + GIN indexes later.

create index if not exists idx_matters_org_title on public.matters (org_id, title);
create index if not exists idx_documents_org_title on public.documents (org_id, title);
create index if not exists idx_tasks_org_title on public.tasks (org_id, title);

