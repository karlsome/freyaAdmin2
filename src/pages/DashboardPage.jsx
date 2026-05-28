import { useNavigate } from "react-router-dom";
import { useTodayData } from "../hooks/useTodayData";
import DashboardKPIStrip from "../components/DashboardKPIStrip";
import DashboardIssuesFeed from "../components/DashboardIssuesFeed";
import DashboardRecentSubmissions from "../components/DashboardRecentSubmissions";
import DashboardFactorySummary from "../components/DashboardFactorySummary";
import RecordDetailModal from "../components/RecordDetailModal";
import { useRecordModal } from "../hooks/useRecordModal";
import { useLanguage } from "../contexts/LanguageContext";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { kpis, issues, recent, byFactory, byProcess, loading, error, lastRefresh, refresh } = useTodayData();
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
  const { t, language } = useLanguage();

  const today = new Date().toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="pt-20 sm:pt-24 pb-24 sm:pb-16 px-4 sm:px-6 md:px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight text-on-surface leading-tight">
            {t("dashboard")}
          </h2>
          <p className="text-on-surface-variant mt-1 text-sm font-medium">{today}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                     bg-surface-container border border-separator/60 text-on-surface-variant
                     hover:bg-surface-container-high hover:text-primary hover:border-primary/30
                     active:scale-95 transition-all duration-150 disabled:opacity-50 shadow-sm"
        >
          <span className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`} style={{ fontSize: 15 }}>refresh</span>
          {refreshLabel ? `${t("refresh")} · ${refreshLabel}` : t("refresh")}
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-2xl p-4 mb-6 flex items-center gap-3 text-error
                        bg-error/8 border border-error/25 shadow-sm">
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 20 }}>error</span>
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
