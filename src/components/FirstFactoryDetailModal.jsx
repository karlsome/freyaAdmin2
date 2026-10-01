import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import LiquidSegmentedControl from "./LiquidSegmentedControl";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * FirstFactoryDetailModal
 *
 * Dedicated modal for 第一工場 (PSA Laminating process).
 * Displays production roll details, specifications, raw material QR traceability,
 * timings/epochs, and Brother label print history from submittedDB.firstFactoryProduction.
 */
export default function FirstFactoryDetailModal({
  roll,
  allRolls = [],
  onClose,
  onSelectRoll,
  zIndex = "z-50",
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("spec");
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [currentRoll, setCurrentRoll] = useState(roll);

  useEffect(() => {
    setCurrentRoll(roll);
  }, [roll]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (photoExpanded) {
          setPhotoExpanded(false);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, photoExpanded]);

  if (!currentRoll) return null;

  const r = currentRoll;
  const status = (r.status || "queue").toLowerCase();

  const statusMeta =
    status === "completed"
      ? {
          label: isJa ? "完了" : "Completed",
          chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
          dot: "bg-emerald-500",
        }
      : status === "in-progress" || status === "active"
      ? {
          label: isJa ? "稼働中" : "In Progress",
          chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
          dot: "bg-amber-500",
        }
      : {
          label: isJa ? "待機中" : "Queued",
          chip: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25",
          dot: "bg-slate-400",
        };

  const tabs = [
    {
      key: "spec",
      label: isJa ? "仕様・品目情報" : "Product Specs",
      labelJa: "仕様・品目情報",
    },
    {
      key: "traceability",
      label: isJa ? "材料QR・トレーサビリティ" : "Traceability",
      labelJa: "材料QR・トレーサビリティ",
    },
    {
      key: "timing",
      label: isJa ? "作業時間・実績" : "Cycle & Timings",
      labelJa: "作業時間・実績",
    },
    {
      key: "printing",
      label: isJa ? "印刷履歴・固有ID" : "Print History",
      labelJa: "印刷履歴・固有ID",
      badge: Array.isArray(r.printHistory) ? r.printHistory.length : 0,
    },
  ];

  const rollTabs = (allRolls || []).map((item, idx) => ({
    key: String(item._id || item.itemId || idx),
    label: `Roll ${item.rollIndex ?? idx + 1}/${item.totalRolls ?? allRolls.length}`,
    item,
  }));

  const activeRollKey = String(r._id || r.itemId || "");

  const modal = (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="freya-card rounded-[12px] w-full max-w-3xl max-h-[92vh] overflow-y-auto
                   border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 rounded-t-[12px] px-6 py-4 flex items-center justify-between
                        border-b border-[var(--border)] bg-[var(--surface-raised)] backdrop-blur-md">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[var(--freya-blue)]" />
              <h3 className="text-base font-semibold text-[var(--text-primary)] truncate leading-tight">
                {isJa ? "第一工場 — PSA工程 (ラミネート実績詳細)" : "First Factory — PSA Laminating Details"}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold ${statusMeta.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
              {r.uniqueID && (
                <span className="px-2 py-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-[10px] font-mono font-bold tracking-wider">
                  ID: {r.uniqueID}
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] mt-1 font-mono">
              Roll {r.rollIndex ?? "—"} / {r.totalRolls ?? "—"} · {r.hinban || "—"} · {r.machine || "PSA2"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors"
              aria-label={isJa ? "閉じる" : "Close"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-5 flex-1">
          {/* Quick Roll Switcher (if multiple rolls exist) */}
          {rollTabs.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--border)]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex-shrink-0 mr-1">
                {isJa ? "巻選択:" : "Rolls:"}
              </span>
              {rollTabs.map((rt) => {
                const isSelected = rt.key === activeRollKey;
                const isCompleted = rt.item.status === "completed";
                return (
                  <button
                    key={rt.key}
                    type="button"
                    onClick={() => {
                      setCurrentRoll(rt.item);
                      if (onSelectRoll) onSelectRoll(rt.item);
                    }}
                    className={`px-2.5 py-1 rounded-[4px] text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                      isSelected
                        ? "bg-[var(--freya-blue)] text-white shadow-xs"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCompleted ? (isSelected ? "bg-white" : "bg-emerald-500") : isSelected ? "bg-white/80" : "bg-amber-400"
                      }`}
                    />
                    {rt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Key Metrics Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono mb-1">
                {isJa ? "巻長 / 総長" : "Roll / Total"}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] font-mono">
                {r.meters ?? r.rollMeters ?? "—"} <span className="text-xs font-normal">m</span>
                {r.totalMeters ? (
                  <span className="text-xs font-normal text-[var(--text-muted)]"> / {r.totalMeters}m</span>
                ) : null}
              </p>
            </div>

            <div className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono mb-1">
                {isJa ? "設備ライン" : "Machine"}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] font-mono">
                {r.machine || "PSA2"}
                {r.orderIndex ? (
                  <span className="text-xs font-normal text-[var(--text-muted)]"> (#{r.orderIndex})</span>
                ) : null}
              </p>
            </div>

            <div className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono mb-1">
                {isJa ? "作業時間" : "Duration"}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] font-mono">
                {r.actualDurationMins != null ? (
                  <>
                    {r.actualDurationMins} <span className="text-xs font-normal">{isJa ? "分" : "min"}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>

            <div className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono mb-1">
                {isJa ? "完了モード" : "Mode"}
              </p>
              <p className={`text-xs font-bold font-mono ${r.manualAdvance ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {r.manualAdvance
                  ? (isJa ? "手動進行 (印刷不可)" : "Manual Advance")
                  : (isJa ? "通常進行 (ラベル印刷)" : "Normal Print")}
              </p>
            </div>
          </div>

          {/* ── System Segmented Tabs ── */}
          <LiquidSegmentedControl
            items={tabs}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            className="w-full justify-start"
          />

          {/* ── Tab Content ── */}
          {activeTab === "spec" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "品番" : "Part Number"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono select-all">{r.hinban || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "品名" : "Product Name"}:</span>
                  <span className="font-bold text-[var(--text-primary)]">{r.hinmei || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "基材" : "Base Material"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.kizai || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "色" : "Color"}:</span>
                  <span className="font-bold text-[var(--text-primary)]">{r.color || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "図番" : "Drawing No"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.zuban || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "出荷先" : "Ship To"}:</span>
                  <span className="font-bold text-[var(--text-primary)]">{r.shippingDest || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "ラベル品番" : "Label Hinban"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.labelHinban || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "客先品番" : "Customer Hinban"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.okyakuHinban || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "巻番号 / 総巻数" : "Roll Index"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.rollIndex ?? "—"} / {r.totalRolls ?? "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "巻長" : "Roll Meters"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.meters ?? r.rollMeters ?? "—"} m</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "グループID" : "Group ID"}:</span>
                  <span className="font-mono text-[var(--text-secondary)] text-[11px] select-all truncate max-w-[50%] text-right">{r.groupId || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "アイテムID" : "Item ID"}:</span>
                  <span className="font-mono text-[var(--text-secondary)] text-[11px] select-all truncate max-w-[50%] text-right">{r.itemId || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5 sm:col-span-2">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "固有ID (Base62)" : "Unique ID"}:</span>
                  <span className="font-mono font-bold text-[var(--freya-blue)] text-sm select-all">{r.uniqueID || "—"}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "traceability" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "材料ロット番号" : "Material Lot No"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.lotNo || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "材料長" : "Material Length"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.rawMaterialLength ? `${r.rawMaterialLength} m` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "粗長" : "Socho (Gross)"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.socho ? `${r.socho} m` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "敷" : "Shiki"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.shiki ? `${r.shiki} m` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5 sm:col-span-2">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "微調" : "Bicho (Adj)"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.bicho ? `${r.bicho} m` : "—"}</span>
                </div>
              </div>

              {/* Raw Material QR String */}
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 space-y-1">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  {isJa ? "読取生材料QRデータ" : "Raw Material QR Payload"}
                </p>
                <p className="text-xs font-mono text-[var(--text-primary)] break-all select-all whitespace-pre-wrap bg-[var(--surface)] p-2 rounded-[4px] border border-[var(--border)]">
                  {r.rawMaterialQR || (isJa ? "（QRデータ未読込）" : "(No QR code recorded)")}
                </p>
              </div>

              {/* Material Label Photo */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  {isJa ? "材料現品ラベル写真" : "Material Label Photo"}
                </p>
                {r.imageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={r.imageUrl}
                      alt={isJa ? "材料ラベル写真" : "Material label photo"}
                      onClick={() => setPhotoExpanded(true)}
                      className="max-h-56 max-w-full rounded-[6px] border border-[var(--border)] object-contain cursor-zoom-in hover:border-[var(--freya-blue)] transition-colors bg-black/10"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                      {isJa ? "クリックして拡大表示" : "Click image to expand"}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-6 rounded-[6px] border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] font-mono">
                    {isJa ? "ラベル写真なし" : "No photo captured for this roll"}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "timing" && (
            <div className="space-y-4">
              {/* Workers Row */}
              <div className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">
                    {isJa ? "供給作業者 (Feeder)" : "Feeder Worker"}
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">{r.feederWorker || r.worker || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">
                    {isJa ? "包装作業者 (Wrapper)" : "Wrapper Worker"}
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">{r.wrapperWorker || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-0.5">
                    {isJa ? "総合作業者 (Worker)" : "Main Worker"}
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">{r.worker || "—"}</p>
                </div>
              </div>

              {/* Timings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "生産日" : "Date"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.date || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "実作業時間" : "Actual Duration"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">
                    {r.actualDurationMins != null ? `${r.actualDurationMins} 分 (${r.actualDurationMins * 60}秒)` : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "開始時刻" : "Start Time"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.actualStartTime || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "終了時刻" : "End Time"}:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">{r.actualEndTime || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "開始エポック (startEpoch)" : "Start Epoch"}:</span>
                  <span className="font-mono text-[var(--text-secondary)] text-[11px]">
                    {r.startEpoch ? `${r.startEpoch} (${new Date(r.startEpoch).toLocaleTimeString()})` : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "終了エポック (endEpoch)" : "End Epoch"}:</span>
                  <span className="font-mono text-[var(--text-secondary)] text-[11px]">
                    {r.endEpoch ? `${r.endEpoch} (${new Date(r.endEpoch).toLocaleTimeString()})` : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "進行方式 (manualAdvance)" : "Manual Advance"}:</span>
                  <span className={`font-mono font-bold ${r.manualAdvance ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {r.manualAdvance ? (isJa ? "True (手動進行)" : "True (Manual)") : (isJa ? "False (通常)" : "False (Normal)")}
                  </span>
                </div>
                {r.manualReason && (
                  <div className="flex justify-between border-b border-[var(--border)] pb-1.5 sm:col-span-2">
                    <span className="text-[var(--text-muted)] font-mono">{isJa ? "手動進行理由" : "Reason"}:</span>
                    <span className="font-bold text-amber-500">{r.manualReason}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "登録日時" : "Created At"}:</span>
                  <span className="font-mono text-[var(--text-secondary)] text-[11px]">
                    {r.createdAt?.$date || r.createdAt ? new Date(r.createdAt?.$date || r.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
                  <span className="text-[var(--text-muted)] font-mono">{isJa ? "更新日時" : "Updated At"}:</span>
                  <span className="font-mono text-[var(--text-secondary)] text-[11px]">
                    {r.updatedAt?.$date || r.updatedAt ? new Date(r.updatedAt?.$date || r.updatedAt).toLocaleString() : "—"}
                  </span>
                </div>
              </div>

              {/* Temperature Snapshot (KEYENCE TR-W1000 OCR) */}
              {(r.temperatures || r.ovenTemp1 != null || r.ambientTemp != null) && (
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <span>🌡️</span>
                      <span>{isJa ? "開始時温度スナップショット (KEYENCE TR-W1000 OCR)" : "Start Temperature Snapshot (KEYENCE TR-W1000 OCR)"}</span>
                    </p>
                    {(r.tempSnapshotAt || r.temperatures?.capturedAt) && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {new Date(r.tempSnapshotAt || r.temperatures?.capturedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div className="p-2 rounded-[4px] bg-[var(--surface)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{isJa ? "炉温 1" : "Oven 1"}</p>
                      <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {r.ovenTemp1 ?? r.temperatures?.ovenTemp1 ?? "—"} <span className="text-[10px] font-normal">°C</span>
                      </p>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--surface)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{isJa ? "炉温 2" : "Oven 2"}</p>
                      <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {r.ovenTemp2 ?? r.temperatures?.ovenTemp2 ?? "—"} <span className="text-[10px] font-normal">°C</span>
                      </p>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--surface)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{isJa ? "炉温 3" : "Oven 3"}</p>
                      <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {r.ovenTemp3 ?? r.temperatures?.ovenTemp3 ?? "—"} <span className="text-[10px] font-normal">°C</span>
                      </p>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--surface)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{isJa ? "周囲温度" : "Ambient"}</p>
                      <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {r.ambientTemp ?? r.temperatures?.ambientTemp ?? "—"} <span className="text-[10px] font-normal">°C</span>
                      </p>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] col-span-2 sm:col-span-1">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{isJa ? "湿度" : "Humidity"}</p>
                      <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {r.ambientHumidity ?? r.temperatures?.ambientHumidity ?? "—"} <span className="text-[10px] font-normal">%</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "printing" && (
            <div className="space-y-4">
              <div className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                    {isJa ? "製品個別固有ID (Base62 Alphanumeric)" : "Roll Unique ID"}
                  </p>
                  <p className="text-base font-bold font-mono text-[var(--freya-blue)] mt-0.5 select-all">
                    {r.uniqueID || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                    {isJa ? "QRコード形式" : "QR Content"}
                  </p>
                  <p className="text-xs font-mono text-[var(--text-secondary)] mt-0.5">
                    {r.labelHinban || r.hinban},{r.lotNo},{r.meters},{r.uniqueID || "—"}
                  </p>
                </div>
              </div>

              {Array.isArray(r.printHistory) && r.printHistory.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                    {isJa ? `印刷イベント履歴 (${r.printHistory.length} 件)` : `Print Logs (${r.printHistory.length})`}
                  </p>
                  <div className="space-y-2">
                    {r.printHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-xs font-mono space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-primary)]">
                            {isJa ? "印刷 #" : "Print #"}{idx + 1} — Roll {item.rollIndex ?? r.rollIndex ?? 1} / {item.totalRolls ?? r.totalRolls ?? 1}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${
                              item.manualAdvance
                                ? "bg-amber-500/15 text-amber-500"
                                : item.printSuccess !== false
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/15 text-rose-500"
                            }`}
                          >
                            {item.manualAdvance
                              ? (isJa ? "手動スキップ" : "Manual Advance")
                              : item.printSuccess !== false
                              ? (isJa ? "印刷成功" : "Printed OK")
                              : (isJa ? "印刷失敗" : "Failed")}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[var(--text-secondary)] pt-1">
                          <div>
                            <span className="text-[var(--text-muted)]">{isJa ? "作業者:" : "Worker:"} </span>
                            {item.worker || "—"}
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">{isJa ? "設備:" : "Machine:"} </span>
                            {item.machine || r.machine || "PSA2"}
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">{isJa ? "時刻:" : "Time:"} </span>
                            {item.timeStr || (item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "—")}
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">{isJa ? "固有ID:" : "ID:"} </span>
                            <span className="font-bold text-[var(--text-primary)]">{item.uniqueID || r.uniqueID || "—"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] text-center text-xs text-[var(--text-muted)] font-mono">
                  {isJa ? "ラベル印刷履歴はありません" : "No print history entries logged"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 rounded-b-[12px] px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/firstFactory");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-xs font-semibold hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>domain</span>
            {isJa ? "第一工場管理画面を開く" : "Open First Factory Page"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[6px] bg-[var(--freya-blue)] text-white text-xs font-semibold hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            {isJa ? "閉じる" : "Close"}
          </button>
        </div>
      </div>

      {/* ── Expanded Photo Lightbox ── */}
      {photoExpanded && r.imageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPhotoExpanded(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={r.imageUrl}
              alt={isJa ? "材料ラベル拡大" : "Expanded label"}
              className="max-h-[85vh] max-w-full rounded-[8px] object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPhotoExpanded(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
