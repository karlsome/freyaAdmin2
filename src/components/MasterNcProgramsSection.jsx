// NC programs of one masterDB item (non-SCNA AOL cutters: OZNC.., NCC01).
// One card per machine type (heads + table length). Each card holds the item's PCE for that type and,
// optionally, versions for one machine (tolerances). Machine-type PCEs are uploaded only in the PCE Files tab;
// this section shows them (preview, download, history/restore) and handles machine-specific versions.
// The tablet sends: machine version > type program. Files live in Google Drive "freyaAdmin pce 2"; the points (JSON) in Mongo.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { readStoredAuthUser } from "../utils/auth";
import { parsePce } from "../utils/pceParser";
import ScnaNcProgramPreview from "./scna/ScnaNcProgramPreview";
import {
  fetchNcHistory,
  fetchNcMachineTypes,
  fetchNcProgramPoints,
  fetchNcPrograms,
  ncProgramPceUrl,
  removeNcProgram,
  restoreNcProgram,
  uploadNcProgram,
} from "../services/ncApi";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function currentUser() {
  return readStoredAuthUser()?.username || "admin";
}

const btn =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface px-2.5 py-1 text-[11px] font-semibold text-on-surface hover:bg-surface-variant/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary =
  "inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-on-primary hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

function Icon({ name, size = 14 }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;
}

