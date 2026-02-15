import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();
  const pages = ['/', '/security', '/privacy', '/terms', '/contact'];

  return pages.map((path) => ({
    url: new URL(path, `${siteUrl}/`).toString(),
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
