import { useEffect } from "react";

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  maxWidth = "max-w-3xl",
  zIndex = "z-50",
  align = "center",
  overlayOpacity = "40",
  closeButtonVariant = "default",
  cardClassName,
  footerClassName,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const alignClass =
    align === "start"
      ? "items-start pt-10 pb-4"
      : "items-center py-4";

  const closeButtonClass =
    closeButtonVariant === "outlined"
      ? "flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/20 bg-white/80 text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
      : "flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface";

  return (
    <div
      className={`fixed inset-0 ${zIndex} bg-black/${overlayOpacity} backdrop-blur-sm`}
      onClick={onClose}
    >
      <div className={`flex min-h-full ${alignClass} justify-center px-4`}>
        <div
          className={["glass-card flex w-full flex-col overflow-hidden rounded-2xl", maxWidth, cardClassName].filter(Boolean).join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                {eyebrow ? (
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">{eyebrow}</div>
                ) : null}
                <h3 className={`${eyebrow ? "mt-2" : ""} text-2xl font-black text-on-surface`}>{title}</h3>
                {subtitle ? (
                  <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={closeButtonClass}
                aria-label="Close dialog"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {children}

          {footer ? (
            <div className={footerClassName ?? "border-t border-outline-variant/15 px-6 py-4"}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
