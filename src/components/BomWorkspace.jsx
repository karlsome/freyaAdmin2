import React, { useState, useEffect } from 'react';
import { fetchMasterPage, query } from '../services/api';
import BomEditModal from './BomEditModal';
import MaterialDetailModal from './MaterialDetailModal';
import PaginationControls from './PaginationControls';

export default function BomWorkspace({ initialSearch = "", initialCreateHinban = "", onFlash }) {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Search
  const [searchQuery, setSearchQuery] = useState(initialSearch || "");
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch || "");

  useEffect(() => {
    if (initialCreateHinban) {
      setSelectedBom(null);
      setEditModalOpen(true);
    }
  }, [initialCreateHinban]);

  useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
      setDebouncedSearch(initialSearch);
      setCurrentPage(1);
    }
  }, [initialSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // View state
  const [selectedBom, setSelectedBom] = useState(null);
  
  // Ingredient Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalData, setDetailModalData] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize]);

  useEffect(() => {
    loadPage(currentPage);
  }, [currentPage, debouncedSearch, pageSize]);

  async function loadPage(page) {
    setLoading(true);
    try {
      const res = await fetchMasterPage({ 
        tabKey: 'bomDB', 
        page, 
        limit: pageSize,
        searchFields: ['品番'],
        searchTags: debouncedSearch ? [debouncedSearch] : [],
        sort: { column: '品番', direction: 1 }
      });
      const dataList = res.data || [];
      setBoms(dataList);
      setTotalPages(res.totalPages || 1);

      // If there's an active search or initialSearch, auto-select matching BOM
      if (dataList.length > 0) {
        const queryNorm = (debouncedSearch || initialSearch || '').trim().toLowerCase();
        if (queryNorm) {
          const match = dataList.find(b => (b['品番'] || '').toLowerCase() === queryNorm) ||
                        dataList.find(b => (b['品番'] || '').toLowerCase().includes(queryNorm)) ||
                        dataList[0];
          setSelectedBom(match);
        } else if (!selectedBom) {
          setSelectedBom(dataList[0]);
        }
      } else {
        setSelectedBom(null);
      }
    } catch (err) {
      console.error(err);
      if (onFlash) onFlash({ type: "error", message: "Failed to load BOMs" });
    } finally {
      setLoading(false);
    }
  }

  async function handleIngredientClick(hinban) {
    if (!hinban || hinban === 'N/A') return;
    try {
      let res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", { "品番": hinban });
      let data = Array.isArray(res) ? res[0] : res?.data?.[0];
      if (!data) {
        res = await query("Sasaki_Coating_MasterDB", "masterDB", { "品番": hinban });
        data = Array.isArray(res) ? res[0] : res?.data?.[0];
      }
      if (data) {
        setDetailModalData(data);
        setDetailModalOpen(true);
      } else {
        if (onFlash) onFlash({ type: "warning", message: "Master data not found for " + hinban });
      }
    } catch (err) {
      console.error(err);
      if (onFlash) onFlash({ type: "error", message: "Error fetching material details" });
    }
  }

  return (
    <div className="dashboard-section rounded-2xl px-6 py-6 h-full flex flex-col gap-6 animate-[fadeIn_0.15s_ease-out]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-on-surface">BOM Management</h2>
        <button 
          onClick={() => { setSelectedBom(null); setEditModalOpen(true); }}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          Create New BOM
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* Left Pane: BOM List */}
        <div className="w-1/3 bg-surface-variant/10 border border-outline-variant/30 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-outline-variant/30 bg-surface-variant/20 flex flex-col gap-3">
            <div className="flex items-center justify-between font-bold text-on-surface text-sm">
              <span>BOM List</span>
              {loading && <span className="material-symbols-outlined animate-spin text-outline" style={{ fontSize: 16 }}>progress_activity</span>}
            </div>
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 18 }}>search</span>
              <input 
                type="text" 
                placeholder="Search 品番..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-variant/30 border border-outline-variant/50 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {boms.map((bom, idx) => {
              const isSelected = selectedBom && (selectedBom._id?.$oid || selectedBom._id) === (bom._id?.$oid || bom._id);
              return (
                <button
                  key={bom._id?.$oid || idx}
                  onClick={() => setSelectedBom(bom)}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors border ${
                    isSelected 
                      ? 'bg-primary/10 border-primary/30 text-primary' 
                      : 'bg-surface border-transparent hover:bg-surface-variant/30 text-on-surface hover:border-outline-variant/30'
                  }`}
                >
                  <div className="truncate">{bom['品番']}</div>
                  <div className="text-[10px] text-outline mt-1 font-normal">
                    {bom.BOM?.length || 0} process steps
                  </div>
                </button>
              );
            })}
            {!loading && boms.length === 0 && (
              <div className="text-center p-4 text-xs text-outline">No BOMs found.</div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 0 && (
            <div className="p-4 border-t border-outline-variant/30 flex flex-col gap-4 bg-surface-variant/10">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline whitespace-nowrap">Rows per page</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-surface border border-outline-variant/50 rounded text-xs px-2 py-1 focus:outline-none"
                  >
                    {[30, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
                
                <PaginationControls
                  page={currentPage}
                  totalPages={totalPages || 1}
                  onPageChange={setCurrentPage}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: BOM Details */}
        <div className="flex-1 bg-surface-variant/10 border border-outline-variant/30 rounded-xl flex flex-col overflow-hidden relative">
          {selectedBom ? (
            <>
              <div className="p-6 border-b border-outline-variant/30 bg-surface-variant/20 flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-outline uppercase tracking-wider mb-1">Target Material (Parent)</div>
                  <h3 className="text-2xl font-bold text-on-surface">{selectedBom['品番']}</h3>
                </div>
                <button 
                  onClick={() => setEditModalOpen(true)}
                  className="flex items-center gap-1 text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                  Edit
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="text-sm font-bold text-outline uppercase tracking-wider mb-4">Ingredients & Processes</div>
                <div className="space-y-4">
                  {(!selectedBom.BOM || selectedBom.BOM.length === 0) ? (
                    <div className="text-center p-8 border border-dashed border-outline-variant/50 rounded-xl text-outline text-sm">
                      No processes defined for this BOM.
                    </div>
                  ) : (
                    selectedBom.BOM.map((step, sIdx) => {
                      const hinban = step['構成品番'];
                      const isClickable = hinban && hinban !== 'N/A';
                      
                      const procName = step['工程名'] || '';
                      const procCode = step['工程コード'];
                      const processDisplay = procName && procCode 
                        ? `${procName} - ${procCode}` 
                        : (procName || (procCode ? `Process ${procCode}` : `Step ${sIdx + 1}`));

                      const rawProdUnit = step['生産単位'];
                      const prodUnitName = typeof rawProdUnit === 'object' 
                        ? (rawProdUnit?.name || rawProdUnit?.code || '') 
                        : String(rawProdUnit || '');
                      const timeOption = step['時間オプション'];
                      const kataban = step['型番'];

                      return (
                        <div key={sIdx} className="bg-surface border border-outline-variant/30 rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40"></div>
                          <div className="flex-1 pl-2">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                Step {step['工程番号'] || sIdx + 1}
                              </span>
                              <span className="font-bold text-on-surface text-sm md:text-base">
                                {processDisplay}
                              </span>
                              {timeOption && (
                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20" title={`時間オプション: ${timeOption}`}>
                                  {timeOption}
                                </span>
                              )}
                              {kataban && kataban !== '*' && (
                                <span className="text-xs font-semibold text-on-surface/80 bg-surface-variant/40 px-2 py-0.5 rounded" title={`型番: ${kataban}`}>
                                  {kataban}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-outline flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-2">
                              <span><strong className="text-on-surface-variant">Lead Time:</strong> {step['作業リード日'] || 0}d</span>
                              <span><strong className="text-on-surface-variant">Setup:</strong> {step['段取時間'] || 0}m</span>
                              <span>
                                <strong className="text-on-surface-variant">Work:</strong> {step['作業時間'] || 0}s/{prodUnitName || 'unit'}
                              </span>
                              {prodUnitName && (
                                <span>
                                  <strong className="text-on-surface-variant">生産単位:</strong> {prodUnitName}
                                </span>
                              )}
                              {timeOption && (
                                <span>
                                  <strong className="text-on-surface-variant">時間オプション:</strong> {timeOption}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 border-t md:border-t-0 md:border-l border-outline-variant/30 pt-3 md:pt-0 md:pl-4">
                            <div className="text-[10px] font-bold uppercase text-outline mb-1">Material Used (構成品番)</div>
                            {isClickable ? (
                              <button 
                                onClick={() => handleIngredientClick(hinban)}
                                className="text-sm font-bold text-primary hover:underline flex items-center gap-1 text-left cursor-pointer"
                              >
                                {hinban}
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                              </button>
                            ) : (
                              <span className="text-sm text-outline italic">No material specified</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-outline">
              <span className="material-symbols-outlined mb-2 opacity-50" style={{ fontSize: 48 }}>account_tree</span>
              <p className="text-sm font-medium">Select a BOM from the left to view details</p>
            </div>
          )}
        </div>
      </div>

      {editModalOpen && (
        <BomEditModal 
          key={selectedBom?._id?.$oid || selectedBom?._id || initialCreateHinban || 'new'}
          existingBom={selectedBom}
          initialHinban={initialCreateHinban}
          onClose={() => setEditModalOpen(false)}
          onSaved={() => {
            setEditModalOpen(false);
            loadPage(currentPage);
          }}
          onEditExisting={(existing) => {
            setSelectedBom(existing);
          }}
          onFlash={onFlash}
        />
      )}

      {detailModalOpen && detailModalData && (
        <MaterialDetailModal 
          modalData={detailModalData} 
          onClose={() => { setDetailModalOpen(false); setDetailModalData(null); }} 
        />
      )}
    </div>
  );
}
