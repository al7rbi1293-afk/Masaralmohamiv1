# Sijil MVP Sprint Plan (0-5)

## Sprint 0 (Foundation)

- Mono-repo bootstrap: `apps/api`, `apps/web`, `apps/worker`
- Docker compose stack with PostgreSQL, Redis, MinIO, API, Web, Worker
- Prisma schema baseline + migration + seed
- Basic CI/dev scripts and local run path (`docker compose up --build`)

Shippable output:

- Stack boots with seeded demo tenant and users
- Web + API reachable locally

## Sprint 1 (Identity, Security, Tenancy)

- Auth: login, refresh, logout
- JWT payload with `tenantId` and role
- RBAC guard for Partner/Lawyer/Assistant
- Tenant-scoped query patterns in all domain services
- Audit events for auth lifecycle

Shippable output:

- Secure sign-in and role-restricted endpoint access
- Tenant isolation from JWT claim to query layer

## Sprint 2 (Core CRM + Matters)

- Users management (Partner): create, disable, role assignment
- Tenant settings: firm name/logo/language/hijri/retention
- Clients: CRUD, archive, search, pagination
- Matters: CRUD, statuses, assignee, private flag, members, timeline

Shippable output:

- Operational client/matter workflows in API + UI

## Sprint 3 (Documents)

- Document folders and metadata tags
- Presigned upload/download URLs (MinIO)
- Versioned documents
- Expiring share tokens + public share endpoint
- Audit events for view/download/share/version
- Rate limiting on share endpoints

Shippable output:

- End-to-end secure document handling in API + UI

## Sprint 4 (Tasks + Billing)

- Tasks CRUD with status/due dates/reminder timestamp
- Worker-based reminder notifications via BullMQ
- Billing quotes and conversion to invoices
- Invoice list and mark-paid workflow
- Server-side invoice PDF export

Shippable output:

- Full operational task + billing loop in API + UI

## Sprint 5 (Observability + DX)

- Dashboard widgets: overdue, upcoming 7d, stale 14d, unpaid
- Audit log listing endpoint
- OpenAPI spec and Postman collection
- Unit + integration tests for security-critical flows

Shippable output:

- Testable, documented MVP with end-to-end developer onboarding
