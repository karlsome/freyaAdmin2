import { useState, useEffect, useCallback } from "react";
import {
  fetchMasterFactories,
  fetchProductionData,
  fetchFirstFactoryProduction,
  fetchSensorData,
  fetchEnvironmentalData,
} from "../services/api";

// ─── Derive top-5 defect parts from raw production records ──────────────────
function computeTopDefects(records = []) {
  const map = new Map();
  records.forEach((r) => {
    const key = r["背番号"] ?? "—";
    const ng = Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0;
    
    // Track the single worst record per part (highest NG)
    if (!map.has(key) || ng > (Number(map.get(key).worstRecord?.SRS_Total_NG) || Number(map.get(key).worstRecord?.Total_NG) || 0)) {
      map.set(key, { sebanggo: key, worstRecord: r });
    }
  });

  return Array.from(map.values())
    .map((d) => {
      const total = Number(d.worstRecord.Process_Quantity) || Number(d.worstRecord.Total) || 0;
      const ng = Number(d.worstRecord.SRS_Total_NG) || Number(d.worstRecord.Total_NG) || 0;
      return {
        sebanggo: d.sebanggo,
        total,
        ng,
        defectRate: total > 0 ? Math.round((ng / total) * 10000) / 100 : 0,
        worstRecord: d.worstRecord,
      };
    })
    .filter((d) => d.ng > 0)
    .sort((a, b) => b.ng - a.ng)
    .slice(0, 5);
}

/**
 * Fetches live dashboard data for all factories including 第一工場.
 * Replaces the static mockDashboard.js import.
 * Returns data in the shape FactoryCard expects.
 */
export function useDashboardData() {
  const [factories, setFactories] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const masterNames = await fetchMasterFactories();
      // Ensure 第一工場 is included
      const names = masterNames.includes("第一工場")
        ? masterNames
        : ["第一工場", ...masterNames];

      const settled = await Promise.allSettled(
        names.map(async (name) => {
          if (name === "第一工場") {
            const [prod, sensor, env] = await Promise.allSettled([
              fetchFirstFactoryProduction(today),
              fetchSensorData(name, today),
              fetchEnvironmentalData(name),
            ]);

            const records = prod.status === "fulfilled" && Array.isArray(prod.value) ? prod.value : [];
            const s = sensor.status === "fulfilled" ? sensor.value : null;
            const e = env.status === "fulfilled" ? env.value : null;

            let totalMeters = 0;
            let completedRolls = 0;
            let inProgressRolls = 0;
            let queuedRolls = 0;
            let manualAdvanceCount = 0;

            records.forEach((r) => {
              totalMeters += Number(r.meters) || Number(r.rollMeters) || 0;
              const st = (r.status || "").toLowerCase();
              if (st === "completed") completedRolls++;
              else if (st === "in-progress" || st === "active") inProgressRolls++;
              else queuedRolls++;

              if (r.manualAdvance) manualAdvanceCount++;
            });

            const totalRolls = records.length;
            const progressRate = totalRolls > 0 ? Math.round((completedRolls / totalRolls) * 100) : 0;

            const sortedRolls = [...records].sort((a, b) => {
              const timeA = a.endEpoch || (a.updatedAt ? new Date(a.updatedAt).getTime() : 0) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const timeB = b.endEpoch || (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return timeB - timeA;
            });

            return {
              name: "第一工場",
              isFirstFactory: true,
              processType: "PSA",
              processName: "PSA工程 (粘着・ラミネート)",
              total: totalRolls,
              totalMeters: Math.round(totalMeters * 10) / 10,
              totalRolls,
              completedRolls,
              inProgressRolls,
              queuedRolls,
              manualAdvanceCount,
              progressRate,
              totalNG: manualAdvanceCount,
              defectRate: 0,
              records,
              topRolls: sortedRolls.slice(0, 5),
              topDefects: [],
              env: e ?? {
                temperature: null, humidity: null, co2: null,
                timestamp: null, isDefault: true, coordinateSource: null,
              },
              sensor: {
                hasData: s?.hasData ?? false,
                sensorCount: s?.sensorCount ?? 0,
                highestTemp: s?.highestTemp ?? null,
                averageHumidity: s?.averageHumidity ?? null,
                wbgt: s?.wbgt ?? null,
                hasHistorical: s?.hasData ?? false,
              },
            };
          }

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
            kensaTotal   += Number(r.Process_Quantity) || Number(r.Total) || 0;
            kensaTotalNG += Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0;
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
