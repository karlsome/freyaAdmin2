import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { assignScnaLabelLayoutItems, fetchScnaLabelItems } from "../../services/scnaApi";

const inputCls = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs";
const btnCls = "rounded-[6px] border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-40";
const primaryBtn = "rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50";

const CUSTOMER = "顧客/納入先";
const FILTERS = ["all", "unassigned", "mine", "other"];

// Pick which SCNA masterDB items print with this layout in one process. Saves masterDB.labelLayoutByProcess.<process>.
export default function ScnaLabelAssignModal({ layoutId, layoutName, layouts, process, t, onClose, onSaved, onFlash }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set()); // 背番号 chosen for this layout
  const [initial, setInitial] = useState(() => new Set()); // 背番号 bound to this layout when opened

  const idsOf = (it) => it.layoutIdsByProcess?.[process] || [];

  const layoutNames = useMemo(() => {
    const m = {};
    (layouts || []).forEach((l) => { m[l.layoutId] = l.name; });
    return m;
  }, [layouts]);

  useEffect(() => {
    let alive = true;
    fetchScnaLabelItems()
      .then((rows) => {
        if (!alive) return;
        const mine = new Set(rows.filter((r) => idsOf(r).includes(layoutId)).map((r) => r.背番号));
        setItems(rows);
        setInitial(mine);
        setSelected(new Set(mine));
      })
      .catch((err) => onFlash?.({ type: "error", message: err.message }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [layoutId, process]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusOf = (it) => {
    const ids = idsOf(it);
    if (ids.includes(layoutId)) return "mine";
    return ids.length ? "other" : "unassigned";
  };

  const customers = useMemo(
    () => [...new Set(items.map((i) => i[CUSTOMER]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))),
    [items]
  );

  const counts = useMemo(() => {
    const c = { all: items.length, unassigned: 0, mine: 0, other: 0 };
    items.forEach((i) => { c[statusOf(i)] += 1; });
    return c;
  }, [items, layoutId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== "all" && statusOf(i) !== filter) return false;
      if (customer && i[CUSTOMER] !== customer) return false;
      if (!q) return true;
      return [i.背番号, i.品番, i.品名, i[CUSTOMER]].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [items, filter, customer, search, layoutId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.背番号));

  function toggle(id) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleShown() {
    setSelected((cur) => {
      const next = new Set(cur);
      shown.forEach((i) => { if (allShownSelected) next.delete(i.背番号); else next.add(i.背番号); });
      return next;
    });
  }

  const add = [...selected].filter((id) => !initial.has(id));
  const remove = [...initial].filter((id) => !selected.has(id));
  const changed = add.length + remove.length > 0;

  async function save() {
    setSaving(true);
    try {
      await assignScnaLabelLayoutItems(layoutId, { add, remove, process });
      onFlash?.({ type: "success", message: t("Items updated", "アイテムを更新しました") });
      onSaved?.();
      onClose();
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const badge = (it) => {
    const st = statusOf(it);
    if (st === "mine") {
      return <span className="rounded bg-[var(--freya-blue)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--freya-blue)]">{t("This layout", "このレイアウト")}</span>;
    }
    if (st === "other") {
      const names = idsOf(it).map((id) => layoutNames[id]).filter(Boolean).join(", ");
      return <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{names || t("Other layout", "別のレイアウト")}</span>;
    }
    return <span className="rounded bg-[var(--status-warning)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-warning)]">{t("No layout", "未割当")}</span>;
  };

  const filterLabel = {
    all: t("All", "すべて"),
    unassigned: t("Unassigned", "未割当"),
    mine: t("This layout", "このレイアウト"),
    other: t("In other layouts", "他のレイアウトに割当済"),
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-bold">{t("Assign items", "アイテムを割り当て")} — {layoutName}</h3>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {t("Selected items can print with this layout. An item can have several layouts; the operator chooses one on the tablet. Items without a layout use the default layout, or the built-in label.",
                "選択したアイテムでこのレイアウトを印刷できます。1つのアイテムに複数のレイアウトを割り当てられ、タブレットで選択します。未割当のアイテムはデフォルトレイアウト、または標準ラベルを使用します。")}
            </p>
          </div>
          <button type="button" className="text-sm" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-2 border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={search}
              placeholder={t("Search 背番号 / 品番 / 品名…", "背番号 / 品番 / 品名で検索…")}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={`${inputCls} max-w-[220px]`} value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">{t("All customers", "すべての顧客")}</option>
              {customers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${filter === f ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
              >
                {filterLabel[f]} {counts[f]}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1 text-[11px]">
              <input type="checkbox" checked={allShownSelected} onChange={toggleShown} disabled={!shown.length} />
              {t(`Select all ${shown.length} shown`, `表示中の${shown.length}件をすべて選択`)}
            </label>
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-[var(--text-muted)]">{t("Loading…", "読み込み中…")}</p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-xs text-[var(--text-muted)]">{t("No items match.", "該当するアイテムがありません。")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--surface-subtle)] text-left text-[10px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2">背番号</th>
                  <th className="px-3 py-2">品番</th>
                  <th className="px-3 py-2">品名</th>
                  <th className="px-3 py-2">{CUSTOMER}</th>
                  <th className="px-3 py-2">{t("Layout", "レイアウト")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => (
                  <tr
                    key={it.背番号}
                    className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                    onClick={() => toggle(it.背番号)}
                  >
                    <td className="px-3 py-1.5"><input type="checkbox" checked={selected.has(it.背番号)} onChange={() => toggle(it.背番号)} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="px-3 py-1.5 font-mono">{it.背番号}</td>
                    <td className="px-3 py-1.5">{it.品番}</td>
                    <td className="max-w-[220px] truncate px-3 py-1.5">{it.品名}</td>
                    <td className="px-3 py-1.5">{it[CUSTOMER]}</td>
                    <td className="px-3 py-1.5">{badge(it)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-[11px] text-[var(--text-secondary)]">
            {t(`${selected.size} selected`, `${selected.size}件選択`)}
            {add.length > 0 && ` · ${t(`+${add.length} added`, `+${add.length}件追加`)}`}
            {remove.length > 0 && ` · ${t(`−${remove.length} removed`, `−${remove.length}件解除`)}`}
          </p>
          <div className="flex gap-2">
            <button type="button" className={btnCls} onClick={onClose}>{t("Cancel", "キャンセル")}</button>
            <button type="button" className={primaryBtn} disabled={saving || !changed} onClick={save}>
              {saving ? t("Saving…", "保存中…") : t("Save", "保存")}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}
