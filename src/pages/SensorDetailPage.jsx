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

// Sensor `Date` fields are written in JST (factory-local time). `toISOString()`
// is UTC, which lags JST by up to 9 hours and misses today's readings between
// 00:00-09:00 JST — format against Asia/Tokyo instead when matching sensor data.
function toISO(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(d); }

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
    ? `border-[var(--status-danger)]/40 hover:border-[var(--status-danger)]/60 ${isActive ? "ring-1 ring-[var(--status-danger)]/30" : ""}`
    : isActive
      ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)]/30 bg-[var(--surface-subtle)]"
      : "hover:border-[var(--border-strong)]";
  const titleClassName = isOffline ? "text-[var(--status-danger)]" : isActive ? "text-[var(--freya-blue)]" : "text-[var(--text-primary)]";

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
      className={`freya-card relative flex w-full cursor-pointer flex-col gap-3 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--freya-blue)] ${cardStateClassName}`}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[var(--freya-blue)]"
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Device</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className={`text-sm font-semibold truncate ${titleClassName}`}>
              {displayName || device?.deviceId || "Unknown"}
            </p>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-mono font-medium text-[var(--freya-blue)]">
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check</span>
                Selected
              </span>
            ) : null}
            {isOffline ? (
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2 py-0.5 text-[10px] font-mono font-medium text-[var(--status-danger)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-danger)]" aria-hidden="true" />
                Offline
              </span>
            ) : null}
          </div>
          {displayName && (
            <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)] truncate">{device?.deviceId}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[10px] font-mono font-medium ${wbgtStatus.bg} ${wbgtStatus.color}`}>
            WBGT {wbgt ?? "—"}°C
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className={`p-2.5 rounded-[6px] border border-[var(--border)] ${tempStatus.bg}`}>
          <div className="flex items-center gap-1.5">
            <p className={`text-base font-bold font-mono ${tempStatus.color}`}>{Number.isNaN(latestTemp) ? "—" : `${latestTemp}°C`}</p>
            {offset ? (
              <span className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded-[3px] bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] whitespace-nowrap" title="Temperature Offset">
                {offset > 0 ? "+" : ""}{offset}°C
              </span>
            ) : null}
          </div>
          <p className="text-[10px] font-medium text-[var(--text-muted)] mt-0.5">Temperature</p>
          <Sparkline values={tempTrend} color={latestTemp >= 30 ? "#f87171" : "var(--freya-blue)"} />
        </div>
        <div className={`p-2.5 rounded-[6px] border border-[var(--border)] ${humidityStatus.bg}`}>
          <p className={`text-base font-bold font-mono ${humidityStatus.color}`}>{Number.isNaN(latestHumid) ? "—" : `${latestHumid}%`}</p>
          <p className="text-[10px] font-medium text-[var(--text-muted)] mt-0.5">Humidity</p>
          <Sparkline values={humidityTrend} color="#22d3ee" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
        <div className="min-w-0 flex-1 truncate">
          <span className={isOffline ? "font-semibold text-[var(--status-danger)]" : undefined}>
            {isOffline ? `Offline · ${lastSeenLabel}` : `Last: ${latest?.Date || "—"} ${latest?.Time || ""}`}
          </span>
          <span className="font-mono"> · {Number(device?.readingCount) || 0} readings</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {photoCount > 0 && onPreviewPhotos ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPreviewPhotos(device);
              }}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors"
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
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors"
              title="Rename device"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function YearSelectionModal({ isOpen, onClose, onApply, initialSelectedYears }) {
  const [selected, setSelected] = useState(initialSelectedYears);
  
  useEffect(() => {
    if (isOpen) setSelected(initialSelectedYears);
  }, [isOpen, initialSelectedYears]);

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2021 }, (_, i) => String(2022 + i));

  const toggleYear = (y) => {
    setSelected(prev => prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="freya-card w-full max-w-sm rounded-[12px] overflow-hidden shadow-2xl border border-[var(--border)] bg-[var(--surface-raised)] animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[var(--freya-blue)]">calendar_month</span>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Select Years</h2>
        </div>
        
        <div className="p-5">
          <div className="grid grid-cols-2 gap-2.5">
            {yearOptions.map(year => (
              <label key={year} className={`flex items-center gap-2.5 p-2.5 rounded-[6px] border transition-colors cursor-pointer ${selected.includes(year) ? 'bg-[var(--surface-subtle)] border-[var(--freya-blue)]/50' : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]'}`}>
                <input 
                  type="checkbox" 
                  checked={selected.includes(year)}
                  onChange={() => toggleYear(year)}
                  className="w-4 h-4 text-[var(--freya-blue)] rounded border-[var(--border)] focus:ring-[var(--freya-blue)]"
                />
                <span className={`text-xs font-semibold ${selected.includes(year) ? 'text-[var(--freya-blue)]' : 'text-[var(--text-primary)]'}`}>{year}</span>
              </label>
            ))}
          </div>
          {selected.length === 0 && (
            <p className="text-xs text-[var(--status-danger)] mt-3 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              Please select at least one year.
            </p>
          )}
        </div>

        <div className="px-5 py-3 bg-[var(--surface-subtle)] border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(selected)}
            disabled={selected.length === 0}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SensorDetailPage() {
  const { factoryName: encoded } = useParams();
  const factoryName = decodeURIComponent(encoded);
  const navigate    = useNavigate();
  const overviewRequestIdRef = useRef(0);
  const cardOverviewRequestIdRef = useRef(0);
  const tableRequestIdRef = useRef(0);
  const defaultRange = useMemo(() => dateRangeDefault(), []);

  const [range, setRange]       = useState(dateRangeDefault);
  const [rangeMode, setRangeMode] = useState("date"); // "date" or "years"
  const [selectedYears, setSelectedYears] = useState([String(new Date().getFullYear())]);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
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
          startDate: rangeMode === "date" ? range.start : undefined,
          endDate: rangeMode === "date" ? range.end : undefined,
          years: rangeMode === "years" ? selectedYears : undefined,
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
  }, [deviceFilter, factoryName, range.end, range.start, rangeMode, selectedYears, iotNamesMap]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++cardOverviewRequestIdRef.current;

    async function loadCardOverview() {
      setCardLoading(true);

      try {
        const data = await fetchHistoricalSensorOverview({
          factoryName,
          startDate: rangeMode === "date" ? range.start : undefined,
          endDate: rangeMode === "date" ? range.end : undefined,
          years: rangeMode === "years" ? selectedYears : undefined,
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
  }, [factoryName, range.end, range.start, rangeMode, selectedYears, iotNamesMap]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCardOverviewSilently() {
      try {
        const data = await fetchHistoricalSensorOverview({
          factoryName,
          startDate: rangeMode === "date" ? range.start : undefined,
          endDate: rangeMode === "date" ? range.end : undefined,
          years: rangeMode === "years" ? selectedYears : undefined,
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
  }, [factoryName, range.end, range.start, rangeMode, selectedYears, iotNamesMap]);

  useEffect(() => {
    if (deviceFilter === "all") return;
    if (overview.devices.length === 0) return;
    if (!overview.devices.includes(deviceFilter)) {
      setDeviceFilter("all");
    }
  }, [deviceFilter, overview.devices]);

  const selectedDeviceName = useMemo(() => {
    if (!deviceFilter || deviceFilter === "all") return "All Sensors";
    const activeCard = overview.latestDevices?.find(
      (d) => normalizeDeviceId(d.deviceId) === normalizeDeviceId(deviceFilter)
    );
    if (!activeCard) return deviceFilter;
    const ioTName = iotNamesMap.get(activeCard.deviceId);
    return ioTName?.name ? `${ioTName.name} - ${activeCard.deviceId}` : activeCard.deviceId;
  }, [deviceFilter, overview.latestDevices, iotNamesMap]);

  useEffect(() => {
    setPage(1);
  }, [deviceFilter, factoryName, range.end, range.start, rangeMode, selectedYears, sortKey]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++tableRequestIdRef.current;

    async function loadReadingsPage() {
      setTableLoading(true);
      setTableError("");

      try {
        const result = await fetchHistoricalSensorReadingsPage({
          factoryName,
          startDate: rangeMode === "date" ? range.start : undefined,
          endDate: rangeMode === "date" ? range.end : undefined,
          years: rangeMode === "years" ? selectedYears : undefined,
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
  }, [deviceFilter, factoryName, page, pageSize, range.end, range.start, rangeMode, selectedYears, sortKey, iotNamesMap]);

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
      renderCell: (row) => <span className="font-mono text-xs text-[var(--text-secondary)]">{row.Date || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "Time",
      label: "Time",
      width: 116,
      renderCell: (row) => <span className="font-mono text-xs text-[var(--text-secondary)]">{row.Time || "—"}</span>,
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
            <span className="text-xs font-semibold text-[var(--text-primary)]">{friendlyName}</span>
            <p className="font-mono text-[10px] text-[var(--text-muted)]">{row.device || "—"}</p>
          </div>
        ) : (
          <span className="font-mono text-xs text-[var(--text-primary)]">{row.device || "—"}</span>
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
        return <span className={`font-mono text-xs font-semibold ${meta.color}`}>{Number.isNaN(temperature) ? "—" : `${temperature}°C`}</span>;
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
        return <span className={`font-mono text-xs font-semibold ${meta.color}`}>{Number.isNaN(humidity) ? "—" : `${humidity}%`}</span>;
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
        return <span className={`font-mono text-xs font-semibold ${meta.color}`}>{wbgt ?? "—"}°C</span>;
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
          <span className={`inline-flex rounded-[4px] border px-2 py-0.5 text-[10px] font-mono font-medium ${meta.bg} ${meta.color}`}>
            {row.sensorStatus ?? "OK"}
          </span>
        );
      },
      disableCellWrapper: true,
    },
  ]), [iotNamesMap]);

  return (
    <section className="min-h-screen max-w-[1600px] mx-auto space-y-6 pt-20 px-6 pb-12">
      <PageHeader
        leading={(
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors shadow-2xs"
            title="Go back"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
        )}
        bodyClassName="items-start"
        title={(
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)]">sensors</span>
            <span>{factoryName} - Sensor Data</span>
          </div>
        )}
        subtitle={`${rangeMode === 'date' ? `${range.start} → ${range.end}` : `Years: ${selectedYears.join(', ')}`} · ${overview.totalReadings.toLocaleString()} readings`}
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={(
          <button
            type="button"
            onClick={handleExport}
            disabled={overview.totalReadings === 0 || exporting}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        )}
      />

      {/* ── Filter bar ── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center p-0.5 bg-[var(--surface-subtle)] rounded-[6px] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setRangeMode("date")}
            className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-all ${rangeMode === "date" ? "bg-[var(--freya-blue)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            Date Range
          </button>
          <button
            type="button"
            onClick={() => setIsYearModalOpen(true)}
            className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-all ${rangeMode === "years" ? "bg-[var(--freya-blue)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            All Reading
          </button>
        </div>

        {rangeMode === "date" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">From</span>
              <input
                type="date"
                value={range.start}
                max={range.end}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">To</span>
              <input
                type="date"
                value={range.end}
                min={range.start}
                max={toISO(new Date())}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 bg-[var(--surface-subtle)] px-3 py-1 rounded-[6px] border border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">Selected Years</span>
            <span className="text-xs font-bold text-[var(--freya-blue)]">{selectedYears.join(", ")}</span>
            <button type="button" onClick={() => setIsYearModalOpen(true)} className="text-[11px] text-[var(--freya-blue)] hover:underline flex items-center gap-1 ml-2 border-l border-[var(--border)] pl-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span> Edit
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">Device</span>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(normalizeDeviceId(e.target.value) || "all")}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
          >
            <option value="all">All Devices</option>
            {devices.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
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
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
            Reset Filters
          </button>
        ) : null}
        <div className="ml-auto flex gap-1.5">
          {["7d", "14d", "30d"].map((preset) => {
            const days = parseInt(preset);
            const s = new Date(); s.setDate(s.getDate() - (days - 1));
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setRange({ start: toISO(s), end: toISO(new Date()) });
                  setRangeMode("date");
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors shadow-2xs"
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
      {loading && overview === EMPTY_SENSOR_OVERVIEW ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                color: sensorKPIs.heatAlerts > 0 ? "text-[var(--status-danger)]" : "text-[var(--text-muted)]",
                bg: sensorKPIs.heatAlerts > 0 ? "bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20" : "bg-[var(--surface)]",
              },
            ].map(({ label, value, sub, icon, color, bg }) => (
              <div key={label} className={`freya-card rounded-[8px] p-4 border border-[var(--border)] bg-[var(--surface)] shadow-sm flex flex-col justify-between ${bg}`}>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`material-symbols-outlined ${color}`} style={{ fontSize: 16 }}>{icon}</span>
                    <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">{label}</p>
                  </div>
                  <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
                </div>
                {sub && <p className="text-[11px] text-[var(--text-muted)] mt-1.5 font-medium">{sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Trend charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>thermostat</span>
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Temperature Trend ({rangeMode === 'date' && range.start === range.end ? "hourly" : "daily"} avg)
                </p>
              </div>
              <SensorTrendChart readings={overview.trends} type="temp" height={180} deviceNamesMap={iotNamesMap} />
            </div>
            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 16 }}>water_drop</span>
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Humidity Trend ({rangeMode === 'date' && range.start === range.end ? "hourly" : "daily"} avg)
                </p>
              </div>
              <SensorTrendChart readings={overview.trends} type="humid" height={180} deviceNamesMap={iotNamesMap} />
            </div>
          </div>

          {/* ── Device summary cards ── */}
          {!cardLoading && deviceCards.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.04em]">
                {deviceCards.length} Device{deviceCards.length !== 1 ? "s" : ""} — Latest Readings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                All Readings
                <span className="rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-xs font-mono font-medium text-[var(--freya-blue)]">
                  {selectedDeviceName}
                </span>
              </h3>
              <span className="text-[11px] text-[var(--text-muted)] font-mono font-medium">
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
              className="overflow-hidden rounded-[8px] border border-[var(--border)]"
              topBarClassName="mb-3 flex flex-wrap items-center justify-end gap-3 px-1"
              topInfoClassName="hidden"
              bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-2 pt-3 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
              rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
              rowsSelectClassName="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
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
      <YearSelectionModal
        isOpen={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        initialSelectedYears={selectedYears}
        onApply={(years) => {
          setSelectedYears(years);
          setRangeMode("years");
          setIsYearModalOpen(false);
        }}
      />
    </section>
  );
}
