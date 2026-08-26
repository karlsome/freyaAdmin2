import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCheckFormTemplates, fetchFactoryDBRecords, fetchSetsubiDBRecords } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import CheckFormBuilderModal from "../components/CheckFormBuilderModal";
import CheckFormDetailModal from "../components/CheckFormDetailModal";
import PageHeader from "../components/PageHeader";

const STATUS_STYLES = {
  active:   "bg-primary/10 text-primary",
  draft:    "bg-outline/10 text-outline",
  archived: "bg-surface-container text-outline",
};

const SCHEDULE_META = {
  daily: {
    label_en: "Daily",
    label_ja: "日次",
    description_en: "Checks operators complete every day.",
    description_ja: "作業者が毎日実施する点検です。",
    icon: "today",
  },
  weekly: {
    label_en: "Weekly",
    label_ja: "週次",
    description_en: "Checks planned once each week.",
    description_ja: "毎週1回実施される点検です。",
    icon: "date_range",
  },
  monthly: {
    label_en: "Monthly",
    label_ja: "月次",
    description_en: "Checks completed on the first day of the month.",
    description_ja: "毎月月初に実施される点検です。",
    icon: "calendar_month",
  },
};

const SCHEDULE_ORDER = ["daily", "weekly", "monthly"];

function getScheduleMeta(schedule, language = "en") {
  const isJa = language === "ja";
  const meta = SCHEDULE_META[schedule];
  if (!meta) {
    return {
      label: schedule || (isJa ? "未スケジュール" : "Unscheduled"),
      description: isJa ? "スケジュールがまだ設定されていません。" : "No schedule has been assigned yet.",
      icon: "event_busy",
    };
  }
  return {
    label: isJa ? (meta.label_ja || meta.label_en) : (meta.label_en || meta.label_ja),
    description: isJa ? (meta.description_ja || meta.description_en) : (meta.description_en || meta.description_ja),
    icon: meta.icon,
  };
}

function normalizeId(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.$oid ?? value._id?.$oid ?? value._id ?? "").trim();
  }
  return String(value).trim();
}

function getFormEquipmentIds(form) {
  if (Array.isArray(form?.equipmentIds)) return form.equipmentIds;
  return form?.equipmentId ? [form.equipmentId] : [];
}

function getFormMachineNames(form, equipmentMap) {
  return getFormEquipmentIds(form)
    .map((equipmentId) => equipmentMap.get(normalizeId(equipmentId))?.name)
    .filter(Boolean);
}

