import { createPortal } from "react-dom";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatSummaryCard from "../components/StatSummaryCard";
import TicketSubmissionsFilterPanel from "../components/TicketSubmissionsFilterPanel";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchNgTicketExport, fetchNgTicketFilterOptions, fetchNgTicketPage } from "../services/api";
import { readStoredAuthUser } from "../utils/auth";
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

function SavedPresetManagerCard({ activePresetId, draftName, onApply, onDelete, onDraftNameChange, onSave, presets }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Saved Views</p>
          <h3 className="mt-1 text-lg font-black text-on-surface">Supervisor Presets</h3>
          <p className="mt-2 text-sm leading-6 text-outline">
            Save repeated ticket review filters in this browser, then reapply them in one click.
          </p>
        </div>
        {activePresetId && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
            Active preset
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          placeholder="Name this filter view"
          className="h-11 flex-1 rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!draftName.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl kinetic-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bookmark_added</span>
          Save Current View
        </button>
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
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
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
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-white px-3 py-2 text-xs font-bold text-on-surface transition hover:border-primary/30 hover:text-primary"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(preset)}
                    className="inline-flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-xs font-bold text-error transition hover:bg-error/10"
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

function ExportTicketResultsCard({ disabled, exporting, filteredCount, onExport }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Export</p>
      <h3 className="mt-1 text-lg font-black text-on-surface">Filtered Ticket CSV</h3>
      <p className="mt-3 text-sm leading-6 text-outline">
        Export the current filtered ticket result set with the same server-side filters and sort order used by the table.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">Current Export Scope</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">{formatTicketNumber(filteredCount)} matching tickets</p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={disabled || exporting}
          className="inline-flex items-center justify-center gap-2 rounded-xl kinetic-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>
    </div>
  );
}

function buildImageDownloadName(url, label) {
  const safeLabel = String(label ?? "ticket-image")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "ticket-image";

  try {
    const pathname = new URL(url).pathname;
    const fileName = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
    if (fileName) return fileName;
  } catch {
    // Fall back to generated file name.
  }

  return `${safeLabel}.jpg`;
}

function getTicketKey(ticket) {
  return [
    String(ticket?._id?.$oid ?? ticket?._id ?? "").trim(),
    String(ticket?.recordId ?? "").trim(),
    String(ticket?.fieldId ?? "").trim(),
    String(ticket?.createdAt ?? "").trim(),
  ].filter(Boolean).join("::") || "ticket-row";
}

function getTicketStatusMeta(status) {
  const normalizedStatus = String(status ?? "open").trim().toLowerCase();

  if (normalizedStatus === "resolved" || normalizedStatus === "closed") {
    return {
      label: formatTicketStatusLabel(status),
      badgeClassName: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
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

function SummaryCard({ accent, icon, label, subtitle, value }) {
  return (
    <StatSummaryCard
      icon={icon}
      label={label}
      value={value}
      subtitle={subtitle}
      accent={accent}
      valueClassName="text-2xl font-black tabular-nums"
      labelClassName="text-[11px] font-semibold text-on-surface-variant"
      subtitleClassName="text-[10px] text-outline"
      iconClassName="shadow-none"
    />
  );
}

function TicketStatusPill({ status }) {
  const meta = getTicketStatusMeta(status);

  return (
    <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold", meta.badgeClassName)}>
      {meta.label}
    </span>
  );
}

function ImagePreviewLightbox({ image, onClose }) {
  useEffect(() => {
    if (!image?.url) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [image?.url, onClose]);

  if (!image?.url) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Image Preview</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{image.label || "Ticket image"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/30 px-4 py-4 sm:px-6">
          <img
            src={image.url}
            alt={image.label || "Ticket image"}
            className="max-h-[68vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/65">Open the image here for a clearer view, then download it if needed.</p>
          <a
            href={image.url}
            download={buildImageDownloadName(image.url, image.label)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-white/90"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Download image
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TicketDetailModal({ onClose, onOpenChecklistSubmission = null, ticket }) {
  const [previewImage, setPreviewImage] = useState(null);
  const statusMeta = getTicketStatusMeta(ticket?.status);
  const expectedRange = formatTicketRange(ticket);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!ticket) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
        <div
          className="glass-card flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant/20"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 px-6 py-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Submitted Ticket</p>
              <h3 className="mt-1 truncate text-lg font-black text-on-surface">{ticket.fieldLabel || "Untitled ticket"}</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
                {ticket.formName && <span>{ticket.formName}</span>}
                {ticket.machineName && <span>{ticket.machineName}</span>}
                {ticket.factory && <span>{ticket.factory}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 border-b border-outline-variant/20 px-6 py-4 text-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <span className={joinClasses("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", statusMeta.badgeClassName)}>
                {statusMeta.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-outline">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>schedule</span>
                {formatTicketDateTime(ticket.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-outline">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
                {ticket.completedBy || "Unknown operator"}
              </span>
              {ticket.recordId && (
                <span className="inline-flex items-center gap-1.5 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>fingerprint</span>
                  {ticket.recordId}
                </span>
              )}
            </div>

            {onOpenChecklistSubmission && ticket.recordId && (
              <button
                type="button"
                onClick={onOpenChecklistSubmission}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-white px-4 py-2 text-sm font-bold text-on-surface transition hover:border-primary/30 hover:text-primary"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_outward</span>
                Open Checklist Submission
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
              <article className="rounded-2xl border border-outline-variant/20 bg-surface-container px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">NG Reason</p>
                <p className="mt-2 text-sm leading-6 text-on-surface">{ticket.reason || "No reason provided."}</p>
              </article>

              <div className="grid gap-4">
                <article className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Submitted Value</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{ticket.answerValue || "—"}</p>
                </article>

                <article className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Allowed Range</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{expectedRange || "No range configured"}</p>
                </article>

                <article className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Image Evidence</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{formatTicketNumber(ticket.imageCount ?? ticket.imageURLs?.length ?? 0)} image{(ticket.imageCount ?? ticket.imageURLs?.length ?? 0) === 1 ? "" : "s"}</p>
                </article>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Checklist Form</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">{ticket.formName || "—"}</p>
              </article>

              <article className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Machine</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">{ticket.machineName || "—"}</p>
              </article>
            </div>

            {Array.isArray(ticket.imageURLs) && ticket.imageURLs.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Attached Images</p>
                    <p className="mt-1 text-sm text-outline">Open any image for a larger preview.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ticket.imageURLs.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setPreviewImage({ url: imageUrl, label: `${ticket.fieldLabel || "Ticket image"} ${index + 1}` })}
                      className="group overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface transition hover:border-primary/30"
                    >
                      <img
                        src={imageUrl}
                        alt={ticket.fieldLabel || "Ticket image"}
                        className="h-36 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImagePreviewLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}

export default function TicketSubmissionsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [authUser] = useState(() => readStoredAuthUser());
  const requestIdRef = useRef(0);
  const [filters, setFilters] = useState({ keyword: "", factory: "", status: "" });
  const [dateRange, setDateRange] = useState(() => createDefaultDateRange());
  const [advancedRows, setAdvancedRows] = useState(() => [createTicketSubmissionFilterRow()]);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TICKET_SUBMISSION_PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState({ column: "createdAt", direction: -1 });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_TICKET_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [filterOptions, setFilterOptions] = useState(EMPTY_FILTER_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const presetStorageKey = useMemo(() => buildTicketPresetStorageKey(authUser?.username), [authUser?.username]);
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState(() => readTicketSubmissionPresets(buildTicketPresetStorageKey(authUser?.username)));
  const [activePresetId, setActivePresetId] = useState("");

  const deferredKeyword = useDeferredValue(filters.keyword);

  useEffect(() => {
    setSavedPresets(readTicketSubmissionPresets(presetStorageKey));
    setPresetName("");
    setActivePresetId("");
  }, [presetStorageKey]);

  useEffect(() => {
    if (!hasBrowserStorage()) return;
    window.localStorage.setItem(presetStorageKey, JSON.stringify(savedPresets));
  }, [presetStorageKey, savedPresets]);

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

  const advancedFieldDefinitions = useMemo(() => {
    const optionMap = {
      factory: filterOptions.factories,
      machineName: filterOptions.machineNames,
      formName: filterOptions.formNames,
      completedBy: filterOptions.completedBy,
      status: filterOptions.statuses.map(formatTicketStatusLabel),
      fieldLabel: filterOptions.fieldLabels,
      fieldType: filterOptions.fieldTypes,
      hasImages: TICKET_SUBMISSION_IMAGE_OPTIONS,
    };

    return TICKET_SUBMISSION_ADVANCED_FILTER_FIELDS.map((field) => ({
      ...field,
      options: optionMap[field.field] ?? field.options ?? [],
    }));
  }, [filterOptions.completedBy, filterOptions.factories, filterOptions.fieldLabels, filterOptions.fieldTypes, filterOptions.formNames, filterOptions.machineNames, filterOptions.statuses]);

  const statusOptions = useMemo(() => {
    return filterOptions.statuses.map((status) => ({
      value: status,
      label: formatTicketStatusLabel(status),
    }));
  }, [filterOptions.statuses]);

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
  }, [appliedAdvancedFilters, dateRange.endDate, dateRange.startDate, deferredKeyword, filters.factory, filters.status, page, pageSize, sort]);

  const columns = useMemo(() => ([
    {
      key: "createdAt",
      label: "Submitted At",
      width: 176,
      renderCell: (row) => <span className="font-semibold text-on-surface">{formatTicketDateTime(row.createdAt)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "factory",
      label: "Factory",
      width: 120,
    },
    {
      key: "machineName",
      label: "Machine",
      width: 164,
    },
    {
      key: "formName",
      label: "Checklist Form",
      width: 220,
    },
    {
      key: "fieldLabel",
      label: "Check Item",
      width: 220,
      renderCell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-on-surface">{row.fieldLabel || "Untitled field"}</p>
          {row.fieldType && (
            <span className="mt-2 inline-flex rounded-full bg-outline/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-outline">
              {row.fieldType}
            </span>
          )}
        </div>
      ),
      disableCellWrapper: true,
    },
    {
      key: "answerValue",
      label: "Submitted Value",
      width: 150,
      renderCell: (row) => <span className="font-semibold text-on-surface">{row.answerValue || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "expectedRange",
      label: "Allowed Range",
      width: 156,
      sortable: false,
      renderCell: (row) => <span className="text-on-surface">{formatTicketRange(row) || "—"}</span>,
      getCellTitle: (row) => formatTicketRange(row) || "—",
      disableCellWrapper: true,
    },
    {
      key: "completedBy",
      label: "Submitted By",
      width: 144,
    },
    {
      key: "status",
      label: "Status",
      width: 116,
      align: "center",
      renderCell: (row) => <TicketStatusPill status={row.status} />,
      disableCellWrapper: true,
    },
    {
      key: "imageCount",
      label: "Images",
      width: 96,
      align: "center",
      renderCell: (row) => (
        <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-on-surface">
          {formatTicketNumber(row.imageCount ?? row.imageURLs?.length ?? 0)}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "reason",
      label: "Reason",
      width: 280,
      sortable: false,
      wrap: true,
      renderCell: (row) => <span className="line-clamp-3 whitespace-normal text-sm leading-6 text-on-surface">{row.reason || "No reason provided."}</span>,
      disableCellWrapper: true,
    },
  ]), []);

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
      column: String(preset?.sort?.column ?? "createdAt"),
      direction: Number(preset?.sort?.direction) === 1 ? 1 : -1,
    });
    setPresetName(preset.name);
    setActivePresetId(preset.id);
    setPage(1);
    setSelectedTicket(null);
  }

  function handleDeletePreset(preset) {
    setSavedPresets((current) => current.filter((entry) => entry.id !== preset.id));
    if (preset.id === activePresetId) {
      setActivePresetId("");
    }
    if (preset.name === presetName) {
      setPresetName("");
    }
  }

  async function handleExportTickets() {
    if (exporting) return;

    setExporting(true);
    setError("");

    try {
      const exportRows = await fetchNgTicketExport({
        filters: {
          keyword: deferredKeyword,
          factory: filters.factory,
          status: filters.status,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        advancedFilters: appliedAdvancedFilters,
        sort,
      });

      if (!Array.isArray(exportRows) || exportRows.length === 0) return;
      downloadTicketCsvFile(buildTicketExportFileName(), buildTicketSubmissionExportMatrix(exportRows));
    } catch (loadError) {
      setError(loadError.message || "Failed to export submitted tickets.");
    } finally {
      setExporting(false);
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
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">メンテナンス</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-on-surface">{t("submittedTickets")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-outline">
          Review every submitted NG ticket in one place. Filters and pagination run on the server so large ticket history stays responsive even under heavy usage.
        </p>
      </div>

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
          presets={savedPresets}
          onDraftNameChange={setPresetName}
          onSave={handleSavePreset}
          onApply={handleApplyPreset}
          onDelete={handleDeletePreset}
        />

        <ExportTicketResultsCard
          filteredCount={pagination.totalItems || summary.totalTickets}
          disabled={loading || exporting || (pagination.totalItems || summary.totalTickets) === 0}
          exporting={exporting}
          onExport={handleExportTickets}
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
        className="glass-card mb-8 overflow-hidden rounded-[28px]"
        topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
        bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
        rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
        rowsSelectClassName="h-10 rounded-2xl border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
      />

      {selectedTicket && createPortal(
        <TicketDetailModal
          ticket={selectedTicket}
          onOpenChecklistSubmission={() => handleOpenChecklistSubmission(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
        />,
        document.body
      )}
    </section>
  );
}