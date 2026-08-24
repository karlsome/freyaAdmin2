import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { query } from "../services/api";

const HINBAN_PROJECTION = {
  "品番": 1,
  "品名": 1,
  "品目マスタ.品番": 1,
  "品目マスタ.品名": 1,
};

function SearchableHinbanSelect({ value, onChange, placeholder = "Search 品番...", className }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, showAbove: false, maxHeight: 350 });
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const updateCoords = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const showAbove = spaceBelow < 300 && spaceAbove > spaceBelow;
      const availableHeight = showAbove ? Math.min(spaceAbove, 540) : Math.min(spaceBelow, 540);

      setCoords({
        top: showAbove ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 320),
        showAbove,
        maxHeight: Math.max(availableHeight, 350),
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      setSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 40);
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
      return () => {
        window.removeEventListener("scroll", updateCoords, true);
        window.removeEventListener("resize", updateCoords);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const regexQuery = search ? { "品番": { "$regex": search, "$options": "i" } } : {};
        const [masterRes, materialRes] = await Promise.all([
          query("Sasaki_Coating_MasterDB", "masterDB", regexQuery, { limit: 30, projection: HINBAN_PROJECTION }),
          query("Sasaki_Coating_MasterDB", "materialMasterDB3", regexQuery, { limit: 30, projection: HINBAN_PROJECTION })
        ]);
        
        if (!active) return;
        let mData = Array.isArray(masterRes) ? masterRes : (masterRes?.data || []);
        let matData = Array.isArray(materialRes) ? materialRes : (materialRes?.data || []);
        
        const combined = [...mData, ...matData];
        const unique = [];
        const seen = new Set();
        for (const item of combined) {
          const itemHinban = item['品番'] || item?.['品目マスタ']?.['品番'];
          if (itemHinban && !seen.has(itemHinban)) {
            seen.add(itemHinban);
            unique.push(item);
          }
        }
        setOptions(unique.slice(0, 40));
      } catch (err) {
        if (active) console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, isOpen]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          updateCoords();
        }}
        className={`${className} flex items-center justify-between text-left truncate px-3 cursor-pointer`}
      >
        <span className={`truncate ${value ? "text-on-surface font-semibold" : "opacity-60"}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-outline">
          {value && (
            <span
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ value: "" });
              }}
              className="hover:text-error transition-colors p-0.5 rounded cursor-pointer"
              title="Clear"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </span>
          )}
          <span
            className="material-symbols-outlined transition-transform duration-200"
            style={{ fontSize: 18, transform: isOpen ? "rotate(180deg)" : "none" }}
          >
            expand_more
          </span>
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: coords.showAbove ? "auto" : `${coords.top}px`,
            bottom: coords.showAbove ? `${window.innerHeight - coords.top}px` : "auto",
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight || 500}px`,
            zIndex: 99999,
          }}
          className="bg-surface border border-outline-variant/50 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2 backdrop-blur-md animate-[fadeIn_0.1s_ease-out]"
        >
          {/* Search Box at Top */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-surface-variant/30 border border-outline-variant/40 rounded-lg pl-8 pr-7 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none placeholder:text-outline"
              placeholder="Search 品番..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 flex flex-col divide-y divide-outline-variant/15 pr-0.5">
            {loading ? (
              <div className="p-4 text-xs text-outline text-center flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                <span>Searching...</span>
              </div>
            ) : options.length > 0 ? (
              options.map((opt, i) => {
                const optHinban = opt['品番'] || opt?.['品目マスタ']?.['品番'];
                const optName = opt['品名'] || opt?.['品目マスタ']?.['品名'];
                const isSelected = String(value) === String(optHinban);
                return (
                  <div
                    key={i}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange({ value: optHinban });
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer flex items-center justify-between rounded-lg ${
                      isSelected ? "bg-primary/15 text-primary font-bold" : "text-on-surface font-medium"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-mono font-bold text-xs truncate">{optHinban}</span>
                      {optName && <span className="text-[11px] text-outline truncate">{optName}</span>}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 16 }}>
                        check
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-xs text-outline text-center">No matches found</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SearchableSelect({ value, options, multiple, onChange, placeholder, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, showAbove: false, maxHeight: 350 });
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const showAbove = spaceBelow < 300 && spaceAbove > spaceBelow;
      const availableHeight = showAbove ? Math.min(spaceAbove, 540) : Math.min(spaceBelow, 540);

      setCoords({
        top: showAbove ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 280),
        showAbove,
        maxHeight: Math.max(availableHeight, 350),
      });
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      setQueryText("");
      setTimeout(() => searchInputRef.current?.focus(), 40);
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
      return () => {
        window.removeEventListener("scroll", updateCoords, true);
        window.removeEventListener("resize", updateCoords);
      };
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [options, queryText]);

  const toggleOption = (option, e) => {
    e.preventDefault();
    if (multiple) {
      const current = Array.isArray(value) ? value : value ? [value] : [];
      if (current.includes(option)) {
        onChange({ value: current.filter((v) => v !== option) });
      } else {
        onChange({ value: [...current, option] });
      }
    } else {
      onChange({ value: option });
      setIsOpen(false);
      setQueryText("");
    }
  };

  const displayText = multiple
    ? (Array.isArray(value) && value.length > 0 ? value.join(", ") : placeholder)
    : (value || placeholder);

  const hasValue = multiple ? (Array.isArray(value) && value.length > 0) : !!value;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          updateCoords();
        }}
        className={`${className} flex items-center justify-between text-left truncate px-3 cursor-pointer`}
      >
        <span className={`truncate ${hasValue ? "text-on-surface font-semibold" : "opacity-70"}`}>
          {displayText}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-outline">
          {hasValue && (
            <span
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ value: multiple ? [] : "" });
              }}
              className="hover:text-error transition-colors p-0.5 rounded cursor-pointer"
              title="Clear"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </span>
          )}
          <span
            className="material-symbols-outlined transition-transform duration-200"
            style={{ fontSize: 18, transform: isOpen ? "rotate(180deg)" : "none" }}
          >
            expand_more
          </span>
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: coords.showAbove ? "auto" : `${coords.top}px`,
            bottom: coords.showAbove ? `${window.innerHeight - coords.top}px` : "auto",
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight || 500}px`,
            zIndex: 99999,
          }}
          className="bg-surface border border-outline-variant/50 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2 backdrop-blur-md animate-[fadeIn_0.1s_ease-out]"
        >
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-surface-variant/30 border border-outline-variant/40 rounded-lg pl-8 pr-7 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none placeholder:text-outline"
              placeholder="Search..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>

          {/* If the user typed a query that doesn't exactly match an option, allow using custom text */}
          {queryText.trim() && !options.map(String).includes(queryText.trim()) && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                toggleOption(queryText.trim(), e);
              }}
              className="px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1.5 border-b border-outline-variant/20 font-medium"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              <span>Use: <strong>"{queryText.trim()}"</strong></span>
            </div>
          )}

          <div className="overflow-y-auto flex-1 flex flex-col divide-y divide-outline-variant/15 pr-0.5">
            {filteredOptions.length === 0 && !queryText.trim() ? (
              <div className="px-4 py-3 text-xs text-outline text-center">No options available</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = multiple
                  ? (Array.isArray(value) ? value.includes(option) : value === option)
                  : value === option;
                return (
                  <div
                    key={option}
                    onMouseDown={(e) => toggleOption(option, e)}
                    className={`px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer flex items-center justify-between rounded-lg ${
                      isSelected ? "bg-primary/15 text-primary font-bold" : "text-on-surface font-medium"
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 16 }}>
                        check
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function getTextInputType(type) {
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "time") return "time";
  return "text";
}

