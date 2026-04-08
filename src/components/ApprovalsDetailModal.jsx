import { useEffect, useRef, useState } from "react";
import { fetchApprovalMasterReference } from "../services/approvalsApi";
import {
  canApproveApproval,
  canApproveDeleteRequest,
  canCancelDeleteRequest,
  canPermanentlyDeleteRecycleBin,
  canRejectDeleteRequest,
  canRequestApprovalDeletion,
  canRequestCorrection,
  canRestoreRecycleBin,
  canSoftDeleteApproval,
  collectApprovalImageEntries,
  formatApprovalValue,
  getApprovalCounters,
  getApprovalDateTimeMismatch,
  getApprovalDefectRate,
  getApprovalDetailEntries,
  getApprovalNGValue,
  getApprovalPrimaryApprover,
  getApprovalQuantityValue,
  getApprovalRecordSubtitle,
  getApprovalRecordTitle,
  getApprovalStatusMeta,
  getApproveActionLabel,
  getCorrectionActionLabel,
} from "../utils/approvals";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ActionButton({ tone = "primary", onClick, disabled, children }) {
  const tones = {
    primary: "bg-primary text-on-primary hover:opacity-90",
    danger: "bg-error text-on-error hover:opacity-90",
    warning: "bg-amber-500 text-black hover:opacity-90",
    neutral: "border border-outline-variant/25 bg-white text-on-surface hover:bg-surface-container dark:bg-surface-container",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        "rounded-2xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone] || tones.primary
      )}
    >
      {children}
    </button>
  );
}

function StructuredValue({ value }) {
  const formatted = formatApprovalValue(value);
  const structured = value && typeof value === "object";

  if (structured) {
    return (
      <pre className="planner-data-text whitespace-pre-wrap break-words rounded-2xl bg-surface-container-low px-3 py-2 text-xs text-on-surface">
        {formatted}
      </pre>
    );
  }

  return <div className="planner-data-text text-sm font-semibold text-on-surface">{formatted}</div>;
}

