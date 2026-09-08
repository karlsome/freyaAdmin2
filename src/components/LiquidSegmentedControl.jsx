import { useLanguage } from "../contexts/LanguageContext";

function normalizeItems(items = [], isJa = false) {
  return items.map((item) => {
    if (typeof item === "string") {
      return { key: item, label: item, disabled: false };
    }

    const resolvedLabel = (isJa && item.labelJa) ? item.labelJa : (item.label ?? item.key);

    return {
      key: item.key,
      label: resolvedLabel,
      disabled: Boolean(item.disabled),
      icon: item.icon,
      badge: item.badge ?? item.count,
    };
  });
}

export default function LiquidSegmentedControl({
  items,
  activeKey,
  onChange,
  className = "",
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const normalizedItems = normalizeItems(items, isJa);

  if (!normalizedItems.length) return null;

  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center p-1 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] gap-1 ${className}`.trim()}
    >
      {normalizedItems.map((item) => {
        const active = item.key === activeKey;

        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled && onChange) {
                onChange(item.key);
              }
            }}
            className={[
              "whitespace-nowrap rounded-[4px] px-3.5 py-1.5 text-xs font-semibold tracking-normal transition-all duration-150 inline-flex items-center gap-1.5 select-none",
              active
                ? "bg-[var(--freya-blue)] text-white shadow-xs"
                : !item.disabled
                  ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/70 border border-transparent"
                  : "text-[var(--text-muted)]/50 border border-transparent cursor-not-allowed opacity-50",
            ].join(" ")}
          >
            {item.icon && (
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--surface)] text-[var(--text-muted)]"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}