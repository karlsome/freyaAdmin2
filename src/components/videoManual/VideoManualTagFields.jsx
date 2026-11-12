import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "../../contexts/LanguageContext";
import { fetchVideoManualTagOptions } from "../../services/videoManualApi";

const sameTag = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

function Chip({ children, onRemove, tone = "blue" }) {
  const toneClass = tone === "red"
    ? "bg-red-500/10 text-red-600"
    : "bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10" aria-label="remove">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
        </button>
      ) : null}
    </span>
  );
}

/** Multi-select dropdown: pick values from the list (chips show what is selected). Only listed values can be chosen. */
function TagSelect({ label, icon, options, value, onChange }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  // The list is rendered in a portal on <body> (not inside the dialog), so the dialog never clips it. It opens below the
  // field, or above it when there is more room there, and follows the field while the dialog scrolls.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 6;
      const below = window.innerHeight - rect.bottom - gap - 12;
      const above = rect.top - gap - 12;
      const openUp = below < 220 && above > below;
      const maxHeight = Math.max(160, Math.min(openUp ? above : below, 420));
      setPosition({ left: rect.left, width: rect.width, maxHeight, ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, value.length]);

  useEffect(() => {
    if (!open) return undefined;
    const handleDown = (event) => {
      if (rootRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  // listed options plus any already-selected value that is no longer in the list (so it can still be removed)
  const allOptions = useMemo(() => {
    const known = new Set(options.map((option) => option.name.toLowerCase()));
    return [...options, ...value.filter((tag) => !known.has(tag.toLowerCase())).map((name) => ({ name }))];
  }, [options, value]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allOptions.filter((option) => !needle || option.name.toLowerCase().includes(needle) || String(option.hint || "").toLowerCase().includes(needle));
  }, [allOptions, query]);

  const grouped = visible.some((option) => option.hint);
  const groups = useMemo(() => {
    if (!grouped) return [{ title: "", items: visible }];
    const map = new Map();
    visible.forEach((option) => {
      const key = option.hint || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(option);
    });
    return [...map.entries()].map(([title, items]) => ({ title, items }));
  }, [grouped, visible]);

  const isSelected = (name) => value.some((tag) => sameTag(tag, name));
  const toggle = (name) => onChange(isSelected(name) ? value.filter((tag) => !sameTag(tag, name)) : [...value, name]);

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
        {label}
      </p>
      <div
        ref={fieldRef}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((current) => !current); }
          if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
        }}
        className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-[6px] border bg-[var(--surface-subtle)] px-2 py-1.5 outline-none transition-colors ${open ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"}`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {value.length ? value.map((tag) => (
            <Chip key={tag} onRemove={(event) => { event.stopPropagation(); onChange(value.filter((item) => item !== tag)); }}>{tag}</Chip>
          )) : <span className="px-1 text-sm font-semibold text-[var(--text-muted)]">{t("Select...")}</span>}
        </div>
        <span className="material-symbols-outlined flex-shrink-0 text-[var(--text-muted)]" style={{ fontSize: 20 }}>{open ? "expand_less" : "expand_more"}</span>
      </div>

      {open && position ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[500] flex flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
          style={{ left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
        >
          {allOptions.length > 8 ? (
            <div className="border-b border-[var(--border)] p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Search")}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
              />
            </div>
          ) : null}
          <div role="listbox" aria-multiselectable="true" className="min-h-0 flex-1 overflow-y-auto py-1">
            {visible.length ? groups.map((group) => (
              <div key={group.title || "all"}>
                {group.title ? <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">{group.title}</p> : null}
                {group.items.map((option) => {
                  const selected = isSelected(option.name);
                  return (
                    <button
                      key={option.name}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggle(option.name)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${selected ? "border-[var(--freya-blue)] bg-[var(--freya-blue)] text-white" : "border-[var(--border-strong)] text-transparent"}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span>
                      </span>
                      <span className="truncate">{option.name}</span>
                    </button>
                  );
                })}
              </div>
            )) : <p className="px-3 py-3 text-center text-xs font-semibold text-[var(--text-muted)]">{t("No matches.")}</p>}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

/** The two tag pickers (工場 / 設備) with the known values loaded from the server. */
export default function VideoManualTagFields({ factories, machines, onFactoriesChange, onMachinesChange }) {
  const { t } = useLanguage();
  const [options, setOptions] = useState({ factories: [], machines: [] });

  useEffect(() => {
    let cancelled = false;
    fetchVideoManualTagOptions().then((data) => { if (!cancelled) setOptions(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const factoryOptions = useMemo(() => options.factories.map((name) => ({ name })), [options.factories]);
  const machineOptions = useMemo(() => options.machines.map((machine) => ({ name: machine.name, hint: machine.factory })), [options.machines]);

  return (
    <div className="space-y-4">
      <TagSelect label={t("Factory tags")} icon="factory" options={factoryOptions} value={factories} onChange={onFactoriesChange} />
      <TagSelect label={t("Machine tags")} icon="precision_manufacturing" options={machineOptions} value={machines} onChange={onMachinesChange} />
    </div>
  );
}
