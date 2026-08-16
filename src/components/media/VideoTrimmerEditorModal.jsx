import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import IconButton from "../IconButton";

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
}

export default function VideoTrimmerEditorModal({
  open,
  videoFile,
  eyebrow = "Video Trimmer",
  title,
  description = "Adjust the start and end markers to trim the video before uploading.",
  confirmLabel = "Save & Continue",
  onClose,
  onSave,
  onSkip,
}) {
  const [videoSrc, setVideoSrc] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processError, setProcessError] = useState("");

  const videoRef = useRef(null);
  const isTrimmingRangeRef = useRef(false);

  useEffect(() => {
    if (!open || !videoFile) {
      setVideoSrc("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(videoFile);
    setVideoSrc(objectUrl);
    setStartTime(0);
    setEndTime(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setProcessing(false);
    setProgress(0);
    setProcessError("");

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [open, videoFile]);

  function handleLoadedMetadata(e) {
    const dur = e.target.duration || 0;
    setDuration(dur);
    setStartTime(0);
    setEndTime(dur);
    setCurrentTime(0);
  }

  function handleTimeUpdate() {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    if (isTrimmingRangeRef.current && curr >= endTime) {
      videoRef.current.pause();
      videoRef.current.currentTime = startTime;
      setIsPlaying(false);
      isTrimmingRangeRef.current = false;
    }
  }

  function togglePlayPause() {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTime < startTime || currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  }

  function previewTrimmedClip() {
    if (!videoRef.current) return;
    isTrimmingRangeRef.current = true;
    videoRef.current.currentTime = startTime;
    videoRef.current.play();
    setIsPlaying(true);
  }

  function setStartToCurrent() {
    const t = Math.min(currentTime, endTime - 0.5);
    setStartTime(Math.max(0, t));
  }

  function setEndToCurrent() {
    const t = Math.max(currentTime, startTime + 0.5);
    setEndTime(Math.min(duration, t));
  }

  async function handleTrimAndSave() {
    if (!videoFile || !duration) return;

    // If start is 0 and end is virtually the whole duration (within 0.3s), keep original
    if (startTime <= 0.1 && Math.abs(endTime - duration) <= 0.3) {
      onSave(videoFile);
      return;
    }

    setProcessing(true);
    setProgress(0);
    setProcessError("");

    try {
      const trimmedFile = await trimVideoInBrowser(videoFile, startTime, endTime, (pct) => {
        setProgress(pct);
      });
      setProcessing(false);
      onSave(trimmedFile);
    } catch (err) {
      console.error("Trim failed:", err);
      setProcessError("Failed to trim video in browser. You can still skip or upload original.");
      setProcessing(false);
    }
  }

  if (!open || !videoFile) return null;

  const clipDuration = Math.max(0, endTime - startTime);

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-[32px] border border-separator/40 bg-surface shadow-[0_32px_120px_rgba(15,23,42,0.28)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-separator/40 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">
              {title || `Trim: ${videoFile.name}`}
            </h3>
            <p className="mt-1 text-sm text-outline">{description}</p>
          </div>
          <IconButton icon="close" onClick={onClose} size="xl" ariaLabel="Close dialog" />
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Video Player Container */}
          <div className="relative mx-auto max-h-[420px] aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-separator/30">
            <video
              ref={videoRef}
              src={videoSrc}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="max-h-[420px] w-full h-full object-contain"
              playsInline
            />

            {/* Big Play overlay when paused */}
            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlayPause}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 hover:scale-105 transition-all shadow-xl backdrop-blur-sm cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 36 }}>play_arrow</span>
              </button>
            )}
          </div>

          {/* Scrubber & Controls */}
          <div className="rounded-2xl border border-separator/40 bg-surface-container/30 p-5 space-y-4">
            {/* Time Indicators */}
            <div className="flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
              <div className="flex items-center gap-4">
                <span className="text-primary flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-outline">Start:</span>
                  {formatTime(startTime)}
                </span>
                <span className="text-primary flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-outline">End:</span>
                  {formatTime(endTime)}
                </span>
                <span className="text-on-surface flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Trimmed Length:</span>
                  {formatTime(clipDuration)}
                </span>
              </div>
              <div className="text-outline">
                <span className="text-[10px] uppercase tracking-wider">Position:</span> {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Range Scrubbers */}
            <div className="space-y-3 pt-2">
              {/* Start Handle */}
              <div>
                <div className="flex justify-between text-[11px] font-medium text-outline mb-1">
                  <span>Start Point (In)</span>
                  <span>{formatTime(startTime)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={startTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setStartTime(Math.min(val, endTime - 0.5));
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>

              {/* End Handle */}
              <div>
                <div className="flex justify-between text-[11px] font-medium text-outline mb-1">
                  <span>End Point (Out)</span>
                  <span>{formatTime(endTime)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={endTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEndTime(Math.max(val, startTime + 0.5));
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-separator/20">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-separator/40 bg-surface text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {isPlaying ? "pause" : "play_arrow"}
                  </span>
                  {isPlaying ? "Pause" : "Play"}
                </button>

                <button
                  type="button"
                  onClick={previewTrimmedClip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>replay</span>
                  Preview Trim
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={setStartToCurrent}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-separator/40 text-[11px] font-medium text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  Set Start at Playhead
                </button>
                <button
                  type="button"
                  onClick={setEndToCurrent}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-separator/40 text-[11px] font-medium text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  Set End at Playhead
                </button>
              </div>
            </div>
          </div>

          {/* Processing Indicator */}
          {processing && (
            <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-primary">
                <span>Encoding trimmed clip...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-primary/20 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {processError && (
            <p className="text-xs text-error font-medium">{processError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator/40 px-6 py-4 bg-surface">
          <p className="text-xs text-outline">
            {startTime > 0 || endTime < duration
              ? `Trimmed clip will be ${formatTime(clipDuration)} long.`
              : "No trim selected. Original file will be used."}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={() => onSkip(videoFile)}
                disabled={processing}
                className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Skip / Keep Original
              </button>
            )}
            <button
              type="button"
              onClick={handleTrimAndSave}
              disabled={processing || !duration}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {processing ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  Trimming...
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Trims a video file in the browser using HTML5 Canvas + MediaRecorder
 */
function trimVideoInBrowser(file, startTime, endTime, onProgress) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = false;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    video.onloadedmetadata = async () => {
      try {
        const width = Math.min(video.videoWidth || 1280, 1920);
        const height = Math.min(video.videoHeight || 720, 1080);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        const stream = canvas.captureStream(30);
        
        let mimeType = "video/webm;codecs=vp9,opus";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/webm";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "video/mp4";
          }
        }

        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
          videoBitsPerSecond: 3000000,
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          const blob = new Blob(chunks, { type: chunks[0]?.type || "video/mp4" });
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const extension = blob.type.includes("webm") ? ".webm" : ".mp4";
          const trimmedFile = new File([blob], `${baseName}_trimmed${extension}`, {
            type: blob.type,
            lastModified: Date.now(),
          });
          resolve(trimmedFile);
        };

        video.currentTime = startTime;

        await new Promise((res) => {
          video.onseeked = () => res();
        });

        recorder.start(100);
        await video.play();

        const totalDuration = endTime - startTime;

        function renderFrame() {
          if (video.currentTime >= endTime || video.paused || video.ended) {
            recorder.stop();
            video.pause();
            return;
          }

          ctx.drawImage(video, 0, 0, width, height);

          const elapsed = Math.max(0, video.currentTime - startTime);
          const pct = Math.min(99, (elapsed / totalDuration) * 100);
          onProgress?.(pct);

          requestAnimationFrame(renderFrame);
        }

        requestAnimationFrame(renderFrame);
      } catch (err) {
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(video.src);
      reject(err || new Error("Failed to load video"));
    };
  });
}
