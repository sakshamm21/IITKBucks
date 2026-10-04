import { useCallback, useEffect, useRef, useState } from 'react';
import { getNodeInfo, ApiError, type NodeInfo } from './api';

/**
 * Tracks node liveness and chain state.
 *
 * Polls on an interval so the UI reflects mining progress without a reload, but
 * pauses when the tab is hidden — a background tab does not need to keep the
 * network busy, and this keeps a demo from hammering the node.
 */
export function useNodeStatus(pollMs = 5000) {
  const [info, setInfo] = useState<NodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getNodeInfo();
      if (!mounted.current) return;
      setInfo(data);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(
        e instanceof ApiError && e.isNetworkError
          ? e.message
          : 'Node returned an unexpected response.'
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, pollMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted.current = false;
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, pollMs]);

  return { info, error, loading, live: info !== null && error === null, refresh };
}
