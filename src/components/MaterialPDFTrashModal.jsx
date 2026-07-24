import { useEffect, useRef } from "react";
import EmptyState from "./EmptyState";
import IconButton from "./IconButton";
import {
  formatMaterialPDFDateTime,
  formatMaterialPDFTitle,
  getMaterialPDFItemId,
  getTrashAgeSummary,
} from "../utils/materialPDFs";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function MaterialPDFTrashModal({
  open,
  loading,
  error,
  items = [],
  page = 1,
  pageSize = 25,
  totalCount = 0,
  totalPages = 1,
  actionBusy = false,
  onClose,
  onPageChange,
  onPageSizeChange,
  onRecover,
  onDeletePermanent,
  onRecoverAll,
  onDeleteAll,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    function handleMouseDown(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const disableBulkActions = loading || actionBusy || items.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="glass-card flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-separator/40 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Trash</div>
                <h3 className="mt-1 text-2xl font-semibold text-on-surface">Deleted Material PDFs</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Files stay recoverable for 30 days before permanent cleanup.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onRecoverAll}
                  disabled={disableBulkActions}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                >
                  Recover All
                </button>
                <button
                  type="button"
                  onClick={onDeleteAll}
                  disabled={disableBulkActions}
                  className="rounded-2xl border border-error/20 bg-error/10 px-4 py-2 text-xs font-semibold text-error transition hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete All
                </button>
                <IconButton icon="close" onClick={onClose} size="md" ariaLabel="Close dialog" />
              </div>
            </div>
          </div>

          <div className="max-h-[62vh] overflow-y-auto px-6 py-5 scrollbar-hide">
            {loading ? (
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-6 py-12 text-center text-sm font-medium text-on-surface-variant">
                Loading trash…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-error/20 bg-error/10 px-6 py-12 text-center text-sm font-medium text-error">
                {error}
              </div>
            ) : !items.length ? (
              <EmptyState className="bg-surface-container-low">Trash is empty.</EmptyState>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const { daysAgo, daysLeft } = getTrashAgeSummary(item?.deletedAt);

                  return (
                    <div key={getMaterialPDFItemId(item)} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl bg-surface md:w-40">
                          {item?.imageURL ? (
                            <img src={item.imageURL} alt={item.fileName} className="h-full w-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-4xl text-outline">picture_as_pdf</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-on-surface">{formatMaterialPDFTitle(item)}</div>
                              <div className="mt-1 truncate text-sm text-on-surface-variant">{item?.fileName || "Untitled file"}</div>
                              <div className="mt-2 text-xs text-outline">
                                Type: {item?.pdfType || "—"} · Deleted {daysAgo} day{daysAgo === 1 ? "" : "s"} ago · Uploaded {formatMaterialPDFDateTime(item?.uploadedAt)}
                              </div>
                            </div>

                            <div className="shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                              {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onRecover(item)}
                              disabled={actionBusy}
                              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                            >
                              Recover
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePermanent(item)}
                              disabled={actionBusy}
                              className="rounded-2xl border border-error/20 bg-error/10 px-4 py-2 text-xs font-semibold text-error transition hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete Permanently
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-separator/40 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
              <span>Showing {start}-{end} of {totalCount}</span>
              <label className="flex items-center gap-2">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  className="h-10 rounded-2xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="rounded-2xl bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface-variant">
                  Page {page} / {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}