import { useEffect, useState } from "react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function MasterProductPickerModal({
  open,
  focusField = "品番",
  initialQuery = "",
  busy = false,
  loadOptions,
  onClose,
  onSelect,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setError("");
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open || typeof loadOptions !== "function") return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const nextRows = await loadOptions(query);
        if (!cancelled) {
          setRows(Array.isArray(nextRows) ? nextRows : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([]);
          setError(loadError.message || "Failed to load products.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadOptions, open, query]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const title = focusField === "背番号" ? "背番号検索" : "品番検索";

  return (
    <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" onClick={() => onClose?.()}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="glass-card flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-outline-variant/20 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Master Picker</div>
                <h3 className="mt-1 text-xl font-black text-on-surface">{title}</h3>
              </div>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/20 bg-white/80 text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div className="border-b border-outline-variant/15 px-5 py-4">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="品番または背番号で検索..."
              className="h-14 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-base text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              autoFocus
            />
            <div className="mt-2 text-sm text-on-surface-variant">
              {loading ? "Searching..." : `${rows.length}件表示`}
            </div>
          </div>

          <div className="max-h-[58vh] overflow-y-auto">
            {error ? (
              <div className="px-5 py-8 text-sm font-semibold text-error">{error}</div>
            ) : loading ? (
              <div className="px-5 py-8 text-sm font-semibold text-on-surface-variant">Searching master DB...</div>
            ) : !rows.length ? (
              <div className="px-5 py-8 text-sm font-semibold text-on-surface-variant">該当なし</div>
            ) : (
              <table className="ui-table-data w-full">
                <thead className="sticky top-0 bg-surface-container-high/95 backdrop-blur-md">
                  <tr>
                    <th className="ui-table-heading px-4 py-3 text-left text-on-surface-variant">背番号</th>
                    <th className="ui-table-heading px-4 py-3 text-left text-on-surface-variant">品番</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const serialNumber = String(row?.背番号 || "");
                    const partNumber = String(row?.品番 || "");

                    return (
                      <tr
                        key={`${serialNumber}-${partNumber}-${index}`}
                        className={joinClasses(
                          "cursor-pointer border-t border-outline-variant/10 transition hover:bg-primary/5",
                          index % 2 === 1 ? "bg-surface-container-lowest/50" : ""
                        )}
                        onClick={() => onSelect?.({ 背番号: serialNumber, 品番: partNumber })}
                      >
                        <td className="px-4 py-3 text-sm font-bold text-on-surface">{serialNumber || "—"}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{partNumber || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-outline-variant/15 bg-surface-container-low/60 px-5 py-3 text-xs text-on-surface-variant">
            行をクリックすると品番と背番号が同時に更新されます
          </div>
        </div>
      </div>
    </div>
  );
}