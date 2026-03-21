import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

type RemoteFileAction = {
  url: string;
  fileName: string;
  mimeType?: string | null;
};

const DOWNLOADS_DIR = `${FileSystem.documentDirectory ?? ''}masar-downloads/`;

function sanitizeFileName(value: string) {
  const normalized = String(value ?? '')
    .replaceAll('\u0000', '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  if (!normalized) {
    return `file-${Date.now()}`;
  }

  const sanitized = normalized
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
    .trim();

  return sanitized || `file-${Date.now()}`;
}

function inferMimeType(fileName: string, mimeType?: string | null) {
  if (mimeType?.trim()) {
    return mimeType.trim();
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

async function ensureDownloadsDir() {
  if (!FileSystem.documentDirectory) {
    throw new Error('تعذر الوصول إلى مساحة الملفات على هذا الجهاز.');
  }

  const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
}

export async function downloadRemoteFile(action: RemoteFileAction) {
  await ensureDownloadsDir();

  const safeName = sanitizeFileName(action.fileName);
  const targetUri = `${DOWNLOADS_DIR}${Date.now()}-${safeName}`;
  const result = await FileSystem.downloadAsync(action.url, targetUri);

  if (result.status < 200 || result.status >= 300) {
    throw new Error('تعذر تنزيل الملف من الخادم.');
  }

  return {
    uri: result.uri,
    fileName: safeName,
    mimeType: inferMimeType(safeName, action.mimeType),
  };
}

export async function openRemoteFileInApp(action: RemoteFileAction) {
  const result = await WebBrowser.openBrowserAsync(action.url, {
    dismissButtonStyle: 'close',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    showTitle: true,
  });

  return result;
}

async function shareLocalFile(params: {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  dialogTitle: string;
}) {
  const mimeType = inferMimeType(params.fileName, params.mimeType);
  const sharingAvailable = await Sharing.isAvailableAsync();

  if (sharingAvailable) {
    await Sharing.shareAsync(params.uri, {
      mimeType,
      dialogTitle: params.dialogTitle,
    });
    return;
  }

  await Linking.openURL(params.uri);
}

export async function exportRemoteFileToDevice(action: RemoteFileAction) {
  const downloaded = await downloadRemoteFile(action);
  await shareLocalFile({
    uri: downloaded.uri,
    fileName: downloaded.fileName,
    mimeType: downloaded.mimeType,
    dialogTitle: 'حفظ الملف على الجهاز',
  });

  return downloaded;
}

export async function shareRemoteFileFromDevice(action: RemoteFileAction) {
  const downloaded = await downloadRemoteFile(action);
  await shareLocalFile({
    uri: downloaded.uri,
    fileName: downloaded.fileName,
    mimeType: downloaded.mimeType,
    dialogTitle: 'مشاركة الملف',
  });

  return downloaded;
}
