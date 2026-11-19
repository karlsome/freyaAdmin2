import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ChartJS from "../analytics/chartSetup";
import { CATEGORY_META, SEVERITY_META, columnLabel, fmtUnit, formatCell, md } from "../../utils/dailyReportText";

// Canvas needs real colours, not CSS variables.
const SEV_HEX = { high: "#DC2626", medium: "#D97706", info: "#64748B", ongoing: "#7C3AED", good: "#16A34A" };

function TrendChart({ points, unit, color, isDark }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    ChartJS.getChart(canvas)?.destroy();
    const last = points.length - 1;
    const chart = new ChartJS(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: points.map((p) => md(p.date)),
        datasets: [
          {
            data: points.map((p) => p.value),
            backgroundColor: points.map((_, i) => (i === last ? color : isDark ? "#334155" : "#CBD5E1")),
            borderRadius: 4,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => fmtUnit(ctx.parsed.y, unit) } },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)" },
            ticks: { callback: (v) => fmtUnit(v, unit) },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [points, unit, color, isDark]);

  return (
    <div className="relative h-[220px]">
      <canvas ref={canvasRef} role="img" aria-label="trend" />
    </div>
  );
}

export default function ReportDetailView({ finding, text, isJa, date, checked, onToggleCheck, onClose, onOpenRecord, isDark, escDisabled = false }) {
  const cat = CATEGORY_META[finding.cat] || CATEGORY_META.data;
  const sev = SEVERITY_META[finding.sev] || SEVERITY_META.info;
  const points = finding.trend?.points || [];
  const hasTrend = points.some((p) => p.value != null);
  const compare = finding.compare?.items || [];
  const unit = finding.compare?.unit || "";
  const max = Math.max(...compare.flatMap((c) => [c.today || 0, c.normal || 0]), 0.0001);
  const rows = finding.rows || [];
  const columns = finding.columns || [];
  const clickable = rows.some((r) => r.record);

  useEffect(() => {
    if (escDisabled) return undefined; // a record modal is open on top; Esc belongs to it
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, escDisabled]);

  // Portal to <body> so it covers the top bar and sidebar too.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={text.title} className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--page-bg)]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 md:px-8 pt-6 pb-16 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between pb-4 border-b border-[var(--border)]">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)]">
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: cat.color }}>{cat.icon}</span>
                {isJa ? cat.ja : cat.en}
              </span>
              <span className={sev.className}>
                <span className="freya-badge-dot" />
                {isJa ? sev.ja : sev.en}
              </span>
              <span className="text-[13px] text-[var(--text-muted)]">
                {finding.facs.join(" · ")} · {date}
              </span>
            </div>
            <h2 className="freya-title">{text.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={onToggleCheck} className="freya-btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{checked ? "check_circle" : "radio_button_unchecked"}</span>
              {checked ? (isJa ? "確認済" : "Checked") : isJa ? "確認済にする" : "Mark as checked"}
            </button>
            <button type="button" onClick={onClose} className="freya-btn-primary" aria-label={isJa ? "閉じる" : "Close"}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close_fullscreen</span>
              {isJa ? "閉じる" : "Close"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="freya-card p-5">
            <div className="freya-label">{isJa ? "本日" : "Today"}</div>
            <div className="freya-tabular mt-2 text-[36px] font-bold leading-none tracking-[-0.02em]" style={{ color: sev.color }}>{text.big}</div>
          </div>
          <div className="freya-card p-5">
            <div className="freya-label">{isJa ? "通常" : "Normal"}</div>
            <div className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">{text.normal}</div>
          </div>
          <div className="freya-card p-5 sm:col-span-2">
            <div className="freya-label">{isJa ? "何が起きたか" : "What happened"}</div>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{text.text}</p>
          </div>
        </div>

        {hasTrend && (
          <section className="freya-card p-5 space-y-3">
            <h3 className="text-h3 text-[var(--text-primary)]">{text.trendLabel}</h3>
            <TrendChart points={points} unit={finding.trend.unit} color={SEV_HEX[finding.sev] || SEV_HEX.info} isDark={isDark} />
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          {compare.length > 0 && (
            <section className="freya-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-h3 text-[var(--text-primary)]">{text.compareTitle}</h3>
                <div className="flex gap-3 text-[12px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-2 rounded-[2px]" style={{ background: sev.color }} />
                    {isJa ? "本日" : "Today"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-2 rounded-[2px] bg-[var(--border-strong)]" />
                    {isJa ? "通常" : "Normal"}
                  </span>
                </div>
              </div>
              {compare.map((c) => (
                <div key={c.label} className="space-y-1.5">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="font-semibold text-[var(--text-primary)] truncate">{c.label}</span>
                    <span className="freya-tabular text-[var(--text-muted)] whitespace-nowrap">
                      {fmtUnit(c.today, unit)} <span className="opacity-70">vs</span> {fmtUnit(c.normal, unit)}
                    </span>
                  </div>
                  <span className="block h-2.5 rounded-full" style={{ width: `${Math.max(1, (100 * (c.today || 0)) / max)}%`, background: sev.color }} />
                  <span className="block h-2.5 rounded-full bg-[var(--border-strong)]" style={{ width: `${Math.max(1, (100 * (c.normal || 0)) / max)}%` }} />
                </div>
              ))}
            </section>
          )}

          {rows.length > 0 && (
            <section className="freya-card p-5 space-y-3 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-h3 text-[var(--text-primary)]">{isJa ? "根拠となるレコード" : "Records behind this card"}</h3>
                {clickable && <span className="text-[12px] text-[var(--text-muted)]">{isJa ? "行をクリックで詳細" : "Click a row to open the record"}</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c} scope="col" className="text-left px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] border-b border-[var(--border)] whitespace-nowrap">
                          {columnLabel(c, isJa)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        onClick={r.record ? () => onOpenRecord(r.record) : undefined}
                        className={r.record ? "cursor-pointer hover:bg-[var(--surface-hover)]" : ""}
                      >
                        {r.cells.map((v, j) => (
                          <td key={j} className="freya-tabular px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap text-[var(--text-primary)]">
                            {formatCell(columns[j], v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {text.check && (
          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--freya-blue-subtle)] p-5 flex gap-3">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 22 }}>lightbulb</span>
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--freya-blue)]">{isJa ? "確認すること" : "What to check"}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-primary)]">{text.check}</p>
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body
  );
}
