//This component displays a paginated, sortable, and searchable table of production records for a specific process (Kensa, Press, SRS, or Slit). It also includes a summary section that aggregates data by part number and worker ID. The component is designed to be reusable for different processes by passing the appropriate props.
import { useEffect, useMemo, useRef, useState } from "react";
import DataTable from "./DataTable";

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

function groupSummary(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = `${r["品番"]}__${r["背番号"]}`;
    if (!map.has(key)) map.set(key, { hinban: r["品番"], sebanggo: r["背番号"], total: 0, ng: 0 });
    const e = map.get(key);
    e.total += Number(r.Process_Quantity) || Number(r.Total) || 0;
    e.ng    += Number(r.Total_NG) || 0;
  });
  return Array.from(map.values());
}

// ─── ProcessPanel ─────────────────────────────────────────────────────────────
// Props:
//   processName — "Kensa" | "Press" | "SRS" | "Slit"
//   rows        — array of raw production records from the matching DB
//   onRowClick  — callback(record, processName) when a row is clicked
export default function ProcessPanel({ processName, rows, onRowClick, showFactoryColumn = false }) {
  const accent = PROCESS_ACCENT[processName] ?? PROCESS_ACCENT.Kensa;
  const [sort, setSort]               = useState({ col: null, dir: 1 });
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState("");
  const [showSummary, setShowSummary] = useState(false);
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
      const ha = calcWorkHours(a.Time_start, a.Time_end) ?? -1;
      const hb = calcWorkHours(b.Time_start, b.Time_end) ?? -1;
      return (ha - hb) * sort.dir;
    }
    if (sort.col === "Defect_Rate") {
      const qa = Number(a.Process_Quantity) || 0;
      const qb = Number(b.Process_Quantity) || 0;
      const ra = qa ? (Number(a.Total_NG) || 0) / qa : 0;
      const rb = qb ? (Number(b.Total_NG) || 0) / qb : 0;
      return (ra - rb) * sort.dir;
    }
    const va = a[sort.col] ?? "";
    const vb = b[sort.col] ?? "";
    if (SORT_NUMERIC.has(sort.col)) return (Number(va) - Number(vb)) * sort.dir;
    return va.toString().localeCompare(vb.toString(), "ja") * sort.dir;
  });

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const pageRows   = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const summary    = groupSummary(sorted);
  const pageStart = totalItems ? (page - 1) * ITEMS_PER_PAGE + 1 : 0;
  const pageEnd = Math.min(page * ITEMS_PER_PAGE, totalItems);

  const tableColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "品番",
        label: "品番",
        width: 164,
        renderCell: (row) => <span className="font-bold text-on-surface">{row["品番"] ?? "—"}</span>,
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
        label: "Total",
        width: 108,
        align: "right",
        renderCell: (row) => {
          const quantity = Number(row.Process_Quantity) || Number(row.Total) || 0;
          return <span className="font-bold text-on-surface">{quantity.toLocaleString()}</span>;
        },
        disableCellWrapper: true,
      },
      {
        key: "Total_NG",
        label: "Total NG",
        width: 112,
        align: "right",
        renderCell: (row) => {
          const totalNg = Number(row.Total_NG) || 0;
          return <span className={totalNg > 0 ? "font-bold text-error" : "font-bold text-outline"}>{totalNg}</span>;
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
          const hours = calcWorkHours(row.Time_start, row.Time_end);
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
          const totalNg = Number(row.Total_NG) || 0;
          const rate = quantity > 0 ? ((totalNg / quantity) * 100).toFixed(2) : "0.00";
          return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${defectChip(rate)}`}>
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
  }, [showFactoryColumn]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-separator/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${accent.dot}`} />
          <h4 className="text-sm font-bold text-on-surface truncate">{processName} Process</h4>
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-outline flex-shrink-0">
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
              className="text-[11px] text-outline hover:text-on-surface transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
              Summary
            </button>
          )}
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-7 px-2.5 rounded-lg bg-surface-container border border-separator/35 text-[11px]
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
        rowKey={(row, index) => `${processName}-${row["品番"] || "part"}-${row["背番号"] || "serial"}-${row.Date || index}`}
        onRowClick={onRowClick ? (row) => onRowClick(row, processName) : undefined}
        renderPageInfo={() => (
          <span className="text-sm text-on-surface-variant">{totalItems} records, showing {pageStart}-{pageEnd}</span>
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
        bottomBarClassName="flex flex-col gap-4 border-t border-separator/30 px-1 pt-4 md:flex-row md:items-center md:justify-between"
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
        <div ref={summaryRef} className="border-t border-separator/30">
          <button
            className="w-full px-5 py-3 flex items-center gap-2 text-xs font-bold text-outline hover:text-on-surface transition-colors"
            onClick={() => setShowSummary((v) => !v)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {showSummary ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
            Daily Summary ({summary.length} parts)
          </button>
          {showSummary && (
            <div className="px-5 pb-4 overflow-x-auto">
              <table className="ui-table-data w-full min-w-[400px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-outline">
                    <th className="ui-table-heading text-left pb-2 pr-6">品番</th>
                    <th className="ui-table-heading text-left pb-2 pr-6">背番号</th>
                    <th className="ui-table-heading text-right pb-2 pr-6">Total</th>
                    <th className="ui-table-heading text-right pb-2 pr-6">Total NG</th>
                    <th className="ui-table-heading text-right pb-2">不良率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator/20">
                  {summary.map((s, i) => {
                    const rate = s.total > 0 ? ((s.ng / s.total) * 100).toFixed(2) : "0.00";
                    return (
                      <tr key={i} className="hover:bg-surface-container/40 transition-colors">
                        <td className="py-2 pr-6 font-bold text-on-surface">{s.hinban ?? "—"}</td>
                        <td className="py-2 pr-6 text-on-surface-variant">{s.sebanggo ?? "—"}</td>
                        <td className="py-2 pr-6 text-right text-on-surface">{s.total.toLocaleString()}</td>
                        <td className={`py-2 pr-6 text-right font-bold ${s.ng > 0 ? "text-error" : "text-outline"}`}>{s.ng}</td>
                        <td className="py-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${defectChip(rate)}`}>
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
    </div>
  );
}
