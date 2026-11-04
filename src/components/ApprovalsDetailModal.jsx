import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchApprovalMasterReference } from "../services/approvalsApi";
import IconButton from "./IconButton";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import { useLanguage } from "../contexts/LanguageContext";

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
    primary: "bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)] shadow-xs",
    danger: "border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 shadow-2xs",
    warning: "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 shadow-2xs",
    neutral: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        "rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
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
          className="overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] transition hover:border-[var(--freya-blue)]"
        >
          <img
            src={value}
            alt="Record field"
            className="max-h-24 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] object-contain"
          />
        </button>
      </div>
    );
  }

  return (
    <span
      className={`block min-w-0 whitespace-pre-wrap break-all text-xs font-mono text-[var(--text-secondary)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {formatted || formatPrimitiveValue(value)}
    </span>
  );
}

function StructuredValueCard({ value, depth = 0 }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const normalizedValue = parseStructuredValue(value);

  if (!isStructuredValue(normalizedValue)) {
    return <PrimitiveFieldValue value={normalizedValue} align={depth > 0 ? "left" : "right"} />;
  }

  if (Array.isArray(normalizedValue)) {
    const items = normalizedValue.filter((item) => item != null && item !== "");

    if (items.length === 0) {
      return (
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-mono text-[var(--text-muted)]">
          {isJa ? "空の配列" : "Empty array"}
        </div>
      );
    }

    return (
      <div className="space-y-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {isJa ? "配列" : "Array"}
          </span>
          <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-mono font-semibold text-[var(--text-secondary)]">
            {isJa ? `${items.length} 件` : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="space-y-1.5">
          {items.map((item, index) => {
            const nestedValue = parseStructuredValue(item);
            const nestedStructured = isStructuredValue(nestedValue);

            return (
              <div key={index} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                {nestedStructured ? (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {isJa ? `項目 ${index + 1}` : `Item ${index + 1}`}
                    </span>
                    <StructuredValueCard value={nestedValue} depth={depth + 1} />
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {isJa ? `項目 ${index + 1}` : `Item ${index + 1}`}
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
      <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-mono text-[var(--text-muted)]">
        {isJa ? "空のオブジェクト" : "Empty object"}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {isJa ? "オブジェクト" : "Object"}
        </span>
        <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-mono font-semibold text-[var(--text-secondary)]">
          {isJa ? `${objectEntries.length} 項目` : `${objectEntries.length} field${objectEntries.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="space-y-1.5">
        {objectEntries.map(([nestedKey, nestedValue]) => {
          const normalizedNestedValue = parseStructuredValue(nestedValue);
          const nestedStructured = isStructuredValue(normalizedNestedValue);

          return (
            <div key={nestedKey} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              {nestedStructured ? (
                <div className="space-y-2">
                  <span className="block break-all text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {nestedKey}
                  </span>
                  <StructuredValueCard value={normalizedNestedValue} depth={depth + 1} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="break-all text-[11px] font-mono font-semibold text-[var(--text-muted)]">{nestedKey}</span>
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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

  const statusMeta = getApprovalStatusMeta(sourceRecord, isJa);
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 lg:p-6">
        <div ref={modalRef} className="freya-card flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">

          <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isJa ? "承認レコード詳細" : "Approval Record"}
                </div>
                <h2 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)] font-mono [overflow-wrap:anywhere]">{title}</h2>
                <p className="mt-1 break-words text-xs text-[var(--text-muted)] [overflow-wrap:anywhere]">
                  {subtitle || (isJa ? "承認ワークフロー詳細" : "Approval workflow details")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={joinClasses("inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-wider", statusMeta.badgeClassName)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
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
            <div className="min-h-0 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { label: isJa ? "数量" : "Quantity", value: quantity.toLocaleString(), tone: "text-[var(--text-primary)]" },
                  { label: "NG", value: ngCount.toLocaleString(), tone: ngCount > 0 ? "text-[var(--status-danger)]" : "text-[var(--text-primary)]" },
                  {
                    label: isJa ? "不良率" : "Defect Rate",
                    value: `${defectRate.toFixed(2)}%`,
                    tone: defectRate > 0 ? "text-[var(--status-danger)]" : "text-emerald-600 dark:text-emerald-400",
                  },
                ].map((card) => (
                  <div key={card.label} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
                    <div className={joinClasses("text-2xl font-bold font-mono tabular-nums", card.tone)}>{card.value}</div>
                    <div className="mt-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">{card.label}</div>
                  </div>
                ))}
              </div>

              {mismatch.hasMismatch ? (
                <div className="space-y-3">
                  {mismatch.dateMismatch ? (
                    <div className="rounded-[8px] border border-error/30 bg-error/10 px-4 py-3 text-error">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>error</span>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider">
                            {isJa ? "日付の不一致を検出" : "Date Error Detected"}
                          </div>
                          <p className="mt-1 text-xs font-mono font-semibold">
                            {isJa
                              ? `入力日: ${sourceRecord?.Date || "—"} - 実際の提出日: ${mismatch.objectIdDate || "—"}`
                              : `Input date: ${sourceRecord?.Date || "—"} - Actual submission: ${mismatch.objectIdDate || "—"}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {mismatch.timeMismatch ? (
                    <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-300">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>schedule</span>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider">
                            {isJa ? "時間の乖離を検出" : "Time Drift Detected"}
                          </div>
                          <p className="mt-1 text-xs font-mono font-semibold text-[var(--text-primary)]">
                            {isJa
                              ? `終了時間: ${sourceRecord?.Time_end || "—"} - 実際の提出時間: ${mismatch.objectIdTime || "—"}`
                              : `End time: ${sourceRecord?.Time_end || "—"} - Actual submission: ${mismatch.objectIdTime || "—"}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: isJa ? "工場" : "Factory", value: sourceRecord?.工場 },
                  { label: isJa ? "作業者" : "Worker", value: sourceRecord?.Worker_Name },
                  {
                    label: isJa ? "日付" : "Date",
                    value: sourceRecord?.Date,
                    tone: mismatch.dateMismatch ? "text-error" : "text-[var(--text-primary)]",
                    icon: mismatch.dateMismatch ? "warning" : "",
                    iconTitle: mismatch.dateMismatch ? (isJa ? `実際の提出日: ${mismatch.objectIdDate || "不明"}` : `Actual submission date: ${mismatch.objectIdDate || "unknown"}`) : "",
                  },
                  {
                    label: isJa ? "時間" : "Time",
                    value: [sourceRecord?.Time_start, sourceRecord?.Time_end].filter(Boolean).join(" - ") || "—",
                    tone: mismatch.timeMismatch ? "text-amber-700 dark:text-amber-300" : "text-[var(--text-primary)]",
                    icon: mismatch.timeMismatch ? "schedule" : "",
                    iconTitle: mismatch.timeMismatch ? (isJa ? `実際の提出時間: ${mismatch.objectIdTime || "不明"}` : `Actual submission time: ${mismatch.objectIdTime || "unknown"}`) : "",
                  },
                  { label: isJa ? "品番" : "Part No.", value: sourceRecord?.品番 },
                  { label: isJa ? "背番号" : "Serial No.", value: sourceRecord?.背番号 },
                  { label: isJa ? "設備" : "Equipment", value: sourceRecord?.設備 },
                  { label: isJa ? "承認者" : "Approver", value: latestApprover || "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">{item.label}</div>
                    <div className={joinClasses("mt-0.5 flex min-w-0 items-center gap-1 text-xs font-semibold font-mono", item.tone || "text-[var(--text-primary)]")}>
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{formatApprovalValue(item.value)}</span>
                      {item.icon ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }} title={item.iconTitle || undefined}>
                          {item.icon}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {(sourceRecord?.correctionComment || sourceRecord?.deleteRequestReason) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {sourceRecord?.correctionComment ? (
                    <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                        {isJa ? "修正依頼コメント" : "Correction Note"}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs font-medium text-[var(--text-primary)]">{sourceRecord.correctionComment}</p>
                    </div>
                  ) : null}

                  {sourceRecord?.deleteRequestReason ? (
                    <div className="rounded-[8px] border border-error/30 bg-error/10 px-3.5 py-3">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-error">
                        {isJa ? "削除理由" : "Delete Reason"}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs font-medium text-[var(--text-primary)]">{sourceRecord.deleteRequestReason}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                <div className="mb-2.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {isJa ? "品質詳細" : "Quality Details"}
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">
                      {isJa ? "不良内訳カウンター" : "Counter Breakdown"}
                    </h3>
                  </div>
                </div>

                {counters.length ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {counters.map((counter) => (
                      <div key={counter.label} className="rounded-[6px] border border-error/20 bg-error/5 px-3 py-2">
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">{counter.label}</div>
                        <div className="mt-1 text-xl font-bold font-mono text-error tabular-nums">{counter.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[6px] border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {isJa ? "このレコードの不良内訳データはありません。" : "No recorded NG details for this record."}
                  </div>
                )}
              </div>

              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isJa ? "全項目データ" : "All Fields"}
                </div>
                <div className="mt-2.5 space-y-0">
                  {detailEntries.map(([field, value]) => (
                    <div
                      key={field}
                      className="grid grid-cols-1 gap-1 border-b border-[var(--border)] py-2 last:border-0 md:grid-cols-[minmax(120px,160px)_1fr] md:gap-4"
                    >
                      <span className="break-all text-[11px] font-semibold text-[var(--text-muted)] font-mono md:pt-0.5">{field}</span>
                      {isStructuredValue(parseStructuredValue(value)) ? (
                        <StructuredValueCard value={value} />
                      ) : (
                        <PrimitiveFieldValue value={value} align="right" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isJa ? "承認履歴" : "Approval History"}
                </div>
                {approvalHistory.length ? (
                  <div className="mt-2.5 space-y-2">
                    {approvalHistory.map((entry, index) => (
                      <div key={`${entry.timestamp || index}-${entry.action || index}`} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs font-bold text-[var(--text-primary)]">{entry.action || (isJa ? "更新" : "Update")}</div>
                          <div className="text-[11px] font-mono text-[var(--text-muted)]">{entry.timestamp ? new Date(entry.timestamp).toLocaleString("ja-JP") : "—"}</div>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] font-medium">{entry.user || (isJa ? "不明なユーザー" : "Unknown user")}</div>
                        {entry.comment ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-primary)]">{entry.comment}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {isJa ? "承認履歴はまだありません。" : "No approval history has been logged yet."}
                  </div>
                )}
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-subtle)]/30 px-5 py-5 lg:border-l lg:border-t-0 space-y-4">
              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isJa ? "提出画像" : "Submitted Images"}
                </div>

                {images.length ? (
                  <div className="mt-3 grid grid-cols-1 gap-2.5">
                    {images.map((image, index) => (
                      <button
                        key={`${image.sourceKey}-${image.url}`}
                        type="button"
                        onClick={() => setPhotoPreview({
                          eyebrow: isJa ? "提出画像" : "Submitted Images",
                          displayName: image.label || (isJa ? "提出画像" : "Submitted image"),
                          subtitle: subtitle || title || undefined,
                          images: images.map((img) => ({ url: img.url, label: img.label })),
                          activeIndex: index,
                        })}
                        className="overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] text-left transition hover:border-[var(--freya-blue)]"
                      >
                        <img src={image.url} alt={image.label} className="h-36 w-full object-cover" />
                        <div className="px-3 py-2 bg-[var(--surface)] border-t border-[var(--border)]">
                          <div className="text-xs font-semibold text-[var(--text-primary)]">{image.label}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{isJa ? "拡大表示" : "Open full size"}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {isJa ? "添付画像はありません。" : "No uploaded images are attached to this record."}
                  </div>
                )}
              </div>

              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isJa ? "マスタ図面・参考画像" : "Master Reference"}
                </div>

                <div className="mt-3 overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)]">
                  {masterImageLoading ? (
                    <div className="flex h-44 items-center justify-center text-xs font-semibold text-[var(--text-muted)]">
                      {isJa ? "参考画像を読み込み中..." : "Loading reference image..."}
                    </div>
                  ) : masterImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPhotoPreview({
                        eyebrow: isJa ? "マスタ参考画像" : "Master Reference",
                        displayName: isJa ? "マスタ参考画像" : "Master reference",
                        subtitle: title || undefined,
                        images: [{ url: masterImageUrl, label: isJa ? "マスタ参考画像" : "Master reference" }],
                        activeIndex: 0,
                      })}
                      className="block w-full"
                    >
                      <img src={masterImageUrl} alt="Master reference" className="h-44 w-full object-contain bg-black/5" />
                    </button>
                  ) : (
                    <div className="flex h-44 items-center justify-center px-4 text-center text-xs font-semibold text-[var(--text-muted)]">
                      {isJa ? "このレコードのマスタ参考画像はありません。" : "No master reference image was found for this record."}
                    </div>
                  )}
                </div>
              </div>

              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isJa ? "アクション" : "Actions"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {mode === "recycle" ? (
                    <>
                      {canRestoreRecycleBin(authUser) ? (
                        <ActionButton tone="primary" disabled={busy} onClick={() => onRestore?.(record)}>
                          {isJa ? "レコードを復元" : "Restore Record"}
                        </ActionButton>
                      ) : null}
                      {canPermanentlyDeleteRecycleBin(authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onPermanentDelete?.(record)}>
                          {isJa ? "完全に削除" : "Permanent Delete"}
                        </ActionButton>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {canEditRecord ? (
                        <ActionButton tone="primary" disabled={busy} onClick={() => onOpenEdit?.(sourceRecord)}>
                          {isJa ? "レコードを編集" : "Edit Record"}
                        </ActionButton>
                      ) : null}
                      {canApproveApproval(sourceRecord, authUser) ? (
                        <ActionButton tone="primary" disabled={busy} onClick={() => onApprove?.(sourceRecord)}>
                          {getApproveActionLabel(sourceRecord, authUser, isJa)}
                        </ActionButton>
                      ) : null}
                      {canRequestCorrection(sourceRecord, authUser) ? (
                        <ActionButton tone="warning" disabled={busy} onClick={() => onRequestCorrection?.(sourceRecord)}>
                          {getCorrectionActionLabel(sourceRecord, authUser, isJa)}
                        </ActionButton>
                      ) : null}
                      {canApproveDeleteRequest(sourceRecord, authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onApproveDeleteRequest?.(sourceRecord)}>
                          {isJa ? "削除申請を承認" : "Approve Delete"}
                        </ActionButton>
                      ) : null}
                      {canRejectDeleteRequest(sourceRecord, authUser) ? (
                        <ActionButton tone="neutral" disabled={busy} onClick={() => onRejectDeleteRequest?.(sourceRecord)}>
                          {isJa ? "削除申請を却下" : "Reject Delete"}
                        </ActionButton>
                      ) : null}
                      {canCancelDeleteRequest(sourceRecord, authUser) ? (
                        <ActionButton tone="warning" disabled={busy} onClick={() => onCancelDeleteRequest?.(sourceRecord)}>
                          {isJa ? "削除申請を取り消し" : "Cancel Delete Request"}
                        </ActionButton>
                      ) : null}
                      {canRequestApprovalDeletion(sourceRecord, authUser) ? (
                        <ActionButton tone="danger" disabled={busy} onClick={() => onRequestDeletion?.(sourceRecord)}>
                          {isJa ? "削除を申請" : "Request Delete"}
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