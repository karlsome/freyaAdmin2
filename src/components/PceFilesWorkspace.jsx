import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPceMasterData, uploadPceFiles } from "../services/api";

const MACHINE_TYPES = [
  { key: "1h_12", label: "1 head 1200mm", suffix: "1h_12" },
  { key: "1h_20", label: "1 head 2000mm", suffix: "1h_20" },
  { key: "2h_12", label: "2 head 1200mm", suffix: "2h_12" },
];

const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SUFFIXES = ["GD", "GN", "GL", "PD", "PM", "TD", "TL", "TN"];

const SEBANGGO_RE = /^[1-8][GPT].$/;

function buildValidCodes(records) {
  const seen = new Set();
  for (const r of records) {
    const code = String(r.背番号 || "").trim();
    if (code && !seen.has(code) && SEBANGGO_RE.test(code)) seen.add(code);
  }
  return seen;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function StepBadge({ n, active, done }) {
  const base = "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-black";
  if (done) return <span className={`${base} bg-emerald-500 text-white`}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span></span>;
  if (active) return <span className={`${base} bg-primary text-on-primary`}>{n}</span>;
  return <span className={`${base} bg-surface-container text-on-surface-variant`}>{n}</span>;
}

function PanelHeader({ step, active, done, title, sub }) {
  return (
    <div className="border-b border-separator/35 px-4 py-4 flex items-center gap-2.5">
      <StepBadge n={step} active={active} done={done} />
      <div>
        <h3 className="text-xs font-black text-on-surface">{title}</h3>
        {sub && <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

function ToggleBtn({ label, selected, onClick, mono = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 text-xs font-bold transition-all duration-150 text-center",
        mono ? "font-mono" : "",
        selected
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-outline-variant/20 bg-surface-container text-on-surface-variant hover:border-primary/30 hover:text-primary hover:bg-primary/5",
        className,
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function PceFilesWorkspace({ onFlash }) {
  const [masterData, setMasterData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [selectedSuffixes, setSelectedSuffixes] = useState(new Set());
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPceMasterData()
      .then((data) => { if (!cancelled) setMasterData(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) onFlash?.({ type: "error", message: err.message || "Failed to load master data." }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const validCodeSet = useMemo(() => buildValidCodes(masterData), [masterData]);

  const selectedCodes = useMemo(() => {
    if (!selectedNumbers.size || !selectedSuffixes.size) return [];
    const result = [];
    for (const n of NUMBERS) {
      if (!selectedNumbers.has(n)) continue;
      for (const s of SUFFIXES) {
        if (!selectedSuffixes.has(s)) continue;
        const code = `${n}${s}`;
        if (validCodeSet.has(code)) result.push(code);
      }
    }
    return result;
  }, [selectedNumbers, selectedSuffixes, validCodeSet]);

  const machineSuffix = MACHINE_TYPES.find((m) => m.key === selectedMachine)?.suffix;
  const previewFiles = selectedCodes.map((c) => `${c}_${machineSuffix}.pce`);

  const step1Done = !!selectedMachine;
  const step2Done = selectedCodes.length > 0;
  const step3Done = !!file;

  function toggleNumber(n) {
    setSelectedNumbers((prev) => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
    setUploadResults(null);
  }
  function toggleSuffix(s) {
    setSelectedSuffixes((prev) => { const ns = new Set(prev); ns.has(s) ? ns.delete(s) : ns.add(s); return ns; });
    setUploadResults(null);
  }

  function handleMachineSelect(key) {
    setSelectedMachine(key);
    setUploadResults(null);
  }

  function handleFileAccept(f) {
    if (!f.name.toLowerCase().endsWith(".pce")) {
      onFlash?.({ type: "error", message: "Only .pce files are accepted." });
      return;
    }
    setFile(f);
    setUploadResults(null);
  }

  async function handleUpload() {
    if (!file || !selectedCodes.length || !machineSuffix) return;
    setUploading(true);
    try {
      const fileBase64 = await toBase64(file);
      const result = await uploadPceFiles({ fileBase64, sebanggoList: selectedCodes, machineSuffix });
      setUploadResults(result.files);
      onFlash?.({ type: "success", message: `${result.files.length} file${result.files.length === 1 ? "" : "s"} created successfully.` });
    } catch (err) {
      onFlash?.({ type: "error", message: err.message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setSelectedMachine(null);
    setSelectedNumbers(new Set());
    setSelectedSuffixes(new Set());
    setFile(null);
    setUploadResults(null);
  }

  const fileCount = previewFiles.length;
  const canUpload = step1Done && step2Done && step3Done && !uploading;

  return (
    <div className="flex gap-4 items-stretch min-h-0">

      {/* Panel 1 — Machine type */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col w-44 flex-shrink-0">
        <PanelHeader step={1} active={!step1Done} done={step1Done} title="Machine Type" />
        <div className="px-3 py-4 flex flex-col gap-2 flex-1">
          {MACHINE_TYPES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleMachineSelect(m.key)}
              className={[
                "rounded-xl border px-3 py-2.5 text-xs font-bold text-left transition-all duration-150 leading-snug",
                selectedMachine === m.key
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-outline-variant/20 bg-surface-container text-on-surface hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel 2 — 背番号 */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col w-48 flex-shrink-0">
        <PanelHeader
          step={2}
          active={step1Done && !step2Done}
          done={step2Done}
          title="背番号"
          sub={loading ? "Loading…" : step2Done ? `${selectedCodes.length} code${selectedCodes.length === 1 ? "" : "s"} selected` : "Select number + suffix"}
        />
        <div className="px-3 py-4 flex gap-3 flex-1">
          {/* Number column */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-1 px-1">#</p>
            {NUMBERS.map((n) => (
              <ToggleBtn key={n} label={n} selected={selectedNumbers.has(n)} onClick={() => toggleNumber(n)} mono />
            ))}
          </div>
          {/* Suffix column */}
          <div className="flex flex-col gap-1.5 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-1 px-1">Type</p>
            {SUFFIXES.map((s) => (
              <ToggleBtn key={s} label={s} selected={selectedSuffixes.has(s)} onClick={() => toggleSuffix(s)} mono className="w-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Panel 3 — File upload */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col flex-1 min-w-48">
        <PanelHeader step={3} active={step2Done && !step3Done} done={step3Done} title="Upload File" sub={file ? file.name : "Drop or click to browse"} />
        <div className="px-4 py-4 flex flex-col gap-3 flex-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileAccept(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer text-center transition-all duration-200 px-4 py-6",
              dragging ? "border-primary bg-primary/10"
                : file ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5",
            ].join(" ")}
          >
            <span className={`material-symbols-outlined ${file ? "text-emerald-500" : "text-on-surface-variant/50"}`} style={{ fontSize: 32 }}>
              {file ? "check_circle" : "upload_file"}
            </span>
            {file ? (
              <>
                <p className="text-xs font-bold text-on-surface break-all">{file.name}</p>
                <p className="text-[11px] text-on-surface-variant">{(file.size / 1024).toFixed(1)} KB</p>
                <p className="text-[11px] text-primary">click to replace</p>
              </>
            ) : (
              <p className="text-xs text-on-surface-variant">.pce files only</p>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pce" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFileAccept(e.target.files[0]); }} />
          {file && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 14 }}>warning</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">Filename will be replaced</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel 4 — Preview */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col flex-1 min-w-48">
        <PanelHeader step={4} active={step3Done && !uploadResults} done={!!uploadResults} title="Preview" sub={uploadResults ? "Upload complete" : fileCount ? `${fileCount} file${fileCount === 1 ? "" : "s"} to create` : "Waiting for selections"} />
        <div className="px-4 py-4 flex flex-col gap-2 flex-1">
          {uploadResults ? (
            <>
              <ul className="flex-1 space-y-1.5 overflow-y-auto">
                {uploadResults.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <span className="material-symbols-outlined text-emerald-500 flex-shrink-0" style={{ fontSize: 15 }}>check_circle</span>
                    <span className="font-mono text-xs font-bold text-on-surface truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleReset}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                New upload
              </button>
            </>
          ) : previewFiles.length > 0 ? (
            <>
              <ul className="flex-1 space-y-1.5 overflow-y-auto mb-2">
                {previewFiles.map((name) => (
                  <li key={name} className="flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container px-3 py-2">
                    <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 15 }}>description</span>
                    <span className="font-mono text-xs font-bold text-on-surface truncate">{name}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                {uploading
                  ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_upload</span>}
                {uploading ? "Creating…" : `Create ${fileCount} file${fileCount === 1 ? "" : "s"}`}
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-on-surface-variant text-center leading-relaxed">
                Complete steps 1–3<br />to see a preview
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
