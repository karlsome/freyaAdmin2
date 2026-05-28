import { useEffect, useState } from "react";
import { formatProductPDFDateTime } from "../utils/productPDFs";
import ModalShell from "./ModalShell";

export default function ProductPDFConflictModal({ open, conflicts, onClose, onConfirm }) {
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    if (!open || !conflicts?.existing) return;

    const defaults = {};
    conflicts.existing.forEach((item) => {
      defaults[item.背番号] = Array.isArray(item.pdfs) && item.pdfs.length > 1 ? "all" : "overwrite";
    });
    setResolutions(defaults);
  }, [open, conflicts]);

  if (!open || !conflicts) return null;

  const existing = Array.isArray(conflicts.existing) ? conflicts.existing : [];
  const newProducts = Array.isArray(conflicts.newProducts) ? conflicts.newProducts : [];

  return (
    <ModalShell
      open={!!open}
      onClose={onClose}
      eyebrow="Conflict Check"
      title="Existing PDFs Detected"
      subtitle={`${existing.length} product(s) already have ${conflicts.pdfType || "this type of"} files. Choose how each one should be handled.`}
      maxWidth="max-w-3xl"
      overlayOpacity="50"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(resolutions)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
          >
            Continue Upload
          </button>
        </div>
      }
    >
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
                        className="h-11 rounded-2xl border border-separator/40 bg-surface px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
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
    </ModalShell>
  );
}
