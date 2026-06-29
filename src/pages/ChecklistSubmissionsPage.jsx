import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import ChecklistSubmissionsFilterPanel from "../components/ChecklistSubmissionsFilterPanel";
import IconButton from "../components/IconButton";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import PageHeader from "../components/PageHeader";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchCheckFormRecordById, fetchCheckFormTemplates, fetchCheckFormRecords, fetchNgReportsByRecordIds, fetchSetsubiDBRecords } from "../services/api";
import {
  CHECKLIST_SUBMISSION_ADVANCED_FILTER_FIELDS,
  buildChecklistSubmissionAdvancedFilterClauses,
  createChecklistSubmissionFilterRow,
  matchesChecklistSubmissionAdvancedFilters,
} from "../utils/checklistSubmissions";

function normalizeId(id) {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return String(id);
}

function getWeekStart(date) {
  const value = new Date(date);
  const dayOfWeek = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - dayOfWeek);
  value.setHours(0, 0, 0, 0);
  return value;
}

function recordInPeriod(record, date, schedule) {
  const completedAt = new Date(record.completedAt);
  if (schedule === "daily") return completedAt.toDateString() === date.toDateString();
  if (schedule === "weekly") return getWeekStart(completedAt).getTime() === getWeekStart(date).getTime();
  if (schedule === "monthly") return completedAt.getFullYear() === date.getFullYear() && completedAt.getMonth() === date.getMonth();
  return false;
}

function periodEnded(date, schedule) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (schedule === "daily") return date.getTime() < today.getTime();
  if (schedule === "weekly") {
    const nextWeek = getWeekStart(date);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.getTime() <= today.getTime();
  }
  if (schedule === "monthly") {
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return nextMonth.getTime() <= today.getTime();
  }

  return false;
}

function isPeriodAnchor(date, schedule) {
  if (schedule === "weekly") return (date.getDay() + 6) % 7 === 0;
  if (schedule === "monthly") return date.getDate() === 1;
  return true;
}

function isCurrentPeriod(date, schedule) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (schedule === "daily") return date.getTime() === today.getTime();
  if (schedule === "weekly") return getWeekStart(date).getTime() === getWeekStart(today).getTime();
  if (schedule === "monthly") return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();

  return false;
}

function normalizeMachineName(value) {
  return String(value ?? "").trim().toLowerCase();
}

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

function createDefaultTimelineRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 15);

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 14);

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate),
  };
}

function resolveTimelineRange(startValue, endValue) {
  const defaultRange = createDefaultTimelineRange();
  const fallbackStart = toDayStart(defaultRange.startDate);
  const fallbackEnd = toDayStart(defaultRange.endDate);
  const parsedStart = toDayStart(startValue || defaultRange.startDate) ?? fallbackStart;
  const parsedEnd = toDayStart(endValue || defaultRange.endDate) ?? fallbackEnd;

  if (parsedStart.getTime() <= parsedEnd.getTime()) {
    return { startDate: parsedStart, endDate: parsedEnd };
  }

  return { startDate: parsedEnd, endDate: parsedStart };
}

function getDatesInRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate);

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function formatTimelineRangeLabel(startDate, endDate) {
  const startLabel = startDate.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  const endLabel = endDate.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function isSameCalendarDay(value, date) {
  const parsed = toDayStart(value);
  return parsed ? parsed.getTime() === date.getTime() : false;
}

function formatAnsweredAt(value) {
  if (!value) return "";

  const normalizedValue = typeof value === "object" && value.$date ? value.$date : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTemplateEquipmentIds(form) {
  if (Array.isArray(form?.equipmentIds)) return form.equipmentIds;
  if (form?.equipmentId) return [form.equipmentId];
  return [];
}

function buildMachineFilterLabel(machineName, factory) {
  const normalizedMachineName = String(machineName ?? "").trim() || "Unknown machine";
  const normalizedFactory = String(factory ?? "").trim();

  if (!normalizedFactory || normalizedFactory === "—") return normalizedMachineName;
  return `${normalizedFactory} / ${normalizedMachineName}`;
}

function isDateWithinRange(value, startDate, endDate) {
  const parsed = toDayStart(value);
  if (!parsed) return false;

  const time = parsed.getTime();
  return time >= startDate.getTime() && time <= endDate.getTime();
}

function formatScheduleLabel(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();

  if (normalizedValue === "daily") return "Daily";
  if (normalizedValue === "weekly") return "Weekly";
  if (normalizedValue === "monthly") return "Monthly";
  if (!normalizedValue) return "";

  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function buildChecklistSubmissionKeyword(parts = []) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function buildFocusSummaryValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean).join(", ");
  }

  return String(value ?? "").trim();
}

function getChecklistRecordKey(record) {
  const primaryId = normalizeId(record?._id ?? record?.recordId);
  if (primaryId) return primaryId;

  return [
    normalizeId(record?.formId),
    normalizeId(record?.machineId),
    String(record?.machineName ?? "").trim(),
    String(record?.completedAt ?? "").trim(),
    String(record?.createdAt ?? "").trim(),
    String(record?.completedBy ?? "").trim(),
  ].join("::");
}

function getMachineScopedRecords(formId, machine, recordsByFormId) {
  return (recordsByFormId.get(formId) ?? []).filter((record) => {
    const recordMachineId = normalizeId(record.machineId);
    if (recordMachineId) return recordMachineId === machine.id;
    return normalizeMachineName(record.machineName) === normalizeMachineName(machine.name);
  });
}

function getScheduleEntries(machine, date, forms, recordsByFormId, options = {}) {
  const { focusRecordKeys = null, focusRecordMode = false } = options;
  const isFocusedRecord = (record) => !focusRecordMode || focusRecordKeys?.has(getChecklistRecordKey(record));
  const machineForms = forms.filter((form) =>
    getTemplateEquipmentIds(form).some((id) => normalizeId(id) === machine.id)
  );

  return SCHEDULE_ORDER.map((schedule) => {
    const formsForSchedule = machineForms.filter((form) => form.schedule === schedule);
    if (formsForSchedule.length === 0) {
      return {
        schedule,
        state: "none",
        hasForms: false,
        hasNG: false,
        openCount: 0,
        primary: null,
        submissions: [],
        submittedCount: 0,
        title: `${SCHEDULE_META[schedule].label}: no checklist assigned`,
      };
    }

    const submissions = [];
    const dueForms = [];
    const missedForms = [];
    let dueCount = 0;
    let missedCount = 0;
    let mutedCount = 0;

    for (const form of formsForSchedule) {
      const machineRecords = getMachineScopedRecords(normalizeId(form._id), machine, recordsByFormId);
      const focusedMachineRecords = focusRecordMode
        ? machineRecords.filter((record) => isFocusedRecord(record))
        : machineRecords;
      const exactRecords = machineRecords
        .filter((record) => isSameCalendarDay(record.completedAt, date))
        .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
      const focusedExactRecords = focusRecordMode
        ? exactRecords.filter((record) => isFocusedRecord(record))
        : exactRecords;

      if (focusedExactRecords.length > 0) {
        submissions.push(...focusedExactRecords.map((record) => ({ form, record })));
        continue;
      }

      if (focusRecordMode && exactRecords.length > 0) {
        mutedCount += exactRecords.length;
        continue;
      }

      if (!isPeriodAnchor(date, schedule)) continue;
      if (focusedMachineRecords.some((record) => recordInPeriod(record, date, schedule))) continue;
      if (focusRecordMode && machineRecords.some((record) => recordInPeriod(record, date, schedule))) continue;

      if (isCurrentPeriod(date, schedule)) {
        dueCount += 1;
        dueForms.push(form);
      } else if (periodEnded(date, schedule)) {
        missedCount += 1;
        missedForms.push(form);
      }
    }

    const submittedCount = submissions.length;
    const openCount = dueCount + missedCount;
    const fallbackState = submittedCount > 0 && openCount > 0
      ? "partial"
      : submittedCount > 0
        ? "complete"
        : missedCount > 0
          ? "missed"
          : dueCount > 0
            ? "due"
            : "none";
    const fallbackTitle = submittedCount > 0 && openCount > 0
      ? `${SCHEDULE_META[schedule].label}: ${submittedCount} submitted, ${openCount} still pending`
      : submittedCount > 0
        ? `${SCHEDULE_META[schedule].label}: ${submittedCount} submitted`
        : missedCount > 0
          ? `${SCHEDULE_META[schedule].label}: ${missedCount} missed`
          : dueCount > 0
            ? `${SCHEDULE_META[schedule].label}: ${dueCount} due`
            : `${SCHEDULE_META[schedule].label}: no activity this day`;

    let state = fallbackState;
    let title = fallbackTitle;

    if (focusRecordMode) {
      if (submittedCount > 0) {
        state = "complete";
        title = `${SCHEDULE_META[schedule].label}: ${submittedCount} submission${submittedCount === 1 ? "" : "s"} in the current focus`;
      } else if (mutedCount > 0) {
        state = "muted";
        title = `${SCHEDULE_META[schedule].label}: ${mutedCount} submission${mutedCount === 1 ? "" : "s"} outside the current focus`;
      } else if (missedCount > 0) {
        state = "muted";
        title = `${SCHEDULE_META[schedule].label}: ${missedCount} missed outside the current focus`;
      } else if (dueCount > 0) {
        state = "muted";
        title = `${SCHEDULE_META[schedule].label}: ${dueCount} due outside the current focus`;
      }
    }

    return {
      schedule,
      state,
      hasForms: true,
      hasNG: submissions.some((entry) => entry.record.hasNG),
      dueForms,
      mutedCount: focusRecordMode ? (mutedCount || openCount) : 0,
      missedForms,
      openCount,
      primary: submissions[0] ?? null,
      submissions,
      submittedCount,
      title,
    };
  });
}

