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
      onClick={onClose}
    >
      <div className={`flex min-h-full ${alignClass} justify-center px-4`}>
        <div
          className={["dashboard-section flex w-full flex-col overflow-hidden rounded-2xl", maxWidth, cardClassName].filter(Boolean).join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-separator/40 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                {eyebrow ? (
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">{eyebrow}</div>
                ) : null}
                <h3 className={`${eyebrow ? "mt-2" : ""} text-2xl font-semibold text-on-surface`}>{title}</h3>
                {subtitle ? (
                  <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          </div>

          {children}

          {footer ? (
            <div className={footerClassName ?? "border-t border-separator/40 px-6 py-4"}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
