import { NextRequest, NextResponse } from 'next/server';
import { processTapWebhook } from '@/lib/partners/tap-webhook';
import { verifyTapWebhookSignature } from '@/lib/partners/tap';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('hashstring') || request.headers.get('x-tap-signature');

  const isValid = verifyTapWebhookSignature({ rawBody, signature });
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const result = await processTapWebhook({ payload, signature });

    return NextResponse.json(
      {
        ok: true,
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed.',
      },
      { status: 500 },
    );
  }
}
