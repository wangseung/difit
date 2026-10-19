import { useEffect } from 'react';

import { resolveEventSourceUrl } from '../utils/eventSourceUrl';

const PING_INTERVAL_MS = 30_000;

// Short pings instead of a long-lived SSE so open tabs don't hold connections (browsers cap ~6 per host).
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const clientId = crypto.randomUUID();
    const ping = () => {
      void fetch(resolveEventSourceUrl('/api/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
        keepalive: true,
      }).catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    const onPageHide = () => {
      navigator.sendBeacon(resolveEventSourceUrl('/api/heartbeat/close'), clientId);
    };

    ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', ping);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', ping);
      window.removeEventListener('pagehide', onPageHide);
      onPageHide();
    };
  }, [enabled]);
}
