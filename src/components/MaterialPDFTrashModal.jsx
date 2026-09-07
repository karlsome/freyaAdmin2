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
        <div ref={modalRef} className="freya-card flex w-full max-w-5xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Trash</div>
                <h3 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--text-primary)]">Deleted Material PDFs</h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Files stay recoverable for 30 days before permanent cleanup.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onRecoverAll}
                  disabled={disableBulkActions}
                  className="rounded-[6px] border border-[var(--status-success)]/30 bg-[var(--status-success)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-success)] hover:bg-[var(--status-success)]/20 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Recover All
                </button>
                <button
                  type="button"
                  onClick={onDeleteAll}
                  disabled={disableBulkActions}
                  className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete All
                </button>
                <IconButton icon="close" onClick={onClose} size="md" ariaLabel="Close dialog" />
              </div>
            </div>
          </div>

          <div className="max-h-[62vh] overflow-y-auto px-6 py-4 scrollbar-hide">
            {loading ? (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-12 text-center text-xs font-medium text-[var(--text-muted)]">
                Loading trash…
              </div>
            ) : error ? (
              <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-6 py-12 text-center text-xs font-medium text-[var(--status-danger)]">
                {error}
              </div>
            ) : !items.length ? (
              <EmptyState className="bg-[var(--surface-subtle)] py-10">Trash is empty.</EmptyState>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const { daysAgo, daysLeft } = getTrashAgeSummary(item?.deletedAt);

                  return (
                    <div key={getMaterialPDFItemId(item)} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
                      <div className="flex flex-col gap-3.5 md:flex-row md:items-start">
                        <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface)] md:w-32">
                          {item?.imageURL ? (
                            <img src={item.imageURL} alt={item.fileName} className="h-full w-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">picture_as_pdf</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[var(--text-primary)]">{formatMaterialPDFTitle(item)}</div>
                              <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{item?.fileName || "Untitled file"}</div>
                              <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                                Type: {item?.pdfType || "—"} · Deleted {daysAgo} day{daysAgo === 1 ? "" : "s"} ago · Uploaded {formatMaterialPDFDateTime(item?.uploadedAt)}
                              </div>
                            </div>

                            <div className="shrink-0 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                              {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2.5">
                            <button
                              type="button"
                              onClick={() => onRecover(item)}
                              disabled={actionBusy}
                              className="rounded-[6px] border border-[var(--status-success)]/30 bg-[var(--status-success)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-success)] hover:bg-[var(--status-success)]/20 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Recover
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePermanent(item)}
                              disabled={actionBusy}
                              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span>Showing {start}-{end} of {totalCount}</span>
              <label className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                  Page {page} / {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
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