'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';

type OfficeLogoImageProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  sizes: string;
  className?: string;
  onMissing?: ReactNode;
};

export function OfficeLogoImage({
  src,
  fallbackSrc = '',
  alt,
  sizes,
  className,
  onMissing = null,
}: OfficeLogoImageProps) {
  const primarySrc = String(src || '').trim();
  const safeFallbackSrc = String(fallbackSrc || '').trim();
  const [activeSrc, setActiveSrc] = useState(primarySrc);

  useEffect(() => {
    setActiveSrc(primarySrc);
  }, [primarySrc]);

  if (!activeSrc) {
    return <>{onMissing}</>;
  }

  return (
    <Image
      src={activeSrc}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      unoptimized
      onError={() => {
        if (safeFallbackSrc && activeSrc !== safeFallbackSrc) {
          setActiveSrc(safeFallbackSrc);
          return;
        }

        setActiveSrc('');
      }}
    />
  );
}
