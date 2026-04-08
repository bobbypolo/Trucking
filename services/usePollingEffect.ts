import { useEffect } from "react";

/**
 * Calls fn immediately on mount with an AbortSignal, then repeats every
 * intervalMs. Clears the interval and aborts the last signal on unmount.
 */
export function usePollingEffect(
  fn: (signal: AbortSignal) => void | Promise<void>,
  intervalMs: number,
  deps: React.DependencyList,
): void {
  useEffect(() => {
    let controller = new AbortController();
    fn(controller.signal);
    const id = setInterval(() => {
      controller.abort();
      controller = new AbortController();
      fn(controller.signal);
    }, intervalMs);
    return () => {
      clearInterval(id);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
