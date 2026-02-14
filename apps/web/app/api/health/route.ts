import { NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      time: new Date().toISOString(),
      version: getAppVersion(),
    },
    { status: 200 },
  );
}
