// "Create steps from video": turns a word-timestamped transcript into steps (cuts), titles and subtitles.
// Markers are spoken step numbers at the start of a sentence: "Step 1" / "step one" / "ステップ1" / "手順2" / "工程3".
// Words look like { word, start, end } in seconds, as returned by the /transcribe route.

export const AUTO_STEP_LEAD_SECONDS = 0.3; // each cut starts this much before the spoken "Step N"
export const AUTO_STEP_MAX_AUDIO_SECONDS = 30 * 60; // Gemini word timestamps limit
const MIN_INTRO_SECONDS = 1;
const MIN_STEP_SECONDS = 0.5;
const SENTENCE_PAUSE_SECONDS = 0.4;
const TITLE_PAUSE_SECONDS = 0.6;
const TITLE_MAX_CHARS = 40;
const CUE_PAUSE_SECONDS = 0.8;
const CUE_MAX_SECONDS = 6;
const CUE_MAX_CHARS_LATIN = 42;
const CUE_MAX_CHARS_CJK = 24;

const EN_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};
// Single-kana readings (に, し, ご, く) are left out on purpose: "ステップに進む" uses に as a particle.
const JA_READINGS = {
  いち: 1, さん: 3, よん: 4, ろく: 6, なな: 7, しち: 7, はち: 8, きゅう: 9, じゅう: 10,
};
const KANJI_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const JA_KEYWORDS = ["ステップ", "すてっぷ", "手順", "工程"];

