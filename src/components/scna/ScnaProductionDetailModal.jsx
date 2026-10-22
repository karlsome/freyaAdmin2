import { useState } from "react";
import ModalShell from "../ModalShell";
import SensorDevicePhotoPreviewModal from "../SensorDevicePhotoPreviewModal";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getRecordBreakData,
  getRecordImages,
  getRecordQualityChecks,
} from "../../utils/scna";


const fmtNum = (v, digits) => {
  const n = Number(v);
  if (v == null || v === "" || Number.isNaN(n)) return "—";
  return digits != null ? n.toFixed(digits) : n.toLocaleString();
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const COUNT_SOURCE_LABELS = {
  "auto-confirmed": "Auto (confirmed)",
  "auto-edited": "Auto (edited)",
  manual: "Manual",
};

export default function ScnaProductionDetailModal({ open, record, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [photoPreview, setPhotoPreview] = useState(null);

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

  // New-format records (box traceability) carry these; legacy records simply don't.
  const lotDetails = Array.isArray(record.Lot_Details) ? record.Lot_Details : [];
  const spareLots = Array.isArray(record.Spare_Lots) ? record.Spare_Lots : [];
  const boxIds = Array.isArray(record.Box_IDs) ? record.Box_IDs : [];
  const machineSummary =
    record.Machine_Summary && typeof record.Machine_Summary === "object"
      ? Object.entries(record.Machine_Summary)
      : [];
  const hasTrace = Boolean(record.Run_ID) || boxIds.length > 0;
  const hasLotDetails = lotDetails.length > 0;
  const hasCycleInfo = lotDetails.some(
    (l) => l.cycleSecMedian != null || l.cyclesTotalStart != null || l.shotsAuto != null
  );

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
                  {record.Total_Pieces != null && (
                    <div className="flex justify-between gap-2">
                      <span className="text-blue-700 dark:text-blue-300">Total Pieces:</span>
                      <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                        {fmtNum(record.Total_Pieces)}
                      </span>
                    </div>
                  )}
                  {record.Total_Meters != null && (
                    <div className="flex justify-between gap-2">
                      <span className="text-blue-700 dark:text-blue-300">Total Meters:</span>
                      <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                        {fmtNum(record.Total_Meters, 2)}
                      </span>
                    </div>
                  )}
                  {Number(record["スペアからの部分数"]) > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-blue-700 dark:text-blue-300">From Spare:</span>
                      <span className="font-mono font-semibold text-blue-950 dark:text-blue-100">
                        {fmtNum(record["スペアからの部分数"])}
                      </span>
                    </div>
                  )}
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


          {/* Run & Box Traceability (new records only) */}
          {hasTrace && (
            <div className="rounded-[8px] border border-sky-500/25 bg-sky-500/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4 text-sky-800 dark:text-sky-300">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  inventory_2
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? "ラン・箱トレーサビリティ (Run & Box Traceability)" : "Run & Box Traceability"}
                </h4>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <dt className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Run ID</dt>
                  <dd className="mt-1 font-mono font-semibold text-sm text-sky-950 dark:text-sky-100 break-all">
                    {record.Run_ID || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
                    {isJa ? `箱ID (Box IDs: ${boxIds.length})` : `Box IDs (${boxIds.length})`}
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {boxIds.length === 0 && <span className="text-[var(--text-muted)]">—</span>}
                    {boxIds.map((id) => (
                      <span
                        key={id}
                        className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-sky-900 dark:text-sky-200"
                      >
                        {id}
                      </span>
                    ))}
                  </dd>
                </div>
              </div>
            </div>
          )}

          {/* Lot Details (per lot, per machine) */}
          {hasLotDetails && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>
                  list_alt
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa ? `ロット詳細 (Lot Details: ${lotDetails.length})` : `Lot Details (${lotDetails.length})`}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] text-[var(--text-muted)]">
                      <th className="py-2 pr-3 font-medium">Lot</th>
                      <th className="py-2 pr-3 font-medium">Machine</th>
                      <th className="py-2 pr-3 text-right font-medium">Shots</th>
                      <th className="py-2 pr-3 text-right font-medium">Pcs/Cycle</th>
                      <th className="py-2 pr-3 text-right font-medium">Pieces</th>
                      <th className="py-2 pr-3 text-right font-medium">Meters</th>
                      {hasCycleInfo && (
                        <>
                          <th className="py-2 pr-3 font-medium">Count Source</th>
                          <th className="py-2 pr-3 text-right font-medium">Cycle (median)</th>
                        </>
                      )}
                      <th className="py-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotDetails.map((lot, i) => (
                      <tr key={`${lot.lotNumber}-${i}`} className="border-b border-[var(--border)]/60 last:border-0">
                        <td className="py-2 pr-3 font-mono font-semibold text-[var(--text-primary)]">
                          {lot.lotNumber || "—"}
                        </td>
                        <td className="py-2 pr-3 text-[var(--text-primary)]">{lot.machine || "—"}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtNum(lot.shots)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtNum(lot.pcPerCycle)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtNum(lot.pieces)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtNum(lot.meters, 2)}</td>
                        {hasCycleInfo && (
                          <>
                            <td className="py-2 pr-3">
                              {lot.countSource
                                ? COUNT_SOURCE_LABELS[lot.countSource] || lot.countSource
                                : "—"}
                              {lot.shotsAuto != null && lot.shotsAuto !== lot.shots && (
                                <span className="ml-1 text-[var(--text-muted)]">
                                  (auto {fmtNum(lot.shotsAuto)})
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {lot.cycleSecMedian != null ? `${fmtNum(lot.cycleSecMedian, 1)}s` : "—"}
                            </td>
                          </>
                        )}
                        <td className="py-2 font-mono text-[var(--text-muted)]">{fmtTime(lot.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {machineSummary.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {machineSummary.map(([machine, m]) => (
                    <div key={machine} className="rounded-[6px] border border-[var(--border)] p-3">
                      <div className="font-semibold text-[var(--text-primary)]">{machine}</div>
                      <div className="mt-1 text-[var(--text-secondary)]">
                        {Object.entries(m || {})
                          .filter(([, v]) => v == null || typeof v !== "object")
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spare lots added into this run's boxes */}
          {spareLots.length > 0 && (
            <div className="rounded-[8px] border border-orange-500/25 bg-orange-500/[0.06] p-5">
              <div className="flex items-center gap-2 mb-4 text-orange-800 dark:text-orange-300">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  add_box
                </span>
                <h4 className="text-sm font-semibold">
                  {isJa
                    ? `スペアからの部分数 (Spare Lots: ${spareLots.length})`
                    : `Partial From Spare (${spareLots.length})`}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-orange-500/20 text-left text-[11px] text-orange-700 dark:text-orange-400">
                      <th className="py-2 pr-3 font-medium">Lot</th>
                      <th className="py-2 pr-3 text-right font-medium">Pieces</th>
                      <th className="py-2 pr-3 font-medium">Added</th>
                      <th className="py-2 pr-3 font-medium">Worker</th>
                      <th className="py-2 font-medium">Used in box</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spareLots.map((sp, i) => (
                      <tr key={`${sp.lotNumber}-${i}`} className="border-b border-orange-500/10 last:border-0">
                        <td className="py-2 pr-3 font-mono font-semibold text-orange-950 dark:text-orange-100">
                          {sp.lotNumber || "—"}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtNum(sp.pieces)}</td>
                        <td className="py-2 pr-3 font-mono">{fmtTime(sp.at)}</td>
                        <td className="py-2 pr-3">{sp.worker || "—"}</td>
                        <td className="py-2 font-mono">
                          {sp.consumedByBoxUid ? "Yes" : <span className="text-[var(--text-muted)]">Not yet</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-orange-800 dark:text-orange-300">
                {isJa ? "スペアからの部分数合計" : "Total from spare"}:{" "}
                <span className="font-mono font-semibold">{fmtNum(record["スペアからの部分数"])}</span>
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
                {images.map((image, index) => (
                  <div key={image.key} className="space-y-1.5">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">
                      {isJa && image.labelJa ? image.labelJa : image.label}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoPreview({
                          eyebrow: isJa ? "SCNA 記録画像" : "SCNA Record Photos",
                          displayName:
                            record["品番"] ||
                            (isJa ? "生産記録画像" : "Production Record Image"),
                          subtitle: `${record["設備"] || "N/A"} • ${formattedDate} (${record.Time_start || "N/A"} - ${record.Time_end || "N/A"})`,
                          images: images.map((img) => ({
                            url: img.url,
                            label: isJa && img.labelJa ? img.labelJa : img.label,
                          })),
                          activeIndex: index,
                        })
                      }
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

      <SensorDevicePhotoPreviewModal
        preview={photoPreview}
        onClose={() => setPhotoPreview(null)}
        onNavigate={(direction) => {
          setPhotoPreview((current) => {
            if (!current || !Array.isArray(current.images) || current.images.length <= 1) {
              return current;
            }
            const nextIndex =
              (current.activeIndex + direction + current.images.length) %
              current.images.length;
            return {
              ...current,
              activeIndex: nextIndex,
            };
          });
        }}
      />
    </>
  );
}


