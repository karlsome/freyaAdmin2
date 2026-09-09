import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getBrokenDownEquipmentCount,
  getEquipmentUnavailableInfo,
  isEquipmentUnavailable,
} from "../../utils/planner";

const PRESET_REASONS = [
  { key: "mechanical", labelJa: "機械故障", labelEn: "Mechanical Failure", icon: "settings" },
  { key: "electrical", labelJa: "電気系統トラブル", labelEn: "Electrical / Sensor Issue", icon: "bolt" },
  { key: "maintenance", labelJa: "定期点検・整備", labelEn: "Scheduled Maintenance", icon: "build" },
  { key: "tooling", labelJa: "金型・治具不良", labelEn: "Tooling / Mold Defect", icon: "architecture" },
  { key: "emergency", labelJa: "非常停止・点検中", labelEn: "Emergency Stop / Inspection", icon: "warning" },
];

export default function PlannerMachineStatusModal({
  open,
  factoryName = "",
  equipment = [],
  unavailableEquipment = {},
  onClose,
  onUpdateStatus,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'operational' | 'broken'
  const [reportingTarget, setReportingTarget] = useState(null); // equipmentName currently being edited
  const [reportingReason, setReportingReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const brokenCount = getBrokenDownEquipmentCount(equipment, unavailableEquipment);
  const operationalCount = Math.max(0, equipment.length - brokenCount);

  const filteredEquipment = equipment.filter((eq) => {
    const isBroken = isEquipmentUnavailable(eq, unavailableEquipment);
    if (filterTab === "operational" && isBroken) return false;
    if (filterTab === "broken" && !isBroken) return false;

    if (!search) return true;
    const query = search.toLowerCase();
    const info = getEquipmentUnavailableInfo(eq, unavailableEquipment);
    return (
      eq.toLowerCase().includes(query)
      || String(info?.reason || "").toLowerCase().includes(query)
    );
  });

  function handleOpenReport(eq) {
    const existing = getEquipmentUnavailableInfo(eq, unavailableEquipment);
    setReportingTarget(eq);
    setReportingReason(existing?.reason || "");
  }

  function handleCloseReport() {
    setReportingTarget(null);
    setReportingReason("");
  }

  async function handleConfirmBreakdown() {
    if (!reportingTarget) return;
    setSubmitting(true);
    try {
      const reason = reportingReason.trim() || (isJa ? "故障・点検中" : "Breakdown / Maintenance");
      await onUpdateStatus(reportingTarget, true, reason);
      handleCloseReport();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkRepaired(eq) {
    setSubmitting(true);
    try {
      await onUpdateStatus(eq, false, "");
      if (reportingTarget === eq) handleCloseReport();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] p-5 bg-[var(--surface)]">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <span className="material-symbols-outlined text-2xl">build</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {isJa ? "設備稼働状況・故障管理" : "Machine Availability & Status"}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)] flex items-center gap-2">
                <span>{isJa ? "工場:" : "Factory:"} <strong className="text-[var(--text-primary)]">{factoryName || "—"}</strong></span>
                <span>·</span>
                <span>{isJa ? `総設備数: ${equipment.length}台` : `Total: ${equipment.length} machines`}</span>
                <span>·</span>
                <span className={brokenCount > 0 ? "font-bold text-[var(--status-danger)]" : "text-emerald-600 font-semibold"}>
                  {brokenCount > 0
                    ? (isJa ? `${brokenCount}台 故障・停止中` : `${brokenCount} broken down`)
                    : (isJa ? "全機 正常稼働中" : "0 broken down")}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Toolbar: Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 w-full sm:w-64 focus-within:border-[var(--freya-blue)] transition-colors shadow-2xs">
            <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isJa ? "設備名・理由で検索..." : "Filter equipment..."}
              className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${filterTab === "all" ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              {isJa ? "すべて" : "All"} ({equipment.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("operational")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${filterTab === "operational" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-xs border border-emerald-500/30" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              {isJa ? "稼働中" : "Operational"} ({operationalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("broken")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${filterTab === "broken" ? "bg-red-500/15 text-red-700 dark:text-red-300 shadow-xs border border-red-500/30" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              {isJa ? "停止中" : "Broken Down"} ({brokenCount})
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {reportingTarget ? (
            /* Inline Breakdown Reporter Form */
            <div className="mb-5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-red-200 dark:border-red-900/60 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400">warning</span>
                  <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                    {isJa ? `設備停止の登録・理由変更: ${reportingTarget}` : `Report Breakdown: ${reportingTarget}`}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleCloseReport}
                  className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {isJa ? "キャンセル" : "Cancel"}
                </button>
              </div>

              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                {isJa ? "故障・保全理由を選択または入力:" : "Breakdown / Maintenance Reason:"}
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRESET_REASONS.map((preset) => {
                  const text = isJa ? preset.labelJa : preset.labelEn;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setReportingReason(text)}
                      className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] transition-colors shadow-2xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs" style={{ fontSize: 14 }}>{preset.icon}</span>
                      <span>{text}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={reportingReason}
                onChange={(e) => setReportingReason(e.target.value)}
                placeholder={isJa ? "例: モーター異常、金型交換、定期点検..." : "e.g. Spindle malfunction, Motor replacement, Emergency stop..."}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-2xs"
              />

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseReport}
                  disabled={submitting}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition cursor-pointer"
                >
                  {isJa ? "戻る" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBreakdown}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 shadow-sm transition cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>report_problem</span>
                  <span>{isJa ? "停止状態として登録" : "Mark as Broken Down"}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">{isJa ? "設備名" : "Equipment"}</th>
                  <th className="px-4 py-3">{isJa ? "稼働状況" : "Machine Status"}</th>
                  <th className="px-4 py-3">{isJa ? "故障・保全理由" : "Breakdown / Reason"}</th>
                  <th className="px-4 py-3 text-right">{isJa ? "操作" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-xs text-[var(--text-muted)]">
                      {isJa ? "対象の設備が見つかりません" : "No equipment matching filters."}
                    </td>
                  </tr>
                ) : (
                  filteredEquipment.map((eq) => {
                    const isBroken = isEquipmentUnavailable(eq, unavailableEquipment);
                    const info = isBroken ? getEquipmentUnavailableInfo(eq, unavailableEquipment) : null;

                    return (
                      <tr key={eq} className="hover:bg-[var(--surface-hover)]/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-xs text-[var(--text-primary)]">
                          {eq}
                        </td>
                        <td className="px-4 py-3">
                          {isBroken ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 dark:border-red-800 bg-red-100/90 dark:bg-red-950/60 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300 shadow-2xs">
                              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                              <span>{isJa ? "停止中 / 故障" : "Broken Down"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 dark:border-emerald-800 bg-emerald-100/90 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span>{isJa ? "正常稼働中" : "Operational"}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                          {isBroken && info?.reason ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-red-600 dark:text-red-400">{info.reason}</span>
                              {info.reportedBy ? (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {isJa ? `報告者: ${info.reportedBy}` : `Reported by: ${info.reportedBy}`}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isBroken ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenReport(eq)}
                                disabled={submitting}
                                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition cursor-pointer"
                              >
                                {isJa ? "理由変更" : "Edit"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkRepaired(eq)}
                                disabled={submitting}
                                className="flex items-center gap-1 rounded-[6px] border border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 disabled:opacity-50 transition shadow-2xs cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs" style={{ fontSize: 14 }}>check_circle</span>
                                <span>{isJa ? "復旧・稼働再開" : "Mark Repaired"}</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenReport(eq)}
                              disabled={submitting}
                              className="rounded-[6px] border border-red-300 dark:border-red-800 bg-red-50/70 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300 disabled:opacity-50 transition shadow-2xs cursor-pointer"
                            >
                              {isJa ? "故障報告" : "Report Breakdown"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">
            {isJa
              ? "停止中の設備はタイムライン上に警告表示され、自動計画から除外されます。"
              : "Broken-down machines are flagged on the timeline and skipped during auto-scheduling."}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition shadow-2xs cursor-pointer"
          >
            {isJa ? "閉じる" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
