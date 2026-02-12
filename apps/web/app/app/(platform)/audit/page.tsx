import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function AuditPage() {
  return (
    <Card className="p-6">
      <EmptyState title="سجل التدقيق" message="قريبًا" />
    </Card>
  );
}

