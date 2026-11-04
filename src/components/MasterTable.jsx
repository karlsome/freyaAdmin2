import DataTable from "./DataTable";
import { MASTER_PAGE_SIZE_OPTIONS, formatMasterValue } from "../utils/masterDB";
import { useLanguage } from "../contexts/LanguageContext";

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

function renderImageCell(record, isJa) {
  return record.imageURL ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image</span>
      {isJa ? "あり" : "Yes"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-outline">
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image_not_supported</span>
      {isJa ? "なし" : "No"}
    </span>
  );
}

function getRecordValue(record, key) {
  if (!record || typeof record !== 'object') return '';
  if (record[key] !== undefined && record[key] !== null) return record[key];
  if (record['品目マスタ']?.[key] !== undefined && record['品目マスタ']?.[key] !== null) return record['品目マスタ'][key];
  if (record['resolved']?.[key]?.name !== undefined) return record['resolved'][key].name;
  if (record['resolved']?.[key]?.code !== undefined) return record['resolved'][key].code;
  return '';
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
  const { language } = useLanguage();
  const isJa = language === "ja";

  const tableColumns = columns.map((column) => {
    if (column.key === "imageURL") {
      return {
        ...column,
        sortable: false,
        width: 112,
        minWidth: 96,
        headerCellClassName: "px-4 py-2.5 text-left whitespace-nowrap",
        headerButtonClassName: "ui-table-heading inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em]",
        cellClassName: "px-4 py-3 whitespace-nowrap",
        disableCellWrapper: true,
        renderCell: (record) => renderImageCell(record, isJa),
      };
    }

    const emphasis = EMPHASIS_COLUMNS.has(column.key);

    return {
      ...column,
      width: getColumnWidth(column.key),
      minWidth: emphasis ? 160 : 120,
      headerCellClassName: "px-4 py-2.5 text-left whitespace-nowrap",
      headerButtonClassName: "ui-table-heading inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] transition hover:text-[var(--text-primary)]",
      cellClassName: [
        "px-4 py-3 align-top freya-tabular text-sm",
        emphasis ? "font-semibold text-[var(--freya-blue)]" : "font-medium text-[var(--text-primary)]",
      ].join(" "),
      contentClassName: "block w-full",
      getCellTitle: (record) => formatMasterValue(getRecordValue(record, column.key)),
      renderCell: (record) => formatMasterValue(getRecordValue(record, column.key)),
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
      loadingMessage={isJa ? "マスターレコードを読み込み中…" : "Loading master records…"}
      errorTitle={isJa ? "マスターレコードを読み込めませんでした" : "Could not load master records"}
      emptyTitle={isJa ? "該当するレコードがありません" : "No matching records"}
      emptyMessage={isJa ? "フィルター、検索タグ、または詳細クエリを変更して再試行してください。" : "Adjust the filters, search tags, or advanced query and try again."}
      enableColumnResize
      enableColumnReorder
      layoutStorageKey="freyaAdmin2.masterTableLayout"
      stickyHeader
      stickyHeaderOffset={0}
      stickyHeaderCellClassName="bg-surface-container-high shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]"
      defaultColumnWidth={168}
      defaultMinColumnWidth={120}
      tableClassName="ui-table-data w-full border-separate border-spacing-0"
      tableViewportClassName="max-h-[68vh] overflow-auto"
      headClassName="bg-surface-container-high/40 border-b border-outline-variant/20"
      rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
      clickableRowClassName="cursor-pointer"
    />
  );
}