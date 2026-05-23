import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCheckFormTemplates, fetchFactoryDBRecords } from "../services/api";
import CheckFormBuilderModal from "../components/CheckFormBuilderModal";
import CheckFormPreviewModal from "../components/CheckFormPreviewModal";
import CheckFormSimulatorModal from "../components/CheckFormSimulatorModal";

const STATUS_STYLES = {
  active:   "bg-primary/10 text-primary",
  draft:    "bg-outline/10 text-outline",
  archived: "bg-surface-container text-outline",
};

const SCHEDULE_META = {
  daily: {
    label: "Daily",
    description: "Checks operators complete every day.",
    icon: "today",
  },
  weekly: {
    label: "Weekly",
    description: "Checks planned once each week.",
    icon: "date_range",
  },
  monthly: {
    label: "Monthly",
    description: "Checks completed on the first day of the month.",
    icon: "calendar_month",
  },
};

const SCHEDULE_ORDER = ["daily", "weekly", "monthly"];

function getScheduleMeta(schedule) {
  return SCHEDULE_META[schedule] ?? {
    label: schedule || "Unscheduled",
    description: "No schedule has been assigned yet.",
    icon: "event_busy",
  };
}

function FormCard({ form, onPreview, onEdit, onSimulate }) {
  const scheduleMeta = getScheduleMeta(form.schedule);
  const equipmentCount = Array.isArray(form.equipmentIds)
    ? form.equipmentIds.length
    : form.equipmentId
      ? 1
      : 0;

  return (
    <div className="glass-card overflow-hidden rounded-2xl transition hover:border-primary/25 hover:shadow-md">
      <div className="px-5 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{scheduleMeta.icon}</span>
                {scheduleMeta.label}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}>
                {form.status}
              </span>
            </div>
            <h5 className="text-sm font-bold leading-tight text-on-surface">{form.name}</h5>
          </div>
        </div>
        {form.description && (
          <p className="mb-3 text-xs leading-5 text-outline">{form.description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-outline">
          {form.工場 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>factory</span>
              {form.工場}
            </span>
          )}
          {equipmentCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>precision_manufacturing</span>
              {equipmentCount} machine{equipmentCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>list</span>
            {form.fields?.length ?? 0} fields
          </span>
        </div>
      </div>
      <div className="flex border-t border-outline-variant/20">
        <button
          type="button"
          onClick={onPreview}
          className="flex-1 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
          Preview
        </button>
        <div className="w-px bg-outline-variant/20" />
        {form.status === "active" && (
          <>
            <button
              type="button"
              onClick={onSimulate}
              className="flex-1 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container-high transition flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>tablet</span>
              Try Form
            </button>
            <div className="w-px bg-outline-variant/20" />
          </>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container-high transition flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
          Edit
        </button>
      </div>
    </div>
  );
}

const GROUPS = [
  { key: "active",   label: "Active",   labelClass: "text-primary" },
  { key: "draft",    label: "Drafts",   labelClass: "text-outline" },
  { key: "archived", label: "Archived", labelClass: "text-outline" },
];

export default function MaintenancePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderPresetSchedule, setBuilderPresetSchedule] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [simulateTarget, setSimulateTarget] = useState(null);
  const [factories, setFactories] = useState([]);
  const [factoryFilter, setFactoryFilter] = useState("");
  const [activeSchedule, setActiveSchedule] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCheckFormTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetchFactoryDBRecords().then((data) => setFactories(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  function openBuilder(form = null, presetSchedule = "") {
    setEditTarget(form);
    setBuilderPresetSchedule(form?.schedule ?? presetSchedule);
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditTarget(null);
    setBuilderPresetSchedule("");
  }

  const visibleTemplates = factoryFilter
    ? templates.filter((t) => t.工場 === factoryFilter)
    : templates;

  useEffect(() => {
    if (activeSchedule) return;
    const firstScheduleWithForms = SCHEDULE_ORDER.find((schedule) =>
      visibleTemplates.some((template) => template.schedule === schedule)
    );
    setActiveSchedule(firstScheduleWithForms ?? "daily");
  }, [visibleTemplates, activeSchedule]);

  const selectedSchedule = activeSchedule || "daily";
  const selectedScheduleMeta = getScheduleMeta(selectedSchedule);
  const selectedTemplates = visibleTemplates.filter((t) => t.schedule === selectedSchedule);

  const scheduleCards = SCHEDULE_ORDER.map((schedule) => ({
    key: schedule,
    ...getScheduleMeta(schedule),
    count: visibleTemplates.filter((template) => template.schedule === schedule).length,
  }));

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: selectedTemplates.filter((t) => t.status === g.key),
  }));

  return (
    <div className="px-6 pb-6 pt-24 md:px-8">
      <section>
        <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">メンテナンス</p>
            <h3 className="mt-1 text-2xl font-black text-on-surface">Maintenance Forms</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm font-bold text-on-surface outline-none transition hover:bg-surface-container-high"
            >
              <option value="">All Factories</option>
              {factories.map((f) => (
                <option key={f._id ?? f.工場} value={f.工場}>{f.工場}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => navigate("/maintenance/submissions")}
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_chart</span>
              View Inspection History
            </button>
            <button
              type="button"
              onClick={() => openBuilder(null, selectedSchedule)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              New {selectedScheduleMeta.label} Form
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          {scheduleCards.map((schedule) => {
            const isActive = selectedSchedule === schedule.key;
            return (
              <button
                key={schedule.key}
                type="button"
                onClick={() => setActiveSchedule(schedule.key)}
                className={`glass-card rounded-2xl p-4 text-left transition ${
                  isActive
                    ? "border-primary/35 bg-primary/10 shadow-sm"
                    : "hover:border-primary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${isActive ? "bg-primary text-on-primary" : "bg-surface-container-high text-primary"}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{schedule.icon}</span>
                    </span>
                    <div>
                      <p className="text-sm font-black text-on-surface">{schedule.label}</p>
                      <p className="mt-1 text-xs leading-5 text-outline">{schedule.description}</p>
                    </div>
                  </div>
                  <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold ${isActive ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                    {schedule.count}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-bold">
                  <span className={isActive ? "text-primary" : "text-outline"}>
                    {schedule.count === 0 ? "No forms yet" : `${schedule.count} form${schedule.count === 1 ? "" : "s"}`}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${isActive ? "text-primary" : "text-on-surface"}`}>
                    {isActive ? "Selected" : "Open"}
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="glass-card mb-6 rounded-2xl p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Selected Cadence</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{selectedScheduleMeta.icon}</span>
                <h4 className="text-lg font-black text-on-surface">{selectedScheduleMeta.label} Forms</h4>
              </div>
              <p className="mt-1 text-sm leading-6 text-outline">
                {selectedScheduleMeta.description} Create a form here when you want the builder to start with this cadence already selected.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Choose schedule", "Pick factory", "Add checks", "Deploy"].map((step, index) => (
                <span
                  key={step}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-bold text-on-surface"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary">
                    {index + 1}
                  </span>
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-12 text-outline">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Loading...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>
        )}

        {!loading && !error && visibleTemplates.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>checklist</span>
            <p className="text-sm">No forms found in this view yet. Create your first maintenance form to get started.</p>
            <button
              type="button"
              onClick={() => openBuilder(null, selectedSchedule)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Create {selectedScheduleMeta.label} Form
            </button>
          </div>
        )}

        {!loading && !error && visibleTemplates.length > 0 && selectedTemplates.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container/50 px-6 py-14 text-center text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>{selectedScheduleMeta.icon}</span>
            <div>
              <p className="text-sm font-bold text-on-surface">No {selectedScheduleMeta.label.toLowerCase()} forms in this view</p>
              <p className="mt-1 text-sm leading-6 text-outline">
                Create the first {selectedScheduleMeta.label.toLowerCase()} form, or switch to another cadence above.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openBuilder(null, selectedSchedule)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Create {selectedScheduleMeta.label} Form
            </button>
          </div>
        )}

        {!loading && !error && selectedTemplates.length > 0 && grouped.map(({ key, label, labelClass, items }) =>
          items.length > 0 ? (
            <div key={key} className="mb-8">
              <h4 className={`mb-3 text-xs font-bold uppercase tracking-[0.18em] ${labelClass}`}>{label}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((form) => (
                  <FormCard
                    key={form._id}
                    form={form}
                    onPreview={() => setPreviewTarget(form)}
                    onEdit={() => openBuilder(form)}
                    onSimulate={() => setSimulateTarget(form)}
                  />
                ))}
              </div>
            </div>
          ) : null
        )}
      </section>

      {builderOpen && (
        <CheckFormBuilderModal
          initial={editTarget}
          presetSchedule={builderPresetSchedule}
          onClose={closeBuilder}
          onSaved={() => { closeBuilder(); load(); }}
        />
      )}

      {previewTarget && (
        <CheckFormPreviewModal
          form={previewTarget}
          onClose={() => setPreviewTarget(null)}
        />
      )}

      {simulateTarget && (
        <CheckFormSimulatorModal
          form={simulateTarget}
          onClose={() => setSimulateTarget(null)}
        />
      )}
    </div>
  );
}
