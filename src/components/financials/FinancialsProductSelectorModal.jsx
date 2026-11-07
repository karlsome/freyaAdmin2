import { useMemo, useState } from "react";
import ModalShell from "../ModalShell";

const BTN = "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]";

export default function FinancialsProductSelectorModal({ open, products, initialSelected, modelFilter = "", onConfirm, onClose, isJa }) {
  // Remount-on-open keeps the temp selection in sync with the committed one
  if (!open) return null;
  return (
    <SelectorBody
      products={products}
      initialSelected={initialSelected}
      modelFilter={modelFilter}
      onConfirm={onConfirm}
      onClose={onClose}
      isJa={isJa}
    />
  );
}

function SelectorBody({ products, initialSelected, modelFilter, onConfirm, onClose, isJa }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set(initialSelected));

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (modelFilter && p.モデル !== modelFilter) return false;
        if (!term) return true;
        return (
          (p.背番号 || "").toLowerCase().includes(term) ||
          (p.品番 || "").toLowerCase().includes(term) ||
          (p.モデル || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a.背番号 || "").localeCompare(b.背番号 || ""));
  }, [products, search, modelFilter]);

  function toggle(ban) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ban)) next.delete(ban);
      else next.add(ban);
      return next;
    });
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      title={isJa ? "製品を選択 (背番号)" : "Select Products (背番号)"}
      subtitle={`${selected.size} ${isJa ? "件選択中" : "selected"}`}
      maxWidth="max-w-3xl"
      footer={(
        <>
          <div className="mr-auto flex gap-2">
            <button type="button" className={BTN} onClick={() => setSelected(new Set(visible.map((p) => p.背番号).filter(Boolean)))}>
              {isJa ? "すべて選択" : "Check all"}
            </button>
            <button type="button" className={BTN} onClick={() => setSelected(new Set())}>
              {isJa ? "すべて解除" : "Uncheck all"}
            </button>
          </div>
          <button type="button" className={BTN} onClick={onClose}>{isJa ? "キャンセル" : "Cancel"}</button>
          <button
            type="button"
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)]"
            onClick={() => onConfirm([...selected])}
          >
            {isJa ? "選択を確定" : "Confirm Selection"}
          </button>
        </>
      )}
    >
      <div className="px-6 pt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isJa ? "検索..." : "Search..."}
          autoFocus
          className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
        />
      </div>
      <div className="max-h-[55vh] overflow-y-auto px-6 py-3">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">{isJa ? "製品がありません" : "No products found."}</p>
        ) : visible.map((p) => (
          <label key={`${p.背番号}-${p.品番}`} className="flex cursor-pointer items-center gap-3 rounded-[6px] px-2 py-1.5 hover:bg-[var(--surface-hover)]">
            <input type="checkbox" checked={selected.has(p.背番号)} onChange={() => toggle(p.背番号)} className="h-3.5 w-3.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)]">{p.背番号}</div>
              <div className="text-xs text-[var(--text-muted)]">{p.品番 || ""} • {p.モデル || ""}</div>
            </div>
          </label>
        ))}
      </div>
    </ModalShell>
  );
}
