import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { fetchSensorFactoryOverview } from "../services/api";
import { getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";
import { useLanguage } from "../contexts/LanguageContext";

// ─── Per-factory sensor card ──────────────────────────────────────────────────
function FactorySensorCard({ factory, onClick }) {
  const { t } = useLanguage();
  const { sensor, name } = factory;
  const tempStatus  = getTempStatus(sensor.highestTemp);
  const humidStatus = getHumidityStatus(sensor.averageHumidity);
  const wbgtStatus  = getWBGTStatus(sensor.wbgt);

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card cursor-pointer rounded-2xl p-5 text-left transition-[box-shadow,border-color,background-color] duration-300 hover:border-primary/20 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold text-outline uppercase tracking-[0.18em]">{t("factory")}</p>
          <p className="text-lg font-semibold text-on-surface">{name}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${wbgtStatus.bg} ${wbgtStatus.color}`}>
          {sensor.wbgt !== null ? `WBGT ${sensor.wbgt}°C` : t("noDataShort")}
        </span>
      </div>

      {/* Temp + Humidity tiles */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`p-3 rounded-xl ${tempStatus.bg}`}>
          <p className={`text-xl font-semibold ${tempStatus.color}`}>
            {sensor.highestTemp !== null ? `${sensor.highestTemp}°C` : "—"}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">{t("peakTempLabel")}</p>
        </div>
        <div className={`p-3 rounded-xl ${humidStatus.bg}`}>
          <p className={`text-xl font-semibold ${humidStatus.color}`}>
            {sensor.averageHumidity !== null ? `${sensor.averageHumidity}%` : "—"}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">{t("avgHumidityLabel")}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-outline">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sensors</span>
          <span>{t("deviceCountSuffix", { count: sensor.sensorCount, plural: sensor.sensorCount !== 1 ? "s" : "" })}</span>
          {sensor.offlineCount > 0 ? (
            <>
              <span className="text-outline/60">|</span>
              <span className="font-semibold text-error">
                {t("devicesOfflineSuffix", { count: sensor.offlineCount, plural: sensor.offlineCount !== 1 ? "s" : "" })}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1 text-primary font-semibold text-[11px]">
          <span>{t("detailsLabel")}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
        </div>
      </div>
    </button>
  );
}

// ─── Global summary strip ─────────────────────────────────────────────────────
function SummaryStrip({ factories }) {
  const { t } = useLanguage();
  const active     = factories.filter((f) => f.sensor.hasData);
  const totalDev   = factories.reduce((s, f) => s + (f.sensor.sensorCount ?? 0), 0);
  const temps      = factories.map((f) => f.sensor.highestTemp).filter((v) => v !== null);
  const globalPeak = temps.length ? Math.max(...temps) : null;
  const alerts     = factories.filter(
    (f) => f.sensor.wbgt !== null && f.sensor.wbgt > 28
  ).length;

  const tiles = [
    { label: t("factoriesOnlineLabel"), value: `${active.length} / ${factories.length}`, icon: "factory", color: "text-primary" },
    { label: t("totalDevicesLabel"),    value: totalDev,                                  icon: "sensors",  color: "text-tertiary" },
    { label: t("globalPeakTempLabel"), value: globalPeak !== null ? `${globalPeak}°C` : "—", icon: "thermostat", color: getTempStatus(globalPeak).color },
    { label: t("heatStressAlertsLabel"), value: alerts, icon: "warning",                color: alerts > 0 ? "text-error" : "text-outline" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {tiles.map(({ label, value, icon, color }) => (
        <div key={label} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={`material-symbols-outlined ${color}`} style={{ fontSize: 16 }}>{icon}</span>
            <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">{label}</p>
          </div>
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SensorsPage() {
  const { t } = useLanguage();
  const navigate  = useNavigate();
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await fetchSensorFactoryOverview(today);
      setFactories(Array.isArray(result) ? result : []);
    } catch (loadError) {
      setFactories([]);
      setError(loadError.message || t("failedToLoadSensorData"));
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
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        title={(
          <>
            <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
            {t("factorySensorsTitle")}
          </>
        )}
        titleClassName="flex items-center gap-3"
        subtitle={t("sensorsPageSubtitle")}
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={(
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}
              style={{ fontSize: 16 }}
            >
              refresh
            </span>
            {t("refresh")}
          </button>
        )}
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <SummaryStrip factories={factories} />
      )}

      {!loading && error ? (
        <div className="mb-6 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Active factories ── */}
          {withData.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em] mb-4">
                {t("activeSensorsHeading", { count: withData.length, plural: withData.length !== 1 ? "s" : "" })}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
              <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em] mb-4">
                {t("noRecentDataHeading", { count: withoutData.length })}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {withoutData.map((f) => (
                  <div
                    key={f.name}
                    onClick={() => navigate(`/sensors/${encodeURIComponent(f.name)}`)}
                    className="glass-card rounded-2xl p-5 opacity-50 cursor-pointer hover:opacity-75 transition-opacity"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-outline">sensors_off</span>
                      <p className="font-semibold text-on-surface">{f.name}</p>
                    </div>
                    <p className="text-xs text-outline">{t("noSensorDataToday")}</p>
                    <p className="text-[10px] text-outline mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
                      {t("viewHistoricalData")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {factories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-outline">
              <span className="material-symbols-outlined text-4xl">sensors_off</span>
              <p className="text-sm">{t("noFactoriesFound")}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
