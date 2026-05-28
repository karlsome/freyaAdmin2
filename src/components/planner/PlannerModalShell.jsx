import { useEffect } from "react";

export default function PlannerModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-3xl",
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`glass-card flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl ${maxWidthClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/15 px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-on-surface">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="border-t border-separator/30 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}