export default function MasterTabNav({
  tabs = [],
  activeTab,
  onSelect,
  onChange,
  className = "",
  variant = "folder",
}) {
  if (variant === "segmented") {
    return (
      <div
        role="tablist"
        className={`flex flex-wrap items-center p-1 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] gap-1 ${className || "mb-6"}`.trim()}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const isDisabled = tab.ready === false || tab.disabled;

          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  if (onSelect) onSelect(tab);
                  if (onChange) onChange(tab.key);
                }
              }}
              className={[
                "whitespace-nowrap rounded-[4px] px-3.5 py-1.5 text-xs font-semibold tracking-normal transition-all duration-150 inline-flex items-center gap-1.5 select-none",
                active
                  ? "bg-[var(--freya-blue)] text-white shadow-xs"
                  : !isDisabled
                    ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/70 border border-transparent"
                    : "text-[var(--text-muted)]/50 border border-transparent cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              {tab.icon && (
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {(tab.badge !== undefined || tab.count !== undefined) && (
                <span
                  className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]"
                  }`}
                >
                  {tab.badge ?? tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Physical Folder Tab UI (matching real-life file folders & binder tabs)
  return (
    <div
      role="tablist"
      className={`w-full border-b border-[var(--border)] ${className || "mb-6"}`.trim()}
    >
      <div className="-mb-px flex flex-wrap items-end gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const isDisabled = tab.ready === false || tab.disabled;

          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  if (onSelect) onSelect(tab);
                  if (onChange) onChange(tab.key);
                }
              }}
              className={[
                "group relative inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-t-[8px] text-xs sm:text-sm font-semibold tracking-normal transition-all duration-150 select-none whitespace-nowrap",
                active
                  ? "z-10 bg-[var(--surface)] text-[var(--freya-blue)] border-t-2 border-t-[var(--freya-blue)] border-l border-r border-[var(--border)] border-b border-b-[var(--surface)] shadow-[0_-2px_6px_rgba(0,0,0,0.03)]"
                  : !isDisabled
                    ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]/70 border-t-2 border-t-transparent border-l border-r border-transparent border-b border-b-[var(--border)]"
                    : "text-[var(--text-muted)]/40 border-t-2 border-t-transparent border-l border-r border-transparent border-b border-b-[var(--border)] cursor-not-allowed opacity-40",
              ].join(" ")}
            >
              {tab.icon && (
                <span
                  className="material-symbols-outlined transition-colors"
                  style={{
                    fontSize: 18,
                    ...(active ? { fontVariationSettings: "'FILL' 1" } : {}),
                  }}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {(tab.badge !== undefined || tab.count !== undefined) && (
                <span
                  className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                    active
                      ? "bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)]"
                      : "bg-[var(--surface-hover)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab.badge ?? tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}