import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { detachDefectSet, saveDefectSet } from "../services/api";
import { DEFECT_OTHER_ID, FURYO_SECTIONS } from "../utils/furyoKanri";
import ModalShell from "./ModalShell";

const inputClass =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]";
const buttonBase =
  "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const iconButton =
  "rounded-[6px] p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40";

function processLabel(key, isJa) {
  return (isJa ? FURYO_SECTIONS[key]?.labelJa : FURYO_SECTIONS[key]?.labelEn) || key;
}

// ── Set editor: left = defect master, right = the set (drag to reorder) ─────
function SetEditorModal({ draft, setDraft, catalog, catalogById, saving, readOnly, onSave, onClose, isJa }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [search, setSearch] = useState("");
  if (!draft) return null;

  const items = draft.items.filter((id) => catalogById.get(id) && !catalogById.get(id).deleted);
  const inSet = new Set(items);
  const query = search.trim().toLowerCase();
  const masterRows = catalog
    .filter((item) => !item.deleted && item.id !== DEFECT_OTHER_ID)
    .filter((item) => !query || `${item.jp} ${item.en || ""}`.toLowerCase().includes(query));

  const toggle = (id) => setDraft((current) => ({
    ...current,
    items: current.items.includes(id) ? current.items.filter((value) => value !== id) : [...current.items, id],
  }));

  function move(from, to) {
    if (from === null || to === null || from === to) return;
    setDraft((current) => {
      const next = current.items.filter((id) => catalogById.get(id) && !catalogById.get(id).deleted);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, items: next };
    });
  }

  const columnHead = "mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";

  return (
    <ModalShell
      open
      onClose={onClose}
      eyebrow={isJa ? "不良セット" : "Defect set"}
      title={readOnly ? draft.name : draft.id ? (isJa ? "セットを編集" : "Edit set") : (isJa ? "新しいセット" : "New set")}
      subtitle={readOnly
        ? (isJa ? "閲覧のみ" : "View only")
        : (isJa ? "左のマスタからクリックで追加し、右側でドラッグして並べ替えます。その他は自動で最後に付きます。" : "Click defects in the master (left) to add them, drag on the right to reorder. その他 is always added last.")}
      maxWidth="max-w-5xl"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]`}>
            {readOnly ? (isJa ? "閉じる" : "Close") : (isJa ? "キャンセル" : "Cancel")}
          </button>
          {!readOnly && (
            <button type="button" onClick={onSave} disabled={saving || !draft.name.trim()} className={`${buttonBase} bg-[var(--freya-blue)] text-white hover:opacity-90`}>
              <span className={`material-symbols-outlined ${saving ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>{saving ? "progress_activity" : "save"}</span>
              {isJa ? "保存" : "Save"}
            </button>
          )}
        </div>
      )}
    >
      <div className="space-y-4 p-5">
        {!readOnly && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "セット名" : "Set name"}</label>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder={isJa ? "例: 生地系" : "e.g. Fabric defects"}
              className={inputClass}
              autoFocus={!draft.id}
            />
          </div>
        )}

        <div className={`grid gap-4 ${readOnly ? "" : "md:grid-cols-2"}`}>
          {!readOnly && (
            <div className="flex min-h-0 flex-col rounded-[8px] border border-[var(--border)] p-3">
              <div className={columnHead}>
                <span>{isJa ? "不良マスタ" : "Defect master"}</span>
                <span className="font-mono normal-case">{masterRows.length}</span>
              </div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isJa ? "検索..." : "Search..."}
                className={`${inputClass} mb-2`}
              />
              <ul className="h-[45vh] space-y-1 overflow-y-auto">
                {masterRows.map((item) => {
                  const picked = inSet.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        className={`flex w-full items-center gap-2 rounded-[6px] border px-2 py-1.5 text-left text-xs transition ${
                          picked
                            ? "border-[var(--freya-blue)]/40 bg-primary/10"
                            : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                        }`}
                        title={picked ? (isJa ? "クリックで外す" : "Click to remove") : (isJa ? "クリックで追加" : "Click to add")}
                      >
                        <span className={`material-symbols-outlined ${picked ? "text-primary" : "text-[var(--text-muted)]"}`} style={{ fontSize: 18 }}>
                          {picked ? "check_circle" : "add_circle"}
                        </span>
                        <span className="flex-1 font-medium text-[var(--text-primary)]">{item.jp}</span>
                        <span className="text-[var(--text-muted)]">{item.en}</span>
                      </button>
                    </li>
                  );
                })}
                {masterRows.length === 0 && <li className="py-6 text-center text-xs text-[var(--text-muted)]">{isJa ? "該当なし" : "No matches"}</li>}
              </ul>
            </div>
          )}

          <div className="flex min-h-0 flex-col rounded-[8px] border border-[var(--border)] p-3">
            <div className={columnHead}>
              <span>{isJa ? "このセット" : "This set"}</span>
              <span className="font-mono normal-case">{items.length} + {isJa ? "その他" : "その他"}</span>
            </div>
            <ul className={`${readOnly ? "max-h-[55vh]" : "h-[calc(45vh+2.5rem)]"} space-y-1.5 overflow-y-auto`}>
              {items.length === 0 && !readOnly && (
                <li className="rounded-[6px] border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                  {isJa ? "左のマスタから不良をクリックして追加" : "Click defects on the left to add them"}
                </li>
              )}
              {items.map((id, index) => (
                <li
                  key={id}
                  onDragOver={readOnly ? undefined : (event) => { event.preventDefault(); if (overIndex !== index) setOverIndex(index); }}
                  onDrop={readOnly ? undefined : (event) => { event.preventDefault(); move(dragIndex, index); setDragIndex(null); setOverIndex(null); }}
                  className={`flex items-center gap-2 rounded-[6px] border border-[var(--border)] px-2 py-1.5 text-xs ${dragIndex === index ? "opacity-40" : ""} ${
                    dragIndex !== null && overIndex === index && dragIndex !== index
                      ? (dragIndex < index ? "shadow-[inset_0_-2px_0_var(--freya-blue)]" : "shadow-[inset_0_2px_0_var(--freya-blue)]")
                      : ""
                  }`}
                >
                  {!readOnly && (
                    <span
                      draggable
                      onDragStart={(event) => { setDragIndex(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }}
                      onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                      className="inline-flex cursor-grab items-center text-[var(--text-muted)] active:cursor-grabbing"
                      title={isJa ? "ドラッグして並べ替え" : "Drag to reorder"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu</span>
                    </span>
                  )}
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/12 px-1 font-mono text-[10px] font-bold text-primary">{index + 1}</span>
                  <span className="flex-1 font-medium text-[var(--text-primary)]">{catalogById.get(id)?.jp}</span>
                  <span className="text-[var(--text-muted)]">{catalogById.get(id)?.en}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className={`${iconButton} hover:bg-error/10 hover:text-error`}
                      title={isJa ? "外す" : "Remove"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </li>
              ))}
              <li className="flex items-center gap-2 rounded-[6px] bg-[var(--surface-subtle)] px-2 py-1.5 text-xs text-[var(--text-muted)]">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                <span className="flex-1">{catalogById.get(DEFECT_OTHER_ID)?.jp || "その他"}</span>
                <span>{isJa ? "常に最後" : "Always last"}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── "Used by" pop-up: shown when deleting a set that models still use ───────
function SetUsageModal({ set, usedBy, busy, onDetach, onDetachAll, onDelete, onClose, isJa }) {
  if (!set) return null;
  return (
    <ModalShell
      open
      onClose={onClose}
      eyebrow={isJa ? "セットを削除" : "Delete set"}
      title={set.name}
      subtitle={usedBy.length
        ? (isJa ? `${usedBy.length}件のモデルで使用中です。外してから削除してください（外したモデルは他のソース、なければ基本リストに戻ります）。` : `Used by ${usedBy.length} model(s). Remove it from them first (they fall back to their other sources, or the base list).`)
        : (isJa ? "このセットを使用しているモデルはありません。削除できます。" : "No model uses this set. It can be deleted.")}
      maxWidth="max-w-2xl"
      footer={(
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDetachAll}
            disabled={busy || !usedBy.length}
            className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link_off</span>
            {isJa ? "すべてのモデルから外す" : "Remove from all models"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy || usedBy.length > 0}
            className={`${buttonBase} bg-error text-white hover:opacity-90`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            {isJa ? "セットを削除" : "Delete set"}
          </button>
        </div>
      )}
    >
      <div className="max-h-[50vh] overflow-y-auto p-5">
        {usedBy.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">{isJa ? "使用中のモデルはありません" : "No models use this set"}</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              <tr>
                <th className="w-12 py-2 pr-3">#</th>
                <th className="py-2 pr-3">{isJa ? "工程" : "Process"}</th>
                <th className="py-2 pr-3">{isJa ? "モデル" : "Model"}</th>
                <th className="w-24 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {usedBy.map((target, index) => (
                <tr key={`${target.process}-${target.model}`}>
                  <td className="py-2 pr-3 font-mono text-[var(--text-muted)]">{index + 1}</td>
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">{processLabel(target.process, isJa)}</td>
                  <td className="py-2 pr-3 font-mono font-medium text-[var(--text-primary)]">{target.model}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDetach(target)}
                      disabled={busy}
                      className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:border-error hover:text-error`}
                    >
                      {isJa ? "外す" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModalShell>
  );
}

// 不良セット section of the master: named groups of defects that models can use as list sources
export default function DefectSetsSection({ sets = [], catalog = [], catalogById, overrides = [], canEdit = false, username = "", onSetSaved, onSetDeleted, onOverridesUpdated, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [draft, setDraft] = useState(null);
  const openSet = (set) => setDraft({ id: set.id, name: set.name, items: [...(set.items || [])] });
  const [saving, setSaving] = useState(false);
  const [usageSetId, setUsageSetId] = useState("");
  const [busy, setBusy] = useState(false);

  const usageOf = (setId) => overrides
    .filter((doc) => (doc.sources || []).includes(setId))
    .map((doc) => ({ process: doc.process, model: doc.model }))
    .sort((a, b) => a.process.localeCompare(b.process) || a.model.localeCompare(b.model, "ja"));
  const usageSet = sets.find((set) => set.id === usageSetId) || null;

  function flash(type, message) {
    if (typeof onFlash === "function") onFlash({ type, message });
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveDefectSet({
        action: draft.id ? "update" : "create",
        id: draft.id,
        name: draft.name,
        items: draft.items.filter((id) => catalogById.get(id) && !catalogById.get(id).deleted),
        username,
      });
      if (result?.set) onSetSaved(result.set);
      flash("success", isJa ? `セット「${draft.name.trim()}」を保存しました。` : `Saved set ${draft.name.trim()}.`);
      setDraft(null);
    } catch (error) {
      flash("error", error.message || (isJa ? "保存に失敗しました。" : "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  async function detach(payload) {
    setBusy(true);
    try {
      const result = await detachDefectSet({ setId: usageSetId, username, ...payload });
      onOverridesUpdated(result?.updated || []);
    } catch (error) {
      flash("error", error.message || (isJa ? "更新に失敗しました。" : "Update failed."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSet() {
    const set = usageSet;
    if (!set || !window.confirm(isJa ? `セット「${set.name}」を削除しますか？` : `Delete set "${set.name}"?`)) return;
    setBusy(true);
    try {
      await saveDefectSet({ action: "delete", id: set.id, username });
      onSetDeleted(set.id);
      setUsageSetId("");
      flash("success", isJa ? `セット「${set.name}」を削除しました。` : `Deleted set ${set.name}.`);
    } catch (error) {
      flash("error", error.message || (isJa ? "削除に失敗しました。" : "Delete failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-primary/12 text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>category</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{isJa ? "不良セット" : "Defect sets"}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa ? "不良のグループ。全工程で共通に使え、モデル別設定で基本リストの代わり・組み合わせとして選べます。" : "Groups of defects, shared across processes. Models can use them instead of, or together with, the base list."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
            {sets.length} {isJa ? "セット" : "sets"}
          </span>
          {canEdit && (
            <button type="button" onClick={() => setDraft({ id: "", name: "", items: [] })} className={`${buttonBase} bg-[var(--freya-blue)] text-white hover:opacity-90`}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              {isJa ? "新しいセット" : "New set"}
            </button>
          )}
        </div>
      </div>

      <table className="w-full text-left text-xs">
        <thead className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          <tr>
            <th className="w-16 px-5 py-2.5">#</th>
            <th className="px-5 py-2.5">{isJa ? "セット名" : "Name"}</th>
            <th className="px-5 py-2.5">{isJa ? "不良" : "Defects"}</th>
            <th className="w-32 px-5 py-2.5">{isJa ? "使用モデル" : "Used by"}</th>
            {canEdit && <th className="w-24 px-5 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {sets.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 5 : 4} className="px-5 py-8 text-center text-[var(--text-muted)]">
                {isJa ? "セットはまだありません" : "No sets yet"}
              </td>
            </tr>
          )}
          {sets.map((set, index) => {
            const items = (set.items || []).filter((id) => catalogById.get(id) && !catalogById.get(id).deleted);
            const used = usageOf(set.id);
            return (
              <tr
                key={set.id}
                onClick={() => openSet(set)}
                className="cursor-pointer align-top hover:bg-[var(--surface-subtle)]"
                title={canEdit ? (isJa ? "クリックで編集" : "Click to edit") : (isJa ? "クリックで表示" : "Click to view")}
              >
                <td className="px-5 py-2.5">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/12 px-1.5 font-mono text-[11px] font-bold text-primary">{index + 1}</span>
                </td>
                <td className="px-5 py-2.5 font-semibold text-[var(--text-primary)]">
                  {set.name}
                  <div className="font-mono text-[11px] font-normal text-[var(--text-muted)]">{items.length + 1}{isJa ? "項目" : " items"}</div>
                </td>
                <td className="px-5 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {items.map((id) => (
                      <span key={id} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-px text-[11px] text-[var(--text-secondary)]">
                        {catalogById.get(id)?.jp}
                      </span>
                    ))}
                    <span className="rounded-[4px] border border-dashed border-[var(--border)] px-1.5 py-px text-[11px] text-[var(--text-muted)]">{catalogById.get(DEFECT_OTHER_ID)?.jp || "その他"}</span>
                  </div>
                </td>
                <td className="px-5 py-2.5">
                  <button
                    type="button"
                    onClick={(event) => { if (!used.length) return; event.stopPropagation(); setUsageSetId(set.id); }}
                    className={`font-mono text-xs ${used.length ? "text-[var(--freya-blue)] hover:underline" : "text-[var(--text-muted)]"}`}
                  >
                    {used.length} {isJa ? "モデル" : "models"}
                  </button>
                </td>
                {canEdit && (
                  <td className="px-5 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openSet(set); }} className={iconButton} title={isJa ? "編集" : "Edit"}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setUsageSetId(set.id); }}
                        className={`${iconButton} hover:bg-error/10 hover:text-error`}
                        title={isJa ? "削除" : "Delete"}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <SetEditorModal
        key={draft ? draft.id || "new" : "closed"}
        readOnly={!canEdit}
        draft={draft}
        setDraft={setDraft}
        catalog={catalog}
        catalogById={catalogById}
        saving={saving}
        onSave={save}
        onClose={() => !saving && setDraft(null)}
        isJa={isJa}
      />
      <SetUsageModal
        set={usageSet}
        usedBy={usageSet ? usageOf(usageSet.id) : []}
        busy={busy || !canEdit}
        onDetach={(target) => detach({ targets: [target] })}
        onDetachAll={() => {
          if (window.confirm(isJa ? "すべてのモデルからこのセットを外しますか？" : "Remove this set from every model?")) detach({ all: true });
        }}
        onDelete={deleteSet}
        onClose={() => !busy && setUsageSetId("")}
        isJa={isJa}
      />
    </div>
  );
}
