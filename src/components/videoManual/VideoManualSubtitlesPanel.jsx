import { useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { parseSrt, SUBTITLE_LANGUAGES } from "./subtitleUtils";
import { translateVideoManualText } from "../../services/videoManualApi";

const selectClass = "w-full rounded-lg border border-separator bg-surface px-2 py-1.5 text-xs font-semibold text-on-surface";

export default function VideoManualSubtitlesPanel({ tracks = [], onSaveTracks }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [cues, setCues] = useState([]);
  const [sourceLang, setSourceLang] = useState("ja");
  const [targetLang, setTargetLang] = useState("en");
  const [translations, setTranslations] = useState({}); // lang -> { [cueIndex]: text }
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const showingLang = translations[targetLang] ? targetLang : sourceLang;
  const textFor = (cue) => (showingLang === sourceLang ? cue.text : translations[showingLang]?.[cue.index] ?? cue.text);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseSrt(await file.text());
      setCues(parsed);
      setFileName(file.name);
      setTranslations({});
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleTranslate() {
    if (!cues.length || sourceLang === targetLang) return;
    setError("");
    const result = {};
    let done = 0;
    setProgress({ done, total: cues.length });
    const queue = [...cues];
    const worker = async () => {
      while (queue.length) {
        const cue = queue.shift();
        try {
          result[cue.index] = await translateVideoManualText(cue.text, sourceLang, targetLang);
        } catch (err) {
          result[cue.index] = cue.text;
          setError(err.message || t("Translation failed"));
        }
        done += 1;
        setProgress({ done, total: cues.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setTranslations((prev) => ({ ...prev, [targetLang]: result }));
    setProgress(null);
  }

  const langLabel = (code) => SUBTITLE_LANGUAGES.find((l) => l.code === code)?.label || code;
  const saved = Array.isArray(tracks) ? tracks : [];

  function handleSaveTrack() {
    const track = {
      lang: showingLang,
      label: langLabel(showingLang),
      cues: cues.map((cue) => ({ start: cue.start, end: cue.end, text: textFor(cue) })),
    };
    onSaveTracks([...saved.filter((item) => item.lang !== track.lang), track]);
  }

  function handleDeleteTrack(lang) {
    onSaveTracks(saved.filter((item) => item.lang !== lang));
  }

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept=".srt,text/plain" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-separator bg-surface-container px-3 py-4 text-xs font-bold text-on-surface transition hover:bg-surface-container-high"
      >
        <span className="material-symbols-outlined text-[18px]">upload_file</span>
        {fileName || t("Upload SRT file")}
      </button>
      {error && <p className="text-[11px] font-bold text-error">{error}</p>}

      {cues.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-on-surface-variant">
              {t("SRT language")}
              <select className={selectClass} value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                {SUBTITLE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold text-on-surface-variant">
              {t("Translate to")}
              <select className={selectClass} value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                {SUBTITLE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={!!progress || sourceLang === targetLang}
            onClick={handleTranslate}
            className="w-full rounded-lg bg-surface-container px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-high disabled:opacity-50"
          >
            {progress ? `${t("Translating")} ${progress.done}/${progress.total}` : translations[targetLang] ? t("Re-translate") : t("Auto translate")}
          </button>

          <p className="text-[11px] font-bold text-on-surface-variant">
            {t("Preview")} ({showingLang}) · {cues.length} {t("lines")}
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-surface-container p-2">
            {cues.map((cue) => (
              <div key={cue.index} className="text-[11px] text-on-surface">
                <span className="mr-1 font-mono text-on-surface-variant">{cue.start.toFixed(1)}s</span>
                {textFor(cue)}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveTrack}
            className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
          >
            {t("Save as subtitle track")} ({showingLang})
          </button>
        </>
      )}

      <div>
        <p className="mb-1 text-[11px] font-bold text-on-surface-variant">{t("Subtitle tracks")}</p>
        {saved.length === 0 && <p className="text-[11px] text-on-surface-variant">{t("No subtitle tracks yet.")}</p>}
        {saved.map((track) => (
          <div key={track.lang} className="mb-1 flex items-center justify-between rounded-lg bg-surface-container px-2 py-1.5 text-xs font-bold text-on-surface">
            <span>{track.label || langLabel(track.lang)} · {track.cues?.length || 0}</span>
            <button type="button" onClick={() => handleDeleteTrack(track.lang)} className="material-symbols-outlined text-[16px] text-error">delete</button>
          </div>
        ))}
        <p className="mt-1 text-[10px] text-on-surface-variant">
          {t("Viewers choose the language in the player (CC). Deploy the project to publish subtitle changes.")}
        </p>
      </div>
    </div>
  );
}
