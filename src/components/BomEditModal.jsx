import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { query, createMasterRecord, updateMasterRecord } from '../services/api';

function AsyncHinbanSelect({ value, onChange, placeholder = "Search 品番...", disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = React.useRef(null);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const regexQuery = { "品番": { "$regex": search, "$options": "i" } };
        // Fetch up to 20 from both DBs
        const [masterRes, materialRes] = await Promise.all([
          query("Sasaki_Coating_MasterDB", "masterDB", search ? regexQuery : {}, { limit: 20 }),
          query("Sasaki_Coating_MasterDB", "materialMasterDB3", search ? regexQuery : {}, { limit: 20 })
        ]);
        
        if (!active) return;
        
        let mData = Array.isArray(masterRes) ? masterRes : (masterRes?.data || []);
        let matData = Array.isArray(materialRes) ? materialRes : (materialRes?.data || []);
        
        const combined = [...mData, ...matData];
        // Deduplicate by 品番
        const unique = [];
        const seen = new Set();
        for (const item of combined) {
          if (!seen.has(item['品番'])) {
            seen.add(item['品番']);
            unique.push(item);
          }
        }
        setOptions(unique.slice(0, 30));
      } catch (err) {
        if (active) console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, isOpen]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        disabled={disabled}
        className="w-full bg-surface border border-outline-variant/50 rounded-lg px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          // If they clear the input, clear the value
          if (e.target.value === "") onChange(null, "");
        }}
        onFocus={() => setIsOpen(true)}
      />
      
      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-1 bg-surface border border-outline-variant/50 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-outline text-center">Searching...</div>
          ) : options.length > 0 ? (
            options.map((opt, i) => (
              <div 
                key={i}
                className="px-3 py-2 text-sm hover:bg-surface-variant/30 cursor-pointer flex flex-col"
                onClick={() => {
                  onChange(opt, opt['品番']);
                  setSearch(opt['品番']);
                  setIsOpen(false);
                }}
              >
                <span className="font-bold">{opt['品番']}</span>
                {opt['品名'] && <span className="text-[10px] text-outline">{opt['品名']}</span>}
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-outline text-center">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BomEditModal({ existingBom, onClose, onSaved, onEditExisting, onFlash }) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Data for selectors
  const [processes, setProcesses] = useState([]);

  // Form state
  const [saving, setSaving] = useState(false);
  
  const [targetHinban, setTargetHinban] = useState(existingBom?.['品番'] || "");
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
        const proc = processes.find(p => p['工程コード'] === Number(value));
        if (proc) {
          step['工程コード'] = proc['工程コード'];
          step['工程名'] = proc['工程名'] || '';
          step['工程略名'] = proc['工程略名'] || '';
        }
      } else if (field === "materialSelect") {
        if (!value) {
          step['構成品番'] = "";
          step['構成品_id'] = null;
        } else {
          step['構成品番'] = value['品番'];
          step['構成品_id'] = value._id;
          
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-[fadeIn_0.15s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30 bg-surface-variant/20">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{isEdit ? "Edit BOM" : "Create New BOM"}</h2>
            <p className="text-sm text-outline mt-1">Configure processes and child materials</p>
          </div>
          <button 
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors"
          >
            <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {loadingInitial ? (
            <div className="flex items-center justify-center py-10 text-outline">
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
              Loading master data...
            </div>
          ) : (
            <>
              {/* Target Material Selector */}
              <div className="bg-surface-variant/30 border border-outline-variant/30 rounded-xl p-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-outline mb-2">
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-outline">Process Steps</h3>
                </div>

                <div className="flex flex-col gap-4">
                  {bomSteps.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-outline-variant/50 rounded-xl text-outline text-sm">
                      No process steps added yet. Click "Add Step" to begin.
                    </div>
                  ) : (
                    bomSteps.map((step, index) => (
                      <div 
                        key={index} 
                        className="bg-surface border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden relative transition-all duration-200 hover:border-primary/50"
                        draggable
                        onDragStart={(e) => (dragItem.current = index)}
                        onDragEnter={(e) => (dragOverItem.current = index)}
                        onDragEnd={handleSort}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <div className="bg-surface-variant/20 px-4 py-2 border-b border-outline-variant/30 flex items-center justify-between cursor-move">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-outline hover:text-primary transition-colors text-lg">drag_indicator</span>
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded pointer-events-none">
                              Step {index + 1}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleRemoveStep(index)}
                            className="text-error/70 hover:text-error hover:bg-error/10 p-1 rounded transition-colors"
                            title="Remove Step"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        </div>
                        
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Process Selection */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-outline mb-1">Process (工程)</label>
                            <select 
                              className="w-full bg-surface-variant/10 border border-outline-variant/50 rounded md px-3 py-1.5 text-sm"
                              value={step['工程コード'] || ""}
                              onChange={e => handleStepChange(index, 'processSelect', e.target.value)}
                            >
                              <option value="">-- Select Process --</option>
                              {processes.map(p => (
                                <option key={p['工程コード']} value={p['工程コード']}>
                                  {p['工程コード']} - {p['工程名']}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Material Selection */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-outline mb-1">Child Material (構成品番)</label>
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
                              <label className="block text-[10px] uppercase text-outline mb-1">作業時間 (Work)</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={step['作業時間'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-outline mb-1">段取時間 (Setup)</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={step['段取時間'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-outline mb-1">型番 (Model)</label>
                              <input 
                                type="text" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={step['型番'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-outline mb-1">時間オプション</label>
                              <input 
                                type="text" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed font-mono font-bold"
                                value={step['時間オプション'] ?? ""}
                              />
                            </div>
                          </div>

                          {/* Numeric Inputs Row 2 */}
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[9px] uppercase text-outline mb-1 whitespace-nowrap">生産単位</label>
                              <input 
                                type="text" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={typeof step['生産単位'] === 'object' ? `${step['生産単位']?.name || ''} (${step['生産単位']?.code ?? ''})` : (step['生産単位'] ?? "")}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase text-outline mb-1 whitespace-nowrap">原単位</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={step['原単位'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase text-outline mb-1 whitespace-nowrap">製品原単位</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={step['製品原単位'] ?? ""}
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase text-outline mb-1 whitespace-nowrap">リード日</label>
                              <input 
                                type="number" 
                                readOnly
                                className="w-full bg-surface-variant/30 border border-outline-variant/30 rounded md px-2 py-1 text-sm text-outline focus:outline-none cursor-not-allowed"
                                value={step['作業リード日'] ?? ""}
                              />
                            </div>
                          </div>

                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Add Step Button */}
                  <div className="flex justify-center mt-2 pb-4">
                    <button 
                      onClick={handleAddStep}
                      className="flex items-center gap-2 rounded-full bg-surface border border-primary/30 px-6 py-2.5 text-sm font-bold text-primary hover:bg-primary/10 transition-colors shadow-sm w-full md:w-auto md:min-w-[200px] justify-center"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                      Add Step {bomSteps.length > 0 && `(Step ${bomSteps.length + 1})`}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-outline-variant/30 bg-surface flex justify-end gap-3 mt-auto">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-outline hover:text-on-surface hover:bg-surface-variant/30 rounded-full transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || loadingInitial || !targetHinban}
            className="px-6 py-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
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