const SENTENCE_END_RE = /[.!?。！？]$/;
const EDGE_PUNCT_RE = /^[\s"'「『（(【[、,。.!?！？:：;；]+|[\s"'」』）)】\]、,。.!?！？:：;；]+$/g;

function toHalfWidthDigits(value) {
  return String(value).replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function stripPunct(value) {
  return toHalfWidthDigits(String(value || "")).replace(EDGE_PUNCT_RE, "");
}

function parseKanjiNumber(value) {
  if (!/^[一二三四五六七八九十]+$/.test(value)) return null;
  if (value === "十") return 10;
  const [tensPart, onesPart] = value.includes("十") ? value.split("十") : ["", value];
  const tens = value.includes("十") ? (tensPart ? KANJI_DIGITS[tensPart] : 1) : 0;
  const ones = onesPart ? KANJI_DIGITS[onesPart] : 0;
  if (tens === undefined || ones === undefined || onesPart.length > 1) return null;
  return tens * 10 + ones || null;
}

// "1" / "１" / "one" / "一" / "いち" -> 1 (null when the token is not a number).
export function parseSpokenNumber(token) {
  const value = stripPunct(token).toLowerCase();
  if (!value) return null;
  if (/^\d{1,3}$/.test(value)) return Number(value) || null;
  if (EN_NUMBERS[value]) return EN_NUMBERS[value];
  if (JA_READINGS[value]) return JA_READINGS[value];
  return parseKanjiNumber(value);
}

function isSentenceStart(words, index) {
  if (index === 0) return true;
  const prev = words[index - 1];
  return SENTENCE_END_RE.test(String(prev.word || "").trim()) || words[index].start - prev.end >= SENTENCE_PAUSE_SECONDS;
}

// Returns [{ index, endIndex, number, label, start }] where endIndex is the last word of the marker.
export function findStepMarkers(words) {
  const markers = [];
  for (let i = 0; i < words.length; i += 1) {
    if (!isSentenceStart(words, i)) continue;
    const first = stripPunct(words[i].word);
    const lower = first.toLowerCase();
    let match = null;

    if (lower === "step") {
      // "Step 2" / "Step number 2"
      let j = i + 1;
      if (stripPunct(words[j]?.word).toLowerCase() === "number") j += 1;
      const number = words[j] ? parseSpokenNumber(words[j].word) : null;
      if (number) match = { endIndex: j, number, label: `Step ${number}` };
    } else {
      const keyword = JA_KEYWORDS.find((kw) => first.startsWith(kw));
      if (keyword) {
        // "ステップ1" may come as one token, or as "ステップ" + "1、"
        const rest = first.slice(keyword.length);
        const sameToken = rest ? parseSpokenNumber(rest) : null;
        const nextToken = !rest && words[i + 1] ? parseSpokenNumber(words[i + 1].word) : null;
        const number = sameToken || nextToken;
        const display = keyword === "すてっぷ" ? "ステップ" : keyword;
        if (number) match = { endIndex: sameToken ? i : i + 1, number, label: `${display}${number}` };
      }
    }

    if (match) {
      markers.push({ index: i, start: words[i].start, ...match });
      i = match.endIndex;
    }
  }
  return markers;
}

const isCjk = (ch) => /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/.test(ch || "");

// Joins tokens: a space between Latin words, nothing between Japanese tokens.
export function joinWords(tokens) {
  return tokens.reduce((text, token) => {
    const piece = String(token || "").trim();
    if (!piece) return text;
    if (!text) return piece;
    const needsSpace = !isCjk(text.slice(-1)) && !isCjk(piece[0]) && !/^[、。,.!?！？:;)]/.test(piece);
    return text + (needsSpace ? " " : "") + piece;
  }, "");
}

function buildTitle(words, marker, rangeEnd) {
  const phrase = [];
  for (let i = marker.endIndex + 1; i < words.length && words[i].start < rangeEnd; i += 1) {
    const prev = words[i - 1];
    if (phrase.length && words[i].start - prev.end >= TITLE_PAUSE_SECONDS) break;
    phrase.push(words[i].word);
    if (SENTENCE_END_RE.test(String(words[i].word).trim())) break;
    if (joinWords(phrase).length >= TITLE_MAX_CHARS) break;
  }
  let text = stripPunct(joinWords(phrase));
  if (text.length > TITLE_MAX_CHARS) text = `${text.slice(0, TITLE_MAX_CHARS).trim()}…`;
  return text ? `${marker.label}: ${text}` : marker.label;
}

// Splits the transcript into cuts. Each cut: { id, start, title, kind: "intro" | "step" | "whole" }.
export function buildInitialCuts(words, duration, { introTitle = "Introduction", wholeTitle = "Step 1" } = {}) {
  const markers = findStepMarkers(words);
  if (!markers.length) return { cuts: [{ id: "cut-0", start: 0, title: wholeTitle, kind: "whole" }], markerCount: 0 };

  const cuts = [];
  const firstStart = Math.max(0, markers[0].start - AUTO_STEP_LEAD_SECONDS);
  if (firstStart >= MIN_INTRO_SECONDS) cuts.push({ id: "cut-intro", start: 0, title: introTitle, kind: "intro" });
  markers.forEach((marker, index) => {
    const next = markers[index + 1];
    const start = cuts.length ? Math.max(0, marker.start - AUTO_STEP_LEAD_SECONDS) : 0;
    const rangeEnd = next ? next.start : duration;
    cuts.push({ id: `cut-${index + 1}`, start, title: buildTitle(words, marker, rangeEnd), kind: "step" });
  });
  return { cuts: normalizeCuts(cuts, duration), markerCount: markers.length };
}

// Sorts cuts, forces the first to 0 and drops cuts that would make a step shorter than MIN_STEP_SECONDS.
export function normalizeCuts(cuts, duration) {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const result = [];
  sorted.forEach((cut, index) => {
    const start = index === 0 ? 0 : Math.min(Math.max(0, cut.start), duration);
    const prev = result[result.length - 1];
    if (prev && start - prev.start < MIN_STEP_SECONDS) return;
    if (duration - start < MIN_STEP_SECONDS && result.length) return;
    result.push({ ...cut, start });
  });
  return result;
}

export function cutRanges(cuts, duration) {
  return cuts.map((cut, index) => ({ ...cut, end: index + 1 < cuts.length ? cuts[index + 1].start : duration }));
}

// Subtitle cues for one range, timed relative to the range start (the step timeline starts at 0).
export function buildCuesForRange(words, start, end) {
  const inside = words.filter((w) => w.start >= start - 0.05 && w.start < end);
  const cues = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const text = joinWords(current.map((w) => w.word));
    const cueStart = Math.max(0, current[0].start - start);
    const cueEnd = Math.min(end - start, Math.max(current[current.length - 1].end - start, cueStart + 0.5));
    if (text && cueEnd > cueStart) cues.push({ id: `cue-${Math.round(start * 1000)}-${cues.length}`, start: round3(cueStart), end: round3(cueEnd), text });
    current = [];
  };
  inside.forEach((word, index) => {
    const prev = inside[index - 1];
    if (current.length && prev && word.start - prev.end >= CUE_PAUSE_SECONDS) flush();
    current.push(word);
    const text = joinWords(current.map((w) => w.word));
    const maxChars = isCjk(text[0]) ? CUE_MAX_CHARS_CJK : CUE_MAX_CHARS_LATIN;
    const tooLong = text.length >= maxChars || word.end - current[0].start >= CUE_MAX_SECONDS;
    if (tooLong || SENTENCE_END_RE.test(String(word.word).trim())) flush();
  });
  flush();
  return cues;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

// The step edit: one video clip that plays [start, end) of the uploaded video.
export function buildStepEdit({ src, start, end, template }) {
  return {
    ...template,
    timeline: {
      ...(template?.timeline || {}),
      tracks: [{ clips: [{ asset: { type: "video", src, trim: round3(start), volume: 1 }, start: 0, length: round3(end - start), fit: "contain" }] }],
    },
  };
}

export function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

// "1:05.3" / "65.3" -> 65.3 (null when invalid).
export function parseClock(value) {
  const text = String(value || "").trim();
  const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(text);
  if (!match) return null;
  return Number(match[1] || 0) * 60 + Number(match[2]);
}
