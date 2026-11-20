import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { extractAudioFile, readVideoDuration } from "../../utils/trimVideoFile";
import {
  bulkCreateVideoManualSteps,
  deleteVideoManualAutoStepsDraft,
  fetchVideoManualAutoStepsDraft,
  getVideoManualApiBaseUrl,
  saveVideoManualAutoStepsDraft,
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
import useEscapeClose from "../../hooks/useEscapeClose";

const CUTS_SAVE_DELAY_MS = 800;

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

function fileFingerprint(file, duration) {
  return { name: file.name, size: file.size, lastModified: file.lastModified, duration };
}

function isSameFile(file, fingerprint) {
  return Boolean(fingerprint) && file.name === fingerprint.name && file.size === fingerprint.size && file.lastModified === fingerprint.lastModified;
}

function warnDraftSave(error) {
  console.warn("Could not save the auto steps draft:", error);
}

/**
 * "Create steps from video": the user picks one video. In parallel, the video is uploaded (as today) and its
 * voice track is extracted in the browser and transcribed. Spoken "Step 1 / ステップ1 ..." become cuts that the
 * user reviews, then every cut becomes a step pointing at the same uploaded video (no splitting, exact cuts).
 *
 * Progress is kept in MongoDB as a draft per project and user (file, uploaded asset, transcript hash, edited cuts),
 * and transcripts are cached on the server by audio hash, so a reload or a lost connection continues where it
 * left off and the same audio is never sent to Gemini twice. Closing keeps the draft; "Discard" removes it and
 * moves its uploaded video to the recycle bin.
 */
export default function VideoManualAutoStepsModal({ projectId, playlistId, onClose, onCreated }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [file, setFile] = useState(null);
  const [localVideoUrl, setLocalVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [stage, setStage] = useState("loading"); // loading | resume | pick | processing | review | saving
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null); // the draft found when the window opened
  const [draftTranscript, setDraftTranscript] = useState(null);
  const [asset, setAsset] = useState(null); // { assetId, url } of the uploaded video
  const [upload, setUpload] = useState({ progress: 0, done: false, failed: false });
  const [voice, setVoice] = useState({ phase: "idle", progress: 0, failed: false }); // extracting | transcribing | done
  const [words, setWords] = useState([]);
  const [cuts, setCuts] = useState([]);
  const [markerCount, setMarkerCount] = useState(0);
  const [timeDrafts, setTimeDrafts] = useState({});
  const audioRef = useRef(null);
  const cutsDirtyRef = useRef(false);
  // The review opens once BOTH the upload and the transcript are ready, whichever finishes (or is retried) last.
  const pendingRef = useRef({ asset: null, words: null, duration: 0, savedCuts: null });
  const busy = stage === "saving";

  useEffect(() => {
    let cancelled = false;
    fetchVideoManualAutoStepsDraft(projectId)
      .then((result) => {
        if (cancelled) return;
        if (result?.draft?.file) {
          setDraft(result.draft);
          setDraftTranscript(result.transcript || null);
          setStage("resume");
        } else {
          setStage("pick");
        }
      })
      .catch(() => { if (!cancelled) setStage("pick"); }); // drafts are a convenience: never block the feature
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL must be created/revoked with the effect lifecycle
    setLocalVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escape closes the top-most modal (ignored while busy)
  useEscapeClose(() => { if (!busy) onClose(); });

  // Edited cuts are saved to the draft shortly after each change.
  useEffect(() => {
    if (!cutsDirtyRef.current || stage !== "review") return undefined;
    const timer = window.setTimeout(() => {
      cutsDirtyRef.current = false;
      saveVideoManualAutoStepsDraft(projectId, { cuts }).catch(warnDraftSave);
    }, CUTS_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [cuts, projectId, stage]);

  const changeCuts = useCallback((updater) => {
    cutsDirtyRef.current = true;
    setCuts(updater);
  }, []);

  const applyTranscript = useCallback((list, videoDuration, savedCuts) => {
    const initial = buildInitialCuts(list, videoDuration, { introTitle: t("Introduction"), wholeTitle: `${t("Step")} 1` });
    setWords(list);
    setMarkerCount(initial.markerCount);
    setCuts(Array.isArray(savedCuts) && savedCuts.length ? normalizeCuts(savedCuts, videoDuration) : initial.cuts);
  }, [t]);

  const finishIfReady = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending.asset || !pending.words) return;
    applyTranscript(pending.words, pending.duration, pending.savedCuts);
    setStage("review");
  }, [applyTranscript]);

  const runVoice = useCallback(async (videoFile) => {
    setVoice({ phase: "extracting", progress: 0, failed: false });
    try {
      if (!audioRef.current) {
        audioRef.current = await extractAudioFile(videoFile, { onProgress: (p) => setVoice((v) => ({ ...v, progress: p })) });
      }
      setVoice({ phase: "transcribing", progress: null, failed: false });
      const result = await transcribeVideoManualAudio(projectId, audioRef.current);
      if (result?.audioHash) saveVideoManualAutoStepsDraft(projectId, { audioHash: result.audioHash }).catch(warnDraftSave);
      setVoice({ phase: "done", progress: 1, failed: false });
      pendingRef.current.words = Array.isArray(result?.words) ? result.words : [];
      finishIfReady();
      return true;
    } catch (voiceError) {
      setVoice((v) => ({ ...v, failed: true }));
      setError(voiceError.message || t("Speech-to-text failed."));
      return false;
    }
  }, [finishIfReady, projectId, t]);

  const runUpload = useCallback(async (videoFile) => {
    setUpload({ progress: 0, done: false, failed: false });
    try {
      const result = await uploadVideoManualPlaylistAsset(playlistId, videoFile, {
        onProgress: (loaded, total) => setUpload((u) => ({ ...u, progress: total > 0 ? loaded / total : 0 })),
      });
      const uploaded = { assetId: String(result?.assetId || ""), url: String(result?.url || "") };
      // Saved even if the window was closed meanwhile, so the next open can skip the upload.
      saveVideoManualAutoStepsDraft(projectId, { asset: uploaded }).catch(warnDraftSave);
      setAsset(uploaded);
      setUpload({ progress: 1, done: true, failed: false });
      pendingRef.current.asset = uploaded;
      finishIfReady();
      return true;
    } catch (uploadError) {
      setUpload((u) => ({ ...u, failed: true }));
      setError(uploadError.message || t("Upload failed."));
      return false;
    }
  }, [finishIfReady, playlistId, projectId, t]);

  // Runs whatever is still missing: the upload (unless `knownAsset`) and speech-to-text (unless `knownWords`).
  const processFile = useCallback(async (picked, { knownAsset = null, knownWords = null, savedCuts = null, fresh = true } = {}) => {
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
    if (fresh) {
      saveVideoManualAutoStepsDraft(projectId, { file: fileFingerprint(picked, videoDuration), asset: null, audioHash: "", cuts: null }).catch(warnDraftSave);
    }

    pendingRef.current = { asset: knownAsset, words: knownWords, duration: videoDuration, savedCuts };
    setAsset(knownAsset);
    if (knownAsset) setUpload({ progress: 1, done: true, failed: false });
    if (knownWords) setVoice({ phase: "done", progress: 1, failed: false });
    if (knownAsset && knownWords) { finishIfReady(); return; }
    if (!knownAsset) runUpload(picked);
    if (!knownWords) runVoice(picked);
  }, [finishIfReady, projectId, runUpload, runVoice, t]);

  const handlePick = useCallback(async (picked) => {
    if (!picked) return;
    if (draft?.file && stage === "pick") {
      if (isSameFile(picked, draft.file)) {
        await processFile(picked, {
          knownAsset: draft.asset?.url ? draft.asset : null,
          knownWords: draftTranscript?.words || null,
          savedCuts: draft.cuts,
          fresh: false,
        });
        return;
      }
      if (!window.confirm(t("This is a different video from the one you started with. Start over with this video?"))) return;
      await deleteVideoManualAutoStepsDraft(projectId, { recycleAsset: true }).catch(() => {});
      setDraft(null);
      setDraftTranscript(null);
    }
    await processFile(picked);
  }, [draft, draftTranscript, processFile, projectId, stage, t]);

  const handleContinue = useCallback(() => {
    if (draft?.asset?.url && draftTranscript) {
      // Everything is saved: go straight to the review, using the uploaded video. Nothing is sent to Gemini.
      setDuration(Number(draft.file?.duration) || 0);
      setAsset(draft.asset);
      applyTranscript(draftTranscript.words || [], Number(draft.file?.duration) || 0, draft.cuts);
      setStage("review");
      return;
    }
    setStage("pick"); // the browser cannot reopen a local file by itself after a reload: ask for it again
  }, [applyTranscript, draft, draftTranscript]);

  const handleDiscard = useCallback(async () => {
    if (!window.confirm(t("Discard this draft? Its uploaded video will be moved to the recycle bin."))) return;
    setStage("saving");
    try {
      await deleteVideoManualAutoStepsDraft(projectId, { recycleAsset: true });
    } catch (discardError) {
      console.warn("Could not discard the auto steps draft:", discardError);
    }
    onClose();
  }, [onClose, projectId, t]);

  const handleRetryVoice = useCallback(() => { setError(""); runVoice(file); }, [file, runVoice]);
  const handleRetryUpload = useCallback(() => { setError(""); runUpload(file); }, [file, runUpload]);

  const assetUrl = asset?.url || "";
  const previewSrc = useMemo(() => {
    if (localVideoUrl) return localVideoUrl;
    if (!assetUrl) return "";
    return normalizePlayableMediaSource(assetUrl, getVideoManualApiBaseUrl())?.previewUrl || assetUrl;
  }, [assetUrl, localVideoUrl]);

  const ranges = useMemo(() => cutRanges(cuts, duration), [cuts, duration]);
  const rangeCues = useMemo(() => ranges.map((range) => buildCuesForRange(words, range.start, range.end)), [ranges, words]);

  const seekAndPlay = useCallback((time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    video.play().catch(() => {});
  }, []);

  const updateCutTitle = (id, title) => changeCuts((current) => current.map((cut) => (cut.id === id ? { ...cut, title } : cut)));

  const commitCutTime = (id) => {
    const value = timeDrafts[id];
    setTimeDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
    if (value === undefined) return;
    const seconds = parseClock(value);
    if (seconds == null) return;
    changeCuts((current) => normalizeCuts(current.map((cut) => (cut.id === id ? { ...cut, start: seconds } : cut)), duration));
  };

  const removeCut = (id) => changeCuts((current) => normalizeCuts(current.filter((cut) => cut.id !== id), duration));

  const addCutAtCurrentTime = () => {
    const time = Number(videoRef.current?.currentTime) || 0;
    changeCuts((current) => normalizeCuts([...current, { id: `cut-manual-${Date.now()}`, start: time, title: `${t("Step")} ${current.length + 1}`, kind: "step" }], duration));
  };

  const handleCreate = useCallback(async () => {
    if (!assetUrl) { setError(t("Upload is not finished.")); return; }
    setStage("saving");
    setError("");
    try {
      const normalized = normalizePlayableMediaSource(assetUrl, getVideoManualApiBaseUrl());
      const src = normalized?.previewUrl || assetUrl;
      const publicUrl = normalized?.publicUrl || assetUrl;
      const template = cloneJson(DEFAULT_VIDEO_MANUAL_TEMPLATE, DEFAULT_VIDEO_MANUAL_TEMPLATE);
      const steps = ranges.map((range, index) => ({
        title: String(range.title || "").trim() || `${t("Step")} ${index + 1}`,
        edit: buildStepEdit({ src, start: range.start, end: range.end, template }),
        assetSourceMap: src !== publicUrl ? { [src]: publicUrl } : {},
        subtitles: rangeCues[index],
      }));
      const created = await bulkCreateVideoManualSteps(projectId, steps); // also deletes the draft on the server
      onCreated?.(created);
    } catch (saveError) {
      setError(saveError.message || t("Could not create the steps."));
      setStage("review");
    }
  }, [assetUrl, onCreated, projectId, rangeCues, ranges, t]);

  const buttonBase = "inline-flex items-center gap-1.5 rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton = `${buttonBase} border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]`;
  const dangerButton = `${buttonBase} border border-[var(--status-danger)]/40 bg-[var(--surface)] text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10`;
  const primaryButton = `${buttonBase} bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)]`;
  const iconButton = "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30";
  const inputClass = "rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]";
  const hasDraft = Boolean(draft) || stage === "processing" || stage === "review";
  const fileLabel = file ? `${file.name} · ${formatClock(duration)}` : draft?.file ? `${draft.file.name} · ${formatClock(draft.file.duration)}` : "";

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!busy) onClose(); }}>
      <div onClick={(event) => event.stopPropagation()} className="freya-card flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("Create steps from video")}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {fileLabel || t("Say \"Step 1\", \"Step 2\" (or ステップ1, 手順2) in the video. Each one starts a new step.")}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 text-xs font-semibold text-[var(--text-primary)]">{error}</div>
          ) : null}

          {stage === "loading" ? (
            <div className="h-32 animate-pulse rounded-[10px] bg-[var(--surface-subtle)]" />
          ) : null}

          {stage === "resume" && draft ? (
            <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("Continue where you left off?")}</p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                <li className="flex items-center gap-1.5"><Icon className={draft.asset?.url ? "text-emerald-600" : ""}>{draft.asset?.url ? "check_circle" : "radio_button_unchecked"}</Icon>{draft.asset?.url ? t("Video uploaded") : t("Video not uploaded yet")}</li>
                <li className="flex items-center gap-1.5"><Icon className={draftTranscript ? "text-emerald-600" : ""}>{draftTranscript ? "check_circle" : "radio_button_unchecked"}</Icon>{draftTranscript ? t("Voice converted to text") : t("Voice not converted yet")}</li>
              </ul>
              {!(draft.asset?.url && draftTranscript) ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">{t("You will be asked to choose the same video file again: \"{name}\".", { name: draft.file.name })}</p>
              ) : null}
            </div>
          ) : null}

          {stage === "pick" ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--border)] px-6 py-12 text-center hover:bg-[var(--surface-hover)]">
              <Icon className="text-[var(--text-muted)]">video_file</Icon>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{draft?.file ? t("Choose \"{name}\" again", { name: draft.file.name }) : t("Choose a video")}</span>
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
              <div className="flex flex-wrap gap-2">
                {upload.failed ? <button type="button" onClick={handleRetryUpload} className={secondaryButton}><Icon>refresh</Icon>{t("Retry upload")}</button> : null}
                {voice.failed ? <button type="button" onClick={handleRetryVoice} className={secondaryButton}><Icon>refresh</Icon>{t("Retry speech-to-text")}</button> : null}
              </div>
              <p className="text-xs text-[var(--text-muted)]">{t("You can close this window. Progress is saved, so you can continue later.")}</p>
            </div>
          ) : null}

          {stage === "review" || (stage === "saving" && cuts.length) ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-2">
                <div className="overflow-hidden rounded-[8px] bg-black">
                  <video ref={videoRef} src={previewSrc} controls playsInline preload="metadata" className="mx-auto max-h-[40vh] w-full" />
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

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-6 py-3">
          <div>
            {hasDraft && stage !== "loading" ? (
              <button type="button" disabled={busy} onClick={handleDiscard} className={dangerButton}><Icon>delete</Icon>{t("Discard")}</button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy} onClick={onClose} className={secondaryButton}>{hasDraft ? t("Close (continue later)") : t("Cancel")}</button>
            {stage === "resume" ? (
              <button type="button" onClick={handleContinue} className={primaryButton}><Icon>play_arrow</Icon>{t("Continue")}</button>
            ) : null}
            {stage === "review" || stage === "saving" ? (
              <button type="button" disabled={stage === "saving" || !ranges.length} onClick={handleCreate} className={primaryButton}>
                <Icon className={stage === "saving" ? "animate-spin" : ""}>{stage === "saving" ? "progress_activity" : "auto_awesome"}</Icon>
                {t("Create {n} steps", { n: ranges.length })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
