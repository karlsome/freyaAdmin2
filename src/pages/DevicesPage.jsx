import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import DeviceDetailModal from "../components/DeviceDetailModal";
import { fetchAllIoTDevicesWithUsers } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";

const PAGE_SIZE_OPTIONS = [15, 50, 100];

function formatDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function getRegisteredName(device) {
  const first = String(device?.registeredBy?.firstName || "").trim();
  const last = String(device?.registeredBy?.lastName || "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || String(device?.username || "").trim() || "—";
}

function getDeviceDisplayName(device, t) {
  return String(device?.name || "").trim() || String(device?.deviceId || t("unknownLabel"));
}

function DeviceCard({ device, onClick }) {
  const { t } = useLanguage();
  const displayName = getDeviceDisplayName(device, t);
  const registeredBy = getRegisteredName(device);
  const factoryName = String(device?.factoryName || "—").trim() || "—";
  const photoCount = Array.isArray(device?.imageURLs) ? device.imageURLs.filter(Boolean).length : 0;

  return (
    <button
      type="button"
      onClick={() => onClick?.(device)}
      className="glass-card flex w-full flex-col gap-4 rounded-2xl p-5 text-left transition-all duration-150 hover:border-primary/30 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("deviceLabel")}</p>
          <p className="mt-1 truncate text-base font-semibold text-on-surface">{displayName}</p>
          <p className="mt-1 truncate font-mono text-[10px] text-outline">{device?.deviceId || "—"}</p>
        </div>
        {photoCount > 0 ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>photo_library</span>
            {photoCount}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <div className="flex items-center gap-2 text-outline">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>factory</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t("factory")}</span>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-on-surface">{factoryName}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <div className="flex items-center gap-2 text-outline">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t("registeredShort")}</span>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-on-surface">{registeredBy}</p>
        </div>
      </div>
    </button>
  );
}

export default function DevicesPage() {
  const { t } = useLanguage();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState({ column: "factory", direction: 1 });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAllIoTDevicesWithUsers();
      setDevices(Array.isArray(result) ? result : []);
    } catch (loadError) {
      setDevices([]);
      setError(loadError?.message || t("failedToLoadDevices"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const factoryOptions = useMemo(() => {
    const names = new Set();
    devices.forEach((device) => {
      const name = String(device?.factoryName || "").trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return devices.filter((device) => {
      if (factoryFilter !== "all" && device?.factoryName !== factoryFilter) return false;
      if (!normalizedTerm) return true;
      const haystack = [
        device?.name,
        device?.deviceId,
        device?.factoryName,
        device?.username,
        device?.registeredBy?.firstName,
        device?.registeredBy?.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [devices, factoryFilter, searchTerm]);

  const sortedDevices = useMemo(() => {
    const direction = sort.direction === -1 ? -1 : 1;
    const accessor = (device) => {
      switch (sort.column) {
        case "name": return getDeviceDisplayName(device, t).toLowerCase();
        case "deviceId": return String(device?.deviceId || "").toLowerCase();
        case "registeredBy": return getRegisteredName(device).toLowerCase();
        case "createdAt": return device?.createdAt ? new Date(device.createdAt).getTime() : 0;
        case "updatedAt": return device?.updatedAt ? new Date(device.updatedAt).getTime() : 0;
        case "factory":
        default:
          return String(device?.factoryName || "").toLowerCase();
      }
    };

    return [...filteredDevices].sort((left, right) => {
      const leftValue = accessor(left);
      const rightValue = accessor(right);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
  }, [filteredDevices, sort, t]);

  const pagedDevices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedDevices.slice(start, start + pageSize);
  }, [sortedDevices, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedDevices.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const tableColumns = useMemo(() => ([
    {
      key: "factory",
      label: t("factory"),
      sortKey: "factory",
      width: 160,
      renderCell: (row) => (
        <span className="text-sm font-semibold text-on-surface">{row?.factoryName || "—"}</span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "name",
      label: t("name"),
      sortKey: "name",
      width: 200,
      renderCell: (row) => (
        <span className="text-sm font-semibold text-on-surface">{getDeviceDisplayName(row, t)}</span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "deviceId",
      label: t("deviceIdLabel"),
      sortKey: "deviceId",
      width: 200,
      renderCell: (row) => (
        <span className="font-mono text-xs text-on-surface-variant">{row?.deviceId || "—"}</span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "photos",
      label: t("photosLabel"),
      sortable: false,
      width: 96,
      renderCell: (row) => {
        const count = Array.isArray(row?.imageURLs) ? row.imageURLs.filter(Boolean).length : 0;
        return (
          <span className={`text-sm font-semibold ${count > 0 ? "text-on-surface" : "text-outline"}`}>{count}</span>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "registeredBy",
      label: t("registeredByLabel"),
      sortKey: "registeredBy",
      width: 200,
      renderCell: (row) => {
        const name = getRegisteredName(row);
        const username = row?.username ? `@${row.username}` : "";
        return (
          <div>
            <span className="text-sm font-semibold text-on-surface">{name}</span>
            {username ? <p className="text-[10px] text-outline">{username}</p> : null}
          </div>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "createdAt",
      label: t("createdLabel"),
      sortKey: "createdAt",
      width: 132,
      renderCell: (row) => (
        <span className="text-sm font-medium text-on-surface-variant">{formatDate(row?.createdAt)}</span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "updatedAt",
      label: t("updatedLabel"),
      sortKey: "updatedAt",
      width: 132,
      renderCell: (row) => (
        <span className="text-sm font-medium text-on-surface-variant">{formatDate(row?.updatedAt)}</span>
      ),
      disableCellWrapper: true,
    },
  ]), [t]);

  function handleSort(columnKey) {
    setSort((current) => {
      if (current.column === columnKey) {
        return { column: columnKey, direction: current.direction === 1 ? -1 : 1 };
      }
      return { column: columnKey, direction: 1 };
    });
  }

  const totalPhotos = useMemo(() => devices.reduce((sum, device) => (
    sum + (Array.isArray(device?.imageURLs) ? device.imageURLs.filter(Boolean).length : 0)
  ), 0), [devices]);

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        title={(
          <>
            <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>developer_board</span>
            {t("devices")}
          </>
        )}
        titleClassName="flex items-center gap-3"
        subtitle={t("devicesPageSubtitle")}
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={(
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-all duration-150 disabled:opacity-50 active:scale-95"
          >
            <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>refresh</span>
            {t("refresh")}
          </button>
        )}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>developer_board</span>
            <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em]">{t("totalDevicesLabel")}</p>
          </div>
          <p className="text-2xl font-semibold text-on-surface leading-none tracking-tight">{devices.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>factory</span>
            <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em]">{t("factories")}</p>
          </div>
          <p className="text-2xl font-semibold text-on-surface leading-none tracking-tight">{factoryOptions.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>photo_library</span>
            <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em]">{t("photosLabel")}</p>
          </div>
          <p className="text-2xl font-semibold text-on-surface leading-none tracking-tight">{totalPhotos}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>filter_alt</span>
            <p className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em]">{t("showingLabel")}</p>
          </div>
          <p className="text-2xl font-semibold text-on-surface leading-none tracking-tight">{sortedDevices.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-5 mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-separator/40 bg-surface px-4 py-2">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
            placeholder={t("searchDevicesPlaceholder")}
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="rounded-xl p-2 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
              title={t("clearSearchTooltip")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("factory")}</span>
          <select
            value={factoryFilter}
            onChange={(event) => { setFactoryFilter(event.target.value); setPage(1); }}
            className="rounded-xl border border-separator/40 bg-surface px-4 py-2 text-sm font-semibold text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <option value="all">{t("all")}</option>
            {factoryOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3 mb-6">
          <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
          <div>
            <p className="text-sm font-semibold text-on-surface">{t("failedToLoadDevices")}</p>
            <p className="text-xs text-on-surface-variant mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Device cards */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("allDevicesHeading")}</p>
          <span className="text-[10px] text-outline">{t("deviceCountSuffix", { count: sortedDevices.length, plural: sortedDevices.length === 1 ? "" : "s" })}</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="glass-card rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : sortedDevices.length === 0 ? (
          <div className="glass-card rounded-2xl p-5 text-center">
            <p className="text-sm font-semibold text-on-surface">{t("noDevicesMatchFilters")}</p>
            <p className="text-[11px] text-outline mt-1">{t("tryClearingSearch")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedDevices.map((device) => (
              <DeviceCard
                key={`${device?.factoryName || ""}-${device?.deviceId || device?._id}`}
                device={device}
                onClick={setSelectedDevice}
              />
            ))}
          </div>
        )}
      </div>

      {/* Data table */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-on-surface">{t("allDevicesHeading")}</h3>
          <span className="text-[10px] text-outline font-semibold uppercase tracking-[0.18em]">
            {sortedDevices.length.toLocaleString()} {t("rowsSuffix")}
          </span>
        </div>
        <DataTable
          columns={tableColumns}
          rows={pagedDevices}
          loading={loading}
          error={error}
          sort={sort}
          page={page}
          pageSize={pageSize}
          filteredCount={sortedDevices.length}
          totalPages={totalPages}
          onSort={handleSort}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          pageSizeLabel={t("rowsSuffix")}
          previousLabel={t("previousLabel")}
          nextLabel={t("next")}
          rowKey={(row) => `${row?.factoryName || ""}-${row?.deviceId || row?._id}`}
          onRowClick={(row) => setSelectedDevice(row)}
          emptyTitle={t("noDevicesFoundTitle")}
          emptyMessage={t("adjustFiltersMessage")}
        />
      </div>

      <DeviceDetailModal
        device={selectedDevice}
        open={Boolean(selectedDevice)}
        onClose={() => setSelectedDevice(null)}
      />
    </section>
  );
}
