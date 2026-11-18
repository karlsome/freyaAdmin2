import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { saveProcessDefectDefinition, translateJapaneseText } from "../services/api";

let _uidSeq = 0;
const nextUid = () => `row-${++_uidSeq}`;

function cloneItems(items = []) {
  return items.map((item) => ({ uid: nextUid(), jp: item.jp || "", en: item.en || "", builtIn: !!item.builtIn }));
}

function itemsChanged(left = [], right = []) {
  if (left.length !== right.length) return true;
  return left.some((item, index) => item.jp.trim() !== right[index].jp.trim() || item.en.trim() !== right[index].en.trim());
}

// Client-side mirror of the server checks so errors show before saving
function validateItems(items, isJa) {
  const seen = new Set();
  for (const item of items) {
    const jp = item.jp.trim();
    if (!jp) return isJa ? "不良名（日本語）を入力してください。" : "Defect name (JP) cannot be empty.";
    if (jp.startsWith("$") || jp.includes(".")) return isJa ? `「${jp}」に「$」や「.」は使えません。` : `"${jp}" may not start with "$" or contain ".".`;
    if (seen.has(jp)) return isJa ? `「${jp}」が重複しています。` : `Duplicate defect name: ${jp}`;
    seen.add(jp);
  }
  return "";
}

