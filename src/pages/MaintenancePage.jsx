import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCheckFormTemplates, fetchFactoryDBRecords, fetchSetsubiDBRecords } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";
import CheckFormBuilderModal from "../components/CheckFormBuilderModal";
import CheckFormDetailModal from "../components/CheckFormDetailModal";
import PageHeader from "../components/PageHeader";

const STATUS_CONFIG = {
  active: {
    bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    label_en: "Active",
    label_ja: "アクティブ",
    icon: "check_circle",
  },
  draft: {
    bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    label_en: "Draft",
    label_ja: "下書き",
    icon: "edit_note",
  },
  archived: {
    bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    label_en: "Archived",
    label_ja: "アーカイブ",
    icon: "archive",
  },
};

const SCHEDULE_CONFIG = {
  daily: {
    label_en: "Daily",
    label_ja: "日次",
    description_en: "Checks operators complete every day.",
    description_ja: "作業者が毎日実施する点検です。",
    icon: "today",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
  },
  weekly: {
    label_en: "Weekly",
    label_ja: "週次",
    description_en: "Checks planned once each week.",
    description_ja: "毎週1回実施される点検です。",
    icon: "date_range",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
  },
  monthly: {
    label_en: "Monthly",
    label_ja: "月次",
    description_en: "Checks completed on the first day of the month.",
    description_ja: "毎月月初に実施される点検です。",
    icon: "calendar_month",
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
  },
};

