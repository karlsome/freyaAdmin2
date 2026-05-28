import { useRef } from "react";

export default function ProductPDFUploadPanel({
  typeMeta,
  uploadExpanded,
  onToggleExpanded,
  filterType,
  onFilterTypeChange,
  selectedModel,
  modelOptions = [],
  onSelectedModelChange,
  selectedSerialNumbers = [],
  productMap,
  onOpenProductSelector,
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
    <div className="glass-card overflow-hidden rounded-3xl mb-6">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-surface-container-low"
      >
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Upload</div>
          <div className="mt-1 text-base font-bold text-on-surface">{typeMeta.label} PDFs</div>
          <div className="mt-1 text-sm text-on-surface-variant">
            Link uploaded files to one or more products before they appear in the library.
          </div>
        </div>

        <span className="material-symbols-outlined text-on-surface-variant">
          {uploadExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
      </button>

      {uploadExpanded && (
        <div className="border-t border-separator/30 px-5 py-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Filter Type</label>
              <select
                value={filterType}
                onChange={(event) => onFilterTypeChange(event.target.value)}
                className="h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
              >
                <option value="model">モデル (Model)</option>
                <option value="serial">背番号 (Serial Number)</option>
              </select>
            </div>

            {filterType === "model" ? (
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Model</label>
                <select
                  value={selectedModel}
                  onChange={(event) => onSelectedModelChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                >
                  <option value="">Select model…</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Products</label>
                <button
                  type="button"
                  onClick={onOpenProductSelector}
                  className="ui-control-surface flex h-11 w-full items-center justify-between rounded-2xl border border-separator/40 px-4 text-sm font-medium transition"
                >
                  <span>{selectedSerialNumbers.length ? `${selectedSerialNumbers.length} selected` : "Select products…"}</span>
                  <span className="material-symbols-outlined text-base text-on-surface-variant">chevron_right</span>
                </button>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Selected Products</label>
                <button
                  type="button"
                  onClick={onOpenProductSelector}
                  className="text-xs font-bold text-primary transition hover:opacity-80"
                >
                  Show all
                </button>
              </div>
              <div className="ui-control-surface flex h-11 items-center rounded-2xl border border-separator/40 px-4 text-sm text-on-surface-variant">
                {selectedSerialNumbers.length ? `${selectedSerialNumbers.length} product${selectedSerialNumbers.length === 1 ? "" : "s"} selected` : "None selected"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleTags.length ? visibleTags.map((serialNumber) => {
              const product = productMap.get(serialNumber);
              return (
                <span key={serialNumber} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                  <span>{serialNumber}</span>
                  {product?.品番 && <span className="text-primary/70">{product.品番}</span>}
                  <button
                    type="button"
                    onClick={() => onRemoveSelectedSerial(serialNumber)}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 transition hover:bg-primary/20"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/20 px-4 py-3 text-sm text-on-surface-variant">
                Select at least one product before uploading.
              </div>
            )}
            {selectedSerialNumbers.length > visibleTags.length && (
              <button
                type="button"
                onClick={onOpenProductSelector}
                className="rounded-full border border-separator/40 px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-surface-container"
              >
                +{selectedSerialNumbers.length - visibleTags.length} more
              </button>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Single Upload</div>
              <div className="mt-2 text-sm text-on-surface-variant">Upload one PDF and attach it to the current product selection.</div>
              <input
                key={singleFile?.name || "single-empty"}
                ref={singleInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => onSingleFileChange(event.target.files?.[0] || null)}
                className="mt-4 block w-full rounded-2xl border border-separator/40 bg-surface px-4 py-3 text-sm text-on-surface"
              />
              <div className="mt-2 text-xs text-on-surface-variant">{singleFile ? singleFile.name : "No PDF selected"}</div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (singleInputRef.current) singleInputRef.current.value = "";
                    onClearSingleFile();
                  }}
                  className="rounded-xl border border-separator/40 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onUploadSingle}
                  disabled={singleUploading || !singleFile || !selectedSerialNumbers.length}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {singleUploading ? "Uploading…" : `Upload ${typeMeta.label}`}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Bulk Upload</div>
              <div className="mt-2 text-sm text-on-surface-variant">Select multiple PDFs and review filename matches against the selected 背番号 set.</div>
              <input
                key={bulkFiles.map((file) => file.name).join("|") || "bulk-empty"}
                ref={bulkInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(event) => onBulkFilesChange(Array.from(event.target.files || []))}
                className="mt-4 block w-full rounded-2xl border border-separator/40 bg-surface px-4 py-3 text-sm text-on-surface"
              />
              <div className="mt-2 text-xs text-on-surface-variant">
                {bulkFiles.length ? `${bulkFiles.length} file${bulkFiles.length === 1 ? "" : "s"} selected` : "No PDFs selected"}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkInputRef.current) bulkInputRef.current.value = "";
                    onClearBulkFiles();
                  }}
                  className="rounded-xl border border-separator/40 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onReviewBulkUpload}
                  disabled={bulkUploading || !bulkFiles.length || !selectedSerialNumbers.length}
                  className="rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkUploading ? "Uploading…" : "Match & Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}