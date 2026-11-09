import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { filterSelectableMaterials } from "../utils/materialPDFs";
import EmptyState from "./EmptyState";
import IconButton from "./IconButton";

export default function MaterialPDFMaterialSelectorModal({
  open,
  materials = [],
  filterType = "process",
  selectedProcess = "",
  selectedSerialNumbers = [],
  onClose,
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const modalRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draftSelection, setDraftSelection] = useState(() => new Set(selectedSerialNumbers));

  useEffect(() => {
    if (!open) return;
    setSearchTerm("");
    setDraftSelection(new Set(selectedSerialNumbers));
  }, [open, selectedSerialNumbers]);

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

  if (!open) return null;

  const visibleMaterials = filterSelectableMaterials(materials, {
    searchTerm,
    filterType,
    selectedProcess,
  });
  const visibleSerialNumbers = visibleMaterials
    .map((material) => String(material?.図番 || ""))
    .filter(Boolean);

  function toggleSelection(drawingNumber) {
    setDraftSelection((current) => {
      const next = new Set(current);
      if (next.has(drawingNumber)) next.delete(drawingNumber);
      else next.add(drawingNumber);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="freya-card flex w-full max-w-4xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {isJa ? "材料選択" : "Material Selector"}
                </div>
                <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
                  {isJa ? "図番で材料を選択" : "Select Materials by 図番"}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {isJa
                    ? `表示中の ${visibleMaterials.length} 件中 ${draftSelection.size} 件を選択`
                    : `${draftSelection.size} selected across ${visibleMaterials.length} visible materials.`}
                </p>
              </div>

              <IconButton icon="close" onClick={onClose} size="md" ariaLabel={isJa ? "閉じる" : "Close dialog"} />
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isJa ? "図番、品番、または工程コードで検索" : "Search by 図番, 品番, or 工程コード"}
              className="mt-3 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-2.5">
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedProcess && filterType === "process"
                ? (isJa ? `工程「${selectedProcess}」で絞り込み中` : `Filtered to process ${selectedProcess}.`)
                : (isJa ? "一致するすべての材料を表示中" : "Showing all matching materials.")}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftSelection(new Set(visibleSerialNumbers))}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                {isJa ? "表示分を選択" : "Check visible"}
              </button>
              <button
                type="button"
                onClick={() => setDraftSelection(new Set())}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                {isJa ? "選択を解除" : "Uncheck all"}
              </button>
            </div>
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-4 py-3.5 scrollbar-hide">
            {visibleMaterials.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visibleMaterials.map((material) => {
                  const drawingNumber = String(material?.図番 || "");
                  const checked = draftSelection.has(drawingNumber);

                  return (
                    <label
                      key={`${drawingNumber}-${material?.品番 || ""}`}
                      className={[
                        "flex cursor-pointer items-start gap-2.5 rounded-[6px] border px-3 py-2.5 transition",
                        checked
                          ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10"
                          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(drawingNumber)}
                        className="mt-0.5 h-3.5 w-3.5 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[var(--text-primary)]">{drawingNumber}</div>
                        <div className="truncate text-[11px] text-[var(--text-secondary)]">{material?.品番 || "—"}</div>
                        <div className="truncate text-[10px] text-[var(--text-muted)]">{material?.工程コード || (isJa ? "工程未設定" : "No process")}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <EmptyState className="bg-[var(--surface-subtle)] py-10">
                {isJa ? "検索条件に一致する材料が見つかりません。" : "No materials matched the current search."}
              </EmptyState>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3.5">
            <div className="text-xs text-[var(--text-secondary)]">
              {isJa ? `${draftSelection.size} 件の材料を選択中` : `${draftSelection.size} materials selected`}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                {isJa ? "キャンセル" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => onConfirm([...draftSelection].sort((left, right) => left.localeCompare(right, "ja")))}
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
              >
                {isJa ? "選択を確定" : "Confirm Selection"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}