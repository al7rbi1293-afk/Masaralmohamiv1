import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveVersion() {
  const version =
    process.env.APP_VERSION?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.npm_package_version?.trim() ||
    'dev';

  return version;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      time: new Date().toISOString(),
      version: resolveVersion(),
    },
    { status: 200 },
  );
}

