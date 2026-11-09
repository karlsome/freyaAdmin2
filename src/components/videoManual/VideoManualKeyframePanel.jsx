import { ACTIVE_KEYFRAME_THRESHOLD, getAllKeyframeTimesForClip, getClipRelativePlaybackTime, normalizeKeyframeFieldValue } from "./videoManualEditorUtils";

const KEYFRAME_FIELDS = [
  { id: "offsetX", label: "X Position", icon: "X", min: "-1", max: "1", step: "0.05" },
  { id: "offsetY", label: "Y Position", icon: "Y", min: "-1", max: "1", step: "0.05" },
  { id: "scale", label: "Scale", icon: "open_in_full", min: "0.05", step: "0.05" },
  { id: "opacity", label: "Opacity", icon: "opacity", min: "0", max: "1", step: "0.05" },
  { id: "rotate", label: "Rotation", icon: "rotate_right", min: "-360", max: "360", step: "1" },
];

function Icon({ children, className = "text-[15px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function Diamond({ active = false }) {
  return (
    <svg width={active ? "10" : "8"} height={active ? "10" : "8"} viewBox="0 0 8 8" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="6" height="6" fill="currentColor" transform="rotate(45 4 4)" />
    </svg>
  );
}

function ActionButton({ children, icon, onClick, disabled = false, tone = "slate" }) {
  const toneClass = tone === "red"
    ? "bg-red-50 text-red-600 hover:bg-red-100 disabled:bg-surface-container disabled:text-outline dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
    : tone === "amber"
      ? "bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:bg-surface-container disabled:text-outline dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
      : "bg-surface-container text-on-surface hover:bg-surface-container-high disabled:text-outline";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-70 ${toneClass}`}
    >
      {icon ? <Icon>{icon}</Icon> : null}
      {children}
    </button>
  );
}

function KeyframeField({ field, activeKeyframe, values, editing, changed, onChange }) {
  const rawValue = values?.[field.id];
  const value = activeKeyframe && rawValue != null ? rawValue : "";
  const icon = field.icon.length === 1
    ? <span className="text-[11px] font-black">{field.icon}</span>
    : <Icon className="text-[14px]">{field.icon}</Icon>;

  return (
    <label className={`grid grid-cols-[2rem_1fr] overflow-hidden rounded-lg border transition ${changed ? "border-primary/30 bg-primary/10 " : "border-separator bg-surface "}`}>
      <span className="flex items-center justify-center border-r border-inherit text-on-surface-variant" title={field.label}>{icon}</span>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        disabled={!activeKeyframe}
        readOnly={!editing}
        onChange={(event) => onChange(field.id, event.target.value)}
        className="min-w-0 bg-transparent px-2.5 py-2 text-xs font-bold text-on-surface outline-none disabled:cursor-not-allowed disabled:text-outline read-only:cursor-default"
      />
    </label>
  );
}

export default function VideoManualKeyframePanel({
  selectedClip,
  playbackTime,
  activeKeyframe,
  keyframeDraft,
  isKeyframeEditMode,
  onAddKeyframe,
  onEnterEditMode,
  onRecordEditMode,
  onCancelEditMode,
  onDeleteKeyframe,
  onChangeDraftValue,
  onApplyAnimationPreset,
}) {
  const clip = selectedClip?.clip || null;
  const assetType = clip?.asset?.type || "No clip selected";
  const disabled = !clip;
  const relativeTime = clip ? getClipRelativePlaybackTime(clip, playbackTime) : 0;
  const keyframeTimes = clip ? getAllKeyframeTimesForClip(clip) : [];
  const values = activeKeyframe ? { ...activeKeyframe.values, ...(keyframeDraft?.values || {}) } : null;
  const draftValues = keyframeDraft?.values || {};

  const fieldChanged = (field) => {
    if (!activeKeyframe || !Object.prototype.hasOwnProperty.call(draftValues, field)) return false;
    return normalizeKeyframeFieldValue(field, draftValues[field]) !== normalizeKeyframeFieldValue(field, activeKeyframe.values[field]);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-separator bg-surface-container-low px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Selected</p>
        <p className="mt-1 truncate text-xs font-bold text-on-surface">{assetType}</p>
      </div>

      <ActionButton icon="add" tone="amber" onClick={onAddKeyframe} disabled={disabled}>
        <span className="inline-flex items-center gap-1"><Diamond /> Add Keyframe T={relativeTime.toFixed(2)}s</span>
      </ActionButton>

      <section className="space-y-2 rounded-lg border border-separator bg-surface p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black text-on-surface">Current Diamond</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant">
              {activeKeyframe ? `T=${activeKeyframe.time.toFixed(2)}s` : `Within ${ACTIVE_KEYFRAME_THRESHOLD.toFixed(2)}s`}
            </p>
          </div>
          <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-black uppercase tracking-[0.12em] ${activeKeyframe ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" : "bg-surface-container text-outline "}`}>
            <Diamond active={!!activeKeyframe} />
            {activeKeyframe ? "Active" : "None"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {!isKeyframeEditMode ? (
            <ActionButton icon="edit" onClick={onEnterEditMode} disabled={!activeKeyframe}>Edit</ActionButton>
          ) : (
            <>
              <ActionButton icon="radio_button_checked" onClick={onRecordEditMode}>Record</ActionButton>
              <ActionButton icon="close" onClick={onCancelEditMode}>Cancel</ActionButton>
            </>
          )}
          <ActionButton icon="delete" tone="red" onClick={onDeleteKeyframe} disabled={!activeKeyframe}>Delete</ActionButton>
        </div>

        <div className="grid gap-2">
          {KEYFRAME_FIELDS.map((field) => (
            <KeyframeField
              key={field.id}
              field={field}
              activeKeyframe={activeKeyframe}
              values={values}
              editing={isKeyframeEditMode}
              changed={fieldChanged(field.id)}
              onChange={onChangeDraftValue}
            />
          ))}
        </div>
      </section>

      {keyframeTimes.length ? (
        <div className="flex flex-wrap gap-1.5">
          {keyframeTimes.map((time) => (
            <span key={time} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-container px-2 text-[10px] font-bold text-on-surface-variant">
              <Diamond /> {time.toFixed(2)}s
            </span>
          ))}
        </div>
      ) : null}

      <section className="space-y-2 border-t border-separator pt-3">
        <p className="text-[11px] font-bold text-on-surface-variant">Presets</p>
        <div className="grid gap-2">
          <ActionButton icon="opacity" onClick={() => onApplyAnimationPreset("fadeIn")} disabled={disabled}>Fade In</ActionButton>
          <ActionButton icon="blur_on" onClick={() => onApplyAnimationPreset("fadeOut")} disabled={disabled}>Fade Out</ActionButton>
          <ActionButton icon="zoom_in_map" onClick={() => onApplyAnimationPreset("zoomIn")} disabled={disabled}>Zoom In</ActionButton>
          <ActionButton icon="east" onClick={() => onApplyAnimationPreset("slideLeft")} disabled={disabled}>Slide Left</ActionButton>
          <ActionButton icon="graphic_eq" onClick={() => onApplyAnimationPreset("pulse")} disabled={disabled}>Pulse</ActionButton>
        </div>
      </section>
    </div>
  );
}