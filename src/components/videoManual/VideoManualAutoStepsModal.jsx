import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { extractAudioFile, readVideoDuration } from "../../utils/trimVideoFile";
import {
  bulkCreateVideoManualSteps,
  getVideoManualApiBaseUrl,
  softDeleteVideoManualPlaylistAssets,
  transcribeVideoManualAudio,
  uploadVideoManualPlaylistAsset,
} from "../../services/videoManualApi";
import { DEFAULT_VIDEO_MANUAL_TEMPLATE, cloneJson, normalizePlayableMediaSource } from "./videoManualEditorUtils";
import {
  AUTO_STEP_MAX_AUDIO_SECONDS,
  buildCuesForRange,
  buildInitialCuts,
  buildStepEdit,
  cutRanges,
  formatClock,
  normalizeCuts,
  parseClock,
} from "./autoStepsUtils";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 18 }}>{children}</span>;
}

function ProgressRow({ label, value, done, failed }) {
  const percent = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
        <span className="inline-flex items-center gap-1.5">
          <Icon className={failed ? "text-[var(--status-danger)]" : done ? "text-emerald-600" : "animate-spin text-[var(--text-muted)]"}>
            {failed ? "error" : done ? "check_circle" : "progress_activity"}
          </Icon>
          {label}
        </span>
        {!done && !failed && value != null ? <span className="text-[var(--text-muted)]">{percent}%</span> : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <div className={`h-full transition-all ${failed ? "bg-[var(--status-danger)]" : "bg-[var(--freya-blue)]"}`} style={{ width: `${done ? 100 : value == null ? 15 : percent}%` }} />
      </div>
    </div>
  );
}

/**
 * "Create steps from video": the user picks one video. In parallel, the video is uploaded (as today) and its
 * voice track is extracted in the browser and transcribed. Spoken "Step 1 / ステップ1 ..." become cuts that the
 * user reviews, then every cut becomes a step pointing at the same uploaded video (no splitting, exact cuts).
 */
