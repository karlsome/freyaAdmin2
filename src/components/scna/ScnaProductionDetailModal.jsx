import { useState } from "react";
import ModalShell from "../ModalShell";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getRecordBreakData,
  getRecordImages,
  getRecordQualityChecks,
} from "../../utils/scna";

export default function ScnaProductionDetailModal({ open, record, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!open || !record) return null;

  const images = getRecordImages(record);
  const breakData = getRecordBreakData(record);
  const qualityCheckData = getRecordQualityChecks(record);

  const hasWorkOrder = Boolean(
    record.WorkOrder_Info &&
      (record.WorkOrder_Info.isWorkOrder || record.WorkOrder_Info.workOrderNumber)
  );

  const cycleTimeNum = parseFloat(record.Cycle_Time);
  const formattedCycleTime = !Number.isNaN(cycleTimeNum)
    ? `${cycleTimeNum}s`
    : "N/A";

  const formattedDate = record.Date || "N/A";
  const hasScratchProcessed = Object.prototype.hasOwnProperty.call(
    record,
    "疵引処理数"
  );

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        eyebrow={isJa ? "SCNA 生産実績" : "SCNA Production Record"}
        title={isJa ? "生産記録詳細" : "Production Record Details"}
        subtitle={`${record["設備"] || "N/A"} • ${formattedDate} (${record.Time_start || "N/A"} - ${record.Time_end || "N/A"})`}
        maxWidth="max-w-5xl"
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
        <div className="max-h-[78vh] overflow-y-auto p-6 space-y-6">
          {/* Top Grid: Production Information (2 cols) + Production Stats & NG Analysis (1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Production Information */}
            <div className="lg:col-span-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>
                  precision_manufacturing
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "生産情報 (Production Information)" : "Production Information"}
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      {isJa ? "日付 (Date)" : "Date"}
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-sm text-[var(--text-primary)]">
                      {formattedDate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      Equipment (設備)
                    </dt>
                    <dd className="mt-0.5 font-semibold text-sm text-[var(--text-primary)]">
                      {record["設備"] || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      Part Number (品番)
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-sm text-[var(--text-primary)]">
                      {record["品番"] || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      Background Number (背番号)
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-sm text-[var(--text-primary)]">
                      {record["背番号"] || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      {isJa ? "作業者名 (Worker Name)" : "Worker Name"}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-sm text-[var(--text-primary)]">
                      {record.Worker_Name || "N/A"}
                    </dd>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      {isJa ? "稼働時間範囲 (Time Range)" : "Time Range"}
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-sm text-[var(--text-primary)]">
                      {record.Time_start || "N/A"} - {record.Time_end || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      {isJa ? "総稼働時間 (Total Work Hours)" : "Total Work Hours"}
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-sm text-[var(--text-primary)]">
                      {record.Total_Work_Hours != null && record.Total_Work_Hours !== ""
                        ? `${record.Total_Work_Hours} hours`
                        : "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      Material Lot (材料ロット)
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-sm text-[var(--text-primary)] break-all">
                      {record["材料ロット"] || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-[var(--text-muted)]">
                      {isJa ? "コメント (Comment)" : "Comment"}
                    </dt>
                    <dd className="mt-0.5 text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
                      {record.Comment || "N/A"}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Production Stats + NG Analysis */}
            <div className="space-y-4">
              {/* Production Stats */}
              <div className="rounded-[8px] border border-blue-500/25 bg-blue-500/[0.06] p-4">
                <div className="flex items-center gap-2 mb-3 text-blue-700 dark:text-blue-400">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    monitoring
                  </span>
                  <h5 className="text-sm font-semibold">
                    {isJa ? "生産統計 (Production Stats)" : "Production Stats"}
                  </h5>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-blue-700 dark:text-blue-300">Quantity Made:</span>
                    <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                      {Number(record.Process_Quantity || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-blue-700 dark:text-blue-300">Actual Total:</span>
                    <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                      {Number(record.Total || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-blue-700 dark:text-blue-300">Cycle Time:</span>
                    <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                      {formattedCycleTime}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-blue-700 dark:text-blue-300">Shot Count:</span>
                    <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                      {record["ショット数"] != null && record["ショット数"] !== ""
                        ? Number(record["ショット数"]).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* NG Analysis */}
              <div className="rounded-[8px] border border-rose-500/25 bg-rose-500/[0.06] p-4">
                <div className="flex items-center gap-2 mb-3 text-rose-700 dark:text-rose-400">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    warning
                  </span>
                  <h5 className="text-sm font-semibold">
                    {isJa ? "不良内訳 (NG Analysis)" : "NG Analysis"}
                  </h5>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-rose-700 dark:text-rose-300">Total NG:</span>
                    <span className="font-mono font-semibold text-rose-950 dark:text-rose-100">
                      {Number(record.Total_NG || 0).toLocaleString()}
                    </span>
                  </div>
                  {hasScratchProcessed && (
                    <div className="flex justify-between gap-2">
                      <span className="text-rose-700 dark:text-rose-300">
                        {isJa ? "疵引処理数:" : "Scratch Processed Qty (疵引処理数):"}
                      </span>
                      <span className="font-mono font-semibold text-rose-950 dark:text-rose-100">
                        {Number(record["疵引処理数"] ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-rose-700 dark:text-rose-300">
                      Non Conforming (Internal):
                    </span>
                    <span className="font-mono font-semibold text-rose-950 dark:text-rose-100">
                      {Number(record["疵引不良"] || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-rose-700 dark:text-rose-300">
                      Non Conforming (Supplier):
                    </span>
                    <span className="font-mono font-semibold text-rose-950 dark:text-rose-100">
                      {Number(record["加工不良"] || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-rose-700 dark:text-rose-300">Others:</span>
                    <span className="font-mono font-semibold text-rose-950 dark:text-rose-100">
                      {Number(record["その他"] || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Work Order Information */}
          {hasWorkOrder && (
            <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4 text-emerald-800 dark:text-emerald-300">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  assignment
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "ワークオーダー情報 (Work Order Information)" : "Work Order Information"}
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <dt className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Work Order Number
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                    {record.WorkOrder_Info.workOrderNumber || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      {record.WorkOrder_Info.status || "N/A"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    SKU
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                    {record.WorkOrder_Info.sku || record.WorkOrder_Info.productName || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Assigned To
                  </dt>
                  <dd className="mt-1 font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                    {record.WorkOrder_Info.assignedTo ||
                      record.WorkOrder_Info.assignedMachine ||
                      "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    NC Program Sent
                  </dt>
                  <dd className="mt-1 font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                    {record.WorkOrder_Info.ncProgramSent ? "Yes" : "No"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Target Machines
                  </dt>
                  <dd className="mt-1 font-semibold text-sm text-emerald-950 dark:text-emerald-100">
                    {Array.isArray(record.WorkOrder_Info.targetMachines)
                      ? record.WorkOrder_Info.targetMachines.join(", ")
                      : record.WorkOrder_Info.targetMachines || "N/A"}
                  </dd>
                </div>
              </div>
            </div>
          )}

          {/* Break Time Information */}
          {breakData.hasBreakData && (
            <div className="rounded-[8px] border border-amber-500/25 bg-amber-500/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  coffee
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "休憩時間情報 (Break Time Information)" : "Break Time Information"}
                </h4>
              </div>

              {breakData.entries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                  {breakData.entries.map((entry) => (
                    <div key={entry.key}>
                      <dt className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                        {entry.label}
                      </dt>
                      <dd className="mt-1 font-mono text-sm text-amber-950 dark:text-amber-100">
                        {entry.start} - {entry.end}
                      </dd>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-8 text-xs">
                <div>
                  <dt className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Total Break Minutes
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-sm text-amber-950 dark:text-amber-100">
                    {breakData.totalBreakMinutes} minutes
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Total Break Hours
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-sm text-amber-950 dark:text-amber-100">
                    {breakData.totalBreakHours} hours
                  </dd>
                </div>
              </div>
            </div>
          )}

          {/* Quality Check Information */}
          {qualityCheckData.hasQualityChecks && (
            <div className="rounded-[8px] border border-purple-500/25 bg-purple-500/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3 text-purple-800 dark:text-purple-300">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  verified
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "品質チェック情報 (Quality Check Information)" : "Quality Check Information"}
                </h4>
              </div>

              <div className="mb-4 text-xs">
                <span className="text-purple-700 dark:text-purple-400">Total Checks: </span>
                <span className="font-mono font-semibold text-purple-950 dark:text-purple-100">
                  {qualityCheckData.totalChecks}
                </span>
              </div>

              {qualityCheckData.checks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {qualityCheckData.checks.map((check) => (
                    <div
                      key={check.key}
                      className="rounded-[6px] border border-purple-500/25 bg-[var(--surface)] p-3.5 text-xs"
                    >
                      <h6 className="font-semibold text-sm text-purple-900 dark:text-purple-200">
                        Check {check.checkNumber}
                      </h6>
                      <div className="mt-2 space-y-1">
                        <div>
                          <span className="text-purple-700 dark:text-purple-400">
                            Checker:{" "}
                          </span>
                          <span className="font-medium text-purple-950 dark:text-purple-100">
                            {check.checkerName}
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-700 dark:text-purple-400">
                            Time (Indiana):{" "}
                          </span>
                          <span className="font-mono font-medium text-purple-950 dark:text-purple-100">
                            {check.displayTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  photo_library
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? `画像 (Images: ${images.length})` : `Images (${images.length})`}
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div key={image.key} className="space-y-1.5">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">
                      {isJa && image.labelJa ? image.labelJa : image.label}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLightboxImage(image)}
                      className="group relative block w-full overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)]"
                    >
                      <img
                        src={image.url}
                        alt={image.label}
                        className="h-32 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[4px] bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
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


