import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export default function PlatformNotFound() {
  return (
    <Card className="p-6">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الصفحة غير موجودة</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        الرابط الذي تحاول فتحه غير متوفر داخل المنصة.
      </p>
      <div className="mt-5">
        <Link href="/app" className={buttonVariants('primary', 'sm')}>
          العودة للوحة التحكم
        </Link>
      </div>
    </Card>
  );
}

