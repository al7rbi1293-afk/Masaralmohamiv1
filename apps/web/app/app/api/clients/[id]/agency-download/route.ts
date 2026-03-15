import { NextResponse } from 'next/server';
import { getClientAgencySignedDownloadUrl } from '@/lib/clients';
import { logError } from '@/lib/logger';
import { toUserMessage } from '@/lib/shared-utils';

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const signedUrl = await getClientAgencySignedDownloadUrl(context.params.id);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تنزيل مرفق الوكالة.');
    logError('client_agency_download_failed', {
      clientId: context.params.id,
      message: error instanceof Error ? error.message : String(error ?? ''),
    });
    return new NextResponse(message, { status: message === 'العنصر غير موجود.' ? 404 : 400 });
  }
}
