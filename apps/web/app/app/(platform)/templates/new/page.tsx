import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { TemplateCreateForm } from '@/components/templates/template-create-form';

export default function TemplateNewPage() {
  return (
    <Card className="p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'القوالب', href: '/app/templates' },
          { label: 'قالب جديد' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">قالب جديد</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ قالبًا جديدًا ثم ارفع النسخة الأولى من الملف.
          </p>
        </div>
        <Link href="/app/templates" className={buttonVariants('outline', 'sm')}>
          إلغاء
        </Link>
      </div>

      <TemplateCreateForm />
    </Card>
  );
}

