import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";
import { getProductCapacity } from "../../utils/planner";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerManualGoalModal({
  open,
  products = [],
  initialDate,
  submitting = false,
  onClose,
  onSubmit,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
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
      title={isJa ? "目標の手動入力" : "Manual Goal Input"}
      subtitle={isJa ? "マスターDBから製品を検索し、選択した日付の生産目標を追加します。" : "Search a product from master DB and add a production goal for the selected date."}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={submitting || !selectedProduct || !date || Number(targetQuantity) <= 0}
            onClick={() => onSubmit({ product: selectedProduct, quantity: Number(targetQuantity), date })}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (isJa ? "保存中…" : "Saving…") : (isJa ? "目標を追加" : "Add Goal")}
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "目標日" : "Goal Date"}
            </label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "製品検索" : "Search Product"}
            </label>
            <div className="mt-1.5 flex h-9 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--freya-blue)] focus-within:ring-1 focus-within:ring-[var(--freya-blue)]">
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isJa ? "背番号、品番、品名で検索…" : "Search by 背番号, 品番, or 品名…"}
                className="h-full flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "目標数量" : "Target Quantity"}
            </label>
            <input
              type="number"
              min="1"
              value={targetQuantity}
              onChange={(event) => setTargetQuantity(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
          </div>

          {selectedProduct ? (
            <div className="rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/5 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--freya-blue)]">
                {isJa ? "選択中の製品" : "Selected Product"}
              </div>
              <div className="mt-1 text-xs font-bold text-[var(--text-primary)]">{selectedProduct.背番号}</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">{selectedProduct.品番}</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">{selectedProduct.品名 || (isJa ? "品名未設定" : "Unnamed product")}</div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "製品一覧" : "Products"}
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                {isJa ? `${filteredProducts.length} 件該当` : `Showing ${filteredProducts.length} matches`}
              </div>
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
                  className={`w-full rounded-[6px] border px-3 py-2 text-left transition ${active ? "border-[var(--freya-blue)]/40 bg-[var(--freya-blue)]/10" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"}`}
                >
                  <div className="text-xs font-semibold text-[var(--text-primary)]">{item.背番号}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">{item.品番}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">{item.品名 || (isJa ? "品名未設定" : "Unnamed product")}</div>
                </button>
              );
            })}

            {!filteredProducts.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">
                {isJa ? "検索条件に一致する製品はありません。" : "No products match the current search."}
              </EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </PlannerModalShell>
  );
}