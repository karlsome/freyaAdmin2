import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { assignScnaLabelLayoutItems, fetchScnaLabelItems } from "../../services/scnaApi";
import ScnaLabelAssignModal from "./ScnaLabelAssignModal";
import { LayoutPreview } from "./ScnaLabelThumb";

const inputCls = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs";
const btnCls = "rounded-[6px] border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-40";
const primaryBtn = "rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50";
const PAGE_SIZE = 15;

const fmtDate = (v) => (v ? String(v).slice(0, 16).replace("T", " ") : "—");

// One layout in detail: preview, facts, and the items assigned to it (paginated).
export default function ScnaLabelLayoutDetailModal({ doc, layouts, startAssign, t, onClose, onEdit, onChanged, onFlash }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [assignOpen, setAssignOpen] = useState(!!startAssign);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchScnaLabelItems());
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }, [onFlash]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => (i.layoutIds || []).includes(doc.layoutId)
      && (!q || [i.背番号, i.品番, i.品名, i["顧客/納入先"]].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [items, doc.layoutId, search]);

  const assignedTotal = useMemo(() => items.filter((i) => (i.layoutIds || []).includes(doc.layoutId)).length, [items, doc.layoutId]);
  const unassignedCount = useMemo(() => items.filter((i) => !(i.layoutIds || []).length).length, [items]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, Math.min(page, totalPages) * PAGE_SIZE);

  async function removeItem(it) {
    try {
      await assignScnaLabelLayoutItems(doc.layoutId, { add: [], remove: [it.背番号] });
      await loadItems();
      onChanged?.();
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <h3 className="mr-auto truncate text-sm font-bold">{doc.name}</h3>
          <button type="button" className={btnCls} onClick={() => setAssignOpen(true)}>{t("Assign items", "アイテムを割り当て")}</button>
          <button type="button" className={primaryBtn} onClick={() => onEdit?.(doc)}>✎ {t("Edit", "編集")}</button>
          <button type="button" className="text-sm" onClick={onClose}>✕</button>
        </div>

        <div className="flex gap-4 border-b border-[var(--border)] px-4 py-3">
          <LayoutPreview doc={doc} className="h-[130px] w-[210px] shrink-0 rounded-[6px] border border-[var(--border)]" />
          <dl className="grid flex-1 grid-cols-[auto_1fr] content-start gap-x-4 gap-y-0.5 text-[11px]">
            <dt className="text-[var(--text-muted)]">ID</dt>
            <dd className="font-mono">{doc.layoutId}</dd>
            <dt className="text-[var(--text-muted)]">{t("Size", "サイズ")}</dt>
            <dd>{doc.layout?.widthMm} × {doc.layout?.heightMm} mm</dd>
            <dt className="text-[var(--text-muted)]">{t("Elements", "要素数")}</dt>
            <dd>{(doc.layout?.elements || []).length}</dd>
            <dt className="text-[var(--text-muted)]">{t("Assigned items", "割り当てアイテム")}</dt>
            <dd>{loading ? "…" : assignedTotal}</dd>
            <dt className="text-[var(--text-muted)]">{t("Default", "デフォルト")}</dt>
            <dd>{doc.isDefault ? t(`Yes — also used by the ${unassignedCount} items with no layout`, `はい — レイアウト未割当の${unassignedCount}件にも使用`) : t("No", "いいえ")}</dd>
            <dt className="text-[var(--text-muted)]">{t("Last updated", "最終更新")}</dt>
            <dd>{fmtDate(doc.updatedAt)}{doc.updatedBy ? ` · ${doc.updatedBy}` : ""}</dd>
          </dl>
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
          <input className={`${inputCls} max-w-[260px]`} value={search} placeholder={t("Search assigned items…", "割り当て済みアイテムを検索…")} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="min-h-[160px] flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-[var(--text-muted)]">{t("Loading…", "読み込み中…")}</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-xs text-[var(--text-muted)]">
              {search ? t("No items match.", "該当するアイテムがありません。") : t("No items assigned to this layout yet.", "このレイアウトに割り当てられたアイテムはありません。")}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--surface-subtle)] text-left text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2">背番号</th>
                  <th className="px-3 py-2">品番</th>
                  <th className="px-3 py-2">品名</th>
                  <th className="px-3 py-2">顧客/納入先</th>
                  <th className="px-3 py-2">{t("Also in", "他のレイアウト")}</th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((it) => {
                  const others = (it.layoutIds || []).filter((id) => id !== doc.layoutId)
                    .map((id) => layouts.find((l) => l.layoutId === id)?.name).filter(Boolean);
                  return (
                    <tr key={it.背番号} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5 font-mono">{it.背番号}</td>
                      <td className="px-3 py-1.5">{it.品番}</td>
                      <td className="max-w-[200px] truncate px-3 py-1.5">{it.品名}</td>
                      <td className="px-3 py-1.5">{it["顧客/納入先"]}</td>
                      <td className="max-w-[160px] truncate px-3 py-1.5 text-[var(--text-secondary)]">{others.join(", ")}</td>
                      <td className="px-3 py-1.5">
                        <button type="button" title={t("Remove from this layout", "このレイアウトから外す")} onClick={() => removeItem(it)}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-[11px]">
          <span className="text-[var(--text-secondary)]">{t(`${rows.length} items`, `${rows.length}件`)}</span>
          <div className="flex items-center gap-2">
            <button type="button" className={btnCls} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="tabular-nums">{Math.min(page, totalPages)} / {totalPages}</span>
            <button type="button" className={btnCls} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {assignOpen && (
        <ScnaLabelAssignModal
          layoutId={doc.layoutId}
          layoutName={doc.name}
          layouts={layouts}
          t={t}
          onClose={() => setAssignOpen(false)}
          onSaved={() => { loadItems(); onChanged?.(); }}
          onFlash={onFlash}
        />
      )}
    </div>
  , document.body);
}
