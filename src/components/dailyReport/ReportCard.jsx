import { CATEGORY_META, SEVERITY_META } from "../../utils/dailyReportText";

/** Mini bar chart of the last working days; today's bar is coloured by severity. */
export function Sparkline({ points, color, height = 36 }) {
  const values = points.map((p) => p.value).filter((v) => v != null);
  const max = Math.max(...values, 0.0001);
  return (
    <div className="flex items-end gap-[3px] w-full" style={{ height }} aria-hidden="true">
      {points.map((p, i) => {
        const isToday = i === points.length - 1;
        const h = p.value == null ? 2 : Math.max(3, Math.round((100 * p.value) / max));
        return (
          <span
            key={p.date}
            className="flex-1 rounded-[2px]"
            style={{
              height: p.value == null ? 2 : `${h}%`,
              background: p.value == null ? "var(--border)" : isToday ? color : "var(--border-strong)",
            }}
          />
        );
      })}
    </div>
  );
}

export default function ReportCard({ finding, text, isJa, checked, onOpen }) {
  const cat = CATEGORY_META[finding.cat] || CATEGORY_META.data;
  const sev = SEVERITY_META[finding.sev] || SEVERITY_META.info;
  const points = finding.trend?.points || [];
  // A spike card's trend is the part across ALL workers, so its "today" bar can look
  // small next to the big number; the card shows today-vs-normal and keeps the trend for full screen.
  const hasTrend = finding.type !== "qualitySpike" && points.some((p) => p.value != null);
  // Today-vs-normal bars only mean something for a rate or a time (not for head counts or record lists).
  const unit = finding.compare?.unit;
  const first = unit === "%" || unit === "s" ? finding.compare?.items?.[0] : null;
  const max = first ? Math.max(first.today || 0, first.normal || 0, 0.0001) : 1;

  return (
    <button type="button" onClick={onOpen} className="freya-card dr-card p-4 flex flex-col gap-3 min-w-0">
      <span className="flex items-center justify-between gap-2 w-full">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: cat.color }}>{cat.icon}</span>
          {isJa ? cat.ja : cat.en}
        </span>
        <span className={sev.className}>
          <span className="freya-badge-dot" />
          {isJa ? sev.ja : sev.en}
        </span>
      </span>

      <span className="text-[12px] text-[var(--text-muted)] -mt-1">{finding.facs.join(" · ")}</span>
      <span className="text-[15px] font-semibold leading-snug text-[var(--text-primary)]">{text.title}</span>

      <span className="flex items-baseline gap-2.5 flex-wrap">
        <span className="freya-tabular text-[28px] font-bold leading-none tracking-[-0.02em]" style={{ color: sev.color }}>
          {text.big}
        </span>
        <span className="text-[13px] text-[var(--text-muted)]">{text.normal}</span>
      </span>

      {hasTrend ? (
        <span className="flex flex-col gap-1 w-full">
          <Sparkline points={points} color={sev.color} />
          <span className="text-[11px] text-[var(--text-muted)]">
            {isJa ? `直近${points.length}営業日` : `last ${points.length} working days`}
          </span>
        </span>
      ) : first ? (
        <span className="flex flex-col gap-1 w-full" aria-hidden="true">
          <span className="block h-2 rounded-full" style={{ width: `${Math.max(2, (100 * (first.today || 0)) / max)}%`, background: sev.color }} />
          <span className="block h-2 rounded-full bg-[var(--border-strong)]" style={{ width: `${Math.max(2, (100 * (first.normal || 0)) / max)}%` }} />
          <span className="text-[11px] text-[var(--text-muted)]">{isJa ? "本日 vs 通常" : "today vs normal"}</span>
        </span>
      ) : null}

      <span className="dr-clamp-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">{text.text}</span>

      <span className="mt-auto flex items-center justify-between w-full pt-1">
        {checked ? (
          <span className="freya-badge freya-badge-normal">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
            {isJa ? "確認済" : "Checked"}
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1 text-[12px] font-semibold text-[var(--freya-blue)]">
          {isJa ? "全画面で開く" : "Open full screen"}
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_full</span>
        </span>
      </span>
    </button>
  );
}
