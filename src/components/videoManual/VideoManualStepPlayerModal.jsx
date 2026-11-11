import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";

function Icon({ children, className = "text-[22px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The video clips of a step, in timeline order, with a playable URL (public file when we know it).
function getStepClips(step) {
  return (step?.edit?.timeline?.tracks || [])
    .flatMap((track) => track?.clips || [])
    .filter((clip) => clip?.asset?.type === "video" && Number.isFinite(Number(clip.start)) && Number.isFinite(Number(clip.length)))
    .map((clip) => ({
      src: step.assetSourceMap?.[clip.asset.src] || clip.asset.src,
      trim: Number(clip.asset.trim) || 0,
      start: Number(clip.start),
      end: Number(clip.start) + Number(clip.length),
    }))
    .sort((a, b) => a.start - b.start);
}

// Plays ONE step (its cuts one after another) with the timed subtitles shown as CC. Overlays are not rendered here;
// use Edit video for the full editor.
export default function VideoManualStepPlayerModal({ steps, stepId, onClose, onChangeStep }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const clipIndexRef = useRef(-1);

  const playableSteps = useMemo(() => steps.filter((step) => getStepClips(step).length > 0), [steps]);
  const step = steps.find((item) => item.id === stepId) || null;
  const stepIndex = playableSteps.findIndex((item) => item.id === stepId);
  const clips = useMemo(() => getStepClips(step), [step]);
  const duration = clips.length ? clips[clips.length - 1].end : 0;
  const subtitles = step?.subtitles || [];
  const activeCue = subtitles.filter((cue) => time >= cue.start && time < cue.end).pop();

  // Put the <video> at step time `at` (switches source when the cut changes).
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

  // Start from the beginning whenever another step is opened.
  useEffect(() => {
    clipIndexRef.current = -1;
    setPlaying(false);
    setTime(0);
    if (clips.length) seekTo(0, { play: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    const clip = clips[clipIndexRef.current];
    if (!video || !clip) return;
    const stepTime = clip.start + (video.currentTime - clip.trim);
    if (stepTime >= clip.end - 0.04) {
      const next = clips[clipIndexRef.current + 1];
      if (next) { seekTo(next.start, { play: true }); return; }
      video.pause();
      setTime(duration);
      setPlaying(false);
      return;
    }
    setTime(stepTime);
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

  const go = (delta) => {
    const next = playableSteps[stepIndex + delta];
    if (next) onChangeStep(next.id);
  };

  if (!step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[12px] bg-[var(--surface-raised)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{step.title}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{t("Preview only: overlays are shown in the step editor.")}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" title={t("Close")}>
            <Icon className="text-[18px]">close</Icon>
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            playsInline
            muted={false}
            onClick={togglePlay}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            className="h-full w-full object-contain"
          />
          {activeCue?.text ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[5%] flex justify-center px-6">
              <span className="max-w-[90%] whitespace-pre-line rounded bg-black/75 px-3 py-1 text-center text-base font-medium leading-snug text-yellow-300">{activeCue.text}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => go(-1)} disabled={stepIndex <= 0} title={t("Previous step")} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"><Icon>skip_previous</Icon></button>
          <button type="button" onClick={togglePlay} title={playing ? t("Pause") : t("Play")} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)]"><Icon>{playing ? "pause" : "play_arrow"}</Icon></button>
          <button type="button" onClick={() => go(1)} disabled={stepIndex < 0 || stepIndex >= playableSteps.length - 1} title={t("Next step")} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"><Icon>skip_next</Icon></button>
          <span className="w-[88px] flex-shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{formatTime(time)} / {formatTime(duration)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(time, duration || 1)}
            onChange={(event) => seekTo(Number(event.target.value), { play: playing })}
            className="min-w-0 flex-1 accent-[var(--freya-blue)]"
            aria-label={t("Seek")}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