async function downloadJson(program) {
  const data = await fetchNcProgramPoints(program._id);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${program.machine ? `${program.背番号}_${program.machine}` : `${program.背番号}_${program.machineType}`}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// The item detail modal sits at z-[100], above ScnaNcPreviewModal (z-50), so the preview has its own layer here.
function PreviewModal({ preview, isJa, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[88vh] w-full max-w-6xl flex-col rounded-2xl border border-outline-variant/30 bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-on-surface">{preview.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-outline">{preview.subtitle}</p>
          </div>
          <button type="button" className="text-xs font-semibold text-outline" onClick={onClose}>{isJa ? "閉じる ✕" : "Close ✕"}</button>
        </div>
        <div className="min-h-0 flex-1 p-4">
          {preview.loading
            ? <p className="text-xs text-outline">{isJa ? "読み込み中…" : "Loading…"}</p>
            : <ScnaNcProgramPreview points={preview.points} height="100%" />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// One uploaded version: name, points, who/when + Preview / PCE / JSON (+ extra buttons)
function ProgramRow({ program, isJa, onPreview, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
          <span className="text-emerald-600"><Icon name="check_circle" size={16} /></span>
          <span className="truncate" title={isJa ? "アップロードした元のファイル名" : "Name of the uploaded file"}>
            {program.fileName || program.driveName}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-outline">
          <span className="font-mono" title={isJa ? "Google Drive「freyaAdmin pce 2」での保存名（機械への送信に使用）" : "Saved name in Google Drive 'freyaAdmin pce 2' (used to send to the machine)"}>
            Drive: {program.drivePath || program.driveName}
          </span>
          {" · "}{(program.pointCount || 0).toLocaleString()} {isJa ? "ポイント" : "points"} · {fmtDate(program.uploadedAt)} · {program.uploadedBy}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={btn} onClick={() => onPreview(program)}>
          <Icon name="visibility" /> {isJa ? "プレビュー" : "Preview"}
        </button>
        <a className={btn} href={ncProgramPceUrl(program._id)} download
          title={isJa ? `元のファイル名でダウンロード（${program.fileName || ""}）` : `Download with its original name (${program.fileName || ""})`}>
          <Icon name="download" /> PCE
        </a>
        <button type="button" className={btn} onClick={() => downloadJson(program).catch((e) => alert(e.message))}>
          <Icon name="data_object" /> JSON
        </button>
        {children}
      </div>
    </div>
  );
}

// Preview of a freshly chosen file before it is saved
function ConfirmUploadModal({ pending, isJa, busy, onCancel, onConfirm }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-outline-variant/30 bg-surface shadow-2xl">
        <div className="border-b border-outline-variant/30 px-5 py-3">
          <p className="text-sm font-bold text-on-surface">
            {isJa ? "この内容でアップロードしますか？" : "Upload this program?"}
          </p>
          <p className="mt-0.5 text-xs text-outline">
            {pending.file.name} → {pending.targetLabel} · {pending.parsed.pointCount.toLocaleString()} {isJa ? "ポイント" : "points"}
            {pending.replaces && (
              <span className="ml-1 font-semibold text-amber-600">
                {isJa ? "（現在のファイルは履歴に移動します）" : "(the current file moves to history)"}
              </span>
            )}
          </p>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <ScnaNcProgramPreview points={pending.parsed.points} height="100%" />
        </div>
        <div className="flex justify-end gap-2 border-t border-outline-variant/30 px-5 py-3">
          <button type="button" className={btn} onClick={onCancel} disabled={busy}>
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button type="button" className={btnPrimary} onClick={onConfirm} disabled={busy}>
            <Icon name="cloud_upload" /> {busy ? (isJa ? "アップロード中…" : "Uploading…") : (isJa ? "アップロード" : "Upload")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function HistoryModal({ slot, isJa, onClose, onRestored, onPreview }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  useEffect(() => {
    fetchNcHistory(slot).then(setRows).catch((e) => setError(e.message));
  }, [slot]);
  async function restore(row) {
    if (!window.confirm(isJa ? "このバージョンを使用中に戻しますか？" : "Make this version the active one again?")) return;
    setBusyId(row._id);
    try {
      await restoreNcProgram(row._id, currentUser());
      onRestored();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl border border-outline-variant/30 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-5 py-3">
          <p className="text-sm font-bold text-on-surface">
            {isJa ? "履歴" : "History"} · {slot.label}
          </p>
          <button type="button" className="text-xs font-semibold text-outline" onClick={onClose}>{isJa ? "閉じる ✕" : "Close ✕"}</button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-auto p-5">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!rows && !error && <p className="text-xs text-outline">{isJa ? "読み込み中…" : "Loading…"}</p>}
          {rows && rows.length === 0 && <p className="text-xs text-outline">{isJa ? "履歴はありません" : "No versions yet"}</p>}
          {rows && rows.map((row) => (
            <div key={row._id} className={`rounded-xl border p-3 ${row.isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-outline-variant/30"}`}>
              <ProgramRow program={row} isJa={isJa} onPreview={onPreview}>
                {row.isActive ? (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{isJa ? "使用中" : "Active"}</span>
                ) : (
                  <button type="button" className={btn} disabled={busyId === row._id} onClick={() => restore(row)}>
                    <Icon name="restore" /> {isJa ? "これに戻す" : "Restore"}
                  </button>
                )}
              </ProgramRow>
              {!row.isActive && (
                <p className="mt-1 text-[10px] text-outline">
                  {row.removedAt
                    ? `${isJa ? "削除" : "Removed"} ${fmtDate(row.removedAt)}`
                    : row.replacedAt ? `${isJa ? "置き換え" : "Replaced"} ${fmtDate(row.replacedAt)}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MasterNcProgramsSection({ record, onLeave }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  // Machine-type PCEs are uploaded only in the PCE Files tab: close the item modal and go there
  function goToPceFiles() {
    onLeave?.();
    navigate("/masterDB?tab=pceFiles");
  }
  const isJa = language === "ja";
  const sebanggo = String(record?.背番号 || "").trim();
  const factory = String(record?.工場 || "").trim();

  const [types, setTypes] = useState(null);
  const [allFactories, setAllFactories] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(null);       // { file, parsed, machineType, machine, targetLabel, replaces }
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);       // { title, subtitle, points, loading }
  const [history, setHistory] = useState(null);       // { sebanggo, machineType, machine, label }
  const [addFor, setAddFor] = useState({});           // machineType -> chosen machine for a new machine version
  const fileInput = useRef(null);
  const target = useRef(null);

  const load = useCallback(async () => {
    if (!sebanggo) return;
    setError("");
    try {
      const [t, p] = await Promise.all([fetchNcMachineTypes(factory), fetchNcPrograms(sebanggo)]);
      setTypes(t.types || []);
      setAllFactories(!!t.allFactories);
      setPrograms(p);
    } catch (e) {
      setError(e.message);
      setTypes([]);
    }
  }, [sebanggo, factory]);

  useEffect(() => { load(); }, [load]);

  function typeLabel(t) {
    return isJa ? `${t.heads}ヘッド · ${t.tableLength}mm` : `${t.heads} head${t.heads === 1 ? "" : "s"} · ${t.tableLength}mm`;
  }

  function pickFile(machineType, machine, label, replaces) {
    target.current = { machineType, machine: machine || null, targetLabel: label, replaces };
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.click();
    }
  }

  async function onFileChosen(f) {
    if (!f || !target.current) return;
    if (!f.name.toLowerCase().endsWith(".pce")) {
      setMessage({ type: "error", text: isJa ? ".pce ファイルのみ受け付け可能です。" : "Only .pce files are accepted." });
      return;
    }
    try {
      const parsed = parsePce(await f.arrayBuffer());
      setPending({ ...target.current, file: f, parsed });
    } catch (e) {
      console.error(`[NC programs] Could not read ${f.name}`, e);
      setMessage({ type: "error", text: `${f.name}: ${e.message}` });
    }
  }

  async function confirmUpload() {
    if (!pending) return;
    setUploading(true);
    try {
      await uploadNcProgram({
        sebanggo,
        machineType: pending.machineType,
        machine: pending.machine,
        fileName: pending.file.name,
        pceBase64: await toBase64(pending.file),
        points: pending.parsed.points,
        layers: pending.parsed.layers,
        uploadedBy: currentUser(),
      });
      setMessage({
        type: "success",
        text: isJa ? `${pending.targetLabel} にアップロードしました` : `Uploaded to ${pending.targetLabel}`,
      });
      setPending(null);
      setAddFor((a) => ({ ...a, [pending.machineType]: "" }));
      await load();
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setUploading(false);
    }
  }

  async function remove(program) {
    if (!window.confirm(isJa
      ? `${program.machine} 専用バージョンを削除しますか？（履歴に残ります。以降は機種共通のファイルを送信します）`
      : `Remove the ${program.machine} version? (It stays in history; the machine-type file is sent instead.)`)) return;
    try {
      await removeNcProgram(program._id, currentUser());
      await load();
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    }
  }

  async function openPreview(program) {
    setPreview({ title: program.driveName || program.fileName, subtitle: `${sebanggo} · ${program.machine || program.machineType}`, points: [], loading: true });
    try {
      const data = await fetchNcProgramPoints(program._id);
      setPreview((p) => p && { ...p, points: data.points || [], loading: false });
    } catch (e) {
      setPreview(null);
      setMessage({ type: "error", text: e.message });
    }
  }

  if (!sebanggo) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-outline">
        <span className="text-primary"><Icon name="precision_manufacturing" size={16} /></span>
        <span>{isJa ? "NCプログラム（AOL機）" : "NC programs (AOL machines)"}</span>
      </div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <p className="min-w-0 flex-1 text-xs text-outline">
        {isJa
          ? "機種ごとのPCEは「PCE Files」タブからアップロードします。特定の機械だけ違うPCEが必要な場合は、ここで「この機械専用」を追加できます。"
          : "PCEs for each machine type are uploaded in the PCE Files tab. If one machine needs a different PCE (tolerances), add a machine-specific version here."}
      </p>
        <button type="button" className={btnPrimary} onClick={goToPceFiles}>
          <Icon name="upload_file" /> {isJa ? "PCE Filesタブでアップロード" : "Upload in PCE Files tab"}
          <Icon name="arrow_forward" />
        </button>
      </div>

      <input ref={fileInput} type="file" accept=".pce" className="hidden" onChange={(e) => onFileChosen(e.target.files?.[0])} />

      {message && (
        <div className={`mb-3 flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${message.type === "error" ? "border-red-500/30 bg-red-500/5 text-red-700" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      {types === null && <p className="text-xs text-outline">{isJa ? "読み込み中…" : "Loading…"}</p>}
      {types && types.length === 0 && !error && (
        <p className="text-xs text-outline">{isJa ? "AOL機が見つかりません" : "No AOL machines found"}</p>
      )}
      {allFactories && types && types.length > 0 && (
        <p className="mb-3 text-[11px] text-amber-700">
          {isJa ? `${factory || "この工場"} にAOL機がないため、全工場のAOL機を表示しています。` : `No AOL machines in ${factory || "this factory"}; showing all AOL machines.`}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(types || []).map((t) => {
          const typeProg = programs.find((p) => p.machineType === t.machineType && !p.machine);
          const machineProgs = programs.filter((p) => p.machineType === t.machineType && p.machine);
          const withVersion = new Set(machineProgs.map((p) => p.machine));
          const free = t.machines.map((m) => m.name).filter((n) => !withVersion.has(n));
          const label = `${sebanggo} · ${typeLabel(t)}`;
          return (
            <div key={t.machineType} className="rounded-xl border border-outline-variant/30 bg-surface-variant/10 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-on-surface">{typeLabel(t)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.machines.map((m) => (
                      <span key={m.name} className="rounded-md border border-outline-variant/30 bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-on-surface-variant">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" className={btn} onClick={() => setHistory({ sebanggo, machineType: t.machineType, machine: null, label })}>
                  <Icon name="history" /> {isJa ? "履歴" : "History"}
                </button>
              </div>

              <div className="mt-3 rounded-lg border border-outline-variant/25 bg-surface p-3">
                {typeProg ? (
                  <ProgramRow program={typeProg} isJa={isJa} onPreview={openPreview} />
                ) : (
                  <div className="flex items-start gap-1.5 text-xs font-semibold text-amber-700">
                    <Icon name="warning" size={16} />
                    <span>
                      {isJa
                        ? "プログラム未登録：この機種には送信できません。"
                        : "No program yet: this item cannot be sent to these machines."}{" "}
                      <button type="button" className="font-bold text-primary underline underline-offset-2 cursor-pointer" onClick={goToPceFiles}>
                        {isJa ? "PCE Filesタブでアップロード →" : "Upload in the PCE Files tab →"}
                      </button>
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-bold text-outline">
                  {isJa ? "この機械専用（公差など）" : "Machine-specific versions (tolerances)"}
                </div>
                <div className="space-y-2">
                  {machineProgs.map((p) => (
                    <div key={p._id} className="rounded-lg border border-outline-variant/25 bg-surface p-3">
                      <div className="mb-1 font-mono text-[11px] font-bold text-primary">{p.machine}</div>
                      <ProgramRow program={p} isJa={isJa} onPreview={openPreview}>
                        <button type="button" className={btn} onClick={() => pickFile(t.machineType, p.machine, `${sebanggo} · ${p.machine}`, true)}>
                          <Icon name="upload" /> {isJa ? "差し替え" : "Replace"}
                        </button>
                        <button type="button" className={btn} onClick={() => setHistory({ sebanggo, machineType: t.machineType, machine: p.machine, label: `${sebanggo} · ${p.machine}` })}>
                          <Icon name="history" />
                        </button>
                        <button type="button" className={`${btn} text-red-600`} onClick={() => remove(p)} title={isJa ? "削除" : "Remove"}>
                          <Icon name="close" />
                        </button>
                      </ProgramRow>
                    </div>
                  ))}
                  {free.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-[11px] text-on-surface"
                        value={addFor[t.machineType] || ""}
                        onChange={(e) => setAddFor((a) => ({ ...a, [t.machineType]: e.target.value }))}
                      >
                        <option value="">{isJa ? "機械を選択…" : "Choose a machine…"}</option>
                        {free.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button
                        type="button"
                        className={btn}
                        disabled={!addFor[t.machineType]}
                        onClick={() => pickFile(t.machineType, addFor[t.machineType], `${sebanggo} · ${addFor[t.machineType]}`, false)}
                      >
                        <Icon name="add" /> {isJa ? "この機械専用を追加" : "Add version for this machine"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pending && (
        <ConfirmUploadModal pending={pending} isJa={isJa} busy={uploading} onCancel={() => setPending(null)} onConfirm={confirmUpload} />
      )}
      {preview && (
        <PreviewModal preview={preview} isJa={isJa} onClose={() => setPreview(null)} />
      )}
      {history && (
        <HistoryModal slot={history} isJa={isJa} onClose={() => setHistory(null)} onRestored={load} onPreview={openPreview} />
      )}
    </div>
  );
}