export default function VideoManualAutoStepsModal({ projectId, playlistId, onClose, onCreated }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [stage, setStage] = useState("pick"); // pick | processing | review | saving
  const [error, setError] = useState("");
  const [upload, setUpload] = useState({ progress: 0, done: false, failed: false, result: null });
  const [voice, setVoice] = useState({ phase: "idle", progress: 0, failed: false }); // extracting | transcribing | done
  const [words, setWords] = useState([]);
  const [cuts, setCuts] = useState([]);
  const [markerCount, setMarkerCount] = useState(0);
  const [timeDrafts, setTimeDrafts] = useState({});
  const audioRef = useRef(null);
  const busy = stage === "saving";

  // Closing without creating steps (Cancel, Esc, backdrop, navigating away) moves the uploaded video to the
  // asset recycle bin, so abandoned attempts do not pile up. An upload still running when the window closes
  // is moved there as soon as it finishes.
  const closedRef = useRef(false);
  const createdRef = useRef(false);
  const uploadedAssetIdRef = useRef("");
  const discardUpload = useCallback(() => {
    const assetId = uploadedAssetIdRef.current;
    if (!assetId || createdRef.current || !playlistId) return;
    uploadedAssetIdRef.current = "";
    softDeleteVideoManualPlaylistAssets(playlistId, [assetId]).catch((discardError) => {
      console.warn("Could not move the unused auto-steps video to the recycle bin:", discardError);
    });
  }, [playlistId]);

  useEffect(() => {
    closedRef.current = false; // reset for React StrictMode's mount/unmount/mount in development
    return () => {
      closedRef.current = true;
      discardUpload();
    };
  }, [discardUpload]);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL must be created/revoked with the effect lifecycle
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onClose]);

  const runVoice = useCallback(async (videoFile, videoDuration) => {
    setVoice({ phase: "extracting", progress: 0, failed: false });
    try {
      if (!audioRef.current) {
        audioRef.current = await extractAudioFile(videoFile, { onProgress: (p) => setVoice((v) => ({ ...v, progress: p })) });
      }
      setVoice({ phase: "transcribing", progress: null, failed: false });
      const result = await transcribeVideoManualAudio(projectId, audioRef.current);
      const list = Array.isArray(result?.words) ? result.words : [];
      const initial = buildInitialCuts(list, videoDuration, { introTitle: t("Introduction"), wholeTitle: `${t("Step")} 1` });
      setWords(list);
      setCuts(initial.cuts);
      setMarkerCount(initial.markerCount);
      setVoice({ phase: "done", progress: 1, failed: false });
      return true;
    } catch (voiceError) {
      setVoice((v) => ({ ...v, failed: true }));
      setError(voiceError.message || t("Speech-to-text failed."));
      return false;
    }
  }, [projectId, t]);

  const handlePick = useCallback(async (picked) => {
    if (!picked) return;
    setError("");
    let videoDuration = 0;
    try {
      videoDuration = await readVideoDuration(picked);
    } catch (readError) {
      setError(readError.message);
      return;
    }
    if (videoDuration > AUTO_STEP_MAX_AUDIO_SECONDS) {
      setError(t("This video is {length} long. Auto steps support videos up to 30 minutes.", { length: formatClock(videoDuration) }));
      return;
    }
    audioRef.current = null;
    setFile(picked);
    setDuration(videoDuration);
    setStage("processing");
    setUpload({ progress: 0, done: false, failed: false, result: null });

    const uploadTask = uploadVideoManualPlaylistAsset(playlistId, picked, {
      onProgress: (loaded, total) => setUpload((u) => ({ ...u, progress: total > 0 ? loaded / total : 0 })),
    }).then((result) => {
      uploadedAssetIdRef.current = String(result?.assetId || "");
      if (closedRef.current) { discardUpload(); return false; }
      setUpload({ progress: 1, done: true, failed: false, result });
      return true;
    }).catch((uploadError) => {
      setUpload((u) => ({ ...u, failed: true }));
      setError(uploadError.message || t("Upload failed."));
      return false;
    });
    const [uploaded, transcribed] = await Promise.all([uploadTask, runVoice(picked, videoDuration)]);
    if (uploaded && transcribed) setStage("review");
  }, [discardUpload, playlistId, runVoice, t]);

  const handleRetryVoice = useCallback(async () => {
    setError("");
    setStage("processing");
    const ok = await runVoice(file, duration);
    if (ok && upload.done) setStage("review");
  }, [duration, file, runVoice, upload.done]);

  const ranges = useMemo(() => cutRanges(cuts, duration), [cuts, duration]);
  const rangeCues = useMemo(() => ranges.map((range) => buildCuesForRange(words, range.start, range.end)), [ranges, words]);

  const seekAndPlay = useCallback((time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    video.play().catch(() => {});
  }, []);

  const updateCutTitle = (id, title) => setCuts((current) => current.map((cut) => (cut.id === id ? { ...cut, title } : cut)));

  const commitCutTime = (id) => {
    const draft = timeDrafts[id];
    setTimeDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
    if (draft === undefined) return;
    const value = parseClock(draft);
    if (value == null) return;
    setCuts((current) => normalizeCuts(current.map((cut) => (cut.id === id ? { ...cut, start: value } : cut)), duration));
  };

  const removeCut = (id) => setCuts((current) => normalizeCuts(current.filter((cut) => cut.id !== id), duration));

  const addCutAtCurrentTime = () => {
    const time = Number(videoRef.current?.currentTime) || 0;
    setCuts((current) => normalizeCuts([...current, { id: `cut-manual-${Date.now()}`, start: time, title: `${t("Step")} ${current.length + 1}`, kind: "step" }], duration));
  };

  const handleCreate = useCallback(async () => {
    const result = upload.result;
    if (!result?.url) { setError(t("Upload is not finished.")); return; }
    setStage("saving");
    setError("");
    try {
      const apiBaseUrl = getVideoManualApiBaseUrl();
      const normalized = normalizePlayableMediaSource(result.url, apiBaseUrl);
      const src = normalized?.previewUrl || result.url;
      const publicUrl = normalized?.publicUrl || result.url;
      const template = cloneJson(DEFAULT_VIDEO_MANUAL_TEMPLATE, DEFAULT_VIDEO_MANUAL_TEMPLATE);
      const steps = ranges.map((range, index) => ({
        title: String(range.title || "").trim() || `${t("Step")} ${index + 1}`,
        edit: buildStepEdit({ src, start: range.start, end: range.end, template }),
        assetSourceMap: src !== publicUrl ? { [src]: publicUrl } : {},
        subtitles: rangeCues[index],
      }));
      const created = await bulkCreateVideoManualSteps(projectId, steps);
      createdRef.current = true; // the video is now used by the new steps: keep it
      onCreated?.(created);
    } catch (saveError) {
      setError(saveError.message || t("Could not create the steps."));
      setStage("review");
    }
  }, [onCreated, projectId, rangeCues, ranges, t, upload.result]);

  const buttonBase = "inline-flex items-center gap-1.5 rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton = `${buttonBase} border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]`;
  const primaryButton = `${buttonBase} bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)]`;
  const iconButton = "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30";
  const inputClass = "rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]";

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!busy) onClose(); }}>
      <div onClick={(event) => event.stopPropagation()} className="freya-card flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("Create steps from video")}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {file ? `${file.name} · ${formatClock(duration)}` : t("Say \"Step 1\", \"Step 2\" (or ステップ1, 手順2) in the video. Each one starts a new step.")}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 text-xs font-semibold text-[var(--text-primary)]">{error}</div>
          ) : null}

          {stage === "pick" ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--border)] px-6 py-12 text-center hover:bg-[var(--surface-hover)]">
              <Icon className="text-[var(--text-muted)]">video_file</Icon>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{t("Choose a video")}</span>
              <span className="text-xs text-[var(--text-muted)]">{t("Up to 30 minutes. English, Japanese or mixed.")}</span>
            </button>
          ) : null}
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { handlePick(event.target.files?.[0]); event.target.value = ""; }} />

          {stage === "processing" ? (
            <div className="space-y-4">
              <ProgressRow label={t("Uploading video")} value={upload.progress} done={upload.done} failed={upload.failed} />
              <ProgressRow
                label={voice.phase === "extracting" ? t("Reading the voice from the video") : t("Converting voice to text")}
                value={voice.phase === "extracting" ? voice.progress : null}
                done={voice.phase === "done"}
                failed={voice.failed}
              />
              {voice.failed && !upload.failed ? (
                <button type="button" onClick={handleRetryVoice} className={secondaryButton}><Icon>refresh</Icon>{t("Retry speech-to-text")}</button>
              ) : null}
            </div>
          ) : null}

          {stage === "review" || stage === "saving" ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-2">
                <div className="overflow-hidden rounded-[8px] bg-black">
                  <video ref={videoRef} src={videoUrl} controls playsInline preload="metadata" className="mx-auto max-h-[40vh] w-full" />
                </div>
                <button type="button" disabled={stage === "saving"} onClick={addCutAtCurrentTime} className={`${secondaryButton} w-full justify-center`}>
                  <Icon>content_cut</Icon>{t("Add cut at current time")}
                </button>
                <p className="text-xs text-[var(--text-muted)]">
                  {markerCount > 0
                    ? t("Found {n} spoken step markers. Check the cuts, then create the steps.", { n: markerCount })
                    : t("No step markers found. The whole video will be one step. You can add cuts yourself.")}
                </p>
              </div>

              <ol className="space-y-2">
                {ranges.map((range, index) => {
                  const cues = rangeCues[index];
                  return (
                    <li key={range.id} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--freya-blue)]/15 text-[11px] font-bold text-[var(--freya-blue)]">{index + 1}</span>
                        <input
                          value={timeDrafts[range.id] ?? formatClock(range.start)}
                          disabled={index === 0 || stage === "saving"}
                          aria-label={t("Start time")}
                          onChange={(event) => setTimeDrafts((current) => ({ ...current, [range.id]: event.target.value }))}
                          onBlur={() => commitCutTime(range.id)}
                          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                          className={`${inputClass} w-20 text-center`}
                        />
                        <span className="text-[11px] text-[var(--text-muted)]">→ {formatClock(range.end)}</span>
                        <button type="button" onClick={() => seekAndPlay(range.start)} title={t("Play from here")} className={iconButton}><Icon>play_arrow</Icon></button>
                        <button type="button" disabled={index === 0 || stage === "saving"} onClick={() => removeCut(range.id)} title={t("Remove this cut (joins it to the previous step)")} className={iconButton}><Icon>close</Icon></button>
                      </div>
                      <input
                        value={range.title}
                        disabled={stage === "saving"}
                        aria-label={t("Step title")}
                        onChange={(event) => updateCutTitle(range.id, event.target.value)}
                        className={`${inputClass} mt-2 w-full`}
                      />
                      <p className="mt-1.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                        {cues.length ? cues.map((cue) => cue.text).join(" ") : t("No speech in this part.")}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-3">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryButton}>{t("Cancel")}</button>
          {stage === "review" || stage === "saving" ? (
            <button type="button" disabled={stage === "saving" || !ranges.length} onClick={handleCreate} className={primaryButton}>
              <Icon className={stage === "saving" ? "animate-spin" : ""}>{stage === "saving" ? "progress_activity" : "auto_awesome"}</Icon>
              {t("Create {n} steps", { n: ranges.length })}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
