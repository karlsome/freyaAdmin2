import PaginationControls from "../PaginationControls";
import { useLanguage } from "../../contexts/LanguageContext";

import {
  PROJECT_PAGE_SIZE_OPTIONS,
  PROJECT_SORT_OPTIONS,
  PROJECT_ZOOM_MAX,
  PROJECT_ZOOM_MIN,
} from "./videoManualListConfig";

// Same look as the Master DB table: "Rows" select on top, "N records, showing a-b" + page buttons at the bottom.
const selectClassName = "h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]";
const labelClassName = "text-[11px] font-semibold uppercase tracking-[0.18em] text-outline";
const iconButtonClassName = "flex h-9 w-9 items-center justify-center rounded-[6px] border transition-colors";

/** Sort + rows + view toggle + multi-select toggle. */
export function ProjectListToolbar({
  sort, onSortChange, pageSize, onPageSizeChange, viewMode, onViewModeChange,
  selectMode, onToggleSelectMode, canSelect, disabled,
}) {
  const { t } = useLanguage();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      {canSelect ? (
        <button
          type="button"
          onClick={onToggleSelectMode}
          disabled={disabled}
          className={`inline-flex h-9 items-center gap-1.5 rounded-[6px] border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${selectMode
            ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{selectMode ? "check_box" : "checklist"}</span>
          {selectMode ? t("Done selecting") : t("Select")}
        </button>
      ) : null}

      <div className="flex items-center gap-2">
        <span className={labelClassName}>{t("Sort")}</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value)} className={selectClassName} disabled={disabled}>
          {PROJECT_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.label)}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={labelClassName}>{t("Rows")}</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className={selectClassName} disabled={disabled}>
          {PROJECT_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1" role="group" aria-label={t("View")}>
        {[
          { value: "thumbnail", icon: "grid_view", label: t("Thumbnail view") },
          { value: "list", icon: "view_list", label: t("List view") },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onViewModeChange(option.value)}
            aria-pressed={viewMode === option.value}
            aria-label={option.label}
            title={option.label}
            className={`${iconButtonClassName} ${viewMode === option.value
              ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{option.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** "N projects, showing a-b" on the left, page buttons on the right (like the Master DB table footer). */
export function ProjectPagerBar({ total, page, pageSize, totalPages, onPageChange, disabled }) {
  const { t } = useLanguage();
  if (!total) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-[var(--border)] px-1 pt-4 md:flex-row md:items-center md:justify-between">
      <span className="text-sm text-on-surface-variant">
        {t("{total} projects, showing {start}-{end}", { total, start, end })}
      </span>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        previousLabel={t("Previous")}
        nextLabel={t("Next")}
        disabled={disabled}
      />
    </div>
  );
}

/** Appears while selecting: count, select page / all matching, clear, and the bulk actions. */
export function ProjectBulkBar({
  selectedCount, pageCount, allOnPageSelected, total, allMatchingSelected, busy,
  canEdit, canDelete, onSelectPage, onSelectAllMatching, onClear, onMove, onCopy, onTag, onDelete,
}) {
  const { t } = useLanguage();
  const actionClassName = "inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="sticky top-16 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--freya-blue)]/30 bg-[var(--surface)] px-3 py-2 shadow-sm">
      <span className="text-sm font-bold text-on-surface">{t("{count} selected", { count: selectedCount })}</span>

      <button type="button" onClick={onSelectPage} disabled={busy || !pageCount} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
        {allOnPageSelected ? t("Unselect this page") : t("Select this page ({count})", { count: pageCount })}
      </button>
      {total > pageCount && !allMatchingSelected ? (
        <button type="button" onClick={onSelectAllMatching} disabled={busy} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
          {t("Select all {total} matching", { total })}
        </button>
      ) : null}
      {selectedCount ? (
        <button type="button" onClick={onClear} disabled={busy} className="text-xs font-semibold text-on-surface-variant hover:underline disabled:opacity-50">
          {t("Clear selection")}
        </button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canEdit ? (
          <button type="button" onClick={onTag} disabled={busy || !selectedCount} className={actionClassName}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sell</span>
            {t("Tags")}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={onMove} disabled={busy || !selectedCount} className={actionClassName}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>drive_file_move</span>
            {t("Move")}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={onCopy} disabled={busy || !selectedCount} className={actionClassName}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>playlist_add</span>
            {t("Copy")}
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" onClick={onDelete} disabled={busy || !selectedCount} className={`${actionClassName} hover:!bg-red-600 hover:!text-white`}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            {t("Delete")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Fixed bottom-right slider that scales the thumbnails / cards (handy on small screens). */
export function ProjectZoomSlider({ value, onChange }) {
  const { t } = useLanguage();

  return (
    <div className="fixed bottom-5 right-5 z-[300] flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 shadow-lg">
      <button
        type="button"
        onClick={() => onChange(Math.max(PROJECT_ZOOM_MIN, value - 20))}
        aria-label={t("Zoom out")}
        title={t("Zoom out")}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>zoom_out</span>
      </button>
      <input
        type="range"
        min={PROJECT_ZOOM_MIN}
        max={PROJECT_ZOOM_MAX}
        step={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={t("Thumbnail size")}
        className="h-1 w-28 cursor-pointer accent-[var(--freya-blue)] sm:w-36"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(PROJECT_ZOOM_MAX, value + 20))}
        aria-label={t("Zoom in")}
        title={t("Zoom in")}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>zoom_in</span>
      </button>
    </div>
  );
}
