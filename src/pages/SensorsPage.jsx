import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { fetchSensorFactoryOverview } from "../services/api";
import { getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";

// ─── Per-factory sensor card ──────────────────────────────────────────────────
function FactorySensorCard({ factory, onClick }) {
  const { sensor, name } = factory;
  const tempStatus  = getTempStatus(sensor.highestTemp);
  const humidStatus = getHumidityStatus(sensor.averageHumidity);
  const wbgtStatus  = getWBGTStatus(sensor.wbgt);

  return (
    <button
      type="button"
      onClick={onClick}
      className="freya-card cursor-pointer rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--freya-blue)]/40 hover:shadow-md focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--freya-blue)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em]">Factory</p>
          <p className="text-base font-bold text-[var(--text-primary)] mt-0.5">{name}</p>
        </div>
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-[4px] border ${wbgtStatus.bg} ${wbgtStatus.color}`}>
          {sensor.wbgt !== null ? `WBGT ${sensor.wbgt}°C` : "No Data"}
        </span>
      </div>

      {/* Temp + Humidity tiles */}
      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <div className={`p-3 rounded-[6px] border border-[var(--border)] ${tempStatus.bg}`}>
          <p className={`text-xl font-bold font-mono ${tempStatus.color}`}>
            {sensor.highestTemp !== null ? `${sensor.highestTemp}°C` : "—"}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Peak Temp</p>
        </div>
        <div className={`p-3 rounded-[6px] border border-[var(--border)] ${humidStatus.bg}`}>
          <p className={`text-xl font-bold font-mono ${humidStatus.color}`}>
            {sensor.averageHumidity !== null ? `${sensor.averageHumidity}%` : "—"}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Avg Humidity</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sensors</span>
          <span>{sensor.sensorCount} device{sensor.sensorCount !== 1 ? "s" : ""}</span>
          {sensor.offlineCount > 0 ? (
            <>
              <span className="text-[var(--text-muted)]">|</span>
              <span className="font-semibold text-[var(--status-danger)]">
                {sensor.offlineCount} offline
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-[var(--freya-blue)] font-semibold text-xs">
          <span>Details</span>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
        </div>
      </div>
    </button>
  );
}

// ─── Global summary strip ─────────────────────────────────────────────────────
function SummaryStrip({ factories }) {
  const active     = factories.filter((f) => f.sensor.hasData);
  const totalDev   = factories.reduce((s, f) => s + (f.sensor.sensorCount ?? 0), 0);
  const temps      = factories.map((f) => f.sensor.highestTemp).filter((v) => v !== null);
  const globalPeak = temps.length ? Math.max(...temps) : null;
  const alerts     = factories.filter(
    (f) => f.sensor.wbgt !== null && f.sensor.wbgt > 28
  ).length;

  const tiles = [
    { label: "Factories Online", value: `${active.length} / ${factories.length}`, icon: "factory", color: "text-[var(--freya-blue)]" },
    { label: "Total Devices",    value: totalDev,                                  icon: "sensors",  color: "text-[var(--text-secondary)]" },
    { label: "Global Peak Temp", value: globalPeak !== null ? `${globalPeak}°C` : "—", icon: "thermostat", color: getTempStatus(globalPeak).color },
    { label: "Heat Stress Alerts", value: alerts, icon: "warning",                color: alerts > 0 ? "text-[var(--status-danger)]" : "text-[var(--text-muted)]" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {tiles.map(({ label, value, icon, color }) => (
        <div key={label} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`material-symbols-outlined ${color}`} style={{ fontSize: 16 }}>{icon}</span>
            <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">{label}</p>
          </div>
          <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SensorsPage() {
  const navigate  = useNavigate();
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Sensor `Date` fields are JST; call with no arg so the JST-aware
      // default in fetchSensorFactoryOverview is used instead of UTC "today".
      const result = await fetchSensorFactoryOverview();
      setFactories(Array.isArray(result) ? result : []);
    } catch (loadError) {
      setFactories([]);
      setError(loadError.message || "Failed to load factory sensor data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withData    = factories.filter((f) => f.sensor.hasData);
  const withoutData = factories.filter((f) => !f.sensor.hasData);

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <PageHeader
        title={(
          <>
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
            Factory Sensors
          </>
        )}
        titleClassName="flex items-center gap-2.5"
        subtitle="Live temperature & humidity monitoring across all facilities"
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={(
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}
              style={{ fontSize: 16 }}
            >
              refresh
            </span>
            Refresh
          </button>
        )}
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <SummaryStrip factories={factories} />
      )}

      {!loading && error ? (
        <div className="mb-6 rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 p-4 text-xs font-medium text-[var(--status-danger)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Active factories ── */}
          {withData.length > 0 && (
            <div className="mb-6">
              <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em] mb-3">
                {withData.length} Active Facility Sensor{withData.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {withData.map((f) => (
                  <FactorySensorCard
                    key={f.name}
                    factory={f}
                    onClick={() => navigate(`/sensors/${encodeURIComponent(f.name)}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── No data ── */}
          {withoutData.length > 0 && (
            <div>
              <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em] mb-3">
                {withoutData.length} Facilities Without Recent Data
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {withoutData.map((f) => (
                  <div
                    key={f.name}
                    onClick={() => navigate(`/sensors/${encodeURIComponent(f.name)}`)}
                    className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5 opacity-60 cursor-pointer hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="material-symbols-outlined text-[var(--text-muted)]">sensors_off</span>
                      <p className="font-bold text-sm text-[var(--text-primary)]">{f.name}</p>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">No sensor data today</p>
                    <p className="text-[11px] text-[var(--freya-blue)] font-medium mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                      View historical data
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {factories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-4xl">sensors_off</span>
              <p className="text-xs">No factories found</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
