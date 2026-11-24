import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

export function useResolver(name, payload, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return invoke(name, payload)
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((error) => setState({ loading: false, error: error.message ?? String(error), data: null }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export const REPO_URL = /^(?:https:\/\/github\.com\/)?[A-Za-z0-9-]+\/[A-Za-z0-9._-]+?(?:\.git)?\/?$/;

export function timeAgo(iso) {
  if (!iso) return 'never';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}
