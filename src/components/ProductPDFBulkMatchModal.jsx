import { useEffect, useRef, useState } from "react";

export default function ProductPDFBulkMatchModal({
  open,
  matchData,
  selectedSerialNumbers = [],
  onClose,
  onConfirm,
}) {
  const modalRef = useRef(null);
  const [manualAssignments, setManualAssignments] = useState({});

  useEffect(() => {
    if (!open) return;
    setManualAssignments({});
  }, [open, matchData]);

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

  if (!open || !matchData) return null;

  const matched = Array.isArray(matchData.matched) ? matchData.matched : [];
  const toAssign = Array.isArray(matchData.toAssign) ? matchData.toAssign : [];
  const unassignedSerials = Array.isArray(matchData.unassignedSerials) ? matchData.unassignedSerials : [];
  const totalFiles = matched.length + toAssign.length;

  function handleConfirm() {
    const assignments = [
      ...matched.map((item) => ({ file: item.file, serialNumber: item.serialNumber })),
      ...toAssign.flatMap((item, index) => {
        const serialNumber = manualAssignments[index];
        return serialNumber ? [{ file: item.file, serialNumber }] : [];
      }),
    ];

    onConfirm(assignments);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="glass-card flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Bulk Match Review</div>
                <h3 className="mt-1 text-xl font-bold text-on-surface">Review filename matches</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {totalFiles} files selected. {matched.length} matched automatically, {toAssign.length} need manual assignment.
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

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5 scrollbar-hide">
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Matched Files</div>
              <div className="mt-3 space-y-2">
                {matched.length ? matched.map((item) => (
                  <div key={`${item.file.name}-${item.serialNumber}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                    <span className="truncate text-on-surface">{item.file.name}</span>
                    <span className="shrink-0 font-bold text-primary">{item.serialNumber}</span>
                  </div>
                )) : (
                  <div className="rounded-xl bg-surface px-3 py-3 text-sm text-on-surface-variant">No automatic matches were found.</div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Manual Assignment</div>
              <div className="mt-3 space-y-3">
                {toAssign.length ? toAssign.map((item, index) => (
                  <div key={`${item.file.name}-${index}`} className="rounded-xl bg-surface px-3 py-3">
                    <div className="text-sm font-bold text-on-surface">{item.file.name}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {item.candidates?.length ? `Candidates: ${item.candidates.join(", ")}` : "No filename match found"}
                    </div>

                    <select
                      value={manualAssignments[index] || ""}
                      onChange={(event) => setManualAssignments((current) => ({
                        ...current,
                        [index]: event.target.value,
                      }))}
                      className="mt-3 h-11 w-full rounded-2xl border border-outline-variant/20 bg-surface-container px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                    >
                      <option value="">Skip this file</option>
                      {selectedSerialNumbers.map((serialNumber) => (
                        <option key={`${item.file.name}-${serialNumber}`} value={serialNumber}>{serialNumber}</option>
                      ))}
                    </select>
                  </div>
                )) : (
                  <div className="rounded-xl bg-surface px-3 py-3 text-sm text-on-surface-variant">Every file was matched automatically.</div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Selected 背番号 Without a File</div>
              <div className="mt-3 text-sm text-on-surface-variant">
                {unassignedSerials.length ? unassignedSerials.join(", ") : "All selected products have at least one file match."}
              </div>
            </section>
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
              onClick={handleConfirm}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
            >
              Confirm Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}