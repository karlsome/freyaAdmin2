import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { trimVideoFile } from "../../utils/trimVideoFile";

const MIN_TRIM_SECONDS = 0.5;

function formatTime(value) {
  const safe = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

function formatSize(bytes) {
  const mb = (Number(bytes) || 0) / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(mb >= 100 ? 0 : 1)} MB` : `${Math.max(1, Math.round(mb * 1024))} KB`;
}

/**
 * Lets the user pick the part of a video to keep BEFORE uploading, so only that part is sent and stored.
 * onConfirm(file) receives the trimmed file (or the original when "Upload full video" is used).
 */
export default function VideoManualTrimModal({ file, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [trimming, setTrimming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const rangeRef = useRef(range);
  useEffect(() => { rangeRef.current = range; }, [range]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL must be created/revoked with the effect lifecycle
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !trimming) onCancel(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, trimming]);

  const keptSeconds = Math.max(0, range.end - range.start);
  const isFullRange = duration > 0 && range.start <= 0.05 && range.end >= duration - 0.05;
  const estimatedSize = useMemo(
    () => (duration > 0 ? file.size * (keptSeconds / duration) : file.size),
    [duration, file.size, keptSeconds],
  );

  function seek(time) {
    const video = videoRef.current;
    if (video) video.currentTime = time;
  }

  function updateStart(value) {
    const start = Math.min(Math.max(0, Number(value) || 0), Math.max(0, range.end - MIN_TRIM_SECONDS));
    setRange((current) => ({ ...current, start }));
    seek(start);
  }

  function updateEnd(value) {
    const end = Math.max(Math.min(duration, Number(value) || 0), Math.min(duration, range.start + MIN_TRIM_SECONDS));
    setRange((current) => ({ ...current, end }));
    seek(Math.max(range.start, end - 0.5));
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const { start, end } = rangeRef.current;
    if (!video.paused && video.currentTime >= end) {
      video.pause();
      video.currentTime = start;
    }
  }

  function handlePlayToggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < range.start || video.currentTime >= range.end) video.currentTime = range.start;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  async function handleTrim() {
    if (isFullRange) { onConfirm(file); return; }
    setTrimming(true);
    setProgress(0);
    setError("");
    try {
      videoRef.current?.pause();
      const trimmed = await trimVideoFile(file, { start: range.start, end: range.end, onProgress: setProgress });
      onConfirm(trimmed);
    } catch (trimError) {
      setError(trimError?.message || t("Could not trim this video. Try uploading the full video instead."));
      setTrimming(false);
    }
  }

  const buttonBase = "rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const numberClass = "w-24 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]";

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!trimming) onCancel(); }}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="freya-card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("Trim video before upload")}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{file.name} · {formatSize(file.size)}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="overflow-hidden rounded-[8px] bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              controls={false}
              preload="metadata"
              playsInline
              onClick={handlePlayToggle}
              onLoadedMetadata={(event) => {
                const total = Number(event.currentTarget.duration) || 0;
                setDuration(total);
                setRange({ start: 0, end: total });
              }}
              onTimeUpdate={handleTimeUpdate}
              onError={() => setError(t("This video could not be previewed. You can still upload the full video."))}
              className="mx-auto max-h-[40vh] w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={handlePlayToggle} disabled={!duration || trimming} className={`${buttonBase} border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]`}>
              {t("Play / pause selection")}
            </button>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {t("Keeping {kept} of {total} (about {size})", { kept: formatTime(keptSeconds), total: formatTime(duration), size: formatSize(estimatedSize) })}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <span className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {t("Start")}
                <input type="number" min={0} max={duration} step={0.1} value={Number(range.start.toFixed(1))} onChange={(event) => updateStart(event.target.value)} disabled={trimming || !duration} className={numberClass} />
              </span>
              <input type="range" min={0} max={duration || 0} step={0.1} value={range.start} onChange={(event) => updateStart(event.target.value)} disabled={trimming || !duration} className="w-full" />
            </label>
            <label className="block rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <span className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {t("End")}
                <input type="number" min={0} max={duration} step={0.1} value={Number(range.end.toFixed(1))} onChange={(event) => updateEnd(event.target.value)} disabled={trimming || !duration} className={numberClass} />
              </span>
              <input type="range" min={0} max={duration || 0} step={0.1} value={range.end} onChange={(event) => updateEnd(event.target.value)} disabled={trimming || !duration} className="w-full" />
            </label>
          </div>

          <p className="text-[11px] text-[var(--text-muted)]">
            {t("Trimming does not re-encode the video, so it is fast and lossless. The cut may start a moment earlier, at the nearest keyframe.")}
          </p>

          {trimming ? (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full bg-[var(--freya-blue)] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{t("Trimming video...")} {Math.round(progress * 100)}%</p>
            </div>
          ) : null}

          {error ? <p className="text-xs font-semibold text-[var(--status-danger)]">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border)] px-6 py-3.5">
          <button type="button" onClick={onCancel} disabled={trimming} className={`${buttonBase} border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]`}>
            {t("Cancel")}
          </button>
          <button type="button" onClick={() => onConfirm(file)} disabled={trimming} className={`${buttonBase} border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]`}>
            {t("Upload full video")}
          </button>
          <button type="button" onClick={handleTrim} disabled={trimming || !duration || keptSeconds < MIN_TRIM_SECONDS} className={`${buttonBase} bg-[var(--freya-blue)] text-white`}>
            {trimming ? t("Trimming video...") : isFullRange ? t("Upload") : t("Trim & upload")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
