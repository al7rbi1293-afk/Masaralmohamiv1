import { Card } from '@/components/ui/card';
import { GlobalSearchClient } from '@/components/search/global-search-client';

export default function SearchPage() {
  return (
    <Card className="p-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">البحث</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          ابحث بسرعة داخل المكتب عن عميل أو قضية أو مستند أو مهمة.
        </p>
      </div>

      <div className="mt-5">
        <GlobalSearchClient />
      </div>
    </Card>
  );
}

