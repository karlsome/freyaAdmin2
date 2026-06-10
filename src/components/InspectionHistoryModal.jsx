import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchCheckFormTemplates, fetchSetsubiDBRecords, fetchCheckFormRecords } from "../services/api";

function normalizeId(id) {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return String(id);
}

function getDates(days) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const halfBefore = Math.floor(days / 2);
  const dates = [];
  for (let i = -halfBefore; i < days - halfBefore; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getWeekStart(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function recordInPeriod(record, date, schedule) {
  const rec = new Date(record.completedAt);
  if (schedule === "daily") return rec.toDateString() === date.toDateString();
  if (schedule === "weekly") return getWeekStart(rec).getTime() === getWeekStart(date).getTime();
  if (schedule === "monthly") return rec.getFullYear() === date.getFullYear() && rec.getMonth() === date.getMonth();
  return false;
}

function periodEnded(date, schedule) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (schedule === "daily") return date.getTime() < today.getTime();
  if (schedule === "weekly") {
    const nextWeek = getWeekStart(date); nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.getTime() <= today.getTime();
  }
  if (schedule === "monthly") {
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return nextMonth.getTime() <= today.getTime();
  }
  return false;
}

// Returns true only for the "anchor" day of a period — the single day that gets a marker.
// daily  → every day
// weekly → Monday only
// monthly → 1st of month only
function isPeriodAnchor(date, schedule) {
  if (schedule === "weekly") return (date.getDay() + 6) % 7 === 0;
  if (schedule === "monthly") return date.getDate() === 1;
  return true;
}

// True if `date` falls inside the period that contains today (i.e. currently open).
function isCurrentPeriod(date, schedule) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (schedule === "daily") return date.getTime() === today.getTime();
  if (schedule === "weekly") return getWeekStart(date).getTime() === getWeekStart(today).getTime();
  if (schedule === "monthly") return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  return false;
}

function getCellData(machineId, date, forms, recordsByFormId) {
  const machineForms = forms.filter(f =>
    (f.equipmentIds ?? []).some(id => normalizeId(id) === machineId)
  );
  if (machineForms.length === 0) return { status: "none", record: null, form: null };

  for (const form of machineForms) {
    const recs = recordsByFormId.get(normalizeId(form._id)) ?? [];

    // GREEN — exact calendar day the submission was made
    const exactRecord = recs.find(r => {
      const d = new Date(r.completedAt); d.setHours(0, 0, 0, 0);
      return d.getTime() === date.getTime();
    });
    if (exactRecord) return { status: "green", record: exactRecord, form, hasNG: exactRecord.hasNG ?? false };

    // Only anchor days carry a red/orange marker — keeps weekly/monthly clean
    if (!isPeriodAnchor(date, form.schedule)) continue;

    // Skip anchor days whose period already has a submission elsewhere
    if (recs.some(r => recordInPeriod(r, date, form.schedule))) continue;

    if (isCurrentPeriod(date, form.schedule)) {
      // ORANGE — current period, check not yet done
      return { status: "orange", record: null, form, hasNG: false };
    }
    if (periodEnded(date, form.schedule)) {
      // RED — past period, check was never done
      return { status: "red", record: null, form, hasNG: false };
    }
  }

  return { status: "none", record: null, form: null, hasNG: false };
}

function Cell({ status, onClick, hasNG }) {
  if (status === "green") return (
    <button
      type="button"
      onClick={onClick}
      className="relative mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 transition hover:bg-emerald-500/40 hover:scale-110 cursor-pointer"
    >
      <div className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
      {hasNG && (
        <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error ring-1 ring-surface" />
      )}
    </button>
  );
  if (status === "red") return (
    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-error/10">
      <div className="h-3.5 w-3.5 rounded-full bg-error" />
    </div>
  );
  if (status === "orange") return (
    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
      <div className="h-3.5 w-3.5 rounded-full bg-amber-500" />
    </div>
  );
  return <div className="mx-auto h-9 w-9 rounded-xl" />;
}

