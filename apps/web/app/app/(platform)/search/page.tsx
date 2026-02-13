import { Card } from '@/components/ui/card';
import { GlobalSearchClient } from '@/components/search/global-search-client';

type SearchPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  const initialQuery = (searchParams?.q ?? '').trim();

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">البحث</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          ابحث في العملاء والقضايا والمستندات والمهام ضمن مكتبك.
        </p>
      </div>

      <GlobalSearchClient initialQuery={initialQuery} />
    </Card>
  );
}

