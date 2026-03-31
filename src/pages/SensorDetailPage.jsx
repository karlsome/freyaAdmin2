import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchHistoricalSensorData, calcWBGT } from "../services/api";
import { getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";
import SensorTrendChart from "../components/SensorTrendChart";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseTemp(v) { return parseFloat(String(v ?? "").replace("°C", "").trim()); }
function parseHumid(v) { return parseFloat(String(v ?? "").replace("%", "").trim()); }

function toISO(d) { return d.toISOString().split("T")[0]; }

function dateRangeDefault() {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start: toISO(start), end: toISO(end) };
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(rows, factoryName) {
  const headers = ["Date", "Time", "Device", "Temperature_C", "Humidity_pct", "WBGT_C", "Status", "Factory"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.Date, r.Time, r.device, parseTemp(r.Temperature), parseHumid(r.Humidity),
       calcWBGT(parseTemp(r.Temperature), parseHumid(r.Humidity)) ?? "",
       r.sensorStatus ?? "OK", r["工場"] ?? factoryName,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `sensors_${factoryName}_${toISO(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Mini sparkline (SVG) ─────────────────────────────────────────────────────
function Sparkline({ values, color = "#6366f1", height = 28 }) {
  if (!values?.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4)}`)
    .join(" ");
  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Per-device summary card ──────────────────────────────────────────────────
function SensorCard({ deviceId, readings }) {
  const temps  = readings.map((r) => parseTemp(r.Temperature)).filter((t) => !isNaN(t));
  const humids = readings.map((r) => parseHumid(r.Humidity)).filter((h) => !isNaN(h));
  const latest = readings[0];
  const latestTemp  = temps[0]  ?? null;
  const latestHumid = humids[0] ?? null;
  const wbgt = calcWBGT(latestTemp, latestHumid);
  const tempStatus = getTempStatus(latestTemp);
  const wbgtStatus = getWBGTStatus(wbgt);

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 hover:scale-[1.02] transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-outline uppercase tracking-widest">Device</p>
          <p className="text-base font-black text-on-surface">{deviceId}</p>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${wbgtStatus.bg} ${wbgtStatus.color}`}>
          WBGT {wbgt ?? "—"}°C
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-xl ${tempStatus.bg}`}>
          <p className={`text-lg font-black ${tempStatus.color}`}>{latestTemp ?? "—"}°C</p>
          <p className="text-[10px] text-on-surface-variant">Temperature</p>
          <Sparkline values={temps.slice(0, 20).reverse()} color={latestTemp >= 30 ? "#f87171" : "#6366f1"} />
        </div>
        <div className={`p-3 rounded-xl ${getHumidityStatus(latestHumid).bg}`}>
          <p className={`text-lg font-black ${getHumidityStatus(latestHumid).color}`}>{latestHumid ?? "—"}%</p>
          <p className="text-[10px] text-on-surface-variant">Humidity</p>
          <Sparkline values={humids.slice(0, 20).reverse()} color="#22d3ee" />
        </div>
      </div>

      <div className="text-[10px] text-outline">
        Last: {latest?.Date} {latest?.Time} · {readings.length} readings
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SensorDetailPage() {
  const { factoryName: encoded } = useParams();
  const factoryName = decodeURIComponent(encoded);
  const navigate    = useNavigate();

  const [range, setRange]       = useState(dateRangeDefault);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [rawData, setRawData]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sortKey, setSortKey]   = useState("date_desc");

  useEffect(() => {
    setLoading(true);
    fetchHistoricalSensorData(factoryName, range.start, range.end)
      .then((data) => { setRawData(data ?? []); setLoading(false); });
  }, [factoryName, range.start, range.end]);

  const devices = useMemo(() => {
    const ids = [...new Set(rawData.map((r) => r.device).filter(Boolean))];
    return ids.sort();
  }, [rawData]);

  const filtered = useMemo(() => {
    let rows = deviceFilter === "all" ? rawData : rawData.filter((r) => r.device === deviceFilter);
    if (sortKey === "date_desc") rows = [...rows].sort((a, b) => `${b.Date} ${b.Time}`.localeCompare(`${a.Date} ${a.Time}`));
    if (sortKey === "date_asc")  rows = [...rows].sort((a, b) => `${a.Date} ${a.Time}`.localeCompare(`${b.Date} ${b.Time}`));
    if (sortKey === "temp_desc") rows = [...rows].sort((a, b) => parseTemp(b.Temperature) - parseTemp(a.Temperature));
    if (sortKey === "temp_asc")  rows = [...rows].sort((a, b) => parseTemp(a.Temperature) - parseTemp(b.Temperature));
    return rows;
  }, [rawData, deviceFilter, sortKey]);

  // Group by device for summary cards
  const byDevice = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      const id = r.device ?? "unknown";
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(r);
    });
    return map;
  }, [filtered]);

  // KPI stats over the filtered range
  const sensorKPIs = useMemo(() => {
    const temps  = filtered.map((r) => parseTemp(r.Temperature)).filter((v) => !isNaN(v));
    const humids = filtered.map((r) => parseHumid(r.Humidity)).filter((v) => !isNaN(v));
    const round1 = (n) => Math.round(n * 10) / 10;
    const avgTemp   = temps.length  ? round1(temps.reduce((s, v)  => s + v, 0)  / temps.length)  : null;
    const peakTemp  = temps.length  ? Math.max(...temps)  : null;
    const minTemp   = temps.length  ? Math.min(...temps)  : null;
    const avgHumid  = humids.length ? round1(humids.reduce((s, v) => s + v, 0) / humids.length) : null;
    const heatAlerts = filtered.filter((r) => {
      const wbgt = calcWBGT(parseTemp(r.Temperature), parseHumid(r.Humidity));
      return wbgt !== null && wbgt > 28;
    }).length;
    return { avgTemp, peakTemp, minTemp, avgHumid, heatAlerts };
  }, [filtered]);

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary">sensors</span>
            {factoryName} — Sensor Data
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {range.start} → {range.end} · {filtered.length.toLocaleString()} readings
          </p>
        </div>
        <button
          onClick={() => exportCSV(filtered, factoryName)}
          disabled={!filtered.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all disabled:opacity-40"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export CSV
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider">From</span>
          <input
            type="date"
            value={range.start}
            max={range.end}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider">To</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            max={toISO(new Date())}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Device</span>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="all">All Devices</option>
            {devices.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="date_desc">Latest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="temp_desc">Temp High → Low</option>
            <option value="temp_asc">Temp Low → High</option>
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          {["7d", "14d", "30d"].map((preset) => {
            const days = parseInt(preset);
            const s = new Date(); s.setDate(s.getDate() - (days - 1));
            return (
              <button
                key={preset}
                onClick={() => setRange({ start: toISO(s), end: toISO(new Date()) })}
                className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary text-outline transition-colors"
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Avg Temperature",
                value: sensorKPIs.avgTemp !== null ? `${sensorKPIs.avgTemp}°C` : "—",
                sub: sensorKPIs.minTemp !== null ? `Min ${sensorKPIs.minTemp}°C` : null,
                icon: "thermostat",
                color: getTempStatus(sensorKPIs.avgTemp).color,
                bg: getTempStatus(sensorKPIs.avgTemp).bg,
              },
              {
                label: "Peak Temperature",
                value: sensorKPIs.peakTemp !== null ? `${sensorKPIs.peakTemp}°C` : "—",
                sub: null,
                icon: "device_thermostat",
                color: getTempStatus(sensorKPIs.peakTemp).color,
                bg: getTempStatus(sensorKPIs.peakTemp).bg,
              },
              {
                label: "Avg Humidity",
                value: sensorKPIs.avgHumid !== null ? `${sensorKPIs.avgHumid}%` : "—",
                sub: null,
                icon: "water_drop",
                color: getHumidityStatus(sensorKPIs.avgHumid).color,
                bg: getHumidityStatus(sensorKPIs.avgHumid).bg,
              },
              {
                label: "Heat Stress Alerts",
                value: sensorKPIs.heatAlerts,
                sub: sensorKPIs.heatAlerts > 0 ? "WBGT > 28°C" : "All clear",
                icon: "warning",
                color: sensorKPIs.heatAlerts > 0 ? "text-error" : "text-outline",
                bg: sensorKPIs.heatAlerts > 0 ? "bg-error/10" : "bg-surface-container",
              },
            ].map(({ label, value, sub, icon, color, bg }) => (
              <div key={label} className={`rounded-2xl p-5 border border-outline-variant/10 ${bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`material-symbols-outlined ${color}`} style={{ fontSize: 16 }}>{icon}</span>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">{label}</p>
                </div>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                {sub && <p className="text-[10px] text-outline mt-1">{sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Trend charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            <div className="glass-card rounded-2xl p-5">
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 14 }}>thermostat</span>
                Temperature Trend (daily avg)
              </p>
              <SensorTrendChart readings={filtered} type="temp" height={180} />
            </div>
            <div className="glass-card rounded-2xl p-5">
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 14 }}>water_drop</span>
                Humidity Trend (daily avg)
              </p>
              <SensorTrendChart readings={filtered} type="humid" height={180} />
            </div>
          </div>

          {/* ── Device summary cards ── */}
          {byDevice.size > 0 && (
            <div className="mb-8">
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest mb-4">
                {byDevice.size} Device{byDevice.size !== 1 ? "s" : ""} — Latest Readings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from(byDevice.entries()).map(([id, readings]) => (
                  <SensorCard key={id} deviceId={id} readings={readings} />
                ))}
              </div>
            </div>
          )}

          {/* ── Records table ── */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface">All Readings</h3>
              <span className="text-[10px] text-outline font-bold uppercase tracking-wider">
                {filtered.length.toLocaleString()} rows
              </span>
            </div>
            {filtered.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-outline uppercase tracking-widest text-left border-b border-outline-variant/20">
                      {["Date", "Time", "Device", "Temp", "Humidity", "WBGT", "Status"].map((h) => (
                        <th key={h} className="pb-3 pr-6 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 500).map((r, i) => {
                      const t  = parseTemp(r.Temperature);
                      const h  = parseHumid(r.Humidity);
                      const wbgt   = calcWBGT(t, h);
                      const ts = getTempStatus(t);
                      const ws = getWBGTStatus(wbgt);
                      return (
                        <tr key={i} className="hover:bg-surface-container transition-colors border-b border-outline-variant/10">
                          <td className="py-2.5 pr-6 text-on-surface-variant">{r.Date}</td>
                          <td className="py-2.5 pr-6 text-on-surface-variant">{r.Time}</td>
                          <td className="py-2.5 pr-6 font-mono text-on-surface">{r.device}</td>
                          <td className={`py-2.5 pr-6 font-bold ${ts.color}`}>{isNaN(t) ? "—" : `${t}°C`}</td>
                          <td className={`py-2.5 pr-6 font-bold ${getHumidityStatus(h).color}`}>{isNaN(h) ? "—" : `${h}%`}</td>
                          <td className={`py-2.5 pr-6 font-bold ${ws.color}`}>{wbgt ?? "—"}°C</td>
                          <td className="py-2.5 pr-6">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ws.bg} ${ws.color}`}>
                              {r.sensorStatus ?? "OK"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length > 500 && (
                  <p className="text-center text-[10px] text-outline mt-4">
                    Showing 500 of {filtered.length.toLocaleString()} — use Export CSV for full data
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-outline">
                <span className="material-symbols-outlined text-3xl">search_off</span>
                <p className="text-xs">No sensor data found for this range</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
