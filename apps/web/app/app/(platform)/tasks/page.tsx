import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function TasksPage() {
  return (
    <Card className="p-6">
      <EmptyState title="المهام" message="قريبًا" />
    </Card>
  );
}

