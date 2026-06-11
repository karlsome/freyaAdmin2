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
    <div className="glass-card flex h-[min(74vh,820px)] flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-separator/40 px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Models</div>
        <h3 className="mt-1 text-lg font-semibold text-on-surface">モデル一覧</h3>
        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="モデルを検索..."
          className="mt-4 w-full rounded-2xl border border-separator/40 bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm font-medium text-on-surface-variant">Loading models…</div>
        ) : !models.length ? (
          <div className="px-5 py-10 text-center text-sm text-on-surface-variant">No matching models.</div>
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {models.map((model) => {
              const definedCount = countDefinedCounters(definitionsByModel[model]?.counters);
              const selected = selectedModel === model;

              return (
                <li key={model}>
                  <div
                    className={[
                      "flex items-center gap-3 px-4 py-3 transition",
                      selected
                        ? "bg-primary/10 text-on-surface"
                        : "text-on-surface hover:bg-surface-container-low",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectModel(model)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className={`h-full w-1.5 self-stretch rounded-full ${selected ? "bg-primary" : "bg-transparent"}`} />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{model}</div>
                      </div>

                      <span className={[
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        definedCount
                          ? definedCount === 12
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-surface-container text-on-surface-variant",
                      ].join(" ")}>
                        {definedCount ? `${definedCount}/12` : "未定義"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenModelInfo(model)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container hover:text-primary"
                      aria-label={`Show model info for ${model}`}
                      title="製品一覧を見る"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>info</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-outline-variant/10 px-4 py-3 text-center text-xs font-medium text-on-surface-variant">
        {models.length} model{models.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}