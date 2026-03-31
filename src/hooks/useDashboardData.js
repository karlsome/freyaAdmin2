import { useState, useEffect, useCallback } from "react";
import {
  fetchMasterFactories,
  fetchProductionData,
  fetchSensorData,
  fetchEnvironmentalData,
} from "../services/api";

// ─── Derive top-5 defect parts from raw production records ──────────────────
function computeTopDefects(records = []) {
  const map = new Map();
  records.forEach((r) => {
    const key = r["背番号"] ?? "—";
    if (!map.has(key)) map.set(key, { sebanggo: key, total: 0, ng: 0, worstRecord: null });
    const entry = map.get(key);
    entry.total += Number(r.Total)    || 0;
    entry.ng    += Number(r.Total_NG) || 0;
    // Keep the record with the highest NG count as the representative record
    if ((Number(r.Total_NG) || 0) > (Number(entry.worstRecord?.Total_NG) || 0)) {
      entry.worstRecord = r;
    }
  });
  return Array.from(map.values())
    .filter((d) => d.ng > 0)
    .map((d) => ({
      ...d,
      defectRate: d.total > 0 ? Math.round((d.ng / d.total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.ng - a.ng)
    .slice(0, 5);
}

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

          // Kensa-only stats for the card header
          const kensaRecords = (p?.records ?? []).filter((r) => r._source === "kensaDB");
          let kensaTotal = 0, kensaTotalNG = 0;
          kensaRecords.forEach((r) => {
            kensaTotal   += Number(r.Total)    || 0;
            kensaTotalNG += Number(r.Total_NG) || 0;
          });
          const kensaDefectRate = kensaTotal > 0
            ? Math.round((kensaTotalNG / kensaTotal) * 10000) / 100
            : 0;

          return {
            name,
            total:       kensaTotal,
            totalNG:     kensaTotalNG,
            defectRate:  kensaDefectRate,
            topDefects:  computeTopDefects(p?.records ?? []),
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
