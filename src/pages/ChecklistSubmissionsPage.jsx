import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import ChecklistSubmissionsFilterPanel from "../components/ChecklistSubmissionsFilterPanel";
import IconButton from "../components/IconButton";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import MachineExportModal from "../components/MachineExportModal";
import PageHeader from "../components/PageHeader";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";
import TemplateQuickPeekModal from "../components/TemplateQuickPeekModal";
import { useLanguage } from "../contexts/LanguageContext";
import {
  fetchCheckFormRecordById,
  fetchCheckFormTemplateById,
  fetchCheckFormTemplates,
  fetchCheckFormRecords,
  fetchNgReportsByRecordIds,
  fetchSetsubiDBRecords,
  fetchTodayChecklistOverview,
} from "../services/api";
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

  const year = today.getFullYear();
  const month = today.getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);

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

function getMachineScopedRecords(formId, machine, recordsByFormId, equipmentMap = null) {
  return (recordsByFormId.get(formId) ?? []).filter((record) => {
    const normRecName = normalizeMachineName(record.machineName || record["加工設備"]);
    const normMachName = normalizeMachineName(machine.name);

    if (normRecName && normMachName && normRecName === normMachName) return true;

    const recordMachineId = normalizeId(record.machineId || record.equipmentId);
    if (recordMachineId && recordMachineId === machine.id) return true;

    if (equipmentMap && normRecName) {
      const infoByMachineId = equipmentMap.get(machine.id);
      if (infoByMachineId && normalizeMachineName(infoByMachineId.name) === normRecName) return true;

      const infoByRecName = equipmentMap.get(normRecName);
      if (infoByRecName && infoByRecName.id === machine.id) return true;
    }

    return false;
  });
}

