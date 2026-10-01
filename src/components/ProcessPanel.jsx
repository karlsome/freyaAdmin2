//This component displays a paginated, sortable, and searchable table of production records for a specific process (Kensa, Press, SRS, or Slit). It also includes a summary section that aggregates data by part number and worker ID. The component is designed to be reusable for different processes by passing the appropriate props.
import { useEffect, useMemo, useRef, useState } from "react";
import DataTable from "./DataTable";
import ExportOptionsModal from "./ExportOptionsModal";

// ─── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 25;

export const PROCESS_ACCENT = {
  Kensa: { dot: "bg-amber-400",   label: "text-amber-400" },
  Press: { dot: "bg-emerald-400", label: "text-emerald-400" },
  SRS:   { dot: "bg-slate-400",   label: "text-slate-400" },
  Slit:  { dot: "bg-sky-400",     label: "text-sky-400" },
};

const SORT_NUMERIC = new Set(["Total", "Total_NG", "Process_Quantity", "Remaining_Quantity", "Cycle_Time"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcWorkHours(start, end) {
  if (!start || !end) return null;
  const s = new Date(`2000-01-01T${start}`);
  const e = new Date(`2000-01-01T${end}`);
  if (e <= s) return null;
  return (e - s) / 3_600_000;
}

function defectChip(rate) {
  const n = parseFloat(rate);
  if (n > 2) return "bg-error/15 text-error";
  if (n > 1) return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-400/15 text-emerald-400";
}

function groupSummary(rows, isHidase = false) {
  const map = new Map();
  rows.forEach((r) => {
    const key = `${r["品番"]}__${r["背番号"]}`;
    if (!map.has(key)) {
      map.set(key, {
        hinban: r["品番"],
        sebanggo: r["背番号"],
        total: 0,
        processQuantity: 0,
        ng: 0,
        nonDefectDisposal: 0,
        disposalDetail: {
          初回生産品: 0,
          終物: 0,
          サンプル: 0,
          調整用: 0,
        },
      });
    }
    const e = map.get(key);
    e.processQuantity += Number(r.Process_Quantity) || Number(r.Total) || 0;
    e.total += isHidase && r.Total != null ? Number(r.Total) : (Number(r.Process_Quantity) || Number(r.Total) || 0);
    e.ng += Number(r.SRS_Total_NG) || Number(r.Total_NG) || 0;
    if (isHidase) {
      e.nonDefectDisposal += Number(r["非不良廃棄"]) || 0;
      if (r["非不良廃棄_詳細"]) {
        const d = r["非不良廃棄_詳細"];
        e.disposalDetail.初回生産品 += Number(d["初回生産品"]) || 0;
        e.disposalDetail.終物 += Number(d["終物"]) || 0;
        e.disposalDetail.サンプル += Number(d["サンプル"]) || 0;
        e.disposalDetail.調整用 += Number(d["調整用"]) || 0;
      } else {
        if (r["初回生産品"] != null) e.disposalDetail.初回生産品 += Number(r["初回生産品"]) || 0;
        if (r["終物"] != null) e.disposalDetail.終物 += Number(r["終物"]) || 0;
        if (r["サンプル"] != null) e.disposalDetail.サンプル += Number(r["サンプル"]) || 0;
        if (r["調整用"] != null) e.disposalDetail.調整用 += Number(r["調整用"]) || 0;
      }
    }
  });
  return Array.from(map.values());
}

// ─── ProcessPanel ─────────────────────────────────────────────────────────────
// Props:
//   processName — "Kensa" | "Press" | "SRS" | "Slit"
//   rows        — array of raw production records from the matching DB
//   onRowClick  — callback(record, processName) when a row is clicked
export default function ProcessPanel({ processName, rows, onRowClick, showFactoryColumn = false, factoryName = null }) {
  const isHidase = factoryName === "肥田瀬" || (!factoryName && rows.length > 0 && rows.every((r) => r["工場"] === "肥田瀬"));
  const accent = PROCESS_ACCENT[processName] ?? PROCESS_ACCENT.Kensa;
  const [sort, setSort]               = useState({ col: null, dir: 1 });
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSummaryExport, setShowSummaryExport] = useState(false);
  const summaryRef = useRef(null);

  useEffect(() => setPage(1), [rows]);

  const handleSort = (col) => {
    setSort((prev) => prev.col === col ? { col, dir: prev.dir * -1 } : { col, dir: 1 });
    setPage(1);
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r["品番"]?.toLowerCase().includes(s)) ||
           (r["背番号"]?.toLowerCase().includes(s)) ||
          (r["工場"]?.toLowerCase().includes(s)) ||
           (r.Worker_Name?.toLowerCase().includes(s));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sort.col) return 0;
    if (sort.col === "Work_Hours") {
      const ha = calcWorkHours(a.Time_start, a.Time_end) ?? (a.Total_Work_Hours != null ? Number(a.Total_Work_Hours) : -1);
      const hb = calcWorkHours(b.Time_start, b.Time_end) ?? (b.Total_Work_Hours != null ? Number(b.Total_Work_Hours) : -1);
      return (ha - hb) * sort.dir;
    }
    if (sort.col === "Defect_Rate") {
      const qa = Number(a.Process_Quantity) || Number(a.Total) || 0;
      const qb = Number(b.Process_Quantity) || Number(b.Total) || 0;
      const ra = qa ? (Number(a.SRS_Total_NG) || Number(a.Total_NG) || 0) / qa : 0;
      const rb = qb ? (Number(b.SRS_Total_NG) || Number(b.Total_NG) || 0) / qb : 0;
      return (ra - rb) * sort.dir;
    }
    
    if (sort.col === "Process_Quantity" || sort.col === "Total") {
      const va = Number(a.Process_Quantity) || Number(a.Total) || 0;
      const vb = Number(b.Process_Quantity) || Number(b.Total) || 0;
      return (va - vb) * sort.dir;
    }

    if (sort.col === "Total_NG") {
      const va = Number(a.SRS_Total_NG) || Number(a.Total_NG) || 0;
      const vb = Number(b.SRS_Total_NG) || Number(b.Total_NG) || 0;
      return (va - vb) * sort.dir;
    }

    const va = a[sort.col] ?? "";
    const vb = b[sort.col] ?? "";
    
    if (SORT_NUMERIC.has(sort.col)) {
      const numA = Number(va) || 0;
      const numB = Number(vb) || 0;
      return (numA - numB) * sort.dir;
    }
    
    return va.toString().localeCompare(vb.toString(), "ja") * sort.dir;
  });

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const pageRows   = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const summary    = groupSummary(sorted, isHidase);
  const pageStart = totalItems ? (page - 1) * ITEMS_PER_PAGE + 1 : 0;
  const pageEnd = Math.min(page * ITEMS_PER_PAGE, totalItems);

  const summaryExportData = useMemo(() => {
    return summary.map((s) => {
      const rate = s.total > 0 ? ((s.ng / s.total) * 100).toFixed(2) : "0.00";
      const item = {
        品番: s.hinban ?? "",
        背番号: s.sebanggo ?? "",
        Total: s.total,
        Total_NG: s.ng,
        不良率: `${rate}%`,
      };
      if (isHidase) {
        item["非不良廃棄"] = s.nonDefectDisposal ?? 0;
        item["初回生産品"] = s.disposalDetail?.初回生産品 ?? 0;
        item["終物"] = s.disposalDetail?.終物 ?? 0;
        item["サンプル"] = s.disposalDetail?.サンプル ?? 0;
        item["調整用"] = s.disposalDetail?.調整用 ?? 0;
      }
      return item;
    });
  }, [summary, isHidase]);

  const tableColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "品番",
        label: "品番",
        width: 164,
        renderCell: (row) => <span className="font-semibold text-on-surface">{row["品番"] ?? "—"}</span>,
        disableCellWrapper: true,
      },
      {
        key: "背番号",
        label: "背番号",
        width: 144,
        renderCell: (row) => <span className="text-on-surface-variant">{row["背番号"] ?? "—"}</span>,
        disableCellWrapper: true,
      },
      {
        key: "Worker_Name",
        label: "作業者",
        width: 148,
        renderCell: (row) => <span className="text-on-surface-variant">{row.Worker_Name ?? "—"}</span>,
        disableCellWrapper: true,
      },
      {
        key: "Date",
        label: "日付",
        width: 132,
        renderCell: (row) => <span className="text-outline">{row.Date ?? "—"}</span>,
        disableCellWrapper: true,
      },
      {
        key: "Process_Quantity",
        label: isHidase ? "良品 (Total)" : "Total",
        width: 108,
        align: "right",
        renderCell: (row) => {
          const quantity = isHidase && row.Total != null
            ? Number(row.Total)
            : Number(row.Process_Quantity) || Number(row.Total) || 0;
          return <span className="font-semibold text-on-surface">{quantity.toLocaleString()}</span>;
        },
        disableCellWrapper: true,
      },
      ...(isHidase ? [{
        key: "非不良廃棄",
        label: "非不良廃棄",
        width: 110,
        align: "right",
        renderCell: (row) => {
          const count = Number(row["非不良廃棄"]) || 0;
          const details = row["非不良廃棄_詳細"] || {};
          const tooltip = row["非不良廃棄_詳細"]
            ? `初回:${details.初回生産品 || 0} 終物:${details.終物 || 0} サンプル:${details.サンプル || 0} 調整:${details.調整用 || 0}`
            : "";
          return (
            <span
              title={tooltip || undefined}
              className={count > 0 ? "font-semibold text-amber-500 font-mono" : "font-semibold text-outline font-mono"}
            >
              {count}
            </span>
          );
        },
        disableCellWrapper: true,
      }] : []),
      {
        key: "Total_NG",
        label: "Total NG",
        width: 112,
        align: "right",
        renderCell: (row) => {
          const totalNg = Number(row.SRS_Total_NG) || Number(row.Total_NG) || 0;
          return <span className={totalNg > 0 ? "font-semibold text-error" : "font-semibold text-outline"}>{totalNg}</span>;
        },
        disableCellWrapper: true,
      },
      {
        key: "Work_Hours",
        label: "稼働時間",
        sortKey: "Work_Hours",
        width: 112,
        align: "right",
        renderCell: (row) => {
          const hours = calcWorkHours(row.Time_start, row.Time_end) ?? (row.Total_Work_Hours != null ? Number(row.Total_Work_Hours) : null);
          return <span className="text-on-surface-variant">{hours != null ? `${hours.toFixed(2)}h` : "—"}</span>;
        },
        disableCellWrapper: true,
      },
      {
        key: "Defect_Rate",
        label: "不良率",
        sortKey: "Defect_Rate",
        width: 112,
        align: "right",
        renderCell: (row) => {
          const quantity = Number(row.Process_Quantity) || Number(row.Total) || 0;
          const totalNg = Number(row.SRS_Total_NG) || Number(row.Total_NG) || 0;
          const rate = quantity > 0 ? ((totalNg / quantity) * 100).toFixed(2) : "0.00";
          return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${defectChip(rate)}`}>
              {rate}%
            </span>
          );
        },
        disableCellWrapper: true,
      },
    ];

    if (!showFactoryColumn) return baseColumns;

    return [
      baseColumns[0],
      baseColumns[1],
      {
        key: "工場",
        label: "工場",
        width: 120,
        renderCell: (row) => <span className="whitespace-nowrap text-on-surface-variant">{row["工場"] ?? "—"}</span>,
        disableCellWrapper: true,
      },
      ...baseColumns.slice(2),
    ];
  }, [showFactoryColumn, isHidase]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-separator/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${accent.dot}`} />
          <h4 className="text-sm font-semibold text-on-surface truncate">{processName} Process</h4>
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-semibold text-outline flex-shrink-0">
            {totalItems}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {summary.length > 0 && (
            <button
              onClick={() => {
                setShowSummary(true);
                setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              className="px-3 py-1.5 rounded-lg border border-separator/40 bg-surface text-[11px] font-medium text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              Summary
            </button>
          )}

          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-7 px-2.5 rounded-lg bg-surface-container border border-separator/40 text-[11px]
                       text-on-surface placeholder:text-outline outline-none focus:border-primary/40 w-28 transition-colors"
          />
        </div>
      </div>

      <DataTable
        columns={tableColumns}
        rows={pageRows}
        sort={sort}
        page={page}
        pageSize={ITEMS_PER_PAGE}
        filteredCount={totalItems}
        totalPages={totalPages}
        onSort={handleSort}
        onPageChange={setPage}
        rowKey={(row, index) => {
          const id = row._id?.$oid ?? row._id;
          return id ? String(id) : `${processName}-${index}`;
        }}
        onRowClick={onRowClick ? (row) => onRowClick(row, processName) : undefined}
        renderPageInfo={() => (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-on-surface-variant">{totalItems} records, showing {pageStart}-{pageEnd}</span>
            <button
              onClick={() => setShowExport(true)}
              className="px-3 py-1.5 rounded-lg border border-separator/40 bg-surface text-[11px] font-medium text-on-surface hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
              Export
            </button>
          </div>
        )}
        emptyTitle={search ? "No results match your search" : "No data available"}
        emptyMessage={search ? "Adjust the search term to find matching production records." : "No production records are available for this process."}
        enableColumnResize
        enableColumnReorder
        layoutStorageKey={`freyaAdmin2.process-panel-layout:${processName}:${showFactoryColumn ? "factory" : "default"}`}
        stickyHeader
        stickyHeaderOffset={0}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        topBarClassName="flex justify-end px-1 pb-4"
        bottomBarClassName="flex flex-col gap-4 border-t border-separator/40 px-1 pt-4 md:flex-row md:items-center md:justify-between"
        bottomInfoClassName="flex-1 w-full flex"
        tableClassName="ui-table-data min-w-[720px]"
        tableViewportClassName="min-h-0 overflow-auto"
        headClassName="bg-surface-container-high/40 border-b border-outline-variant/20"
        headerCellClassName="px-4 py-2.5 text-left whitespace-nowrap"
        cellClassName="px-4 py-2.5 align-top"
        rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/10"
        previousLabel="前へ"
        nextLabel="次へ"
      />

      {/* Summary collapsible */}
      {summary.length > 0 && (
        <div ref={summaryRef} className="border-t border-separator/40">
          {(() => {
            const overallTotal = summary.reduce((acc, s) => acc + s.total, 0);
            const overallNg = summary.reduce((acc, s) => acc + s.ng, 0);
            const overallDisposal = isHidase ? summary.reduce((acc, s) => acc + s.nonDefectDisposal, 0) : 0;
            const overallRate = overallTotal > 0 ? ((overallNg / overallTotal) * 100).toFixed(2) : "0.00";
            return (
              <div className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold border-b border-separator/20 bg-surface/50">
                <button
                  type="button"
                  className="flex items-center gap-2 text-outline hover:text-on-surface transition-colors cursor-pointer"
                  onClick={() => setShowSummary((v) => !v)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {showSummary ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                  </span>
                  <span>Daily Summary ({summary.length} parts)</span>
                </button>
                <div className="flex items-center gap-3 text-[11px] font-medium tracking-wide">
                  <span className="flex gap-1.5 items-center">
                    <span className="text-outline/70 uppercase text-[9px]">Total</span>
                    <span className="text-on-surface font-semibold">{overallTotal.toLocaleString()}</span>
                  </span>
                  {isHidase && (
                    <span className="flex gap-1.5 items-center">
                      <span className="text-outline/70 uppercase text-[9px]">非不良廃棄</span>
                      <span className="text-amber-500 font-semibold">{overallDisposal.toLocaleString()}</span>
                    </span>
                  )}
                  <span className="flex gap-1.5 items-center">
                    <span className="text-outline/70 uppercase text-[9px]">NG</span>
                    <span className={`font-semibold ${overallNg > 0 ? "text-error" : "text-on-surface"}`}>{overallNg.toLocaleString()}</span>
                  </span>
                  <span className="flex gap-1.5 items-center">
                    <span className="text-outline/70 uppercase text-[9px]">Rate</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${defectChip(overallRate)}`}>{overallRate}%</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSummaryExport(true);
                    }}
                    className="ml-2 px-2.5 py-1 rounded-lg border border-separator/40 bg-surface text-[10px] font-medium text-on-surface hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors flex items-center gap-1"
                    title="Export Summary"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                    Export Summary
                  </button>
                </div>
              </div>
            );
          })()}
          {showSummary && (
            <div className="px-5 pt-3 pb-4 overflow-x-auto space-y-3">
              {isHidase && (() => {
                const totalDisp = summary.reduce((acc, s) => acc + s.nonDefectDisposal, 0);
                const c1 = summary.reduce((acc, s) => acc + (s.disposalDetail?.初回生産品 || 0), 0);
                const c2 = summary.reduce((acc, s) => acc + (s.disposalDetail?.終物 || 0), 0);
                const c3 = summary.reduce((acc, s) => acc + (s.disposalDetail?.サンプル || 0), 0);
                const c4 = summary.reduce((acc, s) => acc + (s.disposalDetail?.調整用 || 0), 0);
                return (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-500 mr-2">
                      <span className="material-symbols-outlined text-sm">delete_sweep</span>
                      <span>非不良廃棄 合計: {totalDisp.toLocaleString()}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-surface text-[11px] text-on-surface border border-separator/30">
                      初回生産品: <strong>{c1.toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface text-[11px] text-on-surface border border-separator/30">
                      終物: <strong>{c2.toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface text-[11px] text-on-surface border border-separator/30">
                      サンプル: <strong>{c3.toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface text-[11px] text-on-surface border border-separator/30">
                      調整用: <strong>{c4.toLocaleString()}</strong>
                    </span>
                  </div>
                );
              })()}
              <table className="ui-table-data w-full min-w-[400px]">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-outline">
                    <th className="ui-table-heading text-left pb-2 pr-6">品番</th>
                    <th className="ui-table-heading text-left pb-2 pr-6">背番号</th>
                    <th className="ui-table-heading text-right pb-2 pr-6">{isHidase ? "良品 (Total)" : "Total"}</th>
                    {isHidase && (
                      <>
                        <th className="ui-table-heading text-right pb-2 pr-4 text-amber-500">非不良廃棄</th>
                        <th className="ui-table-heading text-right pb-2 pr-4 text-outline/80">初回生産品</th>
                        <th className="ui-table-heading text-right pb-2 pr-4 text-outline/80">終物</th>
                        <th className="ui-table-heading text-right pb-2 pr-4 text-outline/80">サンプル</th>
                        <th className="ui-table-heading text-right pb-2 pr-4 text-outline/80">調整用</th>
                      </>
                    )}
                    <th className="ui-table-heading text-right pb-2 pr-6">Total NG</th>
                    <th className="ui-table-heading text-right pb-2">不良率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator/20">
                  {summary.map((s, i) => {
                    const rate = s.total > 0 ? ((s.ng / s.total) * 100).toFixed(2) : "0.00";
                    return (
                      <tr key={i} className="hover:bg-surface-container/40 transition-colors">
                        <td className="py-2 pr-6 font-semibold text-on-surface">{s.hinban ?? "—"}</td>
                        <td className="py-2 pr-6 text-on-surface-variant">{s.sebanggo ?? "—"}</td>
                        <td className="py-2 pr-6 text-right text-on-surface font-mono">{s.total.toLocaleString()}</td>
                        {isHidase && (
                          <>
                            <td className={`py-2 pr-4 text-right font-mono font-semibold ${s.nonDefectDisposal > 0 ? "text-amber-500" : "text-outline"}`}>
                              {s.nonDefectDisposal}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-outline">{s.disposalDetail?.初回生産品 || 0}</td>
                            <td className="py-2 pr-4 text-right font-mono text-outline">{s.disposalDetail?.終物 || 0}</td>
                            <td className="py-2 pr-4 text-right font-mono text-outline">{s.disposalDetail?.サンプル || 0}</td>
                            <td className="py-2 pr-4 text-right font-mono text-outline">{s.disposalDetail?.調整用 || 0}</td>
                          </>
                        )}
                        <td className={`py-2 pr-6 text-right font-semibold font-mono ${s.ng > 0 ? "text-error" : "text-outline"}`}>{s.ng}</td>
                        <td className="py-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${defectChip(rate)}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showExport && (
        <ExportOptionsModal
          data={filtered}
          processName={processName}
          onClose={() => setShowExport(false)}
        />
      )}

      {showSummaryExport && (
        <ExportOptionsModal
          data={summaryExportData}
          processName={`${processName}_Summary`}
          onClose={() => setShowSummaryExport(false)}
        />
      )}
    </div>
  );
}
