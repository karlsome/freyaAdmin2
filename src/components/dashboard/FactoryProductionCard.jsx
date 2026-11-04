import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

export default function FactoryProductionCard({ kpis, byFactory = [], byProcess = [], loading, onAskAI, isHighlighted, aiMetadata }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isJa = language === "ja";

  const dailyTarget = 35000;
  const total = kpis?.total || 0;
  const progressPct = Math.min(100, Math.round((total / dailyTarget) * 100));

  const totalWorkersEstimate = aiMetadata?.activeWorkers?.length || Math.max(1, Math.round((kpis?.workHours || 0) / 7.5));
  const unitsPerLaborHour = kpis?.workHours > 0 ? Math.round(total / kpis.workHours) : 0;

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Card Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--freya-blue-subtle)] border border-[var(--border)] text-[var(--freya-blue)] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>precision_manufacturing</span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
              {isJa ? "工場稼働・目標達成状況" : "Factory Operations & Attainment"}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isJa ? "リアルタイム生産実績、ライン稼働、作業員効率" : "Live run quantities, lines & worker efficiency"}
            </p>
          </div>
        </div>

        {onAskAI && (
          <button
            onClick={() => onAskAI(isJa ? "現在の生産進捗、ボトルネック、作業員効率を分析して" : "Analyze current production progress, bottlenecks and worker efficiency")}
            title={isJa ? "AIに生産効率の分析を依頼" : "Ask AI to analyze production efficiency"}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            <span>{isJa ? "AIに質問" : "Ask AI"}</span>
          </button>
        )}
      </div>

      {/* ── Progress bar toward daily goal ── */}
      <div className="p-3.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] mb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">
            {isJa ? "日次生産目標:" : "Daily Production Target:"}{" "}
            <span className="freya-tabular">{total.toLocaleString()}</span> / {dailyTarget.toLocaleString()} {isJa ? "個" : "units"}
          </span>
          <span className="font-bold text-[var(--freya-blue)] freya-tabular">{progressPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
          <div
            className="h-full bg-[var(--freya-blue)] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-2">
          <span>
            {isJa ? "稼働人員:" : "Active Personnel:"}{" "}
            {aiMetadata?.activeWorkers?.length ? (
              <strong className="text-[var(--freya-blue)]">
                {aiMetadata.activeWorkers.length}{isJa ? `名 (${aiMetadata.factory})` : ` verified operators (${aiMetadata.factory})`}
              </strong>
            ) : (
              isJa ? `約 ${totalWorkersEstimate} 名` : `~${totalWorkersEstimate} operators`
            )}
          </span>
          <span>
            {isJa ? "作業効率:" : "Efficiency:"}{" "}
            <strong className="text-[var(--text-primary)] freya-tabular">{unitsPerLaborHour}</strong> {isJa ? "個/人・時" : "units/worker-hr"}
          </span>
        </div>
      </div>

      {/* ── Per-Factory Quick Status ── */}
      <div className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-2">
          {isJa ? "拠点別実績" : "Facility Breakdown"}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {byFactory.map((f) => {
            const hasTrouble = (f.troubleHours || 0) > 0;
            return (
              <div
                key={f.name}
                onClick={() => navigate(`/factory/${encodeURIComponent(f.name)}`)}
                className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer transition-colors flex items-center justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{f.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      ({f.submissionCount || 0} {isJa ? "バッチ" : "batches"})
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-primary)] freya-tabular mt-0.5">
                    {(f.total || 0).toLocaleString()} <span className="text-xs text-[var(--text-muted)] font-normal">{isJa ? "個" : "units"}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-[4px] border ${
                      f.defectRate >= 2
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : f.defectRate >= 1.5
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    <span>{f.defectRate >= 2 ? "✕" : f.defectRate >= 1.5 ? "▲" : "●"}</span>
                    <span className="freya-tabular">{f.defectRate.toFixed(2)}% NG</span>
                  </span>
                  {hasTrouble && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 block mt-0.5 font-medium">
                      ▲ {f.troubleHours.toFixed(1)}{isJa ? "時間 停止" : "h stoppage"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-Process Attainment Strip ── */}
      <div className="pt-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">{isJa ? "工程別スループット" : "Process Flow Rates"}</span>
          <span className="text-[var(--text-muted)] text-[11px]">{isJa ? "本日" : "Today"}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {byProcess.map((proc) => (
            <div key={proc.name} className="p-2 rounded-[4px] bg-[var(--surface-hover)] text-center">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block">{proc.name}</span>
              <span className="text-xs font-semibold text-[var(--text-primary)] freya-tabular block mt-0.5">
                {(proc.total || 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
