import { createPortal } from "react-dom";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import IconButton from "../components/IconButton";
import PageHeader from "../components/PageHeader";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";
import StatSummaryCard from "../components/StatSummaryCard";
import TicketSubmissionsFilterPanel from "../components/TicketSubmissionsFilterPanel";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchCheckFormTemplateById, fetchNgTicketExport, fetchNgTicketFilterOptions, fetchNgTicketPage, translateTextApi, updateNgTicketRecord, uploadMaintenanceImage } from "../services/api";
import { getAuthDisplayName, readStoredAuthUser } from "../utils/auth";
import {
  buildTicketSubmissionAdvancedFilterClauses,
  buildTicketSubmissionExportMatrix,
  buildTicketSubmissionPageInfo,
  createTicketSubmissionFilterRow,
  downloadTicketCsvFile,
  EMPTY_TICKET_SUMMARY,
  formatTicketDateTime,
  formatTicketNumber,
  formatTicketRange,
  formatTicketStatusLabel,
  TICKET_SUBMISSION_ADVANCED_FILTER_FIELDS,
  TICKET_SUBMISSION_IMAGE_OPTIONS,
  TICKET_SUBMISSION_PAGE_SIZE_OPTIONS,
} from "../utils/ticketSubmissions";

const EMPTY_PAGINATION = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: TICKET_SUBMISSION_PAGE_SIZE_OPTIONS[0],
};

const EMPTY_FILTER_OPTIONS = {
  factories: [],
  machineNames: [],
  formNames: [],
  completedBy: [],
  statuses: [],
  fieldLabels: [],
  fieldTypes: [],
};

const MAX_SAVED_TICKET_PRESETS = 8;
const DEFAULT_TICKET_SORT = { column: "createdAt", direction: -1 };

function toDayStart(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDateInputValue(value) {
  const parsed = toDayStart(value);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultDateRange() {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate),
  };
}

function formatDateRangeLabel(startDate, endDate) {
  const parsedStart = toDayStart(startDate);
  const parsedEnd = toDayStart(endDate);
  if (!parsedStart || !parsedEnd) return "All dates";

  const startLabel = parsedStart.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  const endLabel = parsedEnd.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildTicketPresetStorageKey(username) {
  const normalizedUsername = String(username ?? "").trim() || "anonymous";
  return `ticket-submission-presets:${normalizedUsername}`;
}

function cloneTicketFilterRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    value: Array.isArray(row?.value) ? [...row.value] : row?.value ?? "",
  }));
}

function cloneTicketAdvancedClauses(clauses = []) {
  return clauses.map((clause) => ({
    ...clause,
    value: Array.isArray(clause?.value) ? [...clause.value] : clause?.value,
  }));
}

function readTicketSubmissionPresets(storageKey) {
  if (!hasBrowserStorage()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((preset) => preset && typeof preset === "object")
      .map((preset) => ({
        id: String(preset.id ?? "").trim() || `ticket-preset-${Date.now()}`,
        name: String(preset.name ?? "").trim(),
        createdAt: String(preset.createdAt ?? preset.updatedAt ?? "").trim(),
        updatedAt: String(preset.updatedAt ?? preset.createdAt ?? "").trim(),
        filters: {
          keyword: String(preset?.filters?.keyword ?? "").trim(),
          factory: String(preset?.filters?.factory ?? "").trim(),
          status: String(preset?.filters?.status ?? "").trim(),
        },
        dateRange: {
          startDate: String(preset?.dateRange?.startDate ?? "").trim(),
          endDate: String(preset?.dateRange?.endDate ?? "").trim(),
        },
        advancedRows: cloneTicketFilterRows(Array.isArray(preset.advancedRows) ? preset.advancedRows : []),
        appliedAdvancedFilters: cloneTicketAdvancedClauses(Array.isArray(preset.appliedAdvancedFilters) ? preset.appliedAdvancedFilters : []),
        pageSize: Number(preset.pageSize) || TICKET_SUBMISSION_PAGE_SIZE_OPTIONS[0],
        sort: {
          column: String(preset?.sort?.column ?? "createdAt"),
          direction: Number(preset?.sort?.direction) === 1 ? 1 : -1,
        },
      }))
      .filter((preset) => preset.name);
  } catch {
    return [];
  }
}

