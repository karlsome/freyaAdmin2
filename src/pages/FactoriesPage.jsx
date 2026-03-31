import { useNavigate } from "react-router-dom";
import { useDashboardData } from "../hooks/useDashboardData";
import FactoryCard from "../components/FactoryCard";
import RecordDetailModal from "../components/RecordDetailModal";
import { getDefectStatus } from "../utils/statusHelpers";
import { useRecordModal } from "../hooks/useRecordModal";

export default function FactoriesPage() {
  const { factories, loading, error, refresh } = useDashboardData();
  const navigate = useNavigate();
  const { modalRecord, modalProcess, openRecord, closeRecord } = useRecordModal();

  const total    = factories.length;
  const normal   = factories.filter((f) => getDefectStatus(f.defectRate).level === "normal").length;
  const warnings = factories.filter((f) => getDefectStatus(f.defectRate).level === "warning").length;
  const critical = factories.filter((f) => getDefectStatus(f.defectRate).level === "high").length;

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide">

      {/* ── Page header ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Factories</h2>
          <p className="text-on-surface-variant mt-1 text-sm">
            {total} facilit{total === 1 ? "y" : "ies"} &mdash; {normal} normal, {warnings} warning{warnings !== 1 ? "s" : ""}, {critical} critical
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          Refresh All
        </button>
      </div>

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
