import { createPortal } from "react-dom";
import { useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import ScnaNcProgramPreview from "./ScnaNcProgramPreview";

export default function ScnaNcPreviewModal({ title, subtitle, points, loading, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[88vh] w-full max-w-6xl flex-col rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
            {isJa ? "閉じる ✕" : "Close ✕"}
          </button>
        </div>
        <div className="min-h-0 flex-1 p-4">
          {loading && !points && <p className="text-xs text-[var(--text-muted)]">{isJa ? "読み込み中…" : "Loading…"}</p>}
          {points && <ScnaNcProgramPreview points={points} height="100%" />}
        </div>
      </div>
    </div>
  , document.body);
}
