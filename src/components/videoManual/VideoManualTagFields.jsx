import { useEffect, useMemo, useState } from "react";

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

/** Chips + a text box that suggests the known values; typing a value that is not listed is allowed. */
function TagPicker({ label, icon, options, value, onChange }) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return options
      .filter((option) => !value.some((tag) => sameTag(tag, option.name)) && (!needle || option.name.toLowerCase().includes(needle) || String(option.hint || "").toLowerCase().includes(needle)))
      .slice(0, 8);
  }, [options, text, value]);

  function add(raw) {
    const next = String(raw || "").trim();
    if (!next) return;
    if (!value.some((tag) => sameTag(tag, next))) onChange([...value, options.find((option) => sameTag(option.name, next))?.name || next]);
    setText("");
  }

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
        {label}
      </p>
      <div className="relative">
        <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5 focus-within:border-[var(--freya-blue)]">
          {value.map((tag) => <Chip key={tag} onRemove={() => onChange(value.filter((item) => item !== tag))}>{tag}</Chip>)}
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(text); }
              if (event.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
            }}
            placeholder={value.length ? "" : t("Type or pick a value")}
            className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>
        {focused && suggestions.length ? (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] py-1 shadow-xl">
            {suggestions.map((option) => (
              <button
                key={option.name}
                type="button"
                onMouseDown={(event) => { event.preventDefault(); add(option.name); }}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <span className="truncate">{option.name}</span>
                {option.hint ? <span className="flex-shrink-0 text-[11px] font-normal text-[var(--text-muted)]">{option.hint}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
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
      <TagPicker label={t("Factory tags")} icon="factory" options={factoryOptions} value={factories} onChange={onFactoriesChange} />
      <TagPicker label={t("Machine tags")} icon="precision_manufacturing" options={machineOptions} value={machines} onChange={onMachinesChange} />
    </div>
  );
}
