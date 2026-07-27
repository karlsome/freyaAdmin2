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
export const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

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

export async function fetchFactoryDBRecords() {
  return query("Sasaki_Coating_MasterDB", "factoryDB", {}, { sort: { 工場: 1 } });
}

export async function fetchSetsubiDBRecords() {
  return query("Sasaki_Coating_MasterDB", "setsubiDB", { _archived: { $ne: true } }, { sort: { 工場: 1, name: 1 } });
}

export async function archiveEquipmentRecord({ recordId, username, role }) {
  return updateMasterRecord({
    recordId,
    updates: {
      _archived: true,
      _archivedAt: new Date().toISOString(),
      _archivedBy: username,
    },
    username,
    role,
    tabKey: "setsubiDB",
  });
}

export async function fetchSetsubiArchive() {
  return query("Sasaki_Coating_MasterDB", "setsubiDB", { _archived: true }, { sort: { _archivedAt: -1 } });
}

export async function restoreEquipmentRecord({ recordId, username, role }) {
  return updateMasterRecord({
    recordId,
    updates: { _archived: false, _archivedAt: null, _archivedBy: null },
    username,
    role,
    tabKey: "setsubiDB",
  });
}

export async function permanentDeleteEquipmentRecord({ recordId, username, role }) {
  return deleteMasterRecord({ recordId, username, role, tabKey: "setsubiDB" });
}

export async function fetchEquipmentHistory(equipmentId) {
  return query("Sasaki_Coating_MasterDB", "equipmentHistoryDB", { equipmentId, _deleted: { $ne: true } }, { sort: { eventDate: -1 } });
}

export async function fetchAllEquipmentHistory() {
  const archived = await fetchSetsubiArchive();
  const archivedIds = archived
    .map((r) => String(r._id?.$oid ?? r._id ?? ""))
    .filter(Boolean);
  const baseQuery = { _deleted: { $ne: true } };
  if (archivedIds.length > 0) baseQuery.equipmentId = { $nin: archivedIds };
  return query("Sasaki_Coating_MasterDB", "equipmentHistoryDB", baseQuery, { sort: { eventDate: -1 } });
}

export async function softDeleteEquipmentHistory({ recordId, username, role, reason }) {
  return updateMasterRecord({
    recordId,
    updates: {
      _deleted: true,
      _deletedAt: new Date().toISOString(),
      _deletedBy: username,
      _deleteReason: reason,
    },
    username,
    role,
    tabKey: "equipmentHistoryDB",
  });
}

export async function fetchEquipmentHistoryBin() {
  return query("Sasaki_Coating_MasterDB", "equipmentHistoryDB", { _deleted: true }, { sort: { _deletedAt: -1 } });
}

export async function restoreEquipmentHistoryRecord({ recordId, username, role }) {
  return updateMasterRecord({
    recordId,
    updates: { _deleted: false, _deletedAt: null, _deletedBy: null, _deleteReason: null },
    username,
    role,
    tabKey: "equipmentHistoryDB",
  });
}

export async function permanentDeleteEquipmentHistory({ recordId, username, role }) {
  return deleteMasterRecord({ recordId, username, role, tabKey: "equipmentHistoryDB" });
}

export async function uploadEquipmentEventImage({ base64, factoryName, equipmentName, username }) {
  return _postJson("api/upload-equipment-event-image", { base64, factoryName, equipmentName, username });
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

function _parseSensorReadings(readings, offsets = {}) {
  const sensorMap = new Map();
  readings.forEach((r) => {
    const id = r.device;
    const rTime = new Date(`${r.Date} ${r.Time}`);
    const existing = sensorMap.get(id);
    if (!existing || rTime > new Date(`${existing.Date} ${existing.Time}`)) {
      sensorMap.set(id, r);
    }
  });

  const sensors = Array.from(sensorMap.values()).map((r) => {
    let rawTemp = parseFloat(String(r.Temperature ?? "").replace("°C", "").trim());
    if (!isNaN(rawTemp) && offsets[r.device]) {
      rawTemp += offsets[r.device];
    }
    return {
      deviceId:    r.device,
      temperature: Math.round(rawTemp * 100) / 100,
      humidity:    parseFloat(String(r.Humidity    ?? "").replace("%",  "").trim()),
      status:      r.sensorStatus ?? "OK",
      lastUpdate:  `${r.Date} ${r.Time}`,
      factory:     r["工場"],
    };
  });

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

    const deviceNames = await fetchIoTDeviceNames(factoryName);
    const offsets = {};
    if (Array.isArray(deviceNames)) {
      deviceNames.forEach(d => {
        if (d.offset) offsets[d.deviceId] = Number(d.offset);
      });
    }

    const data = _parseSensorReadings(readings, offsets);
    _setCache(key, data);
    return data;
  } catch {
    return empty;
  }
}

function buildSensorFactoryNameExpression() {
  return {
    $trim: {
      input: {
        $toString: {
          $ifNull: ["$工場", ""],
        },
      },
    },
  };
}

