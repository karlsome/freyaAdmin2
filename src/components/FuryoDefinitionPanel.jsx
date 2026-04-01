import { countDefinedCounters, FURYO_COUNTER_KEYS } from "../utils/furyoKanri";

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function FieldRow({
  index,
  counterKey,
  jpValue,
  enValue,
  translating,
  editable,
  onChangeJP,
  onBlurJP,
  onChangeEN,
}) {
  const baseClassName = editable
    ? "w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
    : "w-full rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3 text-sm text-on-surface";

  return (
    <div className="grid gap-3 lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
      <div className="text-sm font-bold text-on-surface-variant">Counter {index}</div>

      <input
        type="text"
        value={jpValue}
        readOnly={!editable}
        disabled={!editable}
        onChange={(event) => onChangeJP(counterKey, event.target.value)}
        onBlur={() => onBlurJP(counterKey)}
        placeholder={editable ? "日本語で入力..." : "権限なし"}
        className={baseClassName}
      />

      <div className="relative">
        <input
          type="text"
          value={enValue}
          readOnly={!editable}
          disabled={!editable}
          onChange={(event) => onChangeEN(counterKey, event.target.value)}
          placeholder={editable ? "English..." : "No permission"}
          className={`${baseClassName} pr-10`}
        />
        {translating && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default function FuryoDefinitionPanel({
  selectedModel = "",
  definition,
  draftCounters = {},
  draftCountersEn = {},
  editMode = false,
  canEdit = false,
  hasChanges = false,
  saving = false,
  translating = {},
  onStartEdit,
  onCancelEdit,
  onClear,
  onSave,
  onChangeJP,
  onBlurJP,
  onChangeEN,
}) {
  if (!selectedModel) {
    return (
      <div className="glass-card flex h-[min(74vh,820px)] items-center justify-center rounded-3xl px-6 py-10 text-center">
        <div>
          <span className="material-symbols-outlined text-outline" style={{ fontSize: 56 }}>arrow_back</span>
          <h3 className="mt-4 text-xl font-bold text-on-surface">Select a model</h3>
          <p className="mt-2 text-sm text-on-surface-variant">Choose a model from the left panel to review or edit its 12 defect counters.</p>
        </div>
      </div>
    );
  }

  const definedCount = countDefinedCounters(definition?.counters);
  const badgeTone = definedCount
    ? definedCount === 12
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : "bg-surface-container text-on-surface-variant";

  return (
    <div className="glass-card flex h-[min(74vh,820px)] flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-outline-variant/20 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Defect Definition</div>
            <h3 className="mt-1 text-2xl font-bold text-on-surface">{selectedModel}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Define Japanese and English labels for counters 1 through 12.</p>
            {(definition?.updatedAt || definition?.updatedBy) && (
              <div className="mt-2 text-xs text-outline">
                Last updated {formatDateTime(definition?.updatedAt)}{definition?.updatedBy ? ` by ${definition.updatedBy}` : ""}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${badgeTone}`}>
              {definedCount ? `${definedCount}/12 defined` : "未定義"}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface-variant">
              {canEdit ? (editMode ? "Editing" : "Editable") : "View only"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-outline lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]">
          <div />
          <div>Japanese</div>
          <div>English</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-hide">
        <div className="space-y-3">
          {FURYO_COUNTER_KEYS.map((counterKey, index) => (
            <FieldRow
              key={counterKey}
              index={index + 1}
              counterKey={counterKey}
              jpValue={draftCounters[counterKey] || ""}
              enValue={draftCountersEn[counterKey] || ""}
              translating={Boolean(translating[counterKey])}
              editable={canEdit && editMode}
              onChangeJP={onChangeJP}
              onBlurJP={onBlurJP}
              onChangeEN={onChangeEN}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-outline-variant/20 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-on-surface-variant">
          {canEdit
            ? editMode
              ? "English suggestions are auto-filled when a Japanese field loses focus and the English field is still empty."
              : "Read-only mode. Switch to edit to update counter definitions."
            : "表示専用 — 編集権限がありません"}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {editMode ? (
              <>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!hasChanges || saving}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartEdit}
                className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary/15"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}