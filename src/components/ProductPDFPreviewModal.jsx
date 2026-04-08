import { useEffect, useRef } from "react";
import { formatProductPDFTitle } from "../utils/productPDFs";

export default function ProductPDFPreviewModal({ item, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!item) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    function handleMouseDown(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-950/95 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">Preview</div>
              <h3 className="mt-1 text-lg font-bold">{formatProductPDFTitle(item)}</h3>
              <p className="mt-1 text-sm text-white/60">{item.fileName || "Untitled file"}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex min-h-[60vh] items-center justify-center bg-black/30 p-4">
            {item.imageURL ? (
              <img src={item.imageURL} alt={item.fileName} className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/70">
                Preview image not available for this file.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
            {item.imageURL && (
              <a
                href={item.imageURL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
              >
                Open Preview Image
              </a>
            )}
            {item.pdfURL && (
              <a
                href={item.pdfURL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
              >
                Open Original PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}