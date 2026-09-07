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
  variant = "default",
  statusDot, // e.g. "complete" | "warning" | "defect"
}) {
  const RootTag = onClick ? "button" : "div";
  const isFreya = variant === "freya";

  if (isFreya) {
    return (
      <RootTag
        {...(onClick ? { type: "button", onClick } : {})}
        className={joinClasses(
          "freya-card p-4 sm:p-5 flex flex-col justify-between gap-3 text-left relative overflow-hidden transition-all duration-150",
          onClick ? "cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 active:scale-[0.99]" : "",
          active ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)]" : "",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={joinClasses("freya-label", labelClassName)}>{label}</span>
          {icon && (
            <span
              className={joinClasses(
                "material-symbols-outlined text-slate-400 dark:text-slate-500",
                iconClassName
              )}
              style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 400" }}
            >
              {icon}
            </span>
          )}
        </div>

        <div>
          <div className={joinClasses("freya-kpi-value", valueClassName)}>
            {loading ? (
              <span className="inline-block w-20 h-8 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : (
              value
            )}
          </div>
          {subtitle && (
            <div className={joinClasses("mt-1.5 text-[13px] font-normal text-slate-500 dark:text-slate-400 flex items-center gap-1.5", subtitleClassName)}>
              {statusDot && (
                <span
                  className={joinClasses(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    statusDot === "complete" ? "bg-emerald-500" :
                    statusDot === "warning" ? "bg-amber-500" :
                    statusDot === "defect" ? "bg-rose-500" : "bg-slate-400"
                  )}
                />
              )}
              <span>{loading ? "" : subtitle}</span>
            </div>
          )}
        </div>
      </RootTag>
    );
  }

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