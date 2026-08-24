import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { query } from "../services/api";
import { useLanguage } from '../contexts/LanguageContext';

export default function MaterialDetailModal({ modalData, onClose }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [nestedMaterialData, setNestedMaterialData] = useState(null);
  const [loadingNested, setLoadingNested] = useState(false);
  const [bomData, setBomData] = useState(modalData?.['BOM'] || null);
  const [zoomImage, setZoomImage] = useState(null);

  const mainImageUrl = modalData?.['品目マスタ']?.['imageURL'] || modalData?.['imageURL'] || modalData?.imageURL;

  const handleShowBom = (hinban) => {
    if (!hinban) return;
    if (onClose) onClose();
    navigate(`/masterDB?tab=bomDB&search=${encodeURIComponent(hinban)}`);
  };

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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/30 bg-surface-variant/20">
              <div>
                <h2 className="text-xl font-bold text-on-surface">{modalData['品番']}</h2>
                <p className="text-sm text-outline mt-1">{modalData['品目マスタ']?.['品名'] || modalData['品名']}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleShowBom(modalData['品番'])}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 cursor-pointer shadow-xs"
                  title={language === 'ja' ? 'BOM DBでこの品番を表示' : 'Show BOM in BOM DB tab'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_tree</span>
                  <span>{language === 'ja' ? 'BOMを表示' : 'Show BOM'}</span>
                </button>
                <button 
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors cursor-pointer"
                  title={t('ff_close')}
                >
                  <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* Image Preview if available */}
              {mainImageUrl && (
                <div 
                  onClick={() => setZoomImage({ url: mainImageUrl, title: modalData['品番'] })}
                  className="group relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-variant/20 flex items-center justify-center p-3 cursor-zoom-in hover:border-primary/40 hover:bg-surface-variant/30 transition-all shadow-xs"
                >
                  <img 
                    src={mainImageUrl} 
                    alt={modalData['品番']} 
                    className="max-h-56 w-auto object-contain rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-[1.02]" 
                  />
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-xs text-white rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>zoom_in</span>
                    <span>{language === 'ja' ? '拡大表示' : 'Zoom'}</span>
                  </div>
                </div>
              )}

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
                      <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">
                        {language === 'ja' ? '構成品番 (原材料)' : 'Material Hinban (BOM)'}
                      </div>
                      <div className="font-medium text-on-surface">{materialHinban}</div>
                    </div>
                    {isClickable && (
                      <div className="flex items-center gap-2 text-primary">
                        <span className="text-[10px] font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                          {loadingNested ? t('ff_loading') : t('ff_viewDetails')}
                        </span>
                        <span className="material-symbols-outlined" style={{fontSize: 20}}>
                          {loadingNested ? "hourglass_empty" : "open_in_new"}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })()}

              {/* Resolved Master Codes */}
              {modalData['resolved'] && Object.keys(modalData['resolved']).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">
                    {language === 'ja' ? 'マスター解決情報 (Resolved Codes)' : 'Resolved Master Codes'}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {Object.entries(modalData['resolved']).map(([key, val]) => {
                      const displayVal = typeof val === 'object' && val !== null 
                        ? (val.name ? `${val.code != null ? `${val.code} - ` : ''}${val.name}` : (val.code ?? JSON.stringify(val)))
                        : String(val ?? '');
                      return (
                        <div key={key} className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-xl p-3">
                          <span className="text-[10px] font-bold text-outline uppercase tracking-wide">{key}</span>
                          <span className="font-semibold text-xs text-on-surface mt-1">{displayVal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Segments Info */}
              {modalData['品番構造']?.segments && (
                <div>
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">{t('ff_materialHinbanStructure')}</div>
                  <div className="flex flex-wrap gap-2">
                    {modalData['品番構造'].segments.map((s, i) => {
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

              {/* Process Data */}
              {(() => {
                const process2010 = bomData?.find(b => b['工程コード'] === 2010);
                if (!process2010) return null;
                return (
                  <div>
                    <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">{t('ff_processData')} (2010)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">{t('ff_workTime')}</span>
                        <span className="font-medium text-sm text-primary">{process2010['作業時間'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">{t('ff_setupTime')}</span>
                        <span className="font-medium text-sm text-primary">{process2010['段取時間'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">{t('ff_modelNumber')}</span>
                        <span className="font-medium text-sm text-primary">{process2010['型番'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">{t('ff_timeOption')}</span>
                        <span className="font-medium text-sm text-primary">{process2010['時間オプション'] ?? 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Master Data Grid */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">{t('ff_materialMasterInfo')}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_labelHinban')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ラベル品番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_packQty')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['梱包数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_prodUnit')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['生産単位数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_orderLot')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['発注ロット数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_category')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['品目区分'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_shippingDest')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['出荷先名'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_customerCode')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['受注先コード'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_drawingNo')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['図番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_specs')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['仕様'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_modelNumber')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['型番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_speed')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['速度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_lineForm')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ライン形態'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_unwinder')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['繰出機'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_adhesive')}</span>
                    <span className="font-medium text-sm text-on-surface">
                      {modalData['品目マスタ']?.['接着剤有無'] === 1 ? t('ff_yes') : modalData['品目マスタ']?.['接着剤有無'] === 2 ? t('ff_no') : modalData['品目マスタ']?.['接着剤有無'] ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_cleanliness')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['クリーン度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_dryTemp')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['乾燥温度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_rollTemp')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ロール温度'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_baseThick')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材厚'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_baseWidth')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材幅'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_baseLength')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材長'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_adhesiveThick')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤厚'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_adhesiveWidth')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤幅'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_adhesiveLength')}</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤長'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">{t('ff_adhesiveRatio')}</span>
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
                    <p className="text-sm text-outline mt-1">{materialDetail['品目マスタ']?.['品名'] || materialDetail['品名']} — {materialDetail['品目マスタ']?.['仕様'] || materialDetail['仕様']}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleShowBom(materialDetail['品番'])}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 cursor-pointer shadow-xs"
                    title={language === 'ja' ? 'BOM DBでこの品番を表示' : 'Show BOM in BOM DB tab'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_tree</span>
                    <span>{language === 'ja' ? 'BOMを表示' : 'Show BOM'}</span>
                  </button>
                  <button 
                    onClick={() => setNestedMaterialData(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors cursor-pointer"
                    title={t('ff_close')}
                  >
                    <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
                  </button>
                </div>
              </div>
              
              {/* Body */}
              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
                {/* Nested Material Image */}
                {(() => {
                  const nestedImageUrl = materialDetail?.['品目マスタ']?.['imageURL'] || materialDetail?.['imageURL'] || materialDetail?.imageURL;
                  if (!nestedImageUrl) return null;
                  return (
                    <div 
                      onClick={() => setZoomImage({ url: nestedImageUrl, title: materialDetail['品番'] })}
                      className="group relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-variant/20 flex items-center justify-center p-3 cursor-zoom-in hover:border-primary/40 hover:bg-surface-variant/30 transition-all shadow-xs"
                    >
                      <img 
                        src={nestedImageUrl} 
                        alt={materialDetail['品番']} 
                        className="max-h-48 w-auto object-contain rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-[1.02]" 
                      />
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-xs text-white rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>zoom_in</span>
                        <span>{language === 'ja' ? '拡大表示' : 'Zoom'}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Material Structure */}
                {materialDetail['品番構造']?.segments && (
                  <div>
                    <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">{t('ff_materialHinbanStructure')}</div>
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
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">{t('ff_materialMaster')}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_category')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['品目区分'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_supplier')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['手配先コード'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_prodUnit')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['生産単位数'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_orderLot')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['発注ロット数'] || 'N/A'}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_shippingDest')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['出荷先名'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_specs')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['仕様'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_modelNumber')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['型番'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_adhesive')}</span>
                      <span className="font-medium text-sm text-on-surface">
                        {materialDetail['品目マスタ']?.['接着剤有無'] === 1 ? t('ff_yes') : materialDetail['品目マスタ']?.['接着剤有無'] === 2 ? t('ff_no') : materialDetail['品目マスタ']?.['接着剤有無'] ?? 'N/A'}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_baseThick')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材厚'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_baseWidth')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材幅'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_baseLength')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材長'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_adhesiveThick')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤厚'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_adhesiveWidth')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤幅'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_adhesiveLength')}</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤長'] ?? 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* BOM Process Info */}
                <div className="bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">{t('ff_processData')} (1010)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_processName')}</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['工程名'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_setupTime')}</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['段取時間'] || 0} {t('ff_minutesShort')}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_workTime')}</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['作業時間'] || 0} sec/cm</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">{t('ff_baseUnit')}</span>
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

      {/* Image Zoom Lightbox */}
      {zoomImage && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomImage.url}
              alt={zoomImage.title || "Material Image"}
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              {zoomImage.title && (
                <span className="text-white font-mono font-bold text-sm bg-black/50 px-3 py-1 rounded-full">
                  {zoomImage.title}
                </span>
              )}
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

