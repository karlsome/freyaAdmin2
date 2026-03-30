import {
  getDefectStatus,
  getTempStatus,
  getHumidityStatus,
  getCO2Status,
  getWBGTStatus,
} from "../utils/statusHelpers";

// ─── Env metric cell ──────────────────────────────────────────────────────────
function EnvCell({ icon, value, label, status }) {
  const isNull = value === null || value === undefined;
  return (
    <div className={`text-center p-2 rounded-xl ${isNull ? "bg-surface-container" : status.bg}`}>
      <span className={`material-symbols-outlined block mb-0.5 ${isNull ? "text-outline" : status.color}`} style={{ fontSize: 18 }}>
        {icon}
      </span>
      <div className={`font-bold text-xs ${isNull ? "text-outline" : status.color}`}>
        {isNull ? "—" : value}
      </div>
      <div className="text-[10px] text-on-surface-variant mt-0.5">{label}</div>
    </div>
  );
}

// ─── Sensor metric cell ───────────────────────────────────────────────────────
function SensorCell({ icon, value, unit, label, status }) {
  const isNull = value === null || value === undefined;
  return (
    <div className={`text-center p-2 rounded-xl ${isNull ? "bg-surface-container" : status.bg}`}>
      <span className={`material-symbols-outlined block mb-0.5 ${isNull ? "text-outline" : status.color}`} style={{ fontSize: 18 }}>
        {icon}
      </span>
      <div className={`font-bold text-xs ${isNull ? "text-outline" : status.color}`}>
        {isNull ? "—" : `${value}${unit}`}
      </div>
      <div className="text-[10px] text-on-surface-variant mt-0.5">{label}</div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────
export default function FactoryCard({ factory, onClick }) {
  const { name, total, totalNG, defectRate, env, sensor } = factory;

  const defectStatus = getDefectStatus(defectRate);
  const tempStatus   = getTempStatus(env.temperature);
  const humidStatus  = getHumidityStatus(env.humidity);
  const co2Status    = getCO2Status(env.co2);
  const wbgtStatus   = getWBGTStatus(sensor.wbgt);
  const sensorTempStatus = getTempStatus(sensor.highestTemp);
  const sensorHumStatus  = getHumidityStatus(sensor.averageHumidity);

  const sourceIcon =
    env.coordinateSource === "geotag"
      ? "my_location"
      : env.coordinateSource === "coordinates"
      ? "location_on"
      : "public";

  const updatedTime = env.timestamp
    ? new Date(env.timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      onClick={onClick}
      className="glass-card rounded-2xl p-5 flex flex-col gap-4 cursor-pointer hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-on-surface leading-tight">{name}</h4>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {total.toLocaleString()} units today
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${defectStatus.bg} ${defectStatus.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${defectStatus.dot}`}></span>
          {defectStatus.label}
        </span>
      </div>

      {/* ── Production stats ── */}
      <div className="grid grid-cols-3 gap-2 border-b border-outline-variant/40 pb-4">
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Total</p>
          <p className="text-sm font-black text-on-surface">{total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">NG</p>
          <p className="text-sm font-black text-on-surface">{totalNG.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Defect</p>
          <p className={`text-sm font-black ${defectStatus.valueColor}`}>{defectRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* ── Environmental data ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Environmental</p>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-full hover:bg-surface-container text-outline hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
          </button>
        </div>

        {env.isDefault ? (
          <div className="text-center py-3 text-[11px] text-outline bg-surface-container rounded-xl">
            No environmental data
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <EnvCell
                icon="thermometer"
                value={env.temperature !== null ? `${env.temperature}°C` : null}
                label="Temp"
                status={tempStatus}
              />
              <EnvCell
                icon="water_drop"
                value={env.humidity !== null ? `${env.humidity}%` : null}
                label="Humidity"
                status={humidStatus}
              />
              <EnvCell
                icon="eco"
                value={env.co2 !== null ? `${env.co2}` : null}
                label="CO₂ ppm"
                status={co2Status}
              />
            </div>
            <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-outline">
              {updatedTime && (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>schedule</span>
                  <span>{updatedTime}</span>
                </>
              )}
              {env.coordinateSource && (
                <>
                  <span className="mx-1">•</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{sourceIcon}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Physical sensors ── */}
      {sensor.hasData ? (
        <div className="border-t border-outline-variant/40 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              Physical Sensors
            </p>
            <span className="flex items-center gap-1 text-[10px] text-primary font-bold">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>sensors</span>
              {sensor.sensorCount}
            </span>
          </div>
          <div
            className="grid grid-cols-3 gap-2 p-2 rounded-xl border border-outline-variant/40 hover:border-primary/30 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <SensorCell icon="thermometer" value={sensor.highestTemp} unit="°C" label="Peak Temp" status={sensorTempStatus} />
            <SensorCell icon="water_drop" value={sensor.averageHumidity} unit="%" label="Avg Humid" status={sensorHumStatus} />
            <SensorCell icon="wb_sunny" value={sensor.wbgt} unit="°C" label="WBGT" status={wbgtStatus} />
          </div>
          <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-outline hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>visibility</span>
            <span>View sensor details</span>
          </div>
        </div>
      ) : sensor.hasHistorical ? (
        <div className="border-t border-outline-variant/40 pt-3">
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-outline-variant/40 hover:border-primary/30 hover:bg-primary/5 text-outline hover:text-primary transition-all text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>history</span>
            View Temperature History
          </button>
        </div>
      ) : null}
    </div>
  );
}
