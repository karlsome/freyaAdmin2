import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import DataTable from "../components/DataTable";
import StopCallLeaderboard, { aggregateLeaders } from "../components/StopCallLeaderboard";
import StopCallDetailModal from "../components/StopCallDetailModal";
import EmptyState from "../components/EmptyState";
import { fetchStopCallRecords, fetchStopCallSummary, fetchMasterFactories } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function todayStr() { return fmtDate(new Date()); }

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const diffToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { from: fmtDate(monday), to: fmtDate(saturday) };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmtDate(first), to: fmtDate(last) };
}

function getYesterdayRange() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const s = fmtDate(d);
  return { from: s, to: s };
}

function getLastWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon - 7);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { from: fmtDate(monday), to: fmtDate(saturday) };
}

function getLastMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: fmtDate(first), to: fmtDate(last) };
}

function fmtWait(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function flattenStopCalls(records) {
  const events = [];
  for (const rec of records) {
    if (!rec.StopCall?.records?.length) continue;
    for (const sc of rec.StopCall.records) {
      events.push({
        ...sc,
        date: rec.Date,
        "設備": rec["設備"],
        "背番号": rec["背番号"],
        "品番": rec["品番"],
        Worker_Name: rec.Worker_Name,
        "工場": rec["工場"],
        parentRecord: rec,
      });
    }
  }
  return events;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100];
const RANGE_PRESETS = ["today", "yesterday", "thisWeek", "thisMonth", "lastWeek", "lastMonth"];
const VIEW_TABS = [
  { key: "leaderboard", labelKey: "leaderboard" },
  { key: "timeline", labelKey: "timeline" },
  { key: "allRecords", labelKey: "allRecords" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StopCallPage() {
  const { t } = useLanguage();

  // Filters
  const [rangePreset, setRangePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [factory, setFactory] = useState("");
  const [leaderSearch, setLeaderSearch] = useState("");
  const [factories, setFactories] = useState([]);

  // Pagination (for "allRecords" view)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState(null);

  // Data
  const [pagedResult, setPagedResult] = useState({ data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 } });
  const [summaryRecords, setSummaryRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // View
  const [activeView, setActiveView] = useState("leaderboard");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState(null);
  const [modalStopCall, setModalStopCall] = useState(null);
  const [modalAllStopCalls, setModalAllStopCalls] = useState([]);

  // Resolve date range
  const dateRange = useMemo(() => {
    if (rangePreset === "today") {
      const d = todayStr();
      return { from: d, to: d };
    }
    if (rangePreset === "thisWeek") return getWeekRange();
    if (rangePreset === "thisMonth") return getMonthRange();
    if (rangePreset === "yesterday") return getYesterdayRange();
    if (rangePreset === "lastWeek") return getLastWeekRange();
    if (rangePreset === "lastMonth") return getLastMonthRange();
    // custom
    return { from: customFrom || todayStr(), to: customTo || todayStr() };
  }, [rangePreset, customFrom, customTo]);

  // Fetch factories on mount
  useEffect(() => {
    fetchMasterFactories().then(setFactories).catch(() => {});
  }, []);

  // Fetch summary (for KPI + leaderboard) when filters change
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const records = await fetchStopCallSummary({ dateFrom: dateRange.from, dateTo: dateRange.to, factory: factory || undefined });
      setSummaryRecords(Array.isArray(records) ? records : []);
    } catch {
      setSummaryRecords([]);
    }
    setSummaryLoading(false);
  }, [dateRange.from, dateRange.to, factory]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Fetch paginated records when page/pageSize/filters change
  const loadPagedRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchStopCallRecords({
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        factory: factory || undefined,
        page,
        limit: pageSize,
        sortColumn: sort?.column,
        sortDirection: sort?.direction,
      });
      setPagedResult(result);
    } catch {
      setPagedResult({ data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: pageSize } });
    }
    setLoading(false);
  }, [dateRange.from, dateRange.to, factory, page, pageSize, sort]);

  useEffect(() => { loadPagedRecords(); }, [loadPagedRecords]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [dateRange.from, dateRange.to, factory, pageSize, sort]);

  // Flatten summary for leaderboard / KPIs
  const flatEvents = useMemo(() => flattenStopCalls(summaryRecords), [summaryRecords]);

  // Filter by leader search
  const filteredEvents = useMemo(() => {
    if (!leaderSearch.trim()) return flatEvents;
    const q = leaderSearch.trim().toLowerCase();
    return flatEvents.filter((ev) =>
      (ev.leaderName || "").toLowerCase().includes(q) ||
      (ev.leaderUsername || "").toLowerCase().includes(q)
    );
  }, [flatEvents, leaderSearch]);

  const leaders = useMemo(() => aggregateLeaders(filteredEvents), [filteredEvents]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredEvents.length;
    const avgWait = total > 0 ? filteredEvents.reduce((s, e) => s + (e.waitSeconds || 0), 0) / total : 0;
    const maxWait = total > 0 ? Math.max(...filteredEvents.map((e) => e.waitSeconds || 0)) : 0;
    const uniqueLeaders = new Set(filteredEvents.map((e) => e.leaderUsername || e.leaderName)).size;
    const todayEvents = filteredEvents.filter((e) => e.date === todayStr()).length;
    return { total, avgWait, maxWait, uniqueLeaders, todayEvents };
  }, [filteredEvents]);

  // Modal open handler
  function openDetail(event) {
    const rec = event.parentRecord;
    setModalRecord(rec);
    setModalStopCall(event);
    setModalAllStopCalls(rec?.StopCall?.records || []);
    setModalOpen(true);
  }

  // View tabs with i18n
  const viewItems = useMemo(() => VIEW_TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) })), [t]);

  // Range preset label
  const rangeLabel = useMemo(() => {
    if (rangePreset === "today") return t("todayLabel");
    if (rangePreset === "thisWeek") return t("thisWeek");
    if (rangePreset === "thisMonth") return t("thisMonth");
    if (rangePreset === "yesterday") return t("yesterday");
    if (rangePreset === "lastWeek") return t("lastWeek");
    if (rangePreset === "lastMonth") return t("lastMonth");
    return t("custom");
  }, [rangePreset, t]);

  return (
    <section className="min-h-screen max-w-[1600px] mx-auto space-y-6 pt-20 px-6 pb-12">
      <PageHeader
        eyebrow={t("factories")}
        title={(
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)]">call_end</span>
            <span>{t("stopCallAnalytics")}</span>
          </div>
        )}
        subtitle={`${dateRange.from} — ${dateRange.to}`}
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={
          <button
            type="button"
            onClick={() => { loadSummary(); loadPagedRecords(); }}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            {t("refresh")}
          </button>
        }
      />

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm flex flex-wrap items-end gap-3">
        {/* Range preset dropdown */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("date")}</label>
          <select
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === "today" ? t("todayLabel") : t(p)}
              </option>
            ))}
            <option value="custom">{t("custom")}</option>
          </select>
        </div>

        {/* Custom date inputs */}
        {rangePreset === "custom" && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
              />
            </div>
          </>
        )}

        {/* Factory filter */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("factory")}</label>
          <select
            value={factory}
            onChange={(e) => setFactory(e.target.value)}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
          >
            <option value="">{t("all")}</option>
            {factories.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Leader search */}
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("leaderName")}</label>
          <input
            type="text"
            value={leaderSearch}
            onChange={(e) => setLeaderSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => { setRangePreset("today"); setFactory(""); setLeaderSearch(""); setCustomFrom(""); setCustomTo(""); }}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors"
        >
          {t("reset")}
        </button>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatSummaryCard
          icon="phone_missed"
          label={t("totalCalls")}
          value={kpis.total}
          subtitle={`${kpis.todayEvents} ${t("todayLabel").toLowerCase()}`}
          accent="bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
          loading={summaryLoading}
        />
        <StatSummaryCard
          icon="schedule"
          label={t("avgResponseTime")}
          value={fmtWait(Math.round(kpis.avgWait))}
          subtitle={rangeLabel}
          accent="bg-amber-400/10 text-amber-500"
          loading={summaryLoading}
        />
        <StatSummaryCard
          icon="timer_off"
          label={t("longestWait")}
          value={fmtWait(kpis.maxWait)}
          subtitle={rangeLabel}
          accent="bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
          loading={summaryLoading}
        />
        <StatSummaryCard
          icon="group"
          label={t("leadersInvolved")}
          value={kpis.uniqueLeaders}
          subtitle={`${leaders.length} ranked`}
          accent="bg-emerald-400/10 text-emerald-500"
          loading={summaryLoading}
        />
      </div>

      {/* ── View Switcher ───────────────────────────────────────────────────── */}
      <div>
        <LiquidSegmentedControl items={viewItems} activeKey={activeView} onChange={setActiveView} />
      </div>

      {/* ── View Content ────────────────────────────────────────────────────── */}
      {activeView === "leaderboard" && (
        <StopCallLeaderboard leaders={leaders} onClickRecord={openDetail} />
      )}

      {activeView === "timeline" && (
        <TimelineView events={filteredEvents} onClickEvent={openDetail} t={t} loading={summaryLoading} />
      )}

      {activeView === "allRecords" && (
        <AllRecordsView
          pagedResult={pagedResult}
          page={page}
          pageSize={pageSize}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={(size) => setPageSize(size)}
          sort={sort}
          onSort={setSort}
          onClickRecord={openDetail}
          t={t}
        />
      )}

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      <StopCallDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        record={modalRecord}
        stopCallEntry={modalStopCall}
        allStopCalls={modalAllStopCalls}
      />
    </section>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function TimelineView({ events, onClickEvent, t, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
            <div className="h-4 w-48 rounded-[4px] bg-[var(--surface-subtle)]" />
            <div className="mt-2 h-3 w-32 rounded-[4px] bg-[var(--surface-subtle)]" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <EmptyState icon="phone_missed" title={t("noStopCalls")} />;
  }

  // Group by date
  const grouped = new Map();
  for (const ev of events) {
    if (!grouped.has(ev.date)) grouped.set(ev.date, []);
    grouped.get(ev.date).push(ev);
  }
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{date}</h3>
          <div className="space-y-2">
            {grouped.get(date).map((ev, idx) => (
              <button
                key={idx}
                type="button"
                className="freya-card w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left shadow-sm transition-all hover:border-[var(--freya-blue)]/50"
                onClick={() => onClickEvent(ev)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">{ev["設備"]}</span>
                      <span className="text-[var(--freya-blue)] font-mono font-medium">{ev["背番号"]}</span>
                      <span className="text-[var(--text-secondary)]">{ev["品番"]}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>{ev.Worker_Name}</span>
                      <span>→</span>
                      <span className="font-medium text-[var(--text-primary)]">{ev.leaderName}</span>
                      <span className={`inline-block rounded-[4px] border px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                        ev.leaderRole === "admin" ? "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
                          : ev.leaderRole === "班長" ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                            : "border-emerald-400/30 bg-emerald-400/10 text-emerald-500"
                      }`}>{ev.leaderRole}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-muted)]">
                      <span>{ev.calledAt}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                      <span>{ev.arrivedAt}</span>
                    </div>
                    <p className={`mt-0.5 text-sm font-bold font-mono ${
                      (ev.waitSeconds || 0) > 300 ? "text-[var(--status-danger)]" : (ev.waitSeconds || 0) > 120 ? "text-amber-500" : "text-emerald-500"
                    }`}>
                      {fmtWait(ev.waitSeconds)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── All Records View (paginated) ────────────────────────────────────────────
function AllRecordsView({ pagedResult, page, pageSize, sort, onSort, loading, onPageChange, onPageSizeChange, onClickRecord, t }) {
  const { data, pagination } = pagedResult;

  // Flatten the paged records into individual stop call events
  const events = useMemo(() => flattenStopCalls(data), [data]);

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 animate-pulse">
              <div className="h-4 w-64 rounded bg-[var(--surface)]" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon="phone_missed" title={t("noStopCalls")} />
      ) : (
        <DataTable
          columns={[
            { key: "date", label: t("date"), sortable: true, renderCell: (ev) => <span className="font-mono text-xs text-[var(--text-secondary)]">{ev.date}</span> },
            { key: "工場", label: "工場", sortable: true, renderCell: (ev) => <span className="text-xs text-[var(--text-secondary)]">{ev["工場"]}</span> },
            { key: "設備", label: "設備", sortable: true, renderCell: (ev) => <span className="text-xs font-semibold text-[var(--text-primary)]">{ev["設備"]}</span> },
            { key: "背番号", label: "背番号", sortable: true, renderCell: (ev) => <span className="font-mono text-xs font-medium text-[var(--freya-blue)]">{ev["背番号"]}</span> },
            { key: "品番", label: "品番", sortable: true, renderCell: (ev) => <span className="text-xs text-[var(--text-secondary)]">{ev["品番"]}</span> },
            { key: "Worker_Name", label: t("worker"), sortable: true, renderCell: (ev) => <span className="text-xs text-[var(--text-secondary)]">{ev.Worker_Name}</span> },
            { 
              key: "leaderName", 
              label: t("leaderName"), 
              sortable: true,
              renderCell: (ev) => (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{ev.leaderName}</span>
                  <span className={`inline-block rounded-[4px] border px-1.5 py-0.5 text-[9px] font-mono font-medium ${
                    ev.leaderRole === "admin" ? "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
                      : ev.leaderRole === "班長" ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-500"
                  }`}>{ev.leaderRole}</span>
                </div>
              )
            },
            { key: "calledAt", label: t("calledAt"), sortable: true, renderCell: (ev) => <span className="font-mono text-xs text-[var(--text-muted)]">{ev.calledAt}</span> },
            { key: "arrivedAt", label: t("arrivedAt"), sortable: true, renderCell: (ev) => <span className="font-mono text-xs text-[var(--text-muted)]">{ev.arrivedAt}</span> },
            { 
              key: "waitSeconds", 
              label: t("waitTime"), 
              sortable: true,
              renderCell: (ev) => (
                <span className={`font-mono text-xs font-bold ${
                  (ev.waitSeconds || 0) > 300 ? "text-[var(--status-danger)]" : (ev.waitSeconds || 0) > 120 ? "text-amber-500" : "text-emerald-500"
                }`}>
                  {fmtWait(ev.waitSeconds)}
                </span>
              )
            },
          ]}
          rows={events}
          sort={sort}
          onSort={(colKey) => onSort((prev) => {
            if (prev && prev.column === colKey) {
              if (prev.direction === "asc") return { column: colKey, direction: "desc" };
              return null;
            }
            return { column: colKey, direction: "asc" };
          })}
          page={page}
          pageSize={pageSize}
          totalPages={pagination.totalPages}
          filteredCount={pagination.totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[10, 50, 100]}
          onRowClick={(ev) => onClickRecord(ev)}
          enableColumnReorder={true}
          layoutStorageKey="StopCallAllRecordsLayout"
          className="overflow-hidden rounded-[8px] border border-[var(--border)]"
          topBarClassName="mb-3 flex flex-wrap items-center justify-end gap-3 px-1"
          bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-2 pt-3 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
          rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)] cursor-pointer"
          rowsSelectClassName="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
        />
      )}
    </div>
  );
}
