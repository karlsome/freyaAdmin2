import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDigitalTwin } from "../services/digitalTwinApi";

const POLL_MS = 10_000;

/**
 * Polls the digital twin endpoint every 10 s.
 * Keeps showing the last good snapshot if a poll fails.
 */
export function useDigitalTwin(factoryName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await fetchDigitalTwin(factoryName);
      setData(next);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [factoryName]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return { data, loading, error, lastRefresh, refresh: load };
}
