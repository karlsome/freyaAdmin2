import { useEffect, useRef, useState } from "react";
import { filterSelectableProducts } from "../utils/productPDFs";
import EmptyState from "./EmptyState";
import IconButton from "./IconButton";

export default function ProductPDFProductSelectorModal({
  open,
  products = [],
  filterType = "model",
  selectedModel = "",
  selectedSerialNumbers = [],
  onClose,
  onConfirm,
}) {
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

  const visibleProducts = filterSelectableProducts(products, {
    searchTerm,
    filterType,
    selectedModel,
  });
  const visibleSerialNumbers = visibleProducts
    .map((product) => String(product?.背番号 || ""))
    .filter(Boolean);

  function toggleSelection(serialNumber) {
    setDraftSelection((current) => {
      const next = new Set(current);
      if (next.has(serialNumber)) next.delete(serialNumber);
      else next.add(serialNumber);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="glass-card flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-separator/40 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Product Selector</div>
                <h3 className="mt-1 text-lg font-semibold text-on-surface">Select Products by 背番号</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {draftSelection.size} selected across {visibleProducts.length} visible products.
                </p>
              </div>

              <IconButton icon="close" onClick={onClose} size="md" ariaLabel="Close dialog" />
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by 背番号, 品番, or モデル"
              className="mt-4 w-full rounded-2xl border border-separator/40 bg-white px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 px-5 py-3">
            <div className="text-sm text-on-surface-variant">
              {selectedModel && filterType === "model" ? `Filtered to model ${selectedModel}.` : "Showing all matching products."}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftSelection(new Set(visibleSerialNumbers))}
                className="rounded-2xl border border-separator/40 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Check visible
              </button>
              <button
                type="button"
                onClick={() => setDraftSelection(new Set())}
                className="rounded-2xl border border-separator/40 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Uncheck all
              </button>
            </div>
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-3 py-3 scrollbar-hide">
            {visibleProducts.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product) => {
                  const serialNumber = String(product?.背番号 || "");
                  const checked = draftSelection.has(serialNumber);

                  return (
                    <label
                      key={`${serialNumber}-${product?.品番 || ""}`}
                      className={[
                        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
                        checked
                          ? "border-primary/40 bg-primary/10"
                          : "border-outline-variant/15 bg-surface-container-low hover:bg-surface-container",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(serialNumber)}
                        className="mt-1 h-4 w-4 rounded border-outline-variant/40"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-on-surface">{serialNumber}</div>
                        <div className="truncate text-xs text-on-surface-variant">{product?.品番 || "—"}</div>
                        <div className="truncate text-xs text-outline">{product?.モデル || "No model"}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <EmptyState className="bg-surface-container-low py-10">No products matched the current search.</EmptyState>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-separator/40 px-5 py-4">
            <div className="text-sm text-on-surface-variant">{draftSelection.size} products selected</div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm([...draftSelection].sort((left, right) => left.localeCompare(right, "ja")))}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}