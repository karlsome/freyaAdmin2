import { useLanguage } from "../contexts/LanguageContext";

// Read-only list of a process's fixed defect items (pressDB / slitDB / SRSDB).
export default function FuryoFixedDefectsPanel({ processKey, process }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const counters = process?.counters || [];

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-primary/12 text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{process?.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {isJa ? process?.labelJa : process?.labelEn} <span className="font-mono text-xs font-medium text-[var(--text-muted)]">({processKey})</span>
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{isJa ? process?.descriptionJa : process?.descriptionEn}</p>
          </div>
        </div>
        <span className="self-start rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)] sm:self-auto">
          {counters.length} {isJa ? "不良項目" : "defect items"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            <tr>
              <th className="w-16 px-5 py-2.5">#</th>
              <th className="px-5 py-2.5">{isJa ? "日本語" : "Japanese"}</th>
              <th className="px-5 py-2.5">{isJa ? "英語" : "English"}</th>
              <th className="w-40 px-5 py-2.5">DB Field</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {counters.map((counter, index) => (
              <tr key={counter.jp} className="hover:bg-[var(--surface-subtle)]">
                <td className="px-5 py-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 font-mono text-[11px] font-bold text-primary">
                    {index + 1}
                  </span>
                </td>
                <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">{counter.jp}</td>
                <td className="px-5 py-2.5 text-[var(--text-secondary)]">{counter.en}</td>
                <td className="px-5 py-2.5">
                  <code className="rounded-[4px] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">{counter.jp}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="m-5 flex items-start gap-2 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
        <p>
          {isJa
            ? "このプロセスの不良項目はシステムで固定されています。変更が必要な場合は管理者にお問い合わせください。"
            : "Defect items for this process are fixed by the system. Contact an administrator if they need to change."}
        </p>
      </div>
    </div>
  );
}
