/**
 * API Service — mirrors the data-fetching logic from the original FreyaAdmin.
 *
 * Backend: Express + MongoDB at VITE_API_URL (default: http://localhost:3000/)
 *   POST /queries       → { dbName, collectionName, query, sort, limit }
 *   GET  /api/masterdb/factories
 *
 * Environmental data: Open-Meteo (free, no key required)
 * Factory coordinates: Sasaki_Coating_MasterDB / factoryDB
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000/").replace(/\/?$/, "/");

// ─── Cache ────────────────────────────────────────────────────────────────────
const _cache = new Map();
const ENV_TTL    = 10 * 60 * 1000; // 10 min
const SENSOR_TTL =  2 * 60 * 1000; // 2 min

function _getCached(key, ttl) {
  const e = _cache.get(key);
  if (e && Date.now() - e.ts < ttl) return e.data;
  return null;
}
function _setCache(key, data) { _cache.set(key, { data, ts: Date.now() }); }

// ─── Universal query helper ───────────────────────────────────────────────────
export async function query(dbName, collectionName, q, { sort, limit, projection } = {}) {
  const res = await fetch(BASE_URL + "queries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbName, collectionName, query: q, sort, limit, projection }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Factory list ─────────────────────────────────────────────────────────────
export async function fetchMasterFactories() {
  const key = "masterFactories";
  const cached = _getCached(key, ENV_TTL);
  if (cached) return cached;
  try {
    const res = await fetch(BASE_URL + "api/masterdb/factories");
    if (!res.ok) throw new Error(`API ${res.status}`);
    const result = await res.json();
    const data = Array.isArray(result) ? result : (result.data ?? []);
    _setCache(key, data);
    return data;
  } catch {
    return ["倉知", "肥田瀬", "第二工場", "天徳", "SCNA", "NFH", "小瀬"];
  }
}

// ─── Production data (aggregates all 4 process DBs) ──────────────────────────
const PROCESS_COLLECTIONS = ["kensaDB", "pressDB", "slitDB", "SRSDB"];

export async function fetchProductionData(factoryName, date) {
  const key = `prod_${factoryName}_${date}`;
  const cached = _getCached(key, SENSOR_TTL);
  if (cached) return cached;

  const settled = await Promise.allSettled(
    PROCESS_COLLECTIONS.map((col) =>
      query("submittedDB", col, { 工場: factoryName, Date: date }, { sort: { Time_start: -1 } })
    )
  );

  const records = settled.flatMap((r, i) =>
    r.status === "fulfilled" ? r.value.map((row) => ({ ...row, _source: PROCESS_COLLECTIONS[i] })) : []
  );

  let total = 0, totalNG = 0;
  records.forEach((r) => {
    total   += Number(r.Total)    || 0;
    totalNG += Number(r.Total_NG) || 0;
  });
  const defectRate = total > 0 ? Math.round((totalNG / total) * 10000) / 100 : 0;

  const data = { records, total, totalNG, defectRate };
  _setCache(key, data);
  return data;
}

// ─── Sensor data (tempHumidityDB) ─────────────────────────────────────────────
export function calcWBGT(temperature, humidity) {
  try {
    const T  = parseFloat(temperature);
    const RH = parseFloat(humidity);
    if (isNaN(T) || isNaN(RH) || T < -50 || T > 60 || RH < 0 || RH > 100) return null;
    const Tw =
      T  * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
      Math.atan(T + RH) -
      Math.atan(RH - 1.676331) +
      0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) -
      4.686035;
    return Math.round((0.7 * Tw + 0.3 * T) * 10) / 10;
  } catch {
    return null;
  }
}

function _parseSensorReadings(readings) {
  const sensorMap = new Map();
  readings.forEach((r) => {
    const id = r.device;
    const rTime = new Date(`${r.Date} ${r.Time}`);
    const existing = sensorMap.get(id);
    if (!existing || rTime > new Date(`${existing.Date} ${existing.Time}`)) {
      sensorMap.set(id, r);
    }
  });

  const sensors = Array.from(sensorMap.values()).map((r) => ({
    deviceId:    r.device,
    temperature: parseFloat(String(r.Temperature ?? "").replace("°C", "").trim()),
    humidity:    parseFloat(String(r.Humidity    ?? "").replace("%",  "").trim()),
    status:      r.sensorStatus ?? "OK",
    lastUpdate:  `${r.Date} ${r.Time}`,
    factory:     r["工場"],
  }));

  const temps  = sensors.map((s) => s.temperature).filter((t) => !isNaN(t));
  const humids = sensors.map((s) => s.humidity).filter((h) => !isNaN(h));

  const highestTemp     = temps.length  ? Math.max(...temps)  : null;
  const averageHumidity = humids.length
    ? Math.round((humids.reduce((a, b) => a + b, 0) / humids.length) * 10) / 10
    : null;

  const wbgtVals = sensors.map((s) => calcWBGT(s.temperature, s.humidity)).filter((v) => v !== null);
  const wbgt = wbgtVals.length ? Math.max(...wbgtVals) : null;

  return { sensors, highestTemp, averageHumidity, wbgt, sensorCount: sensors.length, hasData: sensors.length > 0 };
}

export async function fetchSensorData(factoryName, date) {
  const key = `sensor_${factoryName}_${date}`;
  const cached = _getCached(key, SENSOR_TTL);
  if (cached) return cached;

  const empty = { sensors: [], highestTemp: null, averageHumidity: null, wbgt: null, sensorCount: 0, hasData: false };
  try {
    const readings = await query(
      "submittedDB", "tempHumidityDB",
      { 工場: factoryName, Date: date },
      { sort: { Time: -1 }, limit: 200 }
    );
    if (!readings?.length) { _setCache(key, empty); return empty; }
    const data = _parseSensorReadings(readings);
    _setCache(key, data);
    return data;
  } catch {
    return empty;
  }
}

// ─── Historical sensor data (for SensorDetailPage) ───────────────────────────
export async function fetchHistoricalSensorData(factoryName, startDate, endDate) {
  try {
    return await query(
      "submittedDB", "tempHumidityDB",
      { 工場: factoryName, Date: { $gte: startDate, $lte: endDate } },
      { sort: { Date: -1, Time: -1 }, limit: 1000 }
    );
  } catch {
    return [];
  }
}

// ─── Environmental data (factory location → Open-Meteo) ──────────────────────
async function _fetchFactoryLocation(factoryName) {
  const key = `loc_${factoryName}`;
  const cached = _getCached(key, ENV_TTL);
  if (cached) return cached;
  try {
    const data = await query("Sasaki_Coating_MasterDB", "factoryDB", { 工場: factoryName });
    if (!data?.length) return null;
    const f = data[0];
    let coordinates = null;
    if (f.geotag) {
      const parts = f.geotag.split(",");
      if (parts.length === 2)
        coordinates = { lat: parseFloat(parts[0].trim()), lon: parseFloat(parts[1].trim()) };
    } else if (f.coordinates) {
      coordinates = f.coordinates;
    }
    const result = {
      location: f.location,
      coordinates,
      source: f.geotag ? "geotag" : f.coordinates ? "coordinates" : "none",
    };
    _setCache(key, result);
    return result;
  } catch {
    return null;
  }
}

async function _fetchWeatherData(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=Asia/Tokyo`
    );
    const data = await res.json();
    if (!data.current) return null;
    const hour  = new Date().getHours();
    const isWork = hour >= 8 && hour <= 18;
    const co2 = Math.round(
      400 + (isWork ? 100 + Math.random() * 300 : Math.random() * 100) +
      Math.sin((hour * Math.PI) / 12) * 50
    );
    return {
      temperature: Math.round(data.current.temperature_2m * 10) / 10,
      humidity:    Math.round(data.current.relative_humidity_2m),
      co2,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

function _defaultEnv() {
  const hour   = new Date().getHours();
  const temp   = Math.max(18, Math.min(26, Math.round((22 + Math.sin((hour - 6) * Math.PI / 12) * 4) * 10) / 10));
  const humid  = Math.max(40, Math.min(60, Math.round(50 + Math.sin(hour * Math.PI / 12) * 10)));
  const isWork = hour >= 8 && hour <= 18;
  return {
    temperature: temp,
    humidity:    humid,
    co2:         Math.round(isWork ? 500 + Math.random() * 200 : 400 + Math.random() * 100),
    timestamp:   Date.now(),
    isDefault:   true,
    coordinateSource: null,
  };
}

export async function fetchEnvironmentalData(factoryName) {
  const key = `env_${factoryName}`;
  const cached = _getCached(key, ENV_TTL);
  if (cached) return cached;
  try {
    const loc = await _fetchFactoryLocation(factoryName);
    if (!loc?.coordinates) return _defaultEnv();
    const weather = await _fetchWeatherData(loc.coordinates.lat, loc.coordinates.lon);
    if (!weather) return _defaultEnv();
    const result = { ...weather, coordinateSource: loc.source, isDefault: false };
    _setCache(key, result);
    return result;
  } catch {
    return _defaultEnv();
  }
}

// ─── Full production range (for FactoryDetailPage) ────────────────────────────
const PROCESSES = [
  { name: "Kensa", collection: "kensaDB" },
  { name: "Press",  collection: "pressDB"  },
  { name: "SRS",   collection: "SRSDB"    },
  { name: "Slit",  collection: "slitDB"   },
];

function _buildProdQuery(factory, start, end, partNumbers, serialNumbers) {
  const q = {
    工場: factory,
    Date: { $gte: start, $lte: end },
  };
  if (partNumbers.length > 0) q["品番"] = { $in: partNumbers };
  if (serialNumbers.length > 0) q["背番号"] = { $in: serialNumbers };
  return q;
}

async function _fetchRange(factory, start, end, partNumbers, serialNumbers) {
  const settled = await Promise.allSettled(
    PROCESSES.map((p) =>
      query("submittedDB", p.collection, _buildProdQuery(factory, start, end, partNumbers, serialNumbers))
    )
  );
  return PROCESSES.reduce((acc, p, i) => {
    acc[p.name] = settled[i].status === "fulfilled" ? settled[i].value : [];
    return acc;
  }, {});
}

function _fmtDate(d) { return d.toISOString().split("T")[0]; }

/**
 * Fetches production data for a period (or single day → 3 sections: Daily/Weekly/Monthly).
 * Returns { isSingleDay, sections: { [label]: { Kensa, Press, SRS, Slit } } }
 */
