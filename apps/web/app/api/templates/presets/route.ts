import { NextResponse } from 'next/server';
import { TEMPLATE_PRESETS } from '@/lib/templatePresets';

export async function GET() {
  return NextResponse.json(
    { ok: true, count: TEMPLATE_PRESETS.length, presets: TEMPLATE_PRESETS },
    { status: 200 },
  );
}

