export default function MasterTabNav({
  tabs = [],
  activeTab,
  onSelect,
  onChange,
  className = "",
}) {
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