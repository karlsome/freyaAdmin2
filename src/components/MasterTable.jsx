import { MASTER_PAGE_SIZE_OPTIONS, buildPaginationItems, formatMasterValue } from "../utils/masterDB";

function PageInfo({ filteredCount, page, pageSize }) {
  if (!filteredCount) {
    return <span>0 records shown</span>;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filteredCount);
  return <span>{filteredCount} records, showing {start}-{end}</span>;
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
  const paginationItems = filteredCount ? buildPaginationItems(page, totalPages || 1) : [];

  return (
    <div className="glass-card rounded-2xl overflow-hidden mb-8">
      <div className="flex flex-col gap-4 border-b border-outline-variant/20 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-medium text-on-surface-variant">
          <PageInfo filteredCount={filteredCount} page={page} pageSize={pageSize} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-10 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          >
            {MASTER_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full bg-surface-container px-4 py-3 text-sm font-bold text-on-surface shadow-lg">
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>
                progress_activity
              </span>
              Loading master records…
            </div>
          </div>
        )}

        {error ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 text-error">
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>error</span>
            </div>
            <h3 className="text-lg font-black text-on-surface">Could not load master records</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{error}</p>
          </div>
        ) : !records.length ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container text-outline">
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>table_rows</span>
            </div>
            <h3 className="text-lg font-black text-on-surface">No matching records</h3>
            <p className="mt-2 text-sm text-on-surface-variant">Adjust the filters, search tags, or advanced query and try again.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant/20">
                <tr>
                  {columns.map((column) => {
                    const active = sort.column === column.key;
                    const arrow = !active ? "" : sort.direction === 1 ? "↑" : "↓";

                    return (
                      <th key={column.key} className="px-3 py-3 text-left whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSort(column.key)}
                          className="inline-flex items-center gap-2 font-bold text-on-surface-variant transition hover:text-on-surface"
                        >
                          <span>{column.label}</span>
                          <span className={active ? "text-primary" : "text-outline"}>{arrow || "↕"}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr
                    key={`${record._id?.$oid || record._id || index}`}
                    onClick={() => onRowClick(record)}
                    className="cursor-pointer border-b border-outline-variant/10 transition hover:bg-primary/5"
                  >
                    {columns.map((column) => {
                      if (column.key === "imageURL") {
                        return (
                          <td key={column.key} className="px-3 py-3 whitespace-nowrap">
                            {record.imageURL ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image</span>
                                あり
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-outline">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image_not_supported</span>
                                なし
                              </span>
                            )}
                          </td>
                        );
                      }

                      const emphasis = ["品番", "品名", "材料品番", "材料背番号", "材料"].includes(column.key);

                      return (
                        <td
                          key={column.key}
                          className={[
                            "px-3 py-3 align-top",
                            emphasis ? "font-bold text-primary" : "text-on-surface",
                          ].join(" ")}
                        >
                          <div className="max-w-[220px] truncate" title={formatMasterValue(record[column.key])}>
                            {formatMasterValue(record[column.key])}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-outline-variant/20 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-on-surface-variant">
          <PageInfo filteredCount={filteredCount} page={page} pageSize={pageSize} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-2xl border border-outline-variant/30 px-3 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          {paginationItems.map((item) => {
            if (typeof item !== "number") {
              return <span key={item} className="px-2 text-outline">…</span>;
            }

            const active = item === page;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={[
                  "min-w-10 rounded-2xl px-3 py-2 text-sm font-bold transition",
                  active
                    ? "bg-primary text-on-primary shadow-[0_0_18px_rgba(99,102,241,0.25)]"
                    : "border border-outline-variant/30 text-on-surface hover:bg-surface-container",
                ].join(" ")}
              >
                {item}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || totalPages <= 1}
            className="rounded-2xl border border-outline-variant/30 px-3 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}