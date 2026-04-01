import { useEffect, useRef, useState } from "react";
import { formatProductPDFDateTime } from "../utils/productPDFs";

export default function ProductPDFConflictModal({ open, conflicts, onClose, onConfirm }) {
  const modalRef = useRef(null);
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    if (!open || !conflicts?.existing) return;

    const defaults = {};
    conflicts.existing.forEach((item) => {
      defaults[item.背番号] = Array.isArray(item.pdfs) && item.pdfs.length > 1 ? "all" : "overwrite";
    });
    setResolutions(defaults);
  }, [open, conflicts]);

  useEffect(() => {
    if (!open) return undefined;

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
  }, [open, onClose]);

  if (!open || !conflicts) return null;

  const existing = Array.isArray(conflicts.existing) ? conflicts.existing : [];
  const newProducts = Array.isArray(conflicts.newProducts) ? conflicts.newProducts : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="glass-card flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Conflict Check</div>
                <h3 className="mt-1 text-xl font-bold text-on-surface">Existing PDFs Detected</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {existing.length} product(s) already have {conflicts.pdfType || "this type of"} files. Choose how each one should be handled.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-5 scrollbar-hide">
            <div className="space-y-3">
              {existing.map((item) => {
                const pdfCount = Array.isArray(item.pdfs) ? item.pdfs.length : 0;
                const selectValue = resolutions[item.背番号] || (pdfCount > 1 ? "all" : "overwrite");

                return (
                  <div key={item.背番号} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-bold text-on-surface">{item.背番号}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">
                          {pdfCount} existing file{pdfCount === 1 ? "" : "s"}
                        </div>
                        <div className="mt-2 text-xs text-outline">
                          {(item.pdfs || []).map((pdf) => formatProductPDFDateTime(pdf?.uploadedAt)).join(" / ") || "Unknown upload dates"}
                        </div>
                      </div>

                      <select
                        value={selectValue}
                        onChange={(event) => setResolutions((current) => ({
                          ...current,
                          [item.背番号]: event.target.value,
                        }))}
                        className="h-11 rounded-2xl border border-outline-variant/20 bg-surface px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                      >
                        {pdfCount > 1 ? (
                          <>
                            <option value="all">Overwrite all</option>
                            <option value="newest">Overwrite newest only</option>
                            <option value="skip">Skip this product</option>
                          </>
                        ) : (
                          <>
                            <option value="overwrite">Overwrite</option>
                            <option value="skip">Skip this product</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {newProducts.length > 0 && (
              <div className="rounded-2xl border border-primary/15 bg-primary/10 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">No Conflict</div>
                <div className="mt-2 text-sm text-on-surface">
                  {newProducts.join(", ")}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(resolutions)}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
            >
              Continue Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}