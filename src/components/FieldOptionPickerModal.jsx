import { useEffect, useMemo, useState } from "react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function FieldOptionPickerModal({
  open,
  title = "Select Value",
  helperText = "",
  initialQuery = "",
  currentValue = "",
  loadOptions,
  onClose,
  onSelect,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [options, setOptions] = useState([]);
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

    async function run() {
      setLoading(true);
      setError("");

      try {
        const values = await loadOptions();
        if (cancelled) return;

        const normalized = [...new Set(
          (Array.isArray(values) ? values : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )].sort((left, right) => left.localeCompare(right, "ja"));

        setOptions(normalized);
      } catch (loadError) {
        if (cancelled) return;
        setOptions([]);
        setError(loadError.message || "Failed to load options.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loadOptions, open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" onClick={() => onClose?.()}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="glass-card flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-outline-variant/20 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Value Picker</div>
                <h3 className="mt-1 text-xl font-black text-on-surface">{title}</h3>
                {helperText ? <p className="mt-1 text-sm text-on-surface-variant">{helperText}</p> : null}
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
              placeholder="Search values..."
              className="planner-data-text h-12 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
              <span>{loading ? "Loading..." : `${filteredOptions.length} options`}</span>
              {currentValue ? <span>Current: {currentValue}</span> : null}
            </div>
          </div>

          <div className="max-h-[58vh] overflow-y-auto">
            {error ? (
              <div className="planner-data-text px-5 py-8 text-error">{error}</div>
            ) : loading ? (
              <div className="planner-data-text px-5 py-8 text-on-surface-variant">Loading options...</div>
            ) : !filteredOptions.length ? (
              <div className="planner-data-text px-5 py-8 text-on-surface-variant">No matching values.</div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {filteredOptions.map((option) => {
                  const active = option === currentValue;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onSelect?.(option)}
                      className={joinClasses(
                        "planner-data-text flex w-full items-center justify-between gap-4 px-5 py-3 text-left text-on-surface transition hover:bg-primary/5",
                        active ? "bg-primary/8" : ""
                      )}
                    >
                      <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{option}</span>
                      {active ? (
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
                          check_circle
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}