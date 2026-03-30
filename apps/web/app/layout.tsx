import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { MarketingAnalytics } from '@/components/analytics/analytics';
import { ReferralCapture } from '@/components/analytics/referral-capture';
import { VercelTelemetry } from '@/components/analytics/vercel-telemetry';
import { getPublicSiteUrl } from '@/lib/env';
import { siteConfig } from '@/lib/site';
import './globals.css';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  variable: '--font-ibm-plex-arabic',
  weight: ['300', '400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

const siteUrl = getPublicSiteUrl();
const isVercelDeployment = Boolean(process.env.VERCEL);
const defaultOgImage = '/masar-logo.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.nameAr} | ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.nameAr}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.nameAr} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteUrl,
    siteName: siteConfig.nameEn,
    locale: 'ar_SA',
    type: 'website',
    images: [defaultOgImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.nameAr} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [defaultOgImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: `${siteConfig.nameAr} | Masar Al Mohami`,
        alternateName: [siteConfig.nameAr, 'Masar Al Mohami'],
        url: siteUrl,
        logo: `${siteUrl}/masar-logo.png`,
        description: siteConfig.description,
        areaServed: {
          '@type': 'Country',
          name: 'Saudi Arabia',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: siteConfig.nameAr,
        alternateName: 'Masar Al Mohami',
        url: siteUrl,
        description: siteConfig.description,
        inLanguage: 'ar-SA',
        publisher: {
          '@id': `${siteUrl}#organization`,
        },
      },
    ],
  };

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${ibmPlexArabic.variable} ${inter.variable} min-h-screen antialiased`}>
        <ThemeProvider>
          <a href="#main-content" className="skip-link">
            تجاوز إلى المحتوى
          </a>
          <Navbar />
          <main id="main-content">{children}</main>
          <Footer />
        </ThemeProvider>
        <MarketingAnalytics />
        <ReferralCapture />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {isVercelDeployment ? <VercelTelemetry /> : null}
      </body>
    </html>
  );
}
