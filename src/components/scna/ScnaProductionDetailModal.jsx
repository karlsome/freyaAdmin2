import { useState } from "react";
import ModalShell from "../ModalShell";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatIndianapolisTimestamp, getRecordImages } from "../../utils/scna";

export default function ScnaProductionDetailModal({ open, record, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!open || !record) return null;

  const images = getRecordImages(record);
  const hasNgDetails =
    (Number(record.Total_NG) || 0) > 0 ||
    (Number(record["疵引処理数"]) || 0) > 0 ||
    (Number(record["疵引不良"]) || 0) > 0 ||
    (Number(record["加工不良"]) || 0) > 0 ||
    (Number(record["その他"]) || 0) > 0;

  const cycleTimeNum = parseFloat(record.Cycle_Time) || 0;

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        eyebrow={isJa ? "SCNA 生産実績" : "SCNA Production Record"}
        title={isJa ? "生産記録詳細" : "Production Record Details"}
        subtitle={`${record["設備"] || "N/A"} • ${record.Date || "N/A"} (${record.Time_start || "N/A"} - ${record.Time_end || "N/A"})`}
        maxWidth="max-w-4xl"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "閉じる" : "Close"}
          </button>
        }
      >
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {/* Top 2-column grid: Production Overview & Production Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Production Overview */}
            <div className="rounded-[8px] border border-blue-500/25 bg-blue-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  precision_manufacturing
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "生産概要 (Production Overview)" : "Production Overview"}
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                {record._id && (
                  <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                    <span className="font-medium text-[var(--text-muted)]">Record ID:</span>
                    <span className="font-mono text-[11px] text-[var(--text-primary)] break-all text-right">
                      {String(record._id)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "日付 (Date):" : "Date:"}
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {record.Date || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "設備 (Equipment):" : "Equipment:"}
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {record["設備"] || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "作業者 (Worker):" : "Worker:"}
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {record.Worker_Name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "品番 (Part Number):" : "Part Number:"}
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {record["品番"] || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pb-0.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "背番号 (Back Number):" : "Back Number:"}
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {record["背番号"] || "N/A"}
                  </span>
                </div>
                {record.Comment && (
                  <div className="pt-2 border-t border-[var(--border)]/60">
                    <span className="font-medium text-[var(--text-muted)] block mb-1">
                      {isJa ? "コメント (Comment):" : "Comment:"}
                    </span>
                    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs text-[var(--text-primary)]">
                      {record.Comment}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Production Stats */}
            <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3 text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  monitoring
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "生産統計 (Production Stats)" : "Production Stats"}
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "稼働時間 (Time Range):" : "Time Range:"}
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {record.Time_start || "N/A"} - {record.Time_end || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "良品数 (Total Quantity):" : "Total Quantity:"}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {Number(record.Total || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "加工数 (Quantity Made):" : "Quantity Made:"}
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {Number(record.Process_Quantity || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "不良合計 (Total NG):" : "Total NG:"}
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {Number(record.Total_NG || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "サイクルタイム (Cycle Time):" : "Cycle Time:"}
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {cycleTimeNum ? `${cycleTimeNum.toFixed(2)}s` : "0s"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "製造ロット (Lot Number):" : "Lot Number:"}
                  </span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {record["製造ロット"] || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "材料ロット (Material Lot):" : "Material Lot:"}
                  </span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {record["材料ロット"] || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pb-0.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    {isJa ? "残ワークオーダー (Remaining WorkOrder):" : "Remaining WorkOrder:"}
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {record.Remaining_WorkOrder ?? "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NG Analysis */}
          {hasNgDetails && (
            <div className="rounded-[8px] border border-rose-500/25 bg-rose-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3 text-rose-600 dark:text-rose-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  warning
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "不良内訳 (NG Analysis)" : "NG Analysis"}
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    疵引処理数 (Scratch Processed Qty)
                  </div>
                  <div className="mt-1 text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                    {record["疵引処理数"] || 0}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    疵引不良 (Non Conforming Supplier)
                  </div>
                  <div className="mt-1 text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                    {record["疵引不良"] || 0}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    加工不良 (Non Conforming Internal)
                  </div>
                  <div className="mt-1 text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                    {record["加工不良"] || 0}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-[11px] font-medium text-[var(--text-muted)]">
                    その他 (Others)
                  </div>
                  <div className="mt-1 text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                    {record["その他"] || 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Work Order Information */}
          {record.WorkOrder_Info && (
            <div className="rounded-[8px] border border-purple-500/25 bg-purple-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  assignment
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "ワークオーダー情報 (Work Order Information)" : "Work Order Information"}
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Work Order Number:</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {record.WorkOrder_Info.workOrderNumber || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Product Name:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {record.WorkOrder_Info.productName || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Assigned Machine:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {record.WorkOrder_Info.assignedMachine || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Required Quantity:</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {Number(record.WorkOrder_Info.requiredQuantity || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Break Time Information */}
          {record.Break_Time_Data && (
            <div className="rounded-[8px] border border-amber-500/25 bg-amber-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  coffee
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "休憩時間情報 (Break Time Information)" : "Break Time Information"}
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Total Break Minutes:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {record.Break_Time_Data.totalBreakMinutes || 0} min
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Total Break Hours:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {record.Break_Time_Data.totalBreakHours || 0} hrs
                  </span>
                </div>
              </div>

              {Array.isArray(record.Break_Time_Data.breakSessions) &&
                record.Break_Time_Data.breakSessions.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Break Sessions ({record.Break_Time_Data.breakSessions.length}):
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {record.Break_Time_Data.breakSessions.map((session, index) => (
                        <div
                          key={index}
                          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[var(--text-primary)]">
                              Session {index + 1}:
                            </span>
                            <span className="font-mono text-[var(--text-secondary)]">
                              {session.startTime} - {session.endTime}
                            </span>
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              {session.durationMinutes} min
                            </span>
                          </div>
                          {session.timestamp && (
                            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                              Recorded: {formatIndianapolisTimestamp(session.timestamp)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* 2-Hour Quality Check Information */}
          {record.Quality_Check_Data && (
            <div className="rounded-[8px] border border-teal-500/25 bg-teal-500/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3 text-teal-600 dark:text-teal-400">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  verified
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa
                    ? "2時間ごとの品質チェック情報 (2-Hour Quality Check Information)"
                    : "2-Hour Quality Check Information"}
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Total Checks:</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {record.Quality_Check_Data.totalChecks || 0}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">Check Interval:</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400">
                    Every {record.Quality_Check_Data.checkIntervalHours || 2} hours
                  </span>
                </div>
              </div>

              {Array.isArray(record.Quality_Check_Data.checkSessions) &&
                record.Quality_Check_Data.checkSessions.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Quality Check Sessions ({record.Quality_Check_Data.checkSessions.length}):
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-2">
                      {record.Quality_Check_Data.checkSessions.map((check, index) => {
                        const scheduledDate = check.scheduledTimestamp
                          ? new Date(check.scheduledTimestamp)
                          : null;
                        const completedDate = check.completedTimestamp
                          ? new Date(check.completedTimestamp)
                          : null;
                        const delayMinutes =
                          scheduledDate && completedDate
                            ? Math.round((completedDate - scheduledDate) / (1000 * 60))
                            : 0;
                        const isDelayed = delayMinutes > 5;

                        return (
                          <div
                            key={index}
                            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-teal-600 dark:text-teal-400">
                                Check #{check.checkNumber || index + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                {isDelayed && (
                                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                                    Delay: +{delayMinutes} min
                                  </span>
                                )}
                                <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                                  Duration: {check.durationSeconds || 0}s ({check.durationMinutes || 0} min)
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[var(--text-muted)]">Scheduled:</span>{" "}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {formatIndianapolisTimestamp(check.scheduledTimestamp)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-muted)]">Completed:</span>{" "}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {formatIndianapolisTimestamp(check.completedTimestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  photo_library
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? `記録画像 (Images: ${images.length})` : `Images (${images.length})`}
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {images.map((image) => (
                  <div
                    key={image.key}
                    className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] p-2.5 text-center"
                  >
                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                      {image.label}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLightboxImage(image)}
                      className="group relative block w-full overflow-hidden rounded-[6px] border border-[var(--border)]"
                    >
                      <img
                        src={image.url}
                        alt={image.label}
                        className="h-44 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[4px] bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          zoom_in
                        </span>
                        {isJa ? "拡大" : "Zoom"}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModalShell>

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <ModalShell
          open={Boolean(lightboxImage)}
          onClose={() => setLightboxImage(null)}
          eyebrow={isJa ? "画像プレビュー" : "Image Preview"}
          title={lightboxImage.label}
          maxWidth="max-w-5xl"
          zIndex="z-[60]"
          footer={
            <div className="flex items-center justify-between w-full">
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:underline"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  open_in_new
                </span>
                {isJa ? "新しいタブで開く" : "Open original in new tab"}
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                {isJa ? "閉じる" : "Close"}
              </button>
            </div>
          }
        >
          <div className="flex items-center justify-center bg-black/90 p-4 max-h-[80vh] overflow-auto">
            <img
              src={lightboxImage.url}
              alt={lightboxImage.label}
              className="max-h-[74vh] max-w-full object-contain rounded-[4px]"
            />
          </div>
        </ModalShell>
      )}
    </>
  );
}

