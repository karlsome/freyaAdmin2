import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useLanguage } from "../../contexts/LanguageContext";
import ScnaMachineExportModal from "./ScnaMachineExportModal";
import ScnaMachineTimelineChart from "./ScnaMachineTimelineChart";
import ScnaProductionDetailModal from "./ScnaProductionDetailModal";
import {
  fetchScnaMachineAnalytics,
  fetchScnaMachines,
  fetchWorkOrderAssignees,
} from "../../services/scnaApi";
import { getDefaultMachineAnalyticsDates } from "../../utils/scna";

const SELECTED_MACHINES_STORAGE_KEY = "selectedMachines";

function loadSavedMachines() {
  try {
    const raw = localStorage.getItem(SELECTED_MACHINES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function ScnaMachineAnalyticsTab({ onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const defaultDates = useMemo(() => getDefaultMachineAnalyticsDates(), []);

  const [dateFromInput, setDateFromInput] = useState(defaultDates.dateFrom);
  const [dateToInput, setDateToInput] = useState(defaultDates.dateTo);
  const [appliedDates, setAppliedDates] = useState(defaultDates);

  const [availableMachines, setAvailableMachines] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [detailRecord, setDetailRecord] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingPdfMachine, setExportingPdfMachine] = useState(null);

  const allCheckboxRef = useRef(null);
  const chartRefs = useRef({});
  const requestIdRef = useRef(0);

  // Load machine options from assignees and SCNA machines endpoints
  useEffect(() => {
    let cancelled = false;

    async function loadMachines() {
      try {
        const [assignees, scnaMachines] = await Promise.all([
          fetchWorkOrderAssignees().catch(() => []),
          fetchScnaMachines().catch(() => []),
        ]);

        if (cancelled) return;

        const combined = Array.from(
          new Set([...assignees, ...scnaMachines].filter(Boolean))
        ).sort();

        if (combined.length > 0) {
          setAvailableMachines((prev) => {
            const next = Array.from(new Set([...prev, ...combined])).sort();
            const saved = loadSavedMachines();
            setSelectedMachines((currentSelected) => {
              if (currentSelected.length > 0) return currentSelected;
              if (saved && saved.length > 0) {
                const validSaved = saved.filter((m) => next.includes(m));
                if (validSaved.length > 0) return validSaved;
              }
              return next;
            });
            return next;
          });
        }
      } catch {
        // Fallback to records-derived machines
      }
    }

    void loadMachines();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  // Fetch Machine Analytics data
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    async function loadAnalytics() {
      if (!appliedDates.dateFrom || !appliedDates.dateTo) return;
      setLoading(true);
      setError("");

      try {
        const result = await fetchScnaMachineAnalytics({
          dateFrom: appliedDates.dateFrom,
          dateTo: appliedDates.dateTo,
          machine: "all",
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        if (!result?.success) {
          throw new Error(
            result?.message || "Failed to load machine analytics data"
          );
        }

        const nextRecords = Array.isArray(result.data) ? result.data : [];
        setRecords(nextRecords);

        // Extract machines from records as well
        const recordMachines = Array.from(
          new Set(nextRecords.map((item) => item["設備"]).filter(Boolean))
        ).sort();

        if (recordMachines.length > 0) {
          setAvailableMachines((prev) => {
            const merged = Array.from(
              new Set([...prev, ...recordMachines])
            ).sort();
            setSelectedMachines((currentSelected) => {
              if (currentSelected.length > 0) return currentSelected;
              const saved = loadSavedMachines();
              if (saved && saved.length > 0) {
                const validSaved = saved.filter((m) => merged.includes(m));
                if (validSaved.length > 0) return validSaved;
              }
              return merged;
            });
            return merged;
          });
        }
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRecords([]);
        setError(
          err.message ||
            (isJa
              ? "設備稼働分析データの取得に失敗しました。"
              : "Failed to load machine analytics data.")
        );
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [appliedDates.dateFrom, appliedDates.dateTo, isJa, refreshNonce]);

  // Keep indeterminate state of "All" checkbox in sync
  useEffect(() => {
    if (!allCheckboxRef.current) return;
    const total = availableMachines.length;
    const selected = selectedMachines.length;
    allCheckboxRef.current.indeterminate = selected > 0 && selected < total;
  }, [availableMachines.length, selectedMachines.length]);

  function persistSelectedMachines(nextMachines) {
    setSelectedMachines(nextMachines);
    try {
      localStorage.setItem(
        SELECTED_MACHINES_STORAGE_KEY,
        JSON.stringify(nextMachines)
      );
    } catch {
      // ignore storage errors
    }
  }

  function handleToggleAllMachines(checked) {
    if (checked) {
      persistSelectedMachines([...availableMachines]);
    } else {
      persistSelectedMachines([]);
    }
  }

  function handleDeselectAllMachines() {
    persistSelectedMachines([]);
  }

  function handleToggleMachine(machine, checked) {
    if (checked) {
      persistSelectedMachines(
        Array.from(new Set([...selectedMachines, machine]))
      );
    } else {
      persistSelectedMachines(selectedMachines.filter((m) => m !== machine));
    }
  }

  function handleApplyDates() {
    if (!dateFromInput || !dateToInput) {
      onFlash?.({
        type: "warning",
        message: isJa
          ? "開始日と終了日の両方を選択してください。"
          : "Please select both From Date and To Date.",
      });
      return;
    }
    setAppliedDates({
      dateFrom: dateFromInput,
      dateTo: dateToInput,
    });
  }

  // Group records by machine for selected machines that have data
  const machinesWithData = useMemo(() => {
    const grouped = {};
    selectedMachines.forEach((m) => {
      grouped[m] = [];
    });

    records.forEach((record) => {
      const m = record["設備"];
      if (m && grouped[m]) {
        grouped[m].push(record);
      }
    });

    return selectedMachines
      .filter((m) => grouped[m] && grouped[m].length > 0)
      .map((m) => ({
        machine: m,
        records: grouped[m],
      }));
  }, [records, selectedMachines]);

  // Filtered records for CSV export
  const filteredExportRecords = useMemo(
    () =>
      records.filter(
        (item) => !item["設備"] || selectedMachines.includes(item["設備"])
      ),
    [records, selectedMachines]
  );

  // Per-machine A3 Landscape PDF Export matching exportMachinePDF in scnaMachineAnalytics.js
  async function handleExportMachinePdf(machine, machineRecords) {
    if (!machineRecords || machineRecords.length === 0) {
      onFlash?.({
        type: "warning",
        message: isJa
          ? `設備 ${machine} のデータがありません。`
          : `No data found for machine ${machine}.`,
      });
      return;
    }

    setExportingPdfMachine(machine);
    try {
      const pdf = new jsPDF("l", "mm", "a3");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // PAGE 1: Header + Summary + Legend + Timeline Chart Image
      pdf.setFontSize(22);
      pdf.setFont(undefined, "bold");
      pdf.text(`Machine Downtime Analytics - ${machine}`, margin, 20);

      pdf.setFontSize(13);
      pdf.setFont(undefined, "normal");
      pdf.text(
        `Date Range: ${appliedDates.dateFrom} to ${appliedDates.dateTo}`,
        margin,
        29
      );
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 36);

      const totalRecords = machineRecords.length;
      const totalProduced = machineRecords.reduce(
        (sum, r) => sum + (Number(r.Total) || 0),
        0
      );
      const totalNG = machineRecords.reduce(
        (sum, r) => sum + (Number(r.Total_NG) || 0),
        0
      );
      const totalProcessQty = machineRecords.reduce(
        (sum, r) => sum + (Number(r.Process_Quantity) || 0),
        0
      );
      const avgCycleTime =
        totalRecords > 0
          ? (
              machineRecords.reduce(
                (sum, r) => sum + (parseFloat(r.Cycle_Time) || 0),
                0
              ) / totalRecords
            ).toFixed(2)
          : "0.00";
      const totalBreakMinutes = machineRecords.reduce(
        (sum, r) => sum + (r.Break_Time_Data?.totalBreakMinutes || 0),
        0
      );
      const yieldRate =
        totalProcessQty > 0
          ? ((totalProduced / totalProcessQty) * 100).toFixed(1)
          : "0.0";

      pdf.setFontSize(11);
      pdf.text(`Total Production Records: ${totalRecords}`, margin, 44);
      pdf.text(
        `Total Quantity Produced: ${totalProduced.toLocaleString()}`,
        margin + 80,
        44
      );
      pdf.text(`Total NG: ${totalNG.toLocaleString()}`, margin + 170, 44);
      pdf.text(`Yield Rate: ${yieldRate}%`, margin + 230, 44);

      // Legend
      const legendY = 52;
      pdf.setFontSize(10);
      pdf.setFont(undefined, "bold");
      pdf.text("Legend:", margin, legendY);

      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin + 20, legendY - 3.5, 5, 4, "F");
      pdf.setFont(undefined, "normal");
      pdf.text("Working", margin + 27, legendY);

      pdf.setFillColor(239, 68, 68);
      pdf.rect(margin + 55, legendY - 3.5, 5, 4, "F");
      pdf.text("Break", margin + 62, legendY);

      pdf.setFillColor(107, 114, 128);
      pdf.rect(margin + 85, legendY - 3.5, 5, 4, "F");
      pdf.text("Downtime", margin + 92, legendY);

      const chartRef = chartRefs.current[machine];
      const chartImgData = chartRef?.getDataURL?.();

      if (chartImgData) {
        const chartY = 60;
        const chartHeight = pageHeight - chartY - 15;
        const chartWidth = pageWidth - margin * 2;
        pdf.addImage(
          chartImgData,
          "PNG",
          margin,
          chartY,
          chartWidth,
          chartHeight
        );
      }

      // PAGE 2+: Detailed Production Records Table
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.setFont(undefined, "bold");
      pdf.text(`Detailed Production Records - ${machine}`, margin, 20);

      pdf.setFontSize(11);
      pdf.setFont(undefined, "normal");
      pdf.text(
        `Date Range: ${appliedDates.dateFrom} to ${appliedDates.dateTo} | Total Records: ${totalRecords}`,
        margin,
        28
      );

      const sortedRecords = [...machineRecords].sort((a, b) => {
        if (a.Date !== b.Date) return String(a.Date).localeCompare(String(b.Date));
        return (a.Time_start || "").localeCompare(b.Time_start || "");
      });

      const tableData = sortedRecords.map((record) => [
        record.Date || "N/A",
        `${record.Time_start || "N/A"} - ${record.Time_end || "N/A"}`,
        record["品番"] || "N/A",
        record["背番号"] || "N/A",
        record.Worker_Name || "N/A",
        (record.Process_Quantity || 0).toLocaleString(),
        (record.Total || 0).toLocaleString(),
        (record.Total_NG || 0).toLocaleString(),
        record.Cycle_Time ? `${Number(record.Cycle_Time).toFixed(2)}s` : "0s",
        record.Break_Time_Data?.totalBreakMinutes || 0,
        record.WorkOrder_Info?.workOrderNumber || "N/A",
        record["製造ロット"] || "N/A",
      ]);

      autoTable(pdf, {
        startY: 34,
        head: [
          [
            "Date",
            "Time",
            "Part Number",
            "Back Number",
            "Worker",
            "Process Qty",
            "Total Good",
            "Total NG",
            "Cycle Time",
            "Break (min)",
            "Work Order",
            "Lot Number",
          ],
        ],
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 3,
          overflow: "linebreak",
          halign: "left",
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
          fontSize: 10,
        },
        columnStyles: {
          0: { cellWidth: 28, halign: "center" },
          1: { cellWidth: 32, halign: "center" },
          2: { cellWidth: 38, halign: "left" },
          3: { cellWidth: 28, halign: "center" },
          4: { cellWidth: 32, halign: "left" },
          5: { cellWidth: 28, halign: "right" },
          6: { cellWidth: 28, halign: "right" },
          7: { cellWidth: 24, halign: "right" },
          8: { cellWidth: 26, halign: "right" },
          9: { cellWidth: 26, halign: "right" },
          10: { cellWidth: 35, halign: "center" },
          11: { cellWidth: 35, halign: "left" },
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        margin: { left: margin, right: margin },
      });

      const finalY = (pdf.lastAutoTable?.finalY || 120) + 10;
      if (finalY < pageHeight - 35) {
        pdf.setFillColor(240, 248, 255);
        pdf.rect(margin, finalY, pageWidth - margin * 2, 28, "F");
        pdf.setDrawColor(59, 130, 246);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, finalY, pageWidth - margin * 2, 28, "S");

        pdf.setFontSize(12);
        pdf.setFont(undefined, "bold");
        pdf.text("Production Summary:", margin + 5, finalY + 8);

        pdf.setFontSize(10);
        pdf.setFont(undefined, "normal");
        const summaryY = finalY + 15;
        pdf.text(`Total Records: ${totalRecords}`, margin + 5, summaryY);
        pdf.text(
          `Total Process Quantity: ${totalProcessQty.toLocaleString()}`,
          margin + 65,
          summaryY
        );
        pdf.text(
          `Total Good: ${totalProduced.toLocaleString()}`,
          margin + 150,
          summaryY
        );
        pdf.text(`Total NG: ${totalNG.toLocaleString()}`, margin + 215, summaryY);
        pdf.text(
          `Average Cycle Time: ${avgCycleTime}s`,
          margin + 270,
          summaryY
        );

        const summaryY2 = finalY + 22;
        pdf.text(
          `Total Break Time: ${totalBreakMinutes} min (${(
            totalBreakMinutes / 60
          ).toFixed(1)} hrs)`,
          margin + 5,
          summaryY2
        );
        pdf.text(
          `Overall Yield Rate: ${yieldRate}%`,
          margin + 110,
          summaryY2
        );
      }

      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(128);
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pageWidth - margin - 25,
          pageHeight - 8
        );
      }

      const filename = `${machine}_Downtime_Analytics_${appliedDates.dateFrom}_to_${appliedDates.dateTo}.pdf`;
      pdf.save(filename);

      onFlash?.({
        type: "success",
        message: isJa
          ? `PDF「${filename}」を出力しました。`
          : `PDF exported successfully: ${filename}`,
      });
    } catch (err) {
      onFlash?.({
        type: "error",
        message:
          err.message ||
          (isJa ? "PDF出力に失敗しました。" : "Error exporting PDF."),
      });
    } finally {
      setExportingPdfMachine(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls Card */}
      <div className="freya-card p-5 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {isJa
                ? "設備ダウンタイム分析 (Machine Downtime Analytics)"
                : "Machine Downtime Analytics"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {isJa
                ? "SCNA工場の設備稼働状況・休憩・ダウンタイムの15分間隔ビジュアルタイムライン分析"
                : "Visual timeline analysis of machine operations, break times, and downtime at SCNA"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (!filteredExportRecords.length) {
                  onFlash?.({
                    type: "warning",
                    message: isJa
                      ? "エクスポートするデータがありません。"
                      : "No data to export.",
                  });
                  return;
                }
                setExportModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                download
              </span>
              {isJa ? "CSVエクスポート" : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                refresh
              </span>
              {isJa ? "更新" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Machine Multi-Select Checkboxes */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-2">
            {isJa
              ? "表示する設備を選択 (Select Machines to Display)"
              : "Select Machines to Display"}
          </label>
          <div className="flex flex-wrap items-center gap-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2 border-r border-[var(--border)] pr-3">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--freya-blue)]">
                <input
                  ref={allCheckboxRef}
                  type="checkbox"
                  checked={
                    availableMachines.length > 0 &&
                    selectedMachines.length === availableMachines.length
                  }
                  onChange={(e) => handleToggleAllMachines(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--freya-blue)]"
                />
                <span>{isJa ? "すべて (All)" : "All"}</span>
              </label>
              <button
                type="button"
                onClick={handleDeselectAllMachines}
                className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                {isJa ? "クリア (None)" : "None"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 flex-1">
              {availableMachines.length === 0 ? (
                <span className="text-xs text-[var(--text-muted)]">
                  {loading
                    ? isJa
                      ? "設備リストを読み込み中..."
                      : "Loading machines..."
                    : isJa
                      ? "設備が見つかりません"
                      : "No machines found"}
                </span>
              ) : (
                availableMachines.map((machine) => {
                  const checked = selectedMachines.includes(machine);
                  return (
                    <label
                      key={machine}
                      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-xs font-medium cursor-pointer transition select-none ${
                        checked
                          ? "border-[var(--freya-blue)]/40 bg-[var(--freya-blue)]/10 text-[var(--text-primary)]"
                          : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          handleToggleMachine(machine, e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--freya-blue)]"
                      />
                      <span>{machine}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Date Range Filters & Legend */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "開始日 (From Date)" : "From Date"}
            </label>
            <input
              type="date"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "終了日 (To Date)" : "To Date"}
            </label>
            <input
              type="date"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApplyDates}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                filter_alt
              </span>
              {isJa ? "適用 (Apply)" : "Apply"}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 rounded-[3px]"
              style={{ backgroundColor: "#3B82F6" }}
            />
            <span className="font-semibold text-[var(--text-primary)]">
              {isJa ? "稼働中 (Working)" : "Working"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 rounded-[3px]"
              style={{ backgroundColor: "#EF4444" }}
            />
            <span className="font-semibold text-[var(--text-primary)]">
              {isJa ? "休憩 (Break)" : "Break"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 rounded-[3px]"
              style={{ backgroundColor: "#6B7280" }}
            />
            <span className="font-semibold text-[var(--text-primary)]">
              {isJa ? "ダウンタイム (Downtime)" : "Downtime"}
            </span>
          </div>
          <div className="ml-auto text-[11px] text-[var(--text-muted)]">
            {isJa
              ? "※ セルをクリックすると生産記録の詳細が表示されます"
              : "Tip: Hover any block for summary or click a Working/Break block to open full details"}
          </div>
        </div>
      </div>

      {/* Loading / Error / Empty / Machine Timeline Cards */}
      {loading ? (
        <div className="freya-card p-12 text-center">
          <span
            className="material-symbols-outlined animate-spin text-[var(--freya-blue)]"
            style={{ fontSize: 32 }}
          >
            progress_activity
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
            {isJa
              ? "設備稼働分析データを読み込み中..."
              : "Loading machine analytics data..."}
          </p>
        </div>
      ) : error ? (
        <div className="freya-card p-12 text-center">
          <span
            className="material-symbols-outlined text-rose-500"
            style={{ fontSize: 36 }}
          >
            error
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
            {isJa ? "データの取得に失敗しました" : "Could not load analytics"}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{error}</p>
        </div>
      ) : selectedMachines.length === 0 ? (
        <div className="freya-card p-12 text-center">
          <span
            className="material-symbols-outlined text-[var(--text-muted)]"
            style={{ fontSize: 40 }}
          >
            precision_manufacturing
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
            {isJa ? "設備が選択されていません" : "No Machines Selected"}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {isJa
              ? "上のチェックボックスから1台以上の設備を選択してください。"
              : "Please select at least one machine from the checkboxes above."}
          </p>
        </div>
      ) : machinesWithData.length === 0 ? (
        <div className="freya-card p-12 text-center">
          <span
            className="material-symbols-outlined text-[var(--text-muted)]"
            style={{ fontSize: 40 }}
          >
            inbox
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
            {isJa
              ? "指定期間内の生産データがありません"
              : "No Production Data Available"}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {isJa
              ? "選択された設備の指定期間における生産記録が見つかりませんでした。"
              : "No production records found for the selected machines in the specified date range."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {machinesWithData.map(({ machine, records: machineRecords }) => (
            <div key={machine} className="freya-card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[var(--freya-blue)]"
                    style={{ fontSize: 20 }}
                  >
                    precision_manufacturing
                  </span>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {machine} — Timeline ({machineRecords.length}{" "}
                    {machineRecords.length > 1 ? "records" : "record"})
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={exportingPdfMachine === machine}
                  onClick={() => handleExportMachinePdf(machine, machineRecords)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-rose-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    picture_as_pdf
                  </span>
                  {exportingPdfMachine === machine
                    ? isJa
                      ? "PDF作成中..."
                      : "Generating PDF..."
                    : isJa
                      ? "PDF出力 (Export PDF)"
                      : "Export PDF"}
                </button>
              </div>

              <ScnaMachineTimelineChart
                ref={(instance) => {
                  chartRefs.current[machine] = instance;
                }}
                records={machineRecords}
                dateFrom={appliedDates.dateFrom}
                dateTo={appliedDates.dateTo}
                onSelectRecord={(rec) => setDetailRecord(rec)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Production Detail Modal */}
      <ScnaProductionDetailModal
        open={Boolean(detailRecord)}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
      />

      {/* Custom CSV Export Modal */}
      <ScnaMachineExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        records={filteredExportRecords}
        dateFrom={appliedDates.dateFrom}
        dateTo={appliedDates.dateTo}
        onFlash={onFlash}
      />
    </div>
  );
}

