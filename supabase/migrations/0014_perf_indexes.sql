-- Phase 7.2.1.6: Performance indexes for common list ordering.
-- These are safe, additive indexes intended to speed up per-org pagination and sorting.

create index if not exists idx_clients_org_updated_desc
on public.clients (org_id, updated_at desc);

create index if not exists idx_matters_org_updated_desc
on public.matters (org_id, updated_at desc);

create index if not exists idx_documents_org_created_desc
on public.documents (org_id, created_at desc);

create index if not exists idx_tasks_org_updated_desc
on public.tasks (org_id, updated_at desc);

-- Invoices are listed by issued_at (there is no created_at column).
create index if not exists idx_invoices_org_issued_desc
on public.invoices (org_id, issued_at desc);

