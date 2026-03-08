import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/app',
          '/app/*',
          '/admin',
          '/admin/*',
          '/api',
          '/api/*',
          '/auth',
          '/auth/*',
          '/signin',
          '/signin/*',
          '/signup',
          '/signup/*',
          '/forgot-password',
          '/forgot-password/*',
          '/invite',
          '/invite/*',
          '/share',
          '/share/*',
          '/upgrade',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
