import { useEffect } from "react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function NodaModalFrame({
  open,
  title,
  subtitle,
  eyebrow = "",
  icon = "inventory_2",
  showIcon = true,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-6xl",
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 lg:p-6">
        <div className={joinClasses("glass-card flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl", maxWidthClassName)}>
          <div className="border-b border-separator/35 px-5 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className={joinClasses("min-w-0", showIcon ? "flex items-start gap-4" : "") }>
                {showIcon ? (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-separator/40 bg-white/80 text-primary dark:bg-surface-container">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {icon}
                    </span>
                  </div>
                ) : null}

                <div className="min-w-0">
                  {eyebrow ? (
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">{eyebrow}</div>
                  ) : null}
                  <h2 className="mt-1 break-words text-xl font-black text-on-surface [overflow-wrap:anywhere]">{title}</h2>
                  {subtitle ? <p className="mt-1 break-words text-sm text-on-surface-variant [overflow-wrap:anywhere]">{subtitle}</p> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
                aria-label="Close dialog"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-6">{children}</div>

          {footer ? (
            <div className="border-t border-outline-variant/15 px-5 py-4 lg:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}