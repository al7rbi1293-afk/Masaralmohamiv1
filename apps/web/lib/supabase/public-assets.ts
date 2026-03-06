const PUBLIC_ASSETS_BUCKET = 'public_assets';

type ResizeMode = 'cover' | 'contain' | 'fill';
type ImageFormat = 'origin';

type PublicImageTransform = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: ResizeMode;
  format?: ImageFormat;
};

function getSupabaseOrigin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function encodePathSegments(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

function extractObjectPath(urlOrPath: string, bucket = PUBLIC_ASSETS_BUCKET) {
  const trimmed = String(urlOrPath || '').trim();
  if (!trimmed) return '';

  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/render/image/public/${bucket}/`,
  ];

  try {
    const parsedUrl = new URL(trimmed);
    const marker = markers.find((candidate) => parsedUrl.pathname.includes(candidate));
    if (!marker) return '';
    return parsedUrl.pathname.split(marker)[1] ?? '';
  } catch {
    return trimmed.replace(/^\/+/, '');
  }
}

export function getSupabasePublicAssetUrl(
  urlOrPath: string,
  transform?: PublicImageTransform,
  bucket = PUBLIC_ASSETS_BUCKET,
) {
  const objectPath = extractObjectPath(urlOrPath, bucket);
  const supabaseOrigin = getSupabaseOrigin();

  if (!objectPath || !supabaseOrigin) {
    return String(urlOrPath || '').trim();
  }

  const route = transform ? 'render/image' : 'object';
  const url = new URL(`/storage/v1/${route}/public/${bucket}/${encodePathSegments(objectPath)}`, supabaseOrigin);

  if (transform?.width) {
    url.searchParams.set('width', String(transform.width));
  }

  if (transform?.height) {
    url.searchParams.set('height', String(transform.height));
  }

  if (transform?.quality) {
    url.searchParams.set('quality', String(transform.quality));
  }

  if (transform?.resize) {
    url.searchParams.set('resize', transform.resize);
  }

  if (transform?.format) {
    url.searchParams.set('format', transform.format);
  }

  return url.toString();
}

export function getSupabaseOfficeLogoUrl(urlOrPath: string, size: number) {
  const safeSize = Math.min(Math.max(Math.round(size), 24), 2500);

  return getSupabasePublicAssetUrl(urlOrPath, {
    width: safeSize,
    height: safeSize,
    quality: 80,
    resize: 'contain',
  });
}
