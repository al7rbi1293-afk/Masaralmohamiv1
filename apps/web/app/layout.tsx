import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import Script from 'next/script';
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
const tiktokPixelId = 'D75TMPBC77UBIUFTUUVG';

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
        <Script id="tiktok-pixel-init" strategy="beforeInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject = t;
              var ttq = w[t] = w[t] || [];
              ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
              ttq.setAndDefer = function (target, method) {
                target[method] = function () {
                  target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
                };
              };
              for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
              ttq.instance = function (id) {
                var instance = ttq._i[id] || [];
                for (var n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(instance, ttq.methods[n]);
                return instance;
              };
              ttq.load = function (id, options) {
                var url = "https://analytics.tiktok.com/i18n/pixel/events.js";
                var partner = options && options.partner;
                ttq._i = ttq._i || {};
                ttq._i[id] = [];
                ttq._i[id]._u = url;
                ttq._t = ttq._t || {};
                ttq._t[id] = +new Date();
                ttq._o = ttq._o || {};
                ttq._o[id] = options || {};
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.async = true;
                script.src = url + "?sdkid=" + id + "&lib=" + t;
                var firstScript = document.getElementsByTagName("script")[0];
                firstScript.parentNode.insertBefore(script, firstScript);
              };

              ttq.load('${tiktokPixelId}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
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
