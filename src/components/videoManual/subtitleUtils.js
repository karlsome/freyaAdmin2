// SRT parsing / building helpers for the Video Manual subtitle feature.

function parseTimestamp(value) {
  const match = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
}

// Returns [{ index, start, end, text }] in seconds. Throws if no cue could be read.
export function parseSrt(raw = "") {
  const normalized = String(raw).replace(new RegExp("^\\uFEFF"), "").replace(/\r\n?/g, "\n").trim();
  const cues = [];
  normalized.split(/\n{2,}/).forEach((block) => {
    const lines = block.split("\n");
    const timeLineIdx = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIdx === -1) return;
    const [startRaw, endRaw] = lines[timeLineIdx].split("-->");
    const start = parseTimestamp(startRaw || "");
    const end = parseTimestamp((endRaw || "").trim().split(/\s+/)[0] || "");
    const text = lines.slice(timeLineIdx + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (start == null || end == null || end <= start || !text) return;
    cues.push({ index: cues.length + 1, start, end, text });
  });
  if (!cues.length) throw new Error("No subtitles found in this SRT file.");
  return cues;
}

// Maps each cue to the step it overlaps most; several cues in one step are joined line by line.
// Returns [{ start, description }] keyed by the step start time (same shape as settings.stepDescriptions).
export function cuesToStepDescriptions(cues, steps) {
  const byStep = new Map();
  cues.forEach((cue) => {
    let best = null;
    let bestOverlap = 0;
    steps.forEach((step) => {
      const overlap = Math.min(cue.end, step.endTime) - Math.max(cue.start, step.startTime);
      if (overlap > bestOverlap) { bestOverlap = overlap; best = step; }
    });
    if (!best) return;
    byStep.set(best, [...(byStep.get(best) || []), cue.text]);
  });
  return [...byStep.entries()].map(([step, texts]) => ({
    start: Math.round(step.startTime * 1000) / 1000,
    description: texts.join("\n"),
  }));
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds * 1000));
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(total / 3600000))}:${pad(Math.floor(total / 60000) % 60)}:${pad(Math.floor(total / 1000) % 60)},${pad(total % 1000, 3)}`;
}

// One cue per step that has a description, spanning the step's start to end.
export function buildSrtFromSteps(steps, getDescription) {
  const blocks = [];
  steps.forEach((step) => {
    const text = String(getDescription(step) || "").trim();
    if (!text || step.endTime <= step.startTime) return;
    blocks.push(`${blocks.length + 1}\n${formatTimestamp(step.startTime)} --> ${formatTimestamp(step.endTime)}\n${text}`);
  });
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

// Timed cues ({ start, end, text }, seconds) -> SRT text. Used by step-based projects.
export function buildSrtFromCues(cues) {
  return [...(Array.isArray(cues) ? cues : [])]
    .filter((cue) => String(cue?.text || "").trim() && cue.end > cue.start)
    .sort((a, b) => a.start - b.start)
    .map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${String(cue.text).trim()}`)
    .join("\n\n");
}
