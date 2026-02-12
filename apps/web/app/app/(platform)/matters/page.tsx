import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function MattersPage() {
  return (
    <Card className="p-6">
      <EmptyState title="القضايا" message="قريبًا" />
    </Card>
  );
}

