import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState, store } from '../store';
import { fetchEveryPage, FinanceGroup, summarizeMovements } from './finance-summary';
import apiError from './api-error';
import fireflyReader from './firefly-read';

type Overview = ReturnType<typeof summarizeMovements> & { recent: FinanceGroup[]; updatedAt: number };
// Session-only snapshots: never mix profiles or persist another copy of financial data.
const snapshots = new Map<string, Overview>();

export default function useFinancialOverview() {
  const profile = useSelector((state: RootState) => state.quickAccess.profileKey);
  const backend = useSelector((state: RootState) => state.configuration.backendURL);
  const { start, end } = useSelector((state: RootState) => state.firefly.rangeDetails);
  const key = JSON.stringify([profile, backend, start, end]);
  const [result, setResult] = useState<{ key: string; data?: Overview; error?: string; loading: boolean }>({ key, loading: true });
  const generation = useRef(0);
  const load = useCallback(async (force = true) => {
    generation.current += 1;
    const { current } = generation;
    const cached = snapshots.get(key);
    if (!force && cached && Date.now() - cached.updatedAt < 60000) {
      setResult({ key, data: cached, loading: false });
      return;
    }
    setResult({ key, data: cached, loading: true });
    try {
      const authorization = String(axios.defaults.headers.Authorization || '');
      if (!profile || !backend || !authorization) { setResult({ key, loading: false, error: 'api_error_auth' }); return; }
      const params = new URLSearchParams({ start, end, limit: '100' });
      const read = fireflyReader(backend, profile, authorization, () => store.getState().quickAccess.profileKey === profile && current === generation.current);
      const groups = await fetchEveryPage<FinanceGroup>((page) => read(`/api/v1/transactions?${params}&page=${page}`));
      const data = { ...summarizeMovements(groups), recent: groups.slice(0, 5), updatedAt: Date.now() };
      if (current !== generation.current || store.getState().quickAccess.profileKey !== profile) return;
      snapshots.set(key, data);
      if (snapshots.size > 12) snapshots.delete(snapshots.keys().next().value);
      setResult({ key, data, loading: false });
    } catch (error) {
      const keyError = apiError(error).key;
      const useCache = ['api_error_connection', 'api_error_server', 'api_error_rate_limit'].includes(keyError);
      if (!useCache) snapshots.delete(key);
      if (current === generation.current) {
        setResult({
          key, data: useCache ? cached : undefined, loading: false, error: keyError,
        });
      }
    }
  }, [key, profile, backend, start, end]);
  useFocusEffect(useCallback(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]));
  return { ...(result.key === key ? result : { loading: true, data: undefined, error: undefined }), refresh: load };
}
