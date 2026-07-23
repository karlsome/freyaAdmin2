// ─── KPI strip shown at the top of the Dashboard ─────────────────────────────
// Props: kpis, byProcess (from useTodayData), loading

import StatSummaryCard from "./StatSummaryCard";
import { useLanguage } from "../contexts/LanguageContext";

const PROCESS_ACCENT = {
  Kensa: { color: "text-violet-500", bg: "bg-violet-500/10" },
  Press: { color: "text-sky-500",    bg: "bg-sky-500/10"    },
  SRS:   { color: "text-amber-500",  bg: "bg-amber-500/10"  },
  Slit:  { color: "text-emerald-500",bg: "bg-emerald-500/10"},
};

export default function DashboardKPIStrip({ kpis, byProcess = [], loading }) {
  const { t } = useLanguage();
  const fmt    = (n) => (loading ? "—" : n.toLocaleString());
  const fmtH   = (h) => (loading ? "—" : `${(h ?? 0).toFixed(1)} h`);
  const fmtPct = (p) => (loading ? "—" : `${(p ?? 0).toFixed(2)}%`);

  const defectColor =
    !loading && kpis.defectRate >= 2.0 ? "text-error bg-error/10" :
    !loading && kpis.defectRate >= 1.5 ? "text-amber-500 bg-amber-500/10" :
                                          "text-emerald-500 bg-emerald-500/10";

  return (
    <div className="space-y-5 mb-6">
      {/* ── Row 1: Overall KPIs ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-3 flex items-center gap-2">
          <span className="w-3 h-px bg-separator inline-block" />
          {t("kpiOverall")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatSummaryCard
            icon="output"
            label={t("totalProcessed")}
            value={fmt(kpis.total)}
            subtitle={t("submissionsCount", { count: fmt(kpis.submissionCount) })}
            accent="text-primary bg-primary/10"
            loading={loading}
          />
          <StatSummaryCard
            icon="report"
            label={t("totalNG")}
            value={fmt(kpis.totalNG)}
            subtitle={t("defectiveUnits")}
            accent={!loading && kpis.totalNG > 0 ? "text-error bg-error/10" : "text-emerald-500 bg-emerald-500/10"}
            loading={loading}
          />
          <StatSummaryCard
            icon="percent"
            label={t("defectRate")}
            value={fmtPct(kpis.defectRate)}
            subtitle={!loading && kpis.defectRate >= 2 ? t("aboveThreshold") : !loading && kpis.defectRate >= 1.5 ? t("nearThreshold") : t("withinTarget")}
            accent={defectColor}
            loading={loading}
          />
          <StatSummaryCard
            icon="build"
            label={t("troubleTime")}
            value={fmtH(kpis.troubleHours)}
            subtitle={t("maintenanceDowntime")}
            accent={!loading && kpis.troubleHours > 1 ? "text-amber-500 bg-amber-500/10" : "text-outline bg-surface-container-high"}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Row 2: Per-process breakdown ── */}
      {byProcess.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-3 flex items-center gap-2">
            <span className="w-3 h-px bg-separator inline-block" />
            {t("kpiByProcess")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {byProcess.map((p) => {
              const a = PROCESS_ACCENT[p.name] ?? { color: "text-primary", bg: "bg-primary/10" };
              return (
                <StatSummaryCard
                  key={p.name}
                  icon="precision_manufacturing"
                  label={t("processSuffix", { process: p.name })}
                  value={loading ? "—" : p.total.toLocaleString()}
                  subtitle={loading ? "" : t("hoursAndSubmissions", { hours: p.workHours.toFixed(1), count: p.submissionCount })}
                  accent={`${a.color} ${a.bg}`}
                  loading={loading}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
