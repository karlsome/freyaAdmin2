import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { saveModelDefectOverride, saveProcessDefectDefinition } from "../services/api";
import { DEFECT_OTHER_ID, FURYO_SECTIONS, resolveDefectIds, withOtherLast } from "../utils/furyoKanri";

const inputClass =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]";
const buttonBase =
  "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const iconButton =
  "rounded-[6px] p-1 text-[var(--text-muted)] transition hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]";

function sameList(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function formatUpdated(updatedAt, updatedBy, isJa) {
  if (!updatedAt && !updatedBy) return "";
  const date = updatedAt ? new Date(updatedAt) : null;
  const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleString(isJa ? "ja-JP" : "en-US") : "";
  return `${isJa ? "最終更新:" : "Last updated"} ${when}${updatedBy ? ` (${updatedBy})` : ""}`;
}

// Dropdown of master items that can still be added (not deleted, not already listed, not その他)
function DefectPicker({ catalog, excludeIds, onPick, isJa }) {
  const exclude = new Set(excludeIds);
  const options = catalog
    .filter((item) => !item.deleted && item.id !== DEFECT_OTHER_ID && !exclude.has(item.id))
    .sort((a, b) => a.jp.localeCompare(b.jp, "ja"));

  return (
    <select
      value=""
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value);
      }}
      disabled={!options.length}
      className={`${inputClass} max-w-xs cursor-pointer`}
    >
      <option value="">
        {options.length
          ? (isJa ? "＋ マスタから不良を追加..." : "+ Add defect from master...")
          : (isJa ? "追加できる不良がありません" : "No more defects in master")}
      </option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.jp}{item.en ? ` / ${item.en}` : ""}
        </option>
      ))}
    </select>
  );
}

