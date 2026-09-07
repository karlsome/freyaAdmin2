import { countDefinedCounters } from "../utils/furyoKanri";

export default function FuryoModelListPanel({
  models = [],
  definitionsByModel = {},
  selectedModel = "",
  searchValue = "",
  loading = false,
  onSearchChange,
  onSelectModel,
  onOpenModelInfo,
}) {
  return (
    <div className="freya-card flex h-[min(74vh,820px)] flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] px-4 py-3.5 bg-[var(--surface-subtle)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Models</div>
        <h3 className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">モデル一覧</h3>
        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="モデルを検索..."
          className="mt-2.5 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="px-5 py-10 text-center text-xs font-medium text-[var(--text-muted)]">Loading models…</div>
        ) : !models.length ? (
          <div className="px-5 py-10 text-center text-xs text-[var(--text-muted)]">No matching models.</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {models.map((model) => {
              const definedCount = countDefinedCounters(definitionsByModel[model]?.counters);
              const selected = selectedModel === model;

              return (
                <li key={model}>
                  <div
                    className={[
                      "flex items-center gap-2.5 px-3.5 py-2.5 transition",
                      selected
                        ? "bg-[var(--freya-blue)]/10 text-[var(--text-primary)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectModel(model)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className={`h-4 w-1 rounded-full ${selected ? "bg-[var(--freya-blue)]" : "bg-transparent"}`} />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-mono font-semibold">{model}</div>
                      </div>

                      <span className={[
                        "shrink-0 rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-medium border",
                        definedCount
                          ? definedCount === 12
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]",
                      ].join(" ")}>
                        {definedCount ? `${definedCount}/12` : "未定義"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenModelInfo(model)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--freya-blue)] transition"
                      aria-label={`Show model info for ${model}`}
                      title="製品一覧を見る"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-2.5 text-center text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-subtle)]">
        {models.length} model{models.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}