export async function fetchSensorFactoryOverview(date = new Date().toISOString().split("T")[0]) {
  const cacheKey = `sensorFactoryOverview:${date}`;
  const cached = _getCached(cacheKey, SENSOR_TTL);
  if (cached) return cached;

  return _withInFlight(cacheKey, async () => {
    let offsets = {};
    try {
      const iotNames = await fetchIoTDeviceNames();
      offsets = Object.fromEntries(
        (Array.isArray(iotNames) ? iotNames : []).map(d => [d.deviceId, d.offset]).filter(([_, offset]) => offset)
      );
    } catch {
      // ignore
    }

    const result = await query(
      "submittedDB",
      "tempHumidityDB",
      {},
      {
        aggregation: [
          {
            $addFields: {
              factoryName: buildSensorFactoryNameExpression(),
            },
          },
          {
            $facet: {
              allFactories: [
                { $match: { factoryName: { $ne: "" } } },
                { $group: { _id: "$factoryName" } },
                { $sort: { _id: 1 } },
              ],
              todayByFactory: [
                { $match: { Date: date, factoryName: { $ne: "" } } },
                {
                  $addFields: {
                    temperatureValue: buildSensorReadingTemperatureExpression(offsets),
                    humidityValue: buildSensorReadingHumidityExpression(),
                  },
                },
                {
                  $addFields: {
                    wbgtValue: buildSensorReadingWBGTExpression(),
                  },
                },
                { $sort: { factoryName: 1, device: 1, Time: -1, _id: -1 } },
                {
                  $group: {
                    _id: {
                      device: "$device",
                      factory: "$factoryName",
                    },
                    latest: { $first: "$$ROOT" },
                  },
                },
                {
                  $group: {
                    _id: "$_id.factory",
                    highestTemp: { $max: "$latest.temperatureValue" },
                    averageHumidity: { $avg: "$latest.humidityValue" },
                    sensorCount: { $sum: 1 },
                    wbgt: { $max: "$latest.wbgtValue" },
                    deviceLatest: {
                      $push: {
                        date: "$latest.Date",
                        time: "$latest.Time",
                      },
                    },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    averageHumidity: { $round: ["$averageHumidity", 1] },
                    factory: "$_id",
                    highestTemp: { $round: ["$highestTemp", 1] },
                    sensorCount: 1,
                    wbgt: { $round: ["$wbgt", 1] },
                    deviceLatest: 1,
                  },
                },
                { $sort: { factory: 1 } },
              ],
            },
          },
        ],
      }
    );

    const payload = extractAggregationResultDocument(result);
    const knownFactories = mapAggregationFacetValues(payload?.allFactories);
    const activeFactories = Array.isArray(payload?.todayByFactory) ? payload.todayByFactory : [];
    const activeMap = new Map(activeFactories.map((factory) => [String(factory?.factory ?? "").trim(), factory]));
    const allFactoryNames = Array.from(new Set([
      ...knownFactories,
      ...activeFactories.map((factory) => String(factory?.factory ?? "").trim()).filter(Boolean),
    ])).sort((left, right) => left.localeCompare(right, "ja"));

    const overview = allFactoryNames.map((name) => {
      const summary = activeMap.get(name);

      if (!summary) {
        return {
          name,
          sensor: {
            averageHumidity: null,
            hasData: false,
            hasHistorical: true,
            highestTemp: null,
            sensorCount: 0,
            offlineCount: 0,
            wbgt: null,
          },
        };
      }

      const highestTemp = Number(summary.highestTemp);
      const averageHumidity = Number(summary.averageHumidity);
      const wbgt = Number(summary.wbgt);
      const now = Date.now();
      const offlineThresholdMs = 30 * 60 * 1000;
      const offlineCount = Array.isArray(summary.deviceLatest)
        ? summary.deviceLatest.reduce((count, entry) => {
            const dateValue = String(entry?.date ?? "").trim();
            const timeValue = String(entry?.time ?? "").trim() || "00:00:00";
            if (!dateValue) return count + 1;
            const parsed = new Date(`${dateValue}T${timeValue}`);
            const timestamp = Number.isNaN(parsed.getTime())
              ? new Date(`${dateValue} ${timeValue}`).getTime()
              : parsed.getTime();
            if (!Number.isFinite(timestamp)) return count + 1;
            return now - timestamp >= offlineThresholdMs ? count + 1 : count;
          }, 0)
        : 0;

      return {
        name,
        sensor: {
          averageHumidity: Number.isFinite(averageHumidity) ? averageHumidity : null,
          hasData: true,
          hasHistorical: true,
          highestTemp: Number.isFinite(highestTemp) ? highestTemp : null,
          sensorCount: Number(summary.sensorCount) || 0,
          offlineCount,
          wbgt: Number.isFinite(wbgt) ? wbgt : null,
        },
      };
    });

    _setCache(cacheKey, overview);
    return overview;
  });
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

function buildSensorReadingTemperatureExpression(offsets = {}) {
  const branches = Object.entries(offsets).map(([device, offset]) => ({
    case: { $eq: ["$device", device] },
    then: offset
  }));

  const baseTempExpr = {
    $convert: {
      input: {
        $trim: {
          input: {
            $replaceAll: {
              input: { $toString: { $ifNull: ["$Temperature", ""] } },
              find: "°C",
              replacement: "",
            },
          },
        },
      },
      to: "double",
      onError: null,
      onNull: null,
    },
  };

  if (branches.length === 0) {
    return baseTempExpr;
  }

  return {
    $round: [
      {
        $add: [
          baseTempExpr,
          {
            $switch: {
              branches,
              default: 0
            }
          }
        ]
      },
      2
    ]
  };
}

function buildSensorReadingHumidityExpression() {
  return {
    $convert: {
      input: {
        $trim: {
          input: {
            $replaceAll: {
              input: { $toString: { $ifNull: ["$Humidity", ""] } },
              find: "%",
              replacement: "",
            },
          },
        },
      },
      to: "double",
      onError: null,
      onNull: null,
    },
  };
}

function buildSensorReadingWBGTExpression() {
  const temperature = "$temperatureValue";
  const humidity = "$humidityValue";

  const wetBulbTemperature = {
    $subtract: [
      {
        $add: [
          {
            $multiply: [
              temperature,
              {
                $atan: {
                  $multiply: [
                    0.151977,
                    {
                      $sqrt: {
                        $add: [humidity, 8.313659],
                      },
                    },
                  ],
                },
              },
            ],
          },
          { $atan: { $add: [temperature, humidity] } },
          {
            $multiply: [
              0.00391838,
              { $pow: [humidity, 1.5] },
              { $atan: { $multiply: [0.023101, humidity] } },
            ],
          },
        ],
      },
      {
        $add: [
          { $atan: { $subtract: [humidity, 1.676331] } },
          4.686035,
        ],
      },
    ],
  };

  return {
    $cond: [
      {
        $and: [
          { $ne: [temperature, null] },
          { $ne: [humidity, null] },
          { $gte: [temperature, -50] },
          { $lte: [temperature, 60] },
          { $gte: [humidity, 0] },
          { $lte: [humidity, 100] },
        ],
      },
      {
        $round: [
          {
            $add: [
              { $multiply: [0.7, wetBulbTemperature] },
              { $multiply: [0.3, temperature] },
            ],
          },
          1,
        ],
      },
      null,
    ],
  };
}

function buildSensorReadingBaseMatch({ factoryName, startDate, endDate, years }) {
  const match = {};

  if (factoryName) {
    match["工場"] = factoryName;
  }

  if (years && years.length > 0) {
    // Prefix regex for each year, e.g. ^(2024|2025)
    match.Date = { $regex: `^(${years.join('|')})` };
  } else if (startDate || endDate) {
    const dateMatch = {};
    if (startDate) dateMatch.$gte = startDate;
    if (endDate) dateMatch.$lte = endDate;
    match.Date = dateMatch;
  }

  return match;
}

function buildSensorReadingDeviceMatch(deviceId = "all") {
  if (!deviceId || deviceId === "all") return null;
  return { device: deviceId };
}

function buildSensorReadingNormalizationStages({ factoryName, startDate, endDate, years, offsets = {} }) {
  return [
    { $match: buildSensorReadingBaseMatch({ factoryName, startDate, endDate, years }) },
    {
      $addFields: {
        temperatureValue: buildSensorReadingTemperatureExpression(offsets),
        humidityValue: buildSensorReadingHumidityExpression(),
      },
    },
    {
      $addFields: {
        wbgtValue: buildSensorReadingWBGTExpression(),
        Temperature: {
          $cond: [
            { $eq: ["$temperatureValue", null] },
            "$Temperature",
            { $concat: [{ $toString: "$temperatureValue" }, "°C"] }
          ]
        }
      },
    },
  ];
}

function buildSensorReadingSortStage(sortKey) {
  if (sortKey === "date_asc") return { Date: 1, Time: 1, _id: 1 };
  if (sortKey === "temp_desc") return { temperatureValue: -1, Date: -1, Time: -1, _id: -1 };
  if (sortKey === "temp_asc") return { temperatureValue: 1, Date: -1, Time: -1, _id: -1 };
  return { Date: -1, Time: -1, _id: -1 };
}

export async function fetchHistoricalSensorReadingsPage({
  factoryName,
  startDate,
  endDate,
  years,
  deviceId = "all",
  sortKey = "date_desc",
  page = 1,
  limit = 15,
  offsets = {},
} = {}) {
  const safeLimit = Math.max(1, Number(limit) || 15);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const deviceMatch = buildSensorReadingDeviceMatch(deviceId);

  const result = await query(
    "submittedDB",
    "tempHumidityDB",
    {},
    {
      aggregation: [
        ...buildSensorReadingNormalizationStages({ factoryName, startDate, endDate, years, offsets }),
        ...(deviceMatch ? [{ $match: deviceMatch }] : []),
        {
          $facet: {
            data: [
              { $sort: buildSensorReadingSortStage(sortKey) },
              { $skip: skip },
              { $limit: safeLimit },
              {
                $project: {
                  _id: 1,
                  Date: 1,
                  Time: 1,
                  device: 1,
                  Temperature: 1,
                  Humidity: 1,
                  sensorStatus: 1,
                  工場: 1,
                },
              },
            ],
            totalCount: [
              { $count: "count" },
            ],
          },
        },
      ],
    }
  );

  const payload = extractAggregationResultDocument(result);
  const totalItems = Number(payload?.totalCount?.[0]?.count) || 0;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / safeLimit) : 0;

  if (totalItems > 0 && safePage > 1 && (!Array.isArray(payload?.data) || payload.data.length === 0)) {
    return fetchHistoricalSensorReadingsPage({
      factoryName,
      startDate,
      endDate,
      deviceId,
      sortKey,
      page: totalPages,
      limit: safeLimit,
      offsets,
    });
  }

  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    pagination: {
      currentPage: totalPages > 0 ? Math.min(safePage, totalPages) : 1,
      totalPages,
      totalItems,
      itemsPerPage: safeLimit,
    },
  };
}

