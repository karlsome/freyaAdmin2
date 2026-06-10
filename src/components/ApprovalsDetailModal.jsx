import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchApprovalMasterReference } from "../services/approvalsApi";
import IconButton from "./IconButton";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";

const PhotoPreviewContext = createContext(() => {});
import {
  canApproveApproval,
  canApproveDeleteRequest,
  canCancelDeleteRequest,
  canPermanentlyDeleteRecycleBin,
  canRejectDeleteRequest,
  canRequestApprovalDeletion,
  canRequestCorrection,
  canRestoreRecycleBin,
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
  hasApprovalAccess,
} from "../utils/approvals";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseStructuredValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
    || (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function isStructuredValue(value) {
  return value != null && typeof value === "object";
}

function isImageUrl(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^data:image\//i.test(normalized)) return true;
  if (!/^https?:\/\//i.test(normalized)) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(normalized);
}

function formatPrimitiveValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString();
  return String(value);
}

function ActionButton({ tone = "primary", onClick, disabled, children }) {
  const tones = {
    primary: "bg-primary text-on-primary hover:opacity-90",
    danger: "bg-error text-on-error hover:opacity-90",
    warning: "bg-amber-500 text-black hover:opacity-90",
    neutral: "border border-separator/45 bg-white text-on-surface hover:bg-surface-container dark:bg-surface-container",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        "rounded-2xl px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone] || tones.primary
      )}
    >
      {children}
    </button>
  );
}