function getEntryCountLabel(entry) {
  if (entry.state === "partial") return `${entry.submittedCount}/${entry.submittedCount + entry.openCount}`;
  if (entry.state === "complete") return String(entry.submittedCount);
  if (entry.state === "muted") return String(entry.mutedCount || entry.openCount || 0);
  if (entry.state === "due" || entry.state === "missed") return String(entry.openCount);
  return entry.hasForms ? "-" : "";
}

function sortSubmissionEntries(submissions = []) {
  return [...submissions].sort((left, right) => {
    const leftTime = new Date(left?.record?.completedAt ?? 0).getTime();
    const rightTime = new Date(right?.record?.completedAt ?? 0).getTime();

    if (rightTime !== leftTime) return rightTime - leftTime;

    const leftFormName = String(left?.form?.name ?? left?.record?.formName ?? "").trim();
    const rightFormName = String(right?.form?.name ?? right?.record?.formName ?? "").trim();
    return leftFormName.localeCompare(rightFormName, "ja");
  });
}

function buildRecordSelection(submission, defaultTab = "submission", returnToPicker = null) {
  if (!submission) return null;

  return {
    mode: "detail",
    defaultTab,
    form: submission.form,
    record: submission.record,
    returnToPicker,
  };
}

function getPreferredEntrySelection(entry) {
  if (!entry) return null;

  const orderedSubmissions = sortSubmissionEntries(entry.submissions ?? []);
  return orderedSubmissions.find((submission) => submission.record?.hasNG) ?? orderedSubmissions[0] ?? null;
}

function buildEntrySelection(entry, machine, date) {
  if (!entry) return null;

  const orderedSubmissions = sortSubmissionEntries(entry.submissions ?? []);

  if (orderedSubmissions.length > 1) {
    return {
      mode: "picker",
      dateLabel: formatDateInputValue(date),
      factory: machine.factory,
      machineName: machine.name,
      schedule: entry.schedule,
      submissions: orderedSubmissions,
    };
  }

  const preferredSelection = getPreferredEntrySelection(entry);
  if (preferredSelection) {
    return buildRecordSelection(preferredSelection);
  }

  if (entry.state === "missed" && Array.isArray(entry.missedForms) && entry.missedForms.length > 0) {
    const primaryMissedForm = entry.missedForms[0];
    const scheduledDate = formatDateInputValue(date);

    return {
      mode: "detail",
      defaultTab: "submission",
      form: primaryMissedForm,
      record: {
        answers: [],
        completedAt: "",
        completedBy: "",
        factory: machine.factory,
        formId: normalizeId(primaryMissedForm?._id),
        formName: primaryMissedForm?.name ?? "Checklist Submission",
        machineId: machine.id,
        machineName: machine.name,
        missedFormsCount: entry.missedForms.length,
        periodEnd: scheduledDate,
        periodStart: scheduledDate,
        responses: {},
        schedule: primaryMissedForm?.schedule ?? entry.schedule,
        status: "missed",
      },
    };
  }

  if (entry.state === "due" && Array.isArray(entry.dueForms) && entry.dueForms.length > 0) {
    const primaryDueForm = entry.dueForms[0];
    const scheduledDate = formatDateInputValue(date);

    return {
      mode: "detail",
      defaultTab: "submission",
      form: primaryDueForm,
      record: {
        answers: [],
        completedAt: "",
        completedBy: "",
        factory: machine.factory,
        formId: normalizeId(primaryDueForm?._id),
        formName: primaryDueForm?.name ?? "Checklist Submission",
        machineId: machine.id,
        machineName: machine.name,
        periodEnd: scheduledDate,
        periodStart: scheduledDate,
        responses: {},
        schedule: primaryDueForm?.schedule ?? entry.schedule,
        status: "waiting",
        waitingFormsCount: entry.dueForms.length,
      },
    };
  }

  return null;
}

function getFieldTicketHint(field) {
  return {
    fieldId: String(field?.fieldId ?? field?.id ?? "").trim(),
    label: String(field?.label ?? "").trim().toLowerCase(),
  };
}

function doesTicketMatchField(ticket, fieldHint) {
  if (!ticket || !fieldHint) return false;

  const ticketFieldId = String(ticket.fieldId ?? "").trim();
  const ticketLabel = String(ticket.fieldLabel ?? "").trim().toLowerCase();

  return (
    (fieldHint.fieldId && ticketFieldId && fieldHint.fieldId === ticketFieldId)
    || (fieldHint.label && ticketLabel && fieldHint.label === ticketLabel)
  );
}

function getTicketKey(ticket) {
  return `${ticket.recordId}-${ticket.fieldId || ticket.fieldLabel || "ticket"}-${ticket.createdAt || ""}`;
}

function normalizeTicketStatusValue(status) {
  return String(status ?? "open").trim().toLowerCase() || "open";
}

function formatTicketStatusLabel(status) {
  const normalizedStatus = String(status ?? "").trim();
  if (!normalizedStatus) return "Open";

  return normalizedStatus
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    badgeClassName: "bg-outline/10 text-outline",
  };
}

function formatTicketHistoryAction(entry = {}) {
  if (entry.action) return entry.action;
  const from = String(entry.fromStatus ?? "").trim().toLowerCase();
  const to = String(entry.toStatus ?? "").trim().toLowerCase();
  if (to === "closed") return "Ticket Closed";
  if (from === "closed" && to === "open") return "Ticket Reopened";
  if (to === "open") return "Ticket Opened";
  return "Status Updated";
}

function sortTicketHistoryEntries(entries = []) {
  return [...entries].sort((a, b) => new Date(b?.timestamp ?? 0) - new Date(a?.timestamp ?? 0));
}

