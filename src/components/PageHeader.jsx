const PAGE_HEADER_TITLE_CLASS = "freya-title";
const PAGE_HEADER_EYEBROW_CLASS = "text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";
const PAGE_HEADER_SUBTITLE_CLASS = "mt-1 text-sm font-normal text-[var(--text-muted)]";

function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  leading,
  titleMeta,
  titleAs: TitleTag = "h1",
  className = "",
  bodyClassName = "",
  titleRowClassName = "",
  actionsClassName = "",
  eyebrowClassName = "",
  titleClassName = "",
  subtitleClassName = "",
}) {
  return (
    <div className={joinClasses("mb-6 pb-4 border-b border-[var(--border)] flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className={joinClasses("flex min-w-0 flex-1 gap-4", bodyClassName)}>
        {leading ? <div className="flex-shrink-0">{leading}</div> : null}

        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className={joinClasses(PAGE_HEADER_EYEBROW_CLASS, eyebrowClassName)}>{eyebrow}</p>
          ) : null}

          <div className={joinClasses("flex min-w-0 flex-wrap items-center gap-3", titleRowClassName)}>
            <TitleTag className={joinClasses(eyebrow ? "mt-1" : "", PAGE_HEADER_TITLE_CLASS, titleClassName)}>
              {title}
            </TitleTag>
            {titleMeta}
          </div>

          {subtitle ? (
            <p className={joinClasses(PAGE_HEADER_SUBTITLE_CLASS, subtitleClassName)}>{subtitle}</p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className={joinClasses("flex flex-wrap items-center gap-3", actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}