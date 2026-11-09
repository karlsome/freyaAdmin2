import { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";

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

  const modal = (
    <div
      className={`fixed inset-0 ${zIndex} bg-black/${overlayOpacity} backdrop-blur-sm`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div 
        className={`flex min-h-full ${alignClass} justify-center px-4`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div
          className={["freya-card flex w-full flex-col overflow-hidden rounded-[12px] bg-[var(--surface-raised)] shadow-2xl border border-[var(--border)]", maxWidth, cardClassName].filter(Boolean).join(" ")}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[var(--border)] px-6 py-4 bg-[var(--surface-raised)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                {eyebrow ? (
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{eyebrow}</div>
                ) : null}
                <h3 className={`${eyebrow ? "mt-1" : ""} text-lg font-semibold text-[var(--text-primary)] leading-tight`}>{title}</h3>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)] font-normal">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
          </div>

          {children}

          {footer ? (
            <div className={footerClassName ?? "border-t border-[var(--border)] px-6 py-3.5 bg-[var(--surface-raised)] flex items-center justify-end gap-3"}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
