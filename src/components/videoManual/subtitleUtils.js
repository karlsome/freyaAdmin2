// SRT parsing / building helpers for the Video Manual subtitle feature.

export const SUBTITLE_LANGUAGES = [
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "zh-CN", label: "中文 (Chinese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "th", label: "ไทย (Thai)" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

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