export async function fetchHistoricalSensorOverview({
  factoryName,
  startDate,
  endDate,
  years,
  deviceId = "all",
  offsets = {},
} = {}) {
  const cacheKey = `sensorOverview:${factoryName}:${startDate}:${endDate}:${years?.join(",")}:${deviceId}:${JSON.stringify(offsets)}`;
  const cached = _getCached(cacheKey, SENSOR_TTL);
  if (cached) return cached;

  return _withInFlight(cacheKey, async () => {
    const deviceMatch = buildSensorReadingDeviceMatch(deviceId);
    const isHourly = Boolean(startDate && endDate && startDate === endDate);

    const result = await query(
      "submittedDB",
      "tempHumidityDB",
      {},
      {
        aggregation: [
          ...buildSensorReadingNormalizationStages({ factoryName, startDate, endDate, years, offsets }),
          {
            $facet: {
              deviceOptions: [
                { $match: { device: { $ne: "" } } },
                { $group: { _id: "$device" } },
                { $sort: { _id: 1 } },
              ],
              summary: [
                ...(deviceMatch ? [{ $match: deviceMatch }] : []),
                {
                  $group: {
                    _id: null,
                    totalReadings: { $sum: 1 },
                    avgTemp: { $avg: "$temperatureValue" },
                    peakTemp: { $max: "$temperatureValue" },
                    minTemp: { $min: "$temperatureValue" },
                    avgHumid: { $avg: "$humidityValue" },
                    heatAlerts: {
                      $sum: {
                        $cond: [
                          { $gt: ["$wbgtValue", 28] },
                          1,
                          0,
                        ],
                      },
                    },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    totalReadings: 1,
                    avgTemp: { $round: ["$avgTemp", 1] },
                    peakTemp: { $round: ["$peakTemp", 1] },
                    minTemp: { $round: ["$minTemp", 1] },
                    avgHumid: { $round: ["$avgHumid", 1] },
                    heatAlerts: 1,
                  },
                },
              ],
              trends: [
                { $match: { device: { $ne: "" }, ...(deviceMatch || {}) } },
                {
                  $group: {
                    _id: {
                      device: "$device",
                      date: "$Date",
                      hour: isHourly ? { $substr: ["$Time", 0, 2] } : null,
                    },
                    avgTemperature: { $avg: "$temperatureValue" },
                    avgHumidity: { $avg: "$humidityValue" },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    device: "$_id.device",
                    Date: isHourly 
                      ? { $concat: ["$_id.date", " ", "$_id.hour", ":00"] }
                      : "$_id.date",
                    Temperature: { $round: ["$avgTemperature", 1] },
                    Humidity: { $round: ["$avgHumidity", 1] },
                  },
                },
                { $sort: { Date: 1, device: 1 } },
              ],
              latestDevices: [
                { $match: { device: { $ne: "" }, ...(deviceMatch || {}) } },
                { $sort: { device: 1, Date: -1, Time: -1, _id: -1 } },
                {
                  $group: {
                    _id: "$device",
                    latest: { $first: "$$ROOT" },
                    readingCount: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    deviceId: "$_id",
                    readingCount: 1,
                    latest: {
                      Date: "$latest.Date",
                      Time: "$latest.Time",
                      Temperature: "$latest.Temperature",
                      Humidity: "$latest.Humidity",
                      sensorStatus: "$latest.sensorStatus",
                      factory: "$latest.工場",
                    },
                  },
                },
                { $sort: { "latest.Date": -1, "latest.Time": -1, deviceId: 1 } },
              ],
            },
          },
        ],
      }
    );

    const payload = extractAggregationResultDocument(result);
    const summary = payload?.summary?.[0] ?? {};
    const overview = {
      devices: mapAggregationFacetValues(payload?.deviceOptions),
      totalReadings: Number(summary.totalReadings) || 0,
      avgTemp: Number.isFinite(Number(summary.avgTemp)) ? Number(summary.avgTemp) : null,
      peakTemp: Number.isFinite(Number(summary.peakTemp)) ? Number(summary.peakTemp) : null,
      minTemp: Number.isFinite(Number(summary.minTemp)) ? Number(summary.minTemp) : null,
      avgHumid: Number.isFinite(Number(summary.avgHumid)) ? Number(summary.avgHumid) : null,
      heatAlerts: Number(summary.heatAlerts) || 0,
      trends: Array.isArray(payload?.trends) ? payload.trends : [],
      latestDevices: Array.isArray(payload?.latestDevices) ? payload.latestDevices : [],
    };

    _setCache(cacheKey, overview);
    return overview;
  });
}

export async function fetchHistoricalSensorExport({
  factoryName,
  startDate,
  endDate,
  deviceId = "all",
  sortKey = "date_desc",
  offsets = {},
} = {}) {
  const deviceMatch = buildSensorReadingDeviceMatch(deviceId);

  const result = await query(
    "submittedDB",
    "tempHumidityDB",
    {},
    {
      aggregation: [
        ...buildSensorReadingNormalizationStages({ factoryName, startDate, endDate, offsets }),
        ...(deviceMatch ? [{ $match: deviceMatch }] : []),
        { $sort: buildSensorReadingSortStage(sortKey) },
        {
          $project: {
            _id: 1,
            Date: 1,
            Time: 1,
            device: 1,
            Temperature: 1,
            Humidity: 1,
            sensorStatus: 1,
            工場: 1,
          },
        },
      ],
    }
  );

  return Array.isArray(result) ? result : [];
}

// ─── IoT device names (Sasaki_Coating_MasterDB → ioTNames) ───────────────────
export async function fetchIoTDeviceNames(factoryName) {
  const filter = factoryName ? { factoryName } : {};
  return query("Sasaki_Coating_MasterDB", "ioTNames", filter);
}

