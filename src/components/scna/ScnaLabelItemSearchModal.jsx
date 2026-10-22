import { useMemo, useState } from "react";
import { LayoutPreview } from "./ScnaLabelThumb";
import { effectiveLayouts } from "./scnaLabelUtils";

const inputCls = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs";
const MAX_RESULTS = 30;

// Type a 品番 / 背番号 and see which layouts that item prints with.
export default function ScnaLabelItemSearchModal({ items, layouts, t, onClose, onOpenLayout }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => [i.背番号, i.品番, i.品名].some((v) => String(v || "").toLowerCase().includes(q)))
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  const sourceNote = {
    assigned: null,
    customer: t("From the old customer rule", "旧・顧客ルールによる"),
    default: t("Default layout (nothing assigned)", "デフォルトレイアウト（未割当）"),
    none: t("Nothing assigned and no default layout — prints the built-in label", "未割当・デフォルトなし — 標準ラベルで印刷されます"),
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-bold">{t("Find an item's layouts", "アイテムのレイアウトを検索")}</h3>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {t("Search by 背番号, 品番 or 品名 to see which layouts the item prints with.", "背番号・品番・品名で検索し、印刷に使われるレイアウトを確認します。")}
            </p>
          </div>
          <button type="button" className="text-sm" onClick={onClose}>✕</button>
        </div>
        <div className="border-b border-[var(--border)] px-4 py-2.5">
          <input autoFocus className={inputCls} value={query} placeholder="背番号 / 品番 / 品名" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="min-h-[160px] flex-1 overflow-y-auto">
          {!query.trim() ? (
            <p className="p-4 text-xs text-[var(--text-muted)]">{t("Type to search.", "検索語を入力してください。")}</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-xs text-[var(--text-muted)]">{t("No items match.", "該当するアイテムがありません。")}</p>
          ) : results.map((it) => {
            const eff = effectiveLayouts(it, layouts);
            return (
              <div key={it.背番号} className="border-b border-[var(--border)] px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
                  <span className="font-mono font-bold">{it.背番号}</span>
                  <span>{it.品番}</span>
                  <span className="text-[var(--text-secondary)]">{it.品名}</span>
                  <span className="text-[var(--text-muted)]">{it["顧客/納入先"]}</span>
                </div>
                {sourceNote[eff.source] && (
                  <p className="mt-1 text-[10px] font-semibold text-[var(--status-warning)]">{sourceNote[eff.source]}</p>
                )}
                {eff.layouts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eff.layouts.map((l) => (
                      <button
                        key={l.layoutId}
                        type="button"
                        onClick={() => onOpenLayout?.(l.layoutId)}
                        className="w-[120px] rounded-[6px] border border-[var(--border)] p-1 text-left hover:bg-[var(--surface-subtle)]"
                      >
                        <LayoutPreview doc={l} className="h-[64px] w-full" />
                        <span className="mt-1 block truncate text-[11px] font-semibold">{l.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {results.length === MAX_RESULTS && (
            <p className="p-3 text-[11px] text-[var(--text-muted)]">{t(`Showing the first ${MAX_RESULTS}. Narrow the search.`, `最初の${MAX_RESULTS}件を表示しています。検索を絞り込んでください。`)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
