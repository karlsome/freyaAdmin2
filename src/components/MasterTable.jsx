import DataTable from "./DataTable";
import { MASTER_PAGE_SIZE_OPTIONS, formatMasterValue } from "../utils/masterDB";

const EMPHASIS_COLUMNS = new Set(["品番", "品名", "材料品番", "材料背番号", "材料", "ラベル品番", "原材料品番"]);

function getColumnWidth(columnKey) {
  const upperKey = String(columnKey || "").toUpperCase();

  if (columnKey === "imageURL") return 112;
  if (upperKey.includes("CONFIG") || upperKey.includes("BOARD") || upperKey.includes("DATA")) return 280;
  if (columnKey === "ラベル品番" || columnKey === "原材料品番") return 220;
  if (columnKey === "仕様") return 220;
  if (columnKey === "ロール温度") return 144;
  if (columnKey === "NMOJI_ユーザー") return 168;
  if (upperKey.includes("LEADTIME")) return 140;
  if (upperKey.includes("MOQ")) return 120;
  if (EMPHASIS_COLUMNS.has(columnKey)) return 220;
  return 168;
}

function renderImageCell(record) {
  return record.imageURL ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image</span>
      あり
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-outline">
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image_not_supported</span>
      なし
    </span>
  );
}

export default function MasterTable({
  columns,
  records,
  loading,
  error,
  sort,
  page,
  pageSize,
  filteredCount,
  totalPages,
  onSort,
  onPageChange,
  onPageSizeChange,
  onRowClick,
}) {
  const tableColumns = columns.map((column) => {
    if (column.key === "imageURL") {
      return {
        ...column,
        sortable: false,
        width: 112,
        minWidth: 96,
        headerCellClassName: "px-3 py-2.5 text-left whitespace-nowrap",
        headerButtonClassName: "ui-table-heading inline-flex items-center gap-2 uppercase tracking-wider text-on-surface-variant",
        cellClassName: "px-3 py-2.5 whitespace-nowrap",
        disableCellWrapper: true,
        renderCell: (record) => renderImageCell(record),
      };
    }

    const emphasis = EMPHASIS_COLUMNS.has(column.key);

    return {
      ...column,
      width: getColumnWidth(column.key),
      minWidth: emphasis ? 160 : 120,
      headerCellClassName: "px-3 py-2.5 text-left whitespace-nowrap",
      headerButtonClassName: "ui-table-heading inline-flex items-center gap-2 uppercase tracking-wider text-on-surface-variant transition hover:text-on-surface",
      cellClassName: [
        "px-3 py-2.5 align-top",
        emphasis ? "font-bold text-primary" : "text-on-surface",
      ].join(" "),
      contentClassName: "block w-full",
      getCellTitle: (record) => formatMasterValue(record[column.key]),
      renderCell: (record) => formatMasterValue(record[column.key]),
    };
  });

  return (
    <DataTable
      columns={tableColumns}
      rows={records}
      loading={loading}
      error={error}
      sort={sort}
      page={page}
      pageSize={pageSize}
      filteredCount={filteredCount}
      totalPages={totalPages}
      onSort={onSort}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      pageSizeOptions={MASTER_PAGE_SIZE_OPTIONS}
      rowKey={(record, index) => `${record._id?.$oid || record._id || index}`}
      onRowClick={onRowClick}
      loadingMessage="Loading master records…"
      errorTitle="Could not load master records"
      emptyTitle="No matching records"
      emptyMessage="Adjust the filters, search tags, or advanced query and try again."
      enableColumnResize
      enableColumnReorder
      layoutStorageKey="freyaAdmin2.masterTableLayout"
      stickyHeader
      stickyHeaderOffset={0}
      stickyHeaderCellClassName="bg-surface-container-high shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]"
      defaultColumnWidth={168}
      defaultMinColumnWidth={120}
      tableClassName="ui-table-data w-full border-separate border-spacing-0"
      tableViewportClassName="max-h-[68vh] overflow-auto overscroll-contain"
      headClassName="bg-surface-container-high/40 border-b border-outline-variant/20"
      rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
      clickableRowClassName="cursor-pointer"
    />
  );
}