import React, { useEffect, useMemo, useRef, useState } from "react";
import ChartJS from "./chartSetup";
import { exportEquipmentToCsv } from "./equipmentAnalyticsUtils";
import RecordDetailModal from "../RecordDetailModal";

const PAGE_SIZES = [10, 50, 100];

function recordHours(record) {
  if (!record.Time_start || !record.Time_end) return 0;
  const [sh, sm] = String(record.Time_start).split(":").map(Number);
  const [eh, em] = String(record.Time_end).split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes / 60 : 0;
}

function rowOf(record) {
  const processQty = Number(record.Process_Quantity || 0);
  const defects = Number(record.Total_NG || record.SRS_Total_NG || 0);
  return {
    Date: record.Date || "",
    品番: record["品番"] || "",
    背番号: record["背番号"] || "",
    Worker_Name: record.Worker_Name || "",
    shots: Number(record["ショット数"] || 0),
    processQty,
    defects,
    defectRate: processQty > 0 ? (defects / processQty) * 100 : 0,
    Time_start: record.Time_start || "",
    Time_end: record.Time_end || "",
    _record: record,
  };
}

function DailyChart({ machine, records, isJa }) {
  const canvasRef = useRef(null);

  const daily = useMemo(() => {
    const byDate = {};
    records.forEach((record) => {
      const date = record.Date;
      if (!date) return;
      if (!byDate[date]) byDate[date] = { shots: 0, hours: 0 };
      byDate[date].shots += Number(record["ショット数"] || 0);
      byDate[date].hours += recordHours(record);
    });
    const dates = Object.keys(byDate).sort();
    return {
      dates,
      shots: dates.map((date) => byDate[date].shots),
      hours: dates.map((date) => Number(byDate[date].hours.toFixed(1))),
    };
  }, [records]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const chart = new ChartJS(canvasRef.current.getContext("2d"), {
      data: {
        labels: daily.dates,
        datasets: [
          {
            type: "bar",
            label: isJa ? "ショット数" : "Shots",
            data: daily.shots,
            backgroundColor: "#3B82F6",
            yAxisID: "y",
            order: 2,
          },
          {
            type: "line",
            label: isJa ? "実働時間" : "Working Hours",
            data: daily.hours,
            borderColor: "#10B981",
            backgroundColor: "#ffffff",
            borderWidth: 2,
            pointRadius: 3,
            tension: 0,
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          title: { display: true, text: `${machine} - ${isJa ? "日別実績" : "Daily Performance"}`, align: "start", font: { size: 13 } },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, position: "left", title: { display: true, text: isJa ? "ショット数" : "Shots" } },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: isJa ? "実働時間" : "Working Hours" },
            ticks: { callback: (value) => `${value}h` },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [daily, machine, isJa]);

  return (
    <div className="h-64 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-2">
      <canvas ref={canvasRef} />
    </div>
  );
}

const COLUMNS = (isJa) => [
  { key: "Date", label: isJa ? "日付" : "Date", align: "left" },
  { key: "品番", label: "品番", align: "left" },
  { key: "背番号", label: "背番号", align: "left" },
  { key: "Worker_Name", label: isJa ? "作業者" : "Worker", align: "left" },
  { key: "shots", label: isJa ? "ショット数" : "Shots", align: "right", format: (v) => v.toLocaleString() },
  { key: "processQty", label: isJa ? "処理数量" : "Process Qty", align: "right", format: (v) => v.toLocaleString() },
  { key: "defects", label: isJa ? "不良数" : "Defects", align: "right", format: (v) => v.toLocaleString() },
  { key: "defectRate", label: isJa ? "不良率" : "Defect Rate", align: "right", format: (v) => `${v.toFixed(2)}%` },
  { key: "Time_start", label: isJa ? "時間" : "Time", align: "left" },
];

function MachineGraphSection({ item, isJa }) {
  const { machine, analytics, records } = item;
  const [sort, setSort] = useState({ key: "Date", dir: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const columns = COLUMNS(isJa);

  const rows = useMemo(() => {
    const mapped = records.map(rowOf);
    const factor = sort.dir === "asc" ? 1 : -1;
    return mapped.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      const cmp = String(av).localeCompare(String(bv));
      return cmp !== 0 ? cmp * factor : String(b.Time_start).localeCompare(String(a.Time_start)) * (sort.key === "Date" ? factor : 1);
    });
  }, [records, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = rows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(currentPage * pageSize, rows.length);

  const cards = [
    { label: isJa ? "総ショット数" : "Total Shots", value: analytics.totalShots.toLocaleString(), sub: "週合計shot数", tone: "blue" },
    { label: isJa ? "平均ショット/日" : "Avg Shots/Day", value: analytics.avgShotsPerDay, sub: "平均shot/Day", tone: "green" },
    { label: isJa ? "平均ショット/時間" : "Avg Shots/Hour", value: analytics.avgShotsPerHour, sub: "平均shot/Hour", tone: "purple" },
    { label: isJa ? "実働時間/日" : "Working Hours/Day", value: analytics.avgWorkingHoursPerDay, sub: "実働時間/Day", tone: "orange" },
  ];
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-900 [&_h4]:text-blue-800 [&_.sub]:text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100",
    green: "border-green-200 bg-green-50 text-green-900 [&_h4]:text-green-800 [&_.sub]:text-green-600 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100",
    purple: "border-purple-200 bg-purple-50 text-purple-900 [&_h4]:text-purple-800 [&_.sub]:text-purple-600 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-100",
    orange: "border-orange-200 bg-orange-50 text-orange-900 [&_h4]:text-orange-800 [&_.sub]:text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-100",
  };

  function toggleSort(key) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "Date" || typeof rows[0]?.[key] === "number" ? "desc" : "asc" }));
    setPage(1);
  }

  const pageButtons = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pageButtons.push(i);
    else if (pageButtons[pageButtons.length - 1] !== "…") pageButtons.push("…");
  }

  return (
    <section className="rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <span className="material-symbols-outlined text-[var(--freya-blue)]">build</span>
          {machine}
          {item.factory ? <span className="text-xs font-medium text-[var(--text-muted)]">{item.factory}</span> : null}
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs text-[var(--text-muted)]">{records.length} {isJa ? "件" : "records"}</span>
          <button type="button" onClick={() => exportEquipmentToCsv(machine, records, isJa)} disabled={!records.length} className="flex items-center gap-1 text-xs font-semibold text-[var(--freya-blue)] hover:underline disabled:opacity-40">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
            {isJa ? "エクスポート" : "Export"}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-lg border p-4 ${tones[card.tone]}`}>
            <h4 className="mb-1 text-sm font-medium">{card.label}</h4>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="sub text-xs">{card.sub}</p>
          </div>
        ))}
      </div>

      <h4 className="mb-2 text-base font-semibold text-[var(--text-primary)]">{isJa ? "日別パフォーマンス推移" : "Daily Performance Trend"}</h4>
      {records.length ? <DailyChart machine={machine} records={records} isJa={isJa} /> : (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-muted)]">{isJa ? "この期間のデータはありません。" : "No records in this period."}</div>
      )}

      <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          {isJa ? "表示" : "Show"}
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded border border-[var(--border)] bg-[var(--surface)] p-1 text-sm">
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          {isJa ? "件" : "entries"}
        </label>
        <div className="flex items-center gap-1.5">
          {pageButtons.map((entry, index) => (entry === "…"
            ? <span key={`gap-${index}`} className="px-1 text-[var(--text-muted)]">…</span>
            : (
              <button key={entry} type="button" onClick={() => setPage(entry)} className={`rounded border px-2.5 py-1 text-sm ${entry === currentPage ? "border-[var(--freya-blue)] bg-[var(--freya-blue)] text-white" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}>{entry}</button>
            )))}
          {currentPage < totalPages ? (
            <button type="button" onClick={() => setPage(currentPage + 1)} className="rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">{isJa ? "次へ" : "Next"}</button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-[var(--border)] text-sm">
          <thead className="bg-[var(--surface-subtle)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} onClick={() => toggleSort(column.key)} className={`cursor-pointer select-none border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-hover)] text-${column.align}`}>
                  <span className="flex items-center justify-between gap-1">
                    <span>{column.label}</span>
                    <span className="text-[var(--text-muted)]">{sort.key === column.key ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr
                key={`${row.Date}-${row.Time_start}-${index}`}
                onClick={() => setSelectedRecord({ ...row._record, _source: "pressDB", _process: "Press", _id: row._record._id?.$oid || row._record._id })}
                className="cursor-pointer hover:bg-[var(--surface-hover)]"
              >
                {columns.map((column) => (
                  <td key={column.key} className={`border border-[var(--border)] px-3 py-2 text-${column.align} text-[var(--text-primary)]`}>
                    {column.key === "Time_start"
                      ? (row.Time_start && row.Time_end ? `${row.Time_start} - ${row.Time_end}` : row.Time_start || "-")
                      : column.format ? column.format(row[column.key]) : row[column.key] || "-"}
                  </td>
                ))}
              </tr>
            ))}
            {!pageRows.length ? (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">{isJa ? "データがありません。" : "No data."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-sm text-[var(--text-secondary)]">
        {isJa ? `${rows.length} 件中 ${from} ～ ${to} 件を表示` : `Showing ${from} to ${to} of ${rows.length} entries`}
      </div>
      {selectedRecord ? (
        <RecordDetailModal
          record={selectedRecord}
          processName="Press"
          onClose={() => setSelectedRecord(null)}
          zIndex="z-[10000]"
        />
      ) : null}
    </section>
  );
}

export default function MachineGraphView({ cards = [], isJa }) {
  return (
    <div className="space-y-6">
      {cards.map((item) => <MachineGraphSection key={item.machine} item={item} isJa={isJa} />)}
    </div>
  );
}
