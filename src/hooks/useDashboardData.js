import { useState, useEffect, useCallback } from "react";
import {
  fetchMasterFactories,
  fetchProductionData,
  fetchSensorData,
  fetchEnvironmentalData,
} from "../services/api";

/**
 * Fetches live dashboard data for all factories.
 * Replaces the static mockDashboard.js import.
 * Returns data in the same shape FactoryCard expects.
 */
export function useDashboardData() {
  const [factories, setFactories] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const names = await fetchMasterFactories();

      const settled = await Promise.allSettled(
        names.map(async (name) => {
          const [prod, sensor, env] = await Promise.allSettled([
            fetchProductionData(name, today),
            fetchSensorData(name, today),
            fetchEnvironmentalData(name),
          ]);

          const p = prod.status   === "fulfilled" ? prod.value   : null;
          const s = sensor.status === "fulfilled" ? sensor.value : null;
          const e = env.status    === "fulfilled" ? env.value    : null;

          return {
            name,
            total:      p?.total      ?? 0,
            totalNG:    p?.totalNG    ?? 0,
            defectRate: p?.defectRate ?? 0,
            env: e ?? {
              temperature: null, humidity: null, co2: null,
              timestamp: null, isDefault: true, coordinateSource: null,
            },
            sensor: {
              hasData:          s?.hasData      ?? false,
              sensorCount:      s?.sensorCount  ?? 0,
              highestTemp:      s?.highestTemp  ?? null,
              averageHumidity:  s?.averageHumidity ?? null,
              wbgt:             s?.wbgt         ?? null,
              hasHistorical:    s?.hasData      ?? false,
            },
          };
        })
      );

      setFactories(settled.map((r) => r.value).filter(Boolean));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { factories, loading, error, refresh: load };
}