function buildActiveFilters(rows = [], fieldDefinitions = [], operatorLabels = {}) {
  const fieldMap = Object.fromEntries(fieldDefinitions.map((field) => [field.field, field]));

  return rows.flatMap((row) => {
    if (!row?.field || !row?.operator) return [];

    const fieldDefinition = fieldMap[row.field];
    if (!fieldDefinition) return [];

    let renderedValue = "";

    if (row.operator === "range") {
      if (row.valueFrom === "" || row.valueTo === "") return [];
      renderedValue = `${row.valueFrom} - ${row.valueTo}`;
    } else if (row.operator === "in") {
      const values = Array.isArray(row.value)
        ? row.value.filter(Boolean)
        : String(row.value || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      if (!values.length) return [];
      renderedValue = values.join(", ");
    } else {
      if (row.value === "" || row.value == null) return [];
      renderedValue = String(row.value);
    }

    return [{
      id: row.id,
      label: fieldDefinition.label,
      operator: operatorLabels[row.operator] || row.operator,
      value: renderedValue,
    }];
  });
}

function RowValueInput({
  row,
  fieldDefinition,
  options,
  loading,
  onChange,
  styles,
  enableTextSuggestions,
  inputIdPrefix,
}) {
  const datalistId = `${inputIdPrefix}-${row.id}`;

  if (!fieldDefinition) {
    return (
      <input
        type="text"
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        disabled
        className={`${styles.controlBase} opacity-40`}
      />
    );
  }

  if (row.operator === "range") {
    const inputType = getTextInputType(fieldDefinition.type);

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type={inputType}
          value={row.valueFrom}
          onChange={(event) => {
            const val = fieldDefinition.type === "number" ? event.target.value.replace(/[^0-9.-]/g, '') : event.target.value;
            onChange({ valueFrom: val });
          }}
          className={styles.controlBase}
          placeholder="From"
        />
        <input
          type={inputType}
          value={row.valueTo}
          onChange={(event) => {
            const val = fieldDefinition.type === "number" ? event.target.value.replace(/[^0-9.-]/g, '') : event.target.value;
            onChange({ valueTo: val });
          }}
          className={styles.controlBase}
          placeholder="To"
        />
      </div>
    );
  }

  const isHinban = fieldDefinition.field === "品番" || fieldDefinition.field === "構成品番" || /品番/i.test(fieldDefinition.field) || /品番/i.test(fieldDefinition.label);

  if (isHinban && row.operator !== "range") {
    return (
      <SearchableHinbanSelect
        value={row.value || ""}
        onChange={onChange}
        placeholder="Select or search 品番..."
        className={styles.controlBase}
      />
    );
  }

  // If the field is a select or has options loaded (or loading options), use the searchable clearable dropdown
  if (fieldDefinition.type === "select" || options.length > 0 || (loading && fieldDefinition.type !== "number" && fieldDefinition.type !== "date")) {
    const isMultiSelect = row.operator === "in";
    const selectedValue = isMultiSelect
      ? (Array.isArray(row.value) ? row.value : row.value ? [row.value] : [])
      : Array.isArray(row.value)
        ? row.value[0] || ""
        : row.value;
    const placeholder = loading
      ? `Loading ${fieldDefinition.label}...`
      : options.length
        ? `Select or search ${fieldDefinition.label}...`
        : `Select or search ${fieldDefinition.label}...`;

    return (
      <SearchableSelect
        value={selectedValue}
        multiple={isMultiSelect}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        className={`${styles.controlBase} ${isMultiSelect ? styles.multiSelect : ""}`.trim()}
      />
    );
  }

  if (row.operator === "in") {
    const inputValue = Array.isArray(row.value) ? row.value.join(", ") : row.value;

    return (
      <input
        type="text"
        value={inputValue}
        onChange={(event) => onChange({ value: event.target.value })}
        className={styles.controlBase}
        placeholder="Comma separated values"
      />
    );
  }

  const inputType = getTextInputType(fieldDefinition.type);

  return (
    <input
      type={inputType}
      value={row.value}
      onChange={(event) => {
        const val = fieldDefinition.type === "number" ? event.target.value.replace(/[^0-9.-]/g, '') : event.target.value;
        onChange({ value: val });
      }}
      className={styles.controlBase}
      placeholder="Enter value"
    />
  );
}

