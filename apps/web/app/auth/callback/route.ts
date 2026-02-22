import { NextResponse } from 'next/server';

/**
 * Auth callback route - kept for backward compatibility.
 * With custom auth, email verification links are no longer routed through Supabase OTP.
 * This route now simply redirects to /app or /signin.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = safeNextPath(searchParams.get('next')) ?? '/app';

  // Redirect to the intended destination
  return NextResponse.redirect(`${origin}${nextPath}`);
}

function safeNextPath(raw: string | null) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\n') || value.includes('\r')) return null;
  if (value.startsWith('/app') || value.startsWith('/admin')) return value;
  return null;
}
