import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import PaginationControls from "../components/PaginationControls";
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
const RANGE_PRESETS = ["today", "thisWeek", "thisMonth"];
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
      });
      setPagedResult(result);
    } catch {
      setPagedResult({ data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: pageSize } });
    }
    setLoading(false);
  }, [dateRange.from, dateRange.to, factory, page, pageSize]);

  useEffect(() => { loadPagedRecords(); }, [loadPagedRecords]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [dateRange.from, dateRange.to, factory, pageSize]);

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
    return t("custom");
  }, [rangePreset, t]);

  return (
    <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
      <PageHeader
        eyebrow={t("factories")}
        title={t("stopCallAnalytics")}
        subtitle={`${dateRange.from} — ${dateRange.to}`}
        actions={
          <button
            type="button"
            onClick={() => { loadSummary(); loadPagedRecords(); }}
            className="flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            {t("refresh")}
          </button>
        }
      />

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        {/* Range preset dropdown */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{t("date")}</label>
          <select
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
            className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm font-medium text-on-surface transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === "today" ? t("todayLabel") : p === "thisWeek" ? t("thisWeek") : t("thisMonth")}
              </option>
            ))}
            <option value="custom">{t("custom")}</option>
          </select>
        </div>

        {/* Custom date inputs */}
        {rangePreset === "custom" && (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </>
        )}

        {/* Factory filter */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{t("factory")}</label>
          <select
            value={factory}
            onChange={(e) => setFactory(e.target.value)}
            className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm font-medium text-on-surface transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">{t("all")}</option>
            {factories.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Leader search */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{t("leaderName")}</label>
          <input
            type="text"
            value={leaderSearch}
            onChange={(e) => setLeaderSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => { setRangePreset("today"); setFactory(""); setLeaderSearch(""); setCustomFrom(""); setCustomTo(""); }}
          className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface active:scale-95"
        >
          {t("reset")}
        </button>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatSummaryCard
          icon="phone_missed"
          label={t("totalCalls")}
          value={kpis.total}
          subtitle={`${kpis.todayEvents} ${t("todayLabel").toLowerCase()}`}
          accent="bg-primary/15 text-primary"
          loading={summaryLoading}
        />
        <StatSummaryCard
          icon="schedule"
          label={t("avgResponseTime")}
          value={fmtWait(Math.round(kpis.avgWait))}
          subtitle={rangeLabel}
          accent="bg-amber-400/15 text-amber-400"
          loading={summaryLoading}
        />
        <StatSummaryCard
          icon="timer_off"
          label={t("longestWait")}
          value={fmtWait(kpis.maxWait)}
          subtitle={rangeLabel}
          accent="bg-error/15 text-error"
          loading={summaryLoading}
        />
        <StatSummaryCard
          icon="group"
          label={t("leadersInvolved")}
          value={kpis.uniqueLeaders}
          subtitle={`${leaders.length} ranked`}
          accent="bg-emerald-400/15 text-emerald-400"
          loading={summaryLoading}
        />
      </div>

      {/* ── View Switcher ───────────────────────────────────────────────────── */}
      <div className="mb-6">
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
          <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
            <div className="h-4 w-48 rounded bg-surface-container-high" />
            <div className="mt-2 h-3 w-32 rounded bg-surface-container-high" />
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
          <h3 className="mb-3 text-sm font-semibold text-on-surface">{date}</h3>
          <div className="space-y-2">
            {grouped.get(date).map((ev, idx) => (
              <button
                key={idx}
                type="button"
                className="glass-card w-full rounded-2xl p-4 text-left transition-all hover:ring-1 hover:ring-primary/20 active:scale-[0.995]"
                onClick={() => onClickEvent(ev)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-on-surface">{ev["設備"]}</span>
                      <span className="text-primary font-medium">{ev["背番号"]}</span>
                      <span className="text-on-surface-variant">{ev["品番"]}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-on-surface-variant">
                      <span>{ev.Worker_Name}</span>
                      <span>→</span>
                      <span className="font-medium text-on-surface">{ev.leaderName}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        ev.leaderRole === "admin" ? "bg-primary/15 text-primary"
                          : ev.leaderRole === "班長" ? "bg-amber-400/15 text-amber-500"
                            : "bg-emerald-400/15 text-emerald-400"
                      }`}>{ev.leaderRole}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span>{ev.calledAt}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                      <span>{ev.arrivedAt}</span>
                    </div>
                    <p className={`mt-1 text-sm font-bold ${
                      (ev.waitSeconds || 0) > 300 ? "text-error" : (ev.waitSeconds || 0) > 120 ? "text-amber-400" : "text-emerald-400"
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
function AllRecordsView({ pagedResult, page, pageSize, loading, onPageChange, onPageSizeChange, onClickRecord, t }) {
  const { data, pagination } = pagedResult;

  // Flatten the paged records into individual stop call events
  const events = useMemo(() => flattenStopCalls(data), [data]);

  return (
    <div>
      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="h-4 w-64 rounded bg-surface-container-high" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon="phone_missed" title={t("noStopCalls")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-on-surface-variant border-b border-separator/20">
                <th className="pb-3 pr-4 font-semibold">{t("date")}</th>
                <th className="pb-3 pr-4 font-semibold">工場</th>
                <th className="pb-3 pr-4 font-semibold">設備</th>
                <th className="pb-3 pr-4 font-semibold">背番号</th>
                <th className="pb-3 pr-4 font-semibold">品番</th>
                <th className="pb-3 pr-4 font-semibold">{t("worker")}</th>
                <th className="pb-3 pr-4 font-semibold">{t("leaderName")}</th>
                <th className="pb-3 pr-4 font-semibold">{t("calledAt")}</th>
                <th className="pb-3 pr-4 font-semibold">{t("arrivedAt")}</th>
                <th className="pb-3 font-semibold">{t("waitTime")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator/10">
              {events.map((ev, idx) => (
                <tr
                  key={idx}
                  className="cursor-pointer transition-colors hover:bg-primary/5"
                  onClick={() => onClickRecord(ev)}
                >
                  <td className="py-3 pr-4 text-on-surface">{ev.date}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{ev["工場"]}</td>
                  <td className="py-3 pr-4 text-on-surface">{ev["設備"]}</td>
                  <td className="py-3 pr-4 font-medium text-primary">{ev["背番号"]}</td>
                  <td className="py-3 pr-4 text-on-surface">{ev["品番"]}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{ev.Worker_Name}</td>
                  <td className="py-3 pr-4">
                    <span className="text-on-surface">{ev.leaderName}</span>
                    <span className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      ev.leaderRole === "admin" ? "bg-primary/15 text-primary"
                        : ev.leaderRole === "班長" ? "bg-amber-400/15 text-amber-500"
                          : "bg-emerald-400/15 text-emerald-400"
                    }`}>{ev.leaderRole}</span>
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">{ev.calledAt}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{ev.arrivedAt}</td>
                  <td className={`py-3 font-semibold ${
                    (ev.waitSeconds || 0) > 300 ? "text-error" : (ev.waitSeconds || 0) > 120 ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    {fmtWait(ev.waitSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-low p-4 rounded-xl border border-separator/10">
          <div className="text-sm text-on-surface-variant flex items-center gap-4">
            <span>
              {pagination.totalItems} records, showing {Math.min((pagination.currentPage - 1) * pagination.itemsPerPage + 1, pagination.totalItems)}-{Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}
            </span>
            <div className="flex items-center gap-2">
              <select 
                className="bg-surface-container border border-separator/20 rounded-lg px-2 py-1 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <PaginationControls
            page={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}
