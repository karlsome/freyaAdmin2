import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { query, createMasterRecord, updateMasterRecord } from '../services/api';

const HINBAN_PROJECTION = {
  "品番": 1,
  "品名": 1,
  "品目マスタ.品番": 1,
  "品目マスタ.品名": 1,
  "品目マスタ.作業時間": 1,
  "品目マスタ.段取時間": 1,
  "品目マスタ.型番": 1,
  "品目マスタ.原単位": 1,
  "品目マスタ.生産単位": 1,
  "品目マスタ.生産単位数": 1,
  "品目マスタ.製品原単位": 1,
  "品目マスタ.作業リード日": 1,
  "作業時間": 1,
  "段取時間": 1,
  "型番": 1,
  "原単位": 1,
  "生産単位": 1,
  "生産単位数": 1,
  "製品原単位": 1,
  "作業リード日": 1,
};

function AsyncHinbanSelect({
  value,
  onChange,
  placeholder = "Search child material...",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, showAbove: false, maxHeight: 350 });
  const wrapperRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

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
        // Fetch up to 30 with field projections from both DBs
        const [masterRes, materialRes] = await Promise.all([
          query("Sasaki_Coating_MasterDB", "masterDB", regexQuery, { limit: 30, projection: HINBAN_PROJECTION }),
          query("Sasaki_Coating_MasterDB", "materialMasterDB3", regexQuery, { limit: 30, projection: HINBAN_PROJECTION })
        ]);
        
        if (!active) return;
        
        let mData = Array.isArray(masterRes) ? masterRes : (masterRes?.data || []);
        let matData = Array.isArray(materialRes) ? materialRes : (materialRes?.data || []);
        
        const combined = [...mData, ...matData];
        // Deduplicate by 品番
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
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            updateCoords();
          }
        }}
        className={`w-full rounded-[6px] border bg-[var(--surface)] px-3 py-2 text-xs flex items-center justify-between text-left transition-all ${
          isOpen
            ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)] shadow-xs"
            : "border-[var(--border)] hover:border-[var(--border-strong)]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`truncate font-medium ${value ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-muted)]"}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-[var(--text-muted)]">
          {value && (
            <span
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, "");
              }}
              className="hover:text-[var(--status-danger)] transition-colors p-0.5 rounded cursor-pointer"
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

      {isOpen && !disabled && createPortal(
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
          className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-[8px] shadow-2xl p-2.5 flex flex-col gap-2 backdrop-blur-xs animate-[fadeIn_0.1s_ease-out]"
        >
          {/* Search Box at Top */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] material-symbols-outlined" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)]"
              placeholder="Search part number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 flex flex-col divide-y divide-[var(--border)] pr-0.5">
            {loading ? (
              <div className="p-4 text-xs text-[var(--text-muted)] text-center flex items-center justify-center gap-2">
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
                      onChange(opt, optHinban);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2 text-xs hover:bg-[var(--freya-blue)]/10 hover:text-[var(--freya-blue)] transition-colors cursor-pointer flex items-center justify-between rounded-[6px] ${
                      isSelected ? "bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] font-bold" : "text-[var(--text-primary)] font-medium"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-mono font-bold text-xs truncate">{optHinban}</span>
                      {optName && <span className="text-[11px] text-[var(--text-muted)] truncate">{optName}</span>}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[var(--freya-blue)] shrink-0" style={{ fontSize: 16 }}>
                        check
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-xs text-[var(--text-muted)] text-center">No matches found</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SearchableProcessSelect({
  value,
  onChange,
  options = [],
  placeholder = "-- Select Process --",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, showAbove: false });
  const wrapperRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  const selectedOpt = options.find((o) => String(o['工程コード']) === String(value));

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

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter((p) => {
      const code = String(p['工程コード'] ?? "").toLowerCase();
      const name = String(p['工程名'] ?? "").toLowerCase();
      const short = String(p['工程略名'] ?? "").toLowerCase();
      return code.includes(term) || name.includes(term) || short.includes(term);
    });
  }, [options, search]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            updateCoords();
          }
        }}
        className={`w-full rounded-[6px] border bg-[var(--surface)] px-3 py-2 text-xs flex items-center justify-between text-left transition-all ${
          isOpen
            ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)] shadow-xs"
            : "border-[var(--border)] hover:border-[var(--border-strong)]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`truncate font-medium ${selectedOpt ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-muted)]"}`}>
          {selectedOpt ? `${selectedOpt['工程コード']} - ${selectedOpt['工程名']}` : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-[var(--text-muted)]">
          {value && (
            <span
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="hover:text-[var(--status-danger)] transition-colors p-0.5 rounded cursor-pointer"
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

      {isOpen && !disabled && createPortal(
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
          className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-[8px] shadow-2xl p-2.5 flex flex-col gap-2 backdrop-blur-xs animate-[fadeIn_0.1s_ease-out]"
        >
          {/* Search Box at Top */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] material-symbols-outlined" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)]"
              placeholder="Search process code / name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 flex flex-col divide-y divide-[var(--border)] pr-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((p) => {
                const isSelected = String(p['工程コード']) === String(value);
                return (
                  <div
                    key={p['工程コード']}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(p['工程コード']);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2 text-xs hover:bg-[var(--freya-blue)]/10 hover:text-[var(--freya-blue)] transition-colors cursor-pointer flex items-center justify-between rounded-[6px] ${
                      isSelected ? "bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] font-bold" : "text-[var(--text-primary)] font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-mono font-bold text-xs shrink-0">{p['工程コード']}</span>
                      <span className="truncate font-semibold">{p['工程名']}</span>
                      {p['工程略名'] && (
                        <span className="text-[10px] text-[var(--text-muted)] truncate">({p['工程略名']})</span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[var(--freya-blue)] shrink-0" style={{ fontSize: 16 }}>
                        check
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-xs text-[var(--text-muted)] text-center">No matching processes found</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function BomEditModal({ existingBom, initialHinban = "", onClose, onSaved, onEditExisting, onFlash }) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Data for selectors
  const [processes, setProcesses] = useState([]);

  // Form state
  const [saving, setSaving] = useState(false);
  
  const [targetHinban, setTargetHinban] = useState(existingBom?.['品番'] || initialHinban || "");
  const [bomSteps, setBomSteps] = useState(existingBom?.BOM || []);

  const dragItem = React.useRef(null);
  const dragOverItem = React.useRef(null);

  const handleSort = () => {
    let _bomSteps = [...bomSteps];
    const draggedItemContent = _bomSteps.splice(dragItem.current, 1)[0];
    _bomSteps.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setBomSteps(_bomSteps);
  };

  const isEdit = !!existingBom;

  useEffect(() => {
    async function fetchFormData() {
      setLoadingInitial(true);
      try {
        const processRes = await query("Sasaki_Coating_MasterDB", "processMasterDB", {});
        let pData = Array.isArray(processRes) ? processRes : processRes?.data;
        if (pData) {
          pData.sort((a, b) => (a['工程コード'] || 0) - (b['工程コード'] || 0));
          setProcesses(pData);
        }
      } catch (err) {
        console.error(err);
        if (onFlash) onFlash({ type: "error", message: "Failed to load master data" });
      } finally {
        setLoadingInitial(false);
      }
    }
    fetchFormData();
  }, []);

  async function handleTargetHinbanChange(opt, hinban) {
    if (!hinban) {
      setTargetHinban("");
      return;
    }
    
    if (!isEdit) {
      try {
        const existing = await query("Sasaki_Coating_MasterDB", "bomMasterDB", { "品番": hinban });
        const records = Array.isArray(existing) ? existing : existing?.data;
        if (records && records.length > 0) {
          if (window.confirm(`A BOM for ${hinban} already exists.\n\nDo you want to edit it instead?`)) {
            if (onEditExisting) {
              onEditExisting(records[0]);
            }
          } else {
            setTargetHinban("");
          }
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    setTargetHinban(hinban);
  }

  function handleAddStep() {
    setBomSteps(prev => {
      const nextNum = prev.length > 0 ? Math.max(...prev.map(p => p['工程番号'] || 0)) + 1 : 1;
      return [...prev, {
        "工程番号": nextNum,
        "工程コード": "",
        "工程名": "",
        "工程略名": "",
        "構成品番": "",
        "構成品_id": null,
        "生産単位": 4,
        "原単位": 1,
        "製品原単位": 1,
        "作業リード日": 0,
        "総作業リード日": 0,
        "段取時間": 0,
        "作業時間": 0,
        "型番": ""
      }];
    });
  }

  function handleRemoveStep(index) {
    setBomSteps(prev => prev.filter((_, i) => i !== index));
  }

  function handleStepChange(index, field, value) {
    setBomSteps(prev => {
      const next = [...prev];
      const step = { ...next[index] };
      
      if (field === "processSelect") {
        if (!value) {
          step['工程コード'] = "";
          step['工程名'] = "";
          step['工程略名'] = "";
        } else {
          const proc = processes.find(p => String(p['工程コード']) === String(value));
          if (proc) {
            step['工程コード'] = proc['工程コード'];
            step['工程名'] = proc['工程名'] || '';
            step['工程略名'] = proc['工程略名'] || '';
          }
        }
      } else if (field === "materialSelect") {
        if (!value) {
          step['構成品番'] = "";
          step['構成品_id'] = null;
        } else {
          const hinban = value['品番'] || value?.['品目マスタ']?.['品番'] || (typeof value === 'string' ? value : "");
          step['構成品番'] = hinban;
          step['構成品_id'] = value._id || null;
          
          // Auto-fill fields from the selected material's master data
          const src = value['品目マスタ'] || value; // materialMasterDB3 uses '品目マスタ', masterDB uses root
          step['作業時間'] = src['作業時間'] ?? step['作業時間'] ?? 0;
          step['段取時間'] = src['段取時間'] ?? step['段取時間'] ?? 0;
          step['型番'] = src['型番'] ?? step['型番'] ?? "*";
          step['生産単位'] = src['生産単位'] ?? src['生産単位数'] ?? step['生産単位'] ?? 4;
          step['原単位'] = src['原単位'] ?? step['原単位'] ?? 1;
          step['製品原単位'] = src['製品原単位'] ?? step['製品原単位'] ?? 1;
          step['作業リード日'] = src['作業リード日'] ?? step['作業リード日'] ?? 0;
        }
      } else {
        step[field] = value;
      }
      
      next[index] = step;
      return next;
    });
  }

  async function handleSave() {
    if (!targetHinban) {
      alert("Target 品番 (Parent Material) is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        品番: targetHinban,
        BOM: bomSteps.map((s, i) => ({ ...s, 工程番号: i + 1 }))
      };

      if (isEdit) {
        await updateMasterRecord({
          recordId: existingBom._id?.$oid || existingBom._id,
          updates: payload,
          tabKey: "bomDB"
        });
        if (onFlash) onFlash({ type: "success", message: "BOM updated successfully!" });
      } else {
        const existing = await query("Sasaki_Coating_MasterDB", "bomMasterDB", { "品番": targetHinban });
        const records = Array.isArray(existing) ? existing : existing?.data;
        if (records && records.length > 0) {
          if (onFlash) onFlash({ type: "error", message: `A BOM for ${targetHinban} already exists!` });
          return;
        }
        await createMasterRecord({ data: payload, tabKey: "bomDB" });
        if (onFlash) onFlash({ type: "success", message: "New BOM created successfully!" });
      }
      onSaved();
    } catch (err) {
      console.error(err);
      if (onFlash) onFlash({ type: "error", message: "Failed to save BOM" });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">{isEdit ? "Edit BOM" : "Create New BOM"}</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Configure processes and child materials</p>
          </div>
          <button 
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <span className="material-symbols-outlined" style={{fontSize: 20}}>close</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 scrollbar-hide">
          {loadingInitial ? (
            <div className="flex items-center justify-center py-10 text-xs font-medium text-[var(--text-muted)]">
              <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 18 }}>progress_activity</span>
              Loading master data...
            </div>
          ) : (
            <>
              {/* Target Material Selector */}
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 relative z-30">
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">
                  Target 品番 (Parent Material)
                </label>
                <AsyncHinbanSelect 
                  value={targetHinban} 
                  onChange={handleTargetHinbanChange} 
                  disabled={isEdit}
                />
              </div>

              {/* Processes Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Process Steps</h3>
                </div>

                <div className="flex flex-col gap-3.5">
                  {bomSteps.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-[var(--border)] rounded-[8px] text-[var(--text-muted)] text-xs">
                      No process steps added yet. Click "Add Step" to begin.
                    </div>
                  ) : (
                    bomSteps.map((step, index) => (
                      <div 
                        key={index} 
                        data-step-card="true"
                        className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-2xs relative transition-all duration-150 hover:border-[var(--freya-blue)]/50 focus-within:z-30 overflow-hidden"
                        style={{ zIndex: bomSteps.length - index + 5 }}
                        onDragEnter={() => (dragOverItem.current = index)}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <div className="bg-[var(--surface-subtle)] px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              draggable
                              onDragStart={(e) => {
                                dragItem.current = index;
                                const cardElement = e.currentTarget.closest('[data-step-card="true"]');
                                if (cardElement && e.dataTransfer?.setDragImage) {
                                  const handleRect = e.currentTarget.getBoundingClientRect();
                                  const cardRect = cardElement.getBoundingClientRect();
                                  const offsetX = handleRect.left - cardRect.left + handleRect.width / 2;
                                  const offsetY = handleRect.top - cardRect.top + handleRect.height / 2;
                                  e.dataTransfer.setDragImage(cardElement, offsetX, offsetY);
                                }
                              }}
                              onDragEnd={handleSort}
                              className="material-symbols-outlined text-[var(--text-muted)] hover:text-[var(--freya-blue)] transition-colors text-base cursor-grab active:cursor-grabbing select-none p-1 -m-1 rounded hover:bg-[var(--surface-hover)]"
                              title="Drag to reorder step"
                            >
                              drag_indicator
                            </span>
                            <span className="text-[10px] font-bold text-[var(--freya-blue)] bg-[var(--freya-blue)]/10 px-2 py-0.5 rounded-[4px] border border-[var(--freya-blue)]/20 pointer-events-none select-none">
                              Step {index + 1}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveStep(index)}
                            className="text-[var(--status-danger)]/70 hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 p-1 rounded-[4px] transition-colors"
                            title="Remove Step"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        </div>
                        
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Process Selection */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1">Process (工程)</label>
                            <SearchableProcessSelect
                              value={step['工程コード'] || ""}
                              options={processes}
                              onChange={(val) => handleStepChange(index, 'processSelect', val)}
                              placeholder="-- Select Process --"
                            />
                          </div>

                          {/* Material Selection */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1">Child Material (構成品番)</label>
                            <AsyncHinbanSelect 
                              value={step['構成品番'] || ""}
                              onChange={(opt, hinban) => handleStepChange(index, 'materialSelect', opt)}
                              placeholder="Search child material..."
                              className="md"
                            />
                          </div>

                          {/* Numeric Inputs Row 1 */}
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">作業時間</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={step['作業時間'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">段取時間</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={step['段取時間'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">型番</label>
                              <input 
                                type="text" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={step['型番'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">時間オプション</label>
                              <input 
                                type="text" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed font-mono font-bold"
                                value={step['時間オプション'] ?? ""}
                              />
                            </div>
                          </div>

                          {/* Numeric Inputs Row 2 */}
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1 whitespace-nowrap">生産単位</label>
                              <input 
                                type="text" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={typeof step['生産単位'] === 'object' ? `${step['生産単位']?.name || ''} (${step['生産単位']?.code ?? ''})` : (step['生産単位'] ?? "")}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1 whitespace-nowrap">原単位</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={step['原単位'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1 whitespace-nowrap">製品原単位</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={step['製品原単位'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1 whitespace-nowrap">リード日</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:outline-none cursor-not-allowed"
                                value={step['作業リード日'] ?? ""}
                              />
                            </div>
                          </div>

                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Add Step Button */}
                  <div className="flex justify-center mt-2 pb-2">
                    <button 
                      onClick={handleAddStep}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--freya-blue)]/40 bg-[var(--surface)] px-5 py-2 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue)]/10 transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                      Add Step {bomSteps.length > 0 && `(Step ${bomSteps.length + 1})`}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex justify-end gap-2.5 mt-auto">
          <button 
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || loadingInitial || !targetHinban}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                Saving...
              </>
            ) : "Save BOM"}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