function createTicketPresetId() {
  return `ticket-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTicketExportFileName() {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `submitted-tickets-${year}${month}${day}-${hours}${minutes}.csv`;
}

function buildTicketFocusHint(ticket) {
  return {
    fieldId: String(ticket?.fieldId ?? "").trim(),
    label: String(ticket?.fieldLabel ?? "").trim().toLowerCase(),
  };
}

function createTicketRowsFromClauses(clauses = []) {
  return clauses.map((clause) => ({
    ...createTicketSubmissionFilterRow(),
    field: String(clause?.field ?? "").trim(),
    operator: String(clause?.operator ?? "").trim(),
    value: clause?.operator === "range"
      ? ""
      : Array.isArray(clause?.value)
        ? [...clause.value]
        : clause?.value ?? "",
    valueFrom: clause?.operator === "range" ? String(clause?.valueFrom ?? "") : "",
    valueTo: clause?.operator === "range" ? String(clause?.valueTo ?? "") : "",
  }));
}

function parseTicketAdvancedFiltersParam(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return cloneTicketAdvancedClauses(parsed.filter((clause) => clause && typeof clause === "object"));
  } catch {
    return [];
  }
}

function parseTicketViewState(searchParams) {
  const defaultDateRange = createDefaultDateRange();
  const parsedAdvancedFilters = parseTicketAdvancedFiltersParam(searchParams.get("advanced"));
  const parsedPageSize = Number(searchParams.get("pageSize"));
  const pageSize = TICKET_SUBMISSION_PAGE_SIZE_OPTIONS.includes(parsedPageSize)
    ? parsedPageSize
    : TICKET_SUBMISSION_PAGE_SIZE_OPTIONS[0];
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sortDirection = Number(searchParams.get("direction")) === 1 ? 1 : -1;
  const sortColumn = String(searchParams.get("sort") ?? DEFAULT_TICKET_SORT.column).trim() || DEFAULT_TICKET_SORT.column;

  return {
    filters: {
      keyword: String(searchParams.get("keyword") ?? "").trim(),
      factory: String(searchParams.get("factory") ?? "").trim(),
      status: String(searchParams.get("status") ?? "").trim(),
    },
    dateRange: {
      startDate: String(searchParams.get("startDate") ?? defaultDateRange.startDate).trim() || defaultDateRange.startDate,
      endDate: String(searchParams.get("endDate") ?? defaultDateRange.endDate).trim() || defaultDateRange.endDate,
    },
    advancedRows: parsedAdvancedFilters.length > 0
      ? createTicketRowsFromClauses(parsedAdvancedFilters)
      : [createTicketSubmissionFilterRow()],
    appliedAdvancedFilters: parsedAdvancedFilters,
    page,
    pageSize,
    sort: {
      column: sortColumn,
      direction: sortDirection,
    },
  };
}

function buildTicketViewSearchParams({ appliedAdvancedFilters, dateRange, filters, page, pageSize, sort }) {
  const params = new URLSearchParams();

  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.factory) params.set("factory", filters.factory);
  if (filters.status) params.set("status", filters.status);
  if (dateRange.startDate) params.set("startDate", dateRange.startDate);
  if (dateRange.endDate) params.set("endDate", dateRange.endDate);
  if (Array.isArray(appliedAdvancedFilters) && appliedAdvancedFilters.length > 0) {
    params.set("advanced", JSON.stringify(appliedAdvancedFilters));
  }
  if (page > 1) params.set("page", String(page));
  if (pageSize !== TICKET_SUBMISSION_PAGE_SIZE_OPTIONS[0]) params.set("pageSize", String(pageSize));
  if (sort?.column && sort.column !== DEFAULT_TICKET_SORT.column) params.set("sort", sort.column);
  if (Number(sort?.direction) === 1) params.set("direction", "1");

  return params;
}

async function copyTextToClipboard(value) {
  const text = String(value ?? "");
  if (!text) return false;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const successful = document.execCommand("copy");
  document.body.removeChild(textarea);
  return successful;
}

function ActionNoticeBanner({ notice, onClose }) {
  if (!notice?.message) return null;

  const tone = notice.type === "error"
    ? "border-error/20 bg-error/10 text-error"
    : notice.type === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={`mb-6 rounded-3xl border px-5 py-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Status</p>
          <p className="mt-1 text-sm font-medium">{notice.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

function SavedPresetManagerCard({ activePresetId, draftName, editingPresetId, onApply, onCancelEdit, onDelete, onDraftNameChange, onRename, onSave, presets }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Saved Views</p>
          <h3 className="mt-1 text-lg font-semibold text-on-surface">Supervisor Presets</h3>
          <p className="mt-2 text-sm leading-6 text-outline">
            Save repeated ticket review filters in this browser, then reapply them in one click.
          </p>
        </div>
        {activePresetId && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Active preset
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          placeholder={editingPresetId ? "Rename this preset" : "Name this filter view"}
          className="h-11 flex-1 rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!draftName.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{editingPresetId ? "drive_file_rename_outline" : "bookmark_added"}</span>
          {editingPresetId ? "Rename Preset" : "Save Current View"}
        </button>
        {editingPresetId && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-separator/40 bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            Cancel
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {presets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container/35 px-4 py-5 text-sm text-outline">
            No presets saved yet. Save your first supervisor view to reuse the same ticket filters later.
          </div>
        ) : presets.map((preset) => {
          const isActive = preset.id === activePresetId;

          return (
            <div
              key={preset.id}
              className={`rounded-2xl border px-4 py-4 ${isActive ? "border-primary/30 bg-primary/5" : "border-outline-variant/20 bg-surface-container"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-on-surface">{preset.name}</h4>
                    {isActive && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-outline">Updated {formatTicketDateTime(preset.updatedAt || preset.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onApply(preset)}
                    className="inline-flex items-center gap-2 rounded-xl border border-separator/40 bg-white px-3 py-2 text-xs font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => onRename(preset)}
                    className="inline-flex items-center gap-2 rounded-xl border border-separator/40 bg-white px-3 py-2 text-xs font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>drive_file_rename_outline</span>
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(preset)}
                    className="inline-flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/10"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExportTicketResultsCard({ disabled, exporting, filteredCount, onCopyShareLink, onExport, shareButtonLabel }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Export</p>
      <h3 className="mt-1 text-lg font-semibold text-on-surface">Filtered Ticket CSV</h3>
      <p className="mt-3 text-sm leading-6 text-outline">
        Export the current ticket view or the full submitted-ticket history. Large all-data exports may take longer than filtered exports.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-separator/40 bg-surface px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Current Export Scope</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">{formatTicketNumber(filteredCount)} matching tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopyShareLink}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-separator/40 bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span>
            {shareButtonLabel}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={disabled || exporting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            {exporting ? "Preparing CSV..." : "Export CSV"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-outline">
        Share link copies the current filters, advanced filters, sort, page size, and page into URL query params.
      </p>
    </div>
  );
}

function ExportChoiceModal({ filteredCount, onClose, onExportAll, onExportFiltered }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="dashboard-section flex w-full max-w-xl flex-col overflow-hidden rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-separator/40 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Export Choice</p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">Choose what to export</h3>
            <p className="mt-2 text-sm leading-6 text-outline">
              The current view may already be narrowed by date range, quick filters, advanced filters, or sort. Choose whether to export that filtered view or the full ticket history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onExportFiltered}
            className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-left transition hover:border-primary/35 hover:bg-primary/10"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Current View</p>
            <p className="mt-2 text-base font-semibold text-on-surface">Export filtered data</p>
            <p className="mt-2 text-sm leading-6 text-outline">
              Exports the same filtered ticket set currently shown in the table. Matching tickets: {formatTicketNumber(filteredCount)}.
            </p>
          </button>

          <button
            type="button"
            onClick={onExportAll}
            className="rounded-2xl border border-separator/40 bg-surface-container px-4 py-4 text-left transition hover:border-primary/30 hover:bg-surface-container-high"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Full History</p>
            <p className="mt-2 text-base font-semibold text-on-surface">Export all data</p>
            <p className="mt-2 text-sm leading-6 text-outline">
              Ignores the current filters and exports every submitted ticket. This may take longer for larger datasets.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

function getTicketKey(ticket) {
  return [
    String(ticket?.ticketId ?? "").trim(),
    String(ticket?._id?.$oid ?? ticket?._id ?? "").trim(),
    String(ticket?.recordId ?? "").trim(),
    String(ticket?.fieldId ?? "").trim(),
    String(ticket?.createdAt ?? "").trim(),
  ].filter(Boolean).join("::") || "ticket-row";
}

function normalizeTicketStatusValue(status) {
  return String(status ?? "open").trim().toLowerCase() || "open";
}

function getTicketStatusMeta(status) {
  const normalizedStatus = normalizeTicketStatusValue(status);

  if (normalizedStatus === "resolved" || normalizedStatus === "closed") {
    return {
      label: formatTicketStatusLabel(status),
      badgeClassName: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    };
  }

  if (normalizedStatus === "open") {
    return {
      label: formatTicketStatusLabel(status),
      badgeClassName: "bg-error/10 text-error",
    };
  }

  if (normalizedStatus === "in progress" || normalizedStatus === "reviewing" || normalizedStatus === "pending") {
    return {
      label: formatTicketStatusLabel(status),
      badgeClassName: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }

  return {
    label: formatTicketStatusLabel(status),
    badgeClassName: "bg-error/10 text-error",
  };
}

function formatTicketHistoryAction(entry = {}, t = (k) => k) {
  const fromStatus = normalizeTicketStatusValue(entry.fromStatus);
  const toStatus = normalizeTicketStatusValue(entry.toStatus);

  if (toStatus === "closed") return t("ticketClosed") || "Ticket Closed";
  if (fromStatus === "closed" && toStatus === "open") return t("ticketReopened") || "Ticket Reopened";
  if (toStatus === "open") return t("ticketOpened") || "Ticket Opened";

  if (entry.action) {
    if (entry.action === "Ticket Closed") return t("ticketClosed") || "Ticket Closed";
    if (entry.action === "Ticket Reopened") return t("ticketReopened") || "Ticket Reopened";
    return entry.action;
  }

  return t("statusUpdated") || "Status Updated";
}

function sortTicketHistoryEntries(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left?.timestamp ?? 0).getTime();
    const rightTime = new Date(right?.timestamp ?? 0).getTime();
    return rightTime - leftTime;
  });
}

function SummaryCard({ accent, icon, label, subtitle, value }) {
  return (
    <StatSummaryCard
      icon={icon}
      label={label}
      value={value}
      subtitle={subtitle}
      accent={accent}
      valueClassName="text-2xl font-semibold tabular-nums"
      labelClassName="text-[11px] font-semibold text-on-surface-variant"
      subtitleClassName="text-[10px] text-outline"
      iconClassName="shadow-none"
    />
  );
}

function TicketStatusPill({ status }) {
  const meta = getTicketStatusMeta(status);

  return (
    <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.badgeClassName)}>
      {meta.label}
    </span>
  );
}

function TemplateQuickPeekModal({ templateId, activeFieldId, onClose }) {
  const { language, t } = useLanguage();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!templateId) {
        setError(t("failedToLoadTemplate") || "No template ID.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchCheckFormTemplateById(templateId);
        if (active) {
          setTemplate(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || t("failedToLoadTemplate") || "Failed to load template");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [templateId, t]);

  const templateName = language === "en" ? (template?.name_en || template?.name) : (template?.name_ja || template?.name);
  const templateDesc = language === "en" ? (template?.description_en || template?.description) : (template?.description_ja || template?.description);

  const templateImages = useMemo(() => {
    if (!Array.isArray(template?.fields)) return [];
    return template.fields
      .filter((field) => Boolean(field.imageURL))
      .map((field) => ({
        url: field.imageURL,
        label: language === "en" ? (field.label_en || field.label) : (field.label_ja || field.label),
      }));
  }, [template?.fields, language]);

  function openFieldPreviewImage(fieldImageUrl) {
    const foundIndex = templateImages.findIndex((img) => img.url === fieldImageUrl);
    if (foundIndex < 0) return;
    setPreviewImage({
      activeIndex: foundIndex,
      images: templateImages,
    });
  }

  function handlePreviewNavigate(direction) {
    setPreviewImage((current) => {
      const images = Array.isArray(current?.images) ? current.images : [];
      const currentIndex = Number.isInteger(current?.activeIndex) ? current.activeIndex : 0;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= images.length) return current;
      return { ...current, activeIndex: nextIndex };
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-surface" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-separator/40 bg-surface-container px-6 py-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary uppercase tracking-wider">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>assignment</span>
                {t("quickPeekTemplate") || "Quick Peek Template"}
              </span>
              <h3 className="mt-1 text-base font-extrabold text-on-surface">{templateName || (t("loadingTemplate") || "Loading...")}</h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-outline hover:bg-surface-container-high transition">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-outline gap-3">
                <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 28 }}>sync</span>
                <p className="text-sm font-medium">{t("loadingTemplate") || "Loading template..."}</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center text-sm font-semibold text-red-600">
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-separator/40 bg-surface-container-low p-4">
                  {templateDesc && <p className="text-xs text-outline leading-relaxed whitespace-pre-line mb-3">{templateDesc}</p>}
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-outline">
                    {template?.工場 && (
                      <span className="rounded-lg bg-black/5 dark:bg-white/10 px-2.5 py-1 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>factory</span>
                        {template.工場}
                      </span>
                    )}
                    {template?.schedule && (
                      <span className="rounded-lg bg-black/5 dark:bg-white/10 px-2.5 py-1 flex items-center gap-1 capitalize">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event_repeat</span>
                        {template.schedule}
                      </span>
                    )}
                    {Array.isArray(template?.fields) && (
                      <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-primary font-bold">
                        {template.fields.length} Check Items
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-outline">Checklist Items ({template?.fields?.length || 0})</p>
                  {Array.isArray(template?.fields) && template.fields.map((f, idx) => {
                    const isCurrentItem = activeFieldId && (String(f.id) === String(activeFieldId));
                    const label = language === "en" ? (f.label_en || f.label) : (f.label_ja || f.label);
                    const desc = language === "en" ? (f.description_en || f.description) : (f.description_ja || f.description);

                    return (
                      <div
                        key={f.id || idx}
                        className={joinClasses(
                          "rounded-2xl border p-4 transition-all",
                          isCurrentItem
                            ? "border-red-500/40 bg-red-500/5 shadow-sm ring-2 ring-red-500/20 dark:bg-red-950/20"
                            : "border-separator/40 bg-surface-container hover:border-separator/80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-bold text-outline">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {isCurrentItem && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
                                    {t("currentTicketItem") || "Current Ticket Item (NG)"}
                                  </span>
                                )}
                                {f.timing && (
                                  <span className="rounded-md bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-outline">
                                    {f.timing === "pre" ? (t("preProductionTiming") || "Pre-Production") : (t("postProductionTiming") || "Post-Production")}
                                  </span>
                                )}
                                <span className="rounded-md bg-outline/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-outline">
                                  {f.type || "toggle"}
                                </span>
                              </div>

                              <p className="mt-1.5 text-sm font-bold text-on-surface leading-snug">{label || "Untitled check item"}</p>
                              {desc && <p className="mt-1 text-xs text-outline leading-relaxed whitespace-pre-line">{desc}</p>}
                            </div>
                          </div>

                          {f.imageURL && (
                            <button
                              type="button"
                              onClick={() => openFieldPreviewImage(f.imageURL)}
                              className="group relative shrink-0 overflow-hidden rounded-xl border border-separator/40 w-16 h-16 bg-black/5 block shadow-xs transition hover:border-primary hover:shadow-md active:scale-95 cursor-pointer"
                            >
                              <img src={f.imageURL} alt={label} className="w-full h-full object-cover transition group-hover:scale-105" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                                <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>zoom_in</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SensorDevicePhotoPreviewModal
        preview={previewImage ? {
          ...previewImage,
          eyebrow: "Checklist Template Reference Photo",
          displayName: templateName || "Template Reference Photo",
          subtitle: template?.工場 || undefined
        } : null}
        onClose={() => setPreviewImage(null)}
        onNavigate={handlePreviewNavigate}
      />
    </>
  );
}

function TicketDetailModal({ actionBusy = false, onClose, onCloseTicket = null, onOpenChecklistSubmission = null, onReopenTicket = null, ticket }) {
  const { language, t } = useLanguage();
  const [previewImage, setPreviewImage] = useState(null);
  const [peekTemplateId, setPeekTemplateId] = useState(null);
  const statusMeta = getTicketStatusMeta(ticket?.status);
  const expectedRange = formatTicketRange(ticket);
  const normalizedStatus = normalizeTicketStatusValue(ticket?.status);
  const activeFixReason = language === "en"
    ? (ticket?.fixReason_en || ticket?.fixReason)
    : (ticket?.fixReason_ja || ticket?.fixReason);
  const activeFieldLabel = language === "en"
    ? (ticket?.fieldLabel_en || ticket?.fieldLabel)
    : (ticket?.fieldLabel_ja || ticket?.fieldLabel);
  const activeFormName = language === "en"
    ? (ticket?.formName_en || ticket?.formName)
    : (ticket?.formName_ja || ticket?.formName);

  const historyEntries = useMemo(
    () => sortTicketHistoryEntries(Array.isArray(ticket?.statusHistory) ? ticket.statusHistory : []),
    [ticket?.statusHistory]
  );
  const previewImages = useMemo(() => {
    if (!Array.isArray(ticket?.imageURLs)) return [];

    return ticket.imageURLs
      .filter(Boolean)
      .map((imageUrl, index) => ({
        url: imageUrl,
        label: `${ticket?.fieldLabel || "Ticket image"} ${index + 1}`,
      }));
  }, [ticket?.fieldLabel, ticket?.imageURLs]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !previewImage?.images?.length) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, previewImage?.images?.length]);

  function openPreviewImage(index) {
    if (!previewImages[index]?.url) return;

    setPreviewImage({
      activeIndex: index,
      images: previewImages,
    });
  }

  function handlePreviewNavigate(direction) {
    setPreviewImage((current) => {
      const images = Array.isArray(current?.images) ? current.images : [];
      const currentIndex = Number.isInteger(current?.activeIndex) ? current.activeIndex : 0;
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= images.length) {
        return current;
      }

      return {
        ...current,
        activeIndex: nextIndex,
      };
    });
  }

  if (!ticket) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div
          className="dashboard-section flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-surface"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {/* Hero Header Banner */}
          <div className={joinClasses(
            "relative px-6 py-5 border-b flex flex-wrap items-center justify-between gap-4 transition-colors",
            normalizedStatus === "closed"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-500/30 dark:text-emerald-200"
              : "bg-red-500/10 border-red-500/20 text-red-950 dark:bg-red-950/30 dark:border-red-500/30 dark:text-red-200"
          )}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={joinClasses(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm",
                  normalizedStatus === "closed"
                    ? "bg-emerald-600 text-white"
                    : "bg-red-600 text-white animate-pulse"
                )}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {normalizedStatus === "closed" ? "check_circle" : "warning"}
                  </span>
                  {normalizedStatus === "closed" ? (t("ticketResolvedClosed") || "Resolved & Closed") : (t("openActionRequired") || "Action Required • Open Ticket")}
                </span>
                {ticket.ticketNo != null && (
                  <span className="text-xs font-bold opacity-75">#{ticket.ticketNo}</span>
                )}
              </div>

              <h2 className="mt-2 text-xl font-extrabold tracking-tight truncate">
                {activeFieldLabel || "Untitled NG Check Item"}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 dark:bg-white/10">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>factory</span>
                  {ticket.factory || "Factory"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 dark:bg-white/10">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>precision_manufacturing</span>
                  {ticket.machineName || ticket.加工設備 || "Equipment"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 dark:bg-white/10">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>assignment</span>
                  {activeFormName || "Form"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {normalizedStatus === "closed" ? (
                <button
                  type="button"
                  onClick={onReopenTicket}
                  disabled={actionBusy || !onReopenTicket}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>
                  {actionBusy ? "Reopening..." : (t("reopenTicketBtn") || "Reopen Ticket")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCloseTicket}
                  disabled={actionBusy || !onCloseTicket}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-red-700 active:scale-95 transition disabled:opacity-50 animate-bounce"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>
                  {actionBusy ? "Closing..." : (t("closeAndResolveTicketBtn") || "Close & Resolve Ticket")}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-outline hover:bg-black/10 dark:hover:bg-white/10 transition active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
          </div>

          {/* Subheader info bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator/30 bg-surface-container-low px-6 py-3 text-xs text-outline">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>schedule</span>
                {formatTicketDateTime(ticket.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
                {ticket.completedBy || "Unknown operator"}
              </span>
              {ticket.recordId && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>fingerprint</span>
                  {ticket.recordId}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(ticket.templateId || ticket.formId) && (
                <button
                  type="button"
                  onClick={() => setPeekTemplateId(ticket.templateId || ticket.formId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 font-semibold text-primary shadow-xs hover:border-primary/40 hover:bg-primary/10 transition active:scale-95"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                  {t("quickPeekTemplate") || "Quick Peek Template"}
                </button>
              )}

              {onOpenChecklistSubmission && ticket.recordId && (
                <button
                  type="button"
                  onClick={onOpenChecklistSubmission}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-separator/50 bg-white px-3 py-1.5 font-semibold text-on-surface shadow-sm hover:border-primary hover:text-primary transition active:scale-95 dark:bg-surface-container"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                  {t("viewFullChecklist") || "View Full Checklist"}
                </button>
              )}
            </div>
          </div>

          {/* Body Split Grid */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-2">
              
              {/* Left Column: The Problem */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-separator/30 pb-2">
                  <span className="material-symbols-outlined text-red-500" style={{ fontSize: 20 }}>report_problem</span>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-on-surface">
                    {t("theProblem") || "The Problem"}
                  </h4>
                </div>

                {/* Problem Box */}
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 dark:bg-red-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">
                    {t("operatorNgReason") || "Operator NG Reason"}
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-on-surface">
                    {ticket.reason ? `"${ticket.reason}"` : "No specific reason text provided."}
                  </p>
                </div>

                {/* Value & Range Card */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-separator/40 bg-surface-container p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-outline">{t("submittedValue") || "Submitted Value"}</p>
                    <p className="mt-1 text-sm font-extrabold text-red-600 dark:text-red-400">{ticket.answerValue || "NG"}</p>
                  </div>
                  <div className="rounded-2xl border border-separator/40 bg-surface-container p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                      {ticket.min != null || ticket.max != null ? (t("allowedRange") || "Allowed Range") : (t("expectedValue") || "Expected Value")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-on-surface">{expectedRange || "OK"}</p>
                  </div>
                </div>

                {/* Defect Images */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-outline mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>photo_library</span>
                    {t("defectEvidencePhotos") || "Defect Evidence Photos"} ({previewImages.length})
                  </p>

                  {previewImages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-separator/50 bg-surface-container-low p-4 text-center text-xs text-outline">
                      {t("noDefectPhotos") || "No defect photos attached."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {previewImages.map((imgObj, idx) => (
                        <div
                          key={imgObj.url || idx}
                          onClick={() => openPreviewImage(idx)}
                          className="group relative aspect-video cursor-pointer overflow-hidden rounded-2xl border border-separator/40 bg-black/5 shadow-sm transition hover:shadow-md hover:border-primary"
                        >
                          <img src={imgObj.url} alt={`Defect photo ${idx + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                            <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>zoom_in</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: The Solution & Audit Trail */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-separator/30 pb-2">
                  <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: 20 }}>verified</span>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-on-surface">
                    {t("theSolution") || "The Solution & Resolution"}
                  </h4>
                </div>

                {/* Resolution Details Card */}
                {normalizedStatus === "closed" ? (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Resolved by {ticket.closedBy || ticket.closedByUsername || "Maintenance User"}
                      </span>
                      <span className="text-[10px] text-outline">{formatTicketDateTime(ticket.closedAt)}</span>
                    </div>

                    {activeFixReason ? (
                      <p className="text-sm font-medium leading-relaxed text-on-surface flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 mt-0.5" style={{ fontSize: 16 }}>build</span>
                        <span>{activeFixReason}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-outline">{t("noResolutionProvided") || "No resolution notes recorded yet."}</p>
                    )}

                    {/* Resolution Photo if attached */}
                    {Array.isArray(ticket.fixImageURLs) && ticket.fixImageURLs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">
                          {t("resolutionEvidencePhoto") || "Fix Photo / Evidence"}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {ticket.fixImageURLs.map((fixUrl, fIdx) => (
                            <a key={fixUrl || fIdx} href={fixUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-emerald-500/30 aspect-video hover:opacity-90">
                              <img src={fixUrl} alt="Resolution photo" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold flex items-center gap-1.5 text-sm mb-1 text-amber-700 dark:text-amber-400">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_empty</span>
                      {t("awaitingMaintenanceResolution") || "Awaiting Maintenance Resolution"}
                    </p>
                    <p className="mt-1 leading-relaxed opacity-90">
                      {t("awaitingResolutionDescription") || "This ticket is currently OPEN. Click the red \"Close & Resolve Ticket\" button above once maintenance has completed the fix."}
                    </p>
                  </div>
                )}

                {/* Audit Trail Timeline */}
                <div className="rounded-2xl border border-separator/40 bg-surface-container p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>history</span>
                    {t("auditHistory") || "Audit History"} ({historyEntries.length})
                  </p>

                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {historyEntries.length === 0 ? (
                      <p className="text-xs text-outline">No history events recorded yet.</p>
                    ) : historyEntries.map((entry, index) => {
                      const isClosure = normalizeTicketStatusValue(entry.toStatus) === "closed";
                      const entryNote = isClosure
                        ? (language === "en" ? (entry.fixReason_en || entry.fixReason || entry.comment) : (entry.fixReason_ja || entry.fixReason || entry.comment))
                        : (entry.reason || entry.comment);

                      return (
                        <div key={entry.timestamp || index} className="rounded-xl border border-separator/30 bg-white/70 p-2.5 dark:bg-surface text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span className={isClosure ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1" : "text-red-600 dark:text-red-400 flex items-center gap-1"}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                {isClosure ? "check_circle" : "published_with_changes"}
                              </span>
                              {formatTicketHistoryAction(entry, t)}
                            </span>
                            <span className="text-[10px] text-outline">{formatTicketDateTime(entry.timestamp)}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-outline">By: {entry.user || entry.username || "System"}</p>
                          {entryNote && <p className="mt-1 text-xs text-on-surface/80 italic">"{entryNote}"</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SensorDevicePhotoPreviewModal
        preview={previewImage ? { ...previewImage, eyebrow: "Ticket Photos", displayName: activeFieldLabel || "Ticket image", subtitle: ticket?.factory || activeFormName || undefined } : null}
        onClose={() => setPreviewImage(null)}
        onNavigate={handlePreviewNavigate}
      />

      {peekTemplateId && (
        <TemplateQuickPeekModal
          templateId={peekTemplateId}
          activeFieldId={ticket?.fieldId}
          onClose={() => setPeekTemplateId(null)}
        />
      )}
    </>
  );
}

function ResolveTicketModal({ ticket, onClose, onConfirm, busy }) {
  const { language, t } = useLanguage();
  const activeFieldLabel = language === "en"
    ? (ticket?.fieldLabel_en || ticket?.fieldLabel)
    : (ticket?.fieldLabel_ja || ticket?.fieldLabel);
  const [fixReason, setFixReason] = useState("");
  const [fixPhotoBase64, setFixPhotoBase64] = useState("");
  const [fixPhotoPreview, setFixPhotoPreview] = useState("");
  const [err, setErr] = useState("");
  const [translating, setTranslating] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFixPhotoBase64(evt.target.result);
      setFixPhotoPreview(evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fixReason.trim()) {
      setErr(t("fixReasonRequiredErr") || "Resolution details are required to close this ticket.");
      return;
    }

    setTranslating(true);
    let fixReason_ja = fixReason.trim();
    let fixReason_en = fixReason.trim();

    const hasJapanese = /[一-龠ぁ-ゔァ-ヴー]/.test(fixReason);
    try {
      if (hasJapanese) {
        const translatedEn = await translateTextApi(fixReason.trim(), "ja|en");
        if (translatedEn && typeof translatedEn === "string") {
          fixReason_en = translatedEn.trim();
        }
      } else {
        const translatedJa = await translateTextApi(fixReason.trim(), "en|ja");
        if (translatedJa && typeof translatedJa === "string") {
          fixReason_ja = translatedJa.trim();
        }
      }
    } catch (translateErr) {
      console.warn("Auto-translate of resolution reason failed:", translateErr);
    } finally {
      setTranslating(false);
    }

    onConfirm({
      fixReason: fixReason.trim(),
      fixReason_ja,
      fixReason_en,
      fixPhotoBase64,
    });
  };

  const isSubmitting = busy || translating;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-surface-container shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-separator/40 pb-3">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 20 }}>task_alt</span>
            {t("resolveNgTicket") || "Resolve NG Ticket"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-outline hover:bg-surface-container">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <p className="mt-2 text-xs text-outline font-medium">
          {activeFieldLabel || "NG Item"} • {ticket?.machineName || ticket?.加工設備 || "Equipment"} ({ticket?.factory || ""})
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              {t("resolutionDetailsLabel") || "How did you fix it?"} <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={fixReason}
              onChange={(e) => { setFixReason(e.target.value); setErr(""); }}
              placeholder={t("resolutionDetailsPlaceholder") || "e.g. Cleaned and adjusted the valve..."}
              className="w-full rounded-xl border border-separator/50 bg-surface-container-low p-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              {t("fixPhotoEvidenceLabel") || "Fix Photo / Evidence"}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-xs text-outline file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
            />
            {fixPhotoPreview && (
              <div className="mt-2 relative w-24 h-24 rounded-xl overflow-hidden border border-separator">
                <img src={fixPhotoPreview} alt="Fix evidence" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setFixPhotoBase64(""); setFixPhotoPreview(""); }}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            )}
          </div>

          {err && <p className="text-xs font-semibold text-red-600">{err}</p>}

          <div className="mt-2 flex items-center justify-end gap-3 pt-2 border-t border-separator/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-separator px-4 py-2 text-xs font-semibold text-outline hover:bg-surface-container"
            >
              {t("cancel") || "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
              {isSubmitting ? (t("resolvingBtn") || "Resolving...") : (t("confirmCloseTicketBtn") || "Confirm & Close Ticket")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TicketSubmissionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const [authUser] = useState(() => readStoredAuthUser());
  const actorName = useMemo(() => getAuthDisplayName(authUser), [authUser]);
  const initialViewRef = useRef(null);
  const requestIdRef = useRef(0);
  if (initialViewRef.current == null) {
    initialViewRef.current = parseTicketViewState(searchParams);
  }

  const [filters, setFilters] = useState(() => initialViewRef.current.filters);
  const [dateRange, setDateRange] = useState(() => initialViewRef.current.dateRange);
  const [advancedRows, setAdvancedRows] = useState(() => initialViewRef.current.advancedRows);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState(() => initialViewRef.current.appliedAdvancedFilters);
  const [page, setPage] = useState(() => initialViewRef.current.page);
  const [pageSize, setPageSize] = useState(() => initialViewRef.current.pageSize);
  const [sort, setSort] = useState(() => initialViewRef.current.sort);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_TICKET_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [filterOptions, setFilterOptions] = useState(EMPTY_FILTER_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportChoiceOpen, setExportChoiceOpen] = useState(false);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState(() => location.state?.openTicket ?? null);
  const [statusAction, setStatusAction] = useState(null);
  const presetStorageKey = useMemo(() => buildTicketPresetStorageKey(authUser?.username), [authUser?.username]);
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState(() => readTicketSubmissionPresets(buildTicketPresetStorageKey(authUser?.username)));
  const [activePresetId, setActivePresetId] = useState("");
  const [editingPresetId, setEditingPresetId] = useState("");
  const [shareButtonLabel, setShareButtonLabel] = useState("Copy Share Link");

  const deferredKeyword = useDeferredValue(filters.keyword);

  useEffect(() => {
    if (location.state?.openTicket) {
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSavedPresets(readTicketSubmissionPresets(presetStorageKey));
    setPresetName("");
    setActivePresetId("");
    setEditingPresetId("");
  }, [presetStorageKey]);

  useEffect(() => {
    if (!hasBrowserStorage()) return;
    window.localStorage.setItem(presetStorageKey, JSON.stringify(savedPresets));
  }, [presetStorageKey, savedPresets]);

  useEffect(() => {
    if (!actionNotice) return undefined;
    const timeoutId = window.setTimeout(() => setActionNotice(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  useEffect(() => {
    const params = buildTicketViewSearchParams({
      appliedAdvancedFilters,
      dateRange,
      filters,
      page,
      pageSize,
      sort,
    });

    setSearchParams(params, { replace: true });
  }, [appliedAdvancedFilters, dateRange, filters, page, pageSize, setSearchParams, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoadingFilterOptions(true);

    async function loadFilterOptions() {
      try {
        const nextOptions = await fetchNgTicketFilterOptions();
        if (cancelled) return;
        setFilterOptions(nextOptions || EMPTY_FILTER_OPTIONS);
      } catch {
        if (!cancelled) {
          setFilterOptions(EMPTY_FILTER_OPTIONS);
        }
      } finally {
        if (!cancelled) {
          setLoadingFilterOptions(false);
        }
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedTicketStatuses = useMemo(() => {
    const statusSet = new Set(["open", "closed"]);

    filterOptions.statuses.forEach((status) => {
      const normalizedStatus = normalizeTicketStatusValue(status);
      if (normalizedStatus) {
        statusSet.add(normalizedStatus);
      }
    });

    return Array.from(statusSet);
  }, [filterOptions.statuses]);

  const advancedFieldDefinitions = useMemo(() => {
    const optionMap = {
      factory: filterOptions.factories,
      machineName: filterOptions.machineNames,
      formName: filterOptions.formNames,
      completedBy: filterOptions.completedBy,
      status: normalizedTicketStatuses.map(formatTicketStatusLabel),
      fieldLabel: filterOptions.fieldLabels,
      fieldType: filterOptions.fieldTypes,
      hasImages: TICKET_SUBMISSION_IMAGE_OPTIONS,
    };

    return TICKET_SUBMISSION_ADVANCED_FILTER_FIELDS.map((field) => ({
      ...field,
      options: optionMap[field.field] ?? field.options ?? [],
    }));
  }, [filterOptions.completedBy, filterOptions.factories, filterOptions.fieldLabels, filterOptions.fieldTypes, filterOptions.formNames, filterOptions.machineNames, normalizedTicketStatuses]);

  const statusOptions = useMemo(() => {
    return normalizedTicketStatuses.map((status) => ({
      value: status,
      label: formatTicketStatusLabel(status),
    }));
  }, [normalizedTicketStatuses]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;

    async function loadTickets() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchNgTicketPage({
          filters: {
            keyword: deferredKeyword,
            factory: filters.factory,
            status: filters.status,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          },
          advancedFilters: appliedAdvancedFilters,
          page,
          limit: pageSize,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        setRows(Array.isArray(result?.data) ? result.data : []);
        setSummary(result?.summary || EMPTY_TICKET_SUMMARY);
        setPagination(result?.pagination || { ...EMPTY_PAGINATION, itemsPerPage: pageSize });

        if (result?.pagination?.currentPage && result.pagination.currentPage !== page) {
          setPage(result.pagination.currentPage);
        }
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setSummary(EMPTY_TICKET_SUMMARY);
        setPagination({ ...EMPTY_PAGINATION, itemsPerPage: pageSize });
        setError(loadError.message || "Failed to load submitted tickets.");
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadTickets();

    return () => {
      cancelled = true;
    };
  }, [appliedAdvancedFilters, dateRange.endDate, dateRange.startDate, deferredKeyword, filters.factory, filters.status, page, pageSize, refreshNonce, sort]);

  const columns = useMemo(() => ([
    {
      key: "ticketNo",
      label: "Ticket No.",
      width: 104,
      renderCell: (row) => (
        row.ticketNo != null
          ? <span className="font-bold text-on-surface">#{row.ticketNo}</span>
          : <span className="text-outline">—</span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: "Status",
      width: 130,
      align: "center",
      renderCell: (row) => <TicketStatusPill status={row.status} />,
      disableCellWrapper: true,
    },
    {
      key: "location",
      label: "Location & Machine",
      width: 170,
      renderCell: (row) => (
        <div className="flex flex-col gap-0.5 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>precision_manufacturing</span>
            {row.machineName || row.加工設備 || "—"}
          </span>
          <span className="text-[11px] font-medium text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-outline/60" style={{ fontSize: 13 }}>factory</span>
            {row.factory || "—"}
          </span>
        </div>
      ),
      disableCellWrapper: true,
    },
    {
      key: "fieldLabel",
      label: "Check Item & Operator Note",
      width: 320,
      renderCell: (row) => {
        const itemTitle = language === "en" ? (row.fieldLabel_en || row.fieldLabel) : (row.fieldLabel_ja || row.fieldLabel);
        return (
          <div className="py-1">
            <p className="font-bold text-on-surface text-sm leading-snug">{itemTitle || "Untitled check item"}</p>
            {row.reason && (
              <p className="mt-1 text-xs text-outline line-clamp-1 italic bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md border border-separator/20">
                "{row.reason}"
              </p>
            )}
          </div>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "formName",
      label: "Checklist Form",
      width: 200,
      renderCell: (row) => (
        <span className="text-xs text-outline font-medium">{language === "en" ? (row.formName_en || row.formName) : (row.formName_ja || row.formName)}</span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "createdAt",
      label: "Submitted At",
      width: 160,
      renderCell: (row) => <span className="text-xs font-semibold text-on-surface">{formatTicketDateTime(row.createdAt)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "answerValue",
      label: "Submitted Value",
      width: 140,
      renderCell: (row) => <span className="font-bold text-red-600 dark:text-red-400">{row.answerValue || "NG"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "completedBy",
      label: "Submitted By",
      width: 140,
      renderCell: (row) => <span className="text-xs text-outline">{row.completedBy || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "imageCount",
      label: "Photos",
      width: 90,
      align: "center",
      renderCell: (row) => {
        const count = row.imageCount ?? row.imageURLs?.length ?? 0;
        return count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
            {count}
          </span>
        ) : <span className="text-outline/40 text-xs">—</span>;
      },
      disableCellWrapper: true,
    },
  ]), [language]);

  const [resolvingTicket, setResolvingTicket] = useState(null);
  const [resolvingBusy, setResolvingBusy] = useState(false);

  const activeFilters = useMemo(
    () => ({
      ...filters,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    [dateRange.endDate, dateRange.startDate, filters]
  );

  async function handleUpdateTicketStatus(ticket, nextStatus, resolutionPayload = null) {
    if (!ticket) return;

    if (!authUser?.username || !authUser?.role) {
      setActionNotice({ type: "error", message: "Sign in again before updating ticket status." });
      return;
    }

    const currentStatus = normalizeTicketStatusValue(ticket.status);
    const normalizedNextStatus = normalizeTicketStatusValue(nextStatus);
    if (!normalizedNextStatus || currentStatus === normalizedNextStatus) return;

    if (normalizedNextStatus === "closed" && !resolutionPayload) {
      setResolvingTicket(ticket);
      return;
    }

    const ticketId = ticket?._id ?? ticket?.ticketId;
    if (!ticketId) {
      setActionNotice({ type: "error", message: "This ticket is missing its record ID, so the status could not be updated." });
      return;
    }

    const timestamp = new Date().toISOString();
    const fixReason = resolutionPayload?.fixReason || "";
    const fixImageURLs = resolutionPayload?.fixPhotoUrl ? [resolutionPayload.fixPhotoUrl] : [];

    const historyEntry = {
      action: normalizedNextStatus === "closed" ? "Ticket Closed" : "Ticket Reopened",
      fromStatus: currentStatus,
      toStatus: normalizedNextStatus,
      timestamp,
      user: actorName,
      username: authUser.username,
      ...(fixReason ? { fixReason } : {}),
      ...(fixImageURLs.length ? { imageURLs: fixImageURLs } : {}),
    };

    const update = normalizedNextStatus === "closed"
      ? {
        $set: {
          status: "closed",
          closedAt: timestamp,
          closedBy: actorName,
          closedByUsername: authUser.username,
          ...(fixReason ? { fixReason } : {}),
          ...(fixImageURLs.length ? { fixImageURLs } : {}),
        },
        $push: {
          statusHistory: historyEntry,
        },
      }
      : {
        $set: {
          status: "open",
        },
        $push: {
          statusHistory: historyEntry,
        },
      };

    const ticketKey = getTicketKey(ticket);
    setStatusAction({ nextStatus: normalizedNextStatus, ticketKey });
    setError("");

    try {
      await updateNgTicketRecord({
        ticketId,
        update,
        username: authUser.username,
        role: authUser.role,
      });

      const optimisticTicket = {
        ...ticket,
        closedAt: normalizedNextStatus === "closed" ? timestamp : ticket.closedAt,
        closedBy: normalizedNextStatus === "closed" ? actorName : ticket.closedBy,
        closedByUsername: normalizedNextStatus === "closed" ? authUser.username : ticket.closedByUsername,
        ...(fixReason ? { fixReason } : {}),
        ...(fixImageURLs.length ? { fixImageURLs } : {}),
        status: normalizedNextStatus,
        statusHistory: [
          ...(Array.isArray(ticket.statusHistory) ? ticket.statusHistory : []),
          historyEntry,
        ],
      };

      setRows((current) => current.map((row) => (getTicketKey(row) === ticketKey ? optimisticTicket : row)));
      setSelectedTicket((current) => (
        current && getTicketKey(current) === ticketKey
          ? optimisticTicket
          : current
      ));
      setRefreshNonce((current) => current + 1);
      setActionNotice({
        type: "success",
        message: normalizedNextStatus === "closed"
          ? "Ticket closed. Resolution details were recorded."
          : "Ticket reopened. History was recorded.",
      });
    } catch (updateError) {
      setActionNotice({
        type: "error",
        message: updateError.message || "Failed to update the ticket status.",
      });
    } finally {
      setStatusAction(null);
    }
  }

  async function handleConfirmResolveTicket({ fixReason, fixPhotoBase64 }) {
    if (!resolvingTicket) return;
    setResolvingBusy(true);
    try {
      let fixPhotoUrl = "";
      if (fixPhotoBase64) {
        const uploadRes = await uploadMaintenanceImage({
          base64: fixPhotoBase64,
          factoryName: resolvingTicket.factory || "",
          equipmentName: resolvingTicket.machineName || resolvingTicket.加工設備 || "",
          username: authUser?.username || "admin",
        });
        fixPhotoUrl = uploadRes?.url || uploadRes?.imageURL || "";
      }

      const ticketToClose = resolvingTicket;
      setResolvingTicket(null);
      await handleUpdateTicketStatus(ticketToClose, "closed", { fixReason, fixPhotoUrl });
    } catch (err) {
      setActionNotice({ type: "error", message: err.message || "Failed to upload fix photo or close ticket." });
    } finally {
      setResolvingBusy(false);
    }
  }

  const rangeLabel = useMemo(
    () => formatDateRangeLabel(dateRange.startDate, dateRange.endDate),
    [dateRange.endDate, dateRange.startDate]
  );

  const scopeLabel = `${formatTicketNumber(pagination.totalItems || summary.totalTickets)} matching tickets`;
  const paginationLabel = `${formatTicketNumber(summary.recordCount)} checklist records • ${pageSize} per page • server pagination`;

  function markPresetDirty() {
    setActivePresetId("");
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    markPresetDirty();
    setPage(1);
  }

  function handleDateChange(field, value) {
    setDateRange((current) => ({ ...current, [field]: value }));
    markPresetDirty();
    setPage(1);
  }

  function handleSort(column) {
    markPresetDirty();
    setPage(1);
    setSort((current) => {
      if (current.column === column) {
        return { column, direction: current.direction === 1 ? -1 : 1 };
      }

      return { column, direction: column === "createdAt" ? -1 : 1 };
    });
  }

  function handleApplyAdvancedFilters() {
    setAppliedAdvancedFilters(buildTicketSubmissionAdvancedFilterClauses(advancedRows, advancedFieldDefinitions));
    markPresetDirty();
    setPage(1);
  }

  function handleClearAdvancedFilters() {
    setAdvancedRows([createTicketSubmissionFilterRow()]);
    setAppliedAdvancedFilters([]);
    markPresetDirty();
    setPage(1);
  }

  function handleResetBasicFilters() {
    setFilters({ keyword: "", factory: "", status: "" });
    setDateRange(createDefaultDateRange());
    markPresetDirty();
    setPage(1);
  }

  function handleSavePreset() {
    const trimmedName = presetName.trim();
    if (!trimmedName) return;

    if (editingPresetId) {
      const duplicatePreset = savedPresets.find((preset) => preset.id !== editingPresetId && preset.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (duplicatePreset) {
        setActionNotice({ type: "error", message: "A preset with that name already exists." });
        return;
      }

      setSavedPresets((current) => current.map((preset) => (
        preset.id === editingPresetId
          ? { ...preset, name: trimmedName, updatedAt: new Date().toISOString() }
          : preset
      )));
      setPresetName(trimmedName);
      setActivePresetId(editingPresetId === activePresetId ? editingPresetId : activePresetId);
      setEditingPresetId("");
      setActionNotice({ type: "success", message: "Saved preset renamed." });
      return;
    }

    const now = new Date().toISOString();
    let nextActivePresetId = "";

    setSavedPresets((current) => {
      const existingPreset = current.find((preset) => preset.name.trim().toLowerCase() === trimmedName.toLowerCase());
      const nextPreset = {
        id: existingPreset?.id ?? createTicketPresetId(),
        name: trimmedName,
        createdAt: existingPreset?.createdAt ?? now,
        updatedAt: now,
        filters: { ...filters },
        dateRange: { ...dateRange },
        advancedRows: cloneTicketFilterRows(advancedRows),
        appliedAdvancedFilters: cloneTicketAdvancedClauses(appliedAdvancedFilters),
        pageSize,
        sort: { ...sort },
      };

      nextActivePresetId = nextPreset.id;
      return [nextPreset, ...current.filter((preset) => preset.id !== nextPreset.id)].slice(0, MAX_SAVED_TICKET_PRESETS);
    });

    setPresetName(trimmedName);
    setActivePresetId(nextActivePresetId);
    setActionNotice({ type: "success", message: "Current ticket view saved." });
  }

  function handleApplyPreset(preset) {
    const nextRows = cloneTicketFilterRows(Array.isArray(preset?.advancedRows) ? preset.advancedRows : []);

    setFilters({
      keyword: String(preset?.filters?.keyword ?? "").trim(),
      factory: String(preset?.filters?.factory ?? "").trim(),
      status: String(preset?.filters?.status ?? "").trim(),
    });
    setDateRange({
      startDate: String(preset?.dateRange?.startDate ?? createDefaultDateRange().startDate),
      endDate: String(preset?.dateRange?.endDate ?? createDefaultDateRange().endDate),
    });
    setAdvancedRows(nextRows.length ? nextRows : [createTicketSubmissionFilterRow()]);
    setAppliedAdvancedFilters(
      Array.isArray(preset?.appliedAdvancedFilters) && preset.appliedAdvancedFilters.length > 0
        ? cloneTicketAdvancedClauses(preset.appliedAdvancedFilters)
        : buildTicketSubmissionAdvancedFilterClauses(nextRows, advancedFieldDefinitions)
    );
    setPageSize(TICKET_SUBMISSION_PAGE_SIZE_OPTIONS.includes(Number(preset?.pageSize)) ? Number(preset.pageSize) : TICKET_SUBMISSION_PAGE_SIZE_OPTIONS[0]);
    setSort({
      column: String(preset?.sort?.column ?? DEFAULT_TICKET_SORT.column),
      direction: Number(preset?.sort?.direction) === 1 ? 1 : -1,
    });
    setPresetName(preset.name);
    setActivePresetId(preset.id);
    setEditingPresetId("");
    setPage(1);
    setSelectedTicket(null);
  }

  function handleStartRenamePreset(preset) {
    setEditingPresetId(preset.id);
    setPresetName(preset.name);
  }

  function handleCancelPresetEdit() {
    setEditingPresetId("");
    setPresetName("");
  }

  function handleDeletePreset(preset) {
    setSavedPresets((current) => current.filter((entry) => entry.id !== preset.id));
    if (preset.id === activePresetId) {
      setActivePresetId("");
    }
    if (preset.id === editingPresetId) {
      setEditingPresetId("");
    }
    if (preset.name === presetName) {
      setPresetName("");
    }
  }

  async function runTicketExport(scope = "filtered") {
    if (exporting) return;

    setExportChoiceOpen(false);
    setExporting(true);
    setError("");

    try {
      const exportRows = await fetchNgTicketExport({
        filters: scope === "all"
          ? {}
          : {
            keyword: deferredKeyword,
            factory: filters.factory,
            status: filters.status,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          },
        advancedFilters: scope === "all" ? [] : appliedAdvancedFilters,
        sort,
      });

      if (!Array.isArray(exportRows) || exportRows.length === 0) {
        setActionNotice({ type: "warning", message: "No tickets matched the selected export scope." });
        return;
      }

      downloadTicketCsvFile(buildTicketExportFileName(), buildTicketSubmissionExportMatrix(exportRows));
      setActionNotice({
        type: "success",
        message: scope === "all"
          ? "All submitted ticket data exported."
          : "Filtered ticket data exported.",
      });
    } catch (loadError) {
      setError(loadError.message || "Failed to export submitted tickets.");
    } finally {
      setExporting(false);
    }
  }

  function handleOpenExportDialog() {
    if (exporting) return;
    setExportChoiceOpen(true);
  }

  async function handleCopyShareLink() {
    const params = buildTicketViewSearchParams({
      appliedAdvancedFilters,
      dateRange,
      filters,
      page,
      pageSize,
      sort,
    });
    const query = params.toString();
    const shareUrl = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;

    try {
      await copyTextToClipboard(shareUrl);
      setShareButtonLabel("Link Copied");
      setActionNotice({ type: "success", message: "Share link copied with the current ticket view." });
      window.setTimeout(() => setShareButtonLabel("Copy Share Link"), 2200);
    } catch {
      setActionNotice({ type: "error", message: "Could not copy the share link." });
    }
  }

  function handleOpenChecklistSubmission(ticket) {
    if (!ticket?.recordId) return;

    setSelectedTicket(null);
    navigate("/maintenance/submissions", {
      state: {
        openChecklistSubmissionRecord: {
          recordId: ticket.recordId,
          formId: ticket.formId,
          defaultTab: "submission",
          ticketFocusHint: buildTicketFocusHint(ticket),
        },
      },
    });
  }

  return (
    <section className="h-screen overflow-y-auto px-6 pb-16 pt-24 scrollbar-hide md:px-8">
      <PageHeader
        eyebrow={t("maintenanceEyebrow") || "Maintenance"}
        eyebrowClassName="text-xs tracking-[0.18em]"
        title={t("submittedTickets")}
        subtitle="Review every submitted NG ticket in one place. Filters and pagination run on the server so large ticket history stays responsive even under heavy usage."
        subtitleClassName="max-w-3xl leading-6 text-outline"
        className="mb-6"
      />

      <ActionNoticeBanner notice={actionNotice} onClose={() => setActionNotice(null)} />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Submitted Tickets"
          value={formatTicketNumber(summary.totalTickets)}
          subtitle="Matching the current filters"
          icon="confirmation_number"
          accent="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Checklist Records"
          value={formatTicketNumber(summary.recordCount)}
          subtitle="Unique submissions referenced by the current result set"
          icon="fact_check"
          accent="bg-tertiary/10 text-tertiary"
        />
        <SummaryCard
          label="Machines Impacted"
          value={formatTicketNumber(summary.machineCount)}
          subtitle="Distinct machines represented by the filtered tickets"
          icon="precision_manufacturing"
          accent="bg-amber-500/10 text-amber-700 dark:text-amber-300"
        />
        <SummaryCard
          label="With Image Evidence"
          value={formatTicketNumber(summary.imageTickets)}
          subtitle="Tickets that include attached images"
          icon="photo_library"
          accent="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        />
      </div>

      <div className="mb-6">
        <TicketSubmissionsFilterPanel
          keyword={filters.keyword}
          factory={filters.factory}
          status={filters.status}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          rangeLabel={rangeLabel}
          scopeLabel={scopeLabel}
          paginationLabel={paginationLabel}
          appliedAdvancedFilterCount={appliedAdvancedFilters.length}
          factoryOptions={filterOptions.factories}
          statusOptions={statusOptions}
          fieldDefinitions={advancedFieldDefinitions}
          advancedRows={advancedRows}
          onKeywordChange={(value) => updateFilter("keyword", value)}
          onFactoryChange={(value) => updateFilter("factory", value)}
          onStatusChange={(value) => updateFilter("status", value)}
          onDateChange={handleDateChange}
          onResetBasicFilters={handleResetBasicFilters}
          onAddAdvancedRow={() => setAdvancedRows((current) => [...current, createTicketSubmissionFilterRow()])}
          onUpdateAdvancedRow={(rowId, patch) => setAdvancedRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))}
          onRemoveAdvancedRow={(rowId) => setAdvancedRows((current) => {
            const nextRows = current.filter((row) => row.id !== rowId);
            return nextRows.length ? nextRows : [createTicketSubmissionFilterRow()];
          })}
          onApplyAdvancedFilters={handleApplyAdvancedFilters}
          onClearAdvancedFilters={handleClearAdvancedFilters}
        />
      </div>

      <div className="mb-6 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SavedPresetManagerCard
          activePresetId={activePresetId}
          draftName={presetName}
          editingPresetId={editingPresetId}
          presets={savedPresets}
          onDraftNameChange={setPresetName}
          onSave={handleSavePreset}
          onApply={handleApplyPreset}
          onRename={handleStartRenamePreset}
          onCancelEdit={handleCancelPresetEdit}
          onDelete={handleDeletePreset}
        />

        <ExportTicketResultsCard
          filteredCount={pagination.totalItems || summary.totalTickets}
          disabled={loading || exporting}
          exporting={exporting}
          onCopyShareLink={handleCopyShareLink}
          onExport={handleOpenExportDialog}
          shareButtonLabel={shareButtonLabel}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading || loadingFilterOptions}
        error={error}
        sort={sort}
        page={pagination.currentPage || page}
        pageSize={pagination.itemsPerPage || pageSize}
        filteredCount={pagination.totalItems || rows.length}
        totalPages={pagination.totalPages || 0}
        onSort={handleSort}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          markPresetDirty();
          setPage(1);
        }}
        pageSizeOptions={TICKET_SUBMISSION_PAGE_SIZE_OPTIONS}
        pageSizeLabel="Rows"
        rowKey={(row) => getTicketKey(row)}
        onRowClick={(row) => setSelectedTicket(row)}
        renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
          <span>{buildTicketSubmissionPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize })}</span>
        )}
        emptyTitle="No matching tickets"
        emptyMessage="Adjust the quick filters or advanced filters to widen the ticket search."
        layoutStorageKey="ticket-submissions-table-layout"
        enableColumnResize
        enableColumnReorder
        stickyHeader
        stickyHeaderOffset={0}
        tableClassName="ui-table-data min-w-full border-separate border-spacing-0"
        className="glass-card mb-6 overflow-hidden rounded-[28px]"
        topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
        bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
        rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
        rowsSelectClassName="h-10 rounded-2xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
      />

      {selectedTicket && createPortal(
        <TicketDetailModal
          actionBusy={Boolean(statusAction && getTicketKey(selectedTicket) === statusAction.ticketKey)}
          ticket={selectedTicket}
          onCloseTicket={() => handleUpdateTicketStatus(selectedTicket, "closed")}
          onOpenChecklistSubmission={() => handleOpenChecklistSubmission(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          onReopenTicket={() => handleUpdateTicketStatus(selectedTicket, "open")}
        />,
        document.body
      )}

      {exportChoiceOpen && createPortal(
        <ExportChoiceModal
          filteredCount={pagination.totalItems || summary.totalTickets}
          onClose={() => setExportChoiceOpen(false)}
          onExportFiltered={() => runTicketExport("filtered")}
          onExportAll={() => runTicketExport("all")}
        />,
        document.body
      )}

      {resolvingTicket && createPortal(
        <ResolveTicketModal
          ticket={resolvingTicket}
          busy={resolvingBusy}
          onClose={() => setResolvingTicket(null)}
          onConfirm={handleConfirmResolveTicket}
        />,
        document.body
      )}
    </section>
  );
}