import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { getStepClips } from "./videoManualPlaybackUtils";

function Icon({ children, className = "text-[22px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Plays steps back to back as ONE continuous video (same order and timing as the export), with timed subtitles as CC.
// Overlays (text/shapes) are not drawn here; the step editor shows the full composition.
export default function VideoManualStepPlayerModal({ steps, startStepId = "", onClose }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const clipIndexRef = useRef(-1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Global timeline: every step shifted by the length of the steps before it (mirrors the server's composer).
  const model = useMemo(() => {
    const clips = [];
    const cues = [];
    const ranges = [];
    let offset = 0;
    for (const step of steps) {
      const stepClips = getStepClips(step);
      if (!stepClips.length) continue;
      const length = stepClips[stepClips.length - 1].end;
      stepClips.forEach((clip) => clips.push({ ...clip, start: clip.start + offset, end: clip.end + offset }));
      (step.subtitles || []).forEach((cue) => cues.push({ ...cue, start: cue.start + offset, end: cue.end + offset }));
      ranges.push({ id: step.id, title: step.title, start: offset, end: offset + length });
      offset += length;
    }
    return { clips, cues, ranges, duration: offset };
  }, [steps]);
  const { clips, cues, ranges, duration } = model;

  const currentRangeIndex = Math.max(0, ranges.findIndex((range) => time >= range.start && time < range.end));
  const currentRange = time >= duration && ranges.length ? ranges[ranges.length - 1] : ranges[currentRangeIndex];
  const activeCue = cues.filter((cue) => time >= cue.start && time < cue.end).pop();

  // Put the <video> at global time `at` (switches source when the cut changes).
  const seekTo = useCallback((at, { play = false } = {}) => {
    const video = videoRef.current;
    if (!video || !clips.length) return;
    const clamped = Math.min(Math.max(0, at), duration);
    let index = clips.findIndex((clip) => clamped >= clip.start && clamped < clip.end);
    if (index < 0) index = clips.findIndex((clip) => clip.start >= clamped); // inside a gap: next cut
    if (index < 0) index = clips.length - 1;
    const clip = clips[index];
    const local = clip.trim + Math.max(0, clamped - clip.start);
    const apply = () => { video.currentTime = local; if (play) video.play().catch(() => {}); };
    if (clipIndexRef.current !== index || video.getAttribute("src") !== clip.src) {
      clipIndexRef.current = index;
      video.src = clip.src;
      video.addEventListener("loadedmetadata", apply, { once: true });
      video.load();
    } else {
      apply();
    }
    setTime(Math.max(clamped, clip.start));
  }, [clips, duration]);

  // Start at the requested step.
  useEffect(() => {
    const start = ranges.find((range) => range.id === startStepId)?.start || 0;
    clipIndexRef.current = -1;
    setPlaying(false);
    seekTo(start, { play: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    const clip = clips[clipIndexRef.current];
    if (!video || !clip) return;
    const globalTime = clip.start + (video.currentTime - clip.trim);
    if (globalTime >= clip.end - 0.04) {
      const next = clips[clipIndexRef.current + 1];
      if (next) { seekTo(next.start, { play: true }); return; }
      video.pause();
      setTime(duration);
      setPlaying(false);
      return;
    }
    setTime(globalTime);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (time >= duration - 0.05) seekTo(0, { play: true });
      else video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const jumpStep = (delta) => {
    if (!ranges.length) return;
    const index = currentRange ? ranges.indexOf(currentRange) : 0;
    // "previous" first restarts the current step when you are more than 2 s into it.
    const target = delta < 0 && currentRange && time - currentRange.start > 2 ? index : index + delta;
    const range = ranges[Math.min(Math.max(0, target), ranges.length - 1)];
    seekTo(range.start, { play: true });
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[12px] bg-[var(--surface-raised)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {ranges.length > 1 && currentRange ? `${t("Step")} ${ranges.indexOf(currentRange) + 1}/${ranges.length} · ` : ""}{currentRange?.title || ""}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">{t("Preview only: overlays are shown in the step editor.")}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" title={t("Close")}>
            <Icon className="text-[18px]">close</Icon>
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          {clips.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm font-semibold text-white/70">{t("Nothing to play yet.")}</div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              onClick={togglePlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              className="h-full w-full object-contain"
            />
          )}
          {activeCue?.text ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[5%] flex justify-center px-6">
              <span className="max-w-[90%] whitespace-pre-line rounded bg-black/75 px-3 py-1 text-center text-base font-medium leading-snug text-yellow-300">{activeCue.text}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => jumpStep(-1)} disabled={!ranges.length} title={t("Previous step")} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"><Icon>skip_previous</Icon></button>
          <button type="button" onClick={togglePlay} disabled={!clips.length} title={playing ? t("Pause") : t("Play")} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)] disabled:opacity-40"><Icon>{playing ? "pause" : "play_arrow"}</Icon></button>
          <button type="button" onClick={() => jumpStep(1)} disabled={!ranges.length || ranges.indexOf(currentRange) >= ranges.length - 1} title={t("Next step")} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"><Icon>skip_next</Icon></button>
          <span className="w-[96px] flex-shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{formatTime(time)} / {formatTime(duration)}</span>
          <div className="relative min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(time, duration || 1)}
              onChange={(event) => seekTo(Number(event.target.value), { play: playing })}
              className="relative z-10 w-full accent-[var(--freya-blue)]"
              aria-label={t("Seek")}
            />
            {/* step boundaries */}
            {ranges.slice(1).map((range) => (
              <span key={range.id} title={range.title} className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[var(--text-muted)]/60" style={{ left: `${(range.start / (duration || 1)) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
