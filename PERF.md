# Performance Notes

## Pagination (UI Lists)
جميع صفحات القوائم داخل `/app` تعتمد على Pagination عبر:
- `limit` (افتراضيًا 10–20 حسب الصفحة، وبحد أقصى 50).
- `page` (يبدأ من 1).

ويتم تنفيذها في استعلامات Supabase/PostgREST عبر `range(from, to)` مع فلترة `org_id` (دفاعًا إضافيًا بجانب RLS).

## Database Indexes
### Search
- Migration: `supabase/migrations/0013_search_indexes.sql`
- الهدف: تسريع البحث البسيط على حقول العنوان/الاسم داخل كل مكتب (org).

### List Ordering / Sorting
- Migration: `supabase/migrations/0014_perf_indexes.sql`
- الهدف: تسريع ترتيب القوائم الشائعة لكل مكتب:
  - `clients`: `(org_id, updated_at desc)`
  - `matters`: `(org_id, updated_at desc)`
  - `documents`: `(org_id, created_at desc)`
  - `tasks`: `(org_id, updated_at desc)`
  - `invoices`: `(org_id, issued_at desc)` (لا يوجد `created_at` في جدول الفواتير)

ملاحظة: RLS موجود دائمًا، لكن إضافة `org_id` في الفهارس يساعد بشكل واضح مع pagination والترتيب.

## Rate Limits (MVP)
الحدود الحالية تعتمد على IP وبذاكرة العملية (In‑Memory). في Vercel قد تختلف النتائج حسب الـ instance.

- `POST /api/start-trial`: 5 / 10 دقائق
- `POST /api/contact-request`: 10 / 10 دقائق
- `GET /app/api/search`: 60 / 10 دقائق
- Team endpoints (`/app/api/team/*`): 10 / 10 دقائق
- Invite accept flow (`/invite/[token]`): 20 / 10 دقائق
- Private matter members (`/app/api/matters/[id]/members/*`): 30 / 10 دقائق

رسالة 429 موحدة:
- "تم تجاوز الحد المسموح. حاول مرة أخرى بعد قليل."

