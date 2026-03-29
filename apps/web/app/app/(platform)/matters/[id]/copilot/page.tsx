import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { CopilotChat } from '@/components/copilot/copilot-chat';
import { getMatterById } from '@/lib/matters';
import { isCopilotEnabled } from '@/lib/env';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { isUserAppAdmin } from '@/lib/admin';

type MatterCopilotPageProps = {
  params: {
    id: string;
  };
};

export default async function MatterCopilotPage({ params }: MatterCopilotPageProps) {
  if (!isCopilotEnabled()) {
    return (
      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المساعد القانوني</h1>
          <Link href={`/app/matters/${params.id}`} className={buttonVariants('outline', 'sm')}>
            العودة للقضية
          </Link>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          خدمة الذكاء الاصطناعي موقوفة مؤقتًا للتحكم بالتكاليف، وستعود قريبًا بإصدار أفضل.
        </p>
      </Card>
    );
  }

  const currentUser = await getCurrentAuthUser();
  const canUseCopilot = currentUser ? await isUserAppAdmin(currentUser.id).catch(() => false) : false;

  if (!canUseCopilot) {
    return (
      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المساعد القانوني</h1>
          <Link href={`/app/matters/${params.id}`} className={buttonVariants('outline', 'sm')}>
            العودة للقضية
          </Link>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          الوصول إلى المساعد القانوني محصور بحساب الإدارة فقط.
        </p>
      </Card>
    );
  }

  const matter = await getMatterById(params.id);

  if (!matter) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المساعد القانوني</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          القضية غير موجودة أو لا تملك صلاحية الوصول.
        </p>
        <div className="mt-4">
          <Link href="/app/matters" className={buttonVariants('outline', 'sm')}>
            العودة إلى القضايا
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المساعد القانوني</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            مساعد قانوني مرتبط بالقضية الحالية مع إحالات موثقة.
          </p>
        </div>
        <Link href={`/app/matters/${matter.id}`} className={buttonVariants('outline', 'sm')}>
          العودة للقضية
        </Link>
      </div>

      <CopilotChat caseId={matter.id} caseTitle={matter.title} isRestricted={matter.is_private} />
    </Card>
  );
}
