// Lossless (stream-copy) video trimming in the browser with ffmpeg.wasm.
// The source File is mounted lazily (WORKERFS), so only the bytes inside the trimmed range are read and the
// whole video is never loaded into memory or uploaded. No re-encoding => fast even on weak PCs.
// Note: with stream copy the cut snaps to the nearest keyframe before the start point (usually within 1-2s).
import { FFmpeg } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpegPromise = null;

function getFfmpeg() {
  if (!ffmpegPromise) {
    const ffmpeg = new FFmpeg();
    ffmpegPromise = ffmpeg.load({ coreURL, wasmURL }).then(() => ffmpeg).catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

function getExtension(name = "") {
  const match = /\.([a-z0-9]{2,5})$/i.exec(String(name));
  return match ? match[1].toLowerCase() : "mp4";
}

export async function trimVideoFile(file, { start, end, onProgress } = {}) {
  const duration = end - start;
  if (!(duration > 0)) throw new Error("Invalid trim range.");

  const ffmpeg = await getFfmpeg();
  const inputExt = getExtension(file.name);
  const outputExt = inputExt === "webm" ? "webm" : "mp4";
  const mountPoint = "/trim-in";
  const inputName = `input.${inputExt}`;
  const outputName = `output.${outputExt}`;
  const handleProgress = ({ progress }) => {
    if (Number.isFinite(progress)) onProgress?.(Math.max(0, Math.min(1, progress)));
  };

  ffmpeg.on("progress", handleProgress);
  try {
    try { await ffmpeg.createDir(mountPoint); } catch { /* already exists */ }
    await ffmpeg.mount("WORKERFS", { files: [new File([file], inputName)] }, mountPoint);

    const args = [
      "-ss", String(start),
      "-t", String(duration),
      "-i", `${mountPoint}/${inputName}`,
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
    ];
    if (outputExt === "mp4") args.push("-movflags", "+faststart");
    args.push(outputName);

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) throw new Error("Could not trim this video. Try uploading the full video instead.");

    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("Trimmed video is empty. Try a different range.");

    const baseName = String(file.name || "video").replace(/\.[^.]+$/, "");
    const mimeType = outputExt === "webm" ? "video/webm" : "video/mp4";
    return new File([data], `${baseName}_trim.${outputExt}`, { type: mimeType });
  } finally {
    ffmpeg.off("progress", handleProgress);
    try { await ffmpeg.deleteFile(outputName); } catch { /* ignore */ }
    try { await ffmpeg.unmount(mountPoint); } catch { /* ignore */ }
  }
}

// Extracts the voice track as a small mono MP3 (16 kHz, 48 kbps: ~0.35 MB per minute) for speech-to-text.
// Only the audio stream is decoded (-vn), so this stays fast even for long videos.
export async function extractAudioFile(file, { onProgress } = {}) {
  const ffmpeg = await getFfmpeg();
  const inputExt = getExtension(file.name);
  const mountPoint = "/audio-in";
  const inputName = `input.${inputExt}`;
  const outputName = "voice.mp3";
  const handleProgress = ({ progress }) => {
    if (Number.isFinite(progress)) onProgress?.(Math.max(0, Math.min(1, progress)));
  };

  ffmpeg.on("progress", handleProgress);
  try {
    try { await ffmpeg.createDir(mountPoint); } catch { /* already exists */ }
    await ffmpeg.mount("WORKERFS", { files: [new File([file], inputName)] }, mountPoint);
    const exitCode = await ffmpeg.exec([
      "-i", `${mountPoint}/${inputName}`,
      "-vn", "-ac", "1", "-ar", "16000",
      "-c:a", "libmp3lame", "-b:a", "48k",
      outputName,
    ]);
    if (exitCode !== 0) throw new Error("Could not read the audio of this video.");
    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("This video has no audio track.");
    return new File([data], "voice.mp3", { type: "audio/mpeg" });
  } finally {
    ffmpeg.off("progress", handleProgress);
    try { await ffmpeg.deleteFile(outputName); } catch { /* ignore */ }
    try { await ffmpeg.unmount(mountPoint); } catch { /* ignore */ }
  }
}

// Reads a local video's duration (seconds) from its metadata without loading the whole file.
export function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (fn) => { URL.revokeObjectURL(url); video.removeAttribute("src"); fn(); };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      done(() => (Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error("Could not read the video length."))));
    };
    video.onerror = () => done(() => reject(new Error("This video format cannot be read by the browser.")));
    video.src = url;
  });
}
