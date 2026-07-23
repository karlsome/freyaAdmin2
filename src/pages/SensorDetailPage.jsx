import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import { fetchHistoricalSensorExport, fetchHistoricalSensorOverview, fetchHistoricalSensorReadingsPage, calcWBGT, fetchIoTDeviceNames, saveIoTDeviceName, uploadIoTDeviceImage, deleteIoTDeviceImage } from "../services/api";
import { getTempStatus, getHumidityStatus, getWBGTStatus } from "../utils/statusHelpers";
import SensorTrendChart from "../components/SensorTrendChart";
import DeviceNamingModal from "../components/DeviceNamingModal";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";
import { getAuthUser } from "../utils/masterDB";

const SENSOR_READINGS_PAGE_SIZE_OPTIONS = [15, 50, 100];
const SENSOR_DEVICE_OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;
const EMPTY_SENSOR_PAGINATION = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: SENSOR_READINGS_PAGE_SIZE_OPTIONS[0],
};
const EMPTY_SENSOR_OVERVIEW = {
  avgHumid: null,
  avgTemp: null,
  devices: [],
  heatAlerts: 0,
  latestDevices: [],
  minTemp: null,
  peakTemp: null,
  totalReadings: 0,
  trends: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseTemp(v) { return parseFloat(String(v ?? "").replace("°C", "").trim()); }
function parseHumid(v) { return parseFloat(String(v ?? "").replace("%", "").trim()); }
function normalizeDeviceId(value) { return String(value ?? "").trim(); }

function parseSensorTimestamp(dateValue, timeValue) {
  const normalizedDate = String(dateValue ?? "").trim();
  const normalizedTime = String(timeValue ?? "").trim() || "00:00:00";

  if (!normalizedDate) return null;

  const isoCandidate = new Date(`${normalizedDate}T${normalizedTime}`);
  if (!Number.isNaN(isoCandidate.getTime())) {
    return isoCandidate;
  }

  const fallbackCandidate = new Date(`${normalizedDate} ${normalizedTime}`);
  if (!Number.isNaN(fallbackCandidate.getTime())) {
    return fallbackCandidate;
  }

  return null;
}

function getMinutesSinceTimestamp(timestamp, currentTimestamp = Date.now()) {
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return Math.max(0, Math.floor((currentTimestamp - timestamp.getTime()) / 60000));
}

function formatSensorLastSeen(minutesSinceLastReading) {
  if (minutesSinceLastReading == null) return "Last seen unknown";
  if (minutesSinceLastReading < 1) return "Last seen just now";
  if (minutesSinceLastReading < 60) return `Last seen ${minutesSinceLastReading} min ago`;

  const hours = Math.floor(minutesSinceLastReading / 60);
  const minutes = minutesSinceLastReading % 60;
  if (minutes === 0) return `Last seen ${hours} hr ago`;
  return `Last seen ${hours} hr ${minutes} min ago`;
}

function toISO(d) { return d.toISOString().split("T")[0]; }

function dateRangeDefault() {
  const end   = new Date();
  const start = new Date();
  return { start: toISO(start), end: toISO(end) };
}

function buildSensorReadingsPageInfo({ filteredCount, page, pageSize }) {
  if (!filteredCount) return "0 readings shown";

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredCount);
  return `${filteredCount.toLocaleString()} readings, showing ${start.toLocaleString()}-${end.toLocaleString()}`;
}

