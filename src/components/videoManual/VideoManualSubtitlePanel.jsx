import { useEffect, useRef } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

function Icon({ children, className = "text-[16px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

const round = (value) => Math.round(value * 1000) / 1000;

function TimeField({ label, value, onChange, onSetToPlayhead, title }) {
  return (
    <div className="min-w-0">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <input
          type="number"
          min={0}
          step={0.1}
          value={Number.isFinite(value) ? value : 0}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="min-w-0 flex-1 rounded border border-separator bg-surface px-2 py-1 text-xs font-semibold text-on-surface outline-none focus:border-primary/50"
        />
        <button type="button" title={title} onClick={(event) => { event.stopPropagation(); onSetToPlayhead(); }} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
          <Icon className="text-[16px]">my_location</Icon>
        </button>
      </div>
    </div>
  );
}

// Timed subtitles for ONE step. Times are seconds on the step's own timeline (0 = start of the step).
export default function VideoManualSubtitlePanel({ subtitles, playbackTime = 0, onChange, onSeek, onImportSrt, onDownloadSrt }) {
  const { t } = useLanguage();
  const srtInputRef = useRef(null);
  const activeRef = useRef(null);
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const activeId = sorted.filter((cue) => playbackTime >= cue.start && playbackTime < cue.end).pop()?.id || "";

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const update = (id, patch) => onChange(subtitles.map((cue) => (cue.id === id ? { ...cue, ...patch } : cue)));
  const remove = (id) => onChange(subtitles.filter((cue) => cue.id !== id));
  const add = () => {
    const start = round(Math.max(0, playbackTime));
    onChange([...subtitles, { id: `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, start, end: round(start + 3), text: "" }]);
  };

  return (
    <aside className="z-20 flex w-[320px] flex-shrink-0 flex-col border-r border-separator bg-surface">
      <div className="flex items-center justify-between border-b border-separator px-3 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-on-surface-variant">{t("Subtitles")}</span>
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">{subtitles.length}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {sorted.map((cue) => {
          const isActive = cue.id === activeId;
          const invalid = !(cue.end > cue.start);
          return (
            <div
              key={cue.id}
              ref={isActive ? activeRef : null}
              role="button"
              tabIndex={0}
              onClick={() => onSeek?.(cue.start)}
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) onSeek?.(cue.start); }}
              className={`space-y-1.5 rounded-lg border p-2 transition ${isActive ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-separator bg-surface hover:border-primary/30"}`}
            >
              <div className="grid grid-cols-2 gap-2">
                <TimeField label={t("Start")} value={cue.start} onChange={(value) => update(cue.id, { start: round(value) })} onSetToPlayhead={() => update(cue.id, { start: round(playbackTime) })} title={t("Set to playhead")} />
                <TimeField label={t("End")} value={cue.end} onChange={(value) => update(cue.id, { end: round(value) })} onSetToPlayhead={() => update(cue.id, { end: round(playbackTime) })} title={t("Set to playhead")} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{t("Text")}</span>
                <button type="button" title={t("Delete")} onClick={(event) => { event.stopPropagation(); remove(cue.id); }} className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant hover:bg-error-container hover:text-error">
                  <Icon className="text-[14px]">delete</Icon>
                </button>
              </div>
              <textarea
                rows={2}
                value={cue.text}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => update(cue.id, { text: event.target.value })}
                placeholder={t("Subtitle text...")}
                className="w-full resize-none rounded border border-transparent bg-transparent p-1 text-xs font-medium text-on-surface outline-none placeholder:text-outline hover:border-separator focus:border-primary/40 focus:bg-surface"
              />
              {invalid ? <p className="text-[10px] font-bold text-error">{t("End must be after start. This subtitle is not saved until fixed.")}</p> : null}
            </div>
          );
        })}

        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-separator px-3 py-6 text-center text-xs font-semibold text-outline">
            {t("No subtitles yet. Move the playhead and press Add subtitle.")}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-separator p-2">
        <button type="button" onClick={add} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-black text-on-primary transition hover:bg-primary/90">
          <Icon>add</Icon>{t("Add subtitle")}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => srtInputRef.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-separator px-2 py-1.5 text-[11px] font-bold text-on-surface-variant transition hover:bg-surface-container">
            <Icon className="text-[14px]">upload_file</Icon>{t("Import SRT")}
          </button>
          <button type="button" onClick={onDownloadSrt} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-separator px-2 py-1.5 text-[11px] font-bold text-on-surface-variant transition hover:bg-surface-container">
            <Icon className="text-[14px]">download</Icon>{t("Export SRT")}
          </button>
        </div>
        <input
          ref={srtInputRef}
          type="file"
          accept=".srt,text/plain"
          className="hidden"
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onImportSrt?.(file); }}
        />
      </div>
    </aside>
  );
}