export async function fetchAllIoTDevicesWithUsers() {
  const result = await query(
    "Sasaki_Coating_MasterDB",
    "ioTNames",
    {},
    {
      aggregation: [
        {
          $lookup: {
            from: "users",
            localField: "username",
            foreignField: "username",
            as: "registeredBy",
          },
        },
        {
          $addFields: {
            registeredBy: { $arrayElemAt: ["$registeredBy", 0] },
          },
        },
        {
          $project: {
            factoryName: 1,
            deviceId: 1,
            name: 1,
            imageURLs: 1,
            createdAt: 1,
            updatedAt: 1,
            username: 1,
            offset: 1,
            "registeredBy.firstName": 1,
            "registeredBy.lastName": 1,
            "registeredBy.email": 1,
          },
        },
        { $sort: { factoryName: 1, name: 1 } },
      ],
    }
  );

  return Array.isArray(result) ? result : [];
}

export async function saveIoTDeviceName({ deviceId, factoryName, name, imageURLs, username, offset }) {
  return _postJson("api/iot-device-names/save", { deviceId, factoryName, name, imageURLs, username, offset });
}

export async function uploadIoTDeviceImage({ base64, deviceId, factoryName, username }) {
  return _postJson("api/upload-iot-device-image", { base64, deviceId, factoryName, username });
}

