/**
 * API Service — mirrors the data-fetching logic from the original FreyaAdmin.
 *
 * Backend: Express + MongoDB at VITE_API_URL (default: http://localhost:3000/)
 *   POST /queries       → { dbName, collectionName, query, sort, limit }
 *   GET  /api/masterdb/factories
 *
 * Environmental data: server-side weather batch via /api/factory-overview/env
 */

// ─── API Base URL ─────────────────────────────────────────────────────────────
const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();

// Local dev falls back to localhost. Hosted builds must provide VITE_API_URL.
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

// ─── Cache ────────────────────────────────────────────────────────────────────
const _cache = new Map();
const _inflight = new Map();
const ENV_TTL    = 10 * 60 * 1000; // 10 min
const SENSOR_TTL =  2 * 60 * 1000; // 2 min
const MASTER_TTL =  5 * 60 * 1000; // 5 min

function _getCached(key, ttl) {
  const e = _cache.get(key);
  if (e && Date.now() - e.ts < ttl) return e.data;
  return null;
}
function _setCache(key, data) { _cache.set(key, { data, ts: Date.now() }); }

async function _withInFlight(key, loader) {
  const pending = _inflight.get(key);
  if (pending) return pending;

  const task = Promise.resolve()
    .then(loader)
    .finally(() => {
      _inflight.delete(key);
    });

  _inflight.set(key, task);
  return task;
}

