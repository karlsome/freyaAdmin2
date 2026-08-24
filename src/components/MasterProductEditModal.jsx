import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { query } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";

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
    品番: "",
    モデル: "",
    背番号: "",
    品名: "",
    形状: "",
    "R/L": "-",
    色: "",
    "顧客/納入先": "",
    備考: "",
    加工設備: "",
    "QR CODE": "",
    型番: "",
    材料背番号: "",
    材料: "",
    材料品番: "",
    収容数: "",
    工場: "",
    "秒数(1pcs何秒)": "",
    "離型紙上/下": "下",
    送りピッチ: "",
    SRS: "",
    SLIT: "",
    imageURL: "",
    pickingIOT: "no",
    pcPerCycle: "",
    pricePerBox: "",
    pricePerPc: "",
    boardData: "",
    labelMarking: "",
  };

  const [draft, setDraft] = useState(initialDraft);
  const [activeSection, setActiveSection] = useState("all");
  const [isLookingUpMaterial, setIsLookingUpMaterial] = useState(false);

  useEffect(() => {
    if (open) {
      if (record) {
        setDraft({
          ...initialDraft,
          ...record,
        });
      } else {
        setDraft(initialDraft);
      }
    }
  }, [open, record]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleMaterialBackNoLookup = async (backNoVal) => {
    const backNo = (backNoVal ?? draft["材料背番号"] ?? "").trim();
    if (!backNo) return;
    setIsLookingUpMaterial(true);
    try {
      const res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", {
        $or: [
          { "品目マスタ.ラベル品番": backNo },
          { "ラベル品番": backNo },
          { "品番": backNo },
          { "品目マスタ.品番": backNo },
        ],
      });
      const data = Array.isArray(res) ? res[0] : res?.data?.[0];
      const matchedHinban = data?.["品番"] || data?.["品目マスタ"]?.["品番"];
      if (matchedHinban) {
        setDraft((prev) => ({
          ...prev,
          材料品番: prev["材料品番"]?.trim() ? prev["材料品番"] : matchedHinban,
        }));
      }
    } catch (err) {
      console.error("Failed to lookup material hinban:", err);
    } finally {
      setIsLookingUpMaterial(false);
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

    if (onSubmit) {
      onSubmit(payload);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
      <div
        className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-outline-variant/30 bg-surface-variant/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
                  ? "すべてのフィールドを構造化フォームで安全に編集できます"
                  : "Edit all master attributes safely in structured form sections"}
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
              <span>{isJa ? "1. 車両・製品基本情報" : "1. Vehicle & Product Identity"}</span>
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
                  placeholder="e.g. 6GN"
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
                  placeholder="e.g. Armrest_Front"
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
                  placeholder="e.g. NEUTRAL BEIGE"
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
                  placeholder="e.g. AR FR LH P-LIKE NEUTRAL BEIGE(Z4K1)"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* 2. Manufacturing & Machine Specs */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>precision_manufacturing</span>
              <span>{isJa ? "2. 製造・設備仕様" : "2. Manufacturing & Machine Specs"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "工場" : "Factory (工場)"}
                </label>
                <input
                  type="text"
                  value={draft["工場"] ?? ""}
                  onChange={(e) => handleChange("工場", e.target.value)}
                  placeholder="e.g. 小瀬 / 第二工場 / 肥田瀬"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "加工設備" : "Equipment (加工設備)"}
                </label>
                <input
                  type="text"
                  value={draft["加工設備"] ?? ""}
                  onChange={(e) => handleChange("加工設備", e.target.value)}
                  placeholder="e.g. OZNC02 / MANAS / Dプレス"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-semibold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

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
                  placeholder="e.g. 60 / 150"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-bold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "送りピッチ (mm)" : "Pitch (送りピッチ)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={draft["送りピッチ"] ?? ""}
                  onChange={(e) => handleChange("送りピッチ", e.target.value)}
                  placeholder="e.g. 680"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

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
                  {isJa ? "秒数(1pcs何秒)" : "Cycle Sec / pc"}
                </label>
                <input
                  type="text"
                  value={draft["秒数(1pcs何秒)"] ?? ""}
                  onChange={(e) => handleChange("秒数(1pcs何秒)", e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "取数 (pcPerCycle)" : "Pcs / Cycle"}
                </label>
                <input
                  type="number"
                  value={draft["pcPerCycle"] ?? ""}
                  onChange={(e) => handleChange("pcPerCycle", e.target.value)}
                  placeholder="e.g. 18"
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
                  <option value="あり">あり (Yes)</option>
                  <option value="なし">なし (No)</option>
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
                  <option value="あり">あり (Yes)</option>
                  <option value="なし">なし (No)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Material Specifications */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>layers</span>
              <span>{isJa ? "3. 使用材料情報 (材料DBリンク)" : "3. Material Specs (Linked to Material DB)"}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "材料名" : "Material Name (材料)"}
                </label>
                <input
                  type="text"
                  value={draft["材料"] ?? ""}
                  onChange={(e) => handleChange("材料", e.target.value)}
                  placeholder="e.g. ソフトレザーC2 MAT"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-primary mb-1 flex items-center justify-between">
                  <span>{isJa ? "材料背番号 (ラベル品番)" : "Material Back No. (ラベル品番)"}</span>
                  <span className="text-[10px] text-outline font-normal">Link to 材料DB</span>
                </label>
                <input
                  type="text"
                  value={draft["材料背番号"] ?? ""}
                  onChange={(e) => handleChange("材料背番号", e.target.value)}
                  onBlur={() => handleMaterialBackNoLookup()}
                  placeholder="e.g. Z4K1 / LMB / 880 / 12IB"
                  className="w-full rounded-xl border border-primary/40 bg-surface px-3 py-2 text-xs font-mono font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "材料品番 (構成品番)" : "Material Hinban (材料品番)"}
                </label>
                <input
                  type="text"
                  value={draft["材料品番"] ?? ""}
                  onChange={(e) => handleChange("材料品番", e.target.value)}
                  placeholder="e.g. C13/120B*B*ID/***WA8"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* 4. Pricing, Logistics & Operations */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
              <span>{isJa ? "4. 価格・運用・IoT情報" : "4. Pricing, Logistics & Operations"}</span>
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
                  {isJa ? "個単価 pricePerPc (¥)" : "Price / Pc (¥)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={draft["pricePerPc"] ?? ""}
                  onChange={(e) => handleChange("pricePerPc", e.target.value)}
                  placeholder="e.g. 98.5"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "箱単価 pricePerBox (¥)" : "Price / Box (¥)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={draft["pricePerBox"] ?? ""}
                  onChange={(e) => handleChange("pricePerBox", e.target.value)}
                  placeholder="e.g. 5910"
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
                  placeholder="e.g. D017"
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
                  placeholder="e.g. ♠♠"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-on-surface mb-1">QR CODE</label>
                <input
                  type="text"
                  value={draft["QR CODE"] ?? ""}
                  onChange={(e) => handleChange("QR CODE", e.target.value)}
                  placeholder="QR code string"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-on-surface mb-1">
                  {isJa ? "画像URL (imageURL)" : "Image URL"}
                </label>
                <input
                  type="text"
                  value={draft["imageURL"] ?? ""}
                  onChange={(e) => handleChange("imageURL", e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-xs font-mono text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* 5. Remarks */}
          <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-2">
            <label className="block text-xs font-bold text-primary uppercase tracking-wider">
              {isJa ? "5. 備考 (Remarks)" : "5. Remarks / Notes"}
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
    </div>,
    document.body
  );
}
