import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchMasterDbProducts } from "../../services/api";
import { useLanguage } from "../../contexts/LanguageContext";

export default function ProductSelectorModal({
  isOpen,
  onClose,
  selectedBans = [],
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [tempSelectedBans, setTempSelectedBans] = useState([]);
  const searchInputRef = useRef(null);

  // Sync temp selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelectedBans(Array.isArray(selectedBans) ? [...selectedBans] : []);
      setSearch("");
      setSelectedModel("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, selectedBans]);

  // Load products once
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOpen) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMasterDbProducts();
        if (!cancelled) {
          if (res?.success && Array.isArray(res?.data)) {
            setProducts(res.data);
          } else if (Array.isArray(res)) {
            setProducts(res);
          } else {
            setProducts([]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load products for analytics:", err);
          setError(err.message || "Failed to load products");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Distinct Models for filter dropdown
  const modelOptions = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.モデル && String(p.モデル).trim()) {
        set.add(String(p.モデル).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedModel && p.モデル !== selectedModel) return false;
      if (!q) return true;
      const ban = String(p.背番号 || "").toLowerCase();
      const hin = String(p.品番 || "").toLowerCase();
      const mod = String(p.モデル || "").toLowerCase();
      return ban.includes(q) || hin.includes(q) || mod.includes(q);
    });
  }, [products, search, selectedModel]);

  const toggleBan = (ban) => {
    if (!ban) return;
    setTempSelectedBans((prev) =>
      prev.includes(ban) ? prev.filter((b) => b !== ban) : [...prev, ban]
    );
  };

  const handleSelectAllFiltered = () => {
    const visibleBans = filteredProducts.map((p) => p.背番号).filter(Boolean);
    setTempSelectedBans((prev) => {
      const next = new Set([...prev, ...visibleBans]);
      return Array.from(next);
    });
  };

  const handleDeselectAllFiltered = () => {
    const visibleSet = new Set(filteredProducts.map((p) => p.背番号).filter(Boolean));
    setTempSelectedBans((prev) => prev.filter((b) => !visibleSet.has(b)));
  };

  const handleClearAll = () => {
    setTempSelectedBans([]);
  };

  const handleConfirm = () => {
    const selectedObjMap = new Map();
    products.forEach((p) => {
      if (tempSelectedBans.includes(p.背番号)) {
        selectedObjMap.set(p.背番号, p);
      }
    });
    onConfirm(tempSelectedBans, Array.from(selectedObjMap.values()));
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-subtle)] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)] text-[22px]">
              inventory_2
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isJa ? "対象製品の選択 (品番 / 背番号)" : "Select Target Products"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isJa
                  ? "アナリティクスで集計する製品を指定します。"
                  : "Filter analytics metrics to specific products."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search & Model Filters */}
        <div className="p-4 border-b border-[var(--border)] space-y-3 shrink-0 bg-[var(--surface)]">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isJa
                    ? "背番号、品番、モデル名で検索..."
                    : "Search by serial no, part no, model..."
                }
                className="freya-input h-9 w-full !pl-9 pr-8 text-xs text-[var(--text-primary)]"
                style={{ paddingLeft: "36px" }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Model Filter */}
            {modelOptions.length > 0 && (
              <div className="w-full sm:w-48 shrink-0">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="freya-input h-9 w-full text-xs text-[var(--text-primary)] cursor-pointer"
                >
                  <option value="">{isJa ? "すべてのモデル" : "All Models"}</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action pills: Select All, Deselect All, Clear */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="font-medium text-[var(--freya-blue)] hover:underline"
              >
                {isJa ? "表示中の製品を全選択" : "Select all filtered"}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline"
              >
                {isJa ? "表示中を解除" : "Deselect filtered"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>
                {isJa
                  ? `${filteredProducts.length} 件表示中`
                  : `Showing ${filteredProducts.length}`}
              </span>
              {tempSelectedBans.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  {isJa ? "全クリア" : "Clear all"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Product List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[220px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] space-y-2">
              <span className="material-symbols-outlined animate-spin text-[28px] text-[var(--freya-blue)]">
                progress_activity
              </span>
              <span className="text-xs">{isJa ? "製品マスタを読み込み中..." : "Loading products..."}</span>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 text-center text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] space-y-1">
              <span className="material-symbols-outlined text-[32px] opacity-40">
                search_off
              </span>
              <p className="text-xs">{isJa ? "一致する製品が見つかりません" : "No products found"}</p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredProducts.map((p, idx) => {
              const ban = p.背番号;
              const isChecked = tempSelectedBans.includes(ban);
              return (
                <label
                  key={ban ? `${ban}_${idx}` : idx}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] border transition cursor-pointer ${
                    isChecked
                      ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/5 dark:bg-[var(--freya-blue)]/10"
                      : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleBan(ban)}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--freya-blue)] focus:ring-[var(--freya-blue)]/30 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold text-[var(--text-primary)] px-2 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)]">
                        {ban || "—"}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-secondary)] truncate">
                        {p.品番 || "—"}
                      </span>
                    </div>
                    {p.モデル && (
                      <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text-muted)] font-medium">
                        {p.モデル}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            {isJa ? "選択中:" : "Selected:"}{" "}
            <span className="text-[var(--freya-blue)] tabular-nums font-bold">
              {tempSelectedBans.length}
            </span>{" "}
            {isJa ? "品目" : "products"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
            >
              {isJa ? "キャンセル" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[var(--freya-blue)] text-xs font-semibold text-white hover:opacity-90 transition shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>
                {isJa
                  ? `選択を確定 (${tempSelectedBans.length})`
                  : `Apply Selection (${tempSelectedBans.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