function getSensorTableSort(sortKey) {
  if (sortKey === "date_asc") return { column: "date", direction: 1 };
  if (sortKey === "temp_desc") return { column: "temperature", direction: -1 };
  if (sortKey === "temp_asc") return { column: "temperature", direction: 1 };
  return { column: "date", direction: -1 };
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
function SensorCard({
  device,
  isActive = false,
  offset = 0,
  onSelect = null,
  onEdit = null,
  onPreviewPhotos = null
}) {
  const latest = device?.latest ?? {};
  const latestTemp = parseTemp(latest.Temperature);
  const latestHumid = parseHumid(latest.Humidity);
  const wbgt = calcWBGT(latestTemp, latestHumid);
  const tempStatus = getTempStatus(latestTemp);
  const humidityStatus = getHumidityStatus(latestHumid);
  const wbgtStatus = getWBGTStatus(wbgt);
  const tempTrend = Array.isArray(device?.tempTrend) ? device.tempTrend.filter((value) => value != null) : [];
  const humidityTrend = Array.isArray(device?.humidityTrend) ? device.humidityTrend.filter((value) => value != null) : [];
  const displayName = device?.displayName || null;
  const photoCount = Array.isArray(device?.imageURLs) ? device.imageURLs.filter(Boolean).length : 0;
  const isOffline = Boolean(device?.isOffline);
  const lastSeenLabel = formatSensorLastSeen(device?.minutesSinceLastReading);
  const cardStateClassName = isOffline
    ? `sensor-device-card--offline border-error/35 hover:border-error/45 ${isActive ? "ring-1 ring-inset ring-error/15" : ""}`
    : isActive
      ? "bg-primary/[0.06] shadow-[0_16px_36px_rgba(99,102,241,0.14)]"
      : "";
  const titleClassName = isOffline ? "text-error" : isActive ? "text-primary" : "text-on-surface";

  function handleCardKeyDown(event) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect?.(device?.deviceId || "all");
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(device?.deviceId || "all")}
      onKeyDown={handleCardKeyDown}
      aria-pressed={isActive}
      className={`glass-card relative flex w-full cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl p-5 text-left transition-all duration-150 hover:border-primary/30 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${cardStateClassName}`}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-3 bottom-3 w-1 rounded-full bg-primary shadow-[0_0_12px_rgba(99,102,241,0.35)]"
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Device</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className={`text-base font-semibold truncate ${titleClassName}`}>
              {displayName || device?.deviceId || "Unknown"}
            </p>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check</span>
                Selected
              </span>
            ) : null}
            {isOffline ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-error/20 bg-error/10 px-2.5 py-1 text-[10px] font-semibold text-error">
                <span className="h-2 w-2 rounded-full bg-error" aria-hidden="true" />
                Offline
              </span>
            ) : null}
          </div>
          {displayName && (
            <p className="mt-0.5 font-mono text-[10px] text-outline truncate">{device?.deviceId}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${wbgtStatus.bg} ${wbgtStatus.color}`}>
            WBGT {wbgt ?? "—"}°C
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-xl ${tempStatus.bg}`}>
          <div className="flex items-center gap-2">
            <p className={`text-lg font-semibold ${tempStatus.color}`}>{Number.isNaN(latestTemp) ? "—" : `${latestTemp}°C`}</p>
            {offset ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface/50 text-on-surface-variant border border-outline-variant/30 whitespace-nowrap" title="Temperature Offset">
                {offset > 0 ? "+" : ""}{offset}°C
              </span>
            ) : null}
          </div>
          <p className="text-[10px] text-on-surface-variant">Temperature</p>
          <Sparkline values={tempTrend} color={latestTemp >= 30 ? "#f87171" : "#6366f1"} />
        </div>
        <div className={`p-3 rounded-xl ${humidityStatus.bg}`}>
          <p className={`text-lg font-semibold ${humidityStatus.color}`}>{Number.isNaN(latestHumid) ? "—" : `${latestHumid}%`}</p>
          <p className="text-[10px] text-on-surface-variant">Humidity</p>
          <Sparkline values={humidityTrend} color="#22d3ee" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-[10px] text-outline">
        <div className="min-w-0 flex-1 truncate">
          <span className={isOffline ? "font-semibold text-error" : undefined}>
            {isOffline ? `Offline · ${lastSeenLabel}` : `Last: ${latest?.Date || "—"} ${latest?.Time || ""}`}
          </span>
          <span> · {Number(device?.readingCount) || 0} readings</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {photoCount > 0 && onPreviewPhotos ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPreviewPhotos(device);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-separator/40 bg-surface px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95"
              title={`View ${photoCount} device photo${photoCount === 1 ? "" : "s"}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>photo_library</span>
              {photoCount}
            </button>
          ) : null}

          {onEdit ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(device);
              }}
              className="rounded-xl p-2 text-outline transition-all duration-150 hover:bg-surface-container hover:text-primary active:scale-95"
              title="Rename device"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SensorDetailPage() {
  const { factoryName: encoded } = useParams();
  const factoryName = decodeURIComponent(encoded);
  const navigate    = useNavigate();
  const overviewRequestIdRef = useRef(0);
  const cardOverviewRequestIdRef = useRef(0);
  const tableRequestIdRef = useRef(0);
  const defaultRange = useMemo(() => dateRangeDefault(), []);

  const [range, setRange]       = useState(dateRangeDefault);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [overview, setOverview] = useState(EMPTY_SENSOR_OVERVIEW);
  const [cardOverview, setCardOverview] = useState(EMPTY_SENSOR_OVERVIEW);
  const [loading, setLoading]   = useState(true);
  const [cardLoading, setCardLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState("");
  const [sortKey, setSortKey]   = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SENSOR_READINGS_PAGE_SIZE_OPTIONS[0]);
  const [tableRows, setTableRows] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_SENSOR_PAGINATION);
  const [exporting, setExporting] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  // IoT device naming
  const [iotNamesMap, setIoTNamesMap] = useState(new Map());
  const [namingDevice, setNamingDevice] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const loadIoTNames = useCallback(async () => {
    try {
      const records = await fetchIoTDeviceNames(factoryName);
      const nextMap = new Map();
      if (Array.isArray(records)) {
        records.forEach((r) => {
          if (r?.deviceId) {
            nextMap.set(String(r.deviceId).trim(), {
              name: r.name || "",
              imageURLs: Array.isArray(r.imageURLs) ? r.imageURLs : [],
              offset: Number(r.offset) || 0,
            });
          }
        });
      }
      setIoTNamesMap(nextMap);
    } catch {
      // non-fatal — device IDs will show as-is
    }
  }, [factoryName]);

  useEffect(() => {
    void loadIoTNames();
  }, [loadIoTNames]);

  function getDisplayName(deviceId) {
    return iotNamesMap.get(String(deviceId || "").trim())?.name || null;
  }

  function handleOpenNaming(device) {
    const id = String(device?.deviceId || "").trim();
    const existing = iotNamesMap.get(id) || { name: "", imageURLs: [], offset: 0 };
    setNamingDevice({ deviceId: id, name: existing.name, imageURLs: existing.imageURLs, offset: existing.offset });
  }

  function handleOpenPhotoPreview(device) {
    const imageURLs = Array.isArray(device?.imageURLs) ? device.imageURLs.filter(Boolean) : [];
    if (imageURLs.length === 0) return;

    setPhotoPreview({
      activeIndex: 0,
      eyebrow: "Device Photos",
      deviceId: normalizeDeviceId(device?.deviceId),
      displayName: device?.displayName || "",
      factoryName,
      images: imageURLs.map((url, index) => ({
        url,
        label: `${device?.displayName || device?.deviceId || "Device"} photo ${index + 1}`,
      })),
    });
  }

  function handleNavigatePhotoPreview(direction) {
    setPhotoPreview((current) => {
      if (!current) return current;

      const imageCount = Array.isArray(current.images) ? current.images.length : 0;
      if (!imageCount) return current;

      const nextIndex = current.activeIndex + direction;
      if (nextIndex < 0 || nextIndex >= imageCount) return current;

      return {
        ...current,
        activeIndex: nextIndex,
      };
    });
  }

  async function handleSaveName({ name, imageURLs, offset }) {
    if (!namingDevice) return;
    setSavingName(true);
    try {
      const authUser = getAuthUser();
      await saveIoTDeviceName({
        deviceId: namingDevice.deviceId,
        factoryName,
        name,
        imageURLs,
        username: authUser?.username || "",
        offset,
      });
      setIoTNamesMap((prev) => {
        const next = new Map(prev);
        next.set(namingDevice.deviceId, { name, imageURLs, offset });
        return next;
      });
      setNamingDevice(null);
    } catch (err) {
      // surface error without closing the modal — the modal has its own error display
      console.error("Failed to save device name:", err);
    } finally {
      setSavingName(false);
    }
  }

  async function handleUploadDeviceImage({ base64, deviceId, factoryName: fn }) {
    const authUser = getAuthUser();
    return uploadIoTDeviceImage({ base64, deviceId, factoryName: fn, username: authUser?.username || "" });
  }

  async function handleDeleteDeviceImage({ deviceId, factoryName: fn, imageUrl }) {
    const authUser = getAuthUser();
    return deleteIoTDeviceImage({ deviceId, factoryName: fn, imageUrl, username: authUser?.username || "" });
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++overviewRequestIdRef.current;

    async function loadOverview() {
      setLoading(true);

      try {
        const data = await fetchHistoricalSensorOverview({
          factoryName,
          startDate: range.start,
          endDate: range.end,
          deviceId: deviceFilter,
          offsets: Object.fromEntries(Array.from(iotNamesMap.entries()).map(([k, v]) => [k, v.offset]).filter(([k, v]) => v)),
        });

        if (cancelled || requestId !== overviewRequestIdRef.current) return;
        setOverview(data || EMPTY_SENSOR_OVERVIEW);
      } catch {
        if (cancelled || requestId !== overviewRequestIdRef.current) return;
        setOverview(EMPTY_SENSOR_OVERVIEW);
      } finally {
        if (!cancelled && requestId === overviewRequestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [deviceFilter, factoryName, range.end, range.start, iotNamesMap]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++cardOverviewRequestIdRef.current;

    async function loadCardOverview() {
      setCardLoading(true);

      try {
        const data = await fetchHistoricalSensorOverview({
          factoryName,
          startDate: range.start,
          endDate: range.end,
          deviceId: "all",
          offsets: Object.fromEntries(Array.from(iotNamesMap.entries()).map(([k, v]) => [k, v.offset]).filter(([k, v]) => v)),
        });

        if (cancelled || requestId !== cardOverviewRequestIdRef.current) return;
        setCardOverview(data || EMPTY_SENSOR_OVERVIEW);
      } catch {
        if (cancelled || requestId !== cardOverviewRequestIdRef.current) return;
        setCardOverview(EMPTY_SENSOR_OVERVIEW);
      } finally {
        if (!cancelled && requestId === cardOverviewRequestIdRef.current) {
          setCardLoading(false);
        }
      }
    }

    void loadCardOverview();

    return () => {
      cancelled = true;
    };
  }, [factoryName, range.end, range.start, iotNamesMap]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCardOverviewSilently() {
      try {
        const data = await fetchHistoricalSensorOverview({
          factoryName,
          startDate: range.start,
          endDate: range.end,
          deviceId: "all",
          offsets: Object.fromEntries(Array.from(iotNamesMap.entries()).map(([k, v]) => [k, v.offset]).filter(([k, v]) => v)),
        });

        if (cancelled) return;
        const requestId = ++cardOverviewRequestIdRef.current;
        setCardOverview(data || EMPTY_SENSOR_OVERVIEW);
        setCurrentTimestamp(Date.now());
        cardOverviewRequestIdRef.current = requestId;
      } catch {
        // Silent background refresh — keep stale data on failure.
      }
    }

    const intervalId = window.setInterval(refreshCardOverviewSilently, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [factoryName, range.end, range.start, iotNamesMap]);

  useEffect(() => {
    if (deviceFilter === "all") return;
    if (overview.devices.length === 0) return;
    if (!overview.devices.includes(deviceFilter)) {
      setDeviceFilter("all");
    }
  }, [deviceFilter, overview.devices]);

  useEffect(() => {
    setPage(1);
  }, [deviceFilter, factoryName, range.end, range.start, sortKey]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++tableRequestIdRef.current;

    async function loadReadingsPage() {
      setTableLoading(true);
      setTableError("");

      try {
        const result = await fetchHistoricalSensorReadingsPage({
          factoryName,
          startDate: range.start,
          endDate: range.end,
          deviceId: deviceFilter,
          sortKey,
          page,
          limit: pageSize,
          offsets: Object.fromEntries(Array.from(iotNamesMap.entries()).map(([k, v]) => [k, v.offset]).filter(([k, v]) => v)),
        });

        if (cancelled || requestId !== tableRequestIdRef.current) return;

        setTableRows(Array.isArray(result?.data) ? result.data : []);
        setPagination(result?.pagination || { ...EMPTY_SENSOR_PAGINATION, itemsPerPage: pageSize });

        if (result?.pagination?.currentPage && result.pagination.currentPage !== page) {
          setPage(result.pagination.currentPage);
        }
      } catch (loadError) {
        if (cancelled || requestId !== tableRequestIdRef.current) return;
        setTableRows([]);
        setPagination({ ...EMPTY_SENSOR_PAGINATION, itemsPerPage: pageSize });
        setTableError(loadError.message || "Failed to load sensor readings.");
      } finally {
        if (!cancelled && requestId === tableRequestIdRef.current) {
          setTableLoading(false);
        }
      }
    }

    void loadReadingsPage();

    return () => {
      cancelled = true;
    };
  }, [deviceFilter, factoryName, page, pageSize, range.end, range.start, sortKey, iotNamesMap]);

  const devices = useMemo(() => Array.from(new Set(
    (Array.isArray(overview.devices) ? overview.devices : [])
      .map((deviceId) => normalizeDeviceId(deviceId))
      .filter(Boolean)
  )), [overview.devices]);
  const sensorKPIs = useMemo(() => ({
    avgTemp: overview.avgTemp,
    peakTemp: overview.peakTemp,
    minTemp: overview.minTemp,
    avgHumid: overview.avgHumid,
    heatAlerts: overview.heatAlerts,
  }), [overview.avgHumid, overview.avgTemp, overview.heatAlerts, overview.minTemp, overview.peakTemp]);

  const deviceCards = useMemo(() => {
    const trendMap = new Map();

    cardOverview.trends.forEach((row) => {
      const deviceId = String(row?.device ?? "").trim() || "unknown";
      if (!trendMap.has(deviceId)) {
        trendMap.set(deviceId, { humidityTrend: [], tempTrend: [] });
      }

      const entry = trendMap.get(deviceId);
      const temperature = Number(row?.Temperature);
      const humidity = Number(row?.Humidity);

      entry.tempTrend.push(Number.isFinite(temperature) ? temperature : null);
      entry.humidityTrend.push(Number.isFinite(humidity) ? humidity : null);
    });

    return cardOverview.latestDevices.map((device) => {
      const normalizedDeviceId = normalizeDeviceId(device?.deviceId) || "unknown";
      const trendEntry = trendMap.get(normalizedDeviceId) || { humidityTrend: [], tempTrend: [] };
      const iotEntry = iotNamesMap.get(normalizedDeviceId);
      const latestTimestamp = parseSensorTimestamp(device?.latest?.Date, device?.latest?.Time);
      const minutesSinceLastReading = getMinutesSinceTimestamp(latestTimestamp, currentTimestamp);
      const isOffline = minutesSinceLastReading == null || minutesSinceLastReading >= SENSOR_DEVICE_OFFLINE_THRESHOLD_MS / 60000;

      return {
        ...device,
        deviceId: normalizedDeviceId,
        humidityTrend: trendEntry.humidityTrend,
        tempTrend: trendEntry.tempTrend,
        displayName: iotEntry?.name || null,
        imageURLs: Array.isArray(iotEntry?.imageURLs) ? iotEntry.imageURLs : [],
        isOffline,
        minutesSinceLastReading,
      };
    });
  }, [cardOverview.latestDevices, cardOverview.trends, currentTimestamp, iotNamesMap]);

  async function handleExport() {
    if (exporting || overview.totalReadings === 0) return;

    setExporting(true);
    try {
      const exportRows = await fetchHistoricalSensorExport({
        factoryName,
        startDate: range.start,
        endDate: range.end,
        deviceId: deviceFilter,
        sortKey,
        offsets: Object.fromEntries(Array.from(iotNamesMap.entries()).map(([k, v]) => [k, v.offset]).filter(([k, v]) => v)),
      });
      exportCSV(exportRows, factoryName);
    } finally {
      setExporting(false);
    }
  }

  function handleSelectDevice(nextDeviceId) {
    const normalizedDeviceId = normalizeDeviceId(nextDeviceId) || "all";
    setDeviceFilter((current) => (current === normalizedDeviceId ? "all" : normalizedDeviceId));
  }

  function handleResetFilters() {
    setRange(defaultRange);
    setDeviceFilter("all");
    setSortKey("date_desc");
  }

  function handleTableSort(column) {
    setSortKey((current) => {
      if (column === "date") {
        return current === "date_asc" ? "date_desc" : "date_asc";
      }

      if (column === "temperature") {
        return current === "temp_asc" ? "temp_desc" : "temp_asc";
      }

      return current;
    });
  }

  const hasActiveFilters = deviceFilter !== "all"
    || sortKey !== "date_desc"
    || range.start !== defaultRange.start
    || range.end !== defaultRange.end;
  const tableSort = useMemo(() => getSensorTableSort(sortKey), [sortKey]);

  const tableColumns = useMemo(() => ([
    {
      key: "Date",
      label: "Date",
      sortKey: "date",
      width: 128,
      renderCell: (row) => <span className="text-on-surface-variant">{row.Date || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "Time",
      label: "Time",
      width: 116,
      renderCell: (row) => <span className="text-on-surface-variant">{row.Time || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "device",
      label: "Device",
      width: 224,
      renderCell: (row) => {
        const friendlyName = getDisplayName(row.device);
        return friendlyName ? (
          <div>
            <span className="text-sm font-semibold text-on-surface">{friendlyName}</span>
            <p className="font-mono text-[10px] text-outline">{row.device || "—"}</p>
          </div>
        ) : (
          <span className="font-mono text-on-surface">{row.device || "—"}</span>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "temperature",
      label: "Temp",
      sortKey: "temperature",
      width: 128,
      renderCell: (row) => {
        const temperature = parseTemp(row.Temperature);
        const meta = getTempStatus(temperature);
        return <span className={`font-semibold ${meta.color}`}>{Number.isNaN(temperature) ? "—" : `${temperature}°C`}</span>;
      },
      disableCellWrapper: true,
    },
    {
      key: "humidity",
      label: "Humidity",
      width: 132,
      sortable: false,
      renderCell: (row) => {
        const humidity = parseHumid(row.Humidity);
        const meta = getHumidityStatus(humidity);
        return <span className={`font-semibold ${meta.color}`}>{Number.isNaN(humidity) ? "—" : `${humidity}%`}</span>;
      },
      disableCellWrapper: true,
    },
    {
      key: "wbgt",
      label: "WBGT",
      width: 124,
      sortable: false,
      renderCell: (row) => {
        const temperature = parseTemp(row.Temperature);
        const humidity = parseHumid(row.Humidity);
        const wbgt = calcWBGT(temperature, humidity);
        const meta = getWBGTStatus(wbgt);
        return <span className={`font-semibold ${meta.color}`}>{wbgt ?? "—"}°C</span>;
      },
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: "Status",
      width: 116,
      sortable: false,
      renderCell: (row) => {
        const temperature = parseTemp(row.Temperature);
        const humidity = parseHumid(row.Humidity);
        const wbgt = calcWBGT(temperature, humidity);
        const meta = getWBGTStatus(wbgt);
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
            {row.sensorStatus ?? "OK"}
          </span>
        );
      },
      disableCellWrapper: true,
    },
  ]), [iotNamesMap]);

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        leading={(
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        bodyClassName="items-start"
        title={(
          <>
            <span className="material-symbols-outlined text-tertiary">sensors</span>
            {factoryName} - Sensor Data
          </>
        )}
        titleClassName="flex items-center gap-3"
        subtitle={`${range.start} → ${range.end} · ${overview.totalReadings.toLocaleString()} readings`}
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={(
          <button
            onClick={handleExport}
            disabled={overview.totalReadings === 0 || exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all disabled:opacity-40"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        )}
      />

      {/* ── Filter bar ── */}
      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-semibold uppercase tracking-wider">From</span>
          <input
            type="date"
            value={range.start}
            max={range.end}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all duration-150"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-semibold uppercase tracking-wider">To</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            max={toISO(new Date())}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all duration-150"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-semibold uppercase tracking-wider">Device</span>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(normalizeDeviceId(e.target.value) || "all")}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-150"
          >
            <option value="all">All Devices</option>
            {devices.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-outline font-semibold uppercase tracking-wider">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-150"
          >
            <option value="date_desc">Latest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="temp_desc">Temp High → Low</option>
            <option value="temp_asc">Temp Low → High</option>
          </select>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-error transition hover:bg-error/15"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
            Reset Filters
          </button>
        ) : null}
        <div className="ml-auto flex gap-2">
          {["7d", "14d", "30d"].map((preset) => {
            const days = parseInt(preset);
            const s = new Date(); s.setDate(s.getDate() - (days - 1));
            return (
              <button
                key={preset}
                onClick={() => setRange({ start: toISO(s), end: toISO(new Date()) })}
                className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary text-outline transition-colors"
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: `Avg Temperature${deviceFilter !== "all" && iotNamesMap.get(normalizeDeviceId(deviceFilter))?.offset ? ` (Offset: ${iotNamesMap.get(normalizeDeviceId(deviceFilter)).offset > 0 ? "+" : ""}${iotNamesMap.get(normalizeDeviceId(deviceFilter)).offset}°C)` : ""}`,
                value: sensorKPIs.avgTemp !== null ? `${sensorKPIs.avgTemp}°C` : "—",
                sub: sensorKPIs.minTemp !== null ? `Min ${sensorKPIs.minTemp}°C` : null,
                icon: "thermostat",
                color: getTempStatus(sensorKPIs.avgTemp).color,
                bg: getTempStatus(sensorKPIs.avgTemp).bg,
              },
              {
                label: `Peak Temperature${deviceFilter !== "all" && iotNamesMap.get(normalizeDeviceId(deviceFilter))?.offset ? ` (Offset: ${iotNamesMap.get(normalizeDeviceId(deviceFilter)).offset > 0 ? "+" : ""}${iotNamesMap.get(normalizeDeviceId(deviceFilter)).offset}°C)` : ""}`,
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
                  <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">{label}</p>
                </div>
                <p className={`text-2xl font-semibold ${color}`}>{value}</p>
                {sub && <p className="text-[10px] text-outline mt-1">{sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Trend charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>thermostat</span>
                <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.15em]">
                  Temperature Trend ({range.start === range.end ? "hourly" : "daily"} avg)
                </p>
              </div>
              <SensorTrendChart readings={overview.trends} type="temp" height={180} deviceNamesMap={iotNamesMap} />
            </div>
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 16 }}>water_drop</span>
                <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.15em]">
                  Humidity Trend ({range.start === range.end ? "hourly" : "daily"} avg)
                </p>
              </div>
              <SensorTrendChart readings={overview.trends} type="humid" height={180} deviceNamesMap={iotNamesMap} />
            </div>
          </div>

          {/* ── Device summary cards ── */}
          {!cardLoading && deviceCards.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em] mb-4">
                {deviceCards.length} Device{deviceCards.length !== 1 ? "s" : ""} — Latest Readings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {deviceCards.map((device) => (
                  <SensorCard
                    key={device.deviceId}
                    device={device}
                    offset={iotNamesMap.get(device.deviceId)?.offset || 0}
                    isActive={normalizeDeviceId(deviceFilter) === normalizeDeviceId(device.deviceId)}
                    onSelect={handleSelectDevice}
                    onEdit={handleOpenNaming}
                    onPreviewPhotos={handleOpenPhotoPreview}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Records table ── */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-on-surface">All Readings</h3>
              <span className="text-[10px] text-outline font-semibold uppercase tracking-wider">
                {(pagination.totalItems || tableRows.length).toLocaleString()} rows
              </span>
            </div>
            <DataTable
              columns={tableColumns}
              rows={tableRows}
              loading={tableLoading}
              error={tableError}
              sort={tableSort}
              page={pagination.currentPage || page}
              pageSize={pagination.itemsPerPage || pageSize}
              filteredCount={pagination.totalItems || tableRows.length}
              totalPages={pagination.totalPages || 0}
              onSort={handleTableSort}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              pageSizeOptions={SENSOR_READINGS_PAGE_SIZE_OPTIONS}
              pageSizeLabel="Rows"
              rowKey={(row) => `${row.Date || ""}-${row.Time || ""}-${row.device || "sensor"}`}
              renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
                <span>{buildSensorReadingsPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize })}</span>
              )}
              emptyTitle="No sensor readings found"
              emptyMessage="Adjust the date range or device filter to load sensor readings."
              layoutStorageKey="sensor-readings-table-layout"
              enableColumnResize
              enableColumnReorder
              stickyHeader
              stickyHeaderOffset={0}
              className="overflow-hidden rounded-2xl"
              topBarClassName="mb-4 flex flex-wrap items-center justify-end gap-3 px-1"
              topInfoClassName="hidden"
              bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-1 pt-4 md:flex-row md:items-center md:justify-between"
              rowClassName="border-b border-outline-variant/10 transition hover:bg-surface-container"
              rowsSelectClassName="h-10 rounded-2xl border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
            />
          </div>
        </>
      )}

      <DeviceNamingModal
        open={namingDevice !== null}
        deviceId={namingDevice?.deviceId || ""}
        factoryName={factoryName}
        initialName={namingDevice?.name || ""}
        initialImageURLs={namingDevice?.imageURLs || []}
        initialOffset={namingDevice?.offset || 0}
        saving={savingName}
        onClose={() => setNamingDevice(null)}
        onSave={handleSaveName}
        onUploadImage={handleUploadDeviceImage}
        onDeleteImage={handleDeleteDeviceImage}
      />

      <SensorDevicePhotoPreviewModal
        preview={photoPreview}
        onClose={() => setPhotoPreview(null)}
        onNavigate={handleNavigatePhotoPreview}
      />
    </section>
  );
}
