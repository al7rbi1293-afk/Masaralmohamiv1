'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, type AuthSession } from '@/lib/session';

export function useSessionGuard(tenantId: string) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = getSession();

    if (!current) {
      router.replace('/app/login');
      setLoading(false);
      return;
    }

    if (current.user.tenantId !== tenantId) {
      router.replace(`/app/${current.user.tenantId}/dashboard`);
      setLoading(false);
      return;
    }

    setSession(current);
    setLoading(false);
  }, [router, tenantId]);

  return { session, loading };
}
