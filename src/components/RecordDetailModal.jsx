import { useState, useEffect } from "react";
import { fetchMasterImage } from "../services/api";

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

// ─── PhotosSection ────────────────────────────────────────────────────────────
function PhotosSection({ checkImages, labelImages, totalCount }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-6 py-0 border-t border-white/10">
      <button
        className="w-full flex items-center justify-between gap-2 py-4 text-[10px] font-bold uppercase
                   tracking-wider text-outline hover:text-on-surface transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_library</span>
          Uploaded Photos
          <span className="px-1.5 py-0.5 rounded-full bg-surface-container text-[9px] font-bold normal-case tracking-normal">
            {totalCount}
          </span>
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
      </button>

      {open && (
        <div className="pb-5 space-y-5">
          {checkImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {checkImages.map(({ label, url }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-outline mb-1.5">{label}</p>
                  <a href={url} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-white/10 hover:border-primary/40 transition-colors cursor-zoom-in">
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
                    className="block rounded-2xl overflow-hidden border border-white/10 hover:border-primary/40 transition-colors cursor-zoom-in"
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
      )}
    </div>
  );
}

// ─── BreakTimeSection ─────────────────────────────────────────────────────────
function BreakTimeSection({ record }) {
  const [open, setOpen] = useState(false);

  const data = record.Break_Time_Data ?? {};
  const breaks = Object.entries(data)
    .filter(([, v]) => v?.start && v?.end)
    .map(([k, v]) => ({ key: k, start: v.start, end: v.end }));

  if (breaks.length === 0) return null;

  const totalMin = record.Total_Break_Minutes ?? 0;

  return (
    <div className="px-6 py-0 border-t border-white/10">
      <button
        className="w-full flex items-center justify-between gap-2 py-4 text-[10px] font-bold uppercase
                   tracking-wider text-outline hover:text-on-surface transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>coffee</span>
          Break Times
          <span className="px-1.5 py-0.5 rounded-full bg-surface-container text-[9px] font-bold normal-case tracking-normal">
            {totalMin} min
          </span>
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
      </button>

      {open && (
        <div className="pb-4">
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-surface-container-high/40">
                <tr>
                  {["Break", "Start", "End", "Duration"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-outline">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
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
      )}
    </div>
  );
}

// ─── MaintenanceSection ───────────────────────────────────────────────────────
function MaintenanceSection({ record }) {
  const [open, setOpen] = useState(false);

  const maint = record.Maintenance_Data ?? {};
  const records = Array.isArray(maint.records) ? maint.records.filter((r) => r.startTime || r.comment) : [];

  if (records.length === 0) return null;

  const totalMin = maint.totalMinutes ?? record.Total_Trouble_Minutes ?? 0;

  return (
    <div className="px-6 py-0 border-t border-white/10">
      <button
        className="w-full flex items-center justify-between gap-2 py-4 text-[10px] font-bold uppercase
                   tracking-wider text-outline hover:text-on-surface transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>build</span>
          Maintenance / Trouble
          <span className="px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-[9px] font-bold normal-case tracking-normal">
            {records.length} record{records.length > 1 ? "s" : ""}
          </span>
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
      </button>

      {open && (
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
                        className="block rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/40 transition-colors cursor-zoom-in">
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
      )}
    </div>
  );
}

// ─── RecordDetailModal ────────────────────────────────────────────────────────
// Props:
//   record      — the raw production record object
//   processName — string key matching PROCESS_ACCENT (e.g. "Press", "Kensa")
//   onClose     — callback to close the modal
//   onLotClick  — optional callback(lot: string) when a 材料ロット chip is clicked
export default function RecordDetailModal({ record, processName, onClose, onLotClick }) {
  const [imageData,     setImageData]     = useState(null);
  const [imageLoading,  setImageLoading]  = useState(true);
  const [allFieldsOpen, setAllFieldsOpen] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto
                   border border-purple-400/40 shadow-[0_0_60px_rgba(99,102,241,0.15)] scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 glass-card rounded-t-2xl px-6 py-5 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${PROCESS_ACCENT[processName]?.dot ?? "bg-primary"}`} />
              <h3 className="text-base font-bold text-on-surface">{processName} Process — Record Details</h3>
            </div>
            <p className="text-[11px] text-outline mt-0.5 font-mono">{record["品番"]} / {record["背番号"]}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Product image */}
        <div className="px-6 pt-5 pb-2">
          {imageLoading ? (
            <div className="w-full h-40 rounded-2xl bg-surface-container/60 animate-pulse" />
          ) : imageData?.imageURL ? (
            <a
              href={imageData.imageURL}
              target="_blank"
              rel="noreferrer"
              className="block w-full overflow-hidden rounded-2xl border border-emerald-400/30
                         hover:border-emerald-400/60 transition-colors cursor-zoom-in"
            >
              <img
                src={imageData.imageURL}
                alt={imageData["品名"] ?? record["品番"]}
                className="w-full max-h-52 object-contain bg-black/20"
                onError={(e) => { e.currentTarget.closest("a").classList.add("hidden"); }}
              />
            </a>
          ) : (
            <div className="w-full h-10 flex items-center justify-center rounded-2xl bg-surface-container/30
                            text-[11px] text-outline gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>image_not_supported</span>
              No image available
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-white/10">
          {[
            { label: "Total",    value: qty.toLocaleString(), color: "text-on-surface" },
            { label: "Total NG", value: ng,                   color: ng > 0 ? "text-error" : "text-on-surface" },
            { label: "不良率",   value: `${defRate}%`,        color: defColor },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-2xl px-4 py-3 text-center">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-white/10">
          {keyFields.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</span>
              <span className="text-sm font-bold text-on-surface">{value}</span>
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
                               hover:bg-primary/25 hover:scale-[1.04] transition-all border border-primary/20"
                  >
                    {lot}
                  </button>
                ))}
              </div>
            </div>
          ) : record["材料ロット"] != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">材料ロット</span>
              <span className="text-sm font-bold text-on-surface">{record["材料ロット"]}</span>
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
        <div className="px-6 py-4">
          <button
            className="w-full flex items-center justify-between gap-2 text-[10px] font-bold uppercase
                       tracking-wider text-outline hover:text-on-surface transition-colors"
            onClick={() => setAllFieldsOpen((v) => !v)}
          >
            <span>All Fields</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {allFieldsOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
          </button>
          {allFieldsOpen && (
            <div className="space-y-0 mt-3">
              {entries.map(([k, v]) => {
                let display = v;
                if (typeof v === "object") {
                  try { display = JSON.stringify(v, null, 2); } catch { display = String(v); }
                }
                const isImage = typeof v === "string" && /\.(png|jpg|jpeg|gif|webp)$/i.test(v);
                return (
                  <div key={k} className="flex justify-between gap-4 py-2 border-b border-white/5 last:border-0">
                    <span className="text-[11px] font-bold text-outline flex-shrink-0">{k}</span>
                    {isImage ? (
                      <img src={v} alt={k} className="max-h-24 rounded-2xl" />
                    ) : (
                      <span className="text-xs text-on-surface-variant text-right break-all font-mono">{String(display)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
