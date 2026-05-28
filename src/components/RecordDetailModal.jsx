import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fetchMasterImage } from "../services/api";
import CollapsibleSection from "./CollapsibleSection";

// ─── Constants ────────────────────────────────────────────────────────────────
export const PROCESS_ACCENT = {
  Kensa: { dot: "bg-amber-400",   label: "text-amber-400" },
  Press: { dot: "bg-emerald-400", label: "text-emerald-400" },
  SRS:   { dot: "bg-slate-400",   label: "text-slate-400" },
  Slit:  { dot: "bg-sky-400",     label: "text-sky-400" },
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Array</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
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
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-outline">
                      Item {index + 1}
                    </span>
                    <StructuredValueCard value={nestedValue} depth={depth + 1} />
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Object</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
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
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-outline break-all">
                    {nestedKey}
                  </span>
                  <StructuredValueCard value={normalizedNestedValue} depth={depth + 1} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-bold text-outline break-all">{nestedKey}</span>
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
function PhotosSection({ checkImages, labelImages, totalCount }) {
  return (
    <CollapsibleSection
      icon="photo_library"
      label="Uploaded Photos"
      badge={<span className="px-1.5 py-0.5 rounded-full bg-surface-container text-[9px] font-bold normal-case tracking-normal">{totalCount}</span>}
    >
      <div className="pb-5 space-y-5">
          {checkImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {checkImages.map(({ label, url }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-outline mb-1.5">{label}</p>
                  <a href={url} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-separator/35 hover:border-primary/45 transition-all duration-150 cursor-zoom-in">
                    <img src={url} alt={label} className="w-full object-cover max-h-36 bg-black/20" />
                  </a>
                </div>
              ))}
            </div>
          )}
          {labelImages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-outline mb-2">材料ラベル ({labelImages.length})</p>
              <div className="grid grid-cols-4 gap-2">
                {labelImages.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl overflow-hidden border border-separator/35 hover:border-primary/45 transition-all duration-150 cursor-zoom-in"
                  >
                    <img
                      src={url}
                      alt={`材料ラベル ${i + 1}`}
                      className="w-full aspect-square object-cover bg-black/20"
                    />
                    <p className="text-[9px] text-outline text-center py-1">材料ラベル {i + 1}</p>
                  </a>
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

  const data = record.Break_Time_Data ?? {};
  const breaks = Object.entries(data)
    .filter(([, v]) => v?.start && v?.end)
    .map(([k, v]) => ({ key: k, start: v.start, end: v.end }));

  if (breaks.length === 0) return null;

  const totalMin = record.Total_Break_Minutes ?? 0;

  return (
    <CollapsibleSection
      icon="coffee"
      label="Break Times"
      badge={<span className="px-1.5 py-0.5 rounded-full bg-surface-container text-[9px] font-bold normal-case tracking-normal">{totalMin} min</span>}
    >
      <div className="pb-4">
        <div className="rounded-xl overflow-hidden border border-separator/30">
          <table className="ui-table-data w-full">
            <thead className="bg-surface-container-high/40">
              <tr>
                {["Break", "Start", "End", "Duration"].map((h) => (
                  <th key={h} className="ui-table-heading px-4 py-2 text-left uppercase tracking-wider text-outline">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-separator/20">
              {breaks.map(({ key, start, end }) => {
                const s = new Date(`2000-01-01T${start}`);
                const e = new Date(`2000-01-01T${end}`);
                const mins = e > s ? Math.round((e - s) / 60000) : null;
                return (
                  <tr key={key} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-on-surface capitalize">{key.replace(/([0-9]+)/, " $1")}</td>
                    <td className="px-4 py-2.5 font-mono text-on-surface-variant">{start}</td>
                    <td className="px-4 py-2.5 font-mono text-on-surface-variant">{end}</td>
                    <td className="px-4 py-2.5 text-outline">{mins != null ? `${mins} min` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-outline mt-2 text-right">Total: {totalMin} min ({record.Total_Break_Hours ?? 0} hrs)</p>
      </div>
    </CollapsibleSection>
  );
}

// ─── MaintenanceSection ───────────────────────────────────────────────────────
function MaintenanceSection({ record }) {
  const maint = record.Maintenance_Data ?? {};
  const records = Array.isArray(maint.records) ? maint.records.filter((r) => r.startTime || r.comment) : [];

  if (records.length === 0) return null;

  const totalMin = maint.totalMinutes ?? record.Total_Trouble_Minutes ?? 0;

  return (
    <CollapsibleSection
      icon="build"
      label="Maintenance / Trouble"
      badge={<span className="px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-[9px] font-bold normal-case tracking-normal">{records.length} record{records.length > 1 ? "s" : ""}</span>}
    >
      <div className="pb-5 space-y-3">
        {records.map((rec) => {
          const photos = Array.isArray(rec.photos) ? rec.photos.filter(Boolean) : [];
          const s = rec.startTime ? new Date(`2000-01-01T${rec.startTime}`) : null;
          const e = rec.endTime   ? new Date(`2000-01-01T${rec.endTime}`)   : null;
          const mins = (s && e && e > s) ? Math.round((e - s) / 60000) : null;
          return (
            <div key={rec.id ?? rec.timestamp} className="glass-card rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {rec.startTime && (
                      <span className="text-xs font-mono font-bold text-on-surface">
                        {rec.startTime}{rec.endTime ? ` → ${rec.endTime}` : ""}
                      </span>
                    )}
                    {mins != null && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-[10px] font-bold">
                        {mins} min
                      </span>
                    )}
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-on-surface-variant">{rec.comment}</p>
                  )}
                </div>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="block rounded-2xl overflow-hidden border border-separator/35 hover:border-amber-400/45 transition-all duration-150 cursor-zoom-in">
                      <img src={url} alt={`Maintenance photo ${i + 1}`} className="w-full aspect-square object-cover bg-black/20" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[10px] text-outline text-right">Total trouble: {totalMin} min ({maint.totalHours ?? record.Total_Trouble_Hours ?? 0} hrs)</p>
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
export default function RecordDetailModal({ record, processName, onClose, onLotClick }) {
  const [imageData,    setImageData]    = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [copied,       setCopied]       = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    setImageLoading(true);
    setImageData(null);
    fetchMasterImage(record["品番"], record["背番号"]).then((d) => {
      if (!cancelled) { setImageData(d); setImageLoading(false); }
    });
    return () => { cancelled = true; };
  }, [record]);

  if (!record) return null;

  const qty      = Number(record.Process_Quantity) || Number(record.Total) || 0;
  const ng       = Number(record.Total_NG) || 0;
  const defRate  = qty > 0 ? ((ng / qty) * 100).toFixed(2) : "0.00";
  const hrs      = calcWorkHours(record.Time_start, record.Time_end);
  const defColor = parseFloat(defRate) > 2 ? "text-error" : parseFloat(defRate) > 1 ? "text-amber-400" : "text-emerald-400";

  const materialLots = record["材料ロット"]
    ? String(record["材料ロット"]).split(",").map((l) => l.trim()).filter(Boolean)
    : [];

  const SKIP    = new Set(["_id", "_source", "__v"]);
  const entries = Object.entries(record).filter(([k]) => !SKIP.has(k) && record[k] != null && record[k] !== "");

  const keyFields = [
    ["工場",      record["工場"]],
    ["Date",      record.Date],
    ["作業者",    record.Worker_Name],
    ["設備",      record["設備"]],
    ["開始時刻",  record.Time_start],
    ["終了時刻",  record.Time_end],
    ["稼働時間",  hrs != null ? `${hrs.toFixed(2)} hrs` : null],
    ["製造ロット", record["製造ロット"]],
  ].filter(([, v]) => v != null);

  const processAccent = PROCESS_ACCENT[processName];

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto
                   shadow-[0_0_80px_rgba(99,102,241,0.18),0_24px_48px_rgba(0,0,0,0.22)] scrollbar-hide"
        style={{ border: processAccent ? undefined : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-2xl px-5 sm:px-6 py-4 flex items-center justify-between
                        border-b border-separator/40 bg-surface/90 backdrop-blur-md">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm ${processAccent?.dot ?? "bg-primary"}`} />
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                {processName} Process — Record Details
              </h3>
            </div>
            <p className="text-[11px] text-outline mt-0.5 font-mono ml-5.5">{record["品番"]} / {record["背番号"]}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
            <button
              onClick={copyLink}
              title="Copy shareable link"
              className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-all duration-150"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {copied ? "check" : "link"}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-150"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        {/* Product image */}
        <div className="px-5 sm:px-6 pt-5 pb-2">
          {imageLoading ? (
            <div className="w-full h-40 rounded-xl bg-surface-container/70 animate-pulse" />
          ) : imageData?.imageURL ? (
            <a
              href={imageData.imageURL}
              target="_blank"
              rel="noreferrer"
              className="block w-full overflow-hidden rounded-xl border border-separator/40
                         hover:border-primary/40 hover:shadow-md transition-all duration-150 cursor-zoom-in"
            >
              <img
                src={imageData.imageURL}
                alt={imageData["品名"] ?? record["品番"]}
                className="w-full max-h-52 object-contain bg-black/20"
                onError={(e) => { e.currentTarget.closest("a").classList.add("hidden"); }}
              />
            </a>
          ) : (
            <div className="w-full h-10 flex items-center justify-center rounded-xl bg-surface-container/40
                            border border-separator/30 text-[11px] text-outline gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image_not_supported</span>
              No image available
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2.5 px-5 sm:px-6 py-4 border-b border-separator/30">
          {[
            { label: "Total",    value: qty.toLocaleString(), color: "text-on-surface",  bg: "bg-surface-container/60" },
            { label: "Total NG", value: ng,                   color: ng > 0 ? "text-error" : "text-on-surface", bg: ng > 0 ? "bg-error/8" : "bg-surface-container/60" },
            { label: "不良率",   value: `${defRate}%`,        color: defColor, bg: "bg-surface-container/60" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl px-3 py-3 text-center border border-separator/30 ${bg}`}>
              <p className={`text-xl sm:text-2xl font-black leading-none ${color}`}>{value}</p>
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="px-5 sm:px-6 py-4 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-separator/30">
          {keyFields.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</span>
              <span className="text-sm font-semibold text-on-surface">{value}</span>
            </div>
          ))}
          {materialLots.length > 0 ? (
            <div className="flex flex-col gap-1.5 col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">材料ロット</span>
              <div className="flex flex-wrap gap-1.5">
                {materialLots.map((lot) => (
                  <button
                    key={lot}
                    onClick={() => onLotClick?.(lot)}
                    className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-bold
                               hover:bg-primary/22 hover:shadow-sm active:scale-95 transition-all duration-150
                               border border-primary/25"
                  >
                    {lot}
                  </button>
                ))}
              </div>
            </div>
          ) : record["材料ロット"] != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">材料ロット</span>
              <span className="text-sm font-semibold text-on-surface">{record["材料ロット"]}</span>
            </div>
          )}
        </div>

        {/* Uploaded photos — collapsible */}
        {(() => {
          const checkImages = [
            { label: "初物チェック画像", url: record["初物チェック画像"] },
            { label: "終物チェック画像", url: record["終物チェック画像"] },
          ].filter((i) => i.url);
          const labelImages = Array.isArray(record.materialLabelImages)
            ? record.materialLabelImages.filter(Boolean)
            : record["材料ラベル画像"] ? [record["材料ラベル画像"]] : [];
          const totalCount = checkImages.length + labelImages.length;
          if (totalCount === 0) return null;
          return <PhotosSection checkImages={checkImages} labelImages={labelImages} totalCount={totalCount} />;
        })()}

        {/* Break times — collapsible */}
        <BreakTimeSection record={record} />

        {/* Maintenance — collapsible */}
        <MaintenanceSection record={record} />

        {/* All fields — collapsible */}
        <CollapsibleSection label="All Fields" wrapperClassName="px-5 sm:px-6 py-4">
          <div className="space-y-0 mt-3">
            {entries.map(([k, v]) => {
              const normalizedValue = parseStructuredValue(v);
              const structured = isStructuredValue(normalizedValue);
              return (
                <div
                  key={k}
                  className="grid grid-cols-1 gap-2 py-3 border-b border-separator/20 last:border-0 md:grid-cols-[minmax(120px,160px)_1fr] md:gap-4"
                >
                  <span className="text-[11px] font-bold text-outline md:pt-1">{k}</span>
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
    </div>
  );

  return createPortal(modal, document.body);
}