export default function ApprovalsDetailModal({
  open,
  record,
  tabKey,
  authUser,
  busy = false,
  mode = "live",
  onClose,
  onApprove,
  onRequestCorrection,
  onRequestDeletion,
  onSoftDelete,
  onApproveDeleteRequest,
  onRejectDeleteRequest,
  onCancelDeleteRequest,
  onRestore,
  onPermanentDelete,
}) {
  const modalRef = useRef(null);
  const sourceRecord = mode === "recycle" ? record?.originalDoc || {} : record || {};
  const [masterImageUrl, setMasterImageUrl] = useState("");
  const [masterImageLoading, setMasterImageLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    function handleMouseDown(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    let cancelled = false;

    if (!open || !sourceRecord) {
      setMasterImageUrl("");
      setMasterImageLoading(false);
      return undefined;
    }

    async function loadReference() {
      setMasterImageLoading(true);
      try {
        const imageUrl = await fetchApprovalMasterReference({
          partNumber: sourceRecord?.品番,
          serialNumber: sourceRecord?.背番号,
        });

        if (!cancelled) {
          setMasterImageUrl(imageUrl || "");
        }
      } catch {
        if (!cancelled) {
          setMasterImageUrl("");
        }
      } finally {
        if (!cancelled) {
          setMasterImageLoading(false);
        }
      }
    }

    loadReference();
    return () => {
      cancelled = true;
    };
  }, [open, sourceRecord]);

  if (!open || !record) return null;

  const statusMeta = getApprovalStatusMeta(sourceRecord);
  const quantity = getApprovalQuantityValue(sourceRecord, tabKey);
  const ngCount = getApprovalNGValue(sourceRecord, tabKey);
  const defectRate = getApprovalDefectRate(sourceRecord, tabKey);
  const counters = getApprovalCounters(sourceRecord, tabKey);
  const images = collectApprovalImageEntries(sourceRecord, tabKey);
  const detailEntries = getApprovalDetailEntries(sourceRecord);
  const approvalHistory = Array.isArray(sourceRecord?.approvalHistory)
    ? [...sourceRecord.approvalHistory].reverse()
    : [];
  const latestApprover = getApprovalPrimaryApprover(sourceRecord);
  const title = getApprovalRecordTitle(sourceRecord);
  const subtitle = getApprovalRecordSubtitle(sourceRecord);
  const mismatch = getApprovalDateTimeMismatch(sourceRecord);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 lg:p-6">
        <div ref={modalRef} className="glass-card flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px]">

          <div className="border-b border-outline-variant/20 px-5 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Approval Record</div>
                <h2 className="mt-1 text-xl font-black text-on-surface">{title}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{subtitle || "Approval workflow details"}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={joinClasses("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold", statusMeta.badgeClassName)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                    {statusMeta.icon}
                  </span>
                  {statusMeta.label}
                </span>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/20 bg-white/80 text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="min-h-0 overflow-y-auto px-5 py-5 lg:px-6">
              <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { label: "Quantity", value: quantity.toLocaleString(), tone: "text-on-surface" },
                  { label: "NG", value: ngCount.toLocaleString(), tone: ngCount > 0 ? "text-error" : "text-on-surface" },
                  {
                    label: "Defect Rate",
                    value: `${defectRate.toFixed(2)}%`,
                    tone: defectRate > 0 ? "text-error" : "text-emerald-600 dark:text-emerald-300",
                  },
                ].map((card) => (
                  <div key={card.label} className="glass-card rounded-3xl px-4 py-4">
                    <div className={joinClasses("planner-data-text text-3xl font-black tabular-nums", card.tone)}>{card.value}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{card.label}</div>
                  </div>
                ))}
              </div>

              {mismatch.hasMismatch ? (
                <div className="mb-5 space-y-3">
                  {mismatch.dateMismatch ? (
                    <div className="rounded-[28px] border border-error/20 bg-error/10 px-4 py-4 text-error">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>error</span>
                        <div>
                          <div className="text-sm font-black">Date Error Detected</div>
                          <p className="planner-data-text mt-1 text-sm font-semibold">
                            Input date: {sourceRecord?.Date || "—"} - Actual submission: {mismatch.objectIdDate || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {mismatch.timeMismatch ? (
                    <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-amber-700 dark:text-amber-300">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>schedule</span>
                        <div>
                          <div className="text-sm font-black">Time Drift Detected</div>
                          <p className="planner-data-text mt-1 text-sm font-semibold text-on-surface dark:text-on-surface">
                            End time: {sourceRecord?.Time_end || "—"} - Actual submission: {mismatch.objectIdTime || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Factory", value: sourceRecord?.工場 },
                  { label: "Worker", value: sourceRecord?.Worker_Name },
                  {
                    label: "Date",
                    value: sourceRecord?.Date,
                    tone: mismatch.dateMismatch ? "text-error" : "text-on-surface",
                    icon: mismatch.dateMismatch ? "warning" : "",
                    iconTitle: mismatch.dateMismatch ? `Actual submission date: ${mismatch.objectIdDate || "unknown"}` : "",
                  },
                  {
                    label: "Time",
                    value: [sourceRecord?.Time_start, sourceRecord?.Time_end].filter(Boolean).join(" - ") || "—",
                    tone: mismatch.timeMismatch ? "text-amber-700 dark:text-amber-300" : "text-on-surface",
                    icon: mismatch.timeMismatch ? "schedule" : "",
                    iconTitle: mismatch.timeMismatch ? `Actual submission time: ${mismatch.objectIdTime || "unknown"}` : "",
                  },
                  { label: "Part No.", value: sourceRecord?.品番 },
                  { label: "Serial No.", value: sourceRecord?.背番号 },
                  { label: "Equipment", value: sourceRecord?.設備 },
                  { label: "Approver", value: latestApprover || "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                    <div className="planner-data-label text-outline">{item.label}</div>
                    <div className={joinClasses("planner-data-text mt-1 flex items-center gap-1 text-sm font-semibold", item.tone || "text-on-surface")}>
                      <span>{formatApprovalValue(item.value)}</span>
                      {item.icon ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }} title={item.iconTitle || undefined}>
                          {item.icon}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {(sourceRecord?.correctionComment || sourceRecord?.deleteRequestReason) ? (
                <div className="mb-5 grid gap-4 md:grid-cols-2">
                  {sourceRecord?.correctionComment ? (
                    <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Correction Note</div>
                      <p className="planner-data-text mt-2 whitespace-pre-wrap text-sm font-medium text-on-surface">{sourceRecord.correctionComment}</p>
                    </div>
                  ) : null}

                  {sourceRecord?.deleteRequestReason ? (
                    <div className="rounded-3xl border border-error/20 bg-error/10 px-4 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-error">Delete Reason</div>
                      <p className="planner-data-text mt-2 whitespace-pre-wrap text-sm font-medium text-on-surface">{sourceRecord.deleteRequestReason}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mb-5 rounded-[28px] border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Quality Details</div>
                    <h3 className="mt-1 text-base font-black text-on-surface">Counter Breakdown</h3>
                  </div>
                </div>

                {counters.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {counters.map((counter) => (
                      <div key={counter.label} className="rounded-2xl border border-error/15 bg-error/5 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{counter.label}</div>
                        <div className="planner-data-text mt-2 text-2xl font-black text-error tabular-nums">{counter.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    No recorded NG details for this record.
                  </div>
                )}
              </div>

              <div className="mb-5 rounded-[28px] border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">All Fields</div>
                <div className="mt-3 space-y-3">
                  {detailEntries.map(([field, value]) => (
                    <div key={field} className="grid gap-2 border-b border-outline-variant/10 pb-3 last:border-0 last:pb-0 md:grid-cols-[minmax(160px,220px)_1fr]">
                      <div className="planner-data-label text-outline">{field}</div>
                      <StructuredValue value={value} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Approval History</div>
                {approvalHistory.length ? (
                  <div className="mt-3 space-y-3">
                    {approvalHistory.map((entry, index) => (
                      <div key={`${entry.timestamp || index}-${entry.action || index}`} className="rounded-2xl border border-outline-variant/15 bg-white/80 px-4 py-3 dark:bg-surface-container">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-bold text-on-surface">{entry.action || "Update"}</div>
                          <div className="planner-data-text text-xs text-on-surface-variant">{entry.timestamp ? new Date(entry.timestamp).toLocaleString("ja-JP") : "—"}</div>
                        </div>
                        <div className="mt-1 text-xs text-on-surface-variant">{entry.user || "Unknown user"}</div>
                        {entry.comment ? (
                          <p className="planner-data-text mt-2 whitespace-pre-wrap text-sm text-on-surface">{entry.comment}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-outline-variant/15 bg-white/80 px-4 py-3 text-sm text-on-surface-variant dark:bg-surface-container">
                    No approval history has been logged yet.
                  </div>
                )}
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto border-t border-outline-variant/20 bg-surface-container-lowest/60 px-5 py-5 lg:border-l lg:border-t-0 lg:px-6">
              <div className="rounded-[28px] border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Actions</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {mode === "recycle" ? (
                    <>
                      {canRestoreRecycleBin(authUser) ? (
                        <ActionButton tone="primary" disabled={busy} onClick={() => onRestore?.(record)}>
                          Restore Record
                        </ActionButton>
                      ) : null}
                      {canPermanentlyDeleteRecycleBin(authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onPermanentDelete?.(record)}>
                          Permanent Delete
                        </ActionButton>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {canApproveApproval(sourceRecord, authUser) ? (
                        <ActionButton tone="primary" disabled={busy} onClick={() => onApprove?.(sourceRecord)}>
                          {getApproveActionLabel(sourceRecord, authUser)}
                        </ActionButton>
                      ) : null}
                      {canRequestCorrection(sourceRecord, authUser) ? (
                        <ActionButton tone="warning" disabled={busy} onClick={() => onRequestCorrection?.(sourceRecord)}>
                          {getCorrectionActionLabel(sourceRecord, authUser)}
                        </ActionButton>
                      ) : null}
                      {canApproveDeleteRequest(sourceRecord, authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onApproveDeleteRequest?.(sourceRecord)}>
                          Approve Delete
                        </ActionButton>
                      ) : null}
                      {canRejectDeleteRequest(sourceRecord, authUser) ? (
                        <ActionButton tone="neutral" disabled={busy} onClick={() => onRejectDeleteRequest?.(sourceRecord)}>
                          Reject Delete
                        </ActionButton>
                      ) : null}
                      {canCancelDeleteRequest(sourceRecord, authUser) ? (
                        <ActionButton tone="warning" disabled={busy} onClick={() => onCancelDeleteRequest?.(sourceRecord)}>
                          Cancel Delete Request
                        </ActionButton>
                      ) : null}
                      {canSoftDeleteApproval(sourceRecord, authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onSoftDelete?.(sourceRecord)}>
                          Soft Delete
                        </ActionButton>
                      ) : null}
                      {canRequestApprovalDeletion(sourceRecord, authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onRequestDeletion?.(sourceRecord)}>
                          Request Delete
                        </ActionButton>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Submitted Images</div>

                {images.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {images.map((image) => (
                      <button
                        key={`${image.sourceKey}-${image.url}`}
                        type="button"
                        onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
                        className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-low text-left transition hover:-translate-y-0.5"
                      >
                        <img src={image.url} alt={image.label} className="h-40 w-full object-cover" />
                        <div className="px-3 py-3">
                          <div className="text-xs font-bold text-on-surface">{image.label}</div>
                          <div className="text-[11px] text-on-surface-variant">Open full size</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                    No uploaded images are attached to this record.
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-[28px] border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Master Reference</div>

                <div className="mt-4 overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-low">
                  {masterImageLoading ? (
                    <div className="flex h-52 items-center justify-center text-sm font-semibold text-on-surface-variant">
                      Loading reference image...
                    </div>
                  ) : masterImageUrl ? (
                    <button
                      type="button"
                      onClick={() => window.open(masterImageUrl, "_blank", "noopener,noreferrer")}
                      className="block w-full"
                    >
                      <img src={masterImageUrl} alt="Master reference" className="h-52 w-full object-contain bg-black/5" />
                    </button>
                  ) : (
                    <div className="flex h-52 items-center justify-center px-4 text-center text-sm font-semibold text-on-surface-variant">
                      No master reference image was found for this record.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}