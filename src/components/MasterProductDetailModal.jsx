import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({ ...record }));
  const [zoomImage, setZoomImage] = useState(false);
  const fileInputRef = useRef(null);

  if (!open || !record) return null;

  const handleFieldChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(draft);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...record });
    setEditing(false);
  };

  const isJa = language === "ja";

  const renderValue = (val) => {
    if (val === null || val === undefined || val === "") return "—";
    return String(val);
  };

  return createPortal(
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
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...record });
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                <span>{isJa ? "編集" : "Edit"}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-xl border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-variant/30 transition-all"
                >
                  {isJa ? "キャンセル" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
                >
                  {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "保存" : "Save")}
                </button>
              </div>
            )}
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
                  <span>{uploading ? (isJa ? "アップロード中…" : "Uploading…") : record.imageURL ? (isJa ? "画像を変更" : "Change Image") : (isJa ? "画像をアップロード" : "Upload Image")}</span>
                </button>
              </div>
            )}
          </div>

          {!editing ? (
            /* ──────────────── VIEW MODE ──────────────── */
            <div className="flex flex-col gap-6">

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

              {/* 3. Material Specifications */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>layers</span>
                  <span>{isJa ? "使用材料情報" : "Material Information"}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-primary uppercase">{isJa ? "材料名" : "Material"}</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5">{renderValue(record["材料"])}</span>
                  </div>
                  <div className="flex flex-col bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-primary uppercase">{isJa ? "材料背番号" : "Material Back No."}</span>
                    <span className="font-mono font-bold text-sm text-primary mt-0.5">{renderValue(record["材料背番号"])}</span>
                  </div>
                  <div className="flex flex-col bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-primary uppercase">{isJa ? "材料品番" : "Material Part No."}</span>
                    <span className="font-mono font-semibold text-sm text-on-surface mt-0.5">{renderValue(record["材料品番"])}</span>
                  </div>
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
          ) : (
            /* ──────────────── EDIT MODE ──────────────── */
            <div className="flex flex-col gap-6">

              {/* 1. Basic Product Info */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">
                  {isJa ? "車両・製品基本情報" : "Vehicle & Product Identity"}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">品番</label>
                    <input
                      type="text"
                      value={draft["品番"] ?? ""}
                      onChange={(e) => handleFieldChange("品番", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">モデル</label>
                    <input
                      type="text"
                      value={draft["モデル"] ?? ""}
                      onChange={(e) => handleFieldChange("モデル", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">背番号</label>
                    <input
                      type="text"
                      value={draft["背番号"] ?? ""}
                      onChange={(e) => handleFieldChange("背番号", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">形状</label>
                    <input
                      type="text"
                      value={draft["形状"] ?? ""}
                      onChange={(e) => handleFieldChange("形状", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">R/L</label>
                    <select
                      value={draft["R/L"] ?? ""}
                      onChange={(e) => handleFieldChange("R/L", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    >
                      <option value="">—</option>
                      <option value="LH">LH</option>
                      <option value="RH">RH</option>
                      <option value="-">-</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">色</label>
                    <input
                      type="text"
                      value={draft["色"] ?? ""}
                      onChange={(e) => handleFieldChange("色", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">品名</label>
                    <input
                      type="text"
                      value={draft["品名"] ?? ""}
                      onChange={(e) => handleFieldChange("品名", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Manufacturing Info */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">
                  {isJa ? "製造・設備仕様" : "Manufacturing & Equipment"}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">工場</label>
                    <input
                      type="text"
                      value={draft["工場"] ?? ""}
                      onChange={(e) => handleFieldChange("工場", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">加工設備</label>
                    <input
                      type="text"
                      value={draft["加工設備"] ?? ""}
                      onChange={(e) => handleFieldChange("加工設備", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">型番</label>
                    <input
                      type="text"
                      value={draft["型番"] ?? ""}
                      onChange={(e) => handleFieldChange("型番", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">収容数</label>
                    <input
                      type="text"
                      value={draft["収容数"] ?? ""}
                      onChange={(e) => handleFieldChange("収容数", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">送りピッチ</label>
                    <input
                      type="number"
                      value={draft["送りピッチ"] ?? ""}
                      onChange={(e) => handleFieldChange("送りピッチ", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">離型紙上/下</label>
                    <select
                      value={draft["離型紙上/下"] ?? ""}
                      onChange={(e) => handleFieldChange("離型紙上/下", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    >
                      <option value="">—</option>
                      <option value="上">上</option>
                      <option value="下">下</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">秒数(1pcs何秒)</label>
                    <input
                      type="text"
                      value={draft["秒数(1pcs何秒)"] ?? ""}
                      onChange={(e) => handleFieldChange("秒数(1pcs何秒)", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">取数 (pcPerCycle)</label>
                    <input
                      type="number"
                      value={draft["pcPerCycle"] ?? ""}
                      onChange={(e) => handleFieldChange("pcPerCycle", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Material Info */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">
                  {isJa ? "使用材料情報" : "Material Information"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">材料</label>
                    <input
                      type="text"
                      value={draft["材料"] ?? ""}
                      onChange={(e) => handleFieldChange("材料", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">材料背番号</label>
                    <input
                      type="text"
                      value={draft["材料背番号"] ?? ""}
                      onChange={(e) => handleFieldChange("材料背番号", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">材料品番</label>
                    <input
                      type="text"
                      value={draft["材料品番"] ?? ""}
                      onChange={(e) => handleFieldChange("材料品番", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Pricing & Operations */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">
                  {isJa ? "価格・運用・IoT情報" : "Pricing, Logistics & Operations"}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">顧客/納入先</label>
                    <input
                      type="text"
                      value={draft["顧客/納入先"] ?? ""}
                      onChange={(e) => handleFieldChange("顧客/納入先", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">個単価 (¥)</label>
                    <input
                      type="number"
                      step="any"
                      value={draft["pricePerPc"] ?? ""}
                      onChange={(e) => handleFieldChange("pricePerPc", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">箱単価 (¥)</label>
                    <input
                      type="number"
                      step="any"
                      value={draft["pricePerBox"] ?? ""}
                      onChange={(e) => handleFieldChange("pricePerBox", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">pickingIOT</label>
                    <select
                      value={draft["pickingIOT"] ?? ""}
                      onChange={(e) => handleFieldChange("pickingIOT", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    >
                      <option value="">—</option>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">カンバン (boardData)</label>
                    <input
                      type="text"
                      value={draft["boardData"] ?? ""}
                      onChange={(e) => handleFieldChange("boardData", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">ラベル刻印 (labelMarking)</label>
                    <input
                      type="text"
                      value={draft["labelMarking"] ?? ""}
                      onChange={(e) => handleFieldChange("labelMarking", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">QR CODE</label>
                    <input
                      type="text"
                      value={draft["QR CODE"] ?? ""}
                      onChange={(e) => handleFieldChange("QR CODE", e.target.value)}
                      className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Remarks */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-outline mb-1">備考</label>
                <textarea
                  rows={3}
                  value={draft["備考"] ?? ""}
                  onChange={(e) => handleFieldChange("備考", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary resize-none"
                />
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-outline-variant/30 bg-surface-variant/10 text-xs text-outline">
          <span>{editing ? (isJa ? "編集中です。変更を保存してください。" : "Editing record. Click Save to commit changes.") : (isJa ? "表示専用モード" : "Read-only mode.")}</span>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-variant/30 transition-all cursor-pointer"
                >
                  {isJa ? "キャンセル" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "変更を保存" : "Save Changes")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...record });
                  setEditing(true);
                }}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
              >
                {isJa ? "レコードを編集" : "Edit Record"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Zoom Lightbox */}
      {zoomImage && record.imageURL && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.15s_ease-out]"
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
    </div>,
    document.body
  );
}
