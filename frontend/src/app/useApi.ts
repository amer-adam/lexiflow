import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Api } from "@/lib/api";
import { useSession } from "@/app/session";

/** Memoised API client bound to the current session token getter. */
export function useApi() {
  const session = useSession();
  const api = useMemo(() => new Api(session.getToken), [session.getToken]);
  return { api, session };
}

export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads data from the API with loading + error state. No demo fallback — the
 * app is fully live. Keeps the previous value while refetching
 * (stale-while-revalidate) so switching views/lists doesn't flash empty.
 * Reads are de-duped and 60s-cached at the client (see lib/cache), so repeated
 * mounts and quick navigation never re-hit the network.
 */
export function useQuery<T>(loader: (api: Api) => Promise<T>, deps: unknown[] = []): QueryResult<T> {
  const { api, session } = useApi();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!session.isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef.current(api)
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e?.message ?? "Request failed"); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isAuthenticated, api, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
