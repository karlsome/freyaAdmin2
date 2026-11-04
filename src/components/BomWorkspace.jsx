import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchMasterPage, query } from '../services/api';
import BomEditModal from './BomEditModal';
import MaterialDetailModal from './MaterialDetailModal';
import PaginationControls from './PaginationControls';

export default function BomWorkspace({ initialSearch = "", initialCreateHinban = "", onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

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
      if (onFlash) onFlash({ type: "error", message: isJa ? "BOMの取得に失敗しました" : "Failed to load BOMs" });
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
        if (onFlash) onFlash({ type: "warning", message: isJa ? `品番 ${hinban} のマスターデータが見つかりません` : "Master data not found for " + hinban });
      }
    } catch (err) {
      console.error(err);
      if (onFlash) onFlash({ type: "error", message: isJa ? "材料詳細の取得エラー" : "Error fetching material details" });
    }
  }

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          {isJa ? "部品構成表 (BOM) 管理" : "BOM Management"}
        </h2>
        <button 
          onClick={() => { setSelectedBom(null); setEditModalOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          {isJa ? "新規BOM作成" : "Create New BOM"}
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* Left Pane: BOM List */}
        <div className="w-1/3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-[var(--border)] bg-[var(--surface-subtle)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between font-bold text-[var(--text-primary)] text-xs">
              <span className="uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "BOM一覧" : "BOM List"}
              </span>
              {loading && <span className="material-symbols-outlined animate-spin text-[var(--text-muted)]" style={{ fontSize: 16 }}>progress_activity</span>}
            </div>
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
              <input 
                type="text" 
                placeholder={isJa ? "品番を検索..." : "Search 品番..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)] transition-colors"
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
                  className={`w-full text-left px-3 py-2 rounded-[6px] text-xs font-medium transition-colors border ${
                    isSelected 
                      ? 'border-[var(--freya-blue)]/40 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]' 
                      : 'border-transparent bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] hover:border-[var(--border)]'
                  }`}
                >
                  <div className="truncate font-semibold">{bom['品番']}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 font-normal">
                    {bom.BOM?.length || 0} {isJa ? "工程ステップ" : "process steps"}
                  </div>
                </button>
              );
            })}
            {!loading && boms.length === 0 && (
              <div className="text-center p-4 text-xs text-[var(--text-muted)]">
                {isJa ? "BOMが見つかりません。" : "No BOMs found."}
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 0 && (
            <div className="p-3 border-t border-[var(--border)] flex flex-col gap-2 bg-[var(--surface-subtle)]">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] whitespace-nowrap">
                    {isJa ? "表示件数" : "Rows"}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)]"
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
        <div className="flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden shadow-2xs relative">
          {selectedBom ? (
            <>
              <div className="p-5 border-b border-[var(--border)] bg-[var(--surface-subtle)] flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.14em] mb-1">
                    {isJa ? "親品番 (完成品・中間品)" : "Target Material (Parent)"}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{selectedBom['品番']}</h3>
                </div>
                <button 
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  {isJa ? "編集" : "Edit"}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.14em] mb-3">
                  {isJa ? "構成品および工程" : "Ingredients & Processes"}
                </div>
                <div className="space-y-3">
                  {(!selectedBom.BOM || selectedBom.BOM.length === 0) ? (
                    <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-[8px] text-[var(--text-muted)] text-xs">
                      {isJa ? "このBOMには工程が定義されていません。" : "No processes defined for this BOM."}
                    </div>
                  ) : (
                    selectedBom.BOM.map((step, sIdx) => {
                      const hinban = step['構成品番'];
                      const isClickable = hinban && hinban !== 'N/A';
                      
                      const procName = step['工程名'] || '';
                      const procCode = step['工程コード'];
                      const processDisplay = procName && procCode 
                        ? `${procName} - ${procCode}` 
                        : (procName || (procCode ? (isJa ? `工程 ${procCode}` : `Process ${procCode}`) : (isJa ? `ステップ ${sIdx + 1}` : `Step ${sIdx + 1}`)));

                      const rawProdUnit = step['生産単位'];
                      const prodUnitName = typeof rawProdUnit === 'object' 
                        ? (rawProdUnit?.name || rawProdUnit?.code || '') 
                        : String(rawProdUnit || '');
                      const timeOption = step['時間オプション'];
                      const kataban = step['型番'];

                      return (
                        <div key={sIdx} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--freya-blue)]"></div>
                          <div className="flex-1 pl-2">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-[var(--freya-blue)] bg-[var(--freya-blue)]/10 px-2 py-0.5 rounded-[4px] border border-[var(--freya-blue)]/20">
                                {isJa ? `工程 ${step['工程番号'] || sIdx + 1}` : `Step ${step['工程番号'] || sIdx + 1}`}
                              </span>
                              <span className="font-bold text-[var(--text-primary)] text-xs md:text-sm">
                                {processDisplay}
                              </span>
                              {timeOption && (
                                <span className="font-mono text-xs font-bold text-[var(--freya-blue)] bg-[var(--freya-blue)]/10 px-2 py-0.5 rounded-[4px] border border-[var(--freya-blue)]/20" title={`時間オプション: ${timeOption}`}>
                                  {timeOption}
                                </span>
                              )}
                              {kataban && kataban !== '*' && (
                                <span className="text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-subtle)] border border-[var(--border)] px-2 py-0.5 rounded-[4px]" title={`型番: ${kataban}`}>
                                  {kataban}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-2">
                              <span><strong className="text-[var(--text-secondary)] font-semibold">{isJa ? "リード日:" : "Lead Time:"}</strong> {step['作業リード日'] || 0}d</span>
                              <span><strong className="text-[var(--text-secondary)] font-semibold">{isJa ? "段取時間:" : "Setup:"}</strong> {step['段取時間'] || 0}m</span>
                              <span>
                                <strong className="text-[var(--text-secondary)] font-semibold">{isJa ? "作業時間:" : "Work:"}</strong> {step['作業時間'] || 0}s/{prodUnitName || (isJa ? "単位" : "unit")}
                              </span>
                              {prodUnitName && (
                                <span>
                                  <strong className="text-[var(--text-secondary)] font-semibold">{isJa ? "生産単位:" : "生産単位:"}</strong> {prodUnitName}
                                </span>
                              )}
                              {timeOption && (
                                <span>
                                  <strong className="text-[var(--text-secondary)] font-semibold">{isJa ? "時間オプション:" : "時間オプション:"}</strong> {timeOption}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 border-t md:border-t-0 md:border-l border-[var(--border)] pt-3 md:pt-0 md:pl-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-1">
                              {isJa ? "使用原材料 (構成品番)" : "Material Used (構成品番)"}
                            </div>
                            {isClickable ? (
                              <button 
                                onClick={() => handleIngredientClick(hinban)}
                                className="text-xs font-bold text-[var(--freya-blue)] hover:underline flex items-center gap-1 text-left cursor-pointer"
                              >
                                {hinban}
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)] italic">
                                {isJa ? "原材料未指定" : "No material specified"}
                              </span>
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
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
              <span className="material-symbols-outlined mb-2 opacity-50" style={{ fontSize: 44 }}>account_tree</span>
              <p className="text-xs font-medium">
                {isJa ? "左側の一覧からBOMを選択して詳細を表示" : "Select a BOM from the left to view details"}
              </p>
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