export async function deleteIoTDeviceImage({ deviceId, factoryName, imageUrl, username }) {
  return _postJson("api/iot-device-names/delete-image", { deviceId, factoryName, imageUrl, username });
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
  const queries = await Promise.all(PROCESSES.map(() => _buildProdQuery(factory, start, end, partNumbers, serialNumbers, advancedFilters)));
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
  if (tabKey === "factoryDB") {
    return { collectionName: "factoryDB", baseQuery: {} };
  }
  if (tabKey === "setsubiDB") {
    return { collectionName: "setsubiDB", baseQuery: {} };
  }
  if (tabKey === "processDB") {
    return { collectionName: "processMasterDB", baseQuery: {} };
  }
  if (tabKey === "bomDB") {
    return { collectionName: "bomMasterDB", baseQuery: {} };
  }
  if (tabKey === "equipmentHistoryDB") {
    return { collectionName: "equipmentHistoryDB", baseQuery: {} };
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

export async function createMasterRecord({ data, username, role, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("submitToMasterDB", {
    data,
    username,
    role,
    collectionName,
  });
}

export async function updateMasterRecord({ recordId, updates, username, role, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("updateMasterRecord", {
    recordId,
    updates,
    username,
    role,
    collectionName,
  });
}

export async function deleteMasterRecord({ recordId, username, role, tabKey = "masterDB" }) {
  const { collectionName } = getMasterCollectionConfig(tabKey);
  return _postJson("queries", {
    dbName: "Sasaki_Coating_MasterDB",
    collectionName,
    query: { _id: recordId },
    delete: true,
    username,
    role,
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
// ─── Worker / user name lookup ────────────────────────────────────────────────
export async function fetchWorkerNames() {
  const [workers, users] = await Promise.all([
    query("Sasaki_Coating_MasterDB", "workerDB", {}, { projection: { Name: 1 } }),
    query("Sasaki_Coating_MasterDB", "users", {}, { projection: { firstName: 1, lastName: 1 } }),
  ]);
  const fromWorkers = (Array.isArray(workers) ? workers : [])
    .map((w) => String(w.Name || "").trim())
    .filter(Boolean);
  const fromUsers = (Array.isArray(users) ? users : [])
    .map((u) => [u.firstName, u.lastName].filter(Boolean).join(" ").trim())
    .filter(Boolean);
  return [...new Set([...fromWorkers, ...fromUsers])].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

export async function createWorkerRecord(name) {
  return _postJson("submitToMasterDB", {
    data: { Name: String(name).trim() },
    username: "system",
    role: "admin",
    collectionName: "workerDB",
  });
}

// ─── Equipment history (submittedDB › setsubiHistory) ─────────────────────────

export async function fetchSetsubiHistoryRecords({ factory, equipmentId } = {}) {
  const q = { _deleted: { $ne: true } };
  if (factory) q["工場"] = factory;
  if (equipmentId) q.equipmentId = equipmentId;
  return query("submittedDB", "setsubiHistory", q, { sort: { date: -1, createdAt: -1 } });
}

export async function createSetsubiHistoryRecord(data) {
  return _postJson("queries", {
    dbName: "submittedDB",
    collectionName: "setsubiHistory",
    insertData: { ...data, createdAt: new Date().toISOString() },
  });
}

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

// ─── Material PDFs ─────────────────────────────────────────────────────────────

export async function fetchMaterialPDFMaterials() {
  const cacheKey = "material_pdf_materials";
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const materials = await query(
    "Sasaki_Coating_MasterDB",
    "materialMasterDB3",
    {},
    { projection: { "品目マスタ.図番": 1, "品目マスタ.品名": 1, 品番: 1, "品目マスタ.工程コード": 1 } }
  );

  const nextMaterials = Array.isArray(materials) ? materials.map(m => ({
    ...m,
    図番: m.品目マスタ?.図番 || m.図番,
    品名: m.品目マスタ?.品名 || m.品名,
    工程コード: m.品目マスタ?.工程コード || m.工程コード
  })) : [];
  _setCache(cacheKey, nextMaterials);
  return nextMaterials;
}

export async function fetchMaterialPDFsByType({
  pdfType,
  page = 1,
  limit = 25,
  searchQuery = "",
  processCode = "",
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
  if (processCode) query.set("processCode", processCode);
  if (sortField) query.set("sortField", sortField);
  if (sortDir) query.set("sortDir", sortDir);

  const result = await _getJson(`api/material-pdfs-by-type/${encodeURIComponent(pdfType)}?${query.toString()}`);
  return normalizePaginatedItems(result);
}

export async function checkExistingMaterialPDFs({ pdfType, drawingNumbers = [] }) {
  return _postJson("api/check-existing-material-pdfs", {
    pdfType,
    図番Array: drawingNumbers,
  });
}

export async function uploadMaterialPDFFile({
  pdfType,
  drawingNumbers = [],
  pdfBase64,
  fileName,
  uploadedBy,
  resolutions = {},
  excludedMaterialIds = [],
}) {
  return _postJson("api/upload-material-pdf", {
    pdfType,
    図番Array: drawingNumbers,
    pdfBase64,
    fileName,
    uploadedBy,
    resolutions,
    excludedMaterialIds,
  });
}

export async function uploadMaterialPDFImage({ documentId, imageBase64, pdfType }) {
  return _postJson("api/upload-material-pdf-image", {
    documentId,
    imageBase64,
    pdfType,
  });
}

export async function batchDeleteMaterialPDFs(documentIds = []) {
  return _postJson("api/material-pdf-batch-delete", {
    documentIds,
  });
}

export async function deleteMaterialPDF(documentId) {
  return _deleteJson(`api/material-pdf/${encodeURIComponent(documentId)}`);
}

export async function fetchMaterialPDFTrash({ page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const result = await _getJson(`api/material-pdfs-trash?${query.toString()}`);
  return normalizePaginatedItems(result);
}

export async function recoverMaterialPDF(documentId) {
  return _postJson(`api/material-pdf-recover/${encodeURIComponent(documentId)}`, {});
}

export async function permanentlyDeleteMaterialPDF(documentId) {
  return _deleteJson(`api/material-pdf-permanent/${encodeURIComponent(documentId)}`);
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

// ─── Maintenance Check Forms ──────────────────────────────────────────────────
export async function fetchCheckFormTemplates(factory) {
  const q = factory ? { 工場: factory } : {};
  return query("Sasaki_Coating_MasterDB", "checkFormTemplatesDB", q, { sort: { createdAt: -1 } });
}

export async function fetchCheckFormReferenceImages(folderKey) {
  const normalizedFolderKey = String(folderKey || "").trim();
  if (!normalizedFolderKey) return { folderKey: "", images: [] };
  return _getJson(`api/check-forms/reference-images?folderKey=${encodeURIComponent(normalizedFolderKey)}`);
}

export async function fetchCheckFormReferenceImageSource(imageURL) {
  const normalizedImageURL = String(imageURL || "").trim();
  if (!normalizedImageURL) {
    throw new Error("imageURL is required");
  }

  return _postJson("api/check-forms/reference-images/source", { imageURL: normalizedImageURL });
}

export async function uploadCheckFormReferenceImage({ base64, folderKey, username }) {
  return _postJson("api/check-forms/reference-images", { base64, folderKey, username });
}

export async function createCheckFormTemplate(draft, username) {
  return _postJson("submitToMasterDB", {
    data: {
      ...draft,
      createdBy: username,
      createdAt: new Date().toISOString(),
      updatedBy: null,
      updatedAt: null,
    },
    username,
    role: "admin",
    collectionName: "checkFormTemplatesDB",
  });
}

export async function updateCheckFormTemplate(id, updates, username) {
  return _postJson("updateMasterRecord", {
    recordId: id,
    updates: { ...updates, updatedBy: username, updatedAt: new Date().toISOString() },
    username,
    role: "admin",
    collectionName: "checkFormTemplatesDB",
  });
}

export async function deleteCheckFormTemplate(recordId, username) {
  return _postJson("queries", {
    dbName: "Sasaki_Coating_MasterDB",
    collectionName: "checkFormTemplatesDB",
    query: { _id: recordId },
    delete: true,
    username,
    role: "admin",
  });
}

function normalizeMongoDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value.$date) return value.$date;
  return "";
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.$oid === "string") return value.$oid;
  if (typeof value?.toHexString === "function") return value.toHexString();
  if (typeof value?.toString === "function") {
    const stringValue = value.toString();
    return stringValue === "[object Object]" ? "" : stringValue;
  }
  return "";
}

function normalizeCheckFormAnswerValue(answer) {
  if (answer.type === "toggle") {
    return String(answer.status ?? answer.value ?? "").trim().toLowerCase();
  }
  if (answer.displayValue !== undefined && answer.displayValue !== null && answer.displayValue !== "") {
    return answer.displayValue;
  }
  return answer.value ?? "";
}

function normalizeCheckFormResponses(answers = []) {
  return answers.reduce((responseMap, answer) => {
    responseMap[answer.fieldId] = normalizeCheckFormAnswerValue(answer);
    if (answer.fieldPhotoURL) {
      responseMap[`${answer.fieldId}_photo`] = answer.fieldPhotoURL;
    }
    return responseMap;
  }, {});
}

function normalizeCheckFormRecord(record) {
  const answers = Array.isArray(record.answers) ? record.answers : [];
  const derivedHasNg = answers.some((answer) => {
    const status = String(answer.status ?? "").trim().toLowerCase();
    return status === "ng" || status === "out-of-range";
  }) || (Array.isArray(record.tickets) && record.tickets.length > 0);

  return {
    ...record,
    formId: String(record.formId ?? record.templateId ?? ""),
    formName: record.formName ?? record.templateName ?? "",
    schedule: String(record.schedule ?? "").trim().toLowerCase(),
    machineId: String(record.machineId ?? record.equipmentId ?? ""),
    machineName: record.machineName ?? record["加工設備"] ?? "",
    completedBy: record.completedBy ?? record.workerName ?? "",
    completedAt: normalizeMongoDate(
      record.completedAt
      ?? record.submittedAtClient
      ?? record.createdAt
      ?? record.updatedAt
      ?? record.submittedAt
    ),
    periodStart: record.periodStart ?? record.startDate ?? "",
    periodEnd: record.periodEnd ?? record.startDate ?? "",
    factory: record.factory ?? record.工場 ?? "",
    hasNG: typeof record.hasNG === "boolean" ? record.hasNG : derivedHasNg,
    answers,
    responses: record.responses ?? normalizeCheckFormResponses(answers),
  };
}

function normalizeNgStatusHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  return {
    action: String(entry.action ?? "").trim(),
    comment: String(entry.comment ?? entry.note ?? "").trim(),
    fixReason: String(entry.fixReason ?? "").trim(),
    reason: String(entry.reason ?? "").trim(),
    imageURLs: Array.isArray(entry.imageURLs) ? entry.imageURLs.filter(Boolean) : [],
    fromStatus: String(entry.fromStatus ?? "").trim().toLowerCase(),
    timestamp: normalizeMongoDate(entry.timestamp ?? entry.createdAt ?? entry.updatedAt),
    toStatus: String(entry.toStatus ?? "").trim().toLowerCase(),
    user: String(entry.user ?? entry.actorName ?? "").trim(),
    username: String(entry.username ?? entry.actorUsername ?? "").trim(),
  };
}

function normalizeNgReport(report) {
  return {
    ...report,
    ticketId: normalizeId(report._id ?? report.ticketId),
    recordId: normalizeId(report.checkFormRecordId ?? report.recordId ?? report.checkFormRecordID),
    fieldId: String(report.fieldId ?? report.checkItemId ?? ""),
    formId: String(report.formId ?? report.templateId ?? ""),
    formName: report.formName ?? report.templateName ?? "",
    machineId: String(report.machineId ?? report.equipmentId ?? ""),
    machineName: report.machineName ?? report["加工設備"] ?? "",
    completedBy: report.completedBy ?? report.workerName ?? "",
    factory: report.factory ?? report.工場 ?? "",
    createdAt: normalizeMongoDate(
      report.createdAt
      ?? report.completedAt
      ?? report.updatedAt
      ?? report.submittedAt
    ),
    fieldLabel: report.fieldLabel ?? "",
    fieldType: report.fieldType ?? "",
    answerValue: report.answerValue ?? report.value ?? "",
    reason: report.reason ?? "",
    imageURLs: Array.isArray(report.imageURLs) ? report.imageURLs.filter(Boolean) : [],
    min: report.min ?? null,
    max: report.max ?? null,
    unit: report.unit ?? "",
    closedAt: normalizeMongoDate(report.closedAt),
    closedBy: report.closedBy ?? "",
    closedByUsername: report.closedByUsername ?? "",
    fixReason: report.fixReason ?? "",
    ticketNo: report.ticketNo ?? null,
    status: report.status ?? "open",
    statusHistory: Array.isArray(report.statusHistory)
      ? report.statusHistory.map(normalizeNgStatusHistoryEntry).filter(Boolean)
      : [],
  };
}

function escapeRegexPattern(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDayStartTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
}

function toDayEndTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime();
}

function buildMongoIfNullChain(paths = [], fallback = "") {
  return [...paths].reverse().reduce((accumulator, path) => ({ $ifNull: [path, accumulator] }), fallback);
}

function buildMongoStringExpression(paths = [], fallback = "") {
  return { $toString: buildMongoIfNullChain(paths, fallback) };
}

function buildNgTicketNormalizationStages() {
  const createdAtSource = buildMongoIfNullChain(["$createdAt", "$completedAt", "$updatedAt", "$submittedAt"], null);
  const closedAtSource = buildMongoIfNullChain(["$closedAt"], null);
  const imageArraySource = {
    $cond: [
      { $isArray: "$imageURLs" },
      "$imageURLs",
      [],
    ],
  };

  return [
    {
      $project: {
        _id: 1,
        ticketId: { $toString: "$_id" },
        recordId: buildMongoStringExpression(["$checkFormRecordId", "$recordId", "$checkFormRecordID"]),
        fieldId: buildMongoStringExpression(["$fieldId", "$checkItemId"]),
        formId: buildMongoStringExpression(["$formId", "$templateId"]),
        formName: buildMongoStringExpression(["$formName", "$templateName"]),
        machineId: buildMongoStringExpression(["$machineId", "$equipmentId"]),
        machineName: buildMongoStringExpression(["$machineName", "$加工設備"]),
        completedBy: buildMongoStringExpression(["$completedBy", "$workerName"]),
        closedBy: buildMongoStringExpression(["$closedBy"]),
        closedByUsername: buildMongoStringExpression(["$closedByUsername"]),
        factory: buildMongoStringExpression(["$factory", "$工場"]),
        createdAtRaw: createdAtSource,
        closedAtRaw: closedAtSource,
        fieldLabel: buildMongoStringExpression(["$fieldLabel"]),
        fieldType: buildMongoStringExpression(["$fieldType"]),
        answerValue: buildMongoStringExpression(["$answerValue", "$value"]),
        reason: buildMongoStringExpression(["$reason"]),
        imageURLs: imageArraySource,
        min: { $ifNull: ["$min", null] },
        max: { $ifNull: ["$max", null] },
        statusHistory: { $ifNull: ["$statusHistory", []] },
        unit: buildMongoStringExpression(["$unit"]),
        status: { $toLower: buildMongoStringExpression(["$status"], "open") },
        ticketNo: { $ifNull: ["$ticketNo", null] },
      },
    },
    {
      $addFields: {
        createdAt: {
          $convert: {
            input: "$createdAtRaw",
            to: "date",
            onError: null,
            onNull: null,
          },
        },
        closedAt: {
          $convert: {
            input: "$closedAtRaw",
            to: "date",
            onError: null,
            onNull: null,
          },
        },
        imageCount: { $size: "$imageURLs" },
      },
    },
    {
      $addFields: {
        createdAtMs: {
          $cond: [
            { $ne: ["$createdAt", null] },
            { $toLong: "$createdAt" },
            null,
          ],
        },
        hasImages: { $gt: ["$imageCount", 0] },
      },
    },
    {
      $project: {
        createdAtRaw: 0,
        closedAtRaw: 0,
      },
    },
  ];
}

function buildNgTicketTextCondition(field, value, { exact = false } = {}) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return null;

  const escapedValue = escapeRegexPattern(normalizedValue);
  return {
    [field]: {
      $regex: exact ? `^${escapedValue}$` : escapedValue,
      $options: "i",
    },
  };
}

function buildNgTicketKeywordCondition(value) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return null;

  const searchableFields = [
    "recordId",
    "factory",
    "machineName",
    "formName",
    "fieldLabel",
    "fieldType",
    "answerValue",
    "reason",
    "completedBy",
    "status",
  ];

  return {
    $or: searchableFields
      .map((field) => buildNgTicketTextCondition(field, normalizedValue))
      .filter(Boolean),
  };
}

function normalizeNgTicketImageFilterValue(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();
  if (normalizedValue === "with images") return true;
  if (normalizedValue === "without images") return false;
  return null;
}

function buildNgTicketAdvancedClauseCondition(clause) {
  if (!clause?.field || !clause?.operator) return null;

  if (clause.field === "keyword") {
    return buildNgTicketKeywordCondition(clause.value);
  }

  if (clause.field === "hasImages") {
    if (clause.operator === "in") {
      const values = (Array.isArray(clause.value) ? clause.value : [clause.value])
        .map(normalizeNgTicketImageFilterValue)
        .filter((value) => value !== null);

      if (!values.length) return null;
      return { hasImages: { $in: [...new Set(values)] } };
    }

    const imageFilterValue = normalizeNgTicketImageFilterValue(clause.value);
    return imageFilterValue === null ? null : { hasImages: imageFilterValue };
  }

  if (clause.type === "date") {
    const fieldName = "createdAtMs";

    if (clause.operator === "range") {
      const startValue = toDayStartTimestamp(clause.valueFrom);
      const endValue = toDayEndTimestamp(clause.valueTo);
      if (startValue == null || endValue == null) return null;

      return {
        [fieldName]: {
          $gte: Math.min(startValue, endValue),
          $lte: Math.max(startValue, endValue),
        },
      };
    }

    const equalsStart = toDayStartTimestamp(clause.value);
    const equalsEnd = toDayEndTimestamp(clause.value);
    if (equalsStart == null || equalsEnd == null) return null;

    if (clause.operator === "equals") {
      return {
        [fieldName]: {
          $gte: equalsStart,
          $lte: equalsEnd,
        },
      };
    }

    if (clause.operator === "greater") {
      return { [fieldName]: { $gt: equalsEnd } };
    }

    if (clause.operator === "less") {
      return { [fieldName]: { $lt: equalsStart } };
    }

    return null;
  }

  if (clause.type === "number") {
    const fieldName = clause.field;

    if (clause.operator === "range") {
      const valueFrom = Number(clause.valueFrom);
      const valueTo = Number(clause.valueTo);
      if (!Number.isFinite(valueFrom) || !Number.isFinite(valueTo)) return null;

      return {
        [fieldName]: {
          $gte: Math.min(valueFrom, valueTo),
          $lte: Math.max(valueFrom, valueTo),
        },
      };
    }

    const comparisonValue = Number(clause.value);
    if (!Number.isFinite(comparisonValue)) return null;

    if (clause.operator === "equals") return { [fieldName]: comparisonValue };
    if (clause.operator === "greater") return { [fieldName]: { $gt: comparisonValue } };
    if (clause.operator === "less") return { [fieldName]: { $lt: comparisonValue } };
    if (clause.operator === "in") {
      const values = (Array.isArray(clause.value) ? clause.value : [clause.value])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      return values.length ? { [fieldName]: { $in: values } } : null;
    }

    return null;
  }

  const fieldName = clause.field;

  if (clause.operator === "contains") {
    return buildNgTicketTextCondition(fieldName, clause.value);
  }

  if (clause.operator === "equals") {
    return buildNgTicketTextCondition(fieldName, clause.value, { exact: true });
  }

  if (clause.operator === "in") {
    const values = (Array.isArray(clause.value) ? clause.value : [clause.value])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    if (!values.length) return null;

    return {
      $or: values.map((value) => buildNgTicketTextCondition(fieldName, value, { exact: true })),
    };
  }

  return null;
}

function buildNgTicketMatchConditions({ advancedFilters = [], filters = {} } = {}) {
  const conditions = [];
  const keywordCondition = buildNgTicketKeywordCondition(filters.keyword);
  if (keywordCondition) conditions.push(keywordCondition);

  const factoryCondition = buildNgTicketTextCondition("factory", filters.factory, { exact: true });
  if (factoryCondition) conditions.push(factoryCondition);

  const statusCondition = buildNgTicketTextCondition("status", filters.status, { exact: true });
  if (statusCondition) conditions.push(statusCondition);

  const startTimestamp = toDayStartTimestamp(filters.startDate);
  const endTimestamp = toDayEndTimestamp(filters.endDate);
  if (startTimestamp != null || endTimestamp != null) {
    const timestampFilter = {};
    if (startTimestamp != null) timestampFilter.$gte = startTimestamp;
    if (endTimestamp != null) timestampFilter.$lte = endTimestamp;
    conditions.push({ createdAtMs: timestampFilter });
  }

  const clausesByField = (Array.isArray(advancedFilters) ? advancedFilters : []).reduce((map, clause) => {
    const fieldKey = String(clause?.field ?? "").trim();
    if (!fieldKey) return map;

    const fieldClauses = map.get(fieldKey) ?? [];
    fieldClauses.push(clause);
    map.set(fieldKey, fieldClauses);
    return map;
  }, new Map());

  clausesByField.forEach((fieldClauses) => {
    const alternatives = fieldClauses
      .map((clause) => buildNgTicketAdvancedClauseCondition(clause))
      .filter(Boolean);

    if (alternatives.length === 1) {
      conditions.push(alternatives[0]);
    } else if (alternatives.length > 1) {
      conditions.push({ $or: alternatives });
    }
  });

  return conditions;
}

function buildNgTicketSortStage(sort = {}) {
  const allowedSortFields = new Map([
    ["createdAt", "createdAtMs"],
    ["factory", "factory"],
    ["machineName", "machineName"],
    ["formName", "formName"],
    ["fieldLabel", "fieldLabel"],
    ["completedBy", "completedBy"],
    ["status", "status"],
    ["imageCount", "imageCount"],
  ]);

  const sortField = allowedSortFields.get(String(sort?.column ?? "").trim()) ?? "createdAtMs";
  const sortDirection = Number(sort?.direction) === 1 ? 1 : -1;

  return {
    [sortField]: sortDirection,
    createdAtMs: sortField === "createdAtMs" ? sortDirection : -1,
    _id: -1,
  };
}

function buildNgTicketFilteredAggregationStages({ filters = {}, advancedFilters = [] } = {}) {
  const matchConditions = buildNgTicketMatchConditions({ filters, advancedFilters });

  return [
    ...buildNgTicketNormalizationStages(),
    ...(matchConditions.length ? [{ $match: { $and: matchConditions } }] : []),
  ];
}

function extractAggregationResultDocument(result) {
  if (Array.isArray(result)) return result[0] ?? {};
  return result ?? {};
}

function mapAggregationFacetValues(items = []) {
  return items
    .map((item) => String(item?._id ?? "").trim())
    .filter(Boolean);
}

export async function fetchCheckFormRecords(formIds = []) {
  if (formIds.length === 0) return [];
  const records = await query(
    "submittedDB",
    "checkFormRecordsDB",
    { $or: [{ formId: { $in: formIds } }, { templateId: { $in: formIds } }] },
    { sort: { completedAt: -1, createdAt: -1 } }
  );

  return Array.isArray(records) ? records.map(normalizeCheckFormRecord) : [];
}

export async function fetchCheckFormRecordById(recordId) {
  const normalizedRecordId = normalizeId(recordId);
  if (!normalizedRecordId) return null;

  const records = await query(
    "submittedDB",
    "checkFormRecordsDB",
    { _id: normalizedRecordId },
    { limit: 1 }
  );

  if (!Array.isArray(records) || records.length === 0) return null;
  return normalizeCheckFormRecord(records[0]);
}

export async function createCheckFormRecord(data) {
  return _postJson("submitToMasterDB", {
    data: { ...data, submittedAt: new Date().toISOString() },
    username: data.completedBy || "simulator",
    role: "worker",
    collectionName: "checkFormRecordsDB",
    dbName: "submittedDB",
  });
}

export async function createNgReport(data) {
  return _postJson("submitToMasterDB", {
    data: {
      ...data,
      status: String(data?.status ?? "open").trim().toLowerCase() || "open",
      statusHistory: Array.isArray(data?.statusHistory) ? data.statusHistory : [],
      submittedAt: new Date().toISOString(),
    },
    username: data.completedBy || "simulator",
    role: "worker",
    collectionName: "ngReportsDB",
    dbName: "submittedDB",
  });
}

export async function updateNgTicketRecord({ ticketId, update, username, role }) {
  const normalizedTicketId = typeof ticketId === "object"
    ? ticketId
    : normalizeId(ticketId);
  if (!normalizedTicketId) throw new Error("A ticket ID is required.");

  return _postJson("queries", {
    dbName: "submittedDB",
    collectionName: "ngReportsDB",
    query: { _id: normalizedTicketId },
    update,
    username,
    role,
  });
}

export async function fetchNgReports(formIds = []) {
  if (formIds.length === 0) return [];
  const reports = await query("submittedDB", "ngReportsDB",
    { formId: { $in: formIds } },
    { sort: { completedAt: -1 } }
  );

  return Array.isArray(reports) ? reports.map(normalizeNgReport) : [];
}

export async function fetchNgReportsByRecordIds(recordIds = []) {
  if (recordIds.length === 0) return [];
  const reports = await query(
    "submittedDB",
    "ngReportsDB",
    { checkFormRecordId: { $in: recordIds } },
    { sort: { createdAt: -1, completedAt: -1 } }
  );

  return Array.isArray(reports) ? reports.map(normalizeNgReport) : [];
}

export async function fetchNgTicketFilterOptions() {
  const cacheKey = "ngTicketFilterOptions";
  const cached = _getCached(cacheKey, MASTER_TTL);
  if (cached) return cached;

  const result = await query(
    "submittedDB",
    "ngReportsDB",
    {},
    {
      aggregation: [
        ...buildNgTicketNormalizationStages(),
        {
          $facet: {
            factories: [
              { $match: { factory: { $ne: "" } } },
              { $group: { _id: "$factory" } },
              { $sort: { _id: 1 } },
            ],
            machineNames: [
              { $match: { machineName: { $ne: "" } } },
              { $group: { _id: "$machineName" } },
              { $sort: { _id: 1 } },
            ],
            formNames: [
              { $match: { formName: { $ne: "" } } },
              { $group: { _id: "$formName" } },
              { $sort: { _id: 1 } },
            ],
            completedBy: [
              { $match: { completedBy: { $ne: "" } } },
              { $group: { _id: "$completedBy" } },
              { $sort: { _id: 1 } },
            ],
            statuses: [
              { $match: { status: { $ne: "" } } },
              { $group: { _id: "$status" } },
              { $sort: { _id: 1 } },
            ],
            fieldLabels: [
              { $match: { fieldLabel: { $ne: "" } } },
              { $group: { _id: "$fieldLabel" } },
              { $sort: { _id: 1 } },
            ],
            fieldTypes: [
              { $match: { fieldType: { $ne: "" } } },
              { $group: { _id: "$fieldType" } },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ],
    }
  );

  const payload = extractAggregationResultDocument(result);
  const options = {
    factories: mapAggregationFacetValues(payload.factories),
    machineNames: mapAggregationFacetValues(payload.machineNames),
    formNames: mapAggregationFacetValues(payload.formNames),
    completedBy: mapAggregationFacetValues(payload.completedBy),
    statuses: mapAggregationFacetValues(payload.statuses),
    fieldLabels: mapAggregationFacetValues(payload.fieldLabels),
    fieldTypes: mapAggregationFacetValues(payload.fieldTypes),
  };

  _setCache(cacheKey, options);
  return options;
}

export async function fetchNgTicketPage({ filters = {}, advancedFilters = [], page = 1, limit = 10, sort = {} } = {}) {
  const safeLimit = Math.max(1, Number(limit) || 10);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const sortStage = buildNgTicketSortStage(sort);

  const result = await query(
    "submittedDB",
    "ngReportsDB",
    {},
    {
      aggregation: [
        ...buildNgTicketFilteredAggregationStages({ filters, advancedFilters }),
        {
          $facet: {
            data: [
              { $sort: sortStage },
              { $skip: skip },
              { $limit: safeLimit },
            ],
            totalCount: [
              { $count: "count" },
            ],
            summary: [
              {
                $group: {
                  _id: null,
                  totalTickets: { $sum: 1 },
                  imageTickets: { $sum: { $cond: ["$hasImages", 1, 0] } },
                  recordIds: { $addToSet: "$recordId" },
                  machineKeys: {
                    $addToSet: {
                      $cond: [
                        { $ne: ["$machineId", ""] },
                        "$machineId",
                        "$machineName",
                      ],
                    },
                  },
                  operatorNames: { $addToSet: "$completedBy" },
                },
              },
              {
                $project: {
                  _id: 0,
                  totalTickets: 1,
                  imageTickets: 1,
                  recordCount: {
                    $size: {
                      $filter: {
                        input: "$recordIds",
                        as: "value",
                        cond: { $ne: ["$$value", ""] },
                      },
                    },
                  },
                  machineCount: {
                    $size: {
                      $filter: {
                        input: "$machineKeys",
                        as: "value",
                        cond: { $ne: ["$$value", ""] },
                      },
                    },
                  },
                  operatorCount: {
                    $size: {
                      $filter: {
                        input: "$operatorNames",
                        as: "value",
                        cond: { $ne: ["$$value", ""] },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    }
  );

  const payload = extractAggregationResultDocument(result);
  const totalItems = Number(payload?.totalCount?.[0]?.count) || 0;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / safeLimit) : 0;

  if (totalItems > 0 && safePage > 1 && (!Array.isArray(payload?.data) || payload.data.length === 0)) {
    return fetchNgTicketPage({
      filters,
      advancedFilters,
      page: totalPages,
      limit: safeLimit,
      sort,
    });
  }

  const summary = payload?.summary?.[0] ?? {};

  return {
    data: Array.isArray(payload?.data) ? payload.data.map(normalizeNgReport) : [],
    summary: {
      totalTickets: Number(summary.totalTickets) || totalItems,
      imageTickets: Number(summary.imageTickets) || 0,
      recordCount: Number(summary.recordCount) || 0,
      machineCount: Number(summary.machineCount) || 0,
      operatorCount: Number(summary.operatorCount) || 0,
    },
    pagination: {
      currentPage: totalPages > 0 ? Math.min(safePage, totalPages) : 1,
      totalPages,
      totalItems,
      itemsPerPage: safeLimit,
    },
  };
}

export async function fetchNgTicketExport({ filters = {}, advancedFilters = [], sort = {} } = {}) {
  const result = await query(
    "submittedDB",
    "ngReportsDB",
    {},
    {
      aggregation: [
        ...buildNgTicketFilteredAggregationStages({ filters, advancedFilters }),
        { $sort: buildNgTicketSortStage(sort) },
      ],
    }
  );

  return Array.isArray(result) ? result.map(normalizeNgReport) : [];
}

export async function fetchNgInspectionCount() {
  const recs = await query(
    "submittedDB",
    "checkFormRecordsDB",
    { hasNG: true },
    { projection: { _id: 1 }, limit: 9999 }
  );
  return Array.isArray(recs) ? recs.length : 0;
}

export async function fetchCameraStreamUrl() {
  const res = await fetch(`${BASE_URL}api/camera-stream-url`);
  const data = await _readJson(res);
  if (!res.ok) throw new Error(data?.error || `Camera stream URL fetch failed (${res.status})`);
  return String(data.url || "");
}

// ─── PCE File Upload ──────────────────────────────────────────────────────────
export async function fetchPceMasterData() {
  return _withInFlight('pce-master-data', async () => {
    const cached = _getCached('pce-master-data', MASTER_TTL);
    if (cached) return cached;
    const data = await _getJson('api/masterdb/pce-data');
    _setCache('pce-master-data', data);
    return data;
  });
}

export async function uploadPceFiles({ fileBase64, sebanggoList, machineSuffix, entries, overwrite }) {
  const res = await fetch(`${BASE_URL}api/pce/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, sebanggoList, machineSuffix, entries, overwrite }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 409 && data.conflicts?.length) {
      const err = new Error(`Already exists in Drive — ${data.conflicts.join(", ")}`);
      err.isConflict = true;
      err.conflicts = data.conflicts;
      throw err;
    }
    const detail = data?.google
      ? JSON.stringify(data.google)
      : data?.details || data?.error || `API ${res.status}`;
    throw new Error(`${data?.error || "Upload failed"} — ${detail}`);
  }
  return data;
}

// ─── Prototype (試作) Registration ─────────────────────────────────────────────
export async function fetchShisakuList() {
  return query("Sasaki_Coating_MasterDB", "shisakuDB", {}, { sort: { createdAt: -1 } });
}

export async function registerShisaku({ shisakuNo, deadline, eventName, modelName, customerName, registeredBy, cybozuLink, dxfFile, pdfFile, pdfImageFile, pceFiles }) {
  const res = await fetch(`${BASE_URL}api/shisaku/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shisakuNo, deadline, eventName, modelName, customerName, registeredBy, cybozuLink, dxfFile, pdfFile, pdfImageFile, pceFiles }),
  });
  const data = await _readJson(res);
  if (!res.ok) {
    const detail = data?.google ? JSON.stringify(data.google) : data?.details || data?.error || `API ${res.status}`;
    throw new Error(`${data?.error || "Registration failed"} — ${detail}`);
  }
  return data;
}

export async function deleteShisaku(id) {
  return _deleteJson(`api/shisaku/${encodeURIComponent(id)}`);
}

// ─── Prototype Request (試作依頼) ───────────────────────────────────────────────
export async function fetchShisakuRequestList() {
  return query("Sasaki_Coating_MasterDB", "shisakuRequestDB", {}, { sort: { createdAt: -1 } });
}

export async function registerShisakuRequest({ name, pce, okuriPitch, color, material, boxType, quantity, pdfLink, shisakudb_id }) {
  return _postJson("api/shisaku-request/register", { name, pce, okuriPitch, color, material, boxType, quantity, pdfLink, shisakudb_id });
}

export async function deleteShisakuRequest(id) {
  return _deleteJson(`api/shisaku-request/${encodeURIComponent(id)}`);
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
