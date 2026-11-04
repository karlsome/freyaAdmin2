import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { query } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";

function SearchableDropdown({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  allowCustom = true,
  loading = false,
  emptyMessage = "No items found",
  icon = "expand_more",
  helpText,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = String(opt.label || opt.value || "").toLowerCase().includes(term);
      const matchSub = opt.sublabel ? String(opt.sublabel).toLowerCase().includes(term) : false;
      const matchTag = opt.tag ? String(opt.tag).toLowerCase().includes(term) : false;
      return matchLabel || matchSub || matchTag;
    });
  }, [options, search]);

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-[11px] font-bold text-on-surface mb-1 flex items-center justify-between">
          <span>{label}</span>
          {helpText && <span className="text-[10px] text-outline font-normal">{helpText}</span>}
        </label>
      )}

      {/* Button / Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-xl border px-3 py-2 text-xs flex items-center justify-between transition-all bg-surface cursor-pointer text-left ${
          isOpen
            ? "border-primary ring-1 ring-primary shadow-xs"
            : "border-outline-variant/40 hover:border-outline-variant"
        }`}
      >
        <span className={`truncate font-semibold ${value ? "text-on-surface" : "text-outline"}`}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-outline">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
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
            {icon}
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[150] left-0 mt-1.5 w-full min-w-[260px] rounded-xl border border-outline-variant/30 bg-surface shadow-2xl p-2.5 flex flex-col gap-2 animate-[fadeIn_0.1s_ease-out]">
          {/* Search Box at Top */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 pl-8 pr-7 py-1.5 text-xs text-on-surface outline-none focus:border-primary focus:bg-surface focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>

          {/* List Options */}
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
            {/* Clear option */}
            <div
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                !value
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-outline hover:bg-surface-variant/30"
              }`}
            >
              <span>— (未設定 / None)</span>
              {!value && (
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                  check
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-4 text-center text-xs text-outline flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                <span>読込中…</span>
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/15 text-primary font-bold border border-primary/30"
                        : "text-on-surface hover:bg-surface-variant/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      {opt.image ? (
                        <div className="h-6 w-6 rounded-md border border-outline-variant/30 bg-surface flex items-center justify-center overflow-hidden shrink-0">
                          <img src={opt.image} alt="" className="h-full w-full object-contain" />
                        </div>
                      ) : opt.icon ? (
                        <span className="material-symbols-outlined text-primary/80 shrink-0" style={{ fontSize: 18 }}>
                          {opt.icon}
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{opt.label || opt.value}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] text-outline truncate">{opt.sublabel}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.tag && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-variant/60 text-outline border border-outline-variant/30">
                          {opt.tag}
                        </span>
                      )}
                      {isSelected && (
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                          check
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-3 px-2 text-center text-xs text-outline flex flex-col items-center">
                <div>{emptyMessage}</div>
                {allowCustom && search.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(search.trim());
                      setIsOpen(false);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-on-primary transition-all cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    <span>「{search.trim()}」を入力値として使用</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PITCH & MULTI-MACHINE CONFIG BUILDER
// Handles both Standard (Numeric) and Special (Multi-Machine / OZNC rule) modes
// automatically syncing `送りピッチ` and `machineConfig` with setsubiDB equipment.
// ============================================================================
function PitchConfigBuilder({ draft, setDraft, setsubis = [], isJa = true }) {
  const currentFactory = draft["工場"]?.trim();

  // 1. Available single-unit machines from setsubiDB for current factory
  const availableMachines = useMemo(() => {
    const list = currentFactory
      ? setsubis.filter((s) => s["工場"] === currentFactory)
      : setsubis;

    const singles = list
      .map((s) => s.name?.trim())
      .filter((name) => name && !name.includes(",") && !name.includes("+"));

    const unique = Array.from(new Set(singles));
    unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return unique;
  }, [setsubis, currentFactory]);

  // Extract machine items { name, prefix, num }
  const machineItems = useMemo(() => {
    return availableMachines.map((m) => {
      const match = m.match(/^([A-Za-z_-]+)(\d+)$/);
      if (match) {
        return { name: m, prefix: match[1], num: match[2].padStart(2, "0") };
      }
      return { name: m, prefix: "OZNC", num: m };
    });
  }, [availableMachines]);

  // Default prefix derived from available machines or fallback
  const defaultPrefix = useMemo(() => {
    if (machineItems.length > 0 && machineItems[0].prefix) {
      return machineItems[0].prefix;
    }
    return "OZNC";
  }, [machineItems]);

  const [mode, setMode] = useState("numeric"); // "numeric" | "special"
  const [groups, setGroups] = useState([]);
  const [showRawString, setShowRawString] = useState(false);
  const [customInput, setCustomInput] = useState("");

  // Helper: parse raw string or machineConfig into group state
  const parseToGroups = (pitchVal, mConfig, basePc) => {
    const pitchStr = typeof pitchVal === "string" ? pitchVal.trim() : (pitchVal != null ? String(pitchVal) : "");
    const groupRegex = /([A-Za-z]+)\(([^)]+)\):(\d+)/g;
    let match;
    const parsed = [];
    let gIdx = 1;

    while ((match = groupRegex.exec(pitchStr)) !== null) {
      const prefix = match[1];
      const machineNums = match[2]
        .split(",")
        .map((s) => s.trim().padStart(2, "0"))
        .filter(Boolean);
      const pitch = parseInt(match[3], 10);

      // pcPerCycle lookup from machineConfig or default
      let pc = basePc || 4;
      if (mConfig && typeof mConfig === "object") {
        const firstKey = `${prefix}${machineNums[0]}`;
        if (mConfig[firstKey]?.pcPerCycle != null) {
          pc = mConfig[firstKey].pcPerCycle;
        }
      }

      parsed.push({
        id: `group_${gIdx++}`,
        prefix,
        machineNums,
        pitch,
        pcPerCycle: pc,
      });
    }

    // Fallback: parse from machineConfig if string wasn't encoded but config exists
    if (parsed.length === 0 && mConfig && typeof mConfig === "object" && Object.keys(mConfig).length > 0) {
      const map = new Map();
      for (const [mKey, val] of Object.entries(mConfig)) {
        const mMatch = mKey.match(/^([A-Za-z]+)(\d+)$/);
        const prefix = mMatch ? mMatch[1] : defaultPrefix;
        const num = mMatch ? mMatch[2].padStart(2, "0") : mKey;
        const pitch = val?.["送りピッチ"] ?? "";
        const pc = val?.pcPerCycle ?? basePc ?? 4;
        const key = `${prefix}__${pitch}__${pc}`;
        if (!map.has(key)) {
          map.set(key, { prefix, pitch, pcPerCycle: pc, machineNums: [] });
        }
        map.get(key).machineNums.push(num);
      }
      for (const item of map.values()) {
        parsed.push({
          id: `group_${gIdx++}`,
          prefix: item.prefix,
          machineNums: item.machineNums,
          pitch: item.pitch,
          pcPerCycle: item.pcPerCycle,
        });
      }
    }

    if (parsed.length === 0) {
      parsed.push({
        id: "group_1",
        prefix: defaultPrefix,
        machineNums: [],
        pitch: pitchStr && !isNaN(Number(pitchStr)) ? Number(pitchStr) : "",
        pcPerCycle: basePc || 4,
      });
    }

    return parsed;
  };

  // Sync groups changes into draft
  const syncGroupsToDraft = (newGroups) => {
    setGroups(newGroups);

    const validGroups = newGroups.filter((g) => g.machineNums.length > 0 && g.pitch);
    if (validGroups.length === 0) {
      setDraft((prev) => ({
        ...prev,
        送りピッチ: "",
        machineConfig: {},
      }));
      return;
    }

    const pitchString = validGroups
      .map((g) => `${g.prefix || defaultPrefix}(${g.machineNums.join(",")}):${g.pitch}`)
      .join(" ");

    const machineConfig = {};
    for (const g of validGroups) {
      const prefix = g.prefix || defaultPrefix;
      const pitchVal = Number(g.pitch) || g.pitch;
      const pcVal = g.pcPerCycle !== "" && g.pcPerCycle != null ? Number(g.pcPerCycle) : null;
      for (const num of g.machineNums) {
        const mKey = `${prefix}${num}`;
        machineConfig[mKey] = {
          送りピッチ: pitchVal,
          ...(pcVal != null && !isNaN(pcVal) ? { pcPerCycle: pcVal } : {}),
        };
      }
    }

    setDraft((prev) => ({
      ...prev,
      送りピッチ: pitchString,
      machineConfig,
    }));
  };

  // Initial load / detection
  useEffect(() => {
    const rawPitch = draft["送りピッチ"];
    const mConfig = draft["machineConfig"];
    const basePc = draft["pcPerCycle"] || 4;

    const hasSpecialPattern = typeof rawPitch === "string" && /([A-Za-z]+)\(([^)]+)\):(\d+)/.test(rawPitch);
    const hasMConfig = mConfig && typeof mConfig === "object" && Object.keys(mConfig).length > 0;

    if (hasSpecialPattern || hasMConfig) {
      setMode("special");
      const parsed = parseToGroups(rawPitch, mConfig, basePc);
      setGroups(parsed);
    } else {
      setMode("numeric");
      setGroups([
        {
          id: "group_1",
          prefix: defaultPrefix,
          machineNums: [],
          pitch: rawPitch ? String(rawPitch) : "",
          pcPerCycle: basePc || 4,
        },
      ]);
    }
  }, [draft["_id"]]);

  // Mode switcher handler
  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);

    if (newMode === "numeric") {
      const fallbackPitch = groups[0]?.pitch || "";
      setDraft((prev) => ({
        ...prev,
        送りピッチ: fallbackPitch ? Number(fallbackPitch) || fallbackPitch : "",
        machineConfig: null,
      }));
    } else {
      // Special mode
      let newGroups = groups;
      if (newGroups.length === 0 || (!newGroups[0]?.pitch && draft["送りピッチ"])) {
        newGroups = [
          {
            id: "group_1",
            prefix: defaultPrefix,
            machineNums: [],
            pitch: draft["送りピッチ"] || "",
            pcPerCycle: draft["pcPerCycle"] || 4,
          },
        ];
      }
      syncGroupsToDraft(newGroups);
    }
  };

  // Group mutations
  const updateGroup = (groupId, field, value) => {
    const updated = groups.map((g) => (g.id === groupId ? { ...g, [field]: value } : g));
    syncGroupsToDraft(updated);
  };

  const addGroup = () => {
    const nextIdx = groups.length + 1;
    // Calculate suggested pitch / pc ratio based on group 1 if present
    const basePitch = groups[0]?.pitch ? Number(groups[0].pitch) : 0;
    const basePc = groups[0]?.pcPerCycle ? Number(groups[0].pcPerCycle) : Number(draft["pcPerCycle"]) || 4;

    const newGroup = {
      id: `group_${Date.now()}_${nextIdx}`,
      prefix: defaultPrefix,
      machineNums: [],
      pitch: basePitch ? basePitch * 2 : "",
      pcPerCycle: basePc ? basePc * 2 : 8,
    };
    syncGroupsToDraft([...groups, newGroup]);
  };

  const removeGroup = (groupId) => {
    if (groups.length <= 1) return;
    const updated = groups.filter((g) => g.id !== groupId);
    syncGroupsToDraft(updated);
  };

  // Toggle a machine num in a specific group
  const toggleMachineInGroup = (groupId, machineNum) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        const exists = g.machineNums.includes(machineNum);
        return {
          ...g,
          machineNums: exists ? g.machineNums.filter((n) => n !== machineNum) : [...g.machineNums, machineNum],
        };
      }
      // If adding to this group, remove it from other groups to prevent duplicates
      return {
        ...g,
        machineNums: g.machineNums.filter((n) => n !== machineNum),
      };
    });
    syncGroupsToDraft(updated);
  };

  // Quick Action: Add all unassigned machines to group
  const addAllUnassignedToGroup = (groupId) => {
    const assignedNums = new Set(groups.flatMap((g) => g.machineNums));
    const unassigned = machineItems.filter((m) => !assignedNums.has(m.num)).map((m) => m.num);

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          machineNums: Array.from(new Set([...g.machineNums, ...unassigned])),
        };
      }
      return g;
    });
    syncGroupsToDraft(updated);
  };

  // Quick Action: Add Even / Odd machines
  const addFilteredMachinesToGroup = (groupId, parity) => {
    const targetNums = machineItems
      .filter((m) => {
        const n = parseInt(m.num, 10);
        return !isNaN(n) && (parity === "even" ? n % 2 === 0 : n % 2 !== 0);
      })
      .map((m) => m.num);

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          machineNums: Array.from(new Set([...g.machineNums, ...targetNums])),
        };
      }
      // Remove from other groups
      return {
        ...g,
        machineNums: g.machineNums.filter((n) => !targetNums.includes(n)),
      };
    });
    syncGroupsToDraft(updated);
  };

  const clearGroupMachines = (groupId) => {
    const updated = groups.map((g) => (g.id === groupId ? { ...g, machineNums: [] } : g));
    syncGroupsToDraft(updated);
  };

  // Custom machine number addition
  const handleAddCustomMachine = (groupId) => {
    if (!customInput.trim()) return;
    const cleanNum = customInput.trim().replace(/^0+/, "").padStart(2, "0");
    toggleMachineInGroup(groupId, cleanNum);
    setCustomInput("");
  };

  // Global assigned machine lookup for styling
  const assignedMap = useMemo(() => {
    const map = new Map();
    groups.forEach((g, gIdx) => {
      g.machineNums.forEach((num) => {
        map.set(num, { groupId: g.id, groupIndex: gIdx + 1, pitch: g.pitch });
      });
    });
    return map;
  }, [groups]);

  const totalConfiguredMachines = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.machineNums.length, 0);
  }, [groups]);

  return (
    <div className="col-span-full bg-surface border border-outline-variant/30 rounded-2xl p-4.5 flex flex-col gap-4 shadow-xs">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
            tune
          </span>
          <div>
            <div className="text-xs font-bold text-on-surface">
              {isJa ? "送りピッチ・設備個別設定 (Pitch & Machine Config)" : "Feed Pitch & Machine Config"}
            </div>
            <div className="text-[10px] text-outline">
              {currentFactory
                ? isJa
                  ? `setsubiDB 連動中 (${currentFactory})`
                  : `Linked with setsubiDB (${currentFactory})`
                : isJa
                ? "setsubiDB 全設備"
                : "setsubiDB (All Equipment)"}
            </div>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center bg-surface-variant/30 p-1 rounded-xl border border-outline-variant/30 text-xs">
          <button
            type="button"
            onClick={() => handleModeSwitch("numeric")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === "numeric"
                ? "bg-surface text-primary shadow-xs border border-outline-variant/20"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              pin
            </span>
            <span>{isJa ? "通常 (単一数値)" : "Standard (Numeric)"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("special")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === "special"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              settings_suggest
            </span>
            <span>{isJa ? "特殊 (設備個別・OZNC)" : "Special (Multi-Machine)"}</span>
          </button>
        </div>
      </div>

      {/* MODE 1: Standard Numeric */}
      {mode === "numeric" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center animate-[fadeIn_0.15s_ease-out]">
          <div>
            <label className="block text-[11px] font-bold text-on-surface mb-1 flex items-center justify-between">
              <span>{isJa ? "送りピッチ (mm)" : "Feed Pitch (mm)"}</span>
              <span className="text-[10px] text-outline font-normal">単一数値入力</span>
            </label>
            <input
              type="number"
              value={draft["送りピッチ"] ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setDraft((prev) => ({
                  ...prev,
                  送りピッチ: val !== "" ? Number(val) || val : "",
                  machineConfig: null,
                }));
              }}
              placeholder="e.g. 820 / 765"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3.5 py-2.5 text-xs font-bold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base sm:text-xs"
            />
          </div>
          <div className="bg-surface-variant/20 rounded-xl p-3 border border-outline-variant/20 text-xs text-outline leading-relaxed flex items-start gap-2">
            <span className="material-symbols-outlined text-primary shrink-0 mt-0.5" style={{ fontSize: 18 }}>
              info
            </span>
            <div>
              {isJa
                ? "すべての設備で同一の送りピッチを使用する場合は、数値を入力してください。設備ごとに送りピッチや取数が異なる場合は「特殊」モードに切り替えてください。"
                : "Enter a single numeric pitch for all equipment. If different machines require distinct pitches or piece counts (e.g. OZNC pairs), switch to Special mode."}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Special Multi-Machine Builder */}
      {mode === "special" && (
        <div className="flex flex-col gap-4 animate-[fadeIn_0.15s_ease-out]">
          {/* Groups List */}
          <div className="flex flex-col gap-3.5">
            {groups.map((group, gIdx) => {
              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-outline-variant/40 bg-surface-variant/10 p-4 flex flex-col gap-3 transition-all hover:border-primary/40 shadow-2xs"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center">
                        {gIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-on-surface">
                        {isJa ? `グループ ${gIdx + 1}` : `Group ${gIdx + 1}`}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface font-semibold text-primary border border-outline-variant/30">
                        {group.machineNums.length} {isJa ? "台設定済" : "machines"}
                      </span>
                    </div>

                    {groups.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGroup(group.id)}
                        className="text-outline hover:text-error text-xs font-semibold flex items-center gap-1 p-1 rounded-md transition-colors cursor-pointer"
                        title={isJa ? "このグループを削除" : "Remove group"}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          delete
                        </span>
                        <span className="text-[11px]">{isJa ? "削除" : "Remove"}</span>
                      </button>
                    )}
                  </div>

                  {/* Group Specs Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-outline mb-1">
                        {isJa ? "設備プレフィックス" : "Machine Prefix"}
                      </label>
                      <input
                        type="text"
                        value={group.prefix ?? defaultPrefix}
                        onChange={(e) => updateGroup(group.id, "prefix", e.target.value.toUpperCase())}
                        placeholder="e.g. OZNC"
                        className="w-full rounded-lg border border-outline-variant/40 bg-surface px-2.5 py-1.5 text-xs font-bold text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface mb-1 flex items-center justify-between">
                        <span>{isJa ? "送りピッチ (mm)" : "Pitch (mm)"}</span>
                        <span className="text-primary font-black">*必須</span>
                      </label>
                      <input
                        type="number"
                        value={group.pitch ?? ""}
                        onChange={(e) => updateGroup(group.id, "pitch", e.target.value)}
                        placeholder="e.g. 765 / 1530"
                        className="w-full rounded-lg border border-primary/40 bg-surface px-2.5 py-1.5 text-xs font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-outline mb-1">
                        {isJa ? "取数 (pcPerCycle)" : "Pcs / Cycle"}
                      </label>
                      <input
                        type="number"
                        value={group.pcPerCycle ?? ""}
                        onChange={(e) => updateGroup(group.id, "pcPerCycle", e.target.value)}
                        placeholder="e.g. 4 / 8"
                        className="w-full rounded-lg border border-outline-variant/40 bg-surface px-2.5 py-1.5 text-xs font-bold text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Machine Pills Selection */}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-on-surface flex items-center gap-1">
                        <span className="material-symbols-outlined text-outline" style={{ fontSize: 15 }}>
                          precision_manufacturing
                        </span>
                        <span>{isJa ? "対象設備を選択 (クリックでON/OFF)" : "Select Machines (Click to toggle)"}</span>
                      </span>

                      {/* Quick Select Buttons */}
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => addAllUnassignedToGroup(group.id)}
                          className="px-2 py-0.5 rounded bg-surface border border-outline-variant/40 text-on-surface hover:border-primary font-medium transition-colors cursor-pointer"
                        >
                          {isJa ? "+ 未設定を全て追加" : "+ Add Unassigned"}
                        </button>
                        <button
                          type="button"
                          onClick={() => addFilteredMachinesToGroup(group.id, "even")}
                          className="px-2 py-0.5 rounded bg-surface border border-outline-variant/40 text-on-surface hover:border-primary font-medium transition-colors cursor-pointer"
                        >
                          {isJa ? "偶数 (02,04..)" : "Even"}
                        </button>
                        <button
                          type="button"
                          onClick={() => addFilteredMachinesToGroup(group.id, "odd")}
                          className="px-2 py-0.5 rounded bg-surface border border-outline-variant/40 text-on-surface hover:border-primary font-medium transition-colors cursor-pointer"
                        >
                          {isJa ? "奇数 (01,03..)" : "Odd"}
                        </button>
                        {group.machineNums.length > 0 && (
                          <button
                            type="button"
                            onClick={() => clearGroupMachines(group.id)}
                            className="px-2 py-0.5 rounded bg-surface border border-outline-variant/40 text-outline hover:text-error font-medium transition-colors cursor-pointer"
                          >
                            {isJa ? "クリア" : "Clear"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Machine Chips Grid */}
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-surface border border-outline-variant/25 min-h-[46px] items-center">
                      {machineItems.map((item) => {
                        const isSelectedInThisGroup = group.machineNums.includes(item.num);
                        const assignedInfo = assignedMap.get(item.num);
                        const isAssignedToOtherGroup = assignedInfo && assignedInfo.groupId !== group.id;

                        if (isSelectedInThisGroup) {
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => toggleMachineInGroup(group.id, item.num)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-on-primary shadow-xs flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                              title={isJa ? "クリックで解除" : "Click to deselect"}
                            >
                              <span>{item.name}</span>
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                check
                              </span>
                            </button>
                          );
                        }

                        if (isAssignedToOtherGroup) {
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => toggleMachineInGroup(group.id, item.num)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-variant/30 text-outline border border-dashed border-outline-variant/40 hover:border-primary hover:text-on-surface flex items-center gap-1 transition-all cursor-pointer"
                              title={
                                isJa
                                  ? `現在 グループ ${assignedInfo.groupIndex} (${assignedInfo.pitch}mm) に設定中。クリックでこのグループに移動`
                                  : `In Group ${assignedInfo.groupIndex} (${assignedInfo.pitch}mm). Click to move here`
                              }
                            >
                              <span>{item.name}</span>
                              <span className="text-[9px] opacity-70">(G{assignedInfo.groupIndex})</span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => toggleMachineInGroup(group.id, item.num)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface text-on-surface border border-outline-variant/40 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                          >
                            {item.name}
                          </button>
                        );
                      })}

                      {machineItems.length === 0 && (
                        <span className="text-xs text-outline py-1">
                          {isJa ? "setsubiDB に登録された設備がありません" : "No machines found in setsubiDB"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Group & Custom Machine Input */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={addGroup}
              className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                add_circle
              </span>
              <span>{isJa ? "+ 新しい設備グループを追加" : "+ Add Machine Group"}</span>
            </button>

            {/* Custom machine number quick add */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (groups.length > 0) handleAddCustomMachine(groups[0].id);
                  }
                }}
                placeholder="01, 19..."
                className="w-20 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-xs text-on-surface outline-none focus:border-primary text-center"
              />
              <button
                type="button"
                onClick={() => {
                  if (groups.length > 0) handleAddCustomMachine(groups[0].id);
                }}
                className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/40 text-on-surface hover:border-primary text-xs font-semibold transition-colors cursor-pointer"
              >
                {isJa ? "番号追加" : "Add No."}
              </button>
            </div>
          </div>

          {/* Live Generated Summary & Preview */}
          <div className="bg-surface-variant/20 rounded-xl p-3.5 border border-outline-variant/25 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                  check_circle
                </span>
                <span className="text-xs font-bold text-on-surface">
                  {isJa ? "自動生成プレビュー (Live Auto-Sync)" : "Live Generated Preview"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {totalConfiguredMachines} {isJa ? "台設定" : "machines"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowRawString(!showRawString)}
                className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
              >
                {showRawString ? (isJa ? "閉じる" : "Hide Raw") : isJa ? "文字列・JSON表示" : "Show Raw"}
              </button>
            </div>

            {/* Generated pitch string preview */}
            <div className="font-mono text-xs text-on-surface bg-surface p-2.5 rounded-lg border border-outline-variant/30 break-all select-all">
              {draft["送りピッチ"] || (
                <span className="text-outline italic">
                  {isJa ? "設備と送りピッチを設定してください…" : "Set equipment and pitch to preview..."}
                </span>
              )}
            </div>

            {/* Detailed Raw string / JSON viewer */}
            {showRawString && (
              <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20 animate-[fadeIn_0.15s_ease-out]">
                <div>
                  <div className="text-[10px] font-bold text-outline mb-0.5">送りピッチ (String):</div>
                  <textarea
                    rows={2}
                    value={draft["送りピッチ"] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft((prev) => ({ ...prev, 送りピッチ: val }));
                    }}
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface p-2 text-xs font-mono text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-outline mb-0.5">machineConfig (Object):</div>
                  <pre className="text-[11px] font-mono bg-surface p-2.5 rounded-lg border border-outline-variant/30 max-h-36 overflow-y-auto text-on-surface">
                    {JSON.stringify(draft["machineConfig"], null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MasterProductEditModal({
  open,
  record,
  isNew = false,
  submitting = false,
  onClose,
  onSubmit,
  onUploadImage,
}) {
  const { t, language } = useLanguage();
  const isJa = language === "ja";
  const fileInputRef = useRef(null);

  const initialDraft = {
    // 1. Identity
    品番: "",
    モデル: "",
    背番号: "",
    品名: "",
    形状: "",
    "R/L": "-",
    色: "",

    // 2. Manufacturing & Machine Specs
    工場: "",
    加工設備: "",
    型番: "",
    収容数: "",
    送りピッチ: "",
    刃物: "",
    "離型紙上/下": "下",
    "秒数(1pcs何秒)": "",
    pcPerCycle: "",
    SRS: "",
    SLIT: "",

    // 3. Materials
    材料: "",
    材料背番号: "",
    材料品番: "",

    // 4. Pricing, Logistics & Operations
    "顧客/納入先": "",
    pricePerPc: "",
    pricePerBox: "",
    pickingIOT: "no",
    boardData: "",
    labelMarking: "",
    "QR CODE": "",
    imageURL: "",

    // 5. Remarks
    備考: "",
  };

  const [draft, setDraft] = useState(initialDraft);
  const [isLookingUpMaterial, setIsLookingUpMaterial] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // DB Data for Dropdowns
  const [factories, setFactories] = useState([]);
  const [setsubis, setSetsubis] = useState([]);
  const [blades, setBlades] = useState([]);
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [loadingSetsubis, setLoadingSetsubis] = useState(false);
  const [loadingBlades, setLoadingBlades] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingFactories(true);
      setLoadingSetsubis(true);
      setLoadingBlades(true);

      query("Sasaki_Coating_MasterDB", "factoryDB", {}, { sort: { 工場: 1 } })
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setFactories(list);
        })
        .catch((err) => console.error("Failed to load factoryDB:", err))
        .finally(() => setLoadingFactories(false));

      query("Sasaki_Coating_MasterDB", "setsubiDB", { _archived: { $ne: true } }, { sort: { 工場: 1, name: 1 } })
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setSetsubis(list);
        })
        .catch((err) => console.error("Failed to load setsubiDB:", err))
        .finally(() => setLoadingSetsubis(false));

      query("Sasaki_Coating_MasterDB", "NCBladeDB", {}, { sort: { name: 1 } })
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setBlades(list);
        })
        .catch((err) => console.error("Failed to load NCBladeDB:", err))
        .finally(() => setLoadingBlades(false));
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (record) {
        setDraft({
          ...initialDraft,
          ...record,
          boardData: record["boardData"] ?? record["Board Data"] ?? "",
          imageURL: record["imageURL"] ?? record["写真"] ?? "",
        });
      } else {
        setDraft(initialDraft);
      }
    }
  }, [open, record]);

  // Dropdown Options
  const factoryOptions = useMemo(() => {
    return factories.map((f) => ({
      value: f["工場"],
      label: f["工場"],
      sublabel: f["location"] || "",
      icon: "factory",
    }));
  }, [factories]);

  const equipmentOptions = useMemo(() => {
    const currentFactory = draft["工場"]?.trim();
    const filtered = currentFactory
      ? setsubis.filter((s) => s["工場"] === currentFactory)
      : setsubis;

    return filtered.map((s) => ({
      value: s.name,
      label: s.name,
      sublabel: s.manufacturer && s.model ? `${s.manufacturer} ${s.model}` : s.manufacturer || s.model || "",
      tag: s["工場"] || "",
      image: s.imageURL || null,
      icon: "precision_manufacturing",
    }));
  }, [setsubis, draft["工場"]]);

  const bladeOptions = useMemo(() => {
    return blades.map((b) => ({
      value: b.name || b.Name || b["刃物"] || b["型番"] || "",
      label: b.name || b.Name || b["刃物"] || b["型番"] || "",
      image: b.imageURL || null,
      icon: "content_cut",
    })).filter((opt) => opt.value);
  }, [blades]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  // 1. Auto-generate 材料品番 from 材料背番号 on blur / change
  const handleMaterialBackNoLookup = async (backNoVal) => {
    const rawVal = (typeof backNoVal === "string" ? backNoVal : draft["材料背番号"]) ?? "";
    const keys = String(rawVal)
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (keys.length === 0) return;
    setIsLookingUpMaterial(true);
    try {
      const results = await Promise.all(
        keys.map(async (backNo) => {
          const res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", {
            $or: [
              { "品目マスタ.ラベル品番": backNo },
              { "ラベル品番": backNo },
              { "品番": backNo },
              { "品目マスタ.品番": backNo },
            ],
          });
          const data = Array.isArray(res) ? res[0] : res?.data?.[0];
          return data || null;
        })
      );

      const validHinbans = results
        .map((d) => d?.["品番"] || d?.["品目マスタ"]?.["品番"])
        .filter(Boolean);
      const firstMatName = results.find((d) => d?.["品目マスタ"]?.["品名"] || d?.["品名"]);
      const matName = firstMatName?.["品目マスタ"]?.["品名"] || firstMatName?.["品名"];

      if (validHinbans.length > 0) {
        setDraft((prev) => ({
          ...prev,
          材料品番: validHinbans.join(", "),
          材料: prev["材料"]?.trim() ? prev["材料"] : (matName || prev["材料"]),
        }));
      }
    } catch (err) {
      console.error("Failed to lookup material hinbans from back numbers:", err);
    } finally {
      setIsLookingUpMaterial(false);
    }
  };

  // 2. Vice-versa: Auto-generate 材料背番号 from 材料品番 on blur / change
  const handleMaterialHinbanLookup = async (hinbanVal) => {
    const rawVal = (typeof hinbanVal === "string" ? hinbanVal : draft["材料品番"]) ?? "";
    const keys = String(rawVal)
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (keys.length === 0) return;
    setIsLookingUpMaterial(true);
    try {
      const results = await Promise.all(
        keys.map(async (hinban) => {
          const res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", {
            $or: [
              { "品番": hinban },
              { "品目マスタ.品番": hinban },
              { "ラベル品番": hinban },
              { "品目マスタ.ラベル品番": hinban },
            ],
          });
          const data = Array.isArray(res) ? res[0] : res?.data?.[0];
          return data || null;
        })
      );

      const validBackNos = results
        .map((d) => d?.["品目マスタ"]?.["ラベル品番"] || d?.["ラベル品番"])
        .filter(Boolean);
      const firstMatName = results.find((d) => d?.["品目マスタ"]?.["品名"] || d?.["品名"]);
      const matName = firstMatName?.["品目マスタ"]?.["品名"] || firstMatName?.["品名"];

      if (validBackNos.length > 0) {
        setDraft((prev) => ({
          ...prev,
          材料背番号: validBackNos.join(", "),
          材料: prev["材料"]?.trim() ? prev["材料"] : (matName || prev["材料"]),
        }));
      }
    } catch (err) {
      console.error("Failed to lookup back numbers from material hinbans:", err);
    } finally {
      setIsLookingUpMaterial(false);
    }
  };

  // 3. Image file select & upload
  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsUploadingImage(true);
    try {
      if (onUploadImage) {
        const res = await onUploadImage(file);
        const url = res?.imageURL || (typeof res === "string" ? res : null);
        if (url) {
          setDraft((prev) => ({ ...prev, imageURL: url }));
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setDraft((prev) => ({ ...prev, imageURL: String(reader.result || "") }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert(isJa ? "画像のアップロードに失敗しました。" : "Failed to upload image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!draft["品番"]?.trim()) {
      alert(isJa ? "品番を入力してください。" : "Please enter a Part Number (品番).");
      return;
    }

    const payload = { ...draft };

    // Numeric coercions
    if (payload.送りピッチ !== "" && payload.送りピッチ != null) {
      const num = Number(payload.送りピッチ);
      if (!isNaN(num)) payload.送りピッチ = num;
    }
    if (payload.pcPerCycle !== "" && payload.pcPerCycle != null) {
      const num = Number(payload.pcPerCycle);
      if (!isNaN(num)) payload.pcPerCycle = num;
    }
    if (payload.pricePerPc !== "" && payload.pricePerPc != null) {
      const num = Number(payload.pricePerPc);
      if (!isNaN(num)) payload.pricePerPc = num;
    }
    if (payload.pricePerBox !== "" && payload.pricePerBox != null) {
      const num = Number(payload.pricePerBox);
      if (!isNaN(num)) payload.pricePerBox = num;
    }

    // Clean legacy/confusing empty fields so they never get written to MongoDB
    delete payload["BoardDataQR"];
    delete payload["Board Data"];
    delete payload["写真"];

    if (onSubmit) {
      onSubmit(payload);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
      <div
        className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-outline-variant/30 bg-surface-variant/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                {isNew ? "add_box" : "edit_note"}
              </span>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-on-surface">
                {isNew
                  ? isJa
                    ? "内装品レコード新規作成"
                    : "Create Product Record"
                  : isJa
                  ? `内装品レコード編集: ${draft["品番"] || ""}`
                  : `Edit Product Record: ${draft["品番"] || ""}`}
              </h2>
              <p className="text-xs text-outline">
                {isJa
                  ? "マスター属性を構造化フォームで安全に編集できます"
                  : "Edit master attributes safely in structured form sections"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors cursor-pointer"
            title={t("ff_close")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">

          {/* 1. Vehicle & Core Product Identity */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>directions_car</span>
              <span>{isJa ? "1. 車両・製品基本情報 (Identity)" : "1. Vehicle & Product Identity"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "品番" : "Part No. (品番)"} <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={draft["品番"] ?? ""}
                  onChange={(e) => handleChange("品番", e.target.value)}
                  placeholder="e.g. 74222-X1B17-E0"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "モデル (車種)" : "Model (モデル)"}
                </label>
                <input
                  type="text"
                  value={draft["モデル"] ?? ""}
                  onChange={(e) => handleChange("モデル", e.target.value)}
                  placeholder="e.g. 992W(310D)"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "背番号" : "Back No. (背番号)"}
                </label>
                <input
                  type="text"
                  value={draft["背番号"] ?? ""}
                  onChange={(e) => handleChange("背番号", e.target.value)}
                  placeholder="e.g. 1GL / RA04"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "形状" : "Shape (形状)"}
                </label>
                <input
                  type="text"
                  value={draft["形状"] ?? ""}
                  onChange={(e) => handleChange("形状", e.target.value)}
                  placeholder="e.g. Ornament_Front / Aピラー"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "R/L (左右)" : "Side (R/L)"}
                </label>
                <select
                  value={draft["R/L"] ?? ""}
                  onChange={(e) => handleChange("R/L", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">—</option>
                  <option value="LH">LH (Left)</option>
                  <option value="RH">RH (Right)</option>
                  <option value="-">- (Common)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "色" : "Color (色)"}
                </label>
                <input
                  type="text"
                  value={draft["色"] ?? ""}
                  onChange={(e) => handleChange("色", e.target.value)}
                  placeholder="e.g. LT.GRAY(Z1T7) / ブラック"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "品名" : "Product Name (品名)"}
                </label>
                <input
                  type="text"
                  value={draft["品名"] ?? ""}
                  onChange={(e) => handleChange("品名", e.target.value)}
                  placeholder="e.g. OMT FR RH P-LIKE LT.GRAY(Z1T7)"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* 2. Manufacturing & Machine Specs */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>precision_manufacturing</span>
              <span>{isJa ? "2. 製造・設備仕様 (Manufacturing & Specs)" : "2. Manufacturing & Machine Specs"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Factory Dropdown (from factoryDB) */}
              <SearchableDropdown
                label={isJa ? "工場" : "Factory (工場)"}
                value={draft["工場"] ?? ""}
                onChange={(val) => handleChange("工場", val)}
                options={factoryOptions}
                placeholder={isJa ? "工場を選択…" : "Select Factory…"}
                searchPlaceholder={isJa ? "工場を検索…" : "Search factories…"}
                loading={loadingFactories}
                helpText="factoryDB"
                icon="factory"
              />

              {/* Equipment Dropdown (from setsubiDB filtered by selected factory) */}
              <SearchableDropdown
                label={isJa ? "加工設備" : "Equipment (加工設備)"}
                value={draft["加工設備"] ?? ""}
                onChange={(val) => handleChange("加工設備", val)}
                options={equipmentOptions}
                placeholder={isJa ? "設備を選択…" : "Select Equipment…"}
                searchPlaceholder={isJa ? "設備名・型式を検索…" : "Search equipment…"}
                loading={loadingSetsubis}
                helpText={draft["工場"] ? `${draft["工場"]} 設備` : "setsubiDB"}
                icon="precision_manufacturing"
              />

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "型番" : "Model No. (型番)"}
                </label>
                <input
                  type="text"
                  value={draft["型番"] ?? ""}
                  onChange={(e) => handleChange("型番", e.target.value)}
                  placeholder="e.g. 102 / 17-2"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "収容数" : "Pack Qty (収容数)"}
                </label>
                <input
                  type="text"
                  value={draft["収容数"] ?? ""}
                  onChange={(e) => handleChange("収容数", e.target.value)}
                  placeholder="e.g. 40 / 150"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-bold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Blade / Tooling Dropdown (from NCBladeDB) */}
              <SearchableDropdown
                label={isJa ? "刃物" : "Cutter / Blade (刃物)"}
                value={draft["刃物"] ?? ""}
                onChange={(val) => handleChange("刃物", val)}
                options={bladeOptions}
                placeholder={isJa ? "刃物を選択…" : "Select Blade…"}
                searchPlaceholder={isJa ? "刃物名を検索…" : "Search blade…"}
                loading={loadingBlades}
                helpText="NCBladeDB"
                icon="content_cut"
                allowCustom={true}
              />

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "離型紙上/下" : "Release Paper (離型紙)"}
                </label>
                <select
                  value={draft["離型紙上/下"] ?? ""}
                  onChange={(e) => handleChange("離型紙上/下", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">—</option>
                  <option value="上">{isJa ? "上 (Top)" : "Top (上)"}</option>
                  <option value="下">{isJa ? "下 (Bottom)" : "Bottom (下)"}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "秒数 (1pcs何秒)" : "Cycle Sec / pc"}
                </label>
                <input
                  type="text"
                  value={draft["秒数(1pcs何秒)"] ?? ""}
                  onChange={(e) => handleChange("秒数(1pcs何秒)", e.target.value)}
                  placeholder="e.g. 5 or 3:07 - 6pcs"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "基本取数 (pcPerCycle)" : "Default Pcs / Cycle"}
                </label>
                <input
                  type="number"
                  value={draft["pcPerCycle"] ?? ""}
                  onChange={(e) => handleChange("pcPerCycle", e.target.value)}
                  placeholder="e.g. 4 / 7"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">SRS</label>
                <select
                  value={draft["SRS"] ?? ""}
                  onChange={(e) => handleChange("SRS", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">—</option>
                  <option value="あり">{isJa ? "あり" : "Yes"}</option>
                  <option value="なし">{isJa ? "なし" : "No"}</option>
                  <option value="無し">{isJa ? "無し" : "None"}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">SLIT</label>
                <select
                  value={draft["SLIT"] ?? ""}
                  onChange={(e) => handleChange("SLIT", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">—</option>
                  <option value="あり">{isJa ? "あり" : "Yes"}</option>
                  <option value="なし">{isJa ? "なし" : "No"}</option>
                  <option value="無し">{isJa ? "無し" : "None"}</option>
                </select>
              </div>
            </div>

            {/* DEDICATED PITCH & MULTI-MACHINE CONFIG BUILDER */}
            <PitchConfigBuilder
              draft={draft}
              setDraft={setDraft}
              setsubis={setsubis}
              isJa={isJa}
            />
          </div>

          {/* 3. Material Specifications with Bidirectional Auto-Lookup */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>layers</span>
                <span>{isJa ? "3. 使用材料情報 (双方向・材料DB連携)" : "3. Material Specs (Bidirectional Material DB Link)"}</span>
              </div>
              {isLookingUpMaterial && (
                <span className="text-[10px] text-primary/80 animate-pulse flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                  <span>{isJa ? "材料DB自動照合中…" : "Auto-syncing with Material DB…"}</span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "材料名" : "Material Name (材料)"}
                </label>
                <input
                  type="text"
                  value={draft["材料"] ?? ""}
                  onChange={(e) => handleChange("材料", e.target.value)}
                  placeholder="e.g. ソフトレザーC2 MAT / モルトA"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-primary mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>{isJa ? "材料背番号 (ラベル品番)" : "Material Back No."}</span>
                    <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                  </span>
                  <span className="text-[10px] text-outline font-normal">複数可 (カンマ区切り)</span>
                </label>
                <input
                  type="text"
                  value={draft["材料背番号"] ?? ""}
                  onChange={(e) => handleChange("材料背番号", e.target.value)}
                  onBlur={(e) => handleMaterialBackNoLookup(e.target.value)}
                  placeholder="e.g. Z1T7 or MA90, MA44, A3B"
                  className="w-full rounded-xl border border-primary/40 bg-surface px-3 py-2 text-xs font-mono font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-primary mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>{isJa ? "材料品番 (構成品番)" : "Material Hinban"}</span>
                    <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                  </span>
                  <span className="text-[10px] text-outline font-normal">複数行・カンマ区切り可</span>
                </label>
                <textarea
                  rows={2}
                  value={draft["材料品番"] ?? ""}
                  onChange={(e) => handleChange("材料品番", e.target.value)}
                  onBlur={(e) => handleMaterialHinbanLookup(e.target.value)}
                  placeholder="e.g. C13/MLA11B*GD/***W48, C13/MLA67B*GD/***W48"
                  className="w-full rounded-xl border border-primary/40 bg-surface p-2.5 text-xs font-mono font-bold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y min-h-[42px] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* 4. Pricing, Logistics & Operations */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
              <span>{isJa ? "4. 価格・物流・運用・IoT情報" : "4. Pricing, Logistics & Operations"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "顧客 / 納入先" : "Customer / Destination"}
                </label>
                <input
                  type="text"
                  value={draft["顧客/納入先"] ?? ""}
                  onChange={(e) => handleChange("顧客/納入先", e.target.value)}
                  placeholder="e.g. 豊ケミ/TB/豊大工業"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "個単価 (¥)" : "Price / Pc (¥)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={draft["pricePerPc"] ?? ""}
                  onChange={(e) => handleChange("pricePerPc", e.target.value)}
                  placeholder="e.g. 387.6"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "箱単価 (¥)" : "Price / Box (¥)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={draft["pricePerBox"] ?? ""}
                  onChange={(e) => handleChange("pricePerBox", e.target.value)}
                  placeholder="e.g. 15504"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "ピッキングIoT (pickingIOT)" : "Picking IoT"}
                </label>
                <select
                  value={draft["pickingIOT"] ?? ""}
                  onChange={(e) => handleChange("pickingIOT", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="no">no</option>
                  <option value="yes">yes</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "カンバン (boardData)" : "Board Data (カンバン)"}
                </label>
                <input
                  type="text"
                  value={draft["boardData"] ?? ""}
                  onChange={(e) => handleChange("boardData", e.target.value)}
                  placeholder="e.g. 2TN,Globe box,-"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "ラベル刻印 (labelMarking)" : "Label Marking"}
                </label>
                <input
                  type="text"
                  value={draft["labelMarking"] ?? ""}
                  onChange={(e) => handleChange("labelMarking", e.target.value)}
                  placeholder="e.g. －♦♦－"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">QR CODE</label>
                <input
                  type="text"
                  value={draft["QR CODE"] ?? ""}
                  onChange={(e) => handleChange("QR CODE", e.target.value)}
                  placeholder="QR code string"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Product Image Thumbnail Preview & Upload / Replace Area */}
              <div className="md:col-span-4 bg-surface-variant/20 border border-outline-variant/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>image</span>
                    <span>{isJa ? "製品画像 (Product Image)" : "Product Image"}</span>
                  </label>
                  {isUploadingImage && (
                    <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                      <span>{isJa ? "Firebase Storage アップロード中…" : "Uploading to Firebase…"}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Thumbnail Preview */}
                  {draft.imageURL ? (
                    <div
                      onClick={() =>
                        setPreviewImage({
                          displayName: draft["品番"] || "Product Image",
                          eyebrow: "Product Reference Image",
                          subtitle: `${draft["モデル"] ? draft["モデル"] + " • " : ""}${draft["品名"] || ""}`,
                          images: [{ url: draft.imageURL, label: draft["品番"] || "Product Image" }],
                          activeIndex: 0,
                        })
                      }
                      className="relative group shrink-0 h-28 w-28 rounded-xl border border-outline-variant/40 bg-surface flex items-center justify-center p-1.5 overflow-hidden shadow-xs cursor-pointer hover:border-primary transition-all"
                      title={isJa ? "クリックして拡大表示" : "Click to preview"}
                    >
                      <img
                        src={draft.imageURL}
                        alt="Product"
                        className="h-full w-full object-contain rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>zoom_in</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 w-28 rounded-xl border-2 border-dashed border-outline-variant/50 bg-surface flex flex-col items-center justify-center gap-1 text-outline shrink-0">
                      <span className="material-symbols-outlined opacity-50" style={{ fontSize: 28 }}>add_photo_alternate</span>
                      <span className="text-[10px]">{isJa ? "画像なし" : "No image"}</span>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileSelect}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {isUploadingImage ? "progress_activity" : "upload"}
                        </span>
                        <span>
                          {isUploadingImage
                            ? (isJa ? "アップロード中…" : "Uploading…")
                            : draft.imageURL
                            ? (isJa ? "画像を変更 / 再アップロード" : "Replace Image")
                            : (isJa ? "画像を選択してアップロード" : "Choose & Upload Image")}
                        </span>
                      </button>

                      {draft.imageURL && (
                        <button
                          type="button"
                          onClick={() => handleChange("imageURL", "")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-xs font-bold text-error hover:bg-error/15 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          <span>{isJa ? "画像を解除" : "Remove"}</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-outline">
                      {isJa
                        ? "画像を選択すると Firebase Storage (masterImage/) に自動保存され、URLが反映されます。"
                        : "Uploaded images are stored in Firebase Storage (masterImage/) and linked to this product."}
                    </p>

                    {/* URL text display / custom edit */}
                    <div className="mt-0.5">
                      <input
                        type="text"
                        value={draft.imageURL ?? ""}
                        onChange={(e) => handleChange("imageURL", e.target.value)}
                        placeholder="https://firebasestorage.googleapis.com/..."
                        className="w-full rounded-lg border border-outline-variant/30 bg-surface px-2.5 py-1 text-[11px] font-mono text-outline focus:text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Remarks */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-2">
            <label className="block text-xs font-bold text-primary uppercase tracking-wider">
              {isJa ? "5. 備考 (Remarks / Notes)" : "5. Remarks / Notes"}
            </label>
            <textarea
              rows={3}
              value={draft["備考"] ?? ""}
              onChange={(e) => handleChange("備考", e.target.value)}
              placeholder={isJa ? "特記事項や作業上の注意点などを入力…" : "Enter additional notes or special instructions…"}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface p-3 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-outline-variant/30 bg-surface-variant/20">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-outline-variant/40 bg-surface px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-variant/40 transition-colors cursor-pointer"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-primary px-6 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
                progress_activity
              </span>
            )}
            <span>
              {submitting
                ? isJa ? "保存中…" : "Saving…"
                : isNew
                ? isJa ? "レコードを作成" : "Create Record"
                : isJa ? "変更を保存" : "Save Changes"}
            </span>
          </button>
        </div>
      </div>

      {previewImage && (
        <SensorDevicePhotoPreviewModal
          preview={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>,
    document.body
  );
}