// Defect items for a fixed-field process (pressDB / slitDB / SRSDB).
// Built-in items are locked (JP is the DB field name); admins can add extra items and edit EN labels.
export default function FuryoFixedDefectsPanel({ processKey, process, items = [], updatedAt, updatedBy, canEdit = false, username = "", onSaved, onDirtyChange, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [draft, setDraft] = useState(() => cloneItems(items));
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState({});
  const [validationError, setValidationError] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const rowRefs = useRef({});

  const hasChanges = editMode && itemsChanged(draft, items);
  const rows = editMode ? draft : items;

  useEffect(() => {
    if (typeof onDirtyChange === "function") onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  function flash(type, message) {
    if (typeof onFlash === "function") onFlash({ type, message });
  }

  function startEdit() {
    setDraft(cloneItems(items));
    setValidationError("");
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft(cloneItems(items));
    setValidationError("");
    setTranslating({});
    setEditMode(false);
  }

  function updateItem(index, field, value) {
    setDraft((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    setValidationError("");
  }

  function addItem() {
    setDraft((current) => [...current, { uid: nextUid(), jp: "", en: "", builtIn: false }]);
  }

  function moveItem(from, to) {
    if (from === null || to === null || from === to) return;
    setDraft((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function removeItem(index) {
    setDraft((current) => current.filter((_, i) => i !== index));
    setValidationError("");
  }

  async function autoTranslate(index) {
    const item = draft[index];
    if (!item || item.builtIn || !item.jp.trim() || item.en.trim()) return;
    const { uid } = item;
    setTranslating((current) => ({ ...current, [uid]: true }));
    try {
      const translated = await translateJapaneseText(item.jp.trim());
      if (translated) {
        setDraft((current) => current.map((it) => (it.uid === uid && !it.en.trim() ? { ...it, en: translated } : it)));
      }
    } catch {
      // Translation is only a suggestion
    } finally {
      setTranslating((current) => ({ ...current, [uid]: false }));
    }
  }

  async function save() {
    if (!hasChanges) return;
    const message = validateItems(draft, isJa);
    if (message) {
      setValidationError(message);
      return;
    }
    setSaving(true);
    try {
      const payload = draft.map((item) => ({ jp: item.jp.trim(), en: item.en.trim() }));
      const result = await saveProcessDefectDefinition({ process: processKey, items: payload, username: username || "unknown" });
      if (typeof onSaved === "function") onSaved(processKey, result?.items || payload);
      setEditMode(false);
      setTranslating({});
      flash("success", isJa ? `${process?.labelJa}の不良項目を保存しました。` : `${process?.labelEn} defect items saved.`);
    } catch (saveError) {
      flash("error", saveError.message || (isJa ? "不良項目の保存に失敗しました。" : "Failed to save defect items."));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]";
  const lockedClass = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] cursor-not-allowed";
  const buttonBase = "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-primary/12 text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{process?.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {isJa ? process?.labelJa : process?.labelEn} <span className="font-mono text-xs font-medium text-[var(--text-muted)]">({processKey})</span>
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa ? "既定の不良項目に加えて、項目を追加できます。" : "Built-in defect items plus any items added here."}
            </p>
            {(updatedAt || updatedBy) && (
              <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">
                {isJa ? "最終更新:" : "Last updated"} {updatedAt ? new Date(updatedAt).toLocaleString(isJa ? "ja-JP" : "en-US") : ""}{updatedBy ? ` (${updatedBy})` : ""}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
            {rows.length} {isJa ? "不良項目" : "defect items"}
          </span>
          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
            {canEdit ? (editMode ? (isJa ? "編集中" : "Editing") : (isJa ? "編集可能" : "Editable")) : (isJa ? "閲覧専用" : "View only")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            <tr>
              {editMode && <th className="w-10 pl-4 pr-0 py-2.5" />}
              <th className="w-16 px-5 py-2.5">#</th>
              <th className="px-5 py-2.5">{isJa ? "日本語" : "Japanese"}</th>
              <th className="px-5 py-2.5">{isJa ? "英語" : "English"}</th>
              <th className="w-40 px-5 py-2.5">DB Field</th>
              {editMode && <th className="w-14 px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((item, index) => (
              <tr
                key={item.uid || `v-${item.jp}`}
                ref={(el) => { if (item.uid) rowRefs.current[item.uid] = el; }}
                onDragOver={editMode ? (event) => { event.preventDefault(); if (overIndex !== index) setOverIndex(index); } : undefined}
                onDrop={editMode ? (event) => { event.preventDefault(); moveItem(dragIndex, index); endDrag(); } : undefined}
                className={`hover:bg-[var(--surface-subtle)] ${dragIndex === index ? "opacity-40" : ""} ${
                  editMode && dragIndex !== null && overIndex === index && dragIndex !== index
                    ? (dragIndex < index ? "shadow-[inset_0_-2px_0_var(--freya-blue)]" : "shadow-[inset_0_2px_0_var(--freya-blue)]")
                    : ""
                }`}
              >
                {editMode && (
                  <td className="w-10 pl-4 pr-0 py-2.5">
                    <span
                      draggable
                      onDragStart={(event) => {
                        setDragIndex(index);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(index));
                        const row = rowRefs.current[item.uid];
                        if (row && event.dataTransfer.setDragImage) event.dataTransfer.setDragImage(row, 16, 16);
                      }}
                      onDragEnd={endDrag}
                      title={isJa ? "ドラッグして並べ替え" : "Drag to reorder"}
                      className="inline-flex cursor-grab items-center text-[var(--text-muted)] hover:text-[var(--text-primary)] active:cursor-grabbing"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu</span>
                    </span>
                  </td>
                )}
                <td className="px-5 py-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 font-mono text-[11px] font-bold text-primary">
                    {index + 1}
                  </span>
                </td>
                <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">
                  {editMode ? (
                    <input
                      type="text"
                      value={item.jp}
                      disabled={item.builtIn}
                      title={item.builtIn ? (isJa ? "既定項目の名前は変更できません" : "Built-in item names cannot be changed") : undefined}
                      onChange={(event) => updateItem(index, "jp", event.target.value)}
                      onBlur={() => autoTranslate(index)}
                      placeholder={isJa ? "日本語で入力..." : "Input Japanese..."}
                      className={item.builtIn ? lockedClass : inputClass}
                    />
                  ) : (
                    item.jp
                  )}
                </td>
                <td className="px-5 py-2.5 text-[var(--text-secondary)]">
                  {editMode ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={item.en}
                        onChange={(event) => updateItem(index, "en", event.target.value)}
                        placeholder={isJa ? "英語..." : "English..."}
                        className={`${inputClass} pr-8`}
                      />
                      {translating[item.uid] && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--freya-blue)]">
                          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    item.en
                  )}
                </td>
                <td className="px-5 py-2.5">
                  <code className="rounded-[4px] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">{item.jp.trim() || "—"}</code>
                </td>
                {editMode && (
                  <td className="px-3 py-2.5 text-right">
                    {item.builtIn ? (
                      <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }} title={isJa ? "既定項目" : "Built-in"}>lock</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-[6px] p-1 text-[var(--text-muted)] transition hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
                        title={isJa ? "削除" : "Remove"}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editMode && (
        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={addItem}
            className={`${buttonBase} border border-dashed border-[var(--freya-blue)] text-[var(--freya-blue)] hover:bg-primary/10`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            {isJa ? "不良項目を追加" : "Add defect item"}
          </button>
        </div>
      )}

      {validationError && (
        <div className="mx-5 mt-3 rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--status-danger)]">
          {validationError}
        </div>
      )}

      <div className="m-5 flex items-start gap-2 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
        <p>
          {isJa
            ? "既定項目（鍵マーク）は記録済みデータのフィールド名のため名前変更・削除はできません。追加した項目はまだタブレットに表示されず、記録されません。"
            : "Built-in items (lock icon) are field names in recorded data, so they can't be renamed or removed. Added items don't appear on the tablets yet and aren't recorded."}
        </p>
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          {editMode ? (
            <>
              <button type="button" onClick={cancelEdit} disabled={saving} className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]`}>
                {isJa ? "キャンセル" : "Cancel"}
              </button>
              <button type="button" onClick={save} disabled={!hasChanges || saving} className={`${buttonBase} bg-[var(--freya-blue)] text-white hover:opacity-90`}>
                <span className={`material-symbols-outlined ${saving ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>{saving ? "progress_activity" : "save"}</span>
                {saving ? (isJa ? "保存中..." : "Saving...") : (isJa ? "保存" : "Save")}
              </button>
            </>
          ) : (
            <button type="button" onClick={startEdit} className={`${buttonBase} border border-[var(--freya-blue)] text-[var(--freya-blue)] hover:bg-primary/10`}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
              {isJa ? "編集" : "Edit"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
