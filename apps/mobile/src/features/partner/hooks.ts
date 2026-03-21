import { useEffect, useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { fetchPartnerOverview } from './api';
import { PartnerOverview } from './types';

export function usePartnerOverview() {
  const { session } = useAuth();
  const [data, setData] = useState<PartnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const payload = await fetchPartnerOverview(session.token);
        if (mounted) {
          setData(payload);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل بوابة الشريك.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [refreshIndex, session?.token]);

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshIndex((value) => value + 1),
    hasSession: Boolean(session?.token),
  };
}
