import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";

export default function MachineSelectorModal({
  isOpen,
  onClose,
  equipmentByFactory = {},
  allEquipment = [],
  selectedEquipment = [],
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [tempSelection, setTempSelection] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFactoryTab, setActiveFactoryTab] = useState("all");
  const searchInputRef = useRef(null);

  // Sync temp selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelection(Array.isArray(selectedEquipment) ? [...selectedEquipment] : []);
      setSearch("");
      setActiveFactoryTab("all");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, selectedEquipment]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const factories = useMemo(() => {
    return Object.keys(equipmentByFactory).sort();
  }, [equipmentByFactory]);

  // Global toggle handlers
  const handleSelectAll = () => {
    setTempSelection([...allEquipment]);
  };

  const handleDeselectAll = () => {
    setTempSelection([]);
  };

  // Factory toggle handlers
  const handleToggleFactory = (factory, selectAll) => {
    const equipList = equipmentByFactory[factory] || [];
    if (selectAll) {
      setTempSelection((prev) => Array.from(new Set([...prev, ...equipList])));
    } else {
      setTempSelection((prev) => prev.filter((eq) => !equipList.includes(eq)));
    }
  };

  const handleToggleSingle = (equip) => {
    setTempSelection((prev) =>
      prev.includes(equip) ? prev.filter((e) => e !== equip) : [...prev, equip]
    );
  };

  const handleApply = () => {
    onConfirm?.(tempSelection);
    onClose();
  };

  if (!isOpen) return null;

  const query = search.trim().toLowerCase();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20">
              <span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isJa ? "対象設備の選択 (工場別)" : "Select Target Machines by Facility"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isJa
                  ? "分析および比較対象とする設備を選択してください。"
                  : "Choose which machines to include in performance comparison."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Controls Toolbar: Search, Global select buttons, Factory filter tabs */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[18px]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isJa ? "設備名で検索 (例: OZMANAS, AOL)..." : "Search machine name..."}
                className="freya-input h-9 pl-9 pr-8 text-xs w-full"
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

            {/* Global Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-xs transition cursor-pointer"
              >
                {isJa ? "全選択" : "Select All"}
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] shadow-xs transition cursor-pointer"
              >
                {isJa ? "全解除" : "Deselect All"}
              </button>
            </div>
          </div>

          {/* Factory Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveFactoryTab("all")}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activeFactoryTab === "all"
                  ? "bg-[var(--freya-blue)] text-white shadow-xs"
                  : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {isJa ? "全工場" : "All Facilities"} ({allEquipment.length})
            </button>
            {factories.map((factory) => {
              const list = equipmentByFactory[factory] || [];
              const selectedCount = list.filter((eq) => tempSelection.includes(eq)).length;
              const isActive = activeFactoryTab === factory;

              return (
                <button
                  key={factory}
                  type="button"
                  onClick={() => setActiveFactoryTab(factory)}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-[var(--freya-blue)] text-white shadow-xs"
                      : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <span>{factory}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]"
                    }`}
                  >
                    {selectedCount}/{list.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Content: Factory Groups & Machine Checkbox Cards */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {factories
            .filter((f) => activeFactoryTab === "all" || activeFactoryTab === f)
            .map((factory) => {
              const equipList = equipmentByFactory[factory] || [];
              const filteredList = query
                ? equipList.filter((eq) => String(eq).toLowerCase().includes(query))
                : equipList;

              if (query && filteredList.length === 0) return null;

              const selectedInFactory = equipList.filter((eq) => tempSelection.includes(eq));
              const isAllInFactorySelected =
                equipList.length > 0 && selectedInFactory.length === equipList.length;

              return (
                <div
                  key={factory}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-4 space-y-3"
                >
                  {/* Factory Header Row */}
                  <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[var(--freya-blue)]">
                        domain
                      </span>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {factory}
                      </h3>
                      <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-mono font-semibold border border-[var(--border)] text-[var(--text-muted)]">
                        {selectedInFactory.length} / {equipList.length} {isJa ? "台選択" : "selected"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFactory(factory, true)}
                        disabled={isAllInFactorySelected}
                        className="text-xs font-semibold text-[var(--freya-blue)] hover:underline disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        {isJa ? "全選択" : "All"}
                      </button>
                      <span className="text-[var(--text-muted)] text-xs">•</span>
                      <button
                        type="button"
                        onClick={() => handleToggleFactory(factory, false)}
                        disabled={selectedInFactory.length === 0}
                        className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        {isJa ? "解除" : "None"}
                      </button>
                    </div>
                  </div>

                  {/* Machine Checkboxes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {filteredList.map((equip) => {
                      const isChecked = tempSelection.includes(equip);

                      return (
                        <label
                          key={equip}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                            isChecked
                              ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold shadow-2xs"
                              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSingle(equip)}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--freya-blue)] focus:ring-[var(--freya-blue)] cursor-pointer shrink-0"
                          />
                          <span className="truncate" title={equip}>
                            {equip}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {query &&
            factories.every(
              (f) =>
                !(equipmentByFactory[f] || []).some((eq) =>
                  String(eq).toLowerCase().includes(query)
                )
            ) && (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                <span className="material-symbols-outlined text-[32px] block mb-1">search_off</span>
                <span>{isJa ? "該当する設備が見つかりません" : "No machines matching your search"}</span>
              </div>
            )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface-subtle)] shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-muted)]">
              {isJa ? "選択中:" : "Selected:"}
            </span>
            <span className="font-bold text-[var(--text-primary)] font-mono">
              {tempSelection.length}
            </span>
            <span className="text-[var(--text-muted)]">/ {allEquipment.length} {isJa ? "台" : "machines"}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
            >
              {isJa ? "キャンセル" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-md bg-[var(--freya-blue)] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              {isJa ? "適用する" : "Apply Selection"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
