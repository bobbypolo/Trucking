import { useState, useCallback } from "react";

/**
 * Result triple returned by useApiError.
 * - error: the last Error caught (null when clean)
 * - loading: true while the wrapped async function is in flight
 * - data: the resolved value of the last successful call (null initially)
 */
export interface ApiErrorState<T> {
  error: Error | null;
  loading: boolean;
  data: T | null;
}

/**
 * useApiError — wraps an async API call with {error, loading, data} tracking.
 *
 * On retry (calling execute again), error is auto-cleared before the new
 * request begins.  If the call succeeds, data is updated and error stays null.
 * If the call throws, error is set and data is left at its previous value.
 */
export function useApiError<T = unknown>() {
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      setError(null);
      setLoading(true);
      try {
        const result = await fn();
        setData(result);
        setLoading(false);
        return result;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        setLoading(false);
        return null;
      }
    },
    [],
  );

  return { error, loading, data, execute };
}
