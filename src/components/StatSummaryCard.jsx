function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function StatSummaryCard({
  icon,
  label,
  value,
  subtitle,
  accent,
  loading = false,
  active = false,
  onClick,
  className = "",
  labelClassName = "",
  valueClassName = "",
  subtitleClassName = "",
  iconClassName = "",
  iconSize = 20,
}) {
  const RootTag = onClick ? "button" : "div";

  return (
    <RootTag
      {...(onClick ? { type: "button", onClick } : {})}
      className={joinClasses(
        "glass-card rounded-2xl p-5 flex flex-col gap-3",
        onClick ? "w-full text-left card-hover-lift" : "",
        active ? "ring-2 ring-primary/40 border-primary/30" : "",
        className,
      )}
    >
      <div className={joinClasses(
        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
        accent,
        iconClassName,
      )}>
        <span className="material-symbols-outlined" style={{ fontSize: iconSize, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>{icon}</span>
      </div>

      <div>
        <p className={joinClasses("text-display text-on-surface leading-none", valueClassName)}>
          {loading
            ? <span className="inline-block w-16 h-6 rounded-lg bg-surface-container-high animate-pulse" />
            : value}
        </p>
        <p className={joinClasses("mt-1.5 text-[11px] font-medium text-on-surface-variant", labelClassName)}>{label}</p>
        <p className={joinClasses("mt-0.5 text-[10px] text-outline", subtitleClassName)}>{loading ? "" : subtitle}</p>
      </div>
    </RootTag>
  );
}