function getStylePreset(variant, framed) {
  if (variant === "roomy") {
    return {
      wrapper: framed ? "mt-4 overflow-hidden rounded-[24px] border border-outline-variant/15 bg-surface-container-low/30" : "",
      toggle: framed
        ? "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-outline transition-colors hover:text-on-surface"
        : "flex items-center gap-1.5 text-xs font-semibold text-outline transition-colors hover:text-on-surface mb-3",
      content: framed ? "border-t border-outline-variant/15 px-4 py-4" : "mb-4",
      stack: "space-y-3",
      controlBase: "w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container",
      fieldControl: "h-10 min-w-[190px] flex-1",
      operatorControl: "h-10 min-w-[160px] flex-1 disabled:cursor-not-allowed disabled:opacity-40",
      valueWrap: "min-w-[220px] flex-[2]",
      deleteButton: "rounded-2xl p-2 text-outline transition hover:bg-error/10 hover:text-error",
      addButton: "mt-1 flex items-center gap-1.5 rounded-2xl border border-dashed border-outline-variant/30 px-3 py-2 text-xs font-semibold text-outline transition hover:border-primary/40 hover:text-on-surface",
      summaryPanel: "rounded-2xl border border-outline-variant/15 bg-surface-container/40 px-4 py-3",
      summaryTitle: "text-[10px] font-semibold uppercase tracking-[0.18em] text-outline",
      summaryDescription: "mt-1 text-xs text-on-surface-variant",
      clearButton: "text-[10px] font-semibold uppercase tracking-[0.18em] text-error",
      footer: `flex flex-wrap items-center gap-3${framed ? " border-t border-outline-variant/15 pt-4" : " pt-4"}`,
      multiSelect: "min-h-32 py-2",
    };
  }

  return {
    wrapper: framed ? "mt-4 rounded-xl border border-separator/40 bg-surface-container/30 overflow-hidden" : "",
    toggle: framed
      ? "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-outline transition-colors hover:text-on-surface"
      : "flex items-center gap-1.5 text-xs font-semibold text-outline transition-colors hover:text-on-surface mb-3",
    content: framed ? "border-t border-separator/40 px-4 py-4" : "mb-4",
    stack: framed ? "space-y-3" : "space-y-2",
    controlBase: "w-full rounded-xl border border-separator/40 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40",
    fieldControl: "h-9 min-w-[180px] flex-1",
    operatorControl: "h-9 min-w-[150px] flex-1 disabled:opacity-40 disabled:cursor-not-allowed",
    valueWrap: "min-w-[200px] flex-[2]",
    deleteButton: "rounded-xl p-2 text-outline transition-colors hover:bg-error/10 hover:text-error",
    addButton: "mt-1 flex items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-1.5 text-xs font-semibold text-outline transition-colors hover:border-primary/40 hover:text-on-surface",
    summaryPanel: "rounded-xl border border-separator/40 bg-surface-container/40 px-4 py-3",
    summaryTitle: "text-[10px] font-semibold uppercase tracking-wider text-outline",
    summaryDescription: "mt-1 text-xs text-on-surface-variant",
    clearButton: "text-[10px] font-semibold uppercase tracking-wider text-error",
    footer: `flex flex-wrap items-center gap-3${framed ? " border-t border-separator/40 pt-4" : " pt-4"}`,
    multiSelect: "min-h-28 py-2",
  };
}

