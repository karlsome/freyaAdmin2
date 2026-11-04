import { useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";

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
  const { language } = useLanguage();
  const isJa = language === "ja";

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
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {isJa ? "アップロード" : "Upload"}
          </div>
          <div className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
            {typeMeta.label} {isJa ? "PDF" : "PDFs"}
          </div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {isJa
              ? "アップロードしたファイルを1つ以上の製品に紐付けてライブラリに登録します。"
              : "Link uploaded files to one or more products before they appear in the library."}
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
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {isJa ? "絞り込み種別" : "Filter Type"}
              </label>
              <select
                value={filterType}
                onChange={(event) => onFilterTypeChange(event.target.value)}
                className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
              >
                <option value="model">{isJa ? "モデル (Model)" : "Model"}</option>
                <option value="serial">{isJa ? "背番号 (Serial Number)" : "Serial Number (背番号)"}</option>
              </select>
            </div>

            {filterType === "model" ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {isJa ? "モデル" : "Model"}
                </label>
                <select
                  value={selectedModel}
                  onChange={(event) => onSelectedModelChange(event.target.value)}
                  className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                >
                  <option value="">{isJa ? "モデルを選択…" : "Select model…"}</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {isJa ? "製品選択" : "Products"}
                </label>
                <button
                  type="button"
                  onClick={onOpenProductSelector}
                  className="flex h-9 w-full items-center justify-between rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  <span>
                    {selectedSerialNumbers.length
                      ? `${selectedSerialNumbers.length} ${isJa ? "件選択中" : "selected"}`
                      : (isJa ? "製品を選択…" : "Select products…")}
                  </span>
                  <span className="material-symbols-outlined text-base text-[var(--text-muted)]">chevron_right</span>
                </button>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {isJa ? "選択中の製品" : "Selected Products"}
                </label>
                <button
                  type="button"
                  onClick={onOpenProductSelector}
                  className="text-xs font-semibold text-[var(--freya-blue)] transition hover:opacity-80"
                >
                  {isJa ? "すべて表示" : "Show all"}
                </button>
              </div>
              <div className="flex h-9 items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-secondary)]">
                {selectedSerialNumbers.length
                  ? `${selectedSerialNumbers.length} ${isJa ? "件の製品を選択中" : "product(s) selected"}`
                  : (isJa ? "未選択" : "None selected")}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleTags.length ? visibleTags.map((serialNumber) => {
              const product = productMap.get(serialNumber);
              return (
                <span key={serialNumber} className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--freya-blue)]">
                  <span>{serialNumber}</span>
                  {product?.品番 && <span className="opacity-70">{product.品番}</span>}
                  <button
                    type="button"
                    onClick={() => onRemoveSelectedSerial(serialNumber)}
                    className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[var(--freya-blue)]/10 transition hover:bg-[var(--freya-blue)]/20"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              );
            }) : (
              <div className="rounded-[6px] border border-dashed border-[var(--border)] px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
                {isJa ? "アップロード前に対象製品を1つ以上選択してください。" : "Select at least one product before uploading."}
              </div>
            )}
            {selectedSerialNumbers.length > visibleTags.length && (
              <button
                type="button"
                onClick={onOpenProductSelector}
                className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs"
              >
                +{selectedSerialNumbers.length - visibleTags.length} {isJa ? "件以上" : "more"}
              </button>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {isJa ? "個別アップロード" : "Single Upload"}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {isJa
                  ? "1つのPDFをアップロードし、現在選択されている製品に紐付けます。"
                  : "Upload one PDF and attach it to the current product selection."}
              </div>
              <input
                key={singleFile?.name || "single-empty"}
                ref={singleInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => onSingleFileChange(event.target.files?.[0] || null)}
                className="mt-3 block w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />
              <div className="mt-1.5 text-xs text-[var(--text-muted)]">
                {singleFile ? singleFile.name : (isJa ? "PDF未選択" : "No PDF selected")}
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (singleInputRef.current) singleInputRef.current.value = "";
                    onClearSingleFile();
                  }}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  {isJa ? "クリア" : "Clear"}
                </button>
                <button
                  type="button"
                  onClick={onUploadSingle}
                  disabled={singleUploading || !singleFile || !selectedSerialNumbers.length}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {singleUploading
                    ? (isJa ? "アップロード中…" : "Uploading…")
                    : (isJa ? `${typeMeta.label}をアップロード` : `Upload ${typeMeta.label}`)}
                </button>
              </div>
            </div>

            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {isJa ? "一括アップロード" : "Bulk Upload"}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {isJa
                  ? "複数のPDFを選択し、選択された背番号セットとファイル名を自動照合・確認します。"
                  : "Select multiple PDFs and review filename matches against the selected 背番号 set."}
              </div>
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
                {bulkFiles.length
                  ? `${bulkFiles.length} ${isJa ? "件のファイルを選択中" : `file${bulkFiles.length === 1 ? "" : "s"} selected`}`
                  : (isJa ? "PDF未選択" : "No PDFs selected")}
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
                  {isJa ? "クリア" : "Clear"}
                </button>
                <button
                  type="button"
                  onClick={onReviewBulkUpload}
                  disabled={bulkUploading || !bulkFiles.length || !selectedSerialNumbers.length}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkUploading ? (isJa ? "アップロード中…" : "Uploading…") : (isJa ? "照合・確認" : "Match & Review")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}