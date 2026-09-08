import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const { language } = useLanguage();
  const isJa = language === "ja";
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

  const modal = (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 lg:p-6">
        <div className={joinClasses("freya-card flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl", maxWidthClassName)}>
          <div className="border-b border-[var(--border)] px-5 py-4 bg-[var(--surface)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className={joinClasses("min-w-0", showIcon ? "flex items-start gap-3.5" : "") }>
                {showIcon ? (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--freya-blue)]">
                    <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                      {icon}
                    </span>
                  </div>
                ) : null}

                <div className="min-w-0">
                  {eyebrow ? (
                    <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{eyebrow}</div>
                  ) : null}
                  <h2 className="mt-0.5 break-words text-base font-semibold text-[var(--text-primary)] [overflow-wrap:anywhere]">{title}</h2>
                  {subtitle ? <p className="mt-0.5 break-words text-xs text-[var(--text-muted)] [overflow-wrap:anywhere]">{subtitle}</p> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={isJa ? "ダイアログを閉じる" : "Close dialog"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-6">{children}</div>

          {footer ? (
            <div className="border-t border-[var(--border)] px-5 py-3.5 bg-[var(--surface)]">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}