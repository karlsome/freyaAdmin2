import { useLanguage } from "../contexts/LanguageContext";
import DataTable from "./DataTable";
import LiquidSegmentedControl from "./LiquidSegmentedControl";
import PaginationControls from "./PaginationControls";
import {
  MATERIAL_PDF_PAGE_SIZE_OPTIONS,
  formatMaterialPDFDateTime,
  formatMaterialPDFHinban,
  formatMaterialPDFTitle,
  getMaterialPDFItemId,
} from "../utils/materialPDFs";

function renderPageInfoText(totalCount, page, pageSize, isJa) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  return isJa ? `${totalCount} 件中 ${start}〜${end} 件を表示` : `Showing ${start}-${end} of ${totalCount}`;
}

export default function MaterialPDFList({
  typeMeta,
  items = [],
  loading,
  error,
  viewMode,
  onViewModeChange,
  searchInput,
  searchTokens = [],
  onSearchInputChange,
  onSearchKeyDown,
  onRemoveSearchToken,
  processFilter,
  processOptions = [],
  onProcessFilterChange,
  selectedIds,
  onToggleItemSelection,
  onToggleSelectAll,
  onDeleteSelected,
  onDeleteItem,
  onPreviewItem,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  sort,
  onSort,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(getMaterialPDFItemId(item)));
  const columns = [
    {
      key: "selection",
      label: isJa ? "選択" : "Select",
      sortable: false,
      width: 84,
      align: "center",
      renderCell: (row) => {
        const documentId = getMaterialPDFItemId(row);
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={selectedIds.has(documentId)}
              onChange={() => onToggleItemSelection(documentId)}
              className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
            />
          </div>
        );
      },
    },
    {
      key: "drawings",
      label: "図番",
      sortKey: "zuban",
      width: 260,
      renderCell: (row) => <span className="font-semibold text-[var(--text-primary)]">{formatMaterialPDFTitle(row, 6)}</span>,
      getCellTitle: (row) => formatMaterialPDFTitle(row, 20),
    },
    {
      key: "hinban",
      label: "品番",
      sortKey: "hinban",
      width: 220,
      renderCell: (row) => formatMaterialPDFHinban(row),
      getCellTitle: (row) => formatMaterialPDFHinban(row, 20),
    },
    {
      key: "fileName",
      label: isJa ? "ファイル" : "File",
      sortKey: "fileName",
      width: 260,
      getCellTitle: (row) => row?.fileName || "—",
    },
    {
      key: "uploadedBy",
      label: isJa ? "アップロード者" : "Uploader",
      sortKey: "uploader",
      width: 160,
      renderCell: (row) => row?.uploadedBy || "—",
    },
    {
      key: "uploadedAt",
      label: isJa ? "アップロード日時" : "Uploaded",
      sortKey: "uploadedAt",
      width: 180,
      renderCell: (row) => formatMaterialPDFDateTime(row?.uploadedAt),
      getCellTitle: (row) => formatMaterialPDFDateTime(row?.uploadedAt),
    },
    {
      key: "updatedAt",
      label: isJa ? "更新日時" : "Updated",
      sortKey: "updatedAt",
      width: 180,
      renderCell: (row) => formatMaterialPDFDateTime(row?.updatedAt || row?.uploadedAt),
      getCellTitle: (row) => formatMaterialPDFDateTime(row?.updatedAt || row?.uploadedAt),
    },
    {
      key: "actions",
      label: isJa ? "操作" : "Actions",
      sortable: false,
      width: 172,
      align: "right",
      renderCell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onPreviewItem(row)}
            disabled={!row?.imageURL}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isJa ? "プレビュー" : "Preview"}
          </button>
          {row?.pdfURL && (
            <a
              href={row.pdfURL}
              target="_blank"
              rel="noreferrer"
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              PDF
            </a>
          )}
          <button
            type="button"
            onClick={() => onDeleteItem(row)}
            className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs"
          >
            {isJa ? "削除" : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {isJa ? "ライブラリ" : "Library"}
            </div>
            <h3 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {isJa ? `${typeMeta.label} ファイル一覧` : `${typeMeta.label} files`}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa
                ? "図番、品番、工程コードで検索し、カード表示とテーブル表示を切り替えられます。"
                : "Search by 図番, 品番, or 工程コード and switch between card and table browsing."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LiquidSegmentedControl
              items={[{ key: "grid", label: isJa ? "カード" : "Grid" }, { key: "list", label: isJa ? "リスト" : "List" }]}
              activeKey={viewMode}
              onChange={onViewModeChange}
            />
            <button
              type="button"
              onClick={() => onToggleSelectAll(!allSelected)}
              disabled={!items.length}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allSelected ? (isJa ? "選択を解除" : "Clear Page") : (isJa ? "ページ全選択" : "Select Page")}
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={!selectedCount}
              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isJa ? `選択項目を削除 (${selectedCount})` : `Delete Selected (${selectedCount})`}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <div className="flex min-h-[40px] flex-1 flex-wrap items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 focus-within:border-[var(--freya-blue)] transition">
            {searchTokens.map((token) => (
              <span key={token} className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--freya-blue)]">
                <span>{token}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSearchToken(token)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[var(--freya-blue)]/10 transition hover:bg-[var(--freya-blue)]/20"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>
                </button>
              </span>
            ))}

            <input
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={isJa ? "キーワードを入力してEnterを押してください…" : "Type and press Enter to add search terms…"}
              className="min-w-[14rem] flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          <select
            value={processFilter}
            onChange={(event) => onProcessFilterChange(event.target.value)}
            className="h-10 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] lg:w-72"
          >
            <option value="">{isJa ? "すべての工程" : "All processes"}</option>
            {processOptions.map((process) => (
              <option key={process} value={process}>{process}</option>
            ))}
          </select>
        </div>
      </div>

      {viewMode === "list" ? (
        <DataTable
          columns={columns}
          rows={items}
          loading={loading}
          error={error}
          sort={sort}
          page={page}
          pageSize={pageSize}
          filteredCount={totalCount}
          totalPages={totalPages}
          onSort={onSort}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={MATERIAL_PDF_PAGE_SIZE_OPTIONS}
          pageSizeLabel={isJa ? "表示件数" : "Per page"}
          rowKey={(row) => getMaterialPDFItemId(row)}
          renderPageInfo={() => renderPageInfoText(totalCount, page, pageSize, isJa)}
          emptyTitle={isJa ? "ファイルが見つかりません" : "No files found"}
          emptyMessage={isJa ? "検索条件を変更するか、このタイプの新しいPDFをアップロードしてください。" : "Adjust the search terms or upload a new PDF for this type."}
          errorTitle={isJa ? "ファイルを読み込めませんでした" : "Could not load files"}
          loadingMessage={isJa ? "材料PDFを読み込み中…" : "Loading material PDFs…"}
          enableColumnResize
          enableColumnReorder
          layoutStorageKey="freyaAdmin2.materialPDFListLayout"
          stickyHeader
          stickyHeaderOffset={0}
          tableViewportClassName="max-h-[68vh] overflow-auto overscroll-contain"
          tableClassName="ui-table-data min-w-full border-separate border-spacing-0"
          className="mb-8"
        />
      ) : (
        <div className="freya-card mb-8 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">{renderPageInfoText(totalCount, page, pageSize, isJa)}</div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {isJa ? "表示件数" : "Per page"}
              </span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
              >
                {MATERIAL_PDF_PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative">
            {loading && items.length > 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface)]/70 backdrop-blur-sm">
                <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-lg">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  {isJa ? "材料PDFを読み込み中…" : "Loading material PDFs…"}
                </div>
              </div>
            )}

            {loading && !items.length ? (
              <div className="px-5 py-12 text-center text-xs font-medium text-[var(--text-muted)]">
                {isJa ? "材料PDFを読み込み中…" : "Loading material PDFs…"}
              </div>
            ) : error ? (
              <div className="px-5 py-12 text-center text-xs font-medium text-[var(--status-danger)]">{error}</div>
            ) : !items.length ? (
              <div className="px-5 py-12 text-center text-xs text-[var(--text-muted)]">
                {isJa ? "表示するファイルがありません。" : "No files found for this view."}
              </div>
            ) : (
              <div className="grid gap-3.5 px-5 py-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6" aria-busy={loading}>
                {items.map((item) => {
                  const documentId = getMaterialPDFItemId(item);
                  const checked = selectedIds.has(documentId);

                  return (
                    <article
                      key={documentId}
                      className="group relative rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:shadow-md hover:border-[var(--border-strong)]"
                    >
                      <div className="absolute left-3.5 top-3.5 z-10">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleItemSelection(documentId)}
                          className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => item?.imageURL && onPreviewItem(item)}
                        className="block w-full text-left"
                      >
                        <div className="flex h-40 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
                          {item?.imageURL ? (
                            <img src={item.imageURL} alt={item.fileName} className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.02]" />
                          ) : (
                            <span className="material-symbols-outlined text-4xl text-[var(--text-muted)]">picture_as_pdf</span>
                          )}
                        </div>
                      </button>

                      <div className="mt-3">
                        <div className="truncate text-xs font-bold text-[var(--text-primary)]">{formatMaterialPDFTitle(item, 6)}</div>
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{formatMaterialPDFHinban(item)}</div>
                        <div className="mt-1.5 truncate text-[11px] text-[var(--text-muted)]">
                          {item?.fileName || (isJa ? "名称未設定ファイル" : "Untitled file")}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{item?.uploadedBy || "—"} · {formatMaterialPDFDateTime(item?.uploadedAt)}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3">
                        <button
                          type="button"
                          onClick={() => onPreviewItem(item)}
                          disabled={!item?.imageURL}
                          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isJa ? "プレビュー" : "Preview"}
                        </button>
                        {item?.pdfURL && (
                          <a
                            href={item.pdfURL}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                          >
                            PDF
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item)}
                          className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs"
                        >
                          {isJa ? "削除" : "Delete"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[var(--text-secondary)]">
              {isJa ? `${selectedCount} 件選択中` : `${selectedCount} selected`}
            </div>

            {totalPages > 1 && (
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={onPageChange}
                disabled={loading}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}