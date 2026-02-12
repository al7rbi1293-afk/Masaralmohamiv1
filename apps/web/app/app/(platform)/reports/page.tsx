import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function ReportsPage() {
  return (
    <Card className="p-6">
      <EmptyState title="التقارير" message="قريبًا" />
    </Card>
  );
}

