import { useNavigate } from "react-router-dom";
import { useDashboardData } from "../hooks/useDashboardData";
import FactoryCard from "../components/FactoryCard";
import PageHeader from "../components/PageHeader";
import RecordDetailModal from "../components/RecordDetailModal";
import { getDefectStatus } from "../utils/statusHelpers";
import { useRecordModal } from "../hooks/useRecordModal";
import { useLanguage } from "../contexts/LanguageContext";

export default function FactoriesPage() {
  const { factories, loading, error, refresh } = useDashboardData();
  const navigate = useNavigate();
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();
  const { t } = useLanguage();

  const total    = factories.length;
  const normal   = factories.filter((f) => getDefectStatus(f.defectRate).level === "normal").length;
  const warnings = factories.filter((f) => getDefectStatus(f.defectRate).level === "warning").length;
  const critical = factories.filter((f) => getDefectStatus(f.defectRate).level === "high").length;

  return (
    <section className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <PageHeader
        title={t("factoryListTitle")}
        subtitle={(
          <>
            {total} facilit{total === 1 ? "y" : "ies"} {"-"} {normal} normal, {warnings} warning{warnings !== 1 ? "s" : ""}, {critical} critical
          </>
        )}
        className="mb-6 md:flex-row md:items-end md:justify-between"
        actionsClassName="md:justify-end"
        actions={(
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>refresh</span>
            {t("refresh")}
          </button>
        )}
      />

      {/* ── Error banner ── */}
      {error && (
        <div className="freya-card rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 p-4 mb-6 flex items-center gap-3 text-[var(--status-danger)]">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
          <p className="text-xs font-semibold">Backend unreachable — showing last cached data. ({error})</p>
        </div>
      )}

      {/* ── Factory grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
        {loading && factories.length === 0
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5 h-64 animate-pulse" />
            ))
          : factories.map((factory) => (
              <FactoryCard
                key={factory.name}
                factory={factory}
                onClick={() => navigate(`/factory/${encodeURIComponent(factory.name)}`)}
                onDefectClick={openRecord}
              />
            ))}
      </div>

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
