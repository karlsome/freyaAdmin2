import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchCheckFormTemplates, fetchCheckFormRecords, fetchSetsubiDBRecords } from "../services/api";

function normalizeId(id) {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return String(id);
}

function getDates(days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const halfBefore = Math.floor(days / 2);
  const dates = [];

  for (let i = -halfBefore; i < days - halfBefore; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  return dates;
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

function isSameCalendarDay(value, date) {
  const parsed = toDayStart(value);
  return parsed ? parsed.getTime() === date.getTime() : false;
}

function getMachineScopedRecords(formId, machine, recordsByFormId) {
  return (recordsByFormId.get(formId) ?? []).filter((record) => {
    const recordMachineId = normalizeId(record.machineId);
    if (recordMachineId) return recordMachineId === machine.id;
    return normalizeMachineName(record.machineName) === normalizeMachineName(machine.name);
  });
}

function getScheduleEntries(machine, date, forms, recordsByFormId) {
  const machineForms = forms.filter((form) =>
    (form.equipmentIds ?? []).some((id) => normalizeId(id) === machine.id)
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
    let dueCount = 0;
    let missedCount = 0;

    for (const form of formsForSchedule) {
      const machineRecords = getMachineScopedRecords(normalizeId(form._id), machine, recordsByFormId);
      const exactRecords = machineRecords
        .filter((record) => isSameCalendarDay(record.completedAt, date))
        .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());

      if (exactRecords.length > 0) {
        submissions.push(...exactRecords.map((record) => ({ form, record })));
        continue;
      }

      if (!isPeriodAnchor(date, schedule)) continue;
      if (machineRecords.some((record) => recordInPeriod(record, date, schedule))) continue;

      if (isCurrentPeriod(date, schedule)) {
        dueCount += 1;
      } else if (periodEnded(date, schedule)) {
        missedCount += 1;
      }
    }

    const submittedCount = submissions.length;
    const openCount = dueCount + missedCount;
    const state = submittedCount > 0 && openCount > 0
      ? "partial"
      : submittedCount > 0
        ? "complete"
        : missedCount > 0
          ? "missed"
          : dueCount > 0
            ? "due"
            : "none";

    const title = submittedCount > 0 && openCount > 0
      ? `${SCHEDULE_META[schedule].label}: ${submittedCount} submitted, ${openCount} still pending`
      : submittedCount > 0
        ? `${SCHEDULE_META[schedule].label}: ${submittedCount} submitted`
        : missedCount > 0
          ? `${SCHEDULE_META[schedule].label}: ${missedCount} missed`
          : dueCount > 0
            ? `${SCHEDULE_META[schedule].label}: ${dueCount} due`
            : `${SCHEDULE_META[schedule].label}: no activity this day`;

    return {
      schedule,
      state,
      hasForms: true,
      hasNG: submissions.some((entry) => entry.record.hasNG),
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
  if (entry.state === "due" || entry.state === "missed") return String(entry.openCount);
  return entry.hasForms ? "-" : "";
}

function ScheduleStackCell({ entries, onSelect }) {
  return (
    <div className="mx-auto flex w-14 flex-col gap-1">
      {entries.map((entry) => {
        const interactive = Boolean(entry.primary);
        const countLabel = getEntryCountLabel(entry);
        const content = (
          <div
            className={`relative flex min-h-[1.45rem] items-center justify-between rounded-md border px-1.5 py-1 ${SLOT_STYLES[entry.state]}`}
            title={entry.title}
          >
            <span className="text-[9px] font-black tracking-[0.16em]">{SCHEDULE_META[entry.schedule].short}</span>
            <span className="text-[9px] font-black">{countLabel}</span>
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
            onClick={() => onSelect(entry.primary)}
            className="text-left transition hover:scale-[1.03]"
            title={`${entry.title}. Click to open the submitted record.`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function RecordDetailModal({ form, onClose, record }) {
  const recordAnswers = Array.isArray(record?.answers)
    ? record.answers.filter((field) => field.type !== "name")
    : [];
  const fields = recordAnswers.length > 0
    ? recordAnswers
    : (form?.fields ?? []).filter((field) => field.type !== "name");
  const responses = record?.responses ?? {};
  const formName = form?.name ?? record?.formName ?? "Checklist Submission";
  const recordFactory = form?.工場 ?? record?.factory ?? "";
  const recordSchedule = record?.schedule ?? form?.schedule ?? "";

  function formatValue(field) {
    if (field.fieldId) {
      const answerStatus = String(field.status ?? field.value ?? "").trim().toLowerCase();
      if (field.type === "checkbox") {
        if (answerStatus === "ok") return "✓  OK";
        if (answerStatus === "ng") return "✗  NG";
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
    if (field.type === "checkbox") {
      if (value === "ok") return "✓  OK";
      if (value === "ng") return "✗  NG";
      return "—";
    }
    if (value === null || value === undefined || value === "") return "—";
    if (field.type === "number" && field.unit) return `${value} ${field.unit}`;
    return String(value);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="glass-card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-outline-variant/20">
        <div className="flex flex-shrink-0 items-start justify-between border-b border-outline-variant/20 px-6 py-5">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">Inspection Record</p>
            <h3 className="mt-0.5 truncate text-lg font-black text-on-surface">{formName}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-outline">
              {recordFactory && <span>{recordFactory}</span>}
              {recordSchedule && <span className="capitalize">{recordSchedule}</span>}
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

        <div className="flex flex-shrink-0 flex-wrap gap-4 border-b border-outline-variant/20 px-6 py-4">
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
            <span className="rounded-full bg-outline/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-outline">Simulator</span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
          {fields.length === 0 && <p className="text-sm text-outline">No fields recorded.</p>}
          {fields.map((field) => {
            const fieldId = field.fieldId ?? field.id;
            const photo = field.fieldPhotoURL || responses[`${fieldId}_photo`];
            const value = formatValue(field);
            const fieldStatus = field.fieldId
              ? String(field.status ?? field.value ?? "").trim().toLowerCase()
              : responses[field.id];
            const isOk = field.type === "checkbox" && fieldStatus === "ok";
            const isNg = field.type === "checkbox" && fieldStatus === "ng";

            return (
              <div key={fieldId} className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{field.label || <span className="italic text-outline">Untitled</span>}</p>
                    {field.description && <p className="mt-0.5 text-xs text-outline">{field.description}</p>}
                  </div>
                  <span className={`flex-shrink-0 text-sm font-bold ${isOk ? "text-emerald-500" : isNg ? "text-error" : "text-on-surface"}`}>
                    {value}
                  </span>
                </div>
                {photo && (
                  <div className="mt-2">
                    <img src={photo} alt="添付画像" className="h-32 rounded-xl border border-outline-variant/20 object-cover" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const RANGES = [30, 60];

const SCHEDULE_META = {
  daily: { label: "Daily", short: "D", icon: "today" },
  weekly: { label: "Weekly", short: "W", icon: "date_range" },
  monthly: { label: "Monthly", short: "M", icon: "calendar_month" },
};

const SCHEDULE_ORDER = ["daily", "weekly", "monthly"];

const SLOT_STYLES = {
  complete: "border-emerald-500/20 bg-emerald-500/12 text-emerald-600",
  partial: "border-primary/25 bg-primary/10 text-primary",
  due: "border-amber-500/20 bg-amber-500/12 text-amber-700",
  missed: "border-error/20 bg-error/10 text-error",
  none: "border-outline-variant/15 bg-surface-container-high/35 text-outline/55",
};

function SummaryCard({ detail, icon, iconClassName, label, value }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">{label}</p>
          <p className="mt-3 text-3xl font-black text-on-surface">{value}</p>
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
    <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-bold text-on-surface">
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
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
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
  const { t } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [activeSchedules, setActiveSchedules] = useState(SCHEDULE_ORDER);
  const [selectedCell, setSelectedCell] = useState(null);
  const scrollRef = useRef(null);

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
    if (loading || !scrollRef.current) return;
    const machineColumnWidth = 160;
    const cellWidth = 64;
    const halfBefore = Math.floor(days / 2);
    const todayOffset = machineColumnWidth + halfBefore * cellWidth;
    const containerWidth = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = todayOffset - containerWidth / 2 + cellWidth / 2;
  }, [days, loading]);

  const equipmentMap = useMemo(() => {
    const map = new Map();
    for (const equipment of allEquipment) {
      map.set(normalizeId(equipment._id), { name: equipment.name, factory: equipment.工場 });
    }
    return map;
  }, [allEquipment]);

  const recordsByFormId = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      const list = map.get(record.formId) ?? [];
      list.push(record);
      map.set(record.formId, list);
    }
    return map;
  }, [records]);

  const machines = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const form of templates) {
      for (const rawId of form.equipmentIds ?? []) {
        const id = normalizeId(rawId);
        if (seen.has(id)) continue;
        seen.add(id);
        const info = equipmentMap.get(id);
        result.push({ id, name: info?.name ?? id, factory: info?.factory ?? "—" });
      }
    }
    return result.sort((left, right) => left.factory.localeCompare(right.factory, "ja") || left.name.localeCompare(right.name, "ja"));
  }, [equipmentMap, templates]);

  const factories = useMemo(() => {
    const factorySet = new Set(machines.map((machine) => machine.factory).filter(Boolean));
    return [...factorySet].sort();
  }, [machines]);

  const filteredMachines = useMemo(() => (
    factoryFilter === "all" ? machines : machines.filter((machine) => machine.factory === factoryFilter)
  ), [factoryFilter, machines]);

  const dates = useMemo(() => getDates(days), [days]);
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
    templates.reduce((accumulator, template) => {
      if (template.schedule && accumulator[template.schedule] !== undefined) {
        accumulator[template.schedule] += 1;
      }
      return accumulator;
    }, { daily: 0, weekly: 0, monthly: 0 })
  ), [templates]);

  const ngCount = useMemo(
    () => records.filter((record) => record.hasNG).length,
    [records]
  );

  const selectedFactoryLabel = factoryFilter === "all" ? "All factories" : factoryFilter;

  function toggleSchedule(schedule) {
    setActiveSchedules((current) => {
      if (current.includes(schedule)) {
        return current.length === 1 ? current : current.filter((value) => value !== schedule);
      }
      return SCHEDULE_ORDER.filter((value) => current.includes(value) || value === schedule);
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <section className="h-screen overflow-y-auto px-6 pb-16 pt-24 scrollbar-hide md:px-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">メンテナンス</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-on-surface">{t("checklistSubmissions")}</h2>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active Checklists"
          value={templates.length.toLocaleString()}
          detail={`${scheduleCounts.daily} daily • ${scheduleCounts.weekly} weekly • ${scheduleCounts.monthly} monthly`}
          icon="checklist"
          iconClassName="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="Tracked Machines"
          value={filteredMachines.length.toLocaleString()}
          detail={factoryFilter === "all" ? `${machines.length} machines in scope` : `${selectedFactoryLabel} only`}
          icon="precision_manufacturing"
          iconClassName="bg-tertiary/10 text-tertiary"
        />
        <SummaryCard
          label="Submitted Records"
          value={records.length.toLocaleString()}
          detail={`${days}-day review window centered on today`}
          icon="task_alt"
          iconClassName="bg-emerald-500/10 text-emerald-500"
        />
        <SummaryCard
          label="NG Findings"
          value={ngCount.toLocaleString()}
          detail={ngCount > 0 ? "Completed checks with NG markers" : "No NG markers in the loaded records"}
          icon="warning"
          iconClassName="bg-error/10 text-error"
        />
      </div>

      <div className="mb-6 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Filters</p>
          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-[220px]">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-outline">Factory</span>
                <select
                  value={factoryFilter}
                  onChange={(event) => setFactoryFilter(event.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm font-bold text-on-surface outline-none transition hover:bg-surface-container-high focus:border-primary/40"
                >
                  <option value="all">All factories</option>
                  {factories.map((factory) => (
                    <option key={factory} value={factory}>{factory}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-outline">Window</span>
                <div className="flex rounded-2xl border border-outline-variant/30 bg-surface-container p-1">
                  {RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setDays(range)}
                      className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${days === range ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}
                    >
                      {range}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-bold text-on-surface">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>factory</span>
                {selectedFactoryLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-bold text-on-surface">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>calendar_month</span>
                {days}-day window
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Status Guide</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LegendPill label="Completed" tone="bg-emerald-500" />
            <LegendPill label="Missed" tone="bg-error" />
            <LegendPill label="Due" tone="bg-amber-500" />
            <LegendPill label="Completed with NG" tone="bg-emerald-500" withNg />
          </div>
          <p className="mt-4 text-sm leading-6 text-outline">
            Turn Daily, Weekly, and Monthly on or off to focus the timeline. The active buttons control which cadence lanes appear inside each day cell.
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-outline-variant/20 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Timeline</p>
            <h3 className="mt-1 text-lg font-black text-on-surface">Checklist Submission Timeline</h3>
            <p className="mt-1 text-sm leading-6 text-outline">
              Review completed, due, and missed checks across {selectedFactoryLabel === "All factories" ? "all tracked factories" : selectedFactoryLabel}. Show one cadence or compare multiple at the same time.
            </p>
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
              <p className="text-sm">No machines found on active forms.</p>
            </div>
          )}

          {!loading && filteredMachines.length > 0 && (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 min-w-[160px] border-b border-r border-outline-variant/20 bg-surface px-4 py-2" />
                  {monthGroups.map(({ label, count }, index) => (
                    <th
                      key={`${label}-${index}`}
                      colSpan={count}
                      className="border-b border-r border-outline-variant/10 bg-surface px-0 py-1 text-center text-[10px] font-black uppercase tracking-widest text-outline"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-20 border-b border-r border-outline-variant/20 bg-surface px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.15em] text-outline">
                    Machine
                  </th>
                  {dates.map((date) => {
                    const isToday = date.getTime() === today.getTime();
                    return (
                      <th
                        key={date.toISOString()}
                        className={`w-16 border-b border-r border-outline-variant/10 px-1 py-2 text-center text-xs font-bold ${isToday ? "bg-primary/10 text-primary" : "bg-surface text-outline"}`}
                      >
                        <span className="block">{date.getDate()}</span>
                        <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.12em] opacity-70">
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
                    <td className={`sticky left-0 z-10 min-w-[160px] max-w-[220px] border-b border-r border-outline-variant/20 px-4 py-2 ${index % 2 === 0 ? "bg-surface" : "bg-surface-container"}`}>
                      <p className="truncate text-sm font-semibold text-on-surface">{machine.name}</p>
                      {machine.factory && machine.factory !== "—" && (
                        <p className="truncate text-[10px] text-outline">{machine.factory}</p>
                      )}
                    </td>
                    {dates.map((date) => {
                      const isToday = date.getTime() === today.getTime();
                      const entries = getScheduleEntries(machine, date, templates, recordsByFormId)
                        .filter((entry) => activeSchedules.includes(entry.schedule));
                      return (
                        <td
                          key={date.toISOString()}
                          className={`border-b border-r border-outline-variant/10 px-1 py-1.5 align-top ${isToday ? "bg-primary/5" : ""}`}
                        >
                          <ScheduleStackCell
                            entries={entries}
                            onSelect={(entry) => setSelectedCell(entry)}
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

      {selectedCell && createPortal(
        <RecordDetailModal
          record={selectedCell.record}
          form={selectedCell.form}
          onClose={() => setSelectedCell(null)}
        />,
        document.body
      )}
    </section>
  );
}