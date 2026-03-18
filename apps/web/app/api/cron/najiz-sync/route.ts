import { NextResponse } from 'next/server';
import { processQueuedNajizSyncJobs } from '@/lib/integrations/domain/services/najiz-orchestration.service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const limit = normalizeBatchSize(request);
    const result = await processQueuedNajizSyncJobs({
      limit,
      lockOwner: 'cron:najiz-sync',
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Najiz cron failed';
    console.error('Najiz Cron Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeBatchSize(request: Request) {
  const value =
    Number(request.headers.get('x-batch-size')) ||
    Number(new URL(request.url).searchParams.get('limit')) ||
    Number(process.env.NAJIZ_SYNC_BATCH_SIZE || 10);

  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.min(50, Math.max(1, Math.floor(value)));
}
