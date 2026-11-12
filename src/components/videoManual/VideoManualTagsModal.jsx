import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "../../contexts/LanguageContext";
import {
  fetchVideoManualPlaylistProjectTags,
  fetchVideoManualTagOptions,
  setVideoManualProjectTags,
  tagVideoManualProjects,
} from "../../services/videoManualApi";

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

/** Tag one project (edit its tags) or a whole selection (add / remove tags) with 工場 and 設備 values. */
export default function VideoManualTagsModal({ ids = [], label = "", project = null, playlistId, onClose, onDone }) {
  const { t } = useLanguage();
  const single = ids.length === 1;
  const [options, setOptions] = useState({ factories: [], machines: [] });
  const [inUse, setInUse] = useState({ factories: [], machines: [] });
  const [factories, setFactories] = useState(project?.tags?.factories || []);
  const [machines, setMachines] = useState(project?.tags?.machines || []);
  const [removeFactories, setRemoveFactories] = useState([]);
  const [removeMachines, setRemoveMachines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  useEffect(() => {
    let cancelled = false;
    fetchVideoManualTagOptions().then((data) => { if (!cancelled) setOptions(data); }).catch(() => {});
    if (!single && playlistId) fetchVideoManualPlaylistProjectTags(playlistId).then((data) => { if (!cancelled) setInUse(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [playlistId, single]);

  const factoryOptions = useMemo(() => options.factories.map((name) => ({ name })), [options.factories]);
  const machineOptions = useMemo(() => options.machines.map((machine) => ({ name: machine.name, hint: machine.factory })), [options.machines]);

  const nothing = single ? false : !factories.length && !machines.length && !removeFactories.length && !removeMachines.length;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      let result;
      if (single) {
        await setVideoManualProjectTags(ids[0], { factories, machines });
        result = { ok: 1, failed: [] };
      } else {
        result = await tagVideoManualProjects(ids, {
          add: { factories, machines },
          remove: { factories: removeFactories, machines: removeMachines },
        });
      }
      onDone(result);
    } catch (saveError) {
      setError(saveError.message || t("Failed to save tags."));
      setSaving(false);
    }
  }

  const toggle = (list, setList, name) => setList(list.includes(name) ? list.filter((item) => item !== name) : [...list, name]);

  return createPortal(
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }}>
      <div onClick={(event) => event.stopPropagation()} className="freya-card flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{single ? label : t("{count} projects", { count: ids.length })}</p>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{single ? t("Edit tags") : t("Tag projects")}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!single ? <p className="text-xs font-bold text-[var(--text-primary)]">{t("Add tags")}</p> : null}
          <TagPicker label={t("Factory tags")} icon="factory" options={factoryOptions} value={factories} onChange={setFactories} />
          <TagPicker label={t("Machine tags")} icon="precision_manufacturing" options={machineOptions} value={machines} onChange={setMachines} />

          {!single && (inUse.factories.length || inUse.machines.length) ? (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-bold text-[var(--text-primary)]">{t("Remove tags")}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{t("Tags used in this playlist. Click to remove them from the selected projects.")}</p>
              <div className="flex flex-wrap gap-1.5">
                {inUse.factories.map((tag) => (
                  <button key={`f-${tag.name}`} type="button" onClick={() => toggle(removeFactories, setRemoveFactories, tag.name)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${removeFactories.includes(tag.name) ? "border-red-500 bg-red-500/10 text-red-600 line-through" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}>
                    工場 {tag.name} <span className="text-[var(--text-muted)]">{tag.count}</span>
                  </button>
                ))}
                {inUse.machines.map((tag) => (
                  <button key={`m-${tag.name}`} type="button" onClick={() => toggle(removeMachines, setRemoveMachines, tag.name)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${removeMachines.includes(tag.name) ? "border-red-500 bg-red-500/10 text-red-600 line-through" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}>
                    設備 {tag.name} <span className="text-[var(--text-muted)]">{tag.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("A DCP tablet opened with ?filter=<factory>&machine=<machine> lists the deployed projects tagged for its factory or machine, in addition to the projects of the scanned model.")}
          </p>

          {error ? <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 text-xs font-semibold text-[var(--text-primary)]">{error}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] px-6 py-3.5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50">{t("Cancel")}</button>
          <button type="button" onClick={handleSave} disabled={saving || nothing} className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? t("Saving...") : t("Save tags")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
