'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/track';

const ROLE_OPTIONS = [
  'محامٍ مستقل',
  'صاحب مكتب',
  'شريك',
  'محامٍ ضمن فريق',
  'إداري أو مدير تشغيل',
] as const;

const OFFICE_SIZE_OPTIONS = ['1', '2-5', '6-10', '11+'] as const;

const MAIN_REASON_OPTIONS = [
  'إدارة القضايا',
  'تنظيم المستندات',
  'المهام والمواعيد',
  'الفوترة والتحصيل',
  'بوابة العميل',
  'تكامل ناجز',
  'التقارير',
  'أخرى',
] as const;

const USAGE_STATUS_OPTIONS = [
  { value: 'active', label: 'أستخدمها بشكل مستمر' },
  { value: 'limited', label: 'استخدمتها بشكل محدود' },
  { value: 'not_started', label: 'سجلت ولم أبدأ بعد' },
  { value: 'stopped', label: 'توقفت عن استخدامها' },
] as const;

const MODULE_OPTIONS = [
  'العملاء',
  'القضايا',
  'المستندات',
  'القوالب',
  'المهام والتقويم',
  'الفواتير وعروض الأسعار',
  'بوابة العميل',
  'التقارير',
  'تكامل ناجز',
] as const;

const TOP_BENEFIT_OPTIONS = [
  'جمع ملف القضية في مكان واحد',
  'سهولة الوصول للمستندات',
  'تنظيم المهام والمواعيد',
  'متابعة الفواتير والتحصيل',
  'تقليل استفسارات العملاء عبر البوابة',
  'لا يزال الأثر غير واضح',
] as const;

const ACTIVE_BLOCKER_OPTIONS = [
  'نقل البيانات',
  'احتياج تدريب للفريق',
  'بعض الميزات ناقصة',
  'الواجهة تحتاج تبسيط',
  'السعر',
  'بطء في بعض الخطوات',
  'لا يوجد عائق حاليًا',
] as const;

const INACTIVE_REASON_OPTIONS = [
  'ما كان عندي وقت للتفعيل',
  'احتجت تدريب أو شرح',
  'نقل البيانات كان صعب',
  'بعض الميزات التي أحتاجها غير متوفرة',
  'السعر غير مناسب',
  'اكتفيت بنظامي الحالي',
  'أخرى',
] as const;

const ACTIVATION_SUPPORT_OPTIONS = [
  'جلسة تعريف سريعة',
  'نقل بيانات أولي',
  'إعداد جاهز للمكتب',
  'شرح بالفيديو',
  'تجربة موجهة خطوة بخطوة',
  'دعم مباشر عند البداية',
] as const;

const FEATURE_PRIORITY_OPTIONS = [
  'إدارة القضايا',
  'المستندات والإصدارات',
  'القوالب',
  'المهام والتذكيرات',
  'الفوترة والتحصيل',
  'بوابة العميل',
  'التقارير',
  'الصلاحيات وسجل التدقيق',
  'تكامل ناجز',
] as const;

const PRICING_FIT_OPTIONS = [
  'مناسبة جدًا',
  'مناسبة إلى حد ما',
  'مرتفعة',
  'أحتاج باقة مختلفة',
  'غير واضح لي',
] as const;

const FOLLOW_UP_OPTIONS = [
  'نعم، جلسة تعريف سريعة',
  'نعم، نقل بيانات',
  'نعم، تدريب للفريق',
  'لا حاليًا',
] as const;

const NAJIZ_IMPORTANCE_OPTIONS = [
  'ضروري جدًا',
  'مهم',
  'ثانوي',
  'غير مهم حاليًا',
] as const;

const EASE_RATING_OPTIONS = ['1', '2', '3', '4', '5'] as const;
const RECOMMENDATION_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

type UsageStatus = (typeof USAGE_STATUS_OPTIONS)[number]['value'] | '';