function RecordDetailModal({ record, form, onClose }) {
  const fields = (form?.fields ?? []).filter(f => f.type !== "name");
  const responses = record?.responses ?? {};

  function formatValue(field) {
    const val = responses[field.id];
    if (field.type === "toggle") {
      if (val === "ok") return "✓  OK";
      if (val === "ng") return "✗  NG";
      return "—";
    }
    if (val === null || val === undefined || val === "") return "—";
    if (field.type === "number" && field.unit) return `${val} ${field.unit}`;
    return String(val);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl dashboard-section overflow-hidden">

        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-separator/35 px-6 py-5">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">Inspection Record</p>
            <h3 className="mt-0.5 truncate text-lg font-semibold text-on-surface">{form?.name}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-outline">
              {form?.工場 && <span>{form.工場}</span>}
              {form?.schedule && <span className="capitalize">{form.schedule}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-shrink-0 flex-wrap gap-4 border-b border-separator/30 px-6 py-4">
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
        </div>

        {/* Field responses */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
          {fields.length === 0 && <p className="text-sm text-outline">No fields recorded.</p>}
          {fields.map(field => {
            const photo = responses[`${field.id}_photo`];
            const value = formatValue(field);
            const isOK = field.type === "toggle" && responses[field.id] === "ok";
            const isNG = field.type === "toggle" && responses[field.id] === "ng";
            return (
              <div key={field.id} className="rounded-2xl border border-separator/40 bg-surface-container px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-on-surface truncate">{field.label || <span className="italic text-outline">Untitled</span>}</p>
                    {field.description && <p className="mt-0.5 text-xs text-outline">{field.description}</p>}
                  </div>
                  <span className={`flex-shrink-0 text-sm font-semibold ${isOK ? "text-emerald-500" : isNG ? "text-error" : "text-on-surface"}`}>
                    {value}
                  </span>
                </div>
                {photo && (
                  <div className="mt-2">
                    <img src={photo} alt="添付画像" className="h-32 rounded-xl object-cover border border-separator/40" />
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

export default function InspectionHistoryModal({ onClose }) {
  const [templates, setTemplates] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [selectedCell, setSelectedCell] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tmpl, equip] = await Promise.all([
          fetchCheckFormTemplates(),
          fetchSetsubiDBRecords(),
        ]);
        const active = (Array.isArray(tmpl) ? tmpl : []).filter(f => f.status === "active");
        setTemplates(active);
        setAllEquipment(Array.isArray(equip) ? equip : []);
        const formIds = active.map(f => normalizeId(f._id));
        const recs = formIds.length ? await fetchCheckFormRecords(formIds) : [];
        setRecords(Array.isArray(recs) ? recs : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Scroll today's column to the centre of the viewport after data loads
  useEffect(() => {
    if (loading || !scrollRef.current) return;
    const MACHINE_COL_W = 160;
    const CELL_W = 44; // w-11
    const halfBefore = Math.floor(days / 2);
    const todayOffset = MACHINE_COL_W + halfBefore * CELL_W;
    const containerW = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = todayOffset - containerW / 2 + CELL_W / 2;
  }, [loading, days]);

  const equipmentMap = useMemo(() => {
    const m = new Map();
    for (const e of allEquipment) m.set(normalizeId(e._id), { name: e.name, factory: e.工場 });
    return m;
  }, [allEquipment]);

  const recordsByFormId = useMemo(() => {
    const m = new Map();
    for (const r of records) {
      const list = m.get(r.formId) ?? [];
      list.push(r);
      m.set(r.formId, list);
    }
    return m;
  }, [records]);

  const machines = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const form of templates) {
      for (const rawId of (form.equipmentIds ?? [])) {
        const id = normalizeId(rawId);
        if (!seen.has(id)) {
          seen.add(id);
          const info = equipmentMap.get(id);
          result.push({ id, name: info?.name ?? id, factory: info?.factory ?? "—" });
        }
      }
    }
    return result.sort((a, b) => a.factory.localeCompare(b.factory, "ja") || a.name.localeCompare(b.name, "ja"));
  }, [templates, equipmentMap]);

  const factories = useMemo(() => {
    const set = new Set(machines.map(m => m.factory).filter(Boolean));
    return [...Array.from(set).sort()];
  }, [machines]);

  const filteredMachines = useMemo(() =>
    factoryFilter === "all" ? machines : machines.filter(m => m.factory === factoryFilter),
    [machines, factoryFilter]
  );

  const dates = useMemo(() => getDates(days), [days]);

  const monthGroups = useMemo(() => {
    const groups = [];
    for (const d of dates) {
      const label = d.toLocaleDateString("en", { month: "short" });
      if (!groups.length || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 });
      } else {
        groups[groups.length - 1].count++;
      }
    }
    return groups;
  }, [dates]);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const modal = (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-separator/35 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">メンテナンス</p>
          <h2 className="mt-0.5 text-xl font-semibold text-on-surface">Inspection History</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden items-center gap-4 text-xs text-outline sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-error" />Missed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />Due
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative h-3 w-3 flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-emerald-500" />
                <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-error ring-1 ring-surface" />
              </span>
              NG
            </span>
          </div>
          {/* Factory filter */}
          {factories.length > 1 && (
            <select
              value={factoryFilter}
              onChange={e => setFactoryFilter(e.target.value)}
              className="rounded-2xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40"
            >
              <option value="all">All factories</option>
              {factories.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          {/* Day range */}
          <div className="flex rounded-2xl border border-outline-variant/30 overflow-hidden">
            {RANGES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className={`px-3 py-2 text-xs font-semibold transition ${
                  days === r
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-outline hover:bg-surface-container"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
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
          <table className="border-separate border-spacing-0 min-w-full">
            <thead>
              {/* Month row */}
              <tr>
                <th className="sticky left-0 z-20 min-w-[160px] border-b border-r border-outline-variant/20 bg-surface px-4 py-2" />
                {monthGroups.map(({ label, count }, i) => (
                  <th
                    key={`${label}-${i}`}
                    colSpan={count}
                    className="border-b border-r border-outline-variant/10 bg-surface px-0 py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-outline"
                  >
                    {label}
                  </th>
                ))}
              </tr>
              {/* Day row */}
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-outline-variant/20 bg-surface px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.15em] text-outline">
                  Machine
                </th>
                {dates.map(date => {
                  const isToday = date.getTime() === today.getTime();
                  return (
                    <th
                      key={date.toISOString()}
                      className={`w-11 border-b border-r border-outline-variant/10 px-1 py-2 text-center text-xs font-semibold ${
                        isToday ? "bg-primary/10 text-primary" : "bg-surface text-outline"
                      }`}
                    >
                      {date.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredMachines.map((machine, mIdx) => (
                <tr key={machine.id} className={mIdx % 2 === 0 ? "bg-surface" : "bg-surface-container/30"}>
                  {/* Machine name cell — must be fully opaque so scrolling date cells don't bleed through */}
                  <td className={`sticky left-0 z-10 min-w-[160px] max-w-[220px] border-b border-r border-outline-variant/20 px-4 py-2 ${
                    mIdx % 2 === 0 ? "bg-surface" : "bg-surface-container"
                  }`}>
                    <p className="truncate text-sm font-semibold text-on-surface">{machine.name}</p>
                    {machine.factory && machine.factory !== "—" && (
                      <p className="truncate text-[10px] text-outline">{machine.factory}</p>
                    )}
                  </td>
                  {/* Date cells */}
                  {dates.map(date => {
                    const isToday = date.getTime() === today.getTime();
                    const { status, record, form, hasNG } = getCellData(machine.id, date, templates, recordsByFormId);
                    return (
                      <td
                        key={date.toISOString()}
                        className={`border-b border-r border-outline-variant/10 p-1 ${isToday ? "bg-primary/5" : ""}`}
                      >
                        <Cell
                          status={status}
                          hasNG={hasNG}
                          onClick={status === "green" ? () => setSelectedCell({ record, form }) : undefined}
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
  );

  return (
    <>
      {createPortal(modal, document.body)}
      {selectedCell && createPortal(
        <RecordDetailModal
          record={selectedCell.record}
          form={selectedCell.form}
          onClose={() => setSelectedCell(null)}
        />,
        document.body
      )}
    </>
  );
}
