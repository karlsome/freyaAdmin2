import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";
import { getProductCapacity } from "../../utils/planner";

export default function PlannerManualGoalModal({
  open,
  products = [],
  initialDate,
  submitting = false,
  onClose,
  onSubmit,
}) {
  const [search, setSearch] = useState("");
  const [selectedSerial, setSelectedSerial] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [date, setDate] = useState(initialDate);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedSerial("");
    setTargetQuantity("");
    setDate(initialDate);
  }, [open, initialDate]);

  const filteredProducts = products
    .filter((item) => {
      const query = search.toLowerCase();
      if (!query) return true;
      return (
        String(item.背番号 || "").toLowerCase().includes(query)
        || String(item.品番 || "").toLowerCase().includes(query)
        || String(item.品名 || "").toLowerCase().includes(query)
      );
    })
    .slice(0, 60);

  const selectedProduct = products.find((item) => item.背番号 === selectedSerial) || null;

  function handleSelectProduct(serial) {
    const nextProduct = products.find((item) => item.背番号 === serial);
    setSelectedSerial(serial);
    if (nextProduct) {
      setTargetQuantity(String(getProductCapacity(nextProduct, products)));
    }
  }

  return (
    <PlannerModalShell
      open={open}
      title="Manual Goal Input"
      subtitle="Search a product from master DB and add a production goal for the selected date."
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-separator/40 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !selectedProduct || !date || Number(targetQuantity) <= 0}
            onClick={() => onSubmit({ product: selectedProduct, quantity: Number(targetQuantity), date })}
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Add Goal"}
          </button>
        </div>
      )}
    >
      <div className="planner-data-text grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <label className="planner-data-label text-outline">Goal Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-separator/40 px-4 outline-none transition focus:border-primary/40"
            />
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <label className="planner-data-label text-outline">Search Product</label>
            <div className="ui-control-surface mt-2 flex h-11 items-center gap-3 rounded-2xl border border-separator/40 px-4">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by 背番号, 品番, or 品名…"
                className="planner-data-text h-full flex-1 bg-transparent outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <label className="planner-data-label text-outline">Target Quantity</label>
            <input
              type="number"
              min="1"
              value={targetQuantity}
              onChange={(event) => setTargetQuantity(event.target.value)}
              className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-separator/40 px-4 outline-none transition focus:border-primary/40"
            />
          </div>

          {selectedProduct ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/8 p-4">
              <div className="planner-data-label text-primary">Selected Product</div>
              <div className="mt-2 font-semibold text-on-surface">{selectedProduct.背番号}</div>
              <div className="mt-1 text-on-surface-variant">{selectedProduct.品番}</div>
              <div className="mt-1 text-on-surface-variant">{selectedProduct.品名 || "Unnamed product"}</div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="planner-data-label text-outline">Products</div>
              <div className="mt-1 text-on-surface-variant">Showing {filteredProducts.length} matches</div>
            </div>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {filteredProducts.map((item) => {
              const active = item.背番号 === selectedSerial;
              return (
                <button
                  key={item.背番号}
                  type="button"
                  onClick={() => handleSelectProduct(item.背番号)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${active ? "border-primary/35 bg-primary/10" : "border-outline-variant/15 bg-surface hover:bg-surface-container"}`}
                >
                  <div className="font-semibold text-on-surface">{item.背番号}</div>
                  <div className="mt-1 text-on-surface-variant">{item.品番}</div>
                  <div className="mt-1 text-on-surface-variant">{item.品名 || "Unnamed product"}</div>
                </button>
              );
            })}

            {!filteredProducts.length ? (
              <EmptyState className="bg-surface px-4 py-10">No products match the current search.</EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </PlannerModalShell>
  );
}