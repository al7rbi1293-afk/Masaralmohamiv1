import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';

const supportEmail = 'masar.almohami@outlook.sa';

export default function BillingPage() {
  return (
    <Card className="p-6">
      <EmptyState title="الفوترة" message="قريبًا" />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/app" className={buttonVariants('outline', 'sm')}>
          لوحة التحكم
        </Link>
        <a href={`mailto:${supportEmail}`} className={buttonVariants('primary', 'sm')}>
          تواصل معنا
        </a>
      </div>
    </Card>
  );
}

