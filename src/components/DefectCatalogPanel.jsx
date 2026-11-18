import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { saveDefectCatalogItem, translateJapaneseText } from "../services/api";
import { DEFECT_OTHER_ID, FURYO_PROCESS_KEYS, FURYO_SECTIONS, withOtherLast } from "../utils/furyoKanri";

const inputClass =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]";
const buttonBase =
  "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const iconButton =
  "rounded-[6px] p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40";

// 不良マスタ: every defect across products. Process lists pick from here, so names stay uniform.
// usage: Map<id, processKey[]> of base lists that use the item (for delete warnings / chips).
// baseLists: { processKey: { items: [id] } } (list order); overrides: per-model docs (for "model only" items)
export default function DefectCatalogPanel({ catalog = [], usage = new Map(), baseLists = {}, overrides = [], sets = [], canEdit = false, username = "", onChanged, onDirtyChange, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [newJp, setNewJp] = useState("");
  const [newEn, setNewEn] = useState("");
  const [translatingNew, setTranslatingNew] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editJp, setEditJp] = useState("");
  const [editEn, setEditEn] = useState("");
  const [busyId, setBusyId] = useState("");
  const [view, setView] = useState("process"); // "process" = grouped by process, "all" = every defect once
  const [sort, setSort] = useState({ key: "order", dir: 1 });
  const [collapsed, setCollapsed] = useState({});

  const editingItem = catalog.find((item) => item.id === editingId);
  const dirty = !!(newJp.trim() || newEn.trim())
    || (!!editingItem && (editJp.trim() !== editingItem.jp || editEn.trim() !== (editingItem.en || "")));

  useEffect(() => {
    if (typeof onDirtyChange === "function") onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const query = search.trim().toLowerCase();
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const matches = (item) => (showDeleted || !item.deleted)
    && (!query || item.jp.toLowerCase().includes(query) || (item.en || "").toLowerCase().includes(query));

  // Sort inside a group; その他 always stays last. "order" = process list order (or master order in 全件).
  function sortItems(items, orderOf) {
    const { key, dir } = sort;
    return [...items].sort((a, b) => {
      if (a.id === DEFECT_OTHER_ID) return 1;
      if (b.id === DEFECT_OTHER_ID) return -1;
      let diff = 0;
      if (key === "jp") diff = a.jp.localeCompare(b.jp, "ja");
      else if (key === "en") diff = (a.en || "").localeCompare(b.en || "", "en");
      else if (key === "used") diff = (usage.get(a.id) || []).length - (usage.get(b.id) || []).length;
      else diff = orderOf(a) - orderOf(b);
      return diff * dir || a.jp.localeCompare(b.jp, "ja");
    });
  }

  const groups = [];
  if (view === "process") {
    const inBase = new Set();
    FURYO_PROCESS_KEYS.forEach((key) => {
      const ids = withOtherLast((baseLists[key]?.items || []).filter((id) => id !== DEFECT_OTHER_ID));
      ids.forEach((id) => inBase.add(id));
      const items = ids.map((id) => catalogById.get(id)).filter((item) => item && matches(item));
      groups.push({ key, label: isJa ? FURYO_SECTIONS[key].labelJa : FURYO_SECTIONS[key].labelEn, icon: FURYO_SECTIONS[key].icon, items: sortItems(items, (item) => ids.indexOf(item.id)) });
    });
    const extraIds = new Set([...overrides.flatMap((doc) => doc.extras || []), ...sets.flatMap((set) => set.items || [])]);
    const rest = catalog.filter((item) => !inBase.has(item.id) && matches(item));
    const masterOrder = (item) => catalog.indexOf(item);
    groups.push({
      key: "modelOnly",
      label: isJa ? "セット・モデル別のみ" : "Sets / model extras only",
      icon: "tune",
      items: sortItems(rest.filter((item) => extraIds.has(item.id)), masterOrder),
    });
    groups.push({
      key: "unused",
      label: isJa ? "未使用" : "Not used",
      icon: "inventory_2",
      items: sortItems(rest.filter((item) => !extraIds.has(item.id)), masterOrder),
    });
  } else {
    groups.push({ key: "all", label: "", items: sortItems(catalog.filter(matches), (item) => catalog.indexOf(item)) });
  }
  const visibleGroups = groups.filter((group) => group.key === "all" || group.items.length > 0 || FURYO_PROCESS_KEYS.includes(group.key));
  const rowCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  function toggleSort(key) {
    setSort((current) => (current.key === key ? { key, dir: -current.dir } : { key, dir: 1 }));
  }

  const activeCount = catalog.filter((item) => !item.deleted).length;
  const deletedCount = catalog.length - activeCount;

  function flash(type, message) {
    if (typeof onFlash === "function") onFlash({ type, message });
  }

  async function run(id, payload, successMessage) {
    setBusyId(id);
    try {
      const result = await saveDefectCatalogItem({ ...payload, username: username || "unknown" });
      if (typeof onChanged === "function" && result?.item) onChanged(result.item);
      flash("success", successMessage);
      return true;
    } catch (error) {
      flash("error", error.message || (isJa ? "保存に失敗しました。" : "Save failed."));
      return false;
    } finally {
      setBusyId("");
    }
  }

  async function suggestEnglish(jp, currentEn, setEn, setBusy) {
    if (!jp.trim() || currentEn.trim()) return;
    setBusy(true);
    try {
      const translated = await translateJapaneseText(jp.trim());
      if (translated) setEn((current) => (current.trim() ? current : translated));
    } catch {
      // Translation is only a suggestion
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!newJp.trim()) return;
    const ok = await run("__new__", { action: "create", jp: newJp, en: newEn }, isJa ? `「${newJp.trim()}」を追加しました。` : `Added ${newJp.trim()}.`);
    if (ok) {
      setNewJp("");
      setNewEn("");
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditJp(item.jp);
    setEditEn(item.en || "");
  }

  async function saveEdit() {
    const ok = await run(editingId, { action: "update", id: editingId, jp: editJp, en: editEn }, isJa ? "保存しました。" : "Saved.");
    if (ok) setEditingId("");
  }

  async function handleDelete(item) {
    const used = usage.get(item.id) || [];
    const usedText = used.map((key) => (isJa ? FURYO_SECTIONS[key]?.labelJa : FURYO_SECTIONS[key]?.labelEn) || key).join(", ");
    const message = used.length
      ? (isJa
        ? `「${item.jp}」は ${usedText} のリストで使用中です。削除するとタブレットに表示されなくなります（過去データは保持）。削除しますか？`
        : `"${item.jp}" is used in ${usedText}. Deleting hides it from tablets (history is kept). Delete?`)
      : (isJa ? `「${item.jp}」を削除しますか？（過去データは保持されます）` : `Delete "${item.jp}"? (History is kept.)`);
    if (!window.confirm(message)) return;
    const ok = await run(item.id, { action: "delete", id: item.id }, isJa ? `「${item.jp}」を削除しました。` : `Deleted ${item.jp}.`);
    if (ok) setEditingId("");
  }

  async function handleRestore(item) {
    await run(item.id, { action: "restore", id: item.id }, isJa ? `「${item.jp}」を復元しました。` : `Restored ${item.jp}.`);
  }

  function renderRow(item, index, groupKey) {
    const editing = item.id === editingId;
    const used = usage.get(item.id) || [];
    const inSets = sets.filter((set) => (set.items || []).includes(item.id));
    const isOther = item.id === DEFECT_OTHER_ID;
    return (
      <tr key={`${groupKey}-${item.id}`} className={`hover:bg-[var(--surface-subtle)] ${item.deleted ? "opacity-50" : ""}`}>
        <td className="px-5 py-2.5">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/12 px-1.5 font-mono text-[11px] font-bold text-primary">{index + 1}</span>
        </td>
        <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">
          {editing && !isOther ? (
            <input type="text" value={editJp} onChange={(event) => setEditJp(event.target.value)} className={inputClass} />
          ) : (
            <span className={item.deleted ? "line-through" : ""}>{item.jp}</span>
          )}
        </td>
        <td className="px-5 py-2.5 text-[var(--text-secondary)]">
          {editing ? (
            <input type="text" value={editEn} onChange={(event) => setEditEn(event.target.value)} className={inputClass} />
          ) : (
            item.en
          )}
        </td>
        <td className="px-5 py-2.5">
          {isOther ? (
            <span className="text-[11px] text-[var(--text-muted)]">{isJa ? "全工程（固定）" : "All processes (fixed)"}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {used.map((key) => (
                <span key={key} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-px text-[10px] font-semibold text-[var(--text-secondary)]">
                  {isJa ? FURYO_SECTIONS[key]?.labelJa : FURYO_SECTIONS[key]?.labelEn}
                </span>
              ))}
              {inSets.map((set) => (
                <span key={set.id} className="inline-flex items-center gap-0.5 rounded-[4px] border border-[var(--freya-blue)]/30 bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary" title={isJa ? "不良セット" : "Defect set"}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>category</span>
                  {set.name}
                </span>
              ))}
            </div>
          )}
        </td>
        {canEdit && (
          <td className="px-5 py-2.5 text-right">
            {editing ? (
              <div className="inline-flex gap-1">
                {!isOther && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={busyId === item.id}
                    className={`${iconButton} mr-2 hover:bg-error/10 hover:text-error`}
                    title={isJa ? "削除" : "Delete"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                )}
                <button type="button" onClick={() => setEditingId("")} className={iconButton} title={isJa ? "キャンセル" : "Cancel"}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
                <button type="button" onClick={saveEdit} disabled={busyId === item.id || (!isOther && !editJp.trim())} className={`${iconButton} text-[var(--freya-blue)]`} title={isJa ? "保存" : "Save"}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                </button>
              </div>
            ) : item.deleted ? (
              <button type="button" onClick={() => handleRestore(item)} disabled={busyId === item.id} className={iconButton} title={isJa ? "復元" : "Restore"}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restore_from_trash</span>
              </button>
            ) : (
              <button type="button" onClick={() => startEdit(item)} disabled={!!editingId} className={iconButton} title={isJa ? "編集" : "Edit"}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
              </button>
            )}
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-primary/12 text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{FURYO_SECTIONS.master.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{isJa ? FURYO_SECTIONS.master.labelJa : FURYO_SECTIONS.master.labelEn}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa ? FURYO_SECTIONS.master.descriptionJa : FURYO_SECTIONS.master.descriptionEn}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {[
              { key: "process", ja: "工程別", en: "By process" },
              { key: "all", ja: "全件", en: "All" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setView(option.key)}
                className={`rounded-[4px] px-2.5 py-1 text-xs font-semibold transition ${
                  view === option.key ? "bg-[var(--freya-blue)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                {isJa ? option.ja : option.en}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isJa ? "不良を検索..." : "Search defects..."}
              className={`${inputClass} w-52 pl-8`}
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />
            {isJa ? `削除済みを表示 (${deletedCount})` : `Show deleted (${deletedCount})`}
          </label>
          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
            {activeCount} {isJa ? "項目" : "items"}
          </span>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={handleCreate} className="grid gap-3 border-b border-[var(--border)] px-5 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
          <input
            type="text"
            value={newJp}
            onChange={(event) => setNewJp(event.target.value)}
            onBlur={() => suggestEnglish(newJp, newEn, setNewEn, setTranslatingNew)}
            placeholder={isJa ? "新しい不良名（日本語）" : "New defect name (Japanese)"}
            className={inputClass}
          />
          <div className="relative">
            <input
              type="text"
              value={newEn}
              onChange={(event) => setNewEn(event.target.value)}
              placeholder={isJa ? "英語" : "English"}
              className={`${inputClass} pr-8`}
            />
            {translatingNew && (
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--freya-blue)]" style={{ fontSize: 16 }}>progress_activity</span>
            )}
          </div>
          <button type="submit" disabled={!newJp.trim() || busyId === "__new__"} className={`${buttonBase} bg-[var(--freya-blue)] text-white hover:opacity-90`}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            {isJa ? "マスタに追加" : "Add to master"}
          </button>
        </form>
      )}

      <div className="max-h-[min(64vh,720px)] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-[2] border-b border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            <tr>
              {[
                { key: "order", label: "#", className: "w-16" },
                { key: "jp", label: isJa ? "日本語" : "Japanese" },
                { key: "en", label: isJa ? "英語" : "English" },
                { key: "used", label: isJa ? "使用工程" : "Used in" },
              ].map((col) => (
                <th key={col.key} className={`px-5 py-2.5 ${col.className || ""}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-0.5 uppercase tracking-[0.04em] hover:text-[var(--text-primary)] ${sort.key === col.key ? "text-[var(--text-primary)]" : ""}`}
                    title={isJa ? "クリックで並べ替え" : "Click to sort"}
                  >
                    {col.label}
                    <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: sort.key === col.key ? 1 : 0.35 }}>
                      {sort.key === col.key && sort.dir < 0 ? "arrow_downward" : "arrow_upward"}
                    </span>
                  </button>
                </th>
              ))}
              {canEdit && <th className="w-28 px-5 py-2.5" />}
            </tr>
          </thead>
          {rowCount === 0 && (
            <tbody>
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-5 py-8 text-center text-[var(--text-muted)]">
                  {isJa ? "該当する不良がありません" : "No defects found"}
                </td>
              </tr>
            </tbody>
          )}
          {rowCount > 0 && visibleGroups.map((group) => {
            const isCollapsed = !!collapsed[group.key];
            return (
              <tbody key={group.key} className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
                {group.key !== "all" && (
                  <tr className="bg-[var(--surface-subtle)]">
                    <td colSpan={canEdit ? 5 : 4} className="px-5 py-2">
                      <button
                        type="button"
                        onClick={() => setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))}
                        className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                      >
                        <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>{isCollapsed ? "chevron_right" : "expand_more"}</span>
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{group.icon}</span>
                        {group.label}
                        {FURYO_PROCESS_KEYS.includes(group.key) && <span className="font-mono text-[11px] font-normal text-[var(--text-muted)]">({group.key})</span>}
                        <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-px font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                          {group.items.length}{isJa ? "項目" : " items"}
                        </span>
                      </button>
                    </td>
                  </tr>
                )}
                {!isCollapsed && group.items.map((item, index) => renderRow(item, index, group.key))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