function SectionHeader({ icon, title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-primary/12 text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// ── Base list ────────────────────────────────────────────────────────────────
function BaseListCard({ processKey, catalogById, catalog, baseIds, baseMeta, canEdit, username, onSaved, onDirtyChange, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const process = FURYO_SECTIONS[processKey];

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(baseIds);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const rowRefs = useRef({});

  const visibleIds = (editMode ? draft : baseIds).filter((id) => id === DEFECT_OTHER_ID || (catalogById.get(id) && !catalogById.get(id).deleted));
  const rows = withOtherLast(visibleIds.filter((id) => id !== DEFECT_OTHER_ID));
  const dirty = editMode && !sameList(withOtherLast(draft), withOtherLast(baseIds));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function startEdit() {
    setDraft(withOtherLast(baseIds.filter((id) => id === DEFECT_OTHER_ID || (catalogById.get(id) && !catalogById.get(id).deleted))));
    setEditMode(true);
  }

  function move(from, to) {
    if (from === null || to === null || from === to) return;
    // その他 is pinned last: never move it or drop onto/after it
    const lastMovable = draft.filter((id) => id !== DEFECT_OTHER_ID).length - 1;
    if (draft[from] === DEFECT_OTHER_ID) return;
    const target = Math.min(to, lastMovable);
    setDraft((current) => {
      const next = current.filter((id) => id !== DEFECT_OTHER_ID);
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return withOtherLast(next);
    });
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveProcessDefectDefinition({ process: processKey, items: withOtherLast(draft), username });
      onSaved(result?.items || withOtherLast(draft), { updatedAt: result?.updatedAt || new Date().toISOString(), updatedBy: result?.updatedBy || username });
      setEditMode(false);
      onFlash({ type: "success", message: isJa ? `${process.labelJa}の基本リストを保存しました。` : `${process.labelEn} base list saved.` });
    } catch (error) {
      onFlash({ type: "error", message: error.message || (isJa ? "保存に失敗しました。" : "Save failed.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <SectionHeader
        icon={process.icon}
        title={`${isJa ? process.labelJa : process.labelEn} — ${isJa ? "基本リスト" : "Base list"}`}
        subtitle={(isJa ? "全モデル共通の不良項目。モデル別の違いは下で設定します。" : "Defects shown for every model. Per-model differences are set below.")
          + (formatUpdated(baseMeta?.updatedAt, baseMeta?.updatedBy, isJa) ? ` · ${formatUpdated(baseMeta?.updatedAt, baseMeta?.updatedBy, isJa)}` : "")}
      >
        <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
          {rows.length} {isJa ? "項目" : "items"}
        </span>
      </SectionHeader>

      <table className="w-full text-left text-xs">
        <thead className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          <tr>
            {editMode && <th className="w-10 py-2.5 pl-4 pr-0" />}
            <th className="w-16 px-5 py-2.5">#</th>
            <th className="px-5 py-2.5">{isJa ? "日本語" : "Japanese"}</th>
            <th className="px-5 py-2.5">{isJa ? "英語" : "English"}</th>
            {editMode && <th className="w-14 px-3 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((id, index) => {
            const item = catalogById.get(id);
            const isOther = id === DEFECT_OTHER_ID;
            return (
              <tr
                key={id}
                ref={(el) => { rowRefs.current[id] = el; }}
                onDragOver={editMode ? (event) => { event.preventDefault(); if (overIndex !== index) setOverIndex(index); } : undefined}
                onDrop={editMode ? (event) => { event.preventDefault(); move(dragIndex, index); setDragIndex(null); setOverIndex(null); } : undefined}
                className={`hover:bg-[var(--surface-subtle)] ${dragIndex === index ? "opacity-40" : ""} ${
                  editMode && dragIndex !== null && overIndex === index && dragIndex !== index && !isOther
                    ? (dragIndex < index ? "shadow-[inset_0_-2px_0_var(--freya-blue)]" : "shadow-[inset_0_2px_0_var(--freya-blue)]")
                    : ""
                }`}
              >
                {editMode && (
                  <td className="w-10 py-2.5 pl-4 pr-0">
                    {isOther ? (
                      <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }} title={isJa ? "その他は常に最後" : "その他 is always last"}>lock</span>
                    ) : (
                      <span
                        draggable
                        onDragStart={(event) => {
                          setDragIndex(index);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(index));
                          const row = rowRefs.current[id];
                          if (row && event.dataTransfer.setDragImage) event.dataTransfer.setDragImage(row, 16, 16);
                        }}
                        onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                        title={isJa ? "ドラッグして並べ替え" : "Drag to reorder"}
                        className="inline-flex cursor-grab items-center text-[var(--text-muted)] hover:text-[var(--text-primary)] active:cursor-grabbing"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu</span>
                      </span>
                    )}
                  </td>
                )}
                <td className="px-5 py-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 font-mono text-[11px] font-bold text-primary">{index + 1}</span>
                </td>
                <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">{item?.jp || id}</td>
                <td className="px-5 py-2.5 text-[var(--text-secondary)]">{item?.en || ""}</td>
                {editMode && (
                  <td className="px-3 py-2.5 text-right">
                    {!isOther && (
                      <button type="button" onClick={() => setDraft((current) => current.filter((value) => value !== id))} className={iconButton} title={isJa ? "リストから外す" : "Remove from list"}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {canEdit && (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            {editMode && (
              <DefectPicker
                catalog={catalog}
                excludeIds={draft}
                isJa={isJa}
                onPick={(id) => setDraft((current) => withOtherLast([...current.filter((value) => value !== DEFECT_OTHER_ID), id]))}
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            {editMode ? (
              <>
                <button type="button" onClick={() => setEditMode(false)} disabled={saving} className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]`}>
                  {isJa ? "キャンセル" : "Cancel"}
                </button>
                <button type="button" onClick={save} disabled={!dirty || saving} className={`${buttonBase} bg-[var(--freya-blue)] text-white hover:opacity-90`}>
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
        </div>
      )}
    </div>
  );
}

// ── Per-model differences ────────────────────────────────────────────────────
function ModelOverridesCard({ processKey, catalogById, catalog, baseIds, overrides, models, canEdit, username, onSaved, onDirtyChange, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [search, setSearch] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState([]);
  const [extras, setExtras] = useState([]);
  const [saving, setSaving] = useState(false);

  const overrideByModel = new Map(overrides.map((doc) => [doc.model, doc]));
  const current = overrideByModel.get(selectedModel) || null;
  const baseList = baseIds.filter((id) => id !== DEFECT_OTHER_ID && catalogById.get(id) && !catalogById.get(id).deleted);
  const dirty = editMode && (!sameList([...hidden].sort(), [...(current?.hidden || [])].sort()) || !sameList(extras, current?.extras || []));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const query = search.trim().toLowerCase();
  const modelRows = models
    .filter((model) => !query || model.toLowerCase().includes(query))
    .filter((model) => !onlyCustom || overrideByModel.has(model));

  function selectModel(model) {
    if (dirty && !window.confirm(isJa ? "保存されていない変更は破棄されます。続行しますか？" : "Unsaved changes will be lost. Continue?")) return;
    setSelectedModel(model);
    setEditMode(false);
  }

  function startEdit() {
    setHidden(current?.hidden || []);
    setExtras((current?.extras || []).filter((id) => catalogById.get(id) && !catalogById.get(id).deleted));
    setEditMode(true);
  }

  async function persist(nextHidden, nextExtras, successMessage) {
    setSaving(true);
    try {
      const result = await saveModelDefectOverride({ process: processKey, model: selectedModel, hidden: nextHidden, extras: nextExtras, username });
      onSaved(selectedModel, result?.removed ? null : {
        process: processKey,
        model: selectedModel,
        hidden: result?.hidden || nextHidden,
        extras: result?.extras || nextExtras,
        updatedAt: result?.updatedAt || new Date().toISOString(),
        updatedBy: result?.updatedBy || username,
      });
      setEditMode(false);
      onFlash({ type: "success", message: successMessage });
    } catch (error) {
      onFlash({ type: "error", message: error.message || (isJa ? "保存に失敗しました。" : "Save failed.") });
    } finally {
      setSaving(false);
    }
  }

  const viewOverride = editMode ? { hidden, extras } : current;
  const resolved = resolveDefectIds(baseIds, viewOverride, catalogById);
  const hiddenSet = new Set(viewOverride?.hidden || []);
  const extraIds = (viewOverride?.extras || []).filter((id) => catalogById.get(id) && !catalogById.get(id).deleted && !baseList.includes(id));

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <SectionHeader
        icon="tune"
        title={isJa ? "モデル別設定" : "Per-model settings"}
        subtitle={isJa ? "モデルごとに基本項目を非表示にしたり、専用の不良を追加できます（差分のみ保存）。" : "Hide base items or add model-specific defects (only the differences are stored)."}
      >
        <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
          {overrides.length} {isJa ? "モデル設定済" : "customized"}
        </span>
      </SectionHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex max-h-[min(60vh,640px)] flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <div className="space-y-2 border-b border-[var(--border)] p-3">
            <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isJa ? "モデルを検索..." : "Search models..."} className={inputClass} />
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <input type="checkbox" checked={onlyCustom} onChange={(event) => setOnlyCustom(event.target.checked)} />
              {isJa ? "設定済みのみ" : "Customized only"}
            </label>
          </div>
          <ul className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {modelRows.length === 0 && <li className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">{isJa ? "モデルが見つかりません" : "No models"}</li>}
            {modelRows.map((model) => {
              const doc = overrideByModel.get(model);
              const active = model === selectedModel;
              return (
                <li key={model}>
                  <button
                    type="button"
                    onClick={() => selectModel(model)}
                    className={`flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-xs transition ${
                      active ? "border-[var(--freya-blue)] bg-primary/10" : "border-transparent hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    <span className="flex-1 truncate font-mono font-medium text-[var(--text-primary)]">{model}</span>
                    {doc?.hidden?.length > 0 && <span className="font-mono text-[11px] text-[var(--status-danger)]">−{doc.hidden.length}</span>}
                    {doc?.extras?.length > 0 && <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">+{doc.extras.length}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-h-[18rem]">
          {!selectedModel ? (
            <div className="flex h-full min-h-[18rem] items-center justify-center px-6 text-center text-xs text-[var(--text-muted)]">
              {isJa ? "左からモデルを選択してください" : "Select a model on the left"}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
                <div>
                  <div className="font-mono text-base font-bold text-[var(--text-primary)]">{selectedModel}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {current ? formatUpdated(current.updatedAt, current.updatedBy, isJa) : (isJa ? "基本リストのまま" : "Uses the base list")}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {editMode ? (
                      <>
                        <button type="button" onClick={() => setEditMode(false)} disabled={saving} className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]`}>
                          {isJa ? "キャンセル" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => persist(hidden, extras, isJa ? `${selectedModel} の設定を保存しました。` : `${selectedModel} saved.`)}
                          disabled={!dirty || saving}
                          className={`${buttonBase} bg-[var(--freya-blue)] text-white hover:opacity-90`}
                        >
                          <span className={`material-symbols-outlined ${saving ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>{saving ? "progress_activity" : "save"}</span>
                          {isJa ? "保存" : "Save"}
                        </button>
                      </>
                    ) : (
                      <>
                        {current && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(isJa ? `${selectedModel} を基本リストに戻しますか？` : `Reset ${selectedModel} to the base list?`)) {
                                persist([], [], isJa ? `${selectedModel} を基本リストに戻しました。` : `${selectedModel} reset to base list.`);
                              }
                            }}
                            disabled={saving}
                            className={`${buttonBase} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                            {isJa ? "基本に戻す" : "Reset"}
                          </button>
                        )}
                        <button type="button" onClick={startEdit} className={`${buttonBase} border border-[var(--freya-blue)] text-[var(--freya-blue)] hover:bg-primary/10`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                          {isJa ? "編集" : "Edit"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid flex-1 gap-5 p-5 xl:grid-cols-2">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa ? "基本リストの項目" : "Base list items"}
                  </div>
                  <ul className="space-y-1.5">
                    {baseList.map((id) => {
                      const item = catalogById.get(id);
                      const isHidden = hiddenSet.has(id);
                      return (
                        <li key={id} className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs">
                          {editMode ? (
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={(event) => setHidden((value) => (event.target.checked ? value.filter((x) => x !== id) : [...value, id]))}
                              title={isJa ? "このモデルで表示" : "Show for this model"}
                            />
                          ) : (
                            <span className={`material-symbols-outlined ${isHidden ? "text-[var(--text-muted)]" : "text-emerald-600 dark:text-emerald-400"}`} style={{ fontSize: 16 }}>
                              {isHidden ? "visibility_off" : "check"}
                            </span>
                          )}
                          <span className={`flex-1 ${isHidden ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{item?.jp}</span>
                          <span className="text-[var(--text-muted)]">{item?.en}</span>
                        </li>
                      );
                    })}
                    {baseList.length === 0 && <li className="text-xs text-[var(--text-muted)]">{isJa ? "基本リストは空です" : "Base list is empty"}</li>}
                  </ul>

                  <div className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa ? "このモデルの追加項目" : "Extra defects for this model"}
                  </div>
                  <ul className="space-y-1.5">
                    {extraIds.map((id) => {
                      const item = catalogById.get(id);
                      return (
                        <li key={id} className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs">
                          <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>add</span>
                          <span className="flex-1 text-[var(--text-primary)]">{item?.jp}</span>
                          <span className="text-[var(--text-muted)]">{item?.en}</span>
                          {editMode && (
                            <button type="button" onClick={() => setExtras((value) => value.filter((x) => x !== id))} className={iconButton} title={isJa ? "削除" : "Remove"}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {extraIds.length === 0 && !editMode && <li className="text-xs text-[var(--text-muted)]">{isJa ? "なし" : "None"}</li>}
                  </ul>
                  {editMode && (
                    <div className="mt-2">
                      <DefectPicker catalog={catalog} excludeIds={[...baseList, ...extras]} isJa={isJa} onPick={(id) => setExtras((value) => [...value, id])} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa ? `タブレット表示（${resolved.length}項目）` : `Shown on tablet (${resolved.length})`}
                  </div>
                  <ol className="space-y-1.5">
                    {resolved.map((id, index) => (
                      <li key={id} className="flex items-center gap-2 rounded-[6px] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/12 font-mono text-[10px] font-bold text-primary">{index + 1}</span>
                        <span className="flex-1 text-[var(--text-primary)]">{catalogById.get(id)?.jp}</span>
                        <span className="text-[var(--text-muted)]">{catalogById.get(id)?.en}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Process view: base list + per-model differences, both picked from the defect master
export default function ProcessDefectPanel({
  processKey, catalog, catalogById, baseIds, baseMeta, overrides, models, canEdit, username,
  onBaseSaved, onOverrideSaved, onDirtyChange, onFlash,
}) {
  const [baseDirty, setBaseDirty] = useState(false);
  const [modelDirty, setModelDirty] = useState(false);

  useEffect(() => {
    if (typeof onDirtyChange === "function") onDirtyChange(baseDirty || modelDirty);
  }, [baseDirty, modelDirty, onDirtyChange]);

  const flash = (payload) => { if (typeof onFlash === "function") onFlash(payload); };

  return (
    <div className="space-y-6">
      <BaseListCard
        processKey={processKey}
        catalog={catalog}
        catalogById={catalogById}
        baseIds={baseIds}
        baseMeta={baseMeta}
        canEdit={canEdit}
        username={username}
        onSaved={onBaseSaved}
        onDirtyChange={setBaseDirty}
        onFlash={flash}
      />
      <ModelOverridesCard
        processKey={processKey}
        catalog={catalog}
        catalogById={catalogById}
        baseIds={baseIds}
        overrides={overrides}
        models={models}
        canEdit={canEdit}
        username={username}
        onSaved={onOverrideSaved}
        onDirtyChange={setModelDirty}
        onFlash={flash}
      />
    </div>
  );
}
