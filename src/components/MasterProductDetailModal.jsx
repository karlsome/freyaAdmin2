import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { query } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import MaterialDetailModal from "./MaterialDetailModal";
import MasterProductEditModal from "./MasterProductEditModal";

export default function MasterProductDetailModal({
  record,
  open,
  saving = false,
  uploading = false,
  onClose,
  onSave,
  onUploadImage,
}) {
  const { t, language } = useLanguage();
  const isJa = language === "ja";
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);
  const fileInputRef = useRef(null);

  // Linked Material State
  const [linkedMaterial, setLinkedMaterial] = useState(null);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [activeMaterialModal, setActiveMaterialModal] = useState(null);

  const materialBackNo = record?.["材料背番号"] || "";
  const materialHinban = record?.["材料品番"] || "";

  useEffect(() => {
    if (!open || !record) {
      setLinkedMaterial(null);
      return;
    }

    const searchKey = materialBackNo || materialHinban;
    if (!searchKey) {
      setLinkedMaterial(null);
      return;
    }

    let cancelled = false;
    setLoadingLinked(true);

    const queryFilter = {
      $or: [
        { "品目マスタ.ラベル品番": searchKey },
        { "ラベル品番": searchKey },
        { "品番": searchKey },
        { "品目マスタ.品番": searchKey },
      ],
    };

    query("Sasaki_Coating_MasterDB", "materialMasterDB3", queryFilter)
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res) ? res[0] : res?.data?.[0];
        setLinkedMaterial(data || null);
      })
      .catch((err) => {
        console.error("Failed to query linked material:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingLinked(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, record, materialBackNo, materialHinban]);

  if (!open || !record) return null;

  const handleOpenMaterialModal = async () => {
    if (linkedMaterial) {
      setActiveMaterialModal(linkedMaterial);
      return;
    }

    const searchKey = materialBackNo || materialHinban;
    if (!searchKey) return;

    setLoadingLinked(true);
    try {
      const res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", {
        $or: [
          { "品目マスタ.ラベル品番": searchKey },
          { "ラベル品番": searchKey },
          { "品番": searchKey },
        ],
      });
      const data = Array.isArray(res) ? res[0] : res?.data?.[0];
      if (data) {
        setLinkedMaterial(data);
        setActiveMaterialModal(data);
      } else {
        alert(
          isJa
            ? `材料DBに該当するレコードが見つかりませんでした (キー: ${searchKey})`
            : `No matching record found in Material DB (Key: ${searchKey})`
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLinked(false);
    }
  };

  const renderValue = (val) => {
    if (val === null || val === undefined || val === "") return "—";
    return String(val);
  };

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
          <div
            className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 md:p-6 border-b border-outline-variant/30 bg-surface-variant/20">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {isJa ? "内装品 DB" : "Product Record"}
                  </span>
                  {record["工場"] && (
                    <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-variant/60 border border-outline-variant/30 px-2 py-0.5 rounded-md">
                      {record["工場"]}
                    </span>
                  )}
                  {record["pickingIOT"] && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        String(record["pickingIOT"]).toLowerCase() === "yes"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-surface-variant/40 text-outline border-outline-variant/30"
                      }`}
                    >
                      IoT: {String(record["pickingIOT"]).toUpperCase()}
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">
                  {record["品番"]}
                </h2>
                <p className="text-xs md:text-sm text-outline mt-0.5">
                  {record["モデル"] && <span className="font-semibold text-on-surface/80 mr-1.5">{record["モデル"]}</span>}
                  {record["背番号"] && <span className="text-primary font-mono font-bold mr-2">[{record["背番号"]}]</span>}
                  {record["品名"] && <span>{record["品名"]}</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  <span>{isJa ? "レコードを編集" : "Edit Record"}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors cursor-pointer"
                  title={t("ff_close")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 md:p-6 overflow-y-auto flex-1 flex flex-col gap-6">

              {/* Product Image Banner */}
              <div className="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-variant/15 flex flex-col items-center justify-center min-h-[160px] max-h-[260px] p-3 group">
                {record.imageURL ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={record.imageURL}
                      alt={record["品番"]}
                      className="max-h-[220px] object-contain rounded-xl cursor-zoom-in shadow-sm hover:scale-[1.02] transition-transform duration-200"
                      onClick={() => setZoomImage(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setZoomImage(true)}
                      className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>zoom_in</span>
                      <span>{isJa ? "拡大" : "Zoom"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-outline py-8">
                    <span className="material-symbols-outlined opacity-40" style={{ fontSize: 40 }}>image_not_supported</span>
                    <span className="text-xs font-medium">{isJa ? "画像が登録されていません" : "No image uploaded"}</span>
                  </div>
                )}

                {/* Upload Button */}
                {onUploadImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onUploadImage(file);
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface/80 backdrop-blur-md px-3 py-1 text-xs font-semibold text-on-surface hover:bg-surface transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {uploading ? "progress_activity" : "upload"}
                      </span>
                      <span>
                        {uploading
                          ? isJa ? "アップロード中…" : "Uploading…"
                          : record.imageURL
                          ? isJa ? "画像を変更" : "Change Image"
                          : isJa ? "画像をアップロード" : "Upload Image"}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* 1. Basic Vehicle & Product Identity */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>directions_car</span>
                  <span>{isJa ? "車両・製品基本情報" : "Vehicle & Product Identity"}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "品番" : "Part Number"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["品番"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "モデル" : "Car Model"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["モデル"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "背番号" : "Back Number"}</span>
                    <span className="font-bold text-sm text-primary mt-0.5">{renderValue(record["背番号"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "形状" : "Shape"}</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["形状"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "R/L" : "Side (R/L)"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["R/L"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "色" : "Color"}</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["色"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3 md:col-span-2">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "品名" : "Product Name"}</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["品名"])}</span>
                  </div>
                </div>
              </div>

              {/* 2. Manufacturing & Equipment */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>precision_manufacturing</span>
                  <span>{isJa ? "製造・設備仕様" : "Manufacturing & Equipment"}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "工場" : "Factory"}</span>
                    <span className="font-semibold text-sm text-on-surface mt-0.5">{renderValue(record["工場"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "加工設備" : "Equipment"}</span>
                    <span className="font-semibold text-sm text-primary mt-0.5">{renderValue(record["加工設備"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "型番" : "Model No."}</span>
                    <span className="font-semibold text-sm text-on-surface mt-0.5">{renderValue(record["型番"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "収容数" : "Pack Qty"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["収容数"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "送りピッチ" : "Feed Pitch"}</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["送りピッチ"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "離型紙上/下" : "Release Paper"}</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["離型紙上/下"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "秒数 (1pcs何秒)" : "Cycle Sec/pc"}</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["秒数(1pcs何秒)"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "取数 (pcPerCycle)" : "Pcs / Cycle"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["pcPerCycle"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">SRS</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["SRS"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">SLIT</span>
                    <span className="font-medium text-sm text-on-surface mt-0.5">{renderValue(record["SLIT"])}</span>
                  </div>
                </div>
              </div>

              {/* 3. Material Specifications with LINK to 材料DB */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>layers</span>
                    <span>{isJa ? "使用材料情報 (材料DB連携)" : "Material Specs & DB Link"}</span>
                  </div>
                  {(materialBackNo || materialHinban) && (
                    <span className="text-[10px] text-primary/80 font-normal">
                      {isJa ? "材料背番号 = 材料DB「ラベル品番」" : "Linked via ラベル品番"}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-primary uppercase">{isJa ? "材料名" : "Material"}</span>
                      <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["材料"])}</span>
                    </div>
                    <div className="flex flex-col bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-primary uppercase">{isJa ? "材料背番号 (ラベル品番)" : "Material Back No."}</span>
                      <span className="font-mono font-bold text-sm text-primary mt-0.5">{renderValue(record["材料背番号"])}</span>
                    </div>
                    <div className="flex flex-col bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-primary uppercase">{isJa ? "材料品番 (構成品番)" : "Material Hinban"}</span>
                      <span className="font-mono font-semibold text-sm text-on-surface mt-0.5">
                        {renderValue(record["材料品番"] || linkedMaterial?.["品番"] || linkedMaterial?.["品目マスタ"]?.["品番"])}
                      </span>
                    </div>
                  </div>

                  {/* Connected Material DB Action Card */}
                  {(materialBackNo || materialHinban) && (
                    <div
                      onClick={handleOpenMaterialModal}
                      className="group rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/15 transition-all p-4 flex items-center justify-between cursor-pointer shadow-xs active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary shadow-xs">
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                            inventory_2
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary uppercase tracking-wide">
                              {isJa ? "連携材料 (材料DB)" : "Linked Material Record"}
                            </span>
                            {loadingLinked && (
                              <span className="text-[10px] text-primary/70 animate-pulse">
                                {isJa ? "読込中…" : "Loading…"}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-on-surface mt-0.5">
                            {linkedMaterial ? (
                              <span>
                                {linkedMaterial["品番"]}
                                <span className="text-xs font-normal text-outline ml-2">
                                  ({linkedMaterial["品目マスタ"]?.["品名"] || linkedMaterial["品名"] || "No Name"})
                                </span>
                              </span>
                            ) : (
                              <span>
                                {isJa ? "材料背番号:" : "Back No:"} {materialBackNo || materialHinban}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-primary font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                        <span>{isJa ? "材料詳細を開く" : "View Material"}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          arrow_forward
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Pricing, Logistics & Operations */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>payments</span>
                  <span>{isJa ? "価格・運用・IoT情報" : "Pricing, Logistics & Operations"}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3 md:col-span-2">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "顧客/納入先" : "Customer / Destination"}</span>
                    <span className="font-semibold text-sm text-on-surface mt-0.5">{renderValue(record["顧客/納入先"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "個単価 (pricePerPc)" : "Price / Pc"}</span>
                    <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {record["pricePerPc"] != null && record["pricePerPc"] !== "" ? `¥${record["pricePerPc"]}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "箱単価 (pricePerBox)" : "Price / Box"}</span>
                    <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {record["pricePerBox"] != null && record["pricePerBox"] !== "" ? `¥${record["pricePerBox"]}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "カンバン (boardData)" : "Board Data"}</span>
                    <span className="font-mono font-medium text-xs text-on-surface mt-0.5 truncate">{renderValue(record["boardData"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-outline uppercase">{isJa ? "ラベル刻印 (labelMarking)" : "Label Marking"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["labelMarking"])}</span>
                  </div>
                  <div className="flex flex-col bg-surface-variant/15 border border-outline-variant/25 rounded-xl p-3 md:col-span-2">
                    <span className="text-[10px] font-semibold text-outline uppercase">QR CODE</span>
                    <span className="font-mono text-xs text-on-surface mt-0.5 truncate">{renderValue(record["QR CODE"])}</span>
                  </div>
                </div>
              </div>

              {/* 5. Remarks */}
              {record["備考"] && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                    {isJa ? "備考 (Remarks)" : "Remarks"}
                  </div>
                  <p className="text-sm text-on-surface whitespace-pre-wrap">{record["備考"]}</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-outline-variant/30 bg-surface-variant/10 text-xs text-outline">
              <span>{isJa ? "表示専用モード" : "Read-only mode."}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                >
                  {isJa ? "レコードを編集" : "Edit Record"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dedicated Edit Modal */}
      {editModalOpen && (
        <MasterProductEditModal
          open={editModalOpen}
          record={{
            ...record,
            材料品番: record?.["材料品番"] || linkedMaterial?.["品番"] || linkedMaterial?.["品目マスタ"]?.["品番"] || ""
          }}
          isNew={false}
          submitting={saving}
          onClose={() => setEditModalOpen(false)}
          onSubmit={(draft) => {
            if (onSave) {
              onSave(draft);
            }
            setEditModalOpen(false);
          }}
          onUploadImage={onUploadImage}
        />
      )}

      {/* Linked Material Detail Modal (nested popup) */}
      {activeMaterialModal && (
        <MaterialDetailModal
          modalData={activeMaterialModal}
          onClose={() => setActiveMaterialModal(null)}
        />
      )}

      {/* Image Zoom Lightbox */}
      {zoomImage && record.imageURL && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setZoomImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={record.imageURL}
              alt={record["品番"]}
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-white font-mono font-bold text-sm bg-black/50 px-3 py-1 rounded-full">
                {record["品番"]}
              </span>
              <button
                type="button"
                onClick={() => setZoomImage(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
