import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ChartJS from "./chartSetup";
import { exportEquipmentToCsv } from "./equipmentAnalyticsUtils";

export default function MachineDetailModal({
  machine,
  factory,
  records = [],
  analytics,
  dateRange,
  onClose,
  isJa = true,
}) {
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Search & Pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState("Date");
  const [sortAsc, setSortAsc] = useState(false);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Aggregate daily shots for daily trend chart
  const dailyShots = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const d = r.Date;
      if (!d) return;
      const shots = Number(r["ショット数"] || 0);
      map.set(d, (map.get(d) || 0) + shots);
    });

    const dates = Array.from(map.keys()).sort();
    return {
      labels: dates,
      data: dates.map((d) => map.get(d)),
    };
  }, [records]);

  // Render Daily Performance Chart
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    const ctx = chartCanvasRef.current.getContext("2d");

    const existing = ChartJS.getChart(chartCanvasRef.current);
    if (existing) existing.destroy();
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels: dailyShots.labels,
        datasets: [
          {
            label: isJa ? "ショット数" : "Shots",
            data: dailyShots.data,
            backgroundColor: "rgba(59, 130, 246, 0.75)",
            borderColor: "#3b82f6",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(59, 130, 246, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctxItem) =>
                `  ${isJa ? "ショット数" : "Shots"}: ${Number(ctxItem.parsed.y || 0).toLocaleString()} shots`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.12)" },
            ticks: {
              precision: 0,
              callback: (v) => Number(v).toLocaleString(),
            },
            title: {
              display: true,
              text: isJa ? "ショット数" : "Shots",
              color: "#94a3b8",
              font: { size: 11 },
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
            },
          },
        },
      },
    });

    return () => {
      if (chartCanvasRef.current) {
        const c = ChartJS.getChart(chartCanvasRef.current);
        if (c) c.destroy();
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [dailyShots, isJa]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(
        (r) =>
          String(r.Date || "").toLowerCase().includes(q) ||
          String(r["品番"] || "").toLowerCase().includes(q) ||
          String(r["背番号"] || "").toLowerCase().includes(q) ||
          String(r["作業者"] || r.Worker_Name || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "ショット数" || sortField === "Process_Quantity" || sortField === "Total_NG") {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || "");
        valB = String(valB || "");
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, searchTerm, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const pagedRecords = filteredRecords.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default desc for new field
    }
  };

  const handleExport = () => {
    exportEquipmentToCsv(machine, records, isJa);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-5xl bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20">
              <span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  {machine}
                </h2>
                {factory && (
                  <span className="rounded-[4px] border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {factory}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {dateRange?.from} ~ {dateRange?.to} • {records.length} {isJa ? "件の記録" : "records"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-xs transition"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">download</span>
              <span>{isJa ? "CSVエクスポート" : "Export CSV"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Shots */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block">
                {isJa ? "総ショット数" : "Total Shots"}
              </span>
              <span className="text-2xl font-black text-blue-900 dark:text-blue-100 tabular-nums mt-1 block">
                {(analytics?.totalShots || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-blue-600/70 mt-0.5 block">
                {isJa ? "期間合計shot数" : "Sum of shots in range"}
              </span>
            </div>

            {/* Avg Shots / Day */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                {isJa ? "平均 / 日" : "Avg Shots / Day"}
              </span>
              <span className="text-2xl font-black text-emerald-900 dark:text-emerald-100 tabular-nums mt-1 block">
                {(analytics?.avgShotsPerDay || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-600/70 mt-0.5 block">
                {isJa ? "平均shot/Day" : "Shots per active day"}
              </span>
            </div>

            {/* Avg Shots / Hour */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3.5">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 block">
                {isJa ? "平均 / 時" : "Avg Shots / Hour"}
              </span>
              <span className="text-2xl font-black text-purple-900 dark:text-purple-100 tabular-nums mt-1 block">
                {(analytics?.avgShotsPerHour || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-purple-600/70 mt-0.5 block">
                {isJa ? "平均shot/Hour" : "Shots per working hour"}
              </span>
            </div>

            {/* Working Hours / Day */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">
                {isJa ? "実働時間 / 日" : "Working Hours / Day"}
              </span>
              <span className="text-2xl font-black text-amber-900 dark:text-amber-100 tabular-nums mt-1 block">
                {analytics?.avgWorkingHoursPerDay || 0}
                <span className="text-sm font-medium ml-0.5">h</span>
              </span>
              <span className="text-[11px] text-amber-600/70 mt-0.5 block">
                {isJa ? `累計: ${analytics?.workingHours || 0}h` : `Total: ${analytics?.workingHours || 0}h`}
              </span>
            </div>
          </div>

          {/* Daily Trend Chart */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              {isJa ? "日別稼働ショット数 推移" : "Daily Performance Trend"}
            </h4>
            <div className="h-56 w-full relative">
              <canvas ref={chartCanvasRef} />
            </div>
          </div>

          {/* Records Table Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {isJa ? "設備稼働実績一覧" : "Detailed Production Records"}
              </h4>

              {/* Search input & items per page */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={isJa ? "品番・背番号・作業者で検索..." : "Search part, back no, worker..."}
                  className="freya-input h-8 w-56 text-xs"
                />

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="freya-input h-8 text-xs cursor-pointer"
                >
                  <option value={10}>10 {isJa ? "件" : "/ page"}</option>
                  <option value={25}>25 {isJa ? "件" : "/ page"}</option>
                  <option value={50}>50 {isJa ? "件" : "/ page"}</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold select-none">
                  <tr>
                    <th
                      className="px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("Date")}
                    >
                      <div className="flex items-center gap-1">
                        <span>{isJa ? "日付" : "Date"}</span>
                        {sortField === "Date" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("品番")}
                    >
                      <div className="flex items-center gap-1">
                        <span>{isJa ? "品番" : "Part Number"}</span>
                        {sortField === "品番" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("背番号")}
                    >
                      <div className="flex items-center gap-1">
                        <span>{isJa ? "背番号" : "Back No"}</span>
                        {sortField === "背番号" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("作業者")}
                    >
                      <div className="flex items-center gap-1">
                        <span>{isJa ? "作業者" : "Worker"}</span>
                        {sortField === "作業者" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 text-right cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("ショット数")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{isJa ? "ショット数" : "Shots"}</span>
                        {sortField === "ショット数" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 text-right cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("Process_Quantity")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{isJa ? "処理数量" : "Process Qty"}</span>
                        {sortField === "Process_Quantity" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 text-right cursor-pointer hover:bg-[var(--surface-hover)]"
                      onClick={() => handleSort("Total_NG")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{isJa ? "不良数" : "Defects"}</span>
                        {sortField === "Total_NG" && <span>{sortAsc ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-center">
                      <span>{isJa ? "稼働時間帯" : "Time"}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-primary)]">
                  {pagedRecords.length > 0 ? (
                    pagedRecords.map((r, i) => (
                      <tr key={i} className="hover:bg-[var(--surface-subtle)]/60 transition-colors">
                        <td className="px-3 py-2 font-mono whitespace-nowrap text-[var(--text-secondary)]">
                          {r.Date}
                        </td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{r["品番"] || "—"}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {r["背番号"] ? (
                            <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 border border-[var(--border)]">
                              {r["背番号"]}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{r["作業者"] || r.Worker_Name || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                          {Number(r["ショット数"] || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                          {Number(r.Process_Quantity || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {Number(r.Total_NG || r.SRS_Total_NG || 0) > 0 ? (
                            <span className="text-rose-500 font-bold">
                              {Number(r.Total_NG || r.SRS_Total_NG || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                          {r.Time_start && r.Time_end ? `${r.Time_start} ~ ${r.Time_end}` : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                        {isJa ? "該当する記録はありません" : "No records found matching criteria"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2">
                <span>
                  {filteredRecords.length} {isJa ? "件中" : "records"} ({(pageIndex - 1) * pageSize + 1} -{" "}
                  {Math.min(filteredRecords.length, pageIndex * pageSize)})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pageIndex <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isJa ? "前へ" : "Prev"}
                  </button>
                  <span className="px-2 font-mono">
                    {pageIndex} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={pageIndex >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isJa ? "次へ" : "Next"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
