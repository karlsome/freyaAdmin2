// ─── KPI strip shown at the top of the Dashboard ─────────────────────────────
// Props: kpis, byProcess (from useTodayData), loading

import StatSummaryCard from "./StatSummaryCard";

const PROCESS_ACCENT = {
  Kensa: { color: "text-violet-500", bg: "bg-violet-500/10" },
  Press: { color: "text-sky-500",    bg: "bg-sky-500/10"    },
  SRS:   { color: "text-amber-500",  bg: "bg-amber-500/10"  },
  Slit:  { color: "text-emerald-500",bg: "bg-emerald-500/10"},
};

export default function DashboardKPIStrip({ kpis, byProcess = [], loading }) {
  const fmt    = (n) => (loading ? "—" : n.toLocaleString());
  const fmtH   = (h) => (loading ? "—" : `${(h ?? 0).toFixed(1)} h`);
  const fmtPct = (p) => (loading ? "—" : `${(p ?? 0).toFixed(2)}%`);

  const defectColor =
    !loading && kpis.defectRate >= 2.0 ? "text-error bg-error/10" :
    !loading && kpis.defectRate >= 1.5 ? "text-amber-500 bg-amber-500/10" :
                                          "text-emerald-500 bg-emerald-500/10";

  return (
    <div className="space-y-6 mb-6">
      {/* ── Row 1: Overall KPIs ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>monitoring</span>
          <span className="freya-label">Overall Performance — Today</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSummaryCard
            variant="freya"
            icon="output"
            label="Total Processed"
            value={fmt(kpis.total)}
            subtitle={`${fmt(kpis.submissionCount)} submissions`}
            loading={loading}
          />
          <StatSummaryCard
            variant="freya"
            icon="report"
            label="Defect Units (NG)"
            value={fmt(kpis.totalNG)}
            subtitle="Defective units recorded"
            statusDot={!loading && kpis.totalNG > 0 ? "defect" : "complete"}
            loading={loading}
          />
          <StatSummaryCard
            variant="freya"
            icon="percent"
            label="Defect Rate"
            value={fmtPct(kpis.defectRate)}
            subtitle={!loading && kpis.defectRate >= 2 ? "Above threshold" : !loading && kpis.defectRate >= 1.5 ? "Near threshold" : "Within target"}
            statusDot={!loading && kpis.defectRate >= 2 ? "defect" : !loading && kpis.defectRate >= 1.5 ? "warning" : "complete"}
            loading={loading}
          />
          <StatSummaryCard
            variant="freya"
            icon="build"
            label="Trouble Time"
            value={fmtH(kpis.troubleHours)}
            subtitle="Maintenance downtime"
            statusDot={!loading && kpis.troubleHours > 1 ? "warning" : undefined}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Row 2: Per-process breakdown ── */}
      {byProcess.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>precision_manufacturing</span>
            <span className="freya-label">Process Telemetry Breakdown</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {byProcess.map((p) => (
              <StatSummaryCard
                key={p.name}
                variant="freya"
                icon="precision_manufacturing"
                label={`${p.name} Process`}
                value={loading ? "—" : p.total.toLocaleString()}
                subtitle={loading ? "" : `${p.workHours.toFixed(1)} h · ${p.submissionCount} submissions`}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
