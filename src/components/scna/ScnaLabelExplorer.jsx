import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteScnaLabelLayout,
  fetchScnaLabelItems,
  updateScnaLabelLayout,
} from "../../services/scnaApi";
import { readStoredAuthUser } from "../../utils/auth";
import ScnaLabelItemSearchModal from "./ScnaLabelItemSearchModal";
import ScnaLabelLayoutDetailModal from "./ScnaLabelLayoutDetailModal";
import ScnaLabelCopyModal from "./ScnaLabelCopyModal";
import { itemsForProcess } from "./scnaLabelUtils";
import { LayoutPreview } from "./ScnaLabelThumb";

const inputCls = "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs";
const btnCls = "rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-40";
const primaryBtn = "rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50";
const VIEW_KEY = "scnaLabelExplorerView";

const fmtDate = (v) => (v ? String(v).slice(0, 10) : "—");

function readView() {
  try { return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; }
}

// Card / list gallery of saved layouts. Thumbnails come from Firebase (saved with the layout).
export default function ScnaLabelExplorer({ layouts, process, initialLayoutId, t, onEdit, onNew, onChanged, onFlash }) {
  const [view, setView] = useState(readView);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [detail, setDetail] = useState(null); // { id, assign }
  const [findOpen, setFindOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [copyDoc, setCopyDoc] = useState(null);
  const [rawItems, setRawItems] = useState([]);

  const loadItems = useCallback(async () => {
    try {
      setRawItems(await fetchScnaLabelItems());
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    }
  }, [onFlash]);

  useEffect(() => {
    let alive = true;
    fetchScnaLabelItems()
      .then((rows) => { if (alive) setRawItems(rows); })
      .catch((err) => onFlash?.({ type: "error", message: err.message }));
    return () => { alive = false; };
  }, [onFlash]);

  function changeView(v) {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience only */ }
  }

  const items = useMemo(() => itemsForProcess(rawItems, process), [rawItems, process]);

  const counts = useMemo(() => {
    const c = {};
    items.forEach((i) => (i.layoutIds || []).forEach((id) => { c[id] = (c[id] || 0) + 1; }));
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = layouts.filter((l) => {
      if (q && !`${l.name} ${l.layoutId}`.toLowerCase().includes(q)) return false;
      if (status === "default") return !!l.isDefault;
      if (status === "inuse") return (counts[l.layoutId] || 0) > 0;
      if (status === "unassigned") return (counts[l.layoutId] || 0) === 0;
      return true;
    });
    const by = {
      name: (a, b) => String(a.name).localeCompare(String(b.name), "ja"),
      nameDesc: (a, b) => String(b.name).localeCompare(String(a.name), "ja"),
      items: (a, b) => (counts[b.layoutId] || 0) - (counts[a.layoutId] || 0),
      updated: (a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
    }[sort];
    return [...list].sort(by);
  }, [layouts, search, status, sort, counts]);

  const detailDoc = detail ? layouts.find((l) => l.layoutId === detail.id) : null;
  const changed = () => { loadItems(); onChanged?.(); };

  async function makeDefault(doc) {
    try {
      await updateScnaLabelLayout(doc.layoutId, { name: doc.name, isDefault: true, layout: doc.layout, username: readStoredAuthUser()?.username || "admin" });
      onFlash?.({ type: "success", message: t("Default layout updated", "デフォルトレイアウトを更新しました") });
      onChanged?.();
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    }
  }

  async function remove(doc) {
    const n = counts[doc.layoutId] || 0;
    const msg = n
      ? t(`Delete "${doc.name}"? It will be removed from ${n} items.`, `「${doc.name}」を削除しますか？${n}件のアイテムから外されます。`)
      : t(`Delete layout "${doc.name}"?`, `レイアウト「${doc.name}」を削除しますか？`);
    if (!window.confirm(msg)) return;
    try {
      await deleteScnaLabelLayout(doc.layoutId);
      onFlash?.({ type: "success", message: t("Layout deleted", "レイアウトを削除しました") });
      changed();
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    }
  }

  const idChip = (doc) => (
    <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">{doc.layoutId}</span>
  );
  const defaultChip = (doc) => doc.isDefault && (
    <span className="rounded bg-[var(--freya-blue)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--freya-blue)]">{t("Default", "デフォルト")}</span>
  );

  function actions(doc) {
    return (
      <div className="relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={btnCls} onClick={() => onEdit?.(doc)}>✎ {t("Edit", "編集")}</button>
        <button type="button" className={btnCls} onClick={() => setCopyDoc(doc)}>⧉ {t("Copy to process…", "工程にコピー…")}</button>
        <button type="button" className={btnCls} aria-label="More" onClick={() => setMenuFor(menuFor === doc.layoutId ? null : doc.layoutId)}>⋯</button>
        {menuFor === doc.layoutId && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] py-1 text-xs shadow-lg">
              <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-subtle)]" onClick={() => { setMenuFor(null); setDetail({ id: doc.layoutId, assign: true }); }}>{t("Assign items…", "アイテムを割り当て…")}</button>
              <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-subtle)]" onClick={() => { setMenuFor(null); setDetail({ id: doc.layoutId, assign: false }); }}>{t("View assigned items", "割り当て済みアイテムを表示")}</button>
              {!doc.isDefault && (
                <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-subtle)]" onClick={() => { setMenuFor(null); makeDefault(doc); }}>{t("Set as default", "デフォルトに設定")}</button>
              )}
              <button type="button" className="block w-full px-3 py-1.5 text-left text-[var(--status-danger,#dc2626)] hover:bg-[var(--surface-subtle)]" onClick={() => { setMenuFor(null); remove(doc); }}>{t("Delete", "削除")}</button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{t("Label Layout Explorer", "ラベルレイアウトエクスプローラー")}</h3>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {t("Layouts are per process. Create, edit, preview and assign them to SCNA items; an item can have several layouts in a process and the operator picks one on the tablet.",
              "レイアウトは工程ごとに管理します。作成・編集・プレビュー・アイテムへの割り当てを行います。1つの工程で複数のレイアウトを割り当てられ、タブレットで選択します。")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{t(`${layouts.length} layouts`, `${layouts.length}件`)}</span>
          <div className="flex overflow-hidden rounded-[6px] border border-[var(--border)]">
            {[["grid", "▦", t("Grid", "グリッド")], ["list", "☰", t("List", "リスト")]].map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                className={`px-3 py-1.5 text-xs font-semibold ${view === key ? "bg-[var(--freya-blue)] text-white" : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <button type="button" className={btnCls} onClick={() => setFindOpen(true)}>🔍 {t("Find item", "アイテム検索")}</button>
          <button type="button" className={primaryBtn} onClick={onNew}>+ {t("New layout", "新規レイアウト")}</button>
        </div>
      </div>

      <div className="freya-card flex flex-wrap items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <input className={`${inputCls} min-w-[220px] flex-1`} value={search} placeholder={t("Search layout name or ID…", "レイアウト名・IDで検索…")} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          {t("Status", "状態")}
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t("All", "すべて")}</option>
            <option value="default">{t("Default", "デフォルト")}</option>
            <option value="inuse">{t("In use", "使用中")}</option>
            <option value="unassigned">{t("No items assigned", "未割当")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          {t("Sort by", "並び替え")}
          <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">{t("Name (A-Z)", "名前 (A-Z)")}</option>
            <option value="nameDesc">{t("Name (Z-A)", "名前 (Z-A)")}</option>
            <option value="items">{t("Most items", "アイテム数")}</option>
            <option value="updated">{t("Recently updated", "更新日")}</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-muted)]">
          {layouts.length === 0 ? t("No saved layouts yet. Create one with “New layout”.", "保存済みレイアウトはありません。「新規レイアウト」から作成してください。") : t("No layouts match.", "該当するレイアウトがありません。")}
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((doc) => (
            <div
              key={doc.layoutId}
              onClick={() => setDetail({ id: doc.layoutId, assign: false })}
              className={`freya-card cursor-pointer rounded-[10px] border bg-[var(--surface)] p-3 transition hover:shadow-md ${doc.layoutId === initialLayoutId ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)]" : "border-[var(--border)]"}`}
            >
              <div className="flex h-[170px] items-center justify-center rounded-[8px] bg-[var(--surface-subtle)] p-2">
                <LayoutPreview doc={doc} className="max-h-full max-w-full rounded-[4px] border border-[var(--border)] shadow-sm" />
              </div>
              <h4 className="mt-3 truncate text-sm font-bold text-[var(--text-primary)]">{doc.name}</h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">{idChip(doc)}{defaultChip(doc)}</div>
              <dl className="mt-2 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
                <div>{t("Assigned items", "割り当てアイテム")}: <b className="text-[var(--text-primary)]">{counts[doc.layoutId] || 0}</b></div>
                <div>{t("Size", "サイズ")}: {doc.layout?.widthMm} × {doc.layout?.heightMm} mm</div>
                <div>{t("Updated", "更新")}: {fmtDate(doc.updatedAt)}</div>
              </dl>
              <div className="mt-3">{actions(doc)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
          {shown.map((doc) => (
            <div
              key={doc.layoutId}
              onClick={() => setDetail({ id: doc.layoutId, assign: false })}
              className={`flex cursor-pointer items-center gap-4 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0 hover:bg-[var(--surface-subtle)] ${doc.layoutId === initialLayoutId ? "bg-[var(--freya-blue)]/5" : ""}`}
            >
              <div className="flex h-[64px] w-[104px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--surface-subtle)] p-1">
                <LayoutPreview doc={doc} className="max-h-full max-w-full rounded-[3px] border border-[var(--border)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="truncate text-sm font-bold">{doc.name}</h4>{defaultChip(doc)}
                </div>
                <div className="mt-0.5">{idChip(doc)}</div>
              </div>
              <div className="hidden w-28 text-[11px] text-[var(--text-secondary)] md:block">
                {t("Items", "アイテム")}: <b className="text-[var(--text-primary)]">{counts[doc.layoutId] || 0}</b>
              </div>
              <div className="hidden w-36 text-[11px] text-[var(--text-secondary)] lg:block">{doc.layout?.widthMm} × {doc.layout?.heightMm} mm</div>
              <div className="hidden w-24 text-[11px] text-[var(--text-secondary)] lg:block">{fmtDate(doc.updatedAt)}</div>
              {actions(doc)}
            </div>
          ))}
        </div>
      )}

      {detailDoc && (
        <ScnaLabelLayoutDetailModal
          key={`${detailDoc.layoutId}-${detail.assign}`}
          doc={detailDoc}
          layouts={layouts}
          process={process}
          startAssign={detail.assign}
          t={t}
          onClose={() => setDetail(null)}
          onEdit={(d) => { setDetail(null); onEdit?.(d); }}
          onChanged={changed}
          onFlash={onFlash}
        />
      )}
      {copyDoc && (
        <ScnaLabelCopyModal
          doc={copyDoc}
          process={process}
          t={t}
          onClose={() => setCopyDoc(null)}
          onCopied={() => { setCopyDoc(null); changed(); }}
          onFlash={onFlash}
        />
      )}
      {findOpen && (
        <ScnaLabelItemSearchModal
          items={items}
          layouts={layouts}
          t={t}
          onClose={() => setFindOpen(false)}
          onOpenLayout={(id) => { setFindOpen(false); setDetail({ id, assign: false }); }}
        />
      )}
    </div>
  );
}
