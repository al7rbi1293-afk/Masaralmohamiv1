create extension if not exists pgcrypto;

-- Phase 10.1.0 (v2): Lawyer-ready templates foundation:
-- - Typed variables schema (stored in JSONB)
-- - Presets stored in DB (read-only for authenticated users)
-- - Narrow template_type to DOCX for generation workflows

-- Ensure template_type is DOCX only (migrate legacy values if any).
update public.templates
set template_type = 'docx'
where template_type is distinct from 'docx';

alter table public.templates
alter column template_type set default 'docx';

alter table public.templates
drop constraint if exists templates_template_type_check;

alter table public.templates
add constraint templates_template_type_check
check (template_type in ('docx'));

-- Presets: built-in variable definitions (no org-specific data).
create table if not exists public.template_presets (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ar text not null,
  category text not null,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_template_presets_code on public.template_presets (code);
create index if not exists idx_template_presets_category on public.template_presets (category);

grant select on public.template_presets to authenticated;

alter table public.template_presets enable row level security;

drop policy if exists template_presets_select_authenticated on public.template_presets;

create policy template_presets_select_authenticated
on public.template_presets
for select
to authenticated
using (true);

-- Seed a small non-copyrighted presets set (variables only).
insert into public.template_presets (code, name_ar, category, variables)
values
(
  'WAKALA',
  'وكالة (أساسي)',
  'وكالة',
  '[
    {"key":"org.name","label_ar":"اسم المكتب","required":false,"source":"org","path":"name","format":"text","transform":"none","defaultValue":"","help_ar":"اسم المكتب كما هو مسجل في المنصة."},
    {"key":"date.today","label_ar":"تاريخ اليوم (ميلادي)","required":false,"source":"computed","path":"","format":"date","transform":"none","defaultValue":"","help_ar":"تاريخ اليوم بصيغة عربية."},
    {"key":"date.hijri_today","label_ar":"تاريخ اليوم (هجري)","required":false,"source":"computed","path":"","format":"date","transform":"none","defaultValue":"","help_ar":"تاريخ اليوم بالتقويم الهجري (إن توفر)."},
    {"key":"client.name","label_ar":"اسم الموكل","required":true,"source":"client","path":"name","format":"text","transform":"none","defaultValue":"","help_ar":"يظهر في مقدمة المستند."},
    {"key":"client.identity_no","label_ar":"رقم الهوية","required":false,"source":"client","path":"identity_no","format":"id","transform":"none","defaultValue":"","help_ar":"رقم الهوية الوطنية/الإقامة."},
    {"key":"manual.agent_name","label_ar":"اسم الوكيل","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":"اسم الوكيل المراد تفويضه."},
    {"key":"manual.subject","label_ar":"موضوع الوكالة","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":"موضوع الوكالة ونطاقها."}
  ]'::jsonb
),
(
  'PETITION',
  'لائحة دعوى (مختصر)',
  'لائحة دعوى',
  '[
    {"key":"org.name","label_ar":"اسم المكتب","required":false,"source":"org","path":"name","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"client.name","label_ar":"اسم المدعي","required":true,"source":"client","path":"name","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"matter.title","label_ar":"عنوان الدعوى","required":true,"source":"matter","path":"title","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"matter.summary","label_ar":"ملخص الدعوى","required":false,"source":"matter","path":"summary","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.claim_amount","label_ar":"مبلغ المطالبة","required":true,"source":"manual","path":"","format":"number","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.requests","label_ar":"الطلبات","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":"اكتب الطلبات بشكل نقاط."}
  ]'::jsonb
),
(
  'MEMO',
  'مذكرة (عام)',
  'مذكرة',
  '[
    {"key":"client.name","label_ar":"اسم الموكل","required":false,"source":"client","path":"name","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"matter.title","label_ar":"عنوان القضية","required":false,"source":"matter","path":"title","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.subject","label_ar":"موضوع المذكرة","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.body","label_ar":"نص المذكرة","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":""}
  ]'::jsonb
),
(
  'NOTICE',
  'إنذار (أساسي)',
  'إنذار',
  '[
    {"key":"client.name","label_ar":"اسم المرسل","required":true,"source":"client","path":"name","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.recipient_name","label_ar":"اسم المستلم","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.subject","label_ar":"موضوع الإنذار","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":""},
    {"key":"manual.body","label_ar":"نص الإنذار","required":true,"source":"manual","path":"","format":"text","transform":"none","defaultValue":"","help_ar":""}
  ]'::jsonb
)
on conflict (code) do nothing;

