import DataTable from "./DataTable";
import LiquidSegmentedControl from "./LiquidSegmentedControl";
import PaginationControls from "./PaginationControls";
import {
  PRODUCT_PDF_PAGE_SIZE_OPTIONS,
  formatProductPDFDateTime,
  formatProductPDFHinban,
  formatProductPDFTitle,
  getProductPDFItemId,
} from "../utils/productPDFs";

function renderPageInfoText(totalCount, page, pageSize) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  return `Showing ${start}-${end} of ${totalCount}`;
}

export default function ProductPDFList({
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
  modelFilter,
  modelOptions = [],
  onModelFilterChange,
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
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(getProductPDFItemId(item)));
  const columns = [
    {
      key: "selection",
      label: "Select",
      sortable: false,
      width: 84,
      align: "center",
      renderCell: (row) => {
        const documentId = getProductPDFItemId(row);
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
      key: "serials",
      label: "背番号",
      sortKey: "sebanggo",
      width: 260,
      renderCell: (row) => <span className="font-semibold text-[var(--text-primary)]">{formatProductPDFTitle(row, 6)}</span>,
      getCellTitle: (row) => formatProductPDFTitle(row, 20),
    },
    {
      key: "hinban",
      label: "品番",
      sortKey: "hinban",
      width: 220,
      renderCell: (row) => formatProductPDFHinban(row),
      getCellTitle: (row) => formatProductPDFHinban(row, 20),
    },
    {
      key: "fileName",
      label: "File",
      sortKey: "fileName",
      width: 260,
      getCellTitle: (row) => row?.fileName || "—",
    },
    {
      key: "uploadedBy",
      label: "Uploader",
      sortKey: "uploader",
      width: 160,
      renderCell: (row) => row?.uploadedBy || "—",
    },
    {
      key: "uploadedAt",
      label: "Uploaded",
      sortKey: "uploadedAt",
      width: 180,
      renderCell: (row) => formatProductPDFDateTime(row?.uploadedAt),
      getCellTitle: (row) => formatProductPDFDateTime(row?.uploadedAt),
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortKey: "updatedAt",
      width: 180,
      renderCell: (row) => formatProductPDFDateTime(row?.updatedAt || row?.uploadedAt),
      getCellTitle: (row) => formatProductPDFDateTime(row?.updatedAt || row?.uploadedAt),
    },
    {
      key: "actions",
      label: "Actions",
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
            Preview
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
            Delete
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
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Library</div>
            <h3 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--text-primary)]">{typeMeta.label} files</h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Search by 背番号, 品番, or モデル and switch between card and table browsing.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LiquidSegmentedControl
              items={[{ key: "grid", label: "Grid" }, { key: "list", label: "List" }]}
              activeKey={viewMode}
              onChange={onViewModeChange}
            />
            <button
              type="button"
              onClick={() => onToggleSelectAll(!allSelected)}
              disabled={!items.length}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allSelected ? "Clear Page" : "Select Page"}
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={!selectedCount}
              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Selected ({selectedCount})
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
              placeholder="Type and press Enter to add search terms…"
              className="min-w-[14rem] flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          <select
            value={modelFilter}
            onChange={(event) => onModelFilterChange(event.target.value)}
            className="h-10 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] lg:w-72"
          >
            <option value="">All models</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>{model}</option>
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
          pageSizeOptions={PRODUCT_PDF_PAGE_SIZE_OPTIONS}
          pageSizeLabel="Per page"
          rowKey={(row) => getProductPDFItemId(row)}
          renderPageInfo={() => renderPageInfoText(totalCount, page, pageSize)}
          emptyTitle="No files found"
          emptyMessage="Adjust the search terms or upload a new PDF for this type."
          errorTitle="Could not load files"
          loadingMessage="Loading product PDFs…"
          enableColumnResize
          enableColumnReorder
          layoutStorageKey="freyaAdmin2.productPDFListLayout"
          stickyHeader
          stickyHeaderOffset={0}
          tableViewportClassName="max-h-[68vh] overflow-auto overscroll-contain"
          tableClassName="ui-table-data min-w-full border-separate border-spacing-0"
          className="mb-8"
        />
      ) : (
        <div className="freya-card mb-8 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">{renderPageInfoText(totalCount, page, pageSize)}</div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Per page</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
              >
                {PRODUCT_PDF_PAGE_SIZE_OPTIONS.map((option) => (
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
                  Loading product PDFs…
                </div>
              </div>
            )}

            {loading && !items.length ? (
              <div className="px-5 py-12 text-center text-xs font-medium text-[var(--text-muted)]">Loading product PDFs…</div>
            ) : error ? (
              <div className="px-5 py-12 text-center text-xs font-medium text-[var(--status-danger)]">{error}</div>
            ) : !items.length ? (
              <div className="px-5 py-12 text-center text-xs text-[var(--text-muted)]">No files found for this view.</div>
            ) : (
              <div className="grid gap-3.5 px-5 py-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6" aria-busy={loading}>
                {items.map((item) => {
                  const documentId = getProductPDFItemId(item);
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
                        <div className="truncate text-xs font-bold text-[var(--text-primary)]">{formatProductPDFTitle(item, 6)}</div>
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{formatProductPDFHinban(item)}</div>
                        <div className="mt-1.5 truncate text-[11px] text-[var(--text-muted)]">{item?.fileName || "Untitled file"}</div>
                        <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{item?.uploadedBy || "—"} · {formatProductPDFDateTime(item?.uploadedAt)}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3">
                        <button
                          type="button"
                          onClick={() => onPreviewItem(item)}
                          disabled={!item?.imageURL}
                          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Preview
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
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[var(--text-secondary)]">{selectedCount} selected</div>

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