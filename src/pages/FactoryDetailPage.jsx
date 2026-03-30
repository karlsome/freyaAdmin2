import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchProductionData, fetchSensorData, fetchEnvironmentalData } from "../services/api";
import {
  getDefectStatus, getTempStatus, getHumidityStatus,
  getCO2Status, getWBGTStatus,
} from "../utils/statusHelpers";

const PROCESS_LABELS = { kensaDB: "Kensa", pressDB: "Press", slitDB: "Slit", SRSDB: "SRS" };

function MetricChip({ label, value, sub, color = "text-on-surface" }) {
  return (
    <div className="glass-card rounded-2xl px-5 py-4 flex flex-col gap-1">
      <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
      <p className="text-xs font-bold text-on-surface-variant">{label}</p>
      {sub && <p className="text-[10px] text-outline">{sub}</p>}
    </div>
  );
}

function EnvRow({ icon, label, value, status }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${status.bg}`}>
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined ${status.color}`} style={{ fontSize: 18 }}>{icon}</span>
        <span className={`text-sm font-bold ${status.color}`}>{label}</span>
      </div>
      <span className={`text-sm font-black ${status.color}`}>{value ?? "—"}</span>
    </div>
  );
}

export default function FactoryDetailPage() {
  const { factoryName: encoded } = useParams();
  const factoryName = decodeURIComponent(encoded);
  const navigate = useNavigate();

  const [prod,   setProd]   = useState(null);
  const [sensor, setSensor] = useState(null);
  const [env,    setEnv]    = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchProductionData(factoryName, today),
      fetchSensorData(factoryName, today),
      fetchEnvironmentalData(factoryName),
    ]).then(([p, s, e]) => {
      if (p.status === "fulfilled") setProd(p.value);
      if (s.status === "fulfilled") setSensor(s.value);
      if (e.status === "fulfilled") setEnv(e.value);
      setLoading(false);
    });
  }, [factoryName, today]);

  const defectStatus = getDefectStatus(prod?.defectRate ?? 0);

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-on-surface">{factoryName}</h2>
            {!loading && (
              <span className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full ${defectStatus.bg} ${defectStatus.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${defectStatus.dot}`} />
                {defectStatus.label}
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-sm mt-1">{today} — Factory Detail View</p>
        </div>
        <button
          onClick={() => navigate(`/sensors/${encoded}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold kinetic-gradient text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
          Sensor History
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Summary strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricChip label="Total Units" value={(prod?.total ?? 0).toLocaleString()} />
            <MetricChip label="NG Units" value={(prod?.totalNG ?? 0).toLocaleString()} color="text-error" />
            <MetricChip
              label="Defect Rate"
              value={`${(prod?.defectRate ?? 0).toFixed(2)}%`}
              color={defectStatus.valueColor}
            />
            <MetricChip
              label="Sensors Online"
              value={sensor?.sensorCount ?? 0}
              sub={sensor?.hasData ? "Live data" : "No live data"}
              color={sensor?.hasData ? "text-emerald-400" : "text-outline"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* ── Environmental card ── */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>cloud</span>
                Environmental
                {env?.isDefault && (
                  <span className="ml-auto text-[10px] text-outline font-normal">Simulated</span>
                )}
              </h3>
              <div className="space-y-2">
                <EnvRow
                  icon="thermometer"
                  label={`Temp — ${env?.temperature ?? "—"}°C`}
                  value={env?.coordinateSource ?? null}
                  status={getTempStatus(env?.temperature)}
                />
                <EnvRow
                  icon="water_drop"
                  label={`Humidity — ${env?.humidity ?? "—"}%`}
                  value={null}
                  status={getHumidityStatus(env?.humidity)}
                />
                <EnvRow
                  icon="eco"
                  label={`CO₂ — ${env?.co2 ?? "—"} ppm`}
                  value={null}
                  status={getCO2Status(env?.co2)}
                />
              </div>
            </div>

            {/* ── Sensor summary card ── */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 18 }}>sensors</span>
                Physical Sensors
              </h3>
              {sensor?.hasData ? (
                <div className="space-y-2">
                  <EnvRow
                    icon="thermometer"
                    label={`Peak Temp — ${sensor.highestTemp}°C`}
                    value={null}
                    status={getTempStatus(sensor.highestTemp)}
                  />
                  <EnvRow
                    icon="water_drop"
                    label={`Avg Humidity — ${sensor.averageHumidity}%`}
                    value={null}
                    status={getHumidityStatus(sensor.averageHumidity)}
                  />
                  <EnvRow
                    icon="wb_sunny"
                    label={`WBGT — ${sensor.wbgt}°C`}
                    value={getWBGTStatus(sensor.wbgt).label}
                    status={getWBGTStatus(sensor.wbgt)}
                  />
                  <button
                    onClick={() => navigate(`/sensors/${encoded}`)}
                    className="w-full mt-2 py-2 text-xs font-bold text-primary hover:text-on-surface transition-colors text-center"
                  >
                    View all sensor readings →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-outline">
                  <span className="material-symbols-outlined text-3xl">sensors_off</span>
                  <p className="text-xs">No live sensor data today</p>
                </div>
              )}
            </div>

            {/* ── Defect breakdown by process ── */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>bug_report</span>
                By Process
              </h3>
              {prod?.records?.length ? (
                <div className="space-y-2">
                  {Object.entries(PROCESS_LABELS).map(([col, label]) => {
                    const rows = prod.records.filter((r) => r._source === col);
                    if (!rows.length) return null;
                    const t   = rows.reduce((s, r) => s + (Number(r.Total)    || 0), 0);
                    const ng  = rows.reduce((s, r) => s + (Number(r.Total_NG) || 0), 0);
                    const pct = t > 0 ? Math.round((ng / t) * 10000) / 100 : 0;
                    return (
                      <div key={col}>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-outline mb-1">
                          <span>{label}</span>
                          <span>{pct}% NG</span>
                        </div>
                        <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 2 ? "bg-error" : pct >= 1.5 ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, pct * 20)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-outline text-xs">
                  No production records today
                </div>
              )}
            </div>
          </div>

          {/* ── Production records table ── */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface">Production Records — {today}</h3>
              <span className="text-[10px] text-outline font-bold uppercase tracking-wider">
                {prod?.records?.length ?? 0} records
              </span>
            </div>
            {prod?.records?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-outline uppercase tracking-widest text-left">
                      {["Process", "品番", "Worker", "Total", "NG", "Defect %", "Time"].map((h) => (
                        <th key={h} className="pb-3 pr-6 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-transparent">
                    {prod.records.map((r, i) => {
                      const t   = Number(r.Total)    || 0;
                      const ng  = Number(r.Total_NG) || 0;
                      const pct = t > 0 ? ((ng / t) * 100).toFixed(2) : "—";
                      const ds  = getDefectStatus(Number(pct) || 0);
                      return (
                        <tr key={i} className="hover:bg-surface-container transition-colors">
                          <td className="py-2.5 pr-6">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                              {PROCESS_LABELS[r._source] ?? r._source}
                            </span>
                          </td>
                          <td className="py-2.5 pr-6 font-mono text-on-surface">{r["品番"] ?? "—"}</td>
                          <td className="py-2.5 pr-6 text-on-surface-variant">{r.Worker_Name ?? "—"}</td>
                          <td className="py-2.5 pr-6 font-bold text-on-surface">{t.toLocaleString()}</td>
                          <td className="py-2.5 pr-6 font-bold text-error">{ng}</td>
                          <td className={`py-2.5 pr-6 font-bold ${ds.valueColor}`}>{pct}%</td>
                          <td className="py-2.5 pr-6 text-outline">{r.Time_start ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-outline text-sm">
                No production records found for today
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
