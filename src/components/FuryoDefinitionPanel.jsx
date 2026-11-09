import { useLanguage } from "../contexts/LanguageContext";
import { countDefinedCounters, FURYO_COUNTER_KEYS } from "../utils/furyoKanri";

function formatDateTime(value, isJa) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(isJa ? "ja-JP" : "en-US", {
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
  const { language } = useLanguage();
  const isJa = language === "ja";

  const baseClassName = editable
    ? "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]"
    : "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)]";

  return (
    <div className="grid gap-3 lg:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
      <div className="text-xs font-mono font-semibold text-[var(--text-secondary)]">
        {isJa ? `カウンター ${index}` : `Counter ${index}`}
      </div>

      <input
        type="text"
        value={jpValue}
        readOnly={!editable}
        disabled={!editable}
        onChange={(event) => onChangeJP(counterKey, event.target.value)}
        onBlur={() => onBlurJP(counterKey)}
        placeholder={editable ? (isJa ? "日本語で入力..." : "Input Japanese...") : (isJa ? "権限なし" : "No permission")}
        className={baseClassName}
      />

      <div className="relative">
        <input
          type="text"
          value={enValue}
          readOnly={!editable}
          disabled={!editable}
          onChange={(event) => onChangeEN(counterKey, event.target.value)}
          placeholder={editable ? (isJa ? "英語..." : "English...") : (isJa ? "権限なし" : "No permission")}
          className={`${baseClassName} pr-8`}
        />
        {translating && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--freya-blue)]">
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
  const { language } = useLanguage();
  const isJa = language === "ja";

  if (!selectedModel) {
    return (
      <div className="freya-card flex h-[min(74vh,820px)] items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center shadow-sm">
        <div>
          <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 48 }}>arrow_back</span>
          <h3 className="mt-3 text-base font-bold text-[var(--text-primary)]">{isJa ? "モデルを選択してください" : "Select a model"}</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {isJa ? "左パネルからモデルを選択して、12個の不良カウンターを確認・編集します。" : "Choose a model from the left panel to review or edit its 12 defect counters."}
          </p>
        </div>
      </div>
    );
  }

  const definedCount = countDefinedCounters(definition?.counters);
  const badgeTone = definedCount
    ? definedCount === 12
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]";

  return (
    <div className="freya-card flex h-[min(74vh,820px)] flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] px-5 py-4 bg-[var(--surface-subtle)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "不良項目定義" : "Defect Definition"}
            </div>
            <h3 className="mt-0.5 text-xl font-bold font-mono text-[var(--text-primary)]">{selectedModel}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {isJa ? "カウンター1〜12の日本語および英語の表示ラベルを定義します。" : "Define Japanese and English labels for counters 1 through 12."}
            </p>
            {(definition?.updatedAt || definition?.updatedBy) && (
              <div className="mt-1.5 text-[11px] font-mono text-[var(--text-muted)]">
                {isJa ? "最終更新:" : "Last updated"} {formatDateTime(definition?.updatedAt, isJa)}{definition?.updatedBy ? ` (${definition.updatedBy})` : ""}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-[4px] border px-2.5 py-0.5 text-xs font-mono font-medium ${badgeTone}`}>
              {definedCount ? `${definedCount}/12 ${isJa ? "件定義済" : "defined"}` : (isJa ? "未定義" : "Undefined")}
            </span>
            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono font-medium text-[var(--text-secondary)]">
              {canEdit ? (editMode ? (isJa ? "編集中" : "Editing") : (isJa ? "編集可能" : "Editable")) : (isJa ? "閲覧専用" : "View only")}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] lg:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)]">
          <div />
          <div>{isJa ? "日本語" : "Japanese"}</div>
          <div>{isJa ? "英語" : "English"}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
        <div className="space-y-2.5">
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

      <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 bg-[var(--surface-subtle)] md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-[var(--text-muted)]">
          {canEdit
            ? editMode
              ? (isJa ? "日本語入力後にフォーカスが外れると、英語欄が未入力の場合に自動で英訳が提案されます。" : "English suggestions are auto-filled when a Japanese field loses focus and the English field is still empty.")
              : (isJa ? "閲覧モードです。カウンター定義を変更するには「編集」をクリックしてください。" : "Read-only mode. Switch to edit to update counter definitions.")
            : (isJa ? "表示専用 — 編集権限がありません" : "View only — no edit permissions")}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {editMode ? (
              <>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  {isJa ? "クリア" : "Clear"}
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  {isJa ? "キャンセル" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!hasChanges || saving}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "保存" : "Save")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartEdit}
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
              >
                {isJa ? "編集" : "Edit"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}