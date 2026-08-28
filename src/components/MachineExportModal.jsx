import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchNgReportsByRecordIds } from "../services/api";
import {
  buildMachineChecklistMatrix,
  openTraditionalChecklistPrintWindow,
  openDigitalChecklistPrintWindow,
  downloadMachineChecklistCSV,
} from "../utils/machineChecklistExport";

export default function MachineExportModal({
  machine,
  templates = [],
  records = [],
  currentDates = [],
  currentDateRange = { startDate: "", endDate: "" },
  equipmentMap = null,
  onClose,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [styleMode, setStyleMode] = useState("traditional"); // "traditional" | "digital"
  const [fileType, setFileType] = useState("pdf"); // "pdf" | "csv"
  const [scopeMode, setScopeMode] = useState("month"); // "month" | "current"
  const [exportLanguage, setExportLanguage] = useState("ja"); // "ja" (default) | "en"
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (!machine) return;
    const machineId = String(machine.id || machine._id || "");
    const machineName = String(machine.name || machine.設備名 || "").trim();
    const machineRecords = records.filter((rec) => {
      const recMId = String(rec.machineId || rec.equipmentId || "");
      const recMName = String(rec.machineName || "").trim();
      return (recMId && recMId === machineId) || (recMName && recMName === machineName);
    });
    const recordIds = machineRecords.map((r) => String(r._id || r.recordId || "")).filter(Boolean);
    if (recordIds.length > 0) {
      fetchNgReportsByRecordIds(recordIds)
        .then((data) => setTickets(Array.isArray(data) ? data : []))
        .catch(() => setTickets([]));
    } else {
      setTickets([]);
    }
  }, [machine, records]);

  if (!machine) return null;

  function getTargetDates() {
    if (scopeMode === "current" && currentDates.length > 0) {
      return currentDates;
    }

    // Default to full month of today or current start date
    const baseDate = currentDateRange.startDate ? new Date(currentDateRange.startDate) : new Date();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthDates = [];
    for (let day = 1; day <= lastDay; day++) {
      monthDates.push(new Date(year, month, day));
    }
    return monthDates;
  }

  function getPeriodLabel(targetLang = exportLanguage) {
    const dates = getTargetDates();
    if (!dates.length) return "";
    const first = dates[0];
    const last = dates[dates.length - 1];
    const isTargetJa = targetLang === "ja";

    if (scopeMode === "month" || (first.getMonth() === last.getMonth() && first.getDate() === 1)) {
      if (isTargetJa) {
        return `${first.getFullYear()}年${first.getMonth() + 1}月`;
      }
      return `${first.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
    }
    if (isTargetJa) {
      return `${first.getMonth() + 1}月${first.getDate()}日 ～ ${last.getMonth() + 1}月${last.getDate()}日`;
    }
    return `${first.toLocaleString("en-US", { month: "short", day: "numeric" })} – ${last.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  function handleExport() {
    const targetDates = getTargetDates();
    const periodLabel = getPeriodLabel(exportLanguage);

    const matrixData = buildMachineChecklistMatrix({
      machine,
      templates,
      records,
      dates: targetDates,
      equipmentMap,
      language: exportLanguage,
      tickets,
    });

    if (fileType === "csv") {
      downloadMachineChecklistCSV(matrixData, periodLabel, styleMode);
    } else {
      if (styleMode === "traditional") {
        openTraditionalChecklistPrintWindow(matrixData, periodLabel);
      } else {
        openDigitalChecklistPrintWindow(matrixData, periodLabel);
      }
    }

    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="dashboard-section w-full max-w-lg overflow-hidden rounded-2xl border border-separator/50 bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-separator/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>file_export</span>
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                {isJa ? "設備点検帳票出力" : "Machine Checklist Export"}
              </p>
              <h3 className="text-base font-bold text-on-surface">
                {machine.name} {machine.factory && <span className="text-xs font-normal text-outline">({machine.factory})</span>}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isJa ? "閉じる" : "Close"}
            className="rounded-xl p-2 text-outline hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 px-6 py-5">
          {/* Step 1: Format Style Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-2">
              {isJa ? "1. 帳票レイアウト形式" : "1. Layout Style"}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStyleMode("traditional")}
                className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                  styleMode === "traditional"
                    ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                    : "border-outline-variant/30 bg-surface-container/40 hover:bg-surface-container"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>article</span>
                    {isJa ? "紙台帳風 (Traditional)" : "Traditional Matrix"}
                  </span>
                  {styleMode === "traditional" && (
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>check_circle</span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-outline">
                  {isJa
                    ? "現場の紙点検記録（○✕・実測値記入表）と同じマトリクス表レイアウト。責任者確認印欄・ガイド写真付き。"
                    : "Paper inspection ledger matrix layout with daily check marks, measured values, approval stamps, and guide photos."}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStyleMode("digital")}
                className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                  styleMode === "digital"
                    ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                    : "border-outline-variant/30 bg-surface-container/40 hover:bg-surface-container"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>dashboard</span>
                    {isJa ? "デジタル風 (Digital)" : "Digital Executive"}
                  </span>
                  {styleMode === "digital" && (
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>check_circle</span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-outline">
                  {isJa
                    ? "実施率統計、KPIカード、合格率サマリーを含む現代風エグゼクティブ・監査用レポート。"
                    : "Executive compliance report featuring completion statistics, KPI scorecards, pass rate breakdown, and audit log."}
                </p>
              </button>
            </div>
          </div>

          {/* Step 2: File Format */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-2">
              {isJa ? "2. 出力ファイル種別" : "2. Output Type"}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFileType("pdf")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition-all ${
                  fileType === "pdf"
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span>
                {isJa ? "PDF 印刷 / 保存" : "Print / PDF Export"}
              </button>

              <button
                type="button"
                onClick={() => setFileType("csv")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition-all ${
                  fileType === "csv"
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>csv</span>
                {isJa ? "CSV ダウンロード" : "Download CSV"}
              </button>
            </div>
          </div>

          {/* Step 3: Date Scope */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-2">
              {isJa ? "3. 出力対象期間" : "3. Date Period"}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScopeMode("current")}
                className={`flex-1 rounded-xl border py-2 px-3 text-xs font-medium transition-all ${
                  scopeMode === "current"
                    ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                    : "border-outline-variant/25 bg-surface-container text-outline hover:text-on-surface"
                }`}
              >
                {isJa
                  ? `タイムライン表示期間 (${currentDates.length}日間)`
                  : `Current Timeline (${currentDates.length} Days)`}
              </button>
              <button
                type="button"
                onClick={() => setScopeMode("month")}
                className={`flex-1 rounded-xl border py-2 px-3 text-xs font-medium transition-all ${
                  scopeMode === "month"
                    ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                    : "border-outline-variant/25 bg-surface-container text-outline hover:text-on-surface"
                }`}
              >
                {isJa ? "月間一括 (1日～末日)" : "Full Month (1st – End of Month)"}
              </button>
            </div>
          </div>

          {/* Step 4: Output Language */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-outline mb-2">
              {isJa ? "4. 帳票出力言語 (Report Language)" : "4. Report Output Language"}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportLanguage("ja")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition-all ${
                  exportLanguage === "ja"
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="text-sm">🇯🇵</span>
                日本語 (Japanese)
              </button>

              <button
                type="button"
                onClick={() => setExportLanguage("en")}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition-all ${
                  exportLanguage === "en"
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span className="text-sm">🇺🇸</span>
                English (英語)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-separator/40 bg-surface-container/30 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-xs font-semibold text-outline hover:text-on-surface transition-colors"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-on-primary shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {fileType === "pdf" ? "print" : "download"}
            </span>
            {fileType === "pdf"
              ? (isJa ? "帳票を開く (Print / PDF)" : "Open Report (Print / PDF)")
              : (isJa ? "CSV出力 (Download)" : "Export CSV")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
