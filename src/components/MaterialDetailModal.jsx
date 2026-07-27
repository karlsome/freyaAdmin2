import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { query } from "../services/api";

export default function MaterialDetailModal({ modalData, onClose }) {
  const [nestedMaterialData, setNestedMaterialData] = useState(null);
  const [loadingNested, setLoadingNested] = useState(false);
  const [bomData, setBomData] = useState(modalData?.['BOM'] || null);

  useEffect(() => {
    if (modalData && !modalData['BOM'] && modalData['品番']) {
      query("Sasaki_Coating_MasterDB", "bomMasterDB", { "品番": modalData['品番'] })
        .then(res => {
          if (Array.isArray(res) && res.length > 0) {
            setBomData(res[0].BOM);
          } else if (res && res.data && res.data.length > 0) {
            setBomData(res.data[0].BOM);
          }
        })
        .catch(console.error);
    } else if (modalData?.['BOM']) {
      setBomData(modalData['BOM']);
    }
  }, [modalData]);

  async function handleMaterialClick(materialHinban) {
    if (!materialHinban || materialHinban === 'N/A') return;
    setLoadingNested(true);
    try {
      const res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", { "品番": materialHinban });
      if (Array.isArray(res) && res.length > 0) {
        setNestedMaterialData(res[0]);
      } else if (res && res.data && res.data.length > 0) {
        setNestedMaterialData(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNested(false);
    }
  }

  if (!modalData) return null;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/30 bg-surface-variant/20">
              <div>
                <h2 className="text-xl font-bold text-on-surface">{modalData['品番']}</h2>
                <p className="text-sm text-outline mt-1">{modalData['品目マスタ']?.['品名']}</p>
              </div>
              <button 
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors"
              >
                <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* Bom Info - clickable to open material sub-modal */}
              {(() => {
                const bomEntry = bomData?.find(b => b['工程コード'] === 1010);
                const materialHinban = bomEntry?.['構成品番'] || 'N/A';
                const isClickable = materialHinban !== 'N/A';
                return (
                  <button 
                    onClick={() => isClickable && handleMaterialClick(materialHinban)}
                    disabled={!isClickable || loadingNested}
                    className={`w-full rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between text-left transition-colors ${isClickable ? 'hover:bg-primary/10 cursor-pointer' : 'cursor-default'} ${loadingNested ? 'opacity-70' : ''}`}
                  >
                    <div>
                      <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">構成品番 (Material)</div>
                      <div className="font-medium text-on-surface">{materialHinban}</div>
                    </div>
                    {isClickable && (
                      <div className="flex items-center gap-2 text-primary">
                        <span className="text-[10px] font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                          {loadingNested ? "Loading..." : "View details"}
                        </span>
                        <span className="material-symbols-outlined" style={{fontSize: 20}}>
                          {loadingNested ? "hourglass_empty" : "open_in_new"}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })()}

              {/* Segments Info */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">品番構造 (Structure)</div>
                <div className="flex flex-wrap gap-2">
                  {modalData['品番構造']?.segments?.map((s, i) => {
                     const name = s.name || s['得意先'] || s['入出荷先'];
                     if (!name) return null;
                     return (
                       <div key={i} className="flex flex-col bg-surface-variant/30 border border-outline-variant/50 rounded-lg px-3 py-2 text-sm">
                         <span className="text-[10px] text-outline">{s.segment}</span>
                         <span className="font-medium text-on-surface">{name}</span>
                       </div>
                     );
                  })}
                </div>
              </div>

              {/* Process Data */}
              {(() => {
                const process2010 = bomData?.find(b => b['工程コード'] === 2010);
                if (!process2010) return null;
                return (
                  <div>
                    <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">工程データ (Process Data - 2010)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">作業時間 (Work Time)</span>
                        <span className="font-medium text-sm text-primary">{process2010['作業時間'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">段取時間 (Setup Time)</span>
                        <span className="font-medium text-sm text-primary">{process2010['段取時間'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">型番 (Model)</span>
                        <span className="font-medium text-sm text-primary">{process2010['型番'] ?? 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Master Data Grid */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">Master Data</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">梱包数 (Pack Qty)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['梱包数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">生産単位数 (Prod Unit)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['生産単位数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">発注ロット数 (Order Lot)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['発注ロット数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">品目区分 (Category)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['品目区分'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">出荷先名 (Shipping Dest)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['出荷先名'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">受注先コード (Customer Code)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['受注先コード'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">図番 (Drawing No.)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['図番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">仕様 (Specs)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['仕様'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">型番 (Model)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['型番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">速度 (Speed)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['速度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">ライン形態 (Line Form)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ライン形態'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">繰出機 (Unwinder)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['繰出機'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">接着剤有無 (Adhesive)</span>
                    <span className="font-medium text-sm text-on-surface">
                      {modalData['品目マスタ']?.['接着剤有無'] === 1 ? '有 (Yes)' : modalData['品目マスタ']?.['接着剤有無'] === 2 ? '無 (No)' : modalData['品目マスタ']?.['接着剤有無'] ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">クリーン度 (Cleanliness)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['クリーン度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">乾燥温度 (Dry Temp)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['乾燥温度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">ロール温度 (Roll Temp)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ロール温度'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">基材厚 (Base Thick)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材厚'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">基材幅 (Base Width)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材幅'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">基材長 (Base Length)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材長'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着剤厚 (Adhesive Thick)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤厚'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着剤幅 (Adhesive Width)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤幅'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着剤長 (Adhesive Length)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤長'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着倍率 (Adhesive Ratio)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着倍率'] || 'N/A'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Material Sub-Modal (on top of main modal) */}
      {nestedMaterialData && (() => {
        const materialDetail = nestedMaterialData;
        const bomEntry = bomData?.find(b => b['工程コード'] === 1010);
        
        return createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setNestedMaterialData(null)}>
            <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-[fadeIn_0.15s_ease-out]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-outline-variant/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary" style={{fontSize: 24}}>inventory_2</span>
                  <div>
                    <h3 className="text-xl font-bold text-on-surface">{materialDetail['品番']}</h3>
                    <p className="text-sm text-outline mt-1">{materialDetail['品目マスタ']?.['品名']} — {materialDetail['品目マスタ']?.['仕様']}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setNestedMaterialData(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors"
                >
                  <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
                </button>
              </div>
              
              {/* Body */}
              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
                {/* Material Structure */}
                {materialDetail['品番構造']?.segments && (
                  <div>
                    <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">材料品番構造 (Material Structure)</div>
                    <div className="flex flex-wrap gap-2">
                      {materialDetail['品番構造'].segments.map((s, i) => {
                        const name = s.name || s['得意先'] || s['入出荷先'];
                        if (!name) return null;
                        return (
                          <div key={i} className="flex flex-col bg-surface-variant/30 border border-outline-variant/50 rounded-lg px-3 py-2 text-sm">
                            <span className="text-[10px] text-outline">{s.segment}</span>
                            <span className="font-medium text-on-surface">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Material Master Data */}
                <div>
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">材料マスタ (Material Master)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">品目区分 (Category)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['品目区分'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">手配先コード (Supplier)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['手配先コード'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">生産単位数 (Prod Unit)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['生産単位数'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">発注ロット数 (Order Lot)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['発注ロット数'] || 'N/A'}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">出荷先名 (Shipping Dest)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['出荷先名'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">仕様 (Specs)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['仕様'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">型番 (Model)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['型番'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">接着剤有無 (Adhesive)</span>
                      <span className="font-medium text-sm text-on-surface">
                        {materialDetail['品目マスタ']?.['接着剤有無'] === 1 ? '有 (Yes)' : materialDetail['品目マスタ']?.['接着剤有無'] === 2 ? '無 (No)' : materialDetail['品目マスタ']?.['接着剤有無'] ?? 'N/A'}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">基材厚 (Base Thick)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材厚'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">基材幅 (Base Width)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材幅'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">基材長 (Base Length)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材長'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着剤厚 (Adhesive Thick)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤厚'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着剤幅 (Adhesive Width)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤幅'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着剤長 (Adhesive Length)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤長'] ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* BOM Process Info */}
                <div className="bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">工程情報 (Process Info — 1010)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">工程名</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['工程名'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">段取時間</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['段取時間'] || 0} min</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">作業時間</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['作業時間'] || 0} sec/cm</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">原単位</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['原単位'] || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