async function _readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function _postJson(endpoint, body) {
  const res = await fetch(BASE_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await _readJson(res);
  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function _getJson(endpoint) {
  const res = await fetch(BASE_URL + endpoint);
  const data = await _readJson(res);
  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function _deleteJson(endpoint, body) {
  const res = await fetch(BASE_URL + endpoint, {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await _readJson(res);
  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${res.status}`;
    throw new Error(message);
  }
  return data;
}

// ─── Universal query helper ───────────────────────────────────────────────────
export async function query(dbName, collectionName, q = {}, { sort, limit, projection, aggregation } = {}) {
  const res = await fetch(BASE_URL + "queries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dbName, collectionName, query: q, sort, limit, projection, aggregation }),
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

// ─── Environmental data (shared server-side weather batch) ──────────────────
function _todayKey() {
  return new Date().toISOString().split("T")[0];
}

function _normalizeEnvSnapshot(snapshot, coordinateSource = "server-batch") {
  if (!snapshot) return null;
  return {
    temperature: snapshot.temperature ?? null,
    humidity: snapshot.humidity ?? null,
    co2: snapshot.co2 ?? null,
    timestamp: snapshot.timestamp ?? Date.now(),
    isDefault: Boolean(snapshot.isDefault),
    coordinateSource: snapshot.coordinateSource ?? coordinateSource,
    apparentTemperature: snapshot.apparentTemperature ?? null,
    isDay: snapshot.isDay ?? null,
    weatherCode: snapshot.weatherCode ?? null,
  };
}

async function _fetchEnvironmentalOverview(date = _todayKey()) {
  const key = `env_overview_${date}`;
  const cached = _getCached(key, ENV_TTL);
  if (cached) return cached;

  return _withInFlight(key, async () => {
    try {
      const result = await _getJson(`api/factory-overview/env?date=${encodeURIComponent(date)}`);
      const data = result?.data && typeof result.data === "object" ? result.data : {};
      if (Object.keys(data).length > 0) {
        _setCache(key, data);
      }
      return data;
    } catch {
      return {};
    }
  });
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

  return _withInFlight(key, async () => {
    const overview = await _fetchEnvironmentalOverview();
    const snapshot = _normalizeEnvSnapshot(overview[factoryName]);
    const result = snapshot ?? _defaultEnv();
    _setCache(key, result);
    return result;
  });
}

// ─── Full production range (for FactoryDetailPage) ────────────────────────────
const PROCESSES = [
  { name: "Kensa", collection: "kensaDB" },
  { name: "Press",  collection: "pressDB"  },
  { name: "SRS",   collection: "SRSDB"    },
  { name: "Slit",  collection: "slitDB"   },
];

function _hasFactoryScope(factory) {
  return Boolean(factory && factory !== "__all__");
}

function _averageMetric(values, digits = 1) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  const factor = 10 ** digits;
  return Math.round((total / values.length) * factor) / factor;
}

// Maps process short name → collection (exported for useRecordModal)
export const PROC_TO_COLLECTION = {
  Kensa: "kensaDB", Press: "pressDB", SRS: "SRSDB", Slit: "slitDB",
};

/**
 * Fetch a single production record by its unique key fields.
 * Used by useRecordModal to re-open a record from a shared URL.
 */
export async function fetchRecordByKey(proc, { 工場: factory, Date: date, Time_start: timeStart, 品番: hinban }) {
  const collection = PROC_TO_COLLECTION[proc];
  if (!collection) return null;
  try {
    const rows = await query(
      "submittedDB", collection,
      { 工場: factory, Date: date, Time_start: timeStart, 品番: hinban },
      { limit: 1 }
    );
    if (!rows?.length) return null;
    return { ...rows[0], _source: collection };
  } catch {
    return null;
  }
}

const _NUMBER_FIELDS = new Set(["Total", "Total_NG", "Process_Quantity", "Cycle_Time", "Remaining_Quantity", "Spare"]);

function _toDistinctSortedStrings(values = []) {
  return [...new Set(
    values
      .map((value) => (value == null ? "" : String(value).trim()))
      .filter(Boolean)
  )].sort((a, b) => String(a).localeCompare(String(b), "ja"));
}

/**
 * Returns sorted distinct (non-null) values for `field` across all 4 production
 * collections, scoped to the given factory.
 */
export async function fetchDistinctValues(factory, field) {
  if (field === "モデル") {
    const rows = await query("Sasaki_Coating_MasterDB", "masterDB", {}, {
      projection: { モデル: 1, _id: 0 },
      limit: 10000,
    });
    return _toDistinctSortedStrings(Array.isArray(rows) ? rows.map((row) => row?.モデル) : []);
  }

  const proj = { [field]: 1, _id: 0 };
  const factoryQuery = _hasFactoryScope(factory) ? { 工場: factory } : {};
  const settled = await Promise.allSettled(
    PROCESSES.map((p) =>
      query("submittedDB", p.collection, factoryQuery, { projection: proj, limit: 10000 })
    )
  );
  const flat = settled.flatMap((r) =>
    r.status === "fulfilled" ? r.value.map((doc) => doc[field]).filter((v) => v != null && v !== "") : []
  );
  return _toDistinctSortedStrings(flat);
}

async function _buildProdQuery(factory, start, end, partNumbers, serialNumbers, advancedFilters = []) {
  const baseQuery = {
    Date: { $gte: start, $lte: end },
  };
  if (_hasFactoryScope(factory)) baseQuery["工場"] = factory;
  if (partNumbers.length > 0) baseQuery["品番"] = { $in: partNumbers };
  if (serialNumbers.length > 0) baseQuery["背番号"] = { $in: serialNumbers };

  const groupedClauses = new Map();

  for (const { field, operator, value } of advancedFilters) {
    const isEmptyArray = Array.isArray(value) && value.length === 0;
    if (!field || !operator || value === "" || value === undefined || isEmptyArray) continue;

    if (field === "モデル") {
      const modelValues = Array.isArray(value)
        ? value.map((item) => String(item || "").trim()).filter(Boolean)
        : String(value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

      if (!modelValues.length) continue;

      const rows = await query("Sasaki_Coating_MasterDB", "masterDB", {
        モデル: { $in: modelValues },
      }, {
        projection: { 背番号: 1, _id: 0 },
        limit: 10000,
      });

      const serials = _toDistinctSortedStrings(Array.isArray(rows) ? rows.map((row) => row?.背番号) : []);
      if (!serials.length) continue;

      const clause = { 背番号: { $in: serials } };
      if (!groupedClauses.has(field)) groupedClauses.set(field, []);
      groupedClauses.get(field).push(clause);
      continue;
    }

    const coerced = _NUMBER_FIELDS.has(field) ? Number(value) : value;
    let clause = null;

    switch (operator) {
      case "equals":
        clause = { [field]: coerced };
        break;
      case "in": {
        const values = Array.isArray(value)
          ? value.map((item) => (_NUMBER_FIELDS.has(field) ? Number(item) : item)).filter((item) => item !== "" && item !== undefined)
          : String(value || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => (_NUMBER_FIELDS.has(field) ? Number(item) : item));
        clause = values.length ? { [field]: { $in: values } } : null;
        break;
      }
      case "contains":
        clause = { [field]: { $regex: value, $options: "i" } };
        break;
      case "greater_than":
        clause = { [field]: { $gt: coerced } };
        break;
      case "less_than":
        clause = { [field]: { $lt: coerced } };
        break;
      default:
        break;
    }

    if (!clause) continue;
    if (!groupedClauses.has(field)) groupedClauses.set(field, []);
    groupedClauses.get(field).push(clause);
  }

  const clauses = Array.from(groupedClauses.values()).map((fieldClauses) => {
    if (fieldClauses.length === 1) return fieldClauses[0];
    return { $or: fieldClauses };
  });

  if (!clauses.length) return baseQuery;

  return {
    $and: [baseQuery, ...clauses],
  };
}

async function _fetchRange(factory, start, end, partNumbers, serialNumbers, advancedFilters = []) {
  const queries = await Promise.all(PROCESSES.map((p) => _buildProdQuery(factory, start, end, partNumbers, serialNumbers, advancedFilters)));
  const settled = await Promise.allSettled(
    PROCESSES.map((p, index) =>
      query("submittedDB", p.collection, queries[index])
    )
  );
  return PROCESSES.reduce((acc, p, i) => {
    acc[p.name] = settled[i].status === "fulfilled" ? settled[i].value : [];
    return acc;
  }, {});
}

function _fmtDate(d) { return d.toISOString().split("T")[0]; }

/**
 * Fetches every production record for a given date across ALL factories and
 * all 4 process collections.  Used by the Dashboard.
 * Returns flat array of records, each tagged with `_process` ("Kensa"|"Press"|"SRS"|"Slit").
 */
export async function fetchTodayAllRecords(date) {
  const key = `today_all_${date}`;
  const cached = _getCached(key, SENSOR_TTL);
  if (cached) return cached;

  const settled = await Promise.allSettled(
    PROCESSES.map((p) =>
      query("submittedDB", p.collection, { Date: date }, { sort: { createdAt: -1 }, limit: 2000 })
    )
  );
  const records = settled.flatMap((r, i) =>
    r.status === "fulfilled"
      ? r.value.map((doc) => ({ ...doc, _process: PROCESSES[i].name }))
      : []
  );
  _setCache(key, records);
  return records;
}

/**
 * Fetches production data for a period (or single day → 3 sections: Daily/Weekly/Monthly).
 * Returns { isSingleDay, sections: { [label]: { Kensa, Press, SRS, Slit } } }
 */
export async function fetchProductionByPeriod(factory, from, to, partNumbers = [], serialNumbers = [], advancedFilters = []) {
  const isSingleDay = from === to;
  if (isSingleDay) {
    const base  = new Date(from);
    const wkStart = new Date(base); wkStart.setDate(base.getDate() - 6);
    const moStart = new Date(base); moStart.setDate(base.getDate() - 29);
    const [daily, weekly, monthly] = await Promise.all([
      _fetchRange(factory, from, from, partNumbers, serialNumbers, advancedFilters),
      _fetchRange(factory, _fmtDate(wkStart), from, partNumbers, serialNumbers, advancedFilters),
      _fetchRange(factory, _fmtDate(moStart), from, partNumbers, serialNumbers, advancedFilters),
    ]);
    return { isSingleDay: true, sections: { Daily: daily, Weekly: weekly, Monthly: monthly } };
  }
  const data = await _fetchRange(factory, from, to, partNumbers, serialNumbers, advancedFilters);
  return { isSingleDay: false, sections: { Period: data } };
}

export async function fetchCombinedSensorData(date) {
  const key = `sensor_all_${date}`;
  const cached = _getCached(key, SENSOR_TTL);
  if (cached) return cached;

  const empty = {
    sensors: [],
    highestTemp: null,
    averageHumidity: null,
    wbgt: null,
    sensorCount: 0,
    hasData: false,
    factoryCount: 0,
    activeFactoryCount: 0,
  };

  try {
    const factories = await fetchMasterFactories();
    const settled = await Promise.allSettled(factories.map((factory) => fetchSensorData(factory, date)));
    const summaries = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const active = summaries.filter((item) => item?.hasData);
    const highestTemps = active.map((item) => item.highestTemp).filter((value) => value !== null);
    const humidities = active.map((item) => item.averageHumidity).filter((value) => value !== null);
    const wbgtValues = active.map((item) => item.wbgt).filter((value) => value !== null);

    const result = {
      sensors: active.flatMap((item) => item?.sensors || []),
      highestTemp: highestTemps.length ? Math.max(...highestTemps) : null,
      averageHumidity: _averageMetric(humidities, 1),
      wbgt: wbgtValues.length ? Math.max(...wbgtValues) : null,
      sensorCount: active.reduce((sum, item) => sum + (Number(item?.sensorCount) || 0), 0),
      hasData: active.length > 0,
      factoryCount: factories.length,
      activeFactoryCount: active.length,
    };

    _setCache(key, result);
    return result;
  } catch {
    return empty;
  }
}

export async function fetchCombinedEnvironmentalData() {
  const key = "env_all";
  const cached = _getCached(key, ENV_TTL);
  if (cached) return cached;

  return _withInFlight(key, async () => {
    const overview = await _fetchEnvironmentalOverview();
    const snapshots = Object.values(overview)
      .map((snapshot) => _normalizeEnvSnapshot(snapshot, "combined"))
      .filter(Boolean);

    if (!snapshots.length) {
      const fallback = { ..._defaultEnv(), coordinateSource: "combined" };
      _setCache(key, fallback);
      return fallback;
    }

    const temperatures = snapshots.map((item) => item.temperature).filter((value) => value !== null && value !== undefined);
    const humidities = snapshots.map((item) => item.humidity).filter((value) => value !== null && value !== undefined);
    const co2Values = snapshots.map((item) => item.co2).filter((value) => value !== null && value !== undefined);

    const result = {
      temperature: _averageMetric(temperatures, 1),
      humidity: _averageMetric(humidities, 0),
      co2: _averageMetric(co2Values, 0),
      timestamp: Math.max(...snapshots.map((item) => item.timestamp || 0), Date.now()),
      isDefault: snapshots.every((item) => item.isDefault),
      coordinateSource: "combined",
    };

    _setCache(key, result);
    return result;
  });
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

// ─── Master DB page (React migration) ────────────────────────────────────────
const MASTER_FACTORY_COLLECTIONS = ["kensaDB", "pressDB", "SRSDB", "slitDB"];

export function getMasterCollectionConfig(tabKey = "masterDB") {
  if (tabKey === "materialDB") {
    return { collectionName: "materialMasterDB2", baseQuery: { 工程名: "粘着工程" } };
  }
  return { collectionName: "masterDB", baseQuery: {} };
}

export async function fetchMasterPage({
  tabKey = "masterDB",
  page = 1,
  limit = 25,
  sort = { column: null, direction: 1 },
  simpleFilters = {},
  advancedFilters = {},
  searchTags = [],
  searchFields = [],
  searchLogicMode = "OR",
} = {}) {
  const { collectionName, baseQuery } = getMasterCollectionConfig(tabKey);
  const result = await _postJson("api/masterdb/paginate", {
    collectionName,
    baseQuery,
    page,
    limit,
    sort,
    simpleFilters,
    advancedFilters,
    searchTags,
    searchFields,
    searchLogicMode,
  });

  return {
    data: Array.isArray(result?.data) ? result.data : [],
    totalCount: Number(result?.totalCount) || 0,
    filteredCount: Number(result?.filteredCount) || 0,
    withImageCount: Number(result?.withImageCount) || 0,
    totalPages: Number(result?.totalPages) || 0,
  };
}

export async function fetchMasterSchema(tabKey = "masterDB") {
  const { collectionName, baseQuery } = getMasterCollectionConfig(tabKey);
  const query = new URLSearchParams({
    collection: collectionName,
    query: JSON.stringify(baseQuery),
  });
  const cacheKey = `master_schema_${tabKey}`;
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const result = await _getJson(`api/masterdb/schema?${query.toString()}`);
  const fields = Array.isArray(result) ? result : [];
  _setCache(cacheKey, fields);
  return fields;
}

export async function fetchMasterDistinctField(field, tabKey = "masterDB") {
  const { collectionName, baseQuery } = getMasterCollectionConfig(tabKey);
  const cacheKey = `master_distinct_${tabKey}_${field}`;
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const result = await _postJson("api/distinct", {
    dbName: "Sasaki_Coating_MasterDB",
    collectionName,
    field,
    filter: baseQuery,
  });
  const values = Array.isArray(result?.values) ? result.values : [];
  _setCache(cacheKey, values);
  return values;
}

export async function fetchMasterFilterOptions(tabKey = "masterDB") {
  const cacheKey = `master_filter_options_${tabKey}`;
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const processEndpoint = tabKey === "materialDB"
    ? "api/masterdb/materials"
    : "api/masterdb/equipment";

  const [factoryResult, rlResult, colorResult, processResult] = await Promise.all([
    _postJson("api/factories/batch", { collections: MASTER_FACTORY_COLLECTIONS }),
    _getJson("api/masterdb/rl"),
    _getJson("api/masterdb/colors"),
    _getJson(processEndpoint),
  ]);

  const factories = Object.values(factoryResult?.results || {}).flatMap((entry) =>
    Array.isArray(entry?.factories) ? entry.factories : []
  );
  const uniqueFactories = [...new Set(factories.filter((value) => value && String(value).trim()))].sort((a, b) =>
    String(a).localeCompare(String(b), "ja")
  );

  const options = {
    factories: uniqueFactories,
    rl: Array.isArray(rlResult?.data) ? rlResult.data : [],
    colors: Array.isArray(colorResult?.data) ? colorResult.data : [],
    processes: Array.isArray(processResult?.data) ? processResult.data : [],
  };

  _setCache(cacheKey, options);
  return options;
}

export async function createMasterRecord({ data, username, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("submitToMasterDB", {
    data,
    username,
    collectionName,
  });
}

export async function updateMasterRecord({ recordId, updates, username, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("updateMasterRecord", {
    recordId,
    updates,
    username,
    collectionName,
  });
}

export async function uploadMasterImage({ base64, recordId, username, tabKey = "masterDB", label = "main" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("uploadMasterImage", {
    base64,
    label,
    recordId,
    username,
    collectionName,
  });
}

export async function fetchMasterRecordIds({ query, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  const result = await _postJson("api/masterdb/ids", {
    collectionName,
    query,
  });
  return Array.isArray(result) ? result : [];
}

export async function batchUpdateMasterRecords({ recordIds, updates, username, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("batchUpdateMasterRecords", {
    recordIds,
    updates,
    username,
    collectionName,
  });
}

// ─── Product PDFs (梱包 / 検査基準 / 3点照合) ───────────────────────────────
function normalizePaginatedItems(result) {
  if (Array.isArray(result)) {
    return {
      items: result,
      page: 1,
      limit: result.length,
      total: result.length,
      totalPages: 1,
    };
  }

  return {
    items: Array.isArray(result?.items) ? result.items : [],
    page: Number(result?.page) || 1,
    limit: Number(result?.limit) || 25,
    total: Number(result?.total) || 0,
    totalPages: Number(result?.totalPages) || 1,
  };
}

export async function fetchProductPDFProducts() {
  const cacheKey = "product_pdf_products";
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const products = await query(
    "Sasaki_Coating_MasterDB",
    "masterDB",
    {},
    { projection: { 背番号: 1, モデル: 1, 品番: 1 } }
  );

  const nextProducts = Array.isArray(products) ? products : [];
  _setCache(cacheKey, nextProducts);
  return nextProducts;
}

export async function fetchProductPDFsByType({
  pdfType,
  page = 1,
  limit = 25,
  searchQuery = "",
  model = "",
  sortField = "uploadedAt",
  sortDir = "desc",
  includeHinban = true,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (includeHinban) query.set("includeHinban", "1");
  if (searchQuery) query.set("q", searchQuery);
  if (model) query.set("model", model);
  if (sortField) query.set("sortField", sortField);
  if (sortDir) query.set("sortDir", sortDir);

  const result = await _getJson(`api/product-pdfs-by-type/${encodeURIComponent(pdfType)}?${query.toString()}`);
  return normalizePaginatedItems(result);
}

export async function checkExistingProductPDFs({ pdfType, serialNumbers = [] }) {
  return _postJson("api/check-existing-pdfs", {
    pdfType,
    背番号Array: serialNumbers,
  });
}

export async function uploadProductPDFFile({
  pdfType,
  serialNumbers = [],
  pdfBase64,
  fileName,
  uploadedBy,
  resolutions = {},
}) {
  return _postJson("api/upload-product-pdf", {
    pdfType,
    背番号Array: serialNumbers,
    pdfBase64,
    fileName,
    uploadedBy,
    resolutions,
  });
}

export async function uploadProductPDFImage({ documentId, imageBase64, pdfType }) {
  return _postJson("api/upload-pdf-image", {
    documentId,
    imageBase64,
    pdfType,
  });
}

export async function batchDeleteProductPDFs(documentIds = []) {
  return _postJson("api/product-pdf-batch-delete", {
    documentIds,
  });
}

export async function deleteProductPDF(documentId) {
  return _deleteJson(`api/product-pdf/${encodeURIComponent(documentId)}`);
}

export async function fetchProductPDFTrash({ page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const result = await _getJson(`api/product-pdfs-trash?${query.toString()}`);
  return normalizePaginatedItems(result);
}

export async function recoverProductPDF(documentId) {
  return _postJson(`api/product-pdf-recover/${encodeURIComponent(documentId)}`, {});
}

export async function permanentlyDeleteProductPDF(documentId) {
  return _deleteJson(`api/product-pdf-permanent/${encodeURIComponent(documentId)}`);
}

// ─── Furyo Kanri (不良管理) ──────────────────────────────────────────────────
export async function fetchFuryoModels() {
  const cacheKey = "furyo_models";
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const result = await query(
    "Sasaki_Coating_MasterDB",
    "masterDB",
    {},
    {
      aggregation: [
        { $group: { _id: "$モデル" } },
        { $sort: { _id: 1 } },
      ],
    }
  );

  const models = (Array.isArray(result) ? result : [])
    .map((item) => item?._id)
    .filter((value) => value && String(value).trim() !== "")
    .map((value) => String(value));

  _setCache(cacheKey, models);
  return models;
}

export async function fetchDefectDefinitions(model = "") {
  const query = model
    ? `?${new URLSearchParams({ model }).toString()}`
    : "";
  const result = await _getJson(`defectDefinitions${query}`);
  return Array.isArray(result) ? result : [];
}

export async function saveDefectDefinition({ model, counters, countersEn, username }) {
  return _postJson("defectDefinitions", {
    model,
    counters,
    counters_en: countersEn,
    username,
  });
}

export async function fetchFuryoModelProducts(model) {
  return query(
    "Sasaki_Coating_MasterDB",
    "masterDB",
    { モデル: model },
    {
      projection: { 背番号: 1, 品番: 1, 品名: 1, imageURL: 1, _id: 0 },
    }
  );
}

export async function translateJapaneseText(text) {
  const query = new URLSearchParams({
    q: text,
    langpair: "ja|en",
  });
  const res = await fetch(`https://api.mymemory.translated.net/get?${query.toString()}`);
  const data = await _readJson(res);

  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.responseDetails || data?.error || `Translate ${res.status}`;
    throw new Error(message);
  }

  return String(data?.responseData?.translatedText || "").trim();
}
