import { useRef } from "react";

export default function MaterialPDFUploadPanel({
  typeMeta,
  uploadExpanded,
  onToggleExpanded,
  filterType,
  onFilterTypeChange,
  selectedProcess,
  processOptions = [],
  onSelectedProcessChange,
  selectedSerialNumbers = [],
  materialMap,
  onOpenMaterialSelector,
  onRemoveSelectedSerial,
  singleFile,
  singleUploading,
  onSingleFileChange,
  onClearSingleFile,
  onUploadSingle,
  bulkFiles = [],
  bulkUploading,
  onBulkFilesChange,
  onClearBulkFiles,
  onReviewBulkUpload,
}) {
  const singleInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  const visibleTags = selectedSerialNumbers.slice(0, 10);

  return (
    <div className="freya-card mb-6 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[var(--surface-hover)]"
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Upload</div>
          <div className="mt-0.5 text-base font-bold text-[var(--text-primary)]">{typeMeta.label} PDFs</div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Link uploaded files to one or more materials before they appear in the library.
          </div>
        </div>

        <span className="material-symbols-outlined text-[var(--text-muted)]">
          {uploadExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
      </button>

      {uploadExpanded && (
        <div className="border-t border-[var(--border)] px-5 py-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Filter Type</label>
              <select
                value={filterType}
                onChange={(event) => onFilterTypeChange(event.target.value)}
                className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
              >
                <option value="process">工程コード (Process)</option>
                <option value="drawing">図番 (Drawing Number)</option>
              </select>
            </div>

            {filterType === "process" ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Process</label>
                <select
                  value={selectedProcess}
                  onChange={(event) => onSelectedProcessChange(event.target.value)}
                  className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                >
                  <option value="">Select process…</option>
                  {processOptions.map((process) => (
                    <option key={process} value={process}>{process}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Materials</label>
                <button
                  type="button"
                  onClick={onOpenMaterialSelector}
                  className="flex h-9 w-full items-center justify-between rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  <span>{selectedSerialNumbers.length ? `${selectedSerialNumbers.length} selected` : "Select materials…"}</span>
                  <span className="material-symbols-outlined text-base text-[var(--text-muted)]">chevron_right</span>
                </button>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Selected Materials</label>
                <button
                  type="button"
                  onClick={onOpenMaterialSelector}
                  className="text-xs font-semibold text-[var(--freya-blue)] transition hover:opacity-80"
                >
                  Show all
                </button>
              </div>
              <div className="flex h-9 items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-secondary)]">
                {selectedSerialNumbers.length ? `${selectedSerialNumbers.length} material${selectedSerialNumbers.length === 1 ? "" : "s"} selected` : "None selected"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleTags.length ? visibleTags.map((drawingNumber) => {
              const materialsGroup = materialMap.get(drawingNumber) || [];
              const firstMaterial = materialsGroup[0];
              const hinbanLabel = materialsGroup.length > 1 ? `${firstMaterial?.品番} (+${materialsGroup.length - 1})` : firstMaterial?.品番;

              return (
                <span key={drawingNumber} className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--freya-blue)]">
                  <span>{drawingNumber}</span>
                  {hinbanLabel && <span className="opacity-70">{hinbanLabel}</span>}
                  <button
                    type="button"
                    onClick={() => onRemoveSelectedSerial(drawingNumber)}
                    className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--freya-blue)]/10 transition hover:bg-[var(--freya-blue)]/20"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              );
            }) : (
              <div className="rounded-[6px] border border-dashed border-[var(--border)] px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
                Select at least one material before uploading.
              </div>
            )}
            {selectedSerialNumbers.length > visibleTags.length && (
              <button
                type="button"
                onClick={onOpenMaterialSelector}
                className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs"
              >
                +{selectedSerialNumbers.length - visibleTags.length} more
              </button>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Single Upload</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">Upload one PDF and attach it to the current material selection.</div>
              <input
                key={singleFile?.name || "single-empty"}
                ref={singleInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => onSingleFileChange(event.target.files?.[0] || null)}
                className="mt-3 block w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />
              <div className="mt-1.5 text-xs text-[var(--text-muted)]">{singleFile ? singleFile.name : "No PDF selected"}</div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (singleInputRef.current) singleInputRef.current.value = "";
                    onClearSingleFile();
                  }}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onUploadSingle}
                  disabled={singleUploading || !singleFile || !selectedSerialNumbers.length}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {singleUploading ? "Uploading…" : `Upload ${typeMeta.label}`}
                </button>
              </div>
            </div>

            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Bulk / Auto-Match Upload</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">Select PDFs and review matches against the selected 図番 set (or the entire database if none selected).</div>
              <input
                key={bulkFiles.map((file) => file.name).join("|") || "bulk-empty"}
                ref={bulkInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(event) => onBulkFilesChange(Array.from(event.target.files || []))}
                className="mt-3 block w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />
              <div className="mt-1.5 text-xs text-[var(--text-muted)]">
                {bulkFiles.length ? `${bulkFiles.length} file${bulkFiles.length === 1 ? "" : "s"} selected` : "No PDFs selected"}
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkInputRef.current) bulkInputRef.current.value = "";
                    onClearBulkFiles();
                  }}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onReviewBulkUpload}
                  disabled={bulkUploading || !bulkFiles.length}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkUploading ? "Uploading…" : (selectedSerialNumbers.length ? "Match & Review" : "Auto-Match & Review")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}