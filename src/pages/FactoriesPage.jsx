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
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        title={t("factoryListTitle")}
        subtitle={(
          <>
            {total} facilit{total === 1 ? "y" : "ies"} {"-"} {normal} normal, {warnings} warning{warnings !== 1 ? "s" : ""}, {critical} critical
          </>
        )}
        className="mb-8 md:flex-row md:items-end md:justify-between"
        actionsClassName="md:justify-end"
        actions={(
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            {t("refresh")}
          </button>
        )}
      />

      {/* ── Error banner ── */}
      {error && (
        <div className="glass-card rounded-2xl p-6 mb-6 flex items-center gap-4 text-error">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-bold">Backend unreachable — showing last cached data. ({error})</p>
        </div>
      )}

      {/* ── Factory grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
        {loading && factories.length === 0
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 h-64 animate-pulse bg-surface-container" />
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
