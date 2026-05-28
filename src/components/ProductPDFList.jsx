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
              className="h-4 w-4 rounded border-outline-variant/40"
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
      renderCell: (row) => <span className="font-bold text-on-surface">{formatProductPDFTitle(row, 6)}</span>,
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
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onPreviewItem(row)}
            disabled={!row?.imageURL}
            className="rounded-xl border border-outline-variant/20 px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            Preview
          </button>
          {row?.pdfURL && (
            <a
              href={row.pdfURL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-outline-variant/20 px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-surface-container"
            >
              PDF
            </a>
          )}
          <button
            type="button"
            onClick={() => onDeleteItem(row)}
            className="rounded-xl bg-error/10 px-3 py-1.5 text-xs font-bold text-error transition hover:bg-error/15"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="glass-card rounded-3xl p-5 mb-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Library</div>
            <h3 className="mt-1 text-xl font-bold text-on-surface">{typeMeta.label} files</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Search by 背番号, 品番, or モデル and switch between card and table browsing.</p>
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
              className="rounded-2xl border border-outline-variant/20 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allSelected ? "Clear Page" : "Select Page"}
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={!selectedCount}
              className="rounded-2xl bg-error/10 px-3 py-2 text-xs font-bold text-error transition hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Selected ({selectedCount})
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row">
          <div className="ui-control-surface flex min-h-[52px] flex-1 flex-wrap items-center gap-2 rounded-3xl border border-outline-variant/20 px-4 py-3">
            {searchTokens.map((token) => (
              <span key={token} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <span>{token}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSearchToken(token)}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 transition hover:bg-primary/20"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                </button>
              </span>
            ))}

            <input
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Type and press Enter to add search terms…"
              className="min-w-[14rem] flex-1 bg-transparent text-sm text-on-surface outline-none"
            />
          </div>

          <select
            value={modelFilter}
            onChange={(event) => onModelFilterChange(event.target.value)}
            className="h-[52px] rounded-3xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 lg:w-72"
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
        <div className="glass-card overflow-hidden rounded-3xl mb-8">
          <div className="flex flex-col gap-4 border-b border-separator/35 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-medium text-on-surface-variant">{renderPageInfoText(totalCount, page, pageSize)}</div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Per page</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-10 rounded-2xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
              >
                {PRODUCT_PDF_PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative">
            {loading && items.length > 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70 backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-full bg-surface px-4 py-3 text-sm font-bold text-on-surface shadow-lg">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                  Loading product PDFs…
                </div>
              </div>
            )}

            {loading && !items.length ? (
              <div className="px-5 py-12 text-center text-sm font-medium text-on-surface-variant">Loading product PDFs…</div>
            ) : error ? (
              <div className="px-5 py-12 text-center text-sm font-medium text-error">{error}</div>
            ) : !items.length ? (
              <div className="px-5 py-12 text-center text-sm text-on-surface-variant">No files found for this view.</div>
            ) : (
              <div className="grid gap-4 px-5 py-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6" aria-busy={loading}>
                {items.map((item) => {
                  const documentId = getProductPDFItemId(item);
                  const checked = selectedIds.has(documentId);

                  return (
                    <article
                      key={documentId}
                      className="group relative rounded-3xl border border-outline-variant/15 bg-surface-container-low p-4 transition hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      <div className="absolute left-4 top-4 z-10">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleItemSelection(documentId)}
                          className="h-4 w-4 rounded border-outline-variant/40"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => item?.imageURL && onPreviewItem(item)}
                        className="block w-full text-left"
                      >
                        <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-surface px-4 py-4">
                          {item?.imageURL ? (
                            <img src={item.imageURL} alt={item.fileName} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" />
                          ) : (
                            <span className="material-symbols-outlined text-5xl text-outline">picture_as_pdf</span>
                          )}
                        </div>
                      </button>

                      <div className="mt-4">
                        <div className="text-sm font-bold text-on-surface">{formatProductPDFTitle(item, 6)}</div>
                        <div className="mt-1 text-xs text-on-surface-variant">{formatProductPDFHinban(item)}</div>
                        <div className="mt-2 truncate text-xs text-outline">{item?.fileName || "Untitled file"}</div>
                        <div className="mt-1 text-xs text-outline">{item?.uploadedBy || "—"} · {formatProductPDFDateTime(item?.uploadedAt)}</div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onPreviewItem(item)}
                          disabled={!item?.imageURL}
                          className="rounded-xl border border-outline-variant/20 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Preview
                        </button>
                        {item?.pdfURL && (
                          <a
                            href={item.pdfURL}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-outline-variant/20 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                          >
                            Open PDF
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item)}
                          className="rounded-xl bg-error/10 px-3 py-2 text-xs font-bold text-error transition hover:bg-error/15"
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

          <div className="flex flex-col gap-4 border-t border-separator/30 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-on-surface-variant">{selectedCount} selected</div>

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