function getChipClassName(tone) {
  if (tone === "amber") {
    return "inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950";
  }

  return "inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary";
}

export default function AdvancedFilterSection({
  rows,
  fieldDefinitions,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onClearRows,
  loadDistinctOptions,
  shouldLoadOptions = () => false,
  optionsCacheKey = "default",
  operatorLabels = {},
  useOperatorLabelsInSelect = false,
  title = "Advanced Filters",
  addRowLabel = "Add Filter Row",
  activeSummaryTitle = "Active Filters",
  activeSummaryDescription = "",
  showActiveSummary = true,
  chipTone = "primary",
  variant = "compact",
  framed = true,
  enableTextSuggestions = false,
  inputIdPrefix = "advanced-filter-options",
  footer,
  onCustomFieldClick,
}) {
  const styles = getStylePreset(variant, framed);
  const [open, setOpen] = useState(false);
  const [optionsByField, setOptionsByField] = useState({});
  const [loadingFields, setLoadingFields] = useState({});

  useEffect(() => {
    setOptionsByField({});
    setLoadingFields({});
  }, [optionsCacheKey]);

  useEffect(() => {
    if (typeof loadDistinctOptions !== "function") return;

    rows.forEach((row) => {
      const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
      const hasStaticOptions = Array.isArray(fieldDefinition?.options) && fieldDefinition.options.length > 0;

      if (!row.field || !fieldDefinition || hasStaticOptions || !shouldLoadOptions(fieldDefinition)) return;
      if (optionsByField[row.field] || loadingFields[row.field]) return;

      setLoadingFields((current) => ({ ...current, [row.field]: true }));
      loadDistinctOptions(row.field)
        .then((values) => {
          setOptionsByField((current) => ({ ...current, [row.field]: Array.isArray(values) ? values : [] }));
        })
        .catch(() => {
          setOptionsByField((current) => ({ ...current, [row.field]: [] }));
        })
        .finally(() => {
          setLoadingFields((current) => ({ ...current, [row.field]: false }));
        });
    });
  }, [rows, fieldDefinitions, loadDistinctOptions, loadingFields, optionsByField, shouldLoadOptions]);

  const fieldGroups = useMemo(
    () => [...new Set(fieldDefinitions.map((field) => field.group))],
    [fieldDefinitions]
  );
  const activeFilters = useMemo(
    () => buildActiveFilters(rows, fieldDefinitions, operatorLabels),
    [rows, fieldDefinitions, operatorLabels]
  );
  const chipClassName = getChipClassName(chipTone);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={styles.toggle}
      >
        {framed ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
              <span className="uppercase tracking-wider">{title}</span>
              {activeFilters.length ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-primary">
                  {activeFilters.length} active
                </span>
              ) : null}
            </div>

            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>
              {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
            {title}
            {activeFilters.length ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-primary">
                {activeFilters.length} active
              </span>
            ) : null}
          </>
        )}
      </button>

      {open ? (
        <div className={styles.content}>
          <div className={styles.stack}>
            {rows.map((row) => {
              const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
              const operators = fieldDefinition?.operators || [];
              const options = Array.isArray(fieldDefinition?.options)
                ? fieldDefinition.options
                : (optionsByField[row.field] || []);

              return (
                <div key={row.id} className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.field}
                    onChange={(event) => {
                      const nextField = event.target.value;
                      if (nextField === "__CUSTOM__") {
                        if (onCustomFieldClick) onCustomFieldClick(row.id);
                        return;
                      }
                      const nextDefinition = fieldDefinitions.find((field) => field.field === nextField);
                      onUpdateRow(row.id, {
                        field: nextField,
                        operator: nextDefinition?.operators?.[0] || "",
                        value: "",
                        valueFrom: "",
                        valueTo: "",
                      });
                    }}
                    className={`${styles.controlBase} ${styles.fieldControl}`}
                  >
                    <option value="">Select field</option>
                    {fieldGroups.map((group) => (
                      <optgroup key={group} label={group}>
                        {fieldDefinitions.filter((field) => field.group === group).map((field) => (
                          <option key={field.field} value={field.field}>{field.label}</option>
                        ))}
                      </optgroup>
                    ))}
                    {onCustomFieldClick && (
                      <optgroup label="Custom Fields">
                        <option value="__CUSTOM__">Custom...</option>
                      </optgroup>
                    )}
                  </select>

                  <select
                    value={row.operator}
                    onChange={(event) => onUpdateRow(row.id, {
                      operator: event.target.value,
                      value: "",
                      valueFrom: "",
                      valueTo: "",
                    })}
                    disabled={!fieldDefinition}
                    className={`${styles.controlBase} ${styles.operatorControl}`}
                  >
                    <option value="">Select operator</option>
                    {operators.map((operator) => (
                      <option key={operator} value={operator}>
                        {useOperatorLabelsInSelect ? (operatorLabels[operator] || operator) : operator}
                      </option>
                    ))}
                  </select>

                  <div className={styles.valueWrap}>
                    <RowValueInput
                      row={row}
                      fieldDefinition={fieldDefinition}
                      options={options}
                      loading={loadingFields[row.field]}
                      onChange={(patch) => onUpdateRow(row.id, patch)}
                      styles={styles}
                      enableTextSuggestions={enableTextSuggestions}
                      inputIdPrefix={inputIdPrefix}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.id)}
                    className={styles.deleteButton}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: variant === "roomy" ? 18 : 16 }}>delete</span>
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={onAddRow}
              className={styles.addButton}
            >
              <span className="material-symbols-outlined" style={{ fontSize: variant === "roomy" ? 16 : 14 }}>add</span>
              {addRowLabel}
            </button>

            {showActiveSummary && activeFilters.length ? (
              <div className={styles.summaryPanel}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={styles.summaryTitle}>{activeSummaryTitle}</div>
                    {activeSummaryDescription ? (
                      <div className={styles.summaryDescription}>{activeSummaryDescription}</div>
                    ) : null}
                  </div>
                  {typeof onClearRows === "function" ? (
                    <button type="button" onClick={onClearRows} className={styles.clearButton}>
                      Clear All
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeFilters.map((filter) => (
                    <span key={filter.id} className={chipClassName}>
                      <span>{filter.label}</span>
                      <span className={chipTone === "amber" ? "text-amber-950/50" : "text-primary/60"}>{filter.operator}</span>
                      <span>{filter.value}</span>
                      <button type="button" onClick={() => onRemoveRow(filter.id)} className="leading-none hover:opacity-60">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {footer ? (
              <div className={styles.footer}>
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}