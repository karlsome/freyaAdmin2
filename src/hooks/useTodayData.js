import { useState, useEffect, useCallback } from "react";
import { fetchTodayAllRecords, fetchMasterFactories } from "../services/api";

/**
 * Fetches all production records for today across all factories and processes.
 * Derives KPIs, issues, and per-factory summaries used by the Dashboard.
 */
export function useTodayData() {
  const [records,        setRecords]        = useState([]);
  const [factoryNames,   setFactoryNames]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [lastRefresh,    setLastRefresh]    = useState(null);

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [names, recs] = await Promise.all([
        fetchMasterFactories(),
        fetchTodayAllRecords(today),
      ]);
      setFactoryNames(names);
      setRecords(recs);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const kpis = (() => {
    let total = 0, totalNG = 0, workHours = 0, troubleHours = 0, breakHours = 0;
    records.forEach((r) => {
      total        += Number(r.Total)                ?? 0;
      totalNG      += Number(r.Total_NG)             ?? 0;
      workHours    += Number(r.Total_Work_Hours)     ?? 0;
      troubleHours += Number(r.Total_Trouble_Hours)  ?? 0;
      breakHours   += Number(r.Total_Break_Hours)    ?? 0;
    });
    const defectRate = total > 0 ? Math.round((totalNG / total) * 10000) / 100 : 0;
    return { total, totalNG, defectRate, workHours, troubleHours, breakHours, submissionCount: records.length };
  })();

  // ── Issues: records with maintenance OR high NG rate ─────────────────────
  const issues = records
    .filter((r) => {
      const hasMaintenance = Number(r.Total_Trouble_Hours) > 0;
      const recordTotal    = Number(r.Total) || 0;
      const recordNG       = Number(r.Total_NG) || 0;
      const highNG         = recordTotal > 0 && (recordNG / recordTotal) * 100 >= 2;
      return hasMaintenance || highNG;
    })
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 20);

  // ── Recent submissions ────────────────────────────────────────────────────
  const recent = [...records]
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 10);

  // ── Per-factory summary ───────────────────────────────────────────────────
  const byFactory = factoryNames.map((name) => {
    const recs = records.filter((r) => r["工場"] === name);
    let ftotal = 0, ftotalNG = 0, fTrouble = 0;
    recs.forEach((r) => {
      ftotal   += Number(r.Total)               ?? 0;
      ftotalNG += Number(r.Total_NG)            ?? 0;
      fTrouble += Number(r.Total_Trouble_Hours) ?? 0;
    });
    const defectRate = ftotal > 0 ? Math.round((ftotalNG / ftotal) * 10000) / 100 : 0;
    return { name, total: ftotal, totalNG: ftotalNG, defectRate, troubleHours: fTrouble, submissionCount: recs.length };
  });

  return { records, factoryNames, loading, error, lastRefresh, kpis, issues, recent, byFactory, refresh: load };
}