function ScheduleStackCell({ entries, onSelect }) {
  return (
    <div className="mx-auto flex w-14 flex-col gap-1">
      {entries.map((entry) => {
        const interactive = Boolean(entry.primary)
          || (entry.state === "missed" && entry.missedForms?.length > 0)
          || (entry.state === "due" && entry.dueForms?.length > 0);
        const countLabel = getEntryCountLabel(entry);
        const content = (
          <div
            className={`relative flex min-h-[1.45rem] items-center justify-between rounded-md border px-1.5 py-1 ${SLOT_STYLES[entry.state]}`}
            title={entry.title}
          >
            <span className="text-[9px] font-semibold tracking-[0.18em]">{SCHEDULE_META[entry.schedule].short}</span>
            <span className="text-[9px] font-semibold">{countLabel}</span>
            {entry.hasNG && (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-error ring-1 ring-surface" />
            )}
          </div>
        );

        if (!interactive) {
          return <div key={entry.schedule}>{content}</div>;
        }

        return (
          <button
            key={entry.schedule}
            type="button"
            onClick={() => onSelect(entry)}
            className="text-left transition hover:scale-[1.03]"
            title={`${entry.title}. Click to ${entry.state === "missed" ? "review the missed checklist" : entry.state === "due" ? "review the checklist waiting for submission" : "open the submitted record"}.`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleLaneLegendCell({ schedules }) {
  return (
    <div className="flex w-24 flex-col gap-1">
      {schedules.map((schedule) => (
        <div
          key={schedule}
          className="flex min-h-[1.45rem] items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline"
        >
          {SCHEDULE_META[schedule].label}
        </div>
      ))}
    </div>
  );
}

function SubmissionPickerModal({ dateLabel, factory, machineName, onClose, onSelect, schedule, submissions }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const scheduleLabel = SCHEDULE_META[schedule]?.label ?? formatScheduleLabel(schedule);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card flex max-h-[78vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-outline-variant/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-separator/40 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Multiple Submissions</p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">Choose a checklist record</h3>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
              {machineName && <span>{machineName}</span>}
              {factory && factory !== "—" && <span>{factory}</span>}
              {scheduleLabel && <span>{scheduleLabel}</span>}
              {dateLabel && <span>{dateLabel}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3">
            {submissions.map((submission, index) => {
              const submissionKey = getChecklistRecordKey(submission.record) || `${index}`;
              const submissionFormName = submission.form?.name ?? submission.record?.formName ?? "Checklist Submission";
              const completedBy = String(submission.record?.completedBy ?? "").trim() || "Unknown operator";
              const completedAtLabel = submission.record?.completedAt
                ? new Date(submission.record.completedAt).toLocaleString("ja-JP", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "No timestamp";

              return (
                <button
                  key={submissionKey}
                  type="button"
                  onClick={() => onSelect(submission)}
                  className="group rounded-2xl border border-separator/40 bg-surface-container px-4 py-4 text-left transition hover:border-primary/30 hover:bg-surface-container-high"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                          Record {index + 1}
                        </span>
                        <h4 className="truncate text-sm font-semibold text-on-surface">{submissionFormName}</h4>
                        {submission.record?.hasNG && (
                          <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-error">
                            NG
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-outline">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                          {completedAtLabel}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                          {completedBy}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-outline transition group-hover:translate-x-0.5 group-hover:text-primary">chevron_right</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordDetailModal({ defaultTab = "submission", form, initialTicketFocusHint = null, onBack = null, onClose, record }) {
  const isMissedRecord = record?.status === "missed";
  const isWaitingRecord = record?.status === "waiting";
  const isReferenceRecord = isMissedRecord || isWaitingRecord;
  const normalizedDefaultTab = defaultTab === "tickets" ? "tickets" : "submission";
  const [activeTab, setActiveTab] = useState(normalizedDefaultTab);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [ticketFocusHint, setTicketFocusHint] = useState(null);
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState(new Set());
  const ticketRefs = useRef(new Map());

  const recordAnswers = Array.isArray(record?.answers)
    ? record.answers.filter((field) => field.type !== "name")
    : [];
  const fields = recordAnswers.length > 0
    ? recordAnswers
    : (form?.fields ?? []).filter((field) => field.type !== "name");
  const responses = record?.responses ?? {};
  const recordId = normalizeId(record?._id ?? record?.recordId);
  const formName = form?.name ?? record?.formName ?? "Checklist Submission";
  const recordFactory = form?.工場 ?? record?.factory ?? "";
  const recordSchedule = record?.schedule ?? form?.schedule ?? "";
  const modalTabItems = useMemo(() => {
    if (isReferenceRecord) {
      return [{
        key: "submission",
        label: (
          <span className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fact_check</span>
            <span>{isMissedRecord ? "Missed Checklist" : "Checklist Waiting For Submission"}</span>
          </span>
        ),
      }];
    }

    return [
      {
        key: "submission",
        label: (
          <span className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fact_check</span>
            <span>Submitted</span>
          </span>
        ),
      },
      {
        key: "tickets",
        label: (
          <span className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>confirmation_number</span>
            <span>NG Reasons</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                activeTab === "tickets"
                  ? "bg-white/20 text-on-primary"
                  : tickets.length > 0
                    ? "bg-error/10 text-error"
                    : "bg-outline/10 text-outline"
              }`}
            >
              {tickets.length}
            </span>
          </span>
        ),
      },
    ];
  }, [activeTab, isMissedRecord, isReferenceRecord, tickets.length]);

  useEffect(() => {
    setActiveTab(normalizedDefaultTab);
    setPreviewImage(null);
    setTicketFocusHint(initialTicketFocusHint ?? null);
    ticketRefs.current.clear();
  }, [initialTicketFocusHint, normalizedDefaultTab, recordId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      if (!recordId) {
        setTickets([]);
        return;
      }

      setTicketsLoading(true);
      try {
        const data = await fetchNgReportsByRecordIds([recordId]);
        if (!cancelled) {
          setTickets(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setTickets([]);
        }
      } finally {
        if (!cancelled) {
          setTicketsLoading(false);
        }
      }
    }

    loadTickets();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  function formatValue(field) {
    if (field.fieldId) {
      const answerStatus = String(field.status ?? field.value ?? "").trim().toLowerCase();
      if (field.type === "toggle") {
        if (answerStatus === "ok") return "OK";
        if (answerStatus === "ng") return "NG";
        return field.displayValue ?? field.value ?? "—";
      }
      if (field.displayValue !== undefined && field.displayValue !== null && field.displayValue !== "") {
        return String(field.displayValue);
      }
      if (field.value === null || field.value === undefined || field.value === "") return "—";
      if (field.type === "number" && field.unit) return `${field.value} ${field.unit}`;
      return String(field.value);
    }

    const value = responses[field.id];
    if (field.type === "toggle") {
      if (value === "ok") return "OK";
      if (value === "ng") return "NG";
      return "—";
    }
    if (value === null || value === undefined || value === "") return "—";
    if (field.type === "number" && field.unit) return `${value} ${field.unit}`;
    return String(value);
  }

  function getFieldStatus(field) {
    if (field.fieldId) {
      return String(field.status ?? field.value ?? "").trim().toLowerCase();
    }
    return field.type === "toggle" ? String(responses[field.id] ?? "").trim().toLowerCase() : "";
  }

  function getFieldValueTone(field, status) {
    if (status === "ng") return "text-error";
    if (status === "out-of-range") return "text-error";

    if (field.type === "toggle") {
      if (status === "ok") return "text-emerald-500";
    }
    return "text-on-surface";
  }

  function formatTicketRange(ticket) {
    if (ticket.min !== null && ticket.max !== null) return `${ticket.min} to ${ticket.max}${ticket.unit ? ` ${ticket.unit}` : ""}`;
    if (ticket.min !== null) return `>= ${ticket.min}${ticket.unit ? ` ${ticket.unit}` : ""}`;
    if (ticket.max !== null) return `<= ${ticket.max}${ticket.unit ? ` ${ticket.unit}` : ""}`;
    return "";
  }

  function openImagePreview(url, label) {
    if (!url) return;
    setPreviewImage({
      eyebrow: "Inspection Photo",
      displayName: label || "Inspection image",
      activeIndex: 0,
      images: [{ url, label }],
    });
  }

  function openTicketImagePreview(ticket, index = 0) {
    const previewImages = Array.isArray(ticket?.imageURLs)
      ? ticket.imageURLs.filter(Boolean).map((imageUrl, imageIndex) => ({
        url: imageUrl,
        label: `${ticket?.fieldLabel || "NG image"} ${imageIndex + 1}`,
      }))
      : [];

    if (!previewImages[index]?.url) return;

    setPreviewImage({
      eyebrow: "NG Ticket Photos",
      displayName: ticket?.fieldLabel || "NG image",
      subtitle: ticket?.factory || ticket?.formName || undefined,
      activeIndex: index,
      images: previewImages,
    });
  }

  function openEntryImagePreview(entry, index = 0) {
    const entryImages = Array.isArray(entry?.imageURLs)
      ? entry.imageURLs.filter(Boolean).map((url, i) => ({
        url,
        label: `${formatTicketHistoryAction(entry)} image ${i + 1}`,
      }))
      : [];

    if (!entryImages[index]?.url) return;

    setPreviewImage({
      eyebrow: "Fix Photos",
      displayName: formatTicketHistoryAction(entry),
      activeIndex: index,
      images: entryImages,
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

  function openNgReasonForField(field) {
    setTicketFocusHint(getFieldTicketHint(field));
    setActiveTab("tickets");
  }

  const hasTicketTabContent = record?.hasNG || tickets.length > 0;
  const focusedTicket = useMemo(() => {
    if (!ticketFocusHint) return null;
    return tickets.find((ticket) => doesTicketMatchField(ticket, ticketFocusHint))
      ?? (tickets.length === 1 ? tickets[0] : null);
  }, [ticketFocusHint, tickets]);
  const highlightedTicketKey = focusedTicket ? getTicketKey(focusedTicket) : "";

  useEffect(() => {
    if (activeTab !== "tickets" || ticketsLoading || !highlightedTicketKey) return;

    const node = ticketRefs.current.get(highlightedTicketKey);
    if (node) {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeTab, highlightedTicketKey, ticketsLoading]);

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="dashboard-section flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        <div className="flex flex-shrink-0 items-start justify-between border-b border-separator/40 px-6 py-5">
          <div className="min-w-0 flex-1 pr-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface transition hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                Back to submissions
              </button>
            )}
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">Inspection Record</p>
            <h3 className="mt-0.5 truncate text-lg font-semibold text-on-surface">{formName}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-outline">
              {recordFactory && <span>{recordFactory}</span>}
              {recordSchedule && <span className="capitalize">{recordSchedule}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-4 border-b border-separator/40 px-6 py-4">
          {isReferenceRecord ? (
            <>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                isMissedRecord ? "bg-error/10 text-error" : "bg-amber-500/10 text-amber-700"
              }`}>
                {isMissedRecord ? "Missed" : "Waiting for submission"}
              </span>
              {record?.periodStart && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>date_range</span>
                  <span className="text-on-surface">Scheduled {record.periodStart}{record.periodEnd !== record.periodStart ? ` → ${record.periodEnd}` : ""}</span>
                </div>
              )}
              {record?.machineName && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>precision_manufacturing</span>
                  <span className="font-semibold text-on-surface">{record.machineName}</span>
                </div>
              )}
              {(record?.missedFormsCount > 1 || record?.waitingFormsCount > 1) && (
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                  {isMissedRecord ? record.missedFormsCount : record.waitingFormsCount} {isMissedRecord ? "missed" : "waiting"} checklists in this slot
                </span>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>person</span>
                <span className="font-semibold text-on-surface">{record?.completedBy ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>schedule</span>
                <span className="text-on-surface">
                  {record?.completedAt
                    ? new Date(record.completedAt).toLocaleString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              {record?.periodStart && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>date_range</span>
                  <span className="text-outline">{record.periodStart}{record.periodEnd !== record.periodStart ? ` → ${record.periodEnd}` : ""}</span>
                </div>
              )}
              {record?.machineName && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>precision_manufacturing</span>
                  <span className="font-semibold text-on-surface">{record.machineName}</span>
                </div>
              )}
              {record?.deviceId === "simulator" && (
                <span className="rounded-full bg-outline/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-outline">Simulator</span>
              )}
            </>
          )}
        </div>

        {modalTabItems.length > 1 && (
          <div className="border-b border-separator/40 px-6 py-3">
            <LiquidSegmentedControl
              items={modalTabItems}
              activeKey={activeTab}
              onChange={setActiveTab}
              className="w-fit"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "submission" ? (
            <div className="flex flex-col gap-3">
              {isReferenceRecord && (
                <div className={`rounded-2xl px-4 py-3 ${isMissedRecord ? "border border-error/15 bg-error/5" : "border border-amber-500/15 bg-amber-500/5"}`}>
                  <p className="text-sm font-semibold text-on-surface">{isMissedRecord ? "This checklist was missed." : "This checklist is waiting for submission."}</p>
                  <p className="mt-1 text-sm leading-6 text-outline">
                    Questions are shown for reference only. No answers were submitted for this scheduled check{(record?.missedFormsCount > 1 || record?.waitingFormsCount > 1) ? `; this modal is showing the first ${isMissedRecord ? "missed" : "waiting"} checklist in the selected slot.` : "."}
                  </p>
                </div>
              )}
              {fields.length === 0 && <p className="text-sm text-outline">No fields recorded.</p>}
              {fields.map((field) => {
                const fieldId = field.fieldId ?? field.id;
                const photo = field.fieldPhotoURL || responses[`${fieldId}_photo`];
                const value = isReferenceRecord ? "" : formatValue(field);
                const fieldStatus = getFieldStatus(field);
                const valueTone = getFieldValueTone(field, fieldStatus);
                const answeredAtLabel = formatAnsweredAt(field.answeredAt);
                const isProblemField = fieldStatus === "ng" || fieldStatus === "out-of-range";
                const isNgValue = fieldStatus === "ng";
                const canOpenNgReason = isProblemField && hasTicketTabContent;
                const problemFieldHint = getFieldTicketHint(field);
                const hasMatchingTicket = tickets.some((ticket) => doesTicketMatchField(ticket, problemFieldHint));
                const cardIsClickable = canOpenNgReason && (hasMatchingTicket || ticketsLoading || tickets.length === 0);

                return (
                  <div
                    key={fieldId}
                    role={cardIsClickable ? "button" : undefined}
                    tabIndex={cardIsClickable ? 0 : undefined}
                    onClick={cardIsClickable ? () => openNgReasonForField(field) : undefined}
                    onKeyDown={cardIsClickable ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openNgReasonForField(field);
                      }
                    } : undefined}
                    title={cardIsClickable ? "Click to open the NG reason" : undefined}
                    className={`rounded-2xl border px-4 py-3 ${
                      isProblemField
                        ? "border-red-400/70 bg-red-50"
                        : "border-outline-variant/20 bg-surface-container"
                    } ${
                      cardIsClickable
                        ? isProblemField
                          ? "cursor-pointer transition hover:border-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
                          : "cursor-pointer transition hover:border-primary/30 hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{field.label || <span className="italic text-outline">Untitled</span>}</p>
                        {field.description && <p className="mt-0.5 text-xs text-outline">{field.description}</p>}
                        {answeredAtLabel && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-outline">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                            Answered {answeredAtLabel}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {isReferenceRecord ? (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Not submitted</p>
                        ) : (
                          <p className={`text-sm ${isNgValue ? "font-semibold tracking-[0.04em] text-red-600" : `font-semibold ${valueTone}`}`}>{value}</p>
                        )}
                        {!isReferenceRecord && fieldStatus === "out-of-range" && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-error">Out of range</p>
                        )}
                      </div>
                    </div>
                    {photo && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openImagePreview(photo, field.label || "Submitted image");
                          }}
                          className="group overflow-hidden rounded-xl border border-separator/40 bg-surface transition hover:border-primary/30"
                        >
                          <img
                            src={photo}
                            alt="添付画像"
                            className="h-32 max-w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        </button>
                        <p className="mt-2 text-[11px] font-semibold text-primary">Click image to enlarge</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ticketsLoading && (
                <div className="flex items-center gap-3 py-8 text-outline">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Loading NG reasons…
                </div>
              )}

              {!ticketsLoading && tickets.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container/40 px-6 py-12 text-center text-outline">
                  <span className="material-symbols-outlined" style={{ fontSize: 36 }}>task_alt</span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">No NG tickets found for this record</p>
                    <p className="mt-1 text-sm leading-6 text-outline">
                      {hasTicketTabContent
                        ? "This record is flagged, but no ticket details were returned from ngReportsDB."
                        : "This submission does not have any NG or out-of-range ticket reasons."}
                    </p>
                  </div>
                </div>
              )}

              {!ticketsLoading && tickets.map((ticket) => {
                const expectedRange = formatTicketRange(ticket);
                const ticketKey = getTicketKey(ticket);
                const isHighlightedTicket = highlightedTicketKey === ticketKey;
                const statusMeta = getTicketStatusMeta(ticket.status);
                return (
                  <article
                    key={ticketKey}
                    ref={(node) => {
                      if (node) ticketRefs.current.set(ticketKey, node);
                      else ticketRefs.current.delete(ticketKey);
                    }}
                    className={`rounded-2xl border border-separator/40 bg-surface-container px-4 py-4 ${
                      isHighlightedTicket ? "ring-2 ring-primary/25 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-on-surface">{ticket.fieldLabel || "Untitled field"}</h4>
                          {ticket.fieldType && (
                            <span className="rounded-full bg-outline/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                              {ticket.fieldType}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-outline">
                          {ticket.answerValue && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-semibold text-on-surface">
                              <span className="material-symbols-outlined text-error" style={{ fontSize: 12 }}>warning</span>
                              Submitted: {ticket.answerValue}
                            </span>
                          )}
                          {expectedRange && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-semibold text-on-surface">
                              <span className="material-symbols-outlined text-primary" style={{ fontSize: 12 }}>straighten</span>
                              Allowed: {expectedRange}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusMeta.badgeClassName}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {/* NG Reason */}
                    <div className="mt-3 rounded-2xl bg-surface px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">NG Reason</p>
                      <p className="mt-1 text-sm leading-6 text-on-surface">{ticket.reason || "No reason provided."}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-outline">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </span>
                        {ticket.completedBy && (
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                            {ticket.completedBy}
                          </span>
                        )}
                      </div>
                      {ticket.imageURLs.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {ticket.imageURLs.map((imageUrl, imageIndex) => (
                            <button
                              key={`${imageUrl}-${imageIndex}`}
                              type="button"
                              onClick={() => openTicketImagePreview(ticket, imageIndex)}
                              className="group overflow-hidden rounded-xl border border-separator/40 bg-white transition hover:border-primary/30"
                            >
                              <img
                                src={imageUrl}
                                alt={ticket.fieldLabel || "ticket"}
                                className="h-24 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Latest Fix — shown only when ticket is closed */}
                    {normalizeTicketStatusValue(ticket.status) === "closed" && ticket.closedAt && (
                      <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Latest Fix</p>
                        <p className="mt-1 text-sm leading-6 text-on-surface">{ticket.fixReason || "No fix note provided."}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-outline">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 14 }}>task_alt</span>
                            {new Date(ticket.closedAt).toLocaleString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {(ticket.closedBy || ticket.closedByUsername) && (
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 14 }}>person</span>
                              {ticket.closedBy || ticket.closedByUsername}
                              {ticket.closedByUsername && ticket.closedBy && ticket.closedByUsername !== ticket.closedBy && (
                                <span className="text-outline/60">(@{ticket.closedByUsername})</span>
                              )}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const lastClose = sortTicketHistoryEntries(
                            Array.isArray(ticket.statusHistory) ? ticket.statusHistory : []
                          ).find((h) => normalizeTicketStatusValue(h.toStatus) === "closed");
                          const fixImages = Array.isArray(lastClose?.imageURLs) ? lastClose.imageURLs.filter(Boolean) : [];
                          return fixImages.length > 0 ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {fixImages.map((imageUrl, imageIndex) => (
                                <button
                                  key={`${imageUrl}-${imageIndex}`}
                                  type="button"
                                  onClick={() => openEntryImagePreview(lastClose, imageIndex)}
                                  className="group overflow-hidden rounded-xl border border-emerald-500/20 bg-white transition hover:border-emerald-500/40"
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`Fix image ${imageIndex + 1}`}
                                    className="h-24 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* Status History — collapsible */}
                    {Array.isArray(ticket.statusHistory) && ticket.statusHistory.length > 0 && (() => {
                      const historyEntries = sortTicketHistoryEntries(ticket.statusHistory);
                      const isExpanded = expandedHistoryKeys.has(ticketKey);
                      return (
                        <div className="mt-3 rounded-2xl border border-separator/30 bg-surface-container/60 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryKeys((prev) => {
                              const next = new Set(prev);
                              if (next.has(ticketKey)) next.delete(ticketKey);
                              else next.add(ticketKey);
                              return next;
                            })}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Status History</span>
                              <span className="inline-flex items-center rounded-full bg-outline/10 px-2 py-0.5 text-[10px] font-semibold text-outline">
                                {historyEntries.length}
                              </span>
                            </div>
                            <span className="material-symbols-outlined text-outline transition-transform duration-200" style={{ fontSize: 16, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                              expand_more
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-2">
                              {historyEntries.map((entry, entryIndex) => {
                                const isClosure = normalizeTicketStatusValue(entry.toStatus) === "closed";
                                const isReopened = normalizeTicketStatusValue(entry.toStatus) === "open" && normalizeTicketStatusValue(entry.fromStatus) === "closed";
                                const entryNote = isClosure ? (entry.fixReason || entry.comment) : (entry.reason || entry.comment);
                                const entryImages = Array.isArray(entry.imageURLs) ? entry.imageURLs.filter(Boolean) : [];
                                const toStatusMeta = getTicketStatusMeta(entry.toStatus);
                                return (
                                  <div
                                    key={`${entry.timestamp || "h"}-${entryIndex}`}
                                    className="rounded-xl border border-outline-variant/15 bg-white/70 px-3 py-3 dark:bg-surface"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-semibold text-on-surface">{formatTicketHistoryAction(entry)}</p>
                                        <p className="mt-0.5 text-[11px] text-outline">
                                          {entry.user || entry.username || "Unknown user"}
                                          {entry.username && entry.user && entry.username !== entry.user && (
                                            <span className="ml-1 text-outline/60">(@{entry.username})</span>
                                          )}
                                        </p>
                                      </div>
                                      <p className="text-[11px] font-medium text-outline">
                                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                      </p>
                                    </div>
                                    {(entry.fromStatus || entry.toStatus) && (
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                        {entry.fromStatus && (
                                          <span className="inline-flex rounded-full bg-surface-container px-2 py-0.5 font-semibold text-on-surface">
                                            {formatTicketStatusLabel(entry.fromStatus)}
                                          </span>
                                        )}
                                        <span className="material-symbols-outlined text-outline/40" style={{ fontSize: 12 }}>arrow_forward</span>
                                        {entry.toStatus && (
                                          <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${toStatusMeta.badgeClassName}`}>
                                            {toStatusMeta.label}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {entryNote && (
                                      <div className={`mt-2 rounded-lg px-3 py-2 text-xs leading-5 ${isClosure ? "bg-emerald-500/8 text-emerald-900 dark:text-emerald-200" : isReopened ? "bg-amber-500/8 text-amber-900 dark:text-amber-200" : "bg-surface-container text-on-surface"}`}>
                                        <span className="font-semibold opacity-60">{isClosure ? "Fix: " : "Reason: "}</span>
                                        {entryNote}
                                      </div>
                                    )}
                                    {entryImages.length > 0 && (
                                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                                        {entryImages.map((imageUrl, imgIndex) => (
                                          <button
                                            key={`${imageUrl}-${imgIndex}`}
                                            type="button"
                                            onClick={() => openEntryImagePreview(entry, imgIndex)}
                                            className="group overflow-hidden rounded-lg border border-separator/40 bg-surface transition hover:border-primary/30"
                                          >
                                            <img
                                              src={imageUrl}
                                              alt={`Fix image ${imgIndex + 1}`}
                                              className="h-20 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </article>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </div>
      <SensorDevicePhotoPreviewModal preview={previewImage} onClose={() => setPreviewImage(null)} onNavigate={handlePreviewNavigate} />
    </>
  );
}

const SCHEDULE_META = {
  daily: { label: "Daily", short: "D", icon: "today" },
  weekly: { label: "Weekly", short: "W", icon: "date_range" },
  monthly: { label: "Monthly", short: "M", icon: "calendar_month" },
};

const SCHEDULE_ORDER = ["daily", "weekly", "monthly"];

const MACHINE_COLUMN_WIDTH = 160;
const CADENCE_COLUMN_WIDTH = 104;
const TIMELINE_CELL_WIDTH = 64;

const SLOT_STYLES = {
  complete: "border-emerald-500/20 bg-emerald-500/12 text-emerald-600",
  partial: "border-primary/25 bg-primary/10 text-primary",
  due: "border-amber-500/20 bg-amber-500/12 text-amber-700",
  missed: "border-error/20 bg-error/10 text-error",
  muted: "border-outline-variant/20 bg-surface-container text-outline/70",
  none: "border-outline-variant/15 bg-surface-container-high/35 text-outline/55",
};

const RECORD_COMPATIBLE_FILTER_FIELDS = new Set([
  "keyword",
  "factory",
  "machineLabel",
  "formName",
  "schedule",
  "completedBy",
  "hasNGStatus",
  "lastCompletedAt",
]);

const TIMELINE_FOCUS_FIELD_LABELS = {
  completedBy: "Submitted By",
  hasNGStatus: "NG Status",
  formName: "Checklist Form",
};

function SummaryCard({ detail, icon, iconClassName, label, value }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-on-surface">{value}</p>
          <p className="mt-2 text-sm text-outline">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
        </span>
      </div>
    </div>
  );
}

function LegendPill({ label, tone, withNg = false }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-separator/40 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface">
      <span className="relative h-3 w-3 flex-shrink-0">
        <span className={`absolute inset-0 rounded-full ${tone}`} />
        {withNg && <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-error ring-1 ring-surface" />}
      </span>
      {label}
    </span>
  );
}

function ScheduleFilterButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-outline-variant/20 bg-surface text-on-surface hover:border-primary/20 hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

export default function ChecklistSubmissionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => createDefaultTimelineRange());
  const [advancedRows, setAdvancedRows] = useState(() => [createChecklistSubmissionFilterRow()]);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState([]);
  const [activeSchedules, setActiveSchedules] = useState(SCHEDULE_ORDER);
  const [selectedCell, setSelectedCell] = useState(null);
  const scrollRef = useRef(null);

  const resolvedDateRange = useMemo(
    () => resolveTimelineRange(dateRange.startDate, dateRange.endDate),
    [dateRange.endDate, dateRange.startDate]
  );
  const dates = useMemo(
    () => getDatesInRange(resolvedDateRange.startDate, resolvedDateRange.endDate),
    [resolvedDateRange.endDate, resolvedDateRange.startDate]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [templateResult, equipmentResult] = await Promise.all([
          fetchCheckFormTemplates(),
          fetchSetsubiDBRecords(),
        ]);
        const activeTemplates = (Array.isArray(templateResult) ? templateResult : []).filter((form) => form.status === "active");
        setTemplates(activeTemplates);
        setAllEquipment(Array.isArray(equipmentResult) ? equipmentResult : []);
        const formIds = activeTemplates.map((form) => normalizeId(form._id));
        const recordResult = formIds.length ? await fetchCheckFormRecords(formIds) : [];
        setRecords(Array.isArray(recordResult) ? recordResult : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (loading || !scrollRef.current || dates.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIndex = dates.findIndex((date) => date.getTime() === today.getTime());
    const anchorIndex = todayIndex >= 0 ? todayIndex : Math.floor(dates.length / 2);
    const anchorOffset = MACHINE_COLUMN_WIDTH + CADENCE_COLUMN_WIDTH + anchorIndex * TIMELINE_CELL_WIDTH;
    const containerWidth = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = anchorOffset - containerWidth / 2 + TIMELINE_CELL_WIDTH / 2;
  }, [dates, loading]);

  const equipmentMap = useMemo(() => {
    const map = new Map();
    for (const equipment of allEquipment) {
      map.set(normalizeId(equipment._id), { name: equipment.name, factory: equipment.工場 });
    }
    return map;
  }, [allEquipment]);

  const templatesById = useMemo(() => {
    const map = new Map();
    for (const template of templates) {
      map.set(normalizeId(template._id), template);
    }
    return map;
  }, [templates]);

  const recordsByFormId = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      const formId = normalizeId(record.formId);
      if (!formId) continue;

      const list = map.get(formId) ?? [];
      list.push(record);
      map.set(formId, list);
    }
    return map;
  }, [records]);

  useEffect(() => {
    const requestedRecord = location.state?.openChecklistSubmissionRecord;
    const requestedRecordId = normalizeId(requestedRecord?.recordId);

    if (loading || !requestedRecordId) return undefined;

    let cancelled = false;

    async function openRequestedRecord() {
      let targetRecord = records.find((record) => normalizeId(record?._id ?? record?.recordId) === requestedRecordId) ?? null;

      if (!targetRecord) {
        try {
          targetRecord = await fetchCheckFormRecordById(requestedRecordId);
        } catch (error) {
          console.error(error);
        }
      }

      if (!cancelled && targetRecord) {
        const targetFormId = normalizeId(targetRecord.formId ?? requestedRecord?.formId);
        setSelectedCell({
          mode: "detail",
          defaultTab: requestedRecord?.defaultTab === "tickets" ? "tickets" : "submission",
          form: templatesById.get(targetFormId) ?? null,
          initialTicketFocusHint: requestedRecord?.ticketFocusHint ?? null,
          record: targetRecord,
        });
      }

      if (!cancelled) {
        navigate(location.pathname, { replace: true, state: null });
      }
    }

    void openRequestedRecord();

    return () => {
      cancelled = true;
    };
  }, [loading, location.pathname, location.state, navigate, records, templatesById]);

  const machineAssignments = useMemo(() => {
    const seen = new Set();
    const result = [];

    for (const form of templates) {
      const formId = normalizeId(form._id);
      const formName = String(form?.name ?? form?.formName ?? "Checklist Submission").trim() || "Checklist Submission";

      for (const rawId of getTemplateEquipmentIds(form)) {
        const machineId = normalizeId(rawId);
        if (!machineId) continue;

        const assignmentKey = `${formId}:${machineId}`;
        if (seen.has(assignmentKey)) continue;
        seen.add(assignmentKey);

        const info = equipmentMap.get(machineId);
        const machineName = info?.name ?? machineId;
        const factory = info?.factory ?? form?.工場 ?? "—";

        result.push({
          factory,
          formId,
          formName,
          machineId,
          machineLabel: buildMachineFilterLabel(machineName, factory),
          machineName,
          schedule: formatScheduleLabel(form?.schedule),
        });
      }
    }

    return result.sort((left, right) => (
      left.factory.localeCompare(right.factory, "ja")
      || left.machineName.localeCompare(right.machineName, "ja")
      || left.formName.localeCompare(right.formName, "ja")
    ));
  }, [equipmentMap, templates]);

  const machines = useMemo(() => {
    const seen = new Set();
    const result = [];

    for (const assignment of machineAssignments) {
      if (seen.has(assignment.machineId)) continue;
      seen.add(assignment.machineId);
      result.push({ id: assignment.machineId, name: assignment.machineName, factory: assignment.factory });
    }

    return result;
  }, [machineAssignments]);

  const assignmentFilterItems = useMemo(() => {
    return machineAssignments.map((assignment) => {
      const scopedRecords = getMachineScopedRecords(
        assignment.formId,
        { id: assignment.machineId, name: assignment.machineName },
        recordsByFormId
      )
        .filter((record) => isDateWithinRange(record.completedAt, resolvedDateRange.startDate, resolvedDateRange.endDate))
        .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());

      const completedBy = [...new Set(
        scopedRecords
          .map((record) => String(record.completedBy ?? "").trim())
          .filter(Boolean)
      )].sort((left, right) => left.localeCompare(right, "ja"));

      const lastCompletedAt = scopedRecords[0]?.completedAt
        ? formatDateInputValue(scopedRecords[0].completedAt)
        : "";
      const hasNGStatus = scopedRecords.length
        ? scopedRecords.some((record) => record.hasNG) ? "With NG" : "Without NG"
        : "";
      const submissionActivity = scopedRecords.length ? "Has submissions" : "No submissions";

      return {
        ...assignment,
        completedBy,
        hasNGStatus,
        keyword: buildChecklistSubmissionKeyword([
          assignment.factory,
          assignment.machineName,
          assignment.machineLabel,
          assignment.formName,
          assignment.schedule,
          completedBy,
          hasNGStatus,
          submissionActivity,
        ]),
        lastCompletedAt,
        recordCount: scopedRecords.length,
        submissionActivity,
      };
    });
  }, [machineAssignments, recordsByFormId, resolvedDateRange.endDate, resolvedDateRange.startDate]);

  const advancedFieldDefinitions = useMemo(() => {
    const optionMap = {
      factory: [...new Set(assignmentFilterItems.map((assignment) => assignment.factory).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ja")),
      machineLabel: [...new Set(assignmentFilterItems.map((assignment) => assignment.machineLabel).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ja")),
      formName: [...new Set(templates.map((form) => String(form?.name ?? form?.formName ?? "").trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ja")),
      schedule: [...new Set(assignmentFilterItems.map((assignment) => assignment.schedule).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ja")),
      completedBy: [...new Set(assignmentFilterItems.flatMap((assignment) => assignment.completedBy ?? []).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ja")),
      hasNGStatus: [...new Set(assignmentFilterItems.map((assignment) => assignment.hasNGStatus).filter(Boolean))],
      submissionActivity: [...new Set(assignmentFilterItems.map((assignment) => assignment.submissionActivity).filter(Boolean))],
    };

    return CHECKLIST_SUBMISSION_ADVANCED_FILTER_FIELDS.map((field) => ({
      ...field,
      options: optionMap[field.field] ?? field.options ?? [],
    }));
  }, [assignmentFilterItems, templates]);

  const filteredAssignments = useMemo(() => {
    if (!appliedAdvancedFilters.length) return assignmentFilterItems;
    return assignmentFilterItems.filter((assignment) => matchesChecklistSubmissionAdvancedFilters(assignment, appliedAdvancedFilters));
  }, [appliedAdvancedFilters, assignmentFilterItems]);

  const filteredMachineIds = useMemo(
    () => new Set(filteredAssignments.map((assignment) => assignment.machineId)),
    [filteredAssignments]
  );
  const filteredFormIds = useMemo(
    () => new Set(filteredAssignments.map((assignment) => assignment.formId)),
    [filteredAssignments]
  );

  const filteredMachines = useMemo(
    () => machines.filter((machine) => filteredMachineIds.has(machine.id)),
    [filteredMachineIds, machines]
  );
  const visibleTemplates = useMemo(
    () => templates.filter((form) => filteredFormIds.has(normalizeId(form._id))),
    [filteredFormIds, templates]
  );
  const filteredMachineNameSet = useMemo(
    () => new Set(filteredMachines.map((machine) => normalizeMachineName(machine.name)).filter(Boolean)),
    [filteredMachines]
  );
  const recordFilterClauses = useMemo(
    () => appliedAdvancedFilters.filter((clause) => RECORD_COMPATIBLE_FILTER_FIELDS.has(clause.field)),
    [appliedAdvancedFilters]
  );

  const monthGroups = useMemo(() => {
    const groups = [];
    for (const date of dates) {
      const label = date.toLocaleDateString("en", { month: "short" });
      if (!groups.length || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 });
      } else {
        groups[groups.length - 1].count += 1;
      }
    }
    return groups;
  }, [dates]);

  const scheduleCounts = useMemo(() => (
    visibleTemplates.reduce((accumulator, template) => {
      if (template.schedule && accumulator[template.schedule] !== undefined) {
        accumulator[template.schedule] += 1;
      }
      return accumulator;
    }, { daily: 0, weekly: 0, monthly: 0 })
  ), [visibleTemplates]);

  const visibleRecords = useMemo(() => {
    return records.filter((record) => {
      if (!isDateWithinRange(record.completedAt, resolvedDateRange.startDate, resolvedDateRange.endDate)) return false;

      const formId = normalizeId(record.formId);
      if (!filteredFormIds.has(formId)) return false;

      const machineId = normalizeId(record.machineId);
      const matchesMachine = machineId
        ? filteredMachineIds.has(machineId)
        : filteredMachineNameSet.has(normalizeMachineName(record.machineName));

      if (!matchesMachine) return false;
      if (!recordFilterClauses.length) return true;

      const template = templatesById.get(formId);
      const equipmentInfo = equipmentMap.get(machineId);
      const recordFactory = String(record.factory ?? template?.工場 ?? equipmentInfo?.factory ?? "").trim();
      const recordMachineName = String(record.machineName ?? equipmentInfo?.name ?? machineId ?? "").trim();
      const completedBy = String(record.completedBy ?? "").trim();
      const recordItem = {
        keyword: buildChecklistSubmissionKeyword([
          recordFactory,
          recordMachineName,
          buildMachineFilterLabel(recordMachineName, recordFactory),
          record.formName ?? template?.name,
          formatScheduleLabel(record.schedule ?? template?.schedule),
          completedBy,
          record.hasNG ? "With NG" : "Without NG",
        ]),
        factory: recordFactory,
        machineLabel: buildMachineFilterLabel(recordMachineName, recordFactory),
        formName: String(record.formName ?? template?.name ?? "").trim(),
        schedule: formatScheduleLabel(record.schedule ?? template?.schedule),
        completedBy,
        hasNGStatus: record.hasNG ? "With NG" : "Without NG",
        lastCompletedAt: formatDateInputValue(record.completedAt),
      };

      return matchesChecklistSubmissionAdvancedFilters(recordItem, recordFilterClauses);
    }).sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
  }, [
    equipmentMap,
    filteredFormIds,
    filteredMachineIds,
    filteredMachineNameSet,
    recordFilterClauses,
    records,
    resolvedDateRange.endDate,
    resolvedDateRange.startDate,
    templatesById,
  ]);

  const ngCount = useMemo(
    () => visibleRecords.filter((record) => record.hasNG).length,
    [visibleRecords]
  );
  const timelineFocusClauses = useMemo(() => {
    return appliedAdvancedFilters.filter((clause) => TIMELINE_FOCUS_FIELD_LABELS[clause.field]);
  }, [appliedAdvancedFilters]);
  const timelineFocusSummary = useMemo(() => {
    const summaryByField = timelineFocusClauses.reduce((map, clause) => {
      const fieldLabel = TIMELINE_FOCUS_FIELD_LABELS[clause.field];
      const nextValue = buildFocusSummaryValue(clause.value);
      if (!fieldLabel || !nextValue) return map;

      const currentValues = map.get(fieldLabel) ?? [];
      currentValues.push(nextValue);
      map.set(fieldLabel, currentValues);
      return map;
    }, new Map());

    return Array.from(summaryByField.entries()).map(([label, values]) => {
      const uniqueValues = [...new Set(values.filter(Boolean))];
      return `${label}: ${uniqueValues.join(", ")}`;
    });
  }, [timelineFocusClauses]);
  const timelineFocusActive = timelineFocusSummary.length > 0;
  const focusedRecordKeys = useMemo(
    () => new Set(visibleRecords.map((record) => getChecklistRecordKey(record))),
    [visibleRecords]
  );
  const rangeDayCount = dates.length;
  const timelineRangeLabel = useMemo(
    () => `${formatTimelineRangeLabel(resolvedDateRange.startDate, resolvedDateRange.endDate)} (${rangeDayCount} days)`,
    [rangeDayCount, resolvedDateRange.endDate, resolvedDateRange.startDate]
  );
  const timelineScopeLabel = `${filteredMachines.length.toLocaleString()} machine${filteredMachines.length === 1 ? "" : "s"} • ${visibleTemplates.length.toLocaleString()} checklist${visibleTemplates.length === 1 ? "" : "s"}`;

  function toggleSchedule(schedule) {
    setActiveSchedules((current) => {
      if (current.includes(schedule)) {
        return current.length === 1 ? current : current.filter((value) => value !== schedule);
      }
      return SCHEDULE_ORDER.filter((value) => current.includes(value) || value === schedule);
    });
  }

  function handleDateChange(field, value) {
    setDateRange((current) => ({ ...current, [field]: value }));
  }

  function handleResetDateRange() {
    setDateRange(createDefaultTimelineRange());
  }

  function handleUpdateAdvancedRow(rowId, patch) {
    setAdvancedRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function handleRemoveAdvancedRow(rowId) {
    setAdvancedRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createChecklistSubmissionFilterRow()];
    });
  }

  function handleApplyAdvancedFilters() {
    setAppliedAdvancedFilters(buildChecklistSubmissionAdvancedFilterClauses(advancedRows, advancedFieldDefinitions));
  }

  function handleClearAdvancedFilters() {
    setAdvancedRows([createChecklistSubmissionFilterRow()]);
    setAppliedAdvancedFilters([]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <section className="h-screen overflow-y-auto px-6 pb-16 pt-24 scrollbar-hide md:px-8">
      <PageHeader
        eyebrow="メンテナンス"
        eyebrowClassName="text-xs tracking-[0.18em]"
        title={t("checklistSubmissions")}
        className="mb-6"
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active Checklists"
          value={visibleTemplates.length.toLocaleString()}
          detail={`${scheduleCounts.daily} daily • ${scheduleCounts.weekly} weekly • ${scheduleCounts.monthly} monthly`}
          icon="checklist"
          iconClassName="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Tracked Machines"
          value={filteredMachines.length.toLocaleString()}
          detail={appliedAdvancedFilters.length ? "Matching the current advanced timeline filters" : `${machines.length} machines in scope`}
          icon="precision_manufacturing"
          iconClassName="bg-tertiary/10 text-tertiary"
        />
        <SummaryCard
          label="Submitted Records"
          value={visibleRecords.length.toLocaleString()}
          detail={`${rangeDayCount}-day selected window`}
          icon="task_alt"
          iconClassName="bg-emerald-500/10 text-emerald-500"
        />
        <SummaryCard
          label="NG Findings"
          value={ngCount.toLocaleString()}
          detail={ngCount > 0 ? "Completed checks with NG markers in the current scope" : "No NG markers in the current scope"}
          icon="warning"
          iconClassName="bg-error/10 text-error"
        />
      </div>

      <div className="mb-6 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <ChecklistSubmissionsFilterPanel
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          rangeLabel={timelineRangeLabel}
          scopeLabel={timelineScopeLabel}
          appliedAdvancedFilterCount={appliedAdvancedFilters.length}
          fieldDefinitions={advancedFieldDefinitions}
          advancedRows={advancedRows}
          onDateChange={handleDateChange}
          onResetDateRange={handleResetDateRange}
          onAddAdvancedRow={() => setAdvancedRows((current) => [...current, createChecklistSubmissionFilterRow()])}
          onUpdateAdvancedRow={handleUpdateAdvancedRow}
          onRemoveAdvancedRow={handleRemoveAdvancedRow}
          onApplyAdvancedFilters={handleApplyAdvancedFilters}
          onClearAdvancedFilters={handleClearAdvancedFilters}
        />

        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Status Guide</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LegendPill label="Completed" tone="bg-emerald-500" />
            <LegendPill label="Missed" tone="bg-error" />
            <LegendPill label="Due" tone="bg-amber-500" />
            <LegendPill label="Completed with NG" tone="bg-emerald-500" withNg />
            {timelineFocusActive && <LegendPill label="Muted Context" tone="bg-outline" />}
          </div>
          <p className="mt-4 text-sm leading-6 text-outline">
            {timelineFocusActive
              ? `Turn Daily, Weekly, and Monthly on or off to focus the timeline. Activity outside the current focus (${timelineFocusSummary.join(" • ")}) is muted for context.`
              : "Turn Daily, Weekly, and Monthly on or off to focus the timeline. The active buttons control which cadence lanes appear inside each day cell."}
          </p>
        </div>
      </div>

      <div className="dashboard-section overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-separator/40 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Timeline</p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">Checklist Submission Timeline</h3>
            <p className="mt-1 text-sm leading-6 text-outline">
              Review completed, due, and missed checks across {filteredMachines.length.toLocaleString()} filtered machines and {visibleTemplates.length.toLocaleString()} active checklist forms. Show one cadence or compare multiple at the same time.
            </p>
            {timelineFocusActive && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Focus mode active: only matching submissions stay highlighted.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {SCHEDULE_ORDER.map((schedule) => {
              const meta = SCHEDULE_META[schedule];
              return (
                <ScheduleFilterButton
                  key={schedule}
                  active={activeSchedules.includes(schedule)}
                  icon={meta.icon}
                  label={meta.label}
                  onClick={() => toggleSchedule(schedule)}
                />
              );
            })}
          </div>
        </div>

        <div ref={scrollRef} className="overflow-auto bg-surface/40">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-24 text-outline">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Loading…
            </div>
          )}

          {!loading && filteredMachines.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-24 text-outline">
              <span className="material-symbols-outlined" style={{ fontSize: 40 }}>precision_manufacturing</span>
              <p className="text-sm">No machines match the current timeline filters.</p>
            </div>
          )}

          {!loading && filteredMachines.length > 0 && (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 border-b border-r border-outline-variant/20 bg-surface px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-outline"
                    style={{ width: MACHINE_COLUMN_WIDTH, minWidth: MACHINE_COLUMN_WIDTH, maxWidth: MACHINE_COLUMN_WIDTH }}
                  >
                    Machine
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky z-20 border-b border-r border-outline-variant/20 bg-surface px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-outline"
                    style={{ left: MACHINE_COLUMN_WIDTH, width: CADENCE_COLUMN_WIDTH, minWidth: CADENCE_COLUMN_WIDTH, maxWidth: CADENCE_COLUMN_WIDTH }}
                  >
                    Cadence
                  </th>
                  {monthGroups.map(({ label, count }, index) => (
                    <th
                      key={`${label}-${index}`}
                      colSpan={count}
                      className="border-b border-r border-outline-variant/10 bg-surface px-0 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-outline"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dates.map((date) => {
                    const isToday = date.getTime() === today.getTime();
                    return (
                      <th
                        key={date.toISOString()}
                        className={`w-16 border-b border-r border-outline-variant/10 px-1 py-2 text-center text-xs font-semibold ${isToday ? "bg-primary/10 text-primary" : "bg-surface text-outline"}`}
                      >
                        <span className="block">{date.getDate()}</span>
                        <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.18em] opacity-70">
                          {date.toLocaleDateString("en", { weekday: "short" }).slice(0, 1)}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredMachines.map((machine, index) => (
                  <tr key={machine.id} className={index % 2 === 0 ? "bg-surface" : "bg-surface-container/30"}>
                    <td
                      className={`sticky left-0 z-10 border-b border-r border-outline-variant/20 px-4 py-2 ${index % 2 === 0 ? "bg-surface" : "bg-surface-container"}`}
                      style={{ width: MACHINE_COLUMN_WIDTH, minWidth: MACHINE_COLUMN_WIDTH, maxWidth: MACHINE_COLUMN_WIDTH }}
                    >
                      <p className="truncate text-sm font-semibold text-on-surface">{machine.name}</p>
                      {machine.factory && machine.factory !== "—" && (
                        <p className="truncate text-[10px] text-outline">{machine.factory}</p>
                      )}
                    </td>
                    <td
                      className={`sticky z-10 border-b border-r border-outline-variant/20 px-3 py-2 align-top ${index % 2 === 0 ? "bg-surface" : "bg-surface-container"}`}
                      style={{ left: MACHINE_COLUMN_WIDTH, width: CADENCE_COLUMN_WIDTH, minWidth: CADENCE_COLUMN_WIDTH, maxWidth: CADENCE_COLUMN_WIDTH }}
                    >
                      <ScheduleLaneLegendCell schedules={activeSchedules} />
                    </td>
                    {dates.map((date) => {
                      const isToday = date.getTime() === today.getTime();
                      const entries = getScheduleEntries(machine, date, visibleTemplates, recordsByFormId, {
                        focusRecordKeys: focusedRecordKeys,
                        focusRecordMode: timelineFocusActive,
                      })
                        .filter((entry) => activeSchedules.includes(entry.schedule));
                      return (
                        <td
                          key={date.toISOString()}
                          className={`border-b border-r border-outline-variant/10 px-1 py-1.5 align-top ${isToday ? "bg-primary/5" : ""}`}
                        >
                          <ScheduleStackCell
                            entries={entries}
                            onSelect={(entry) => setSelectedCell(buildEntrySelection(entry, machine, date))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedCell?.mode === "picker" && createPortal(
        <SubmissionPickerModal
          submissions={selectedCell.submissions}
          machineName={selectedCell.machineName}
          factory={selectedCell.factory}
          schedule={selectedCell.schedule}
          dateLabel={selectedCell.dateLabel}
          onSelect={(submission) => setSelectedCell(buildRecordSelection(submission, "submission", selectedCell))}
          onClose={() => setSelectedCell(null)}
        />,
        document.body
      )}

      {selectedCell?.mode !== "picker" && selectedCell && createPortal(
        <RecordDetailModal
          record={selectedCell.record}
          form={selectedCell.form}
          defaultTab={selectedCell.defaultTab ?? "submission"}
          initialTicketFocusHint={selectedCell.initialTicketFocusHint ?? null}
          onBack={selectedCell.returnToPicker ? () => setSelectedCell(selectedCell.returnToPicker) : null}
          onClose={() => setSelectedCell(null)}
        />,
        document.body
      )}
    </section>
  );
}