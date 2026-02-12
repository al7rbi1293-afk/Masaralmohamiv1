import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function DocumentsPage() {
  return (
    <Card className="p-6">
      <EmptyState title="المستندات" message="قريبًا" />
    </Card>
  );
}

