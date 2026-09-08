import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchMasterImage, editSubmittedRecord, query } from "../services/api";
import { searchApprovalMasterProducts } from "../services/approvalsApi";
import {
  APPROVAL_EDIT_HIDDEN_FIELDS,
  buildApprovalEditSections,
  resolveApprovalEditFieldKind,
  computeApprovalDerivedFields,
  flattenApprovalEditChanges,
} from "../utils/approvalEdit";
import CollapsibleSection from "./CollapsibleSection";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import RecordEditModal from "./RecordEditModal";
import { useLanguage } from "../contexts/LanguageContext";

// ─── Constants ────────────────────────────────────────────────────────────────
export const PROCESS_ACCENT = {
  Kensa: { dot: "bg-amber-400",   label: "text-amber-400", db: "kensaDB" },
  Press: { dot: "bg-emerald-400", label: "text-emerald-400", db: "pressDB" },
  SRS:   { dot: "bg-slate-400",   label: "text-slate-400", db: "SRSDB" },
  Slit:  { dot: "bg-sky-400",     label: "text-sky-400", db: "slitDB" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcWorkHours(start, end) {
  if (!start || !end) return null;
  const s = new Date(`2000-01-01T${start}`);
  const e = new Date(`2000-01-01T${end}`);
  if (e <= s) return null;
  return (e - s) / 3_600_000;
}

function defectChip(rate) {
  const n = parseFloat(rate);
  if (n > 2) return "bg-error/15 text-error";
  if (n > 1) return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-400/15 text-emerald-400";
}

function parseStructuredValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
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

function isLikelyImage(value) {
  return typeof value === "string" && /(?:^data:image\/|\.(png|jpg|jpeg|gif|webp|avif|svg))(?:\?.*)?$/i.test(value);
}

function formatPrimitiveValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString();
  return String(value);
}

function PrimitiveFieldValue({ value, align = "right" }) {
  if (isLikelyImage(value)) {
    return (
      <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
        <img
          src={value}
          alt="Record field"
          className="max-h-28 rounded-2xl border border-separator/40 bg-surface object-contain"
        />
      </div>
    );
  }

  return (
    <span
      className={`block min-w-0 whitespace-pre-wrap break-all text-xs font-mono text-on-surface-variant ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {formatPrimitiveValue(value)}
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
      <div className="rounded-2xl border border-separator/40 bg-surface-container/40 p-3 space-y-2">
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
    <div className="rounded-2xl border border-separator/40 bg-surface-container/40 p-3 space-y-2">
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
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-outline break-all">
                    {nestedKey}
                  </span>
                  <StructuredValueCard value={normalizedNestedValue} depth={depth + 1} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-semibold text-outline break-all">{nestedKey}</span>
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

// ─── PhotosSection ────────────────────────────────────────────────────────────
function PhotosSection({ checkImages, labelImages, totalCount, onPreview }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  return (
    <CollapsibleSection
      icon="photo_library"
      label={isJa ? "写真一覧" : "Uploaded Photos"}
      badge={<span className="px-1.5 py-0.5 rounded-full bg-surface-container text-[9px] font-semibold normal-case tracking-normal">{totalCount}</span>}
    >
      <div className="pb-5 space-y-4">
          {checkImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {checkImages.map(({ label, url }, index) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-outline mb-1.5">{label}</p>
                  <button
                    type="button"
                    onClick={() => onPreview?.("check", index)}
                    className="block w-full rounded-[6px] overflow-hidden border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-150 cursor-zoom-in"
                  >
                    <img src={url} alt={label} className="w-full object-cover max-h-36 bg-black/20" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {labelImages.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-[0.04em]">
                {isJa ? `材料ラベル (${labelImages.length})` : `Material Labels (${labelImages.length})`}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {labelImages.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPreview?.("label", i)}
                    className="block w-full rounded-[6px] overflow-hidden border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-150 cursor-zoom-in"
                  >
                    <img
                      src={url}
                      alt={isJa ? `材料ラベル ${i + 1}` : `Material Label ${i + 1}`}
                      className="w-full aspect-square object-cover bg-black/20"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] text-center py-1">
                      {isJa ? `材料ラベル ${i + 1}` : `Material Label ${i + 1}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
    </CollapsibleSection>
  );
}

// ─── BreakTimeSection ─────────────────────────────────────────────────────────
function BreakTimeSection({ record }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const data = record.Break_Time_Data ?? {};
  const breaks = Object.entries(data)
    .filter(([, v]) => v?.start && v?.end)
    .map(([k, v]) => ({ key: k, start: v.start, end: v.end }));

  if (breaks.length === 0) return null;

  const totalMin = record.Total_Break_Minutes ?? 0;
  const breakHeadings = isJa ? ["休憩", "開始", "終了", "所要時間"] : ["Break", "Start", "End", "Duration"];

  return (
    <CollapsibleSection
      icon="coffee"
      label={isJa ? "休憩時間" : "Break Times"}
      badge={<span className="px-2 py-0.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)] normal-case freya-tabular">{totalMin} {isJa ? "分" : "min"}</span>}
    >
      <div className="pb-5">
        <div className="rounded-[8px] overflow-hidden border border-[var(--border)]">
          <table className="ui-table-data w-full">
            <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)]">
              <tr>
                {breakHeadings.map((h) => (
                  <th key={h} className="ui-table-heading px-3.5 py-2 text-left uppercase tracking-[0.04em] text-[var(--text-muted)] text-[12px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {breaks.map(({ key, start, end }) => {
                const s = new Date(`2000-01-01T${start}`);
                const e = new Date(`2000-01-01T${end}`);
                const mins = e > s ? Math.round((e - s) / 60000) : null;
                const formattedKey = isJa
                  ? key.replace(/^break/i, "休憩 ").replace(/([0-9]+)/, " $1").trim()
                  : key.replace(/([0-9]+)/, " $1");
                return (
                  <tr key={key} className="hover:bg-[var(--surface-raised)] transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-[var(--text-primary)] capitalize">{formattedKey}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[var(--text-secondary)] freya-tabular">{start}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[var(--text-secondary)] freya-tabular">{end}</td>
                    <td className="px-3.5 py-2.5 text-[var(--text-muted)] freya-tabular">{mins != null ? `${mins} ${isJa ? "分" : "min"}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-2 text-right freya-tabular">
          {isJa
            ? `合計: ${totalMin}分 (${record.Total_Break_Hours ?? 0}時間)`
            : `Total: ${totalMin} min (${record.Total_Break_Hours ?? 0} hrs)`}
        </p>
      </div>
    </CollapsibleSection>
  );
}

// ─── MaintenanceSection ───────────────────────────────────────────────────────
function MaintenanceSection({ record, onPreview }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const maint = record.Maintenance_Data ?? {};
  const records = Array.isArray(maint.records) ? maint.records.filter((r) => r.startTime || r.comment) : [];

  if (records.length === 0) return null;

  const totalMin = maint.totalMinutes ?? record.Total_Trouble_Minutes ?? 0;

  return (
    <CollapsibleSection
      icon="build"
      label={isJa ? "メンテナンス / トラブル" : "Maintenance / Trouble"}
      badge={<span className="px-2 py-0.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[var(--semantic-warning)] text-[11px] font-medium normal-case freya-tabular">{records.length} {isJa ? "件" : (records.length > 1 ? "records" : "record")}</span>}
    >
      <div className="pb-5 space-y-3">
        {records.map((rec) => {
          const photos = Array.isArray(rec.photos) ? rec.photos.filter(Boolean) : [];
          const s = rec.startTime ? new Date(`2000-01-01T${rec.startTime}`) : null;
          const e = rec.endTime   ? new Date(`2000-01-01T${rec.endTime}`)   : null;
          const mins = (s && e && e > s) ? Math.round((e - s) / 60000) : null;
          return (
            <div key={rec.id ?? rec.timestamp} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {rec.startTime && (
                      <span className="text-xs font-mono font-medium text-[var(--text-primary)] freya-tabular">
                        {rec.startTime}{rec.endTime ? ` → ${rec.endTime}` : ""}
                      </span>
                    )}
                    {mins != null && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--semantic-warning)] text-[11px] font-semibold freya-tabular">
                        {mins} {isJa ? "分" : "min"}
                      </span>
                    )}
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-[var(--text-secondary)]">{rec.comment}</p>
                  )}
                </div>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onPreview?.(rec, i)}
                      className="block w-full rounded-[6px] overflow-hidden border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-150 cursor-zoom-in"
                    >
                      <img
                        src={url}
                        alt={isJa ? `トラブル写真 ${i + 1}` : `Maintenance photo ${i + 1}`}
                        className="w-full aspect-square object-cover bg-black/20"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-[var(--text-muted)] text-right freya-tabular">
          {isJa
            ? `トラブル合計: ${totalMin}分 (${maint.totalHours ?? record.Total_Trouble_Hours ?? 0}時間)`
            : `Total trouble: ${totalMin} min (${maint.totalHours ?? record.Total_Trouble_Hours ?? 0} hrs)`}
        </p>
      </div>
    </CollapsibleSection>
  );
}

// ─── RecordDetailModal ────────────────────────────────────────────────────────
// Props:
//   record      — the raw production record object
//   processName — string key matching PROCESS_ACCENT (e.g. "Press", "Kensa")
//   onClose     — callback to close the modal
//   onLotClick  — optional callback(lot: string) when a 材料ロット chip is clicked
//   onUpdated   — optional callback triggered after successful edit
export default function RecordDetailModal({ record, processName, onClose, onLotClick, onUpdated }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [imageData,    setImageData]    = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [copied,       setCopied]       = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const editFieldOptionsCacheRef = useRef(new Map());

  const authUser = JSON.parse(localStorage.getItem("authUser")) || {};
  const role = authUser.role || "";
  const canEdit = ["admin", "部長", "係長", "課長"].includes(role);

  function handleEditClick() {
    if (!canEdit) {
      alert(isJa ? "編集モードを使用する権限がありません。" : "You are not permitted to use the edit mode.");
      return;
    }
    setIsEditing(true);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (!record || isEditing) return;
    let cancelled = false;
    setImageLoading(true);
    setImageData(null);
    fetchMasterImage(record["品番"], record["背番号"]).then((d) => {
      if (!cancelled) { setImageData(d); setImageLoading(false); }
    });
    return () => { cancelled = true; };
  }, [record, isEditing]);

  async function loadFieldPickerOptions(path, draft) {
    const currentValue = String(draft?.[path] || "").trim();
    if (!["設備", "Worker_Name", "工場"].includes(path)) {
      return currentValue ? [currentValue] : [];
    }
    const selectedFactory = String(draft?.工場 || "").trim();
    const cacheKey = `${path}::${selectedFactory}`;
    if (editFieldOptionsCacheRef.current.has(cacheKey)) {
      const cachedOptions = editFieldOptionsCacheRef.current.get(cacheKey);
      return [...new Set([...cachedOptions, currentValue].filter(Boolean))]
        .sort((left, right) => String(left).localeCompare(String(right), "ja"));
    }
    let values = [];
    try {
      if (path === "工場") {
        const res = await query("Sasaki_Coating_MasterDB", "factoryDB", {}, { projection: { "工場": 1 } });
        values = (Array.isArray(res) ? res : res.data || []).map(doc => doc["工場"]);
      } else if (path === "設備") {
        const q = selectedFactory ? { "工場": selectedFactory } : {};
        const res = await query("Sasaki_Coating_MasterDB", "setsubiDB", q, { projection: { "name": 1 } });
        values = (Array.isArray(res) ? res : res.data || []).map(doc => doc.name);
      } else if (path === "Worker_Name") {
        const res = await query("Sasaki_Coating_MasterDB", "workerDB", {}, { projection: { "Name": 1 } });
        values = (Array.isArray(res) ? res : res.data || []).map(doc => doc.Name);
      }
    } catch (e) {
      console.error("Failed to load options for", path, e);
    }
    editFieldOptionsCacheRef.current.set(cacheKey, values);
    return [...new Set([...values, currentValue].filter(Boolean))]
      .sort((left, right) => String(left).localeCompare(String(right), "ja"));
  }

  async function handleSaveEdit({ draft, note }) {
    if (!canEdit) {
      alert(isJa ? "編集モードを使用する権限がありません。" : "You are not permitted to use the edit mode.");
      setIsEditing(false);
      return;
    }
    if (!PROCESS_ACCENT[processName]?.db) return;
    setEditBusy(true);
    try {
      const flattenedChanges = flattenApprovalEditChanges(draft);

      await editSubmittedRecord({
        collection: PROCESS_ACCENT[processName].db,
        docId: record._id?.$oid || record._id,
        changes: flattenedChanges,
        editedBy: authUser.name || authUser.username,
        editedByUsername: authUser.username,
        editNote: note,
        pendingImageOps: draft._pendingImageOps || []
      });
      alert(isJa ? "実績を更新しました。" : "Record updated successfully!");
      setIsEditing(false);
      if (typeof onUpdated === "function") {
        onUpdated();
      }
      onClose();
    } catch (err) {
      alert(isJa ? `変更の保存に失敗しました: ${err.message}` : `Failed to save changes: ${err.message}`);
    } finally {
      setEditBusy(false);
    }
  }

  if (!record) return null;

  const qty      = Number(record.Process_Quantity) || Number(record.Total) || 0;
  const ng       = Number(record.SRS_Total_NG) || Number(record.Total_NG) || 0;
  const defRate  = qty > 0 ? ((ng / qty) * 100).toFixed(2) : "0.00";
  const hrs      = calcWorkHours(record.Time_start, record.Time_end);
  const defColor = parseFloat(defRate) > 2 ? "text-error" : parseFloat(defRate) > 1 ? "text-amber-400" : "text-emerald-400";

  const materialLots = record["材料ロット"]
    ? String(record["材料ロット"]).split(",").map((l) => l.trim()).filter(Boolean)
    : [];

  const SKIP    = new Set(["_id", "_source", "__v"]);
  const entries = Object.entries(record).filter(([k]) => !SKIP.has(k) && record[k] != null && record[k] !== "");

  const kensaCounters = Object.entries(record?.Counters || {})
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => [k, v, true]);

  const keyFields = [
    [isJa ? "工場" : "Factory",         record["工場"]],
    [isJa ? "日付" : "Date",            record.Date],
    [isJa ? "作業者" : "Operator",       record.Worker_Name],
    [isJa ? "設備" : "Equipment",       record["設備"]],
    [isJa ? "開始時刻" : "Start Time",   record.Time_start],
    [isJa ? "終了時刻" : "End Time",     record.Time_end],
    [isJa ? "稼働時間" : "Work Hours",   hrs != null ? (isJa ? `${hrs.toFixed(2)} 時間` : `${hrs.toFixed(2)} hrs`) : null],
    [isJa ? "数量" : "Quantity (Qty)",   record.Process_Quantity],
    [isJa ? "サイクルタイム" : "Cycle Time", record.Cycle_Time ? (isJa ? `${record.Cycle_Time}秒` : `${record.Cycle_Time}s`) : null],
    [isJa ? "ショット数" : "Shot Count",  record["ショット数"]],
    ...kensaCounters,
    ["疵引不良",  record["疵引不良"], true],
    ["加工不良",  record["加工不良"], true],
    ["くっつき・めくれ", record["くっつき・めくれ"], true],
    ["シワ",      record["シワ"], true],
    ["転写位置ズレ", record["転写位置ズレ"], true],
    ["転写不良",  record["転写不良"], true],
    ["文字欠け",  record["文字欠け"], true],
    ["その他不良", record["その他"], true],
    [isJa ? "予備 (Spare)" : "Spare",     record.Spare],
    [isJa ? "コメント" : "Comment",      record.Comment],
    [isJa ? "製造ロット" : "Production Lot", record["製造ロット"]],
  ].filter(([, v]) => v != null && v !== "");

  const processAccent = PROCESS_ACCENT[processName];

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="freya-card rounded-[12px] w-full max-w-2xl max-h-[92vh] overflow-y-auto
                   border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl scrollbar-hide"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-[12px] px-6 py-4 flex items-center justify-between
                        border-b border-[var(--border)] bg-[var(--surface-raised)] backdrop-blur-md">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${processAccent?.dot ?? "bg-[var(--freya-blue)]"}`} />
              <h3 className="text-base font-semibold text-[var(--text-primary)] truncate leading-tight">
                {isJa ? `${processName}工程 — 実績詳細` : `${processName} Process — Record Details`}
              </h3>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mt-1 font-mono">{record["品番"]} / {record["背番号"]}</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleEditClick}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] font-semibold hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] text-xs transition-colors"
              >
                {isJa ? "編集" : "Edit"}
              </button>
            )}
            <button
              onClick={copyLink}
              title={isJa ? "共有リンクをコピー" : "Copy shareable link"}
              className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {copied ? "check" : "link"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        </div>

        {/* Product image */}
        <div className="px-6 pt-5 pb-2">
          {imageLoading ? (
            <div className="w-full h-40 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          ) : imageData?.imageURL ? (
            <button
              type="button"
              onClick={() => setPhotoPreview({
                eyebrow: isJa ? "マスター画像" : "Master Image",
                displayName: imageData["品名"] ?? record["品番"] ?? (isJa ? "マスター画像" : "Master image"),
                subtitle: `${record["品番"] ?? ""}${record["背番号"] ? ` / ${record["背番号"]}` : ""}`.trim() || undefined,
                images: [{ url: imageData.imageURL, label: imageData["品名"] ?? record["品番"] ?? (isJa ? "マスター画像" : "Master image") }],
                activeIndex: 0,
              })}
              className="block w-full overflow-hidden rounded-[6px] border border-[var(--border)]
                         hover:border-[var(--border-strong)] transition-colors duration-150 cursor-zoom-in"
            >
              <img
                src={imageData.imageURL}
                alt={imageData["品名"] ?? record["品番"]}
                className="w-full max-h-52 object-contain bg-black/10"
                onError={(e) => { e.currentTarget.closest("button").classList.add("hidden"); }}
              />
            </button>
          ) : (
            <div className="w-full h-10 flex items-center justify-center rounded-[6px] bg-[var(--surface)]
                            border border-[var(--border)] text-xs text-[var(--text-muted)] gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image_not_supported</span>
              {isJa ? "画像がありません" : "No image available"}
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-[var(--border)]">
          {[
            { label: isJa ? "総数" : "Total",         value: qty.toLocaleString(), color: "text-[var(--text-primary)]",  bg: "bg-[var(--surface)]" },
            { label: isJa ? "不良数" : "Total NG",     value: ng.toLocaleString(),  color: ng > 0 ? "text-[var(--semantic-error)]" : "text-[var(--text-primary)]", bg: "bg-[var(--surface)]" },
            { label: isJa ? "不良率" : "Defect Rate",  value: `${defRate}%`,        color: defColor, bg: "bg-[var(--surface)]" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-[6px] px-3.5 py-3 text-center border border-[var(--border)] ${bg}`}>
              <p className={`text-xl sm:text-2xl font-semibold leading-none freya-tabular ${color}`}>{value}</p>
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="px-6 py-4 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[var(--border)]">
          {keyFields.map(([label, value, isDefectForce]) => {
            const isDefect = isDefectForce || label.includes("不良");
            const hasDefect = isDefect && Number(value) > 0;
            return (
              <div key={label} className="flex flex-col gap-0.5">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.04em] ${hasDefect ? 'text-[var(--semantic-error)]' : 'text-[var(--text-muted)]'}`}>{label}</span>
                <span className={`text-sm font-medium freya-tabular ${hasDefect ? 'text-[var(--semantic-error)] font-semibold' : 'text-[var(--text-primary)]'}`}>{value}</span>
              </div>
            );
          })}
          {materialLots.length > 0 ? (
            <div className="flex flex-col gap-1.5 col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "材料ロット" : "Material Lots"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {materialLots.map((lot) => (
                  <button
                    key={lot}
                    onClick={() => onLotClick?.(lot)}
                    className="px-2.5 py-1 rounded-[4px] bg-[var(--surface)] text-[var(--text-primary)] text-xs font-mono font-medium
                               hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] transition-colors duration-150
                               border border-[var(--border)]"
                  >
                    {lot}
                  </button>
                ))}
              </div>
            </div>
          ) : record["材料ロット"] != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "材料ロット" : "Material Lots"}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)] font-mono">{record["材料ロット"]}</span>
            </div>
          )}
        </div>

        {/* Uploaded photos — collapsible */}
        {(() => {
          const checkImages = [
            { label: isJa ? "初物チェック画像" : "Initial Check Image", url: record["初物チェック画像"] },
            { label: isJa ? "終物チェック画像" : "Final Check Image", url: record["終物チェック画像"] },
          ].filter((i) => i.url);
          const labelImages = Array.isArray(record.materialLabelImages)
            ? record.materialLabelImages.filter(Boolean)
            : record["材料ラベル画像"] ? [record["材料ラベル画像"]] : [];
          const totalCount = checkImages.length + labelImages.length;
          if (totalCount === 0) return null;

          function handleOpenPreview(group, index) {
            const combined = [
              ...checkImages.map((image) => ({ url: image.url, label: image.label })),
              ...labelImages.map((url, i) => ({ url, label: isJa ? `材料ラベル ${i + 1}` : `Material Label ${i + 1}` })),
            ];
            const activeIndex = group === "label" ? checkImages.length + index : index;
            setPhotoPreview({
              eyebrow: isJa ? "実績写真" : "Record Photos",
              displayName: isJa ? `${processName ?? "実績"}写真` : `${processName ?? "Record"} Photos`,
              subtitle: `${record["品番"] ?? ""} / ${record["背番号"] ?? ""}`.trim() || undefined,
              images: combined,
              activeIndex,
            });
          }

          return <PhotosSection checkImages={checkImages} labelImages={labelImages} totalCount={totalCount} onPreview={handleOpenPreview} />;
        })()}

        {/* Break times — collapsible */}
        <BreakTimeSection record={record} />

        {/* Maintenance — collapsible */}
        <MaintenanceSection
          record={record}
          onPreview={(rec, index) => {
            const photos = Array.isArray(rec?.photos) ? rec.photos.filter(Boolean) : [];
            if (!photos.length) return;
            setPhotoPreview({
              eyebrow: isJa ? "メンテナンス写真" : "Maintenance Photos",
              displayName: isJa ? "メンテナンス / トラブル" : "Maintenance / Trouble",
              subtitle: rec?.comment || (rec?.startTime ? `${rec.startTime}${rec?.endTime ? ` → ${rec.endTime}` : ""}` : undefined),
              images: photos.map((url, i) => ({ url, label: isJa ? `トラブル写真 ${i + 1}` : `Maintenance photo ${i + 1}` })),
              activeIndex: index,
            });
          }}
        />

        {/* All fields — collapsible */}
        <CollapsibleSection label={isJa ? "全項目" : "All Fields"} wrapperClassName="px-6 py-4">
          <div className="space-y-0 mt-3">
            {entries.map(([k, v]) => {
              const normalizedValue = parseStructuredValue(v);
              const structured = isStructuredValue(normalizedValue);
              return (
                <div
                  key={k}
                  className="grid grid-cols-1 gap-2 py-3 border-b border-separator/40 last:border-0 md:grid-cols-[minmax(120px,160px)_1fr] md:gap-4"
                >
                  <span className="text-[11px] font-semibold text-outline md:pt-1">{k}</span>
                  {structured ? (
                    <StructuredValueCard value={normalizedValue} />
                  ) : (
                    <PrimitiveFieldValue value={normalizedValue} align="right" />
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>
      <SensorDevicePhotoPreviewModal
        preview={photoPreview}
        onClose={() => setPhotoPreview(null)}
        onNavigate={(direction) => setPhotoPreview((current) => {
          if (!current) return current;
          const images = Array.isArray(current.images) ? current.images : [];
          const next = (Number.isInteger(current.activeIndex) ? current.activeIndex : 0) + direction;
          if (next < 0 || next >= images.length) return current;
          return { ...current, activeIndex: next };
        })}
      />
      <RecordEditModal
        open={isEditing}
        title={isJa ? `${processName} 実績編集` : `Edit ${processName} Record`}
        subtitle={`${record?.品番 || ""} / ${record?.背番号 || ""}`}
        record={record}
        busy={editBusy}
        onClose={() => setIsEditing(false)}
        onSave={handleSaveEdit}
        saveLabel={isJa ? "変更を保存" : "Save Changes"}
        notePlaceholder={isJa ? "変更理由を入力... (必須)" : "Enter reason for edit... (Required)"}
        buildSections={buildApprovalEditSections}
        resolveFieldKind={resolveApprovalEditFieldKind}
        computeDraft={computeApprovalDerivedFields}
        schemaContext={PROCESS_ACCENT[processName]?.db}
        hiddenFields={APPROVAL_EDIT_HIDDEN_FIELDS}
        linkedProductPaths={{ partNumberPath: "品番", serialNumberPath: "背番号" }}
        loadLinkedProductOptions={searchApprovalMasterProducts}
        loadFieldPickerOptions={loadFieldPickerOptions}
      />
    </div>
  );

  return createPortal(modal, document.body);
}