function getScheduleEntries(machine, date, forms, recordsByFormId, options = {}) {
  const { focusRecordKeys = null, focusRecordMode = false, equipmentMap = null } = options;
  const isFocusedRecord = (record) => !focusRecordMode || focusRecordKeys?.has(getChecklistRecordKey(record));
  const machineForms = forms.filter((form) =>
    getTemplateEquipmentIds(form).some((id) => normalizeId(id) === machine.id)
    || (Array.isArray(form.equipmentNames) && form.equipmentNames.some((n) => normalizeMachineName(n) === normalizeMachineName(machine.name)))
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
      const machineRecords = getMachineScopedRecords(normalizeId(form._id), machine, recordsByFormId, equipmentMap);
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

function isOptionalTicket(ticket, fields = []) {
  if (!ticket) return false;
  const rawType = String(ticket.ticketType ?? ticket.type ?? ticket.ticket_type ?? ticket.ticketCategory ?? "").trim().toLowerCase();
  if (rawType === "optional") return true;
  if (rawType === "defect") return false;
  if (ticket.isOptional === true || ticket.optional === true) return true;
  if (ticket.isDefect === true) return false;
  if (ticket.required === false) return true;
  if (ticket.required === true) return false;

  // If answer value in ticket is OK / normal / pass / none -> surely optional
  const answer = String(ticket.answerValue ?? ticket.value ?? "").trim().toLowerCase();
  if (answer === "ok" || answer === "合格" || answer === "正常" || answer === "適用" || answer === "なし") {
    return true;
  }
  if (answer === "ng" || answer === "不合格" || answer === "異常" || answer === "あり") {
    return false;
  }

  // If numeric answer is within allowed range -> optional; outside -> defect
  if (ticket.min !== null && ticket.min !== undefined && ticket.max !== null && ticket.max !== undefined && answer !== "") {
    const num = Number(answer);
    if (!Number.isNaN(num)) {
      if (num >= Number(ticket.min) && num <= Number(ticket.max)) {
        return true;
      }
      return false;
    }
  }

  const reason = String(ticket.reason || "").trim().toLowerCase();
  if (
    reason === "optional" ||
    reason.startsWith("optional ticket:") ||
    reason.startsWith("optional:") ||
    reason.startsWith("任意チケット") ||
    reason.startsWith("連絡事項") ||
    reason.startsWith("申し送り")
  ) {
    return true;
  }

  // If matched to a submission field that is OK (not NG / not out-of-range)
  if (Array.isArray(fields) && fields.length > 0) {
    const matchedField = fields.find((f) => doesTicketMatchField(ticket, getFieldTicketHint(f)));
    if (matchedField) {
      const fieldStatus = getFieldStatus(matchedField);
      if (fieldStatus !== "ng" && fieldStatus !== "out-of-range") {
        return true;
      }
    }
  }

  return false;
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

function ScheduleStackCell({ entries, onSelect, compact = false }) {
  if (compact) {
    return (
      <div className="mx-auto flex w-14 flex-wrap items-center justify-center gap-0.5">
        {entries.map((entry) => {
          const interactive = Boolean(entry.primary)
            || (entry.state === "missed" && entry.missedForms?.length > 0)
            || (entry.state === "due" && entry.dueForms?.length > 0);
          const countLabel = getEntryCountLabel(entry);
          const content = (
            <div
              className={`relative inline-flex items-center justify-center rounded px-1 py-0.5 text-[8px] font-bold ${SLOT_STYLES[entry.state]}`}
              title={entry.title}
            >
              <span>{SCHEDULE_META[entry.schedule].short}{countLabel ? ` ${countLabel}` : ""}</span>
              {entry.hasNG && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-error ring-1 ring-surface" />
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
              className="text-left transition hover:scale-105"
              title={`${entry.title}. Click to ${entry.state === "missed" ? "review the missed checklist" : entry.state === "due" ? "review the checklist waiting for submission" : "open the submitted record"}.`}
            >
              {content}
            </button>
          );
        })}
      </div>
    );
  }

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

function ScheduleLaneLegendCell({ schedules, compact = false }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  if (compact) {
    return (
      <div className="flex w-24 items-center justify-center rounded-md px-1 py-1 text-[9px] font-bold uppercase tracking-wider text-outline">
        {schedules.map((s) => SCHEDULE_META[s]?.short).join(" • ")}
      </div>
    );
  }

  return (
    <div className="flex w-24 flex-col gap-1">
      {schedules.map((schedule) => (
        <div
          key={schedule}
          className="flex min-h-[1.45rem] items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline"
        >
          {isJa ? (schedule === "daily" ? "日次" : schedule === "weekly" ? "週次" : schedule === "monthly" ? "月次" : SCHEDULE_META[schedule].label) : SCHEDULE_META[schedule].label}
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



function TodayMachineCard({ machine, templates, recordsByFormId, equipmentMap, onSelectRecord, onExportMachine, onOpenQuickPeek, language }) {
  const isJa = language === "ja";
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayEntries = useMemo(() => {
    return getScheduleEntries(machine, today, templates, recordsByFormId, { equipmentMap });
  }, [equipmentMap, machine, recordsByFormId, templates, today]);

  const allSubmissions = useMemo(() => {
    return todayEntries.flatMap((entry) => entry.submissions || []);
  }, [todayEntries]);

  const hasSubmissions = allSubmissions.length > 0;

  // Extract all defect answers / reasons vs optional ticket answers
  const { defectAnswers, optionalAnswers, hasNG } = useMemo(() => {
    const defects = [];
    const optionals = [];

    for (const sub of allSubmissions) {
      const answers = sub?.record?.answers || [];
      for (const ans of answers) {
        if (ans.hasNG || ans.isDefect || String(ans.ticketType).toLowerCase() === "defect" || String(ans.value).toUpperCase() === "NG") {
          defects.push(ans);
        } else if (ans.ticketType === "optional" || ans.isOptional || (ans.ticketCreated && !ans.hasNG)) {
          optionals.push(ans);
        }
      }
    }

    const ngFlag = defects.length > 0 || allSubmissions.some((sub) => sub.record?.hasNG);
    return { defectAnswers: defects, optionalAnswers: optionals, hasNG: ngFlag };
  }, [allSubmissions]);

  // Extract primary submission (NG first, or latest)
  const primarySubmission = useMemo(() => {
    if (hasNG) {
      return allSubmissions.find((sub) => sub.record?.hasNG) || allSubmissions[0];
    }
    return allSubmissions[0] || null;
  }, [allSubmissions, hasNG]);

  // Extract NG reason if any
  const ngReason = useMemo(() => {
    if (defectAnswers.length > 0) {
      return defectAnswers.map((a) => a.reason || a.label || a.fieldLabel).filter(Boolean).join(" / ");
    }
    if (!primarySubmission?.record?.answers) return "";
    const ngAnswer = primarySubmission.record.answers.find((a) => a.hasNG && a.reason);
    return ngAnswer?.reason || primarySubmission.record.ngReason || "";
  }, [defectAnswers, primarySubmission]);

  // Extract Optional notes if any
  const optionalNote = useMemo(() => {
    if (optionalAnswers.length > 0) {
      return optionalAnswers.map((a) => a.reason || a.memo || a.notes || a.label).filter(Boolean).join(" / ");
    }
    return "";
  }, [optionalAnswers]);

  const inspectorName = primarySubmission?.record?.completedBy || "";
  const submissionTime = primarySubmission?.record?.completedAt
    ? new Date(primarySubmission.record.completedAt).toLocaleTimeString(isJa ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  const checkCount = primarySubmission?.record?.answers?.length ?? primarySubmission?.form?.fields?.length ?? 0;

  const assignedForms = useMemo(() => {
    return templates.filter((form) => getTemplateEquipmentIds(form).includes(machine.id));
  }, [machine.id, templates]);

  const primaryTemplate = primarySubmission?.form || assignedForms[0] || null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (allSubmissions.length > 1) {
          onSelectRecord({
            mode: "picker",
            dateLabel: formatDateInputValue(today),
            factory: machine.factory,
            machineName: machine.name,
            schedule: "daily",
            submissions: sortSubmissionEntries(allSubmissions),
          });
        } else if (primarySubmission) {
          onSelectRecord(buildRecordSelection(primarySubmission, (hasNG || optionalAnswers.length > 0) ? "tickets" : "submission"));
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (primarySubmission) {
            onSelectRecord(buildRecordSelection(primarySubmission, (hasNG || optionalAnswers.length > 0) ? "tickets" : "submission"));
          }
        }
      }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 text-left p-5 ${
        hasSubmissions ? "cursor-pointer" : "cursor-default"
      } ${
        hasNG
          ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60 hover:bg-rose-500/10 shadow-sm"
          : hasSubmissions
            ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 shadow-sm"
            : "border-outline-variant/25 bg-surface/70 hover:border-outline-variant/40 shadow-xs"
      }`}
    >
      <div>
        {/* Top bar: Factory & Status Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container/80 px-2.5 py-1 text-[11px] font-semibold text-outline">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>factory</span>
            {machine.factory && machine.factory !== "—" ? machine.factory : (isJa ? "工場未設定" : "Unassigned")}
          </span>

          {/* Status Badge */}
          {hasNG ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              {isJa ? "NG指摘あり (要対応)" : "Defect Reported"}
            </span>
          ) : hasSubmissions ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
              {isJa ? "点検完了 (正常)" : "Completed (OK)"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
              {isJa ? "未提出 (実施待ち)" : "Pending Check"}
            </span>
          )}
        </div>

        {/* Machine Name, Template Quick Peek Button & Export Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
              hasNG ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : hasSubmissions ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"
            }`}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>precision_manufacturing</span>
            </div>
            <h4 className="truncate text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
              {machine.name}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Quick Peek Button for the whole checklist template */}
            {primaryTemplate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenQuickPeek?.(primaryTemplate, null, machine.name);
                }}
                title={isJa ? `${primaryTemplate.name || "点検表"} の全項目・基準をクイック確認` : "Quick peek full checklist template"}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container text-outline hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition active:scale-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
              </button>
            )}

            {/* Export Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExportMachine(machine);
              }}
              title={isJa ? `${machine.name} の点検表を出力 (PDF / CSV)` : `Export checklist for ${machine.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container text-outline hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition active:scale-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>file_export</span>
            </button>
          </div>
        </div>

        {/* Card Body Details */}
        <div className="mt-4 pt-3 border-t border-separator/40 space-y-2.5">
          {hasSubmissions ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 15 }}>person</span>
                  {inspectorName || (isJa ? "作業者" : "Operator")}
                </span>
                <span className="flex items-center gap-1 text-outline text-[11px]">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                  {submissionTime}
                </span>
              </div>

              {/* Ticket Breakdown Pill Row if any tickets exist */}
              {(defectAnswers.length > 0 || optionalAnswers.length > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {defectAnswers.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                      <span>⚠️</span>
                      <span>{isJa ? `不具合 ${defectAnswers.length}件` : `${defectAnswers.length} Defect${defectAnswers.length > 1 ? "s" : ""}`}</span>
                    </span>
                  )}
                  {optionalAnswers.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                      <span>💬</span>
                      <span>{isJa ? `連絡事項 ${optionalAnswers.length}件` : `${optionalAnswers.length} Optional`}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Defect Callout Box with individual ℹ️ buttons per defect step */}
              {hasNG ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                  <p className="font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>report_problem</span>
                    {isJa ? (defectAnswers.length > 1 ? `NG指摘項目 (${defectAnswers.length}件):` : "NG指摘項目:") : "Defects Reported:"}
                  </p>

                  {defectAnswers.length > 0 ? (
                    <div className="space-y-1.5 pl-0.5">
                      {defectAnswers.map((defect, dIdx) => {
                        const defectLabel = defect.label || defect.fieldLabel || `指摘 #${dIdx + 1}`;
                        const defectReasonText = defect.reason || defect.defectDetails || (isJa ? "規格外・異常の報告あり" : "Defect reported");
                        const targetId = defect.fieldId || defect.id || defect.label || defect.fieldLabel;

                        return (
                          <div
                            key={dIdx}
                            className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-surface/80 p-2 shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-[11.5px] text-on-surface">
                                #{dIdx + 1} {defectLabel}
                              </p>
                              <p className="truncate text-[10.5px] font-medium text-rose-700 dark:text-rose-300 mt-0.5">
                                {defectReasonText}
                              </p>
                            </div>

                            {/* ℹ️ Quick peek button for this specific defect */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenQuickPeek?.(primaryTemplate, targetId, machine.name);
                              }}
                              title={isJa ? `「${defectLabel}」の点検基準・定義をクイック確認` : `Quick peek checklist step for ${defectLabel}`}
                              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/30 hover:scale-105 transition active:scale-95 shadow-xs"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-medium leading-relaxed pl-5 line-clamp-2">
                      {ngReason || (isJa ? "規格外または異常の報告があります" : "Out of range value or defect reported")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>task_alt</span>
                  {isJa ? `全 ${checkCount} 項目 正常確認済` : `All ${checkCount} checks verified normal`}
                </p>
              )}

              {/* Optional handover note callout if present */}
              {optionalAnswers.length > 0 && (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-2 text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
                  <p className="font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chat</span>
                    {isJa ? `申し送り・連絡メモ (${optionalAnswers.length}件):` : `Handover Notes (${optionalAnswers.length}):`}
                  </p>
                  <div className="space-y-1 pl-0.5">
                    {optionalAnswers.map((opt, oIdx) => {
                      const optLabel = opt.label || opt.fieldLabel || `連絡事項 #${oIdx + 1}`;
                      const optText = opt.reason || opt.memo || opt.notes || (isJa ? "作業者からの連絡事項あり" : "Note attached");
                      const targetId = opt.fieldId || opt.id || opt.label || opt.fieldLabel;

                      return (
                        <div
                          key={oIdx}
                          className="flex items-center justify-between gap-2 rounded-lg border border-blue-500/20 bg-surface/80 p-1.5 shadow-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[11px] text-on-surface">
                              {optLabel}
                            </p>
                            <p className="truncate text-[10px] text-blue-700 dark:text-blue-300">
                              {optText}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenQuickPeek?.(primaryTemplate, targetId, machine.name);
                            }}
                            title={isJa ? `「${optLabel}」の点検項目をクイック確認` : `Quick peek step for ${optLabel}`}
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30 transition active:scale-95"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {allSubmissions.length > 1 && (
                <p className="text-[11px] font-semibold text-primary">
                  {isJa ? `本日 ${allSubmissions.length} 件の提出データあり` : `${allSubmissions.length} submissions today`}
                </p>
              )}
            </>
          ) : (
            <div className="py-1 space-y-1.5">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pending_actions</span>
                <span>{isJa ? "本日の点検は未提出です" : "No checklist submitted yet today"}</span>
              </div>
              {assignedForms.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {assignedForms.map((form) => (
                    <button
                      key={form._id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQuickPeek?.(form, null, machine.name);
                      }}
                      title={isJa ? `${form.name || "点検表"} のテンプレート内容をクイック確認` : "Quick peek template"}
                      className="inline-flex items-center gap-1 rounded-md border border-outline-variant/30 bg-surface-container px-2 py-0.5 text-[10px] text-outline hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition"
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 11 }}>fact_check</span>
                      <span className="truncate max-w-[140px]">{form.name_ja || form.name || form.name_en}</span>
                      <span className="material-symbols-outlined text-outline" style={{ fontSize: 12 }}>info</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Action */}
      <div className="mt-4 pt-3 border-t border-separator/30 flex items-center justify-between text-xs">
        {hasNG ? (
          <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 group-hover:underline">
            {isJa
              ? (optionalAnswers.length > 0 ? `不具合(${defectAnswers.length || 1})・連絡事項(${optionalAnswers.length})を確認` : "NGチケット・処置内容を確認")
              : "View NG Tickets & Fix"} ➔
          </span>
        ) : optionalAnswers.length > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
            {isJa ? `連絡事項(${optionalAnswers.length}件)・点検結果を見る` : `View Notes (${optionalAnswers.length}) & Record`} ➔
          </span>
        ) : hasSubmissions ? (
          <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:underline">
            {isJa ? "点検結果の詳細を見る" : "View Inspection Record"} ➔
          </span>
        ) : (
          <span className="text-outline text-[11px] italic">
            {isJa ? "現場での入力待ち" : "Awaiting shop floor input"}
          </span>
        )}
      </div>
    </div>
  );
}

function RecordDetailModal({ defaultTab = "submission", form, initialTicketFocusHint = null, onBack = null, onClose, onOpenQuickPeek = null, record, templatesById = null }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isJa = language === "ja";
  const isMissedRecord = record?.status === "missed";
  const isWaitingRecord = record?.status === "waiting";
  const isReferenceRecord = isMissedRecord || isWaitingRecord;
  const normalizedDefaultTab = defaultTab === "tickets" ? "tickets" : "submission";
  const [activeTab, setActiveTab] = useState(normalizedDefaultTab);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [ticketFocusHint, setTicketFocusHint] = useState(initialTicketFocusHint ?? null);
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState(new Set());
  const ticketRefs = useRef(new Map());

  const targetTemplateId = normalizeId(form?._id ?? record?.formId ?? record?.templateId ?? record?.checkFormTemplateId);
  const matchedTemplate = templatesById?.get(targetTemplateId) ?? form ?? null;
  const [fetchedTemplate, setFetchedTemplate] = useState(null);

  useEffect(() => {
    let active = true;
    if (targetTemplateId && (!matchedTemplate || !Array.isArray(matchedTemplate.fields) || matchedTemplate.fields.length === 0 || !matchedTemplate.name_en)) {
      fetchCheckFormTemplateById(targetTemplateId)
        .then((tpl) => {
          if (active && tpl) setFetchedTemplate(tpl);
        })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [targetTemplateId, matchedTemplate]);

  const activeTemplate = matchedTemplate || fetchedTemplate || form || null;

  const templateFieldsMap = useMemo(() => {
    const map = new Map();
    const tFields = Array.isArray(activeTemplate?.fields) ? activeTemplate.fields : [];
    for (const f of tFields) {
      if (f.id) map.set(String(f.id), f);
      if (f.fieldId) map.set(String(f.fieldId), f);
    }
    return map;
  }, [activeTemplate]);

  const recordAnswers = Array.isArray(record?.answers)
    ? record.answers.filter((field) => field.type !== "name")
    : [];
  const fields = recordAnswers.length > 0
    ? recordAnswers
    : (activeTemplate?.fields ?? form?.fields ?? []).filter((field) => field.type !== "name");
  const responses = record?.responses ?? {};
  const recordId = normalizeId(record?._id ?? record?.recordId);
  const formName = isJa
    ? (activeTemplate?.name_ja || activeTemplate?.name || form?.name_ja || form?.name || record?.formName_ja || record?.formName || "点検提出")
    : (activeTemplate?.name_en || activeTemplate?.name || form?.name_en || form?.name || record?.formName_en || record?.formName || "Checklist Submission");
  const recordFactory = form?.工場 ?? record?.factory ?? activeTemplate?.工場 ?? "";
  const recordSchedule = record?.schedule ?? form?.schedule ?? activeTemplate?.schedule ?? "";
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

    const openTickets = tickets.filter(
      (t) => normalizeTicketStatusValue(t.status) !== "closed" && normalizeTicketStatusValue(t.status) !== "fixed"
    );
    const allClosed = tickets.length > 0 && openTickets.length === 0;
    const defectCount = openTickets.filter((t) => !isOptionalTicket(t, fields)).length;
    const optionalCount = openTickets.filter((t) => isOptionalTicket(t, fields)).length;

    return [
      {
        key: "submission",
        label: (
          <span className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fact_check</span>
            <span>{isJa ? "提出内容" : "Submitted"}</span>
          </span>
        ),
      },
      {
        key: "tickets",
        label: (
          <span className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>confirmation_number</span>
            <span>{isJa ? "NG理由・処置" : "NG Reasons"}</span>
            {allClosed ? (
              <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                {isJa ? "解決済" : "Fixed"}
              </span>
            ) : defectCount > 0 || optionalCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                {defectCount > 0 && (
                  <span
                    className="rounded-full bg-error/15 text-error px-2 py-0.5 text-[10px] font-bold"
                    title={isJa ? `異常・不具合: ${defectCount}件` : `Defect tickets: ${defectCount}`}
                  >
                    {defectCount}
                  </span>
                )}
                {optionalCount > 0 && (
                  <span
                    className="rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold"
                    title={isJa ? `連絡・申し送り: ${optionalCount}件` : `Optional tickets: ${optionalCount}`}
                  >
                    {optionalCount}
                  </span>
                )}
              </span>
            ) : (
              <span className="rounded-full bg-outline/10 text-outline px-2 py-0.5 text-[10px] font-semibold">
                0
              </span>
            )}
          </span>
        ),
      },
    ];
  }, [activeTab, fields, isJa, isMissedRecord, isReferenceRecord, tickets]);

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
    const rawVal = String(field.value ?? field.displayValue ?? "").trim().toUpperCase();
    if (rawVal === "NG") return "ng";

    if (field.fieldId) {
      const st = String(field.status ?? "").trim().toLowerCase();
      if (st === "ng" || st === "out-of-range") return st;
      return rawVal === "NG" ? "ng" : (st || "ok");
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

    const timer = setTimeout(() => {
      const node = ticketRefs.current.get(highlightedTicketKey);
      if (node) {
        node.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 60);

    return () => clearTimeout(timer);
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "点検提出記録" : "Inspection Record"}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-on-surface">{formName}</h3>
              {activeTemplate && (
                <button
                  type="button"
                  onClick={() => onOpenQuickPeek?.(activeTemplate, null, false)}
                  title={isJa ? "点検表テンプレートの全項目をクイック確認" : "Quick peek full checklist template"}
                  className="inline-flex items-center gap-1 rounded-lg border border-separator/40 bg-surface px-2.5 py-1 text-xs font-semibold text-on-surface shadow-2xs hover:border-primary/40 hover:text-primary transition active:scale-95"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
                  <span>{isJa ? "テンプレート確認" : "Quick Peek Template"}</span>
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-outline">
              {recordFactory && <span>{recordFactory}</span>}
              {recordSchedule && (
                <span>
                  {isJa
                    ? (recordSchedule === "daily" ? "日次" : recordSchedule === "weekly" ? "週次" : recordSchedule === "monthly" ? "月次" : recordSchedule)
                    : recordSchedule}
                </span>
              )}
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
                <button
                  type="button"
                  onClick={() => navigate(`/setsubi?q=${encodeURIComponent(record.machineName)}`)}
                  title={isJa ? "設備台帳でこの設備を確認" : "View equipment in Setsubi DB"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface hover:border-primary/40 hover:bg-surface-container-high transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>precision_manufacturing</span>
                  <span className="font-semibold">{record.machineName}</span>
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 13 }}>open_in_new</span>
                </button>
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
                <button
                  type="button"
                  onClick={() => navigate(`/setsubi?q=${encodeURIComponent(record.machineName)}`)}
                  title={isJa ? "設備台帳でこの設備を確認" : "View equipment in Setsubi DB"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface hover:border-primary/40 hover:bg-surface-container-high transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>precision_manufacturing</span>
                  <span className="font-semibold">{record.machineName}</span>
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 13 }}>open_in_new</span>
                </button>
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
                const templateField = templateFieldsMap.get(String(fieldId)) || {};
                const photo = field.fieldPhotoURL || responses[`${fieldId}_photo`];
                const value = isReferenceRecord ? "" : formatValue(field);
                const fieldStatus = getFieldStatus(field);
                const valueTone = getFieldValueTone(field, fieldStatus);
                const answeredAtLabel = formatAnsweredAt(field.answeredAt);
                const isProblemField = fieldStatus === "ng" || fieldStatus === "out-of-range";
                const problemFieldHint = getFieldTicketHint(field);
                const matchingTicket = tickets.find((ticket) => doesTicketMatchField(ticket, problemFieldHint));
                const isOptional = isOptionalTicket(matchingTicket, fields);
                const isDefect = isProblemField && !isOptional;
                const ticketStatus = normalizeTicketStatusValue(matchingTicket?.status);
                const isFixed = isDefect && (ticketStatus === "closed" || ticketStatus === "fixed" || ticketStatus === "resolved");
                const isPendingFix = isDefect && !isFixed;
                const hasOptionalNote = isOptional || (!isDefect && Boolean(matchingTicket));
                const canOpenTicket = (isProblemField || Boolean(matchingTicket)) && hasTicketTabContent;
                const cardIsClickable = canOpenTicket && (matchingTicket || ticketsLoading || tickets.length === 0);

                const labelJa = field.label_ja || templateField.label_ja || field.label || templateField.label || "";
                const labelEn = field.label_en || templateField.label_en || field.label || templateField.label || "";
                const descJa = field.description_ja || templateField.description_ja || field.description || templateField.description || "";
                const descEn = field.description_en || templateField.description_en || field.description || templateField.description || "";

                const displayFieldLabel = isJa ? (labelJa || labelEn || (field.type === "name" ? "名前" : "無題")) : (labelEn || labelJa || (field.type === "name" ? "Name" : "Untitled"));
                const displayFieldDesc = isJa ? (descJa || descEn || "") : (descEn || descJa || "");

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
                    title={cardIsClickable ? (isFixed ? (isJa ? "クリックして処置内容・NG理由を確認" : "Click to view fix details & NG reason") : isOptional ? (isJa ? "クリックして連絡事項・チケットを確認" : "Click to view optional ticket note") : (isJa ? "クリックしてNG理由・チケットを確認" : "Click to open NG reason ticket")) : undefined}
                    className={`rounded-2xl border px-4 py-3.5 transition-all ${
                      isFixed
                        ? "border-emerald-300/80 bg-emerald-50/50 hover:border-emerald-400 hover:bg-emerald-50/80"
                        : isPendingFix
                          ? "border-red-400/80 bg-red-50 hover:border-red-500 hover:bg-red-100/80"
                          : hasOptionalNote
                            ? "border-blue-200/90 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50/70"
                            : "border-outline-variant/20 bg-surface-container hover:border-primary/30 hover:bg-surface-container-high"
                    } ${
                      cardIsClickable
                        ? "cursor-pointer focus:outline-none focus:ring-2 " + (isFixed ? "focus:ring-emerald-300" : isPendingFix ? "focus:ring-red-300" : hasOptionalNote ? "focus:ring-blue-300" : "focus:ring-primary/30")
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-on-surface">
                            {displayFieldLabel}
                          </p>
                        </div>
                        {displayFieldDesc && (
                          <p className="mt-0.5 text-xs text-outline whitespace-pre-line">
                            {displayFieldDesc}
                          </p>
                        )}
                        {answeredAtLabel && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-outline">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                            {isJa ? `回答日時: ${answeredAtLabel}` : `Answered ${answeredAtLabel}`}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        {isReferenceRecord ? (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "未提出" : "Not submitted"}</p>
                        ) : isFixed ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-red-500/70 line-through">
                              {value}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>task_alt</span>
                              {isJa ? "処置完了" : "FIXED"}
                            </span>
                          </div>
                        ) : isPendingFix ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
                              {value || "NG"}
                            </span>
                          </div>
                        ) : hasOptionalNote ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-semibold ${valueTone}`}>{value}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/10 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>chat</span>
                              {isJa ? "連絡事項" : "Optional"}
                            </span>
                          </div>
                        ) : (
                          <p className={`text-sm font-semibold ${valueTone}`}>{value}</p>
                        )}
                        {!isReferenceRecord && fieldStatus === "out-of-range" && !isFixed && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-error">Out of range</p>
                        )}
                      </div>
                    </div>

                    {/* Fixed Resolution Banner if defect fixed */}
                    {isFixed && (
                      <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-white/90 px-3 py-1.5 text-xs text-emerald-900 shadow-xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                          <span className="material-symbols-outlined text-emerald-600 flex-shrink-0" style={{ fontSize: 15 }}>build</span>
                          <span className="truncate font-medium text-[11.5px]">
                            <strong className="font-semibold text-emerald-800">{isJa ? "処置内容:" : "Fix:"}</strong> {matchingTicket?.fixReason || (isJa ? "対応完了 (Closed)" : "Resolved")}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 flex-shrink-0">
                          <span>{isJa ? "詳細" : "Details"}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
                        </span>
                      </div>
                    )}

                    {/* Unresolved Alert Banner if pending defect */}
                    {isPendingFix && (
                      <div className="mt-2.5 flex items-center justify-between rounded-xl border border-red-200 bg-white/90 px-3 py-1.5 text-xs text-red-900 shadow-xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                          <span className="material-symbols-outlined text-red-600 flex-shrink-0" style={{ fontSize: 15 }}>warning</span>
                          <span className="truncate font-medium text-[11.5px]">
                            {matchingTicket?.reason ? (
                              <><strong>{isJa ? "NG理由:" : "Reason:"}</strong> {matchingTicket.reason}</>
                            ) : (
                              isJa ? "未解決のNG指摘があります" : "Unresolved defect reported"
                            )}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-700 flex-shrink-0">
                          <span>{isJa ? "NG理由を見る" : "View NG"}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
                        </span>
                      </div>
                    )}

                    {/* Optional Ticket Note Banner */}
                    {hasOptionalNote && (
                      <div className="mt-2.5 flex items-center justify-between rounded-xl border border-blue-200/80 bg-white/90 px-3 py-1.5 text-xs text-blue-950 shadow-xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                          <span className="material-symbols-outlined text-blue-600 flex-shrink-0" style={{ fontSize: 15 }}>chat_bubble</span>
                          <span className="truncate font-medium text-[11.5px]">
                            <strong className="font-semibold text-blue-800">{isJa ? "連絡事項:" : "Note:"}</strong> {matchingTicket?.reason ? matchingTicket.reason.replace(/^(Optional Ticket:\s*|Optional:\s*)/i, "") : (isJa ? "申し送り事項あり" : "Note attached")}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-700 flex-shrink-0">
                          <span>{isJa ? "内容を見る" : "View Note"}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
                        </span>
                      </div>
                    )}

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
                        <p className="mt-2 text-[11px] font-semibold text-primary">{isJa ? "クリックして拡大" : "Click image to enlarge"}</p>
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
                  {isJa ? "NG理由を読み込み中…" : "Loading NG reasons…"}
                </div>
              )}

              {!ticketsLoading && tickets.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container/40 px-6 py-12 text-center text-outline">
                  <span className="material-symbols-outlined" style={{ fontSize: 36 }}>task_alt</span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {isJa ? "この記録に関連するNGチケットはありません" : "No NG tickets found for this record"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-outline">
                      {hasTicketTabContent
                        ? (isJa ? "フラグは付いていますが、ngReportsDBからチケット詳細は返されませんでした。" : "This record is flagged, but no ticket details were returned from ngReportsDB.")
                        : (isJa ? "この提出にはNG判定や規格外の指摘理由はありません。" : "This submission does not have any NG or out-of-range ticket reasons.")}
                    </p>
                  </div>
                </div>
              )}

              {!ticketsLoading && tickets.map((ticket) => {
                const expectedRange = formatTicketRange(ticket);
                const ticketKey = getTicketKey(ticket);
                const isHighlightedTicket = tickets.length > 1 && highlightedTicketKey === ticketKey;
                const isTicketOptional = isOptionalTicket(ticket, fields);
                const statusMeta = getTicketStatusMeta(ticket.status);

                const templateField = templateFieldsMap.get(String(ticket.fieldId)) || {};
                const ticketLabelJa = ticket.fieldLabel_ja || templateField.label_ja || ticket.fieldLabel || templateField.label || "";
                const ticketLabelEn = ticket.fieldLabel_en || templateField.label_en || ticket.fieldLabel || templateField.label || "";
                const displayTicketLabel = isJa ? (ticketLabelJa || ticketLabelEn || "無題") : (ticketLabelEn || ticketLabelJa || "Untitled field");

                const displayReason = isJa
                  ? (ticket.reason_ja || ticket.reason || ticket.reason_en || (isTicketOptional ? "連絡・申し送り" : "理由の入力はありません"))
                  : (ticket.reason_en || ticket.reason || ticket.reason_ja || (isTicketOptional ? "Optional Note" : "No reason provided."));

                const displayFixReason = isJa
                  ? (ticket.fixReason_ja || ticket.fixReason || ticket.fixReason_en || "処置メモはありません")
                  : (ticket.fixReason_en || ticket.fixReason || ticket.fixReason_ja || "No fix note provided.");

                return (
                  <article
                    key={ticketKey}
                    ref={(node) => {
                      if (node) ticketRefs.current.set(ticketKey, node);
                      else ticketRefs.current.delete(ticketKey);
                    }}
                    className={`rounded-2xl border px-4 py-4 transition-all duration-300 ${
                      isHighlightedTicket
                        ? "border-primary/80 bg-primary/5 shadow-md shadow-primary/10 ring-2 ring-primary/40"
                        : "border-separator/40 bg-surface-container"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-on-surface">{displayTicketLabel}</h4>
                          {isHighlightedTicket && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-on-primary shadow-xs">
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>my_location</span>
                              {isJa ? "選択項目" : "Selected"}
                            </span>
                          )}
                          {isTicketOptional ? (
                            <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                              💬 {isJa ? "連絡・申し送り" : "Optional Note"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                              ⚠️ {isJa ? "異常・不具合" : "Defect"}
                            </span>
                          )}
                          {ticket.fieldType && (
                            <span className="rounded-full bg-outline/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                              {ticket.fieldType}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-outline">
                          {ticket.answerValue && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-semibold text-on-surface">
                              <span
                                className={`material-symbols-outlined ${isTicketOptional ? "text-emerald-600 dark:text-emerald-400" : "text-error"}`}
                                style={{ fontSize: 12 }}
                              >
                                {isTicketOptional ? "check_circle" : "warning"}
                              </span>
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
                      <div className="flex items-center gap-2">
                        {activeTemplate && (
                          <button
                            type="button"
                            onClick={() => onOpenQuickPeek?.(activeTemplate, ticket.fieldId || ticket.fieldLabel || ticketLabelJa || ticketLabelEn, isTicketOptional)}
                            title={isJa ? "テンプレート上の該当項目をクイック確認" : "Quick peek this checklist step"}
                            className="inline-flex items-center gap-1 rounded-lg border border-separator/40 bg-surface px-2 py-1 text-[10px] font-semibold text-outline hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition active:scale-95 shadow-2xs"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>visibility</span>
                            <span>{isJa ? "項目確認" : "Peek Step"}</span>
                          </button>
                        )}
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusMeta.badgeClassName}`}>
                          {statusMeta.label}
                        </span>
                        <button
                          type="button"
                          title="Open in Submitted Tickets"
                          onClick={() => navigate("/maintenance/submissions/tickets", { state: { openTicket: ticket } })}
                          className="inline-flex items-center gap-1 rounded-lg border border-separator/40 bg-white px-2 py-1 text-[10px] font-semibold text-outline transition hover:border-primary/30 hover:text-primary"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_outward</span>
                          View
                        </button>
                      </div>
                    </div>

                    {/* NG Reason / Note */}
                    <div className="mt-3 rounded-2xl bg-surface px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                        {isTicketOptional ? (isJa ? "連絡・申し送り事項" : "Optional Note") : (isJa ? "NG理由" : "NG Reason")}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-on-surface">{displayReason}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-outline">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleString(isJa ? "ja-JP" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
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
                                alt={displayTicketLabel}
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
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">{isJa ? "最新の処置内容" : "Latest Fix"}</p>
                        <p className="mt-1 text-sm leading-6 text-on-surface">{displayFixReason}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-outline">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 14 }}>task_alt</span>
                            {new Date(ticket.closedAt).toLocaleString(isJa ? "ja-JP" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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
  const { t, language } = useLanguage();
  const isJa = language === "ja";
  const [templates, setTemplates] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => createDefaultTimelineRange());
  const [advancedRows, setAdvancedRows] = useState(() => [createChecklistSubmissionFilterRow()]);
  const [selectedTimelineFactories, setSelectedTimelineFactories] = useState([]);
  const [factoryDropdownOpen, setFactoryDropdownOpen] = useState(false);
  const factoryDropdownRef = useRef(null);
  const [viewMode, setViewMode] = useState("today"); // "today" | "standard" | "compact"
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState([]);
  const [todayOverview, setTodayOverview] = useState(null);
  const [loadingToday, setLoadingToday] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState(SCHEDULE_ORDER);
  const [selectedCell, setSelectedCell] = useState(null);
  const [exportingMachine, setExportingMachine] = useState(null);
  const [peekState, setPeekState] = useState(null);
  const scrollRef = useRef(null);

  function handleOpenQuickPeek(templateOrId, activeFieldId = null, isOptional = false) {
    if (!templateOrId) return;
    const isObj = typeof templateOrId === "object";
    setPeekState({
      template: isObj ? templateOrId : null,
      templateId: isObj ? templateOrId._id : templateOrId,
      activeFieldId,
      isOptional,
    });
  }

  const resolvedDateRange = useMemo(
    () => resolveTimelineRange(dateRange.startDate, dateRange.endDate),
    [dateRange.endDate, dateRange.startDate]
  );
  const dates = useMemo(
    () => getDatesInRange(resolvedDateRange.startDate, resolvedDateRange.endDate),
    [resolvedDateRange.endDate, resolvedDateRange.startDate]
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (factoryDropdownRef.current && !factoryDropdownRef.current.contains(event.target)) {
        setFactoryDropdownOpen(false);
      }
    }
    if (factoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [factoryDropdownOpen]);

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
    async function loadTodayData() {
      setLoadingToday(true);
      try {
        const result = await fetchTodayChecklistOverview({
          factory: selectedTimelineFactories.length === 1 ? selectedTimelineFactories[0] : "",
        });
        if (result) {
          setTodayOverview(result);
        }
      } catch (err) {
        console.error("Failed to load today checklist overview:", err);
      } finally {
        setLoadingToday(false);
      }
    }

    loadTodayData();
  }, [selectedTimelineFactories]);

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
      const eqName = String(equipment.name || equipment.設備名 || equipment.name_ja || equipment._id).trim();
      const factory = String(equipment.工場 || equipment.factory || "—").trim();
      const setsubiNo = String(equipment.設備No || equipment.管理番号 || equipment.設備番号 || equipment.code || equipment.machineNo || "").trim();
      map.set(normalizeId(equipment._id), { name: eqName, factory, setsubiNo, raw: equipment });
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
      const formId = normalizeId(record.formId || record.templateId);
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

  const availableTimelineFactories = useMemo(() => {
    const raw = machines.map((m) => m.factory).filter(Boolean).filter((f) => f !== "—");
    return [...new Set(raw)].sort((a, b) => a.localeCompare(b, "ja"));
  }, [machines]);

  const timelineFactoryCounts = useMemo(() => {
    const counts = {};
    for (const m of machines) {
      if (m.factory && m.factory !== "—") {
        counts[m.factory] = (counts[m.factory] || 0) + 1;
      }
    }
    return counts;
  }, [machines]);

  const timelineFactoryButtonLabel = useMemo(() => {
    if (selectedTimelineFactories.length === 0) {
      return isJa ? "すべての工場" : "All Factories";
    }
    if (selectedTimelineFactories.length === 1) {
      return selectedTimelineFactories[0];
    }
    return isJa
      ? `${selectedTimelineFactories[0]} 他 ${selectedTimelineFactories.length - 1}件`
      : `${selectedTimelineFactories[0]} +${selectedTimelineFactories.length - 1}`;
  }, [selectedTimelineFactories, isJa]);

  const filteredMachines = useMemo(() => {
    let list = machines.filter((machine) => filteredMachineIds.has(machine.id));
    if (selectedTimelineFactories.length > 0) {
      list = list.filter((m) => selectedTimelineFactories.includes(m.factory));
    }
    return list;
  }, [filteredMachineIds, machines, selectedTimelineFactories]);

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

      const formId = normalizeId(record.formId || record.templateId);
      if (!filteredFormIds.has(formId)) return false;

      const machineId = normalizeId(record.machineId || record.equipmentId);
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

  function jumpToToday() {
    if (!scrollRef.current) return;
    const todayTime = today.getTime();
    const todayIndex = dates.findIndex((d) => d.getTime() === todayTime);
    if (todayIndex >= 0) {
      const targetScroll = Math.max(0, todayIndex * TIMELINE_CELL_WIDTH - 180);
      scrollRef.current.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }

  function exportToCSV() {
    const headers = [
      isJa ? "日付" : "Date",
      isJa ? "設備名" : "Machine",
      isJa ? "工場" : "Factory",
      isJa ? "点検フォーム" : "Checklist Form",
      isJa ? "周期" : "Schedule",
      isJa ? "ステータス" : "Status",
      isJa ? "作業者" : "Operator",
      isJa ? "NG判定" : "Has NG",
      isJa ? "実施日時" : "Completed At",
    ];

    const rows = visibleRecords.map((r) => {
      const machine = equipmentMap.get(normalizeId(r.machineId || r.equipmentId))?.name || r.machineName || "—";
      const form = templatesById.get(normalizeId(r.formId || r.templateId));
      const formName = form?.name || r.formName || "—";
      const factory = form?.工場 || r.factory || "—";
      const schedule = r.schedule || form?.schedule || "—";
      const status = r.status || (r.hasNG ? "NG" : "OK");
      const operator = r.completedBy || "—";
      const hasNG = r.hasNG ? (isJa ? "あり" : "Yes") : (isJa ? "なし" : "No");
      const completedAt = r.completedAt ? new Date(r.completedAt).toLocaleString(isJa ? "ja-JP" : "en-US") : "—";

      return [
        r.completedAt ? formatDateInputValue(r.completedAt) : "—",
        `"${String(machine).replace(/"/g, '""')}"`,
        `"${String(factory).replace(/"/g, '""')}"`,
        `"${String(formName).replace(/"/g, '""')}"`,
        schedule,
        status,
        `"${String(operator).replace(/"/g, '""')}"`,
        hasNG,
        `"${String(completedAt).replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `checklist_submissions_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="h-screen overflow-y-auto px-6 pb-16 pt-24 scrollbar-hide md:px-8">
      <PageHeader
        eyebrow={isJa ? "点検" : "Checklist"}
        eyebrowClassName="text-xs tracking-[0.18em]"
        title={t("checklistSubmissions")}
        className="mb-6"
        actionsClassName="flex-wrap items-center gap-2.5"
        actions={(
          <>
            <button
              type="button"
              onClick={() => navigate("/maintenance/submissions/tickets")}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container-high active:scale-95"
            >
              <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 18 }}>report_problem</span>
              {isJa ? "点検不具合一覧" : "Checklist Defects"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/maintenance")}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container-high active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>checklist</span>
              {isJa ? "点検フォーム管理" : "Checklist Forms"}
            </button>
          </>
        )}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={isJa ? "有効な点検フォーム" : "Active Checklists"}
          value={visibleTemplates.length.toLocaleString()}
          detail={isJa ? `日次 ${scheduleCounts.daily} • 週次 ${scheduleCounts.weekly} • 月次 ${scheduleCounts.monthly}` : `${scheduleCounts.daily} daily • ${scheduleCounts.weekly} weekly • ${scheduleCounts.monthly} monthly`}
          icon="checklist"
          iconClassName="bg-primary/10 text-primary"
        />
        <SummaryCard
          label={isJa ? "対象設備数" : "Tracked Machines"}
          value={filteredMachines.length.toLocaleString()}
          detail={isJa ? (appliedAdvancedFilters.length ? "現在の詳細フィルター条件に一致" : `${machines.length}台の設備が対象`) : (appliedAdvancedFilters.length ? "Matching the current advanced timeline filters" : `${machines.length} machines in scope`)}
          icon="precision_manufacturing"
          iconClassName="bg-tertiary/10 text-tertiary"
        />
        <SummaryCard
          label={isJa ? "提出済み記録" : "Submitted Records"}
          value={visibleRecords.length.toLocaleString()}
          detail={isJa ? `選択期間 (${rangeDayCount}日間)` : `${rangeDayCount}-day selected window`}
          icon="task_alt"
          iconClassName="bg-emerald-500/10 text-emerald-500"
        />
        <SummaryCard
          label={isJa ? "NG判定・指摘" : "NG Findings"}
          value={ngCount.toLocaleString()}
          detail={isJa ? (ngCount > 0 ? "対象範囲内でNG判定・指摘がある提出" : "対象範囲内にNG判定はありません") : (ngCount > 0 ? "Completed checks with NG markers in the current scope" : "No NG markers in the current scope")}
          icon="warning"
          iconClassName="bg-error/10 text-error"
        />
      </div>

      {/* Simplified Filter & Advanced Filter */}
      <div className="mb-6">
        <ChecklistSubmissionsFilterPanel
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
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
      </div>

      <div className="dashboard-section relative z-20 overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-separator/40 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "タイムライン" : "Timeline"}</p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">{isJa ? "チェックリスト提出タイムライン" : "Checklist Submission Timeline"}</h3>
            <p className="mt-1 text-sm leading-6 text-outline">
              {isJa
                ? `フィルター対象の${filteredMachines.length.toLocaleString()}台の設備と${visibleTemplates.length.toLocaleString()}件の有効チェックリストの提出状況を確認します。`
                : `Review completed, due, and missed checks across ${filteredMachines.length.toLocaleString()} filtered machines and ${visibleTemplates.length.toLocaleString()} active checklist forms.`}
            </p>
            {timelineFocusActive && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Focus mode active: only matching submissions stay highlighted.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Factory Quick Multi-Select Filter */}
            {availableTimelineFactories.length > 0 && (
              <div className="relative z-30 flex items-center gap-1.5" ref={factoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setFactoryDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    selectedTimelineFactories.length > 0
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>factory</span>
                  <span>{timelineFactoryButtonLabel}</span>
                  {selectedTimelineFactories.length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                      {selectedTimelineFactories.length}
                    </span>
                  )}
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {factoryDropdownOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {factoryDropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[210px] rounded-2xl border border-separator/60 bg-surface p-2 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-separator/40 px-2 py-1.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedTimelineFactories(availableTimelineFactories)}
                        className="text-primary hover:underline"
                      >
                        {isJa ? "すべて選択" : "Select All"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTimelineFactories([])}
                        className="text-outline hover:text-on-surface"
                      >
                        {isJa ? "クリア" : "Clear"}
                      </button>
                    </div>
                    <div className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto">
                      {availableTimelineFactories.map((factoryName) => {
                        const isSelected = selectedTimelineFactories.includes(factoryName);
                        const count = timelineFactoryCounts[factoryName] || 0;
                        return (
                          <label
                            key={factoryName}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedTimelineFactories((current) =>
                                    isSelected
                                      ? current.filter((item) => item !== factoryName)
                                      : [...current, factoryName]
                                  );
                                }}
                                className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary accent-primary focus:ring-primary/30"
                              />
                              <span>{factoryName}</span>
                            </div>
                            <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-outline">
                              {count} {isJa ? "台" : "m"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View Mode Switcher: Today (Default), Standard (Timeline), Compact */}
            <div className="flex items-center rounded-xl border border-outline-variant/30 bg-surface-container p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("today")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "today"
                    ? "bg-surface text-primary shadow-sm ring-1 ring-primary/25"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>today</span>
                <span>{isJa ? "今日の点検状況" : "Today"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("standard")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "standard"
                    ? "bg-surface text-primary shadow-sm ring-1 ring-primary/25"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>calendar_view_month</span>
                <span>{isJa ? "全期間" : "Timeline"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("compact")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "compact"
                    ? "bg-surface text-primary shadow-sm ring-1 ring-primary/25"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>density_medium</span>
                <span>{isJa ? "コンパクト" : "Compact"}</span>
              </button>
            </div>

            {/* Jump to Today */}
            <button
              type="button"
              onClick={viewMode === "today" ? () => {} : jumpToToday}
              title={isJa ? "今日の状況へ移動" : "Go to today"}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                viewMode === "today"
                  ? "bg-primary/10 text-primary border-primary/40 font-bold"
                  : "bg-surface-container text-on-surface hover:border-primary/40 hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>my_location</span>
              <span>{isJa ? "今日" : "Today"}</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={exportToCSV}
              title={isJa ? "選択期間の点検記録をCSV出力" : "Export submission records to CSV"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/40 hover:bg-surface-container-high transition active:scale-95"
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>download</span>
              <span>{isJa ? "CSV" : "Export"}</span>
            </button>
          </div>
        </div>

        {/* TODAY VIEW (DEFAULT) */}
        {viewMode === "today" ? (
          <div className="p-6">
            {/* Today Overview Header Sub-bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-separator/40 bg-surface-container/30 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 24 }}>event_available</span>
                </span>
                <div>
                  <h4 className="text-base font-bold text-on-surface">
                    {today.toLocaleDateString(isJa ? "ja-JP" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
                  </h4>
                  <p className="text-xs text-outline">
                    {isJa ? `対象設備: ${filteredMachines.length}台の点検状況` : `Monitoring ${filteredMachines.length} machines today`}
                  </p>
                </div>
              </div>

              {/* Status summary badges */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                  <span>{isJa ? `点検完了: ${todayOverview?.summary?.completedCount ?? (filteredMachines.filter(m => {
                    const entries = getScheduleEntries(m, today, visibleTemplates, recordsByFormId, { equipmentMap });
                    const subs = entries.flatMap(e => e.submissions || []);
                    return subs.length > 0 && !subs.some(s => s.record?.hasNG);
                  }).length)}台` : `Completed: ${todayOverview?.summary?.completedCount ?? 0}`}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 font-bold text-rose-700 dark:text-rose-300">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                  <span>{isJa ? `NG・要対応: ${todayOverview?.summary?.defectCount ?? (filteredMachines.filter(m => {
                    const entries = getScheduleEntries(m, today, visibleTemplates, recordsByFormId, { equipmentMap });
                    return entries.flatMap(e => e.submissions || []).some(s => s.record?.hasNG);
                  }).length)}台` : `Defects: ${todayOverview?.summary?.defectCount ?? 0}`}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 font-bold text-amber-700 dark:text-amber-300">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                  <span>{isJa ? `未提出 (実施待ち): ${todayOverview?.summary?.pendingCount ?? (filteredMachines.filter(m => {
                    const entries = getScheduleEntries(m, today, visibleTemplates, recordsByFormId, { equipmentMap });
                    return entries.flatMap(e => e.submissions || []).length === 0;
                  }).length)}台` : `Pending: ${todayOverview?.summary?.pendingCount ?? 0}`}</span>
                </div>
              </div>
            </div>

            {/* Today Machine Cards Grid */}
            {loading || loadingToday ? (
              <div className="flex items-center justify-center gap-3 py-24 text-outline">
                <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                <span className="text-sm font-semibold">{isJa ? "本日の点検状況を読み込み中…" : "Loading today's inspection status…"}</span>
              </div>
            ) : filteredMachines.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-outline border border-dashed border-outline-variant/30 rounded-2xl">
                <span className="material-symbols-outlined" style={{ fontSize: 40 }}>precision_manufacturing</span>
                <p className="text-sm font-semibold">{isJa ? "フィルターに一致する設備はありません。" : "No machines match the current filter."}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredMachines.map((machine) => (
                  <TodayMachineCard
                    key={machine.id}
                    machine={machine}
                    templates={visibleTemplates}
                    recordsByFormId={recordsByFormId}
                    equipmentMap={equipmentMap}
                    onSelectRecord={setSelectedCell}
                    onExportMachine={setExportingMachine}
                    onOpenQuickPeek={handleOpenQuickPeek}
                    language={language}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* STANDARD / COMPACT AUDIT TIMELINE TABLE VIEW */
          <>

        {/* Sub-bar: Legend & Cadence Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator/40 bg-surface-container/30 px-6 py-3">
          {/* Inline Timeline Cell Status Indicators matching actual pills */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Completed */}
            <div className="inline-flex items-center gap-1.5">
              <span className="inline-flex min-w-[32px] items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                D 1
              </span>
              <span className="font-medium text-outline">{isJa ? "完了" : "Completed"}</span>
            </div>

            {/* Completed with NG */}
            <div className="inline-flex items-center gap-1.5">
              <span className="relative inline-flex min-w-[32px] items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                D 1
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-error ring-1 ring-surface" />
              </span>
              <span className="font-medium text-outline">{isJa ? "完了 (NGあり)" : "Completed w/ NG"}</span>
            </div>

            {/* Missed */}
            <div className="inline-flex items-center gap-1.5">
              <span className="inline-flex min-w-[32px] items-center justify-center rounded-md border border-error/30 bg-error/12 px-1.5 py-0.5 text-[9px] font-bold text-error">
                D 1
              </span>
              <span className="font-medium text-outline">{isJa ? "未実施" : "Missed"}</span>
            </div>

            {/* Due */}
            <div className="inline-flex items-center gap-1.5">
              <span className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container px-1.5 py-0.5 text-[9px] font-medium text-outline">
                D
              </span>
              <span className="font-medium text-outline">{isJa ? "未到来" : "Due"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_ORDER.map((schedule) => {
              const meta = SCHEDULE_META[schedule];
              const label = isJa ? (schedule === "daily" ? "日次" : schedule === "weekly" ? "週次" : schedule === "monthly" ? "月次" : meta.label) : meta.label;
              return (
                <ScheduleFilterButton
                  key={schedule}
                  active={activeSchedules.includes(schedule)}
                  icon={meta.icon}
                  label={label}
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
                      className={`sticky left-0 z-10 border-b border-r border-outline-variant/20 px-3 ${viewMode === "compact" ? "py-1.5" : "py-2"} ${index % 2 === 0 ? "bg-surface" : "bg-surface-container"}`}
                      style={{ width: MACHINE_COLUMN_WIDTH, minWidth: MACHINE_COLUMN_WIDTH, maxWidth: MACHINE_COLUMN_WIDTH }}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-on-surface" title={machine.name}>{machine.name}</p>
                          {machine.factory && machine.factory !== "—" && (
                            <p className="truncate text-[10px] text-outline">{machine.factory}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExportingMachine(machine);
                          }}
                          title={isJa ? `${machine.name} の点検表を出力 (PDF / CSV)` : `Export checklist for ${machine.name}`}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container text-outline hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>file_export</span>
                        </button>
                      </div>
                    </td>
                    <td
                      className={`sticky z-10 border-b border-r border-outline-variant/20 px-3 ${viewMode === "compact" ? "py-1" : "py-2"} ${viewMode === "compact" ? "align-middle" : "align-top"} ${index % 2 === 0 ? "bg-surface" : "bg-surface-container"}`}
                      style={{ left: MACHINE_COLUMN_WIDTH, width: CADENCE_COLUMN_WIDTH, minWidth: CADENCE_COLUMN_WIDTH, maxWidth: CADENCE_COLUMN_WIDTH }}
                    >
                      <ScheduleLaneLegendCell schedules={activeSchedules} compact={viewMode === "compact"} />
                    </td>
                    {dates.map((date) => {
                      const isToday = date.getTime() === today.getTime();
                      const entries = getScheduleEntries(machine, date, visibleTemplates, recordsByFormId, {
                        equipmentMap,
                        focusRecordKeys: focusedRecordKeys,
                        focusRecordMode: timelineFocusActive,
                      })
                        .filter((entry) => activeSchedules.includes(entry.schedule));
                      return (
                        <td
                          key={date.toISOString()}
                          className={`border-b border-r border-outline-variant/10 px-1 ${viewMode === "compact" ? "py-1" : "py-1.5"} ${viewMode === "compact" ? "align-middle" : "align-top"} ${isToday ? "bg-primary/5" : ""}`}
                        >
                          <ScheduleStackCell
                            entries={entries}
                            compact={viewMode === "compact"}
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
        </>
        )}
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
          templatesById={templatesById}
          defaultTab={selectedCell.defaultTab ?? "submission"}
          initialTicketFocusHint={selectedCell.initialTicketFocusHint ?? null}
          onBack={selectedCell.returnToPicker ? () => setSelectedCell(selectedCell.returnToPicker) : null}
          onOpenQuickPeek={handleOpenQuickPeek}
          onClose={() => setSelectedCell(null)}
        />,
        document.body
      )}

      {peekState && createPortal(
        <TemplateQuickPeekModal
          template={peekState.template}
          templateId={peekState.templateId}
          activeFieldId={peekState.activeFieldId}
          isOptional={peekState.isOptional}
          onClose={() => setPeekState(null)}
        />,
        document.body
      )}

      {exportingMachine && (
        <MachineExportModal
          machine={exportingMachine}
          templates={templates}
          records={records}
          currentDates={dates}
          currentDateRange={dateRange}
          equipmentMap={equipmentMap}
          onClose={() => setExportingMachine(null)}
        />
      )}
    </section>
  );
}