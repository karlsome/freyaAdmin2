import { useEffect, useRef, useState } from "react";
import ModalShell from "./ModalShell";
import { useLanguage } from "../contexts/LanguageContext";
import { getAuthUser } from "../utils/masterDB";
import { getMdbImportJob, startMdbImportApply, startMdbImportPreview } from "../services/api";

function Row({ label, a, c, u, n }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="px-3 py-2 text-xs font-semibold">{label}</td>
      <td className="px-3 py-2 text-xs font-mono text-right">{a}</td>
      <td className="px-3 py-2 text-xs font-mono text-right">{c}</td>
      <td className="px-3 py-2 text-xs font-mono text-right">{u ?? "—"}</td>
      <td className="px-3 py-2 text-xs font-mono text-right">{n ?? "—"}</td>
    </tr>
  );
}

export default function MdbImportModal({ open, onClose, onImported }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | previewing | preview | applying | done | error
  const [stage, setStage] = useState("");
  const [summary, setSummary] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [previewJobId, setPreviewJobId] = useState(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (open) {
      cancelled.current = false;
      setFile(null); setPhase("idle"); setStage(""); setSummary(null); setResult(null); setError(""); setPreviewJobId(null);
    } else cancelled.current = true;
  }, [open]);

  async function poll(jobId) {
    for (;;) {
      if (cancelled.current) return null;
      const job = await getMdbImportJob(jobId);
      setStage(job.stage || "");
      if (job.status === "done") return job;
      if (job.status === "error") throw new Error(job.error || "Import failed");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  async function handlePreview() {
    if (!file) return;
    setPhase("previewing"); setError("");
    try {
      const { jobId } = await startMdbImportPreview(file, getAuthUser()?.username);
      const job = await poll(jobId);
      if (!job) return;
      setPreviewJobId(jobId); setSummary(job.summary); setPhase("preview");
    } catch (e) { setError(e.message); setPhase("error"); }
  }

  async function handleApply() {
    setPhase("applying"); setError("");
    try {
      const { jobId } = await startMdbImportApply(previewJobId, getAuthUser()?.username);
      const job = await poll(jobId);
      if (!job) return;
      setResult(job.result); setSummary(job.summary); setPhase("done");
      onImported?.();
    } catch (e) { setError(e.message); setPhase("error"); }
  }

  const busy = phase === "previewing" || phase === "applying";
  const t = (ja, en) => (isJa ? ja : en);
  const total = summary ? summary.material.add + summary.material.change + summary.bom.add + summary.bom.change + summary.process.add + summary.process.change : 0;

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button type="button" disabled={busy} onClick={onClose} className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
        {phase === "done" ? t("閉じる", "Close") : t("キャンセル", "Cancel")}
      </button>
      {(phase === "idle" || phase === "error") && (
        <button type="button" disabled={!file} onClick={handlePreview} className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {t("プレビュー", "Preview changes")}
        </button>
      )}
      {phase === "preview" && (
        <button type="button" disabled={total === 0} onClick={handleApply} className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {t(`${total.toLocaleString()} 件を適用`, `Apply ${total.toLocaleString()} changes`)}
        </button>
      )}
    </div>
  );

  return (
    <ModalShell open={open} onClose={busy ? undefined : onClose} title={t("MDBインポート", "Import MDB")} subtitle={t("マスタ管理N-2.mdb を正として材料・BOM・工程マスタを更新します", "Updates materials, BOM and process masters using マスタ管理N-2.mdb as the source of truth")} footer={footer} maxWidth="max-w-2xl">
      <div className="space-y-4 p-1">
        {(phase === "idle" || phase === "error") && (
          <div>
            <input type="file" accept=".mdb" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-xs" />
            {file && <p className="mt-2 text-xs text-[var(--text-muted)]">{file.name} ({(file.size / 1048576).toFixed(1)} MB)</p>}
            <p className="mt-2 text-xs text-[var(--text-muted)]">{t("まず変更内容をプレビューします。この時点では何も書き込まれません。", "Changes are previewed first — nothing is written yet.")}</p>
          </div>
        )}
        {busy && (
          <div className="flex items-center gap-3 text-xs">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
            <span>{stage || t("処理中…", "Working…")}</span>
          </div>
        )}
        {phase === "error" && <div className="rounded-[6px] border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        {summary && (phase === "preview" || phase === "done") && (
          <div className="overflow-hidden rounded-[6px] border border-[var(--border)]">
            <table className="w-full">
              <thead className="bg-[var(--surface-subtle)]">
                <tr className="text-xs text-[var(--text-muted)]">
                  <th className="px-3 py-2 text-left">{t("コレクション", "Collection")}</th>
                  <th className="px-3 py-2 text-right">{t("追加", "New")}</th>
                  <th className="px-3 py-2 text-right">{t("更新", "Changed")}</th>
                  <th className="px-3 py-2 text-right">{t("変更なし", "Unchanged")}</th>
                  <th className="px-3 py-2 text-right">{t("MDBに無い", "Not in MDB")}</th>
                </tr>
              </thead>
              <tbody>
                <Row label="materialMasterDB3" a={summary.material.add} c={summary.material.change} u={summary.material.unchanged} n={summary.material.notInMdb} />
                <Row label="bomMasterDB" a={summary.bom.add} c={summary.bom.change} u={summary.bom.unchanged} n={summary.bom.notInMdb} />
                <Row label="processMasterDB" a={summary.process.add} c={summary.process.change} u={summary.process.unchanged} />
              </tbody>
            </table>
          </div>
        )}
        {summary && phase === "preview" && (
          <>
            <p className="text-xs text-[var(--text-muted)]">
              {t("MDBに無い既存データは変更されません。カスタム項目（imageURL等）は保持されます。", "Existing records missing from the MDB are left untouched. Custom fields (e.g. imageURL) are preserved.")}
              {" "}{t(`BOMの未解決構成品: ${summary.bom.missingComponentLinks}`, `Unresolved BOM components: ${summary.bom.missingComponentLinks}`)}
            </p>
            {summary.samples.material.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold">{t("材料サンプル", "Material samples")}</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono">
                  {summary.samples.material.map((s) => (
                    <li key={s.品番 + s.kind}>{s.kind === "added" ? "＋" : "～"} {s.品番} {s.fields ? `(${s.fields.join(", ")})` : ""}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        {phase === "done" && result && (
          <div className="rounded-[6px] border border-green-300 bg-green-50 p-3 text-xs text-green-800">
            {t("インポート完了", "Import complete")}: materials +{result.material.upserted} / ~{result.material.modified}, BOM +{result.bom.upserted} / ~{result.bom.modified} ({t("未解決", "unresolved")} {result.bom.missingComponentLinks}), {t("工程", "process")} +{result.process.upserted} / ~{result.process.modified}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