function PrimitiveFieldValue({ value, align = "right" }) {
  const formatted = formatApprovalValue(parseStructuredValue(value));
  const openPreview = useContext(PhotoPreviewContext);

  if (isImageUrl(value)) {
    return (
      <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
        <button
          type="button"
          onClick={() => openPreview({
            eyebrow: "Record Photo",
            displayName: "Record image",
            images: [{ url: value, label: "Record image" }],
            activeIndex: 0,
          })}
          className="overflow-hidden rounded-2xl border border-separator/40 bg-surface transition hover:-translate-y-0.5"
        >
          <img
            src={value}
            alt="Record field"
            className="max-h-28 rounded-2xl border border-separator/40 bg-surface object-contain"
          />
        </button>
      </div>
    );
  }

  return (
    <span
      className={`block min-w-0 whitespace-pre-wrap break-all text-xs font-mono text-on-surface-variant ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {formatted || formatPrimitiveValue(value)}
    </span>
  );
}

function StructuredValueCard({ value, depth = 0 }) {
  const normalizedValue = parseStructuredValue(value);

  if (!isStructuredValue(normalizedValue)) {
    return <PrimitiveFieldValue value={normalizedValue} align={depth > 0 ? "left" : "right"} />;
  }

  if (Array.isArray(normalizedValue)) {
    const items = normalizedValue.filter((item) => item != null && item !== "");

    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-separator/40 bg-surface-container/40 px-3 py-2 text-[11px] text-outline">
          Empty array
        </div>
      );
    }

    return (
      <div className="space-y-2 rounded-2xl border border-separator/40 bg-surface-container/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">Array</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => {
            const nestedValue = parseStructuredValue(item);
            const nestedStructured = isStructuredValue(nestedValue);

            return (
              <div key={index} className="rounded-2xl border border-outline-variant/15 bg-surface px-3 py-2.5">
                {nestedStructured ? (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-outline">
                      Item {index + 1}
                    </span>
                    <StructuredValueCard value={nestedValue} depth={depth + 1} />
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">
                      Item {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <PrimitiveFieldValue value={nestedValue} align="right" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const objectEntries = Object.entries(normalizedValue).filter(([, nestedValue]) => nestedValue != null && nestedValue !== "");

  if (objectEntries.length === 0) {
    return (
      <div className="rounded-2xl border border-separator/40 bg-surface-container/40 px-3 py-2 text-[11px] text-outline">
        Empty object
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-separator/40 bg-surface-container/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">Object</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
          {objectEntries.length} field{objectEntries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-2">
        {objectEntries.map(([nestedKey, nestedValue]) => {
          const normalizedNestedValue = parseStructuredValue(nestedValue);
          const nestedStructured = isStructuredValue(normalizedNestedValue);

          return (
            <div key={nestedKey} className="rounded-2xl border border-outline-variant/15 bg-surface px-3 py-2.5">
              {nestedStructured ? (
                <div className="space-y-2">
                  <span className="block break-all text-[10px] font-semibold uppercase tracking-wider text-outline">
                    {nestedKey}
                  </span>
                  <StructuredValueCard value={normalizedNestedValue} depth={depth + 1} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="break-all text-[11px] font-semibold text-outline">{nestedKey}</span>
                  <div className="min-w-0 flex-1">
                    <PrimitiveFieldValue value={normalizedNestedValue} align="right" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  onOpenEdit,
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
  const [photoPreview, setPhotoPreview] = useState(null);

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
  const canEditRecord = mode !== "recycle" && hasApprovalAccess(authUser);

  const modal = (
    <PhotoPreviewContext.Provider value={setPhotoPreview}>
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 lg:p-6">
        <div ref={modalRef} className="dashboard-section flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl">

          <div className="border-b border-separator/35 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-outline">Approval Record</div>
                <h2 className="mt-1 break-words text-xl font-semibold text-on-surface [overflow-wrap:anywhere]">{title}</h2>
                <p className="mt-1 break-words text-sm text-on-surface-variant [overflow-wrap:anywhere]">{subtitle || "Approval workflow details"}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={joinClasses("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusMeta.badgeClassName)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                    {statusMeta.icon}
                  </span>
                  {statusMeta.label}
                </span>

                <IconButton
                  icon="close"
                  onClick={onClose}
                  variant="outlined"
                  ariaLabel="Close dialog"
                />
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="min-h-0 overflow-y-auto px-6 py-5">
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
                  <div key={card.label} className="glass-card rounded-2xl px-4 py-4">
                    <div className={joinClasses("planner-data-text text-3xl font-semibold tabular-nums", card.tone)}>{card.value}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{card.label}</div>
                  </div>
                ))}
              </div>

              {mismatch.hasMismatch ? (
                <div className="mb-5 space-y-3">
                  {mismatch.dateMismatch ? (
                    <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-error">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>error</span>
                        <div>
                          <div className="text-sm font-semibold">Date Error Detected</div>
                          <p className="planner-data-text mt-1 text-sm font-semibold">
                            Input date: {sourceRecord?.Date || "—"} - Actual submission: {mismatch.objectIdDate || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {mismatch.timeMismatch ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-amber-700 dark:text-amber-300">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>schedule</span>
                        <div>
                          <div className="text-sm font-semibold">Time Drift Detected</div>
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
                  <div key={item.label} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                    <div className="planner-data-label text-outline">{item.label}</div>
                    <div className={joinClasses("planner-data-text mt-1 flex min-w-0 items-center gap-1 text-sm font-semibold", item.tone || "text-on-surface")}>
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{formatApprovalValue(item.value)}</span>
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
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Correction Note</div>
                      <p className="planner-data-text mt-2 whitespace-pre-wrap text-sm font-medium text-on-surface">{sourceRecord.correctionComment}</p>
                    </div>
                  ) : null}

                  {sourceRecord?.deleteRequestReason ? (
                    <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-error">Delete Reason</div>
                      <p className="planner-data-text mt-2 whitespace-pre-wrap text-sm font-medium text-on-surface">{sourceRecord.deleteRequestReason}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mb-5 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Quality Details</div>
                    <h3 className="mt-1 text-base font-semibold text-on-surface">Counter Breakdown</h3>
                  </div>
                </div>

                {counters.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {counters.map((counter) => (
                      <div key={counter.label} className="rounded-2xl border border-error/15 bg-error/5 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{counter.label}</div>
                        <div className="planner-data-text mt-2 text-2xl font-semibold text-error tabular-nums">{counter.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    No recorded NG details for this record.
                  </div>
                )}
              </div>

              <div className="mb-5 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">All Fields</div>
                <div className="mt-3 space-y-0">
                  {detailEntries.map(([field, value]) => (
                    <div
                      key={field}
                      className="grid grid-cols-1 gap-2 border-b border-outline-variant/10 py-3 last:border-0 md:grid-cols-[minmax(120px,160px)_1fr] md:gap-4"
                    >
                      <span className="break-all text-[11px] font-semibold text-outline md:pt-1">{field}</span>
                      {isStructuredValue(parseStructuredValue(value)) ? (
                        <StructuredValueCard value={value} />
                      ) : (
                        <PrimitiveFieldValue value={value} align="right" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Approval History</div>
                {approvalHistory.length ? (
                  <div className="mt-3 space-y-3">
                    {approvalHistory.map((entry, index) => (
                      <div key={`${entry.timestamp || index}-${entry.action || index}`} className="rounded-2xl border border-outline-variant/15 bg-white/80 px-4 py-3 dark:bg-surface-container">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-on-surface">{entry.action || "Update"}</div>
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

            <aside className="min-h-0 overflow-y-auto border-t border-outline-variant/20 bg-surface-container-lowest/60 px-6 py-5 lg:border-l lg:border-t-0">
              <div className="mt-5 rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Submitted Images</div>

                {images.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {images.map((image, index) => (
                      <button
                        key={`${image.sourceKey}-${image.url}`}
                        type="button"
                        onClick={() => setPhotoPreview({
                          eyebrow: "Submitted Images",
                          displayName: image.label || "Submitted image",
                          subtitle: subtitle || title || undefined,
                          images: images.map((img) => ({ url: img.url, label: img.label })),
                          activeIndex: index,
                        })}
                        className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low text-left transition hover:-translate-y-0.5"
                      >
                        <img src={image.url} alt={image.label} className="h-40 w-full object-cover" />
                        <div className="px-3 py-3">
                          <div className="text-xs font-semibold text-on-surface">{image.label}</div>
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

              <div className="mt-5 rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Master Reference</div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low">
                  {masterImageLoading ? (
                    <div className="flex h-52 items-center justify-center text-sm font-semibold text-on-surface-variant">
                      Loading reference image...
                    </div>
                  ) : masterImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPhotoPreview({
                        eyebrow: "Master Reference",
                        displayName: "Master reference",
                        subtitle: title || undefined,
                        images: [{ url: masterImageUrl, label: "Master reference" }],
                        activeIndex: 0,
                      })}
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

              <div className="mt-5 rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Actions</div>

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
                      {canEditRecord ? (
                        <ActionButton tone="primary" disabled={busy} onClick={() => onOpenEdit?.(sourceRecord)}>
                          Edit Record
                        </ActionButton>
                      ) : null}
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
                      {canRequestApprovalDeletion(sourceRecord, authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onRequestDeletion?.(sourceRecord)}>
                          Request Delete
                        </ActionButton>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
    <SensorDevicePhotoPreviewModal
      preview={photoPreview}
      onClose={() => setPhotoPreview(null)}
      onNavigate={(delta) => setPhotoPreview((prev) => {
        if (!prev || !prev.images?.length) return prev;
        const len = prev.images.length;
        const next = ((prev.activeIndex + delta) % len + len) % len;
        return { ...prev, activeIndex: next };
      })}
    />
    </PhotoPreviewContext.Provider>
  );

  return createPortal(modal, document.body);
}