type FormState = {
  fullName: string;
  firmName: string;
  email: string;
  phone: string;
  role: string;
  officeSize: string;
  mainReason: string;
  usageStatus: UsageStatus;
  usedModules: string[];
  topBenefit: string;
  easeRating: string;
  activeBlocker: string;
  featurePriorities: string[];
  futureImprovement: string;
  najizImportance: string;
  pricingFit: string;
  recommendation: string;
  followUpInterest: string;
  inactiveReason: string;
  activationSupport: string[];
  missingFeature: string;
};

const INITIAL_STATE: FormState = {
  fullName: '',
  firmName: '',
  email: '',
  phone: '',
  role: '',
  officeSize: '',
  mainReason: '',
  usageStatus: '',
  usedModules: [],
  topBenefit: '',
  easeRating: '',
  activeBlocker: '',
  featurePriorities: [],
  futureImprovement: '',
  najizImportance: '',
  pricingFit: '',
  recommendation: '',
  followUpInterest: '',
  inactiveReason: '',
  activationSupport: [],
  missingFeature: '',
};

function formatList(values: string[]) {
  return values.length ? values.join('، ') : 'غير محدد';
}

function shortText(value: string, maxLength = 360) {
  return value.trim().slice(0, maxLength) || 'غير محدد';
}

function getUsageStatusLabel(value: UsageStatus) {
  return USAGE_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? 'غير محدد';
}

function buildSurveyMessage(form: FormState) {
  const lines = [
    `الصفة: ${form.role}`,
    `حجم المكتب: ${form.officeSize}`,
    `سبب التسجيل: ${form.mainReason}`,
    `حالة الاستخدام: ${getUsageStatusLabel(form.usageStatus)}`,
  ];

  if (form.usageStatus === 'active' || form.usageStatus === 'limited') {
    lines.push(
      `الأقسام المستخدمة: ${formatList(form.usedModules)}`,
      `أكبر فائدة: ${form.topBenefit || 'غير محدد'}`,
      `سهولة الاستخدام: ${form.easeRating || 'غير محدد'}/5`,
      `العائق الرئيسي: ${form.activeBlocker || 'غير محدد'}`,
      `أهم 3 ميزات: ${formatList(form.featurePriorities)}`,
      `أهمية ناجز: ${form.najizImportance || 'غير محدد'}`,
      `ملاءمة الباقات: ${form.pricingFit || 'غير محدد'}`,
      `التوصية: ${form.recommendation || 'غير محدد'}/10`,
      `التواصل: ${form.followUpInterest || 'غير محدد'}`,
      `أولوية التطوير: ${shortText(form.futureImprovement)}`,
    );
  } else {
    lines.push(
      `سبب عدم البدء/التوقف: ${form.inactiveReason || 'غير محدد'}`,
      `ما يسهل البدء: ${formatList(form.activationSupport)}`,
      `الميزة المتوقعة: ${form.missingFeature || 'غير محدد'}`,
      `ملاءمة الباقات: ${form.pricingFit || 'غير محدد'}`,
      `التواصل: ${form.followUpInterest || 'غير محدد'}`,
      `اقتراح لتحسين البداية: ${shortText(form.futureImprovement)}`,
    );
  }

  return lines.join('\n');
}

function fieldClassName() {
  return 'h-11 w-full rounded-lg border border-brand-border bg-white px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950';
}

function selectFieldClassName() {
  return `${fieldClassName()} appearance-none`;
}

type CheckboxGroupProps = {
  label: string;
  helper?: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
};

function CheckboxGroup({ label, helper, options, selected, onToggle }: CheckboxGroupProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-slate-700 dark:text-slate-200">{label}</p>
        {helper ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                checked
                  ? 'border-brand-emerald bg-emerald-50 text-brand-navy dark:border-brand-emerald dark:bg-emerald-950/20 dark:text-slate-100'
                  : 'border-brand-border bg-white text-slate-700 hover:border-brand-emerald/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function LawyerSurveyForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isActiveUsage = form.usageStatus === 'active' || form.usageStatus === 'limited';
  const selectedFeatureCount = form.featurePriorities.length;
  const hasMissingBasicFields =
    !form.fullName.trim() ||
    !form.email.trim() ||
    !form.role ||
    !form.officeSize ||
    !form.mainReason ||
    !form.usageStatus;
  const hasMissingConditionalFields = isActiveUsage
    ? form.featurePriorities.length === 0
    : Boolean(form.usageStatus) && !form.inactiveReason;
  const submitDisabled = status === 'submitting' || hasMissingBasicFields || hasMissingConditionalFields;

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleMultiValue(key: 'usedModules' | 'activationSupport' | 'featurePriorities', value: string, max?: number) {
    setForm((current) => {
      const exists = current[key].includes(value);
      if (exists) {
        return { ...current, [key]: current[key].filter((item) => item !== value) };
      }

      if (max && current[key].length >= max) {
        return current;
      }

      return { ...current, [key]: [...current[key], value] };
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.fullName.trim() || !form.email.trim() || !form.role || !form.officeSize || !form.mainReason || !form.usageStatus) {
      setError('يرجى تعبئة البيانات الأساسية قبل الإرسال.');
      return;
    }

    if (isActiveUsage && form.featurePriorities.length === 0) {
      setError('يرجى اختيار أهم الميزات بالنسبة لك.');
      return;
    }

    if (!isActiveUsage && !form.inactiveReason) {
      setError('يرجى تحديد سبب عدم البدء أو التوقف.');
      return;
    }

    setStatus('submitting');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          firm_name: form.firmName.trim() || undefined,
          topic: 'lawyer_survey_v1',
          message: buildSurveyMessage(form),
          referrer: typeof document !== 'undefined' ? document.referrer || window.location.href : undefined,
          website: '',
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(payload?.message ?? 'تعذر إرسال الاستبيان. حاول مرة أخرى.');
        setStatus('idle');
        return;
      }

      trackEvent('lead_submit', { source: 'lawyer_survey' });
      setStatus('success');
      setForm(INITIAL_STATE);
    } catch {
      setError('تعذر الاتصال بالخدمة. حاول مرة أخرى.');
      setStatus('idle');
    }
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900 sm:p-8">
      <div className="mb-8 rounded-xl bg-brand-background p-4 text-sm leading-7 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        هذا الاستبيان قصير ومخصص للمحامين والمكاتب المسجلين في مسار المحامي، وإجاباتك تساعدنا نحسن
        تجربة القضايا والمستندات والمهام والفوترة والتكاملات.
      </div>

      {status === 'success' ? (
        <div
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          شكرًا لك. تم استلام إجابتك بنجاح.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">البيانات الأساسية</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الاسم الكامل</span>
              <input
                required
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                className={fieldClassName()}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className={fieldClassName()}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">اسم المكتب</span>
              <input
                value={form.firmName}
                onChange={(event) => updateField('firmName', event.target.value)}
                className={fieldClassName()}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال</span>
              <input
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                className={fieldClassName()}
                dir="ltr"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">عن مكتبك وسبب التسجيل</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ما صفتك الحالية؟</span>
              <select
                required
                value={form.role}
                onChange={(event) => updateField('role', event.target.value)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">عدد المستخدمين المتوقعين</span>
              <select
                required
                value={form.officeSize}
                onChange={(event) => updateField('officeSize', event.target.value)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {OFFICE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ما السبب الرئيسي لتسجيلك؟</span>
              <select
                required
                value={form.mainReason}
                onChange={(event) => updateField('mainReason', event.target.value)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {MAIN_REASON_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">كيف تصف استخدامك الحالي؟</span>
              <select
                required
                value={form.usageStatus}
                onChange={(event) => updateField('usageStatus', event.target.value as UsageStatus)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {USAGE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {isActiveUsage ? (
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">تجربة الاستخدام الحالية</h2>

            <CheckboxGroup
              label="ما الأقسام التي استخدمتها فعليًا؟"
              options={MODULE_OPTIONS}
              selected={form.usedModules}
              onToggle={(value) => toggleMultiValue('usedModules', value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">ما أكثر شيء أفادك؟</span>
                <select
                  value={form.topBenefit}
                  onChange={(event) => updateField('topBenefit', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {TOP_BENEFIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">قيّم سهولة الاستخدام</span>
                <select
                  value={form.easeRating}
                  onChange={(event) => updateField('easeRating', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {EASE_RATING_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ما أكبر عائق يمنعك من الاعتماد الكامل؟</span>
              <select
                value={form.activeBlocker}
                onChange={(event) => updateField('activeBlocker', event.target.value)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {ACTIVE_BLOCKER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <CheckboxGroup
              label="ما أهم 3 ميزات بالنسبة لك؟"
              helper={`يمكنك اختيار حتى 3 ميزات فقط. المختار حاليًا: ${selectedFeatureCount}/3`}
              options={FEATURE_PRIORITY_OPTIONS}
              selected={form.featurePriorities}
              onToggle={(value) => toggleMultiValue('featurePriorities', value, 3)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">ما مدى أهمية تكامل ناجز؟</span>
                <select
                  value={form.najizImportance}
                  onChange={(event) => updateField('najizImportance', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {NAJIZ_IMPORTANCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">هل الباقات الحالية مناسبة؟</span>
                <select
                  value={form.pricingFit}
                  onChange={(event) => updateField('pricingFit', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {PRICING_FIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">مدى احتمالية التوصية</span>
                <select
                  value={form.recommendation}
                  onChange={(event) => updateField('recommendation', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {RECOMMENDATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">هل ترغب أن يتواصل معك الفريق؟</span>
                <select
                  value={form.followUpInterest}
                  onChange={(event) => updateField('followUpInterest', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {FOLLOW_UP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : form.usageStatus ? (
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">أسباب عدم البدء أو التوقف</h2>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ما السبب الرئيسي؟</span>
              <select
                value={form.inactiveReason}
                onChange={(event) => updateField('inactiveReason', event.target.value)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {INACTIVE_REASON_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <CheckboxGroup
              label="ما الذي كان سيجعل البدء أسهل؟"
              options={ACTIVATION_SUPPORT_OPTIONS}
              selected={form.activationSupport}
              onToggle={(value) => toggleMultiValue('activationSupport', value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">ما أهم ميزة كنت تتوقع وجودها؟</span>
                <select
                  value={form.missingFeature}
                  onChange={(event) => updateField('missingFeature', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {FEATURE_PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">هل الباقات الحالية مناسبة؟</span>
                <select
                  value={form.pricingFit}
                  onChange={(event) => updateField('pricingFit', event.target.value)}
                  className={selectFieldClassName()}
                >
                  <option value="">اختر</option>
                  {PRICING_FIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">هل ترغب أن يتواصل معك الفريق؟</span>
              <select
                value={form.followUpInterest}
                onChange={(event) => updateField('followUpInterest', event.target.value)}
                className={selectFieldClassName()}
              >
                <option value="">اختر</option>
                {FOLLOW_UP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">رأيك المفتوح</h2>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              إذا طوّرنا شيئًا واحدًا خلال الفترة القادمة، ماذا تفضّل؟
            </span>
            <textarea
              rows={5}
              maxLength={400}
              value={form.futureImprovement}
              onChange={(event) => updateField('futureImprovement', event.target.value)}
              className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              الحد الأقصى 400 حرف.
            </span>
          </label>
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitDisabled}>
            {status === 'submitting' ? 'جارٍ الإرسال...' : 'إرسال الاستبيان'}
          </Button>
          <p className="text-sm text-slate-500 dark:text-slate-400">المدة المتوقعة: 2 إلى 3 دقائق</p>
        </div>
      </form>
    </div>
  );
}
