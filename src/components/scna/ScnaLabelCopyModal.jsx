import { createPortal } from "react-dom";
import { useState } from "react";
import { duplicateScnaLabelLayout } from "../../services/scnaApi";
import { readStoredAuthUser } from "../../utils/auth";
import { LABEL_PROCESSES, LABEL_PROCESS_NAMES, layoutProcesses } from "./scnaLabelUtils";

const inputCls = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs";
const btnCls = "rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-40";
const primaryBtn = "rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50";

// Copy a layout into other processes. The copy is an independent layout: editing it later never changes the original.
export default function ScnaLabelCopyModal({ doc, process, t, onClose, onCopied, onFlash }) {
  const isJa = t("a", "b") === "b";
  const inLayout = layoutProcesses(doc);
  const [targets, setTargets] = useState([]);
  const [name, setName] = useState("");
  const [copyBindings, setCopyBindings] = useState(false);
  const [busy, setBusy] = useState(false);

  const label = (p) => LABEL_PROCESS_NAMES[p][isJa ? "ja" : "en"];
  const toggle = (p) => setTargets((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  async function submit() {
    setBusy(true);
    try {
      const res = await duplicateScnaLabelLayout(doc.layoutId, {
        processes: targets,
        name: name.trim() || undefined,
        copyBindings,
        fromProcess: process,
        username: readStoredAuthUser()?.username || "admin",
      });
      onFlash?.({
        type: "success",
        message: copyBindings
          ? t(`Copied as "${res.name}" and bound ${res.bound} items`, `「${res.name}」としてコピーし、${res.bound}件のアイテムに割り当てました`)
          : t(`Copied as "${res.name}"`, `「${res.name}」としてコピーしました`),
      });
      onCopied?.();
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md space-y-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
        <h3 className="text-sm font-bold">{t("Copy to process", "工程にコピー")} — {doc.name}</h3>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {t("Makes a separate copy of this layout for the processes you tick. Changing the copy later does not change this layout.",
            "選んだ工程用にこのレイアウトの独立したコピーを作成します。後でコピーを編集しても元のレイアウトは変わりません。")}
        </p>
        <div className="flex flex-wrap gap-2">
          {LABEL_PROCESSES.map((p) => (
            <label key={p} className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-xs">
              <input type="checkbox" checked={targets.includes(p)} onChange={() => toggle(p)} />
              {label(p)}
              {inLayout.includes(p) && <span className="text-[10px] text-[var(--text-muted)]">({t("has it", "あり")})</span>}
            </label>
          ))}
        </div>
        <input className={inputCls} value={name} placeholder={t("Name for the copy (optional)", "コピーの名前（任意）")} onChange={(e) => setName(e.target.value)} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={copyBindings} onChange={(e) => setCopyBindings(e.target.checked)} />
          {t(`Also assign the same items (from ${label(process)})`, `同じアイテムも割り当てる（${label(process)}から）`)}
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnCls} onClick={onClose}>{t("Cancel", "キャンセル")}</button>
          <button type="button" className={primaryBtn} disabled={busy || !targets.length} onClick={submit}>{busy ? t("Copying…", "コピー中…") : t("Copy", "コピー")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