function FormCard({ form, machineNames, onOpen, language }) {
  const isJa = language === "ja";
  const scheduleMeta = getScheduleMeta(form.schedule, language);
  const visibleMachineNames = machineNames.slice(0, 3);
  const remainingMachineCount = Math.max(machineNames.length - visibleMachineNames.length, 0);

  const formName = isJa
    ? (form.name_ja || form.name || form.name_en)
    : (form.name_en || form.name || form.name_ja);
  const formDescription = isJa
    ? (form.description_ja || form.description || form.description_en)
    : (form.description_en || form.description || form.description_ja);

  const statusLabel = isJa
    ? (form.status === "active" ? "アクティブ" : form.status === "draft" ? "下書き" : form.status === "archived" ? "アーカイブ" : form.status)
    : (form.status || "draft");

  const timing = form.timing || "pre";
  const timingLabel = isJa
    ? (timing === "post" ? "作業後点検" : "作業前点検")
    : (timing === "post" ? "Post-Production" : "Pre-Production");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-card group w-full overflow-hidden rounded-2xl text-left transition hover:border-primary/25 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-haspopup="dialog"
    >
      <div className="px-5 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{scheduleMeta.icon}</span>
                {scheduleMeta.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border ${
                timing === "post"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                  : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
              }`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                  {timing === "post" ? "task" : "play_circle"}
                </span>
                {timingLabel}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}>
                {statusLabel}
              </span>
            </div>
            <h5 className="text-sm font-semibold leading-tight text-on-surface">{formName}</h5>
          </div>
          <span className="material-symbols-outlined text-outline transition group-hover:text-primary" style={{ fontSize: 18 }}>arrow_outward</span>
        </div>
        {formDescription && (
          <p className="mb-3 text-xs leading-5 text-outline">{formDescription}</p>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          {visibleMachineNames.length > 0 ? (
            <>
              {visibleMachineNames.map((machineName) => (
                <span
                  key={machineName}
                  className="inline-flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface px-2.5 py-1 text-[11px] font-semibold text-on-surface"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 12 }}>precision_manufacturing</span>
                  {machineName}
                </span>
              ))}
              {remainingMachineCount > 0 && (
                <span className="inline-flex items-center rounded-full border border-outline-variant/20 bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-outline">
                  +{remainingMachineCount} {isJa ? "台 その他" : "more"}
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-outline-variant/20 bg-surface-container/70 px-2.5 py-1 text-[11px] font-semibold text-outline">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>precision_manufacturing</span>
              {isJa ? "設備が割り当てられていません" : "No machines assigned"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-outline">
          {form.工場 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>factory</span>
              {form.工場}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>list</span>
            {form.fields?.length ?? 0} {isJa ? "項目" : "fields"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-separator/40 px-5 py-3 text-xs font-semibold">
        <span className="text-outline">{isJa ? "カードをクリックして詳細を表示" : "Click card to view details"}</span>
        <span className="inline-flex items-center gap-1 text-primary">
          {isJa ? "開く" : "Open"}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
        </span>
      </div>
    </button>
  );
}

export default function MaintenancePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderPresetSchedule, setBuilderPresetSchedule] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
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
    fetchSetsubiDBRecords().then((data) => setAllEquipment(Array.isArray(data) ? data : [])).catch(() => {});
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
  const selectedScheduleMeta = getScheduleMeta(selectedSchedule, language);
  const selectedTemplates = visibleTemplates.filter((t) => t.schedule === selectedSchedule);
  const equipmentMap = new Map(allEquipment.map((equipment) => [normalizeId(equipment._id), equipment]));

  const scheduleCards = SCHEDULE_ORDER.map((schedule) => ({
    key: schedule,
    ...getScheduleMeta(schedule, language),
    count: visibleTemplates.filter((template) => template.schedule === schedule).length,
  }));

  const groups = [
    { key: "active",   label: isJa ? "アクティブ" : "Active",   labelClass: "text-primary" },
    { key: "draft",    label: isJa ? "下書き" : "Drafts",   labelClass: "text-outline" },
    { key: "archived", label: isJa ? "アーカイブ" : "Archived", labelClass: "text-outline" },
  ];

  const grouped = groups.map((g) => ({
    ...g,
    items: selectedTemplates.filter((t) => t.status === g.key),
  }));

  return (
    <section className="h-screen overflow-y-auto px-6 pb-16 pt-24 scrollbar-hide md:px-8">
      <section>
        <PageHeader
          eyebrow={isJa ? "メンテナンス" : "Maintenance"}
          title={isJa ? "点検フォーム管理" : "Maintenance Forms"}
          actionsClassName="gap-2"
          actions={(
            <>
              <select
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface outline-none transition hover:bg-surface-container-high"
              >
                <option value="">{isJa ? "すべての工場" : "All Factories"}</option>
                {factories.map((f) => (
                  <option key={f._id ?? f.工場} value={f.工場}>{f.工場}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => navigate("/maintenance/submissions")}
                className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_chart</span>
                {isJa ? "点検履歴を表示" : "View Inspection History"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/maintenance/submissions/tickets")}
                className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>confirmation_number</span>
                {isJa ? "提出チケット一覧を表示" : "View Submitted Tickets"}
              </button>
              <button
                type="button"
                onClick={() => openBuilder(null, selectedSchedule)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                {isJa ? `新規${selectedScheduleMeta.label}フォーム` : `New ${selectedScheduleMeta.label} Form`}
              </button>
            </>
          )}
        />

        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          {scheduleCards.map((schedule) => {
            const isActive = selectedSchedule === schedule.key;
            return (
              <button
                key={schedule.key}
                type="button"
                onClick={() => setActiveSchedule(schedule.key)}
                className={`glass-card rounded-2xl p-5 text-left transition ${
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
                      <p className="text-sm font-semibold text-on-surface">{schedule.label}</p>
                      <p className="mt-1 text-xs leading-5 text-outline">{schedule.description}</p>
                    </div>
                  </div>
                  <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${isActive ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                    {schedule.count}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                  <span className={isActive ? "text-primary" : "text-outline"}>
                    {schedule.count === 0
                      ? (isJa ? "フォームなし" : "No forms yet")
                      : (isJa ? `${schedule.count} 件のフォーム` : `${schedule.count} form${schedule.count === 1 ? "" : "s"}`)}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${isActive ? "text-primary" : "text-on-surface"}`}>
                    {isActive ? (isJa ? "選択中" : "Selected") : (isJa ? "開く" : "Open")}
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="dashboard-section mb-6 rounded-2xl p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                {isJa ? "選択中の周期" : "Selected Cadence"}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{selectedScheduleMeta.icon}</span>
                <h4 className="text-lg font-semibold text-on-surface">
                  {isJa ? `${selectedScheduleMeta.label}点検フォーム` : `${selectedScheduleMeta.label} Forms`}
                </h4>
              </div>
              <p className="mt-1 text-sm leading-6 text-outline">
                {isJa
                  ? `${selectedScheduleMeta.description} この周期があらかじめ選択された状態でフォームを作成します。`
                  : `${selectedScheduleMeta.description} Create a form here when you want the builder to start with this cadence already selected.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(isJa
                ? ["周期を選択", "工場を選択", "点検項目を追加", "公開"]
                : ["Choose schedule", "Pick factory", "Add checks", "Deploy"]
              ).map((step, index) => (
                <span
                  key={step}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface"
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
            {isJa ? "読み込み中..." : "Loading..."}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>
        )}

        {!loading && !error && visibleTemplates.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>checklist</span>
            <p className="text-sm">
              {isJa
                ? "このビューにはフォームが見つかりませんでした。最初の点検フォームを作成して始めましょう。"
                : "No forms found in this view yet. Create your first maintenance form to get started."}
            </p>
            <button
              type="button"
              onClick={() => openBuilder(null, selectedSchedule)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              {isJa ? `${selectedScheduleMeta.label}フォームを作成` : `Create ${selectedScheduleMeta.label} Form`}
            </button>
          </div>
        )}

        {!loading && !error && visibleTemplates.length > 0 && selectedTemplates.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container/50 px-6 py-14 text-center text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>{selectedScheduleMeta.icon}</span>
            <div>
              <p className="text-sm font-semibold text-on-surface">
                {isJa
                  ? `このビューには${selectedScheduleMeta.label}フォームがありません`
                  : `No ${selectedScheduleMeta.label.toLowerCase()} forms in this view`}
              </p>
              <p className="mt-1 text-sm leading-6 text-outline">
                {isJa
                  ? `最初の${selectedScheduleMeta.label}フォームを作成するか、上記の別の周期を選択してください。`
                  : `Create the first ${selectedScheduleMeta.label.toLowerCase()} form, or switch to another cadence above.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openBuilder(null, selectedSchedule)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              {isJa ? `${selectedScheduleMeta.label}フォームを作成` : `Create ${selectedScheduleMeta.label} Form`}
            </button>
          </div>
        )}

        {!loading && !error && selectedTemplates.length > 0 && grouped.map(({ key, label, labelClass, items }) =>
          items.length > 0 ? (
            <div key={key} className="mb-6">
              <h4 className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((form) => (
                  <FormCard
                    key={form._id}
                    form={form}
                    machineNames={getFormMachineNames(form, equipmentMap)}
                    onOpen={() => setDetailTarget(form)}
                    language={language}
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

      {detailTarget && (
        <CheckFormDetailModal
          form={detailTarget}
          scheduleMeta={getScheduleMeta(detailTarget.schedule, language)}
          machineNames={getFormMachineNames(detailTarget, equipmentMap)}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            const nextTarget = detailTarget;
            setDetailTarget(null);
            openBuilder(nextTarget);
          }}
        />
      )}
    </section>
  );
}
