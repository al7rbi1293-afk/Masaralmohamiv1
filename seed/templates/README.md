# Starter Templates (Masar Al-Muhami)

هذه قوالب تجريبية خفيفة لا تحتوي نصوصًا قانونية كاملة (لتجنب أي محتوى محمي). الهدف هو توفير **هيكل** + **متغيرات** جاهزة لتسريع الإعداد.

## Placeholders

هذه الملفات تحتوي متغيرات بصيغة Docxtemplater:

- `{{client.name}}`, `{{client.identity_no}}`, `{{client.phone}}`
- `{{matter.title}}`, `{{matter.summary}}`
- `{{date.today}}`
- متغيرات يدوية مثل: `{{manual.subject}}`, `{{manual.body}}`

## Usage

لا يتم رفع هذه الملفات تلقائيًا. استخدم سكربت seeding:

```bash
ORG_ID=... \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
tsx scripts/seed-starter-templates.ts
```