function getScheduleMeta(schedule, language = "en") {
  const isJa = language === "ja";
  const config = SCHEDULE_CONFIG[schedule];
  if (!config) {
    return {
      label: schedule || (isJa ? "未スケジュール" : "Unscheduled"),
      description: isJa ? "スケジュール未設定" : "No schedule assigned",
      icon: "event_busy",
      badgeClass: "bg-outline/10 text-outline border-outline/20",
    };
  }
  return {
    label: isJa ? (config.label_ja || config.label_en) : (config.label_en || config.label_ja),
    description: isJa ? (config.description_ja || config.description_en) : (config.description_en || config.description_ja),
    icon: config.icon,
    badgeClass: config.badgeClass,
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
  const statusMeta = STATUS_CONFIG[form.status] ?? STATUS_CONFIG.draft;
  const visibleMachineNames = machineNames.slice(0, 3);
  const remainingMachineCount = Math.max(machineNames.length - visibleMachineNames.length, 0);

  const formName = isJa
    ? (form.name_ja || form.name || form.name_en)
    : (form.name_en || form.name || form.name_ja);
  const formDescription = isJa
    ? (form.description_ja || form.description || form.description_en)
    : (form.description_en || form.description || form.description_ja);

  const statusLabel = isJa
    ? (statusMeta.label_ja || form.status)
    : (statusMeta.label_en || form.status || "Draft");

  const timing = form.timing || "pre";
  const timingLabel = isJa
    ? (timing === "post" ? "作業後点検" : "作業前点検")
    : (timing === "post" ? "Post-Production" : "Pre-Production");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-card group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface/60 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-haspopup="dialog"
    >
      <div className="p-5">
        {/* Header Badges */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Cadence */}
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${scheduleMeta.badgeClass}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{scheduleMeta.icon}</span>
              {scheduleMeta.label}
            </span>

            {/* Timing */}
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
              timing === "post"
                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25"
                : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25"
            }`}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {timing === "post" ? "task" : "play_circle"}
              </span>
              {timingLabel}
            </span>
          </div>

          {/* Status */}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusMeta.bg}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{statusMeta.icon}</span>
            {statusLabel}
          </span>
        </div>

        {/* Title */}
        <h4 className="line-clamp-2 text-base font-bold text-on-surface transition-colors group-hover:text-primary">
          {formName}
        </h4>

        {/* Description */}
        {formDescription ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-outline whitespace-pre-line">
            {formDescription}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-outline/60">
            {isJa ? "説明はありません" : "No description provided"}
          </p>
        )}

        {/* Machines Chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleMachineNames.length > 0 ? (
            <>
              {visibleMachineNames.map((machineName) => (
                <span
                  key={machineName}
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container/80 px-2.5 py-1 text-[11px] font-medium text-on-surface"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>precision_manufacturing</span>
                  <span className="max-w-[120px] truncate">{machineName}</span>
                </span>
              ))}
              {remainingMachineCount > 0 && (
                <span className="inline-flex items-center rounded-lg border border-outline-variant/30 bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-outline">
                  +{remainingMachineCount} {isJa ? "台" : "more"}
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-outline-variant/30 bg-surface-container/40 px-2.5 py-1 text-[11px] font-medium text-outline">
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>precision_manufacturing</span>
              {isJa ? "設備未割り当て" : "No machines assigned"}
            </span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-between border-t border-separator/40 bg-surface-container/30 px-5 py-3 text-xs">
        <div className="flex items-center gap-3 text-outline">
          {form.工場 && (
            <span className="flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>factory</span>
              {form.工場}
            </span>
          )}
          <span className="flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>fact_check</span>
            {form.fields?.length ?? 0} {isJa ? "項目" : "checks"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:underline">
          {isJa ? "詳細を見る" : "View Form"}
          <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-0.5" style={{ fontSize: 14 }}>
            arrow_forward
          </span>
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

  // Filter States
  const [activeTab, setActiveTab] = useState("all"); // "all" | "daily" | "weekly" | "monthly"
  const [searchQuery, setSearchQuery] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("");
  const [timingFilter, setTimingFilter] = useState("all"); // "all" | "pre" | "post"
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "draft" | "archived"

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
    setBuilderPresetSchedule(form?.schedule ?? (presetSchedule === "all" ? "daily" : presetSchedule));
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditTarget(null);
    setBuilderPresetSchedule("");
  }

  const equipmentMap = useMemo(
    () => new Map(allEquipment.map((equipment) => [normalizeId(equipment._id), equipment])),
    [allEquipment]
  );

  // Filtered Templates Calculation
  const filteredTemplates = useMemo(() => {
    return templates.filter((form) => {
      // Tab Cadence filter
      if (activeTab !== "all" && form.schedule !== activeTab) {
        return false;
      }

      // Factory filter
      if (factoryFilter && form.工場 !== factoryFilter) {
        return false;
      }

      // Timing filter
      const timing = form.timing || "pre";
      if (timingFilter !== "all" && timing !== timingFilter) {
        return false;
      }

      // Status filter
      const status = form.status || "draft";
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameJa = (form.name_ja || "").toLowerCase();
        const nameEn = (form.name_en || "").toLowerCase();
        const name = (form.name || "").toLowerCase();
        const descJa = (form.description_ja || "").toLowerCase();
        const descEn = (form.description_en || "").toLowerCase();
        const desc = (form.description || "").toLowerCase();
        const factory = (form.工場 || "").toLowerCase();
        const machineNames = getFormMachineNames(form, equipmentMap).join(" ").toLowerCase();

        const fieldMatches = Array.isArray(form.fields) && form.fields.some((f) => {
          return (
            (f.label || "").toLowerCase().includes(query) ||
            (f.label_ja || "").toLowerCase().includes(query) ||
            (f.label_en || "").toLowerCase().includes(query)
          );
        });

        const matches =
          nameJa.includes(query) ||
          nameEn.includes(query) ||
          name.includes(query) ||
          descJa.includes(query) ||
          descEn.includes(query) ||
          desc.includes(query) ||
          factory.includes(query) ||
          machineNames.includes(query) ||
          fieldMatches;

        if (!matches) return false;
      }

      return true;
    });
  }, [templates, activeTab, factoryFilter, timingFilter, statusFilter, searchQuery, equipmentMap]);

  // Summary counts
  const totalCount = templates.length;
  const dailyCount = useMemo(() => templates.filter((t) => t.schedule === "daily").length, [templates]);
  const weeklyCount = useMemo(() => templates.filter((t) => t.schedule === "weekly").length, [templates]);
  const monthlyCount = useMemo(() => templates.filter((t) => t.schedule === "monthly").length, [templates]);
  const activeStatusCount = useMemo(() => templates.filter((t) => t.status === "active").length, [templates]);

  // Tab definitions
  const tabs = [
    { key: "all", label: isJa ? "全フォーム" : "All Forms", count: totalCount, icon: "format_list_bulleted" },
    { key: "daily", label: isJa ? "日次点検" : "Daily", count: dailyCount, icon: "today" },
    { key: "weekly", label: isJa ? "週次点検" : "Weekly", count: weeklyCount, icon: "date_range" },
    { key: "monthly", label: isJa ? "月次点検" : "Monthly", count: monthlyCount, icon: "calendar_month" },
  ];

  const hasActiveFilters = Boolean(factoryFilter || timingFilter !== "all" || statusFilter !== "all" || searchQuery.trim());

  function resetFilters() {
    setFactoryFilter("");
    setTimingFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
  }

  return (
    <section className="h-screen overflow-y-auto px-6 pb-20 pt-24 scrollbar-hide md:px-8">
      <section className="mx-auto max-w-7xl">
        {/* Page Header */}
        <PageHeader
          eyebrow={isJa ? "点検" : "Checklist"}
          title={isJa ? "点検フォーム" : "Checklist Forms"}
          actionsClassName="flex-wrap items-center gap-2.5"
          actions={(
            <>
              <button
                type="button"
                onClick={() => navigate("/maintenance/submissions")}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container-high active:scale-95"
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>table_chart</span>
                {isJa ? "点検履歴" : "Inspection History"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/maintenance/submissions/tickets")}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container-high active:scale-95"
              >
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 18 }}>confirmation_number</span>
                {isJa ? "NGチケット" : "Submitted Tickets"}
              </button>
              <button
                type="button"
                onClick={() => openBuilder(null, activeTab)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                {isJa ? "新規フォーム作成" : "New Checklist Form"}
              </button>
            </>
          )}
        />

        {/* Quick KPI Overview Bar */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab("all")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("all")}
            className={`dashboard-section cursor-pointer rounded-2xl p-4 transition-all duration-150 hover:border-primary/40 ${
              activeTab === "all" ? "ring-2 ring-primary/40 bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                {isJa ? "全フォーム" : "Total Forms"}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_list_bulleted</span>
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-on-surface">{totalCount}</p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {activeStatusCount} {isJa ? "稼働中" : "active"}
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab("daily")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("daily")}
            className={`dashboard-section cursor-pointer rounded-2xl p-4 transition-all duration-150 hover:border-blue-500/40 ${
              activeTab === "daily" ? "ring-2 ring-blue-500/40 bg-blue-500/5" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                {isJa ? "日次点検" : "Daily Checks"}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>today</span>
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-on-surface">{dailyCount}</p>
            <p className="mt-0.5 text-[11px] text-outline">
              {isJa ? "毎日実施" : "Every day"}
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab("weekly")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("weekly")}
            className={`dashboard-section cursor-pointer rounded-2xl p-4 transition-all duration-150 hover:border-amber-500/40 ${
              activeTab === "weekly" ? "ring-2 ring-amber-500/40 bg-amber-500/5" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                {isJa ? "週次点検" : "Weekly Checks"}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>date_range</span>
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-on-surface">{weeklyCount}</p>
            <p className="mt-0.5 text-[11px] text-outline">
              {isJa ? "週1回実施" : "Once a week"}
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab("monthly")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("monthly")}
            className={`dashboard-section cursor-pointer rounded-2xl p-4 transition-all duration-150 hover:border-indigo-500/40 ${
              activeTab === "monthly" ? "ring-2 ring-indigo-500/40 bg-indigo-500/5" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                {isJa ? "月次点検" : "Monthly Checks"}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-on-surface">{monthlyCount}</p>
            <p className="mt-0.5 text-[11px] text-outline">
              {isJa ? "月初の点検" : "First of month"}
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Filters Panel */}
        <div className="dashboard-section mb-6 rounded-2xl p-4">
          {/* Top Row: Cadence Tabs */}
          <div className="flex flex-col gap-4 border-b border-separator/40 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container text-outline hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      isActive ? "bg-white/20 text-on-primary" : "bg-surface text-outline"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick search input */}
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 18 }}>
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isJa ? "フォーム名・設備・項目を検索..." : "Search forms, machines, checks..."}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container/60 py-2 pl-10 pr-9 text-sm font-medium text-on-surface placeholder:text-outline/60 focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Filter Dropdowns */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Factory Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-outline hidden sm:inline">
                  {isJa ? "工場:" : "Factory:"}
                </span>
                <select
                  value={factoryFilter}
                  onChange={(e) => setFactoryFilter(e.target.value)}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface outline-none transition hover:bg-surface-container-high cursor-pointer"
                >
                  <option value="">{isJa ? "すべての工場" : "All Factories"}</option>
                  {factories.map((f) => (
                    <option key={f._id ?? f.工場} value={f.工場}>{f.工場}</option>
                  ))}
                </select>
              </div>

              {/* Timing Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-outline hidden sm:inline">
                  {isJa ? "タイミング:" : "Timing:"}
                </span>
                <select
                  value={timingFilter}
                  onChange={(e) => setTimingFilter(e.target.value)}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface outline-none transition hover:bg-surface-container-high cursor-pointer"
                >
                  <option value="all">{isJa ? "すべての点検" : "All Timings"}</option>
                  <option value="pre">{isJa ? "作業前点検" : "Pre-Production"}</option>
                  <option value="post">{isJa ? "作業後点検" : "Post-Production"}</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-outline hidden sm:inline">
                  {isJa ? "ステータス:" : "Status:"}
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface outline-none transition hover:bg-surface-container-high cursor-pointer"
                >
                  <option value="all">{isJa ? "すべての状態" : "All Status"}</option>
                  <option value="active">{isJa ? "アクティブ (稼働中)" : "Active"}</option>
                  <option value="draft">{isJa ? "下書き" : "Draft"}</option>
                  <option value="archived">{isJa ? "アーカイブ" : "Archived"}</option>
                </select>
              </div>

              {/* Reset Filters button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
                  {isJa ? "リセット" : "Reset"}
                </button>
              )}
            </div>

            {/* Result count */}
            <span className="text-xs font-semibold text-outline">
              {isJa ? `${filteredTemplates.length} 件のフォームを表示中` : `Showing ${filteredTemplates.length} forms`}
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-20 text-outline">
            <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 24 }}>progress_activity</span>
            <span className="text-sm font-medium">{isJa ? "読み込み中..." : "Loading checklist forms..."}</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-2xl border border-error/30 bg-error/10 p-5 text-sm text-error">
            <div className="flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined">error</span>
              <span>{isJa ? "エラーが発生しました" : "Failed to load forms"}</span>
            </div>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container/30 px-6 py-20 text-center text-outline">
            <span className="material-symbols-outlined text-outline/50" style={{ fontSize: 48 }}>checklist_rtl</span>
            <div>
              <h5 className="text-base font-bold text-on-surface">
                {hasActiveFilters
                  ? (isJa ? "一致する点検フォームがありません" : "No checklist forms match your filter")
                  : (isJa ? "点検フォームがまだありません" : "No checklist forms yet")}
              </h5>
              <p className="mt-1 max-w-md text-sm text-outline">
                {hasActiveFilters
                  ? (isJa ? "検索条件またはフィルターを変更してお試しください。" : "Try adjusting your search terms or clearing some filters.")
                  : (isJa ? "新しい点検フォームを作成して日常点検を開始しましょう。" : "Create your first checklist form to start tracking daily and weekly checks.")}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>
                {isJa ? "フィルターを解除" : "Clear Filters"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openBuilder(null, activeTab)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                {isJa ? "新規点検フォームを作成" : "Create Checklist Form"}
              </button>
            )}
          </div>
        )}

        {/* Forms Grid */}
        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((form) => (
              <FormCard
                key={form._id}
                form={form}
                machineNames={getFormMachineNames(form, equipmentMap)}
                onOpen={() => setDetailTarget(form)}
                language={language}
              />
            ))}
          </div>
        )}
      </section>

      {/* Builder Modal */}
      {builderOpen && (
        <CheckFormBuilderModal
          initial={editTarget}
          presetSchedule={builderPresetSchedule}
          onClose={closeBuilder}
          onSaved={() => { closeBuilder(); load(); }}
        />
      )}

      {/* Detail Modal */}
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