export async function fetchProductionByPeriod(factory, from, to, partNumbers = [], serialNumbers = []) {
  const isSingleDay = from === to;
  if (isSingleDay) {
    const base  = new Date(from);
    const wkStart = new Date(base); wkStart.setDate(base.getDate() - 6);
    const moStart = new Date(base); moStart.setDate(base.getDate() - 29);
    const [daily, weekly, monthly] = await Promise.all([
      _fetchRange(factory, from, from, partNumbers, serialNumbers),
      _fetchRange(factory, _fmtDate(wkStart), from, partNumbers, serialNumbers),
      _fetchRange(factory, _fmtDate(moStart), from, partNumbers, serialNumbers),
    ]);
    return { isSingleDay: true, sections: { Daily: daily, Weekly: weekly, Monthly: monthly } };
  }
  const data = await _fetchRange(factory, from, to, partNumbers, serialNumbers);
  return { isSingleDay: false, sections: { Period: data } };
}

// ─── Manufacturing lot lookup ──────────────────────────────────────────────────
export async function checkMaterialSebanggo(lotNumber) {
  const res = await fetch(BASE_URL + "api/check-material-sebanggo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lotNumber }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function lookupMaterialLot(lotNumber, sebanggo) {
  const res = await fetch(BASE_URL + "api/material-lot-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lotNumber, sebanggo }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Master image lookup ──────────────────────────────────────────────────────
export async function fetchMasterImage(hinban, sebanggo) {
  try {
    if (hinban) {
      const r = await query("Sasaki_Coating_MasterDB", "masterDB",
        { 品番: hinban },
        { projection: { imageURL: 1, 品番: 1, 背番号: 1, 品名: 1 } }
      );
      if (r?.length && r[0].imageURL) return r[0];
    }
    if (sebanggo) {
      const r = await query("Sasaki_Coating_MasterDB", "masterDB",
        { 背番号: sebanggo },
        { projection: { imageURL: 1, 品番: 1, 背番号: 1, 品名: 1 } }
      );
      if (r?.length && r[0].imageURL) return r[0];
    }
    return null;
  } catch {
    return null;
  }
}
