import { useNavigate } from "react-router-dom";
import { useTodayData } from "../hooks/useTodayData";
import DashboardKPIStrip from "../components/DashboardKPIStrip";
import DashboardIssuesFeed from "../components/DashboardIssuesFeed";
import DashboardRecentSubmissions from "../components/DashboardRecentSubmissions";
import DashboardFactorySummary from "../components/DashboardFactorySummary";
import RecordDetailModal from "../components/RecordDetailModal";
import { useRecordModal } from "../hooks/useRecordModal";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { kpis, issues, recent, byFactory, byProcess, loading, error, lastRefresh, refresh } = useTodayData();
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="pt-20 sm:pt-24 pb-24 sm:pb-16 px-4 sm:px-6 md:px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-on-surface">Dashboard</h2>
          <p className="text-on-surface-variant mt-1 text-sm">{today}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container
                     border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high
                     hover:text-primary transition-all disabled:opacity-50"
        >
          <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>refresh</span>
          {refreshLabel ? `Updated ${refreshLabel}` : "Refresh"}
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="glass-card rounded-2xl p-4 mb-6 flex items-center gap-3 text-error border border-error/20">
          <span className="material-symbols-outlined flex-shrink-0">error</span>
          <p className="text-sm font-bold">Backend unreachable — data may be stale. ({error})</p>
        </div>
      )}

      {/* ── KPI strip ── */}
      <DashboardKPIStrip kpis={kpis} byProcess={byProcess} loading={loading} />

      {/* ── Middle row: issues + recent submissions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-4 sm:mb-5" style={{ minHeight: 360 }}>
        <DashboardIssuesFeed
          issues={issues}
          loading={loading}
          onRecordClick={openRecord}
        />
        <DashboardRecentSubmissions
          recent={recent}
          loading={loading}
          onRecordClick={openRecord}
        />
      </div>

      {/* ── Factory summary table ── */}
      <DashboardFactorySummary
        factories={byFactory}
        loading={loading}
        onNavigateToFactory={(name) => navigate(`/factory/${encodeURIComponent(name)}`)}
      />

      {/* ── Record detail modal ── */}
      {modalRecord && (
        <RecordDetailModal
          record={modalRecord}
          processName={modalProcess}
          onClose={closeRecord}
        />
      )}
    </section>
  );
}

