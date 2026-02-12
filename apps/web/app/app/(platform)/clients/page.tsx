import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function ClientsPage() {
  return (
    <Card className="p-6">
      <EmptyState title="العملاء" message="قريبًا" />
    </Card>
  );
}

