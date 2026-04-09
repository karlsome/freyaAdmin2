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
  valueClassName = "",
  subtitleClassName = "",
  iconClassName = "",
  iconSize = 18,
}) {
  const RootTag = onClick ? "button" : "div";

  return (
    <RootTag
      {...(onClick ? { type: "button", onClick } : {})}
      className={joinClasses(
        "glass-card rounded-2xl p-4 flex flex-col gap-2",
        onClick ? "w-full text-left transition-transform duration-200 hover:-translate-y-0.5" : "",
        active ? "ring-2 ring-primary/40" : "",
        className,
      )}
    >
      <div className={joinClasses("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", accent, iconClassName)}>
        <span className="material-symbols-outlined" style={{ fontSize: iconSize }}>{icon}</span>
      </div>

      <div>
        <p className={joinClasses("text-xl font-black text-on-surface leading-none", valueClassName)}>
          {loading
            ? <span className="inline-block w-16 h-5 rounded bg-surface-container-high animate-pulse" />
            : value}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-on-surface-variant">{label}</p>
        <p className={joinClasses("mt-0.5 text-[10px] text-outline", subtitleClassName)}>{loading ? "" : subtitle}</p>
      </div>
    </RootTag>
  );
}