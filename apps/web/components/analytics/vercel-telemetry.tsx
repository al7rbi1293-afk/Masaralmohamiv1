'use client';

import dynamic from 'next/dynamic';

const VercelAnalytics = dynamic(
  () => import('@vercel/analytics/next').then((module) => module.Analytics),
  { ssr: false },
);

const VercelSpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((module) => module.SpeedInsights),
  { ssr: false },
);

export function VercelTelemetry() {
  return (
    <>
      <VercelAnalytics />
      <VercelSpeedInsights />
    </>
  );
}
