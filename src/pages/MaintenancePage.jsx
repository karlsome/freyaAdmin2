import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  fetchCheckFormTemplates,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  updateCheckFormTemplate,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import { useLanguage } from "../contexts/LanguageContext";
import CheckFormBuilderModal from "../components/CheckFormBuilderModal";
import CheckFormDetailModal from "../components/CheckFormDetailModal";
import PageHeader from "../components/PageHeader";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";

const STATUS_CONFIG = {
  active: {
    bg: "bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/25",
    label_en: "Active",
    label_ja: "アクティブ",
    icon: "check_circle",
  },
  draft: {
    bg: "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/25",
    label_en: "Draft",
    label_ja: "下書き",
    icon: "edit_note",
  },
  archived: {
    bg: "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border)]",
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
    badgeClass: "bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border-[var(--freya-blue)]/25",
  },
  weekly: {
    label_en: "Weekly",
    label_ja: "週次",
    description_en: "Checks planned once each week.",
    description_ja: "毎週1回実施される点検です。",
    icon: "date_range",
    badgeClass: "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/25",
  },
  monthly: {
    label_en: "Monthly",
    label_ja: "月次",
    description_en: "Checks completed on the first day of the month.",
    description_ja: "毎月月初に実施される点検です。",
    icon: "calendar_month",
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25",
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
      badgeClass: "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border)]",
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

function FormCard({ form, machineNames, onOpen, onToggleStatus, onClone, language }) {
  const isJa = language === "ja";
  const scheduleMeta = getScheduleMeta(form.schedule, language);
  const statusMeta = STATUS_CONFIG[form.status] ?? STATUS_CONFIG.draft;
  const visibleMachineNames = machineNames.slice(0, 3);
  const remainingMachineCount = Math.max(machineNames.length - visibleMachineNames.length, 0);
  const isActive = form.status === "active";

  const formName = isJa
    ? (form.name_ja || form.name || form.name_en)
    : (form.name_en || form.name || form.name_ja);
  const formDescription = isJa
    ? (form.description_ja || form.description || form.description_en)
    : (form.description_en || form.description || form.description_ja);

  const statusLabel = isJa
    ? (statusMeta.label_ja || form.status)
    : (statusMeta.label_en || form.status || "Draft");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="freya-card group relative flex flex-col justify-between overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-left shadow-sm transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--freya-blue)] cursor-pointer"
      aria-haspopup="dialog"
    >
      <div className="p-4">
        {/* Header Badges */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Cadence */}
            <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${scheduleMeta.badgeClass}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{scheduleMeta.icon}</span>
              {scheduleMeta.label}
            </span>
          </div>

          {/* Status */}
          <span className={`inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusMeta.bg}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{statusMeta.icon}</span>
            {statusLabel}
          </span>
        </div>

        {/* Title */}
        <h4 className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--freya-blue)]">
          {formName}
        </h4>

        {/* Description */}
        {formDescription ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
            {formDescription}
          </p>
        ) : (
          <p className="mt-1.5 text-xs italic text-[var(--text-muted)] opacity-60">
            {isJa ? "説明はありません" : "No description provided"}
          </p>
        )}

        {/* Bottom row of card content: Machines on left, On/Off Switch on right */}
        <div className="mt-3.5 flex items-end justify-between gap-3">
          {/* Machines Chips */}
          <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
            {visibleMachineNames.length > 0 ? (
              <>
                {visibleMachineNames.map((machineName) => (
                  <span
                    key={machineName}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)]"
                  >
                    <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 13 }}>precision_manufacturing</span>
                    <span className="max-w-[110px] truncate">{machineName}</span>
                  </span>
                ))}
                {remainingMachineCount > 0 && (
                  <span className="inline-flex items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                    +{remainingMachineCount} {isJa ? "台" : "more"}
                  </span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)]/50 px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>precision_manufacturing</span>
                {isJa ? "設備未割り当て" : "No machines assigned"}
              </span>
            )}
          </div>

          {/* ON / OFF Switch */}
          <div
            className="flex items-center gap-2 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className={`text-[11px] font-semibold ${isActive ? "text-[var(--status-success)]" : "text-[var(--text-muted)]"}`}>
              {isActive ? (isJa ? "有効" : "Active") : (isJa ? "無効" : "Inactive")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              title={isActive ? (isJa ? "クリックして無効化" : "Click to deactivate") : (isJa ? "クリックして有効化" : "Click to activate")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(form, machineNames);
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--freya-blue)] ${
                isActive ? "bg-[var(--status-success)] shadow-xs" : "bg-[var(--surface-subtle)] border border-[var(--border)]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          {form.工場 && (
            <span className="flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 13 }}>factory</span>
              {form.工場}
            </span>
          )}
          <span className="flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 13 }}>fact_check</span>
            {form.fields?.length ?? 0} {isJa ? "項目" : "checks"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={isJa ? "テンプレートを複製" : "Clone template"}
            onClick={(e) => {
              e.stopPropagation();
              onClone?.(form);
            }}
            className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>copy_all</span>
            <span>{isJa ? "複製" : "Clone"}</span>
          </button>
          <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--freya-blue)] group-hover:bg-[var(--freya-blue)]/5 transition-colors">
            {isJa ? "詳細" : "View"}
            <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-0.5" style={{ fontSize: 12 }}>
              arrow_forward
            </span>
          </span>
        </div>
      </div>
    </div>
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
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [builderPresetSchedule, setBuilderPresetSchedule] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);

  // Filter States
  const [activeTab, setActiveTab] = useState("all"); // "all" | "daily" | "weekly" | "monthly"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFactories, setSelectedFactories] = useState([]);
  const [factoryDropdownOpen, setFactoryDropdownOpen] = useState(false);
  const factoryDropdownRef = useRef(null);
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

  function openCloner(form) {
    setEditTarget(form);
    setIsCloneMode(true);
    setBuilderPresetSchedule(form?.schedule ?? "daily");
    setBuilderOpen(true);
  }

  function openBuilder(form = null, presetSchedule = "") {
    setEditTarget(form);
    setIsCloneMode(false);
    setBuilderPresetSchedule(form?.schedule ?? (presetSchedule === "all" ? "daily" : presetSchedule));
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditTarget(null);
    setIsCloneMode(false);
    setBuilderPresetSchedule("");
  }

  const [deactivatingTarget, setDeactivatingTarget] = useState(null); // { form, machineNames }

  function handleRequestToggleStatus(form, machineNames) {
    const isCurrentlyActive = form.status === "active";
    if (isCurrentlyActive) {
      // Prompt warning before deactivating with affected machines list
      setDeactivatingTarget({ form, machineNames: machineNames || [] });
    } else {
      // Turning on (active): activate immediately as is currently
      executeToggleStatus(form, "active");
    }
  }

  async function executeToggleStatus(form, nextStatus) {
    const authUser = getAuthUser();
    const username = authUser?.username || "admin";

    // Optimistic UI update
    setTemplates((prev) =>
      prev.map((t) => (t._id === form._id ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateCheckFormTemplate(form._id, { status: nextStatus }, username);
    } catch (err) {
      console.error("Failed to update status:", err);
      // Revert on error
      setTemplates((prev) =>
        prev.map((t) => (t._id === form._id ? { ...t, status: form.status } : t))
      );
    }
  }

  const equipmentMap = useMemo(
    () => new Map(allEquipment.map((equipment) => [normalizeId(equipment._id), equipment])),
    [allEquipment]
  );

  const factoryCounts = useMemo(() => {
    const counts = {};
    for (const t of templates) {
      if (t.工場) {
        counts[t.工場] = (counts[t.工場] || 0) + 1;
      }
    }
    return counts;
  }, [templates]);

  const factoryButtonLabel = useMemo(() => {
    if (selectedFactories.length === 0) {
      return isJa ? "すべての工場" : "All Factories";
    }
    if (selectedFactories.length === 1) {
      return selectedFactories[0];
    }
    return isJa
      ? `${selectedFactories[0]} 他 ${selectedFactories.length - 1}件`
      : `${selectedFactories[0]} +${selectedFactories.length - 1}`;
  }, [selectedFactories, isJa]);

  // Filtered Templates Calculation
  const filteredTemplates = useMemo(() => {
    return templates.filter((form) => {
      // Tab Cadence filter
      if (activeTab !== "all" && form.schedule !== activeTab) {
        return false;
      }

      // Factory filter (multiple)
      if (selectedFactories.length > 0 && !selectedFactories.includes(form.工場)) {
        return false;
      }

      // Timing filter based on checks contained
      if (timingFilter === "pre") {
        const hasPre = !form.fields?.length || form.fields.some((f) => (f.timing || "pre") === "pre");
        if (!hasPre) return false;
      } else if (timingFilter === "post") {
        const hasPost = form.fields?.some((f) => f.timing === "post");
        if (!hasPost) return false;
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
  }, [templates, activeTab, selectedFactories, timingFilter, statusFilter, searchQuery, equipmentMap]);

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

  const hasActiveFilters = Boolean(selectedFactories.length > 0 || timingFilter !== "all" || statusFilter !== "all" || searchQuery.trim());

  function resetFilters() {
    setSelectedFactories([]);
    setTimingFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
  }

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      {/* Page Header */}
      <PageHeader
        eyebrow={isJa ? "点検" : "Checklist"}
        title={isJa ? "点検フォーム" : "Checklist Forms"}
        actionsClassName="flex-wrap items-center gap-2"
        actions={(
          <>
            <button
              type="button"
              onClick={() => navigate("/maintenance/submissions")}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>table_chart</span>
              {isJa ? "点検提出履歴" : "Checklist Submissions"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/maintenance/submissions/tickets")}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span className="material-symbols-outlined text-[var(--status-warning)]" style={{ fontSize: 16 }}>report_problem</span>
              {isJa ? "点検不具合一覧" : "Checklist Defects"}
            </button>
            <button
              type="button"
              onClick={() => openBuilder(null, activeTab)}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              {isJa ? "新規フォーム作成" : "New Checklist Form"}
            </button>
          </>
        )}
      />

      {/* Quick KPI Overview Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("all")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("all")}
          className={`freya-card cursor-pointer rounded-[8px] border bg-[var(--surface)] p-4 shadow-sm transition-colors ${
            activeTab === "all"
              ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)] bg-[var(--surface-raised)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "全フォーム" : "Total Forms"}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>format_list_bulleted</span>
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{totalCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--status-success)]">
            {activeStatusCount} {isJa ? "稼働中" : "active"}
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("daily")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("daily")}
          className={`freya-card cursor-pointer rounded-[8px] border bg-[var(--surface)] p-4 shadow-sm transition-colors ${
            activeTab === "daily"
              ? "border-[var(--freya-blue)] ring-1 ring-[var(--freya-blue)] bg-[var(--surface-raised)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "日次点検" : "Daily Checks"}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>today</span>
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{dailyCount}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {isJa ? "毎日実施" : "Every day"}
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("weekly")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("weekly")}
          className={`freya-card cursor-pointer rounded-[8px] border bg-[var(--surface)] p-4 shadow-sm transition-colors ${
            activeTab === "weekly"
              ? "border-[var(--status-warning)] ring-1 ring-[var(--status-warning)] bg-[var(--surface-raised)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "週次点検" : "Weekly Checks"}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[var(--status-warning)]/10 text-[var(--status-warning)]">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>date_range</span>
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{weeklyCount}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {isJa ? "週1回実施" : "Once a week"}
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("monthly")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveTab("monthly")}
          className={`freya-card cursor-pointer rounded-[8px] border bg-[var(--surface)] p-4 shadow-sm transition-colors ${
            activeTab === "monthly"
              ? "border-indigo-500 ring-1 ring-indigo-500 bg-[var(--surface-raised)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "月次点検" : "Monthly Checks"}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_month</span>
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{monthlyCount}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {isJa ? "月初の点検" : "First of month"}
          </p>
        </div>
      </div>

      {/* Navigation Tabs & Filters Panel */}
      <div className="freya-card relative z-20 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
        {/* Top Row: Cadence Tabs & Search */}
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 lg:flex-row lg:items-center lg:justify-between">
          <LiquidSegmentedControl
            items={tabs}
            activeKey={activeTab}
            onChange={setActiveTab}
          />

          {/* Quick search input */}
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isJa ? "フォーム名・設備・項目を検索..." : "Search forms, machines, checks..."}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] py-1.5 pl-8 pr-8 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--freya-blue)] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Filter Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Factory Multi-Select Filter */}
            <div className="relative z-30 flex items-center gap-1.5" ref={factoryDropdownRef}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] hidden sm:inline">
                {isJa ? "工場:" : "Factory:"}
              </span>
              <button
                type="button"
                onClick={() => setFactoryDropdownOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-xs font-semibold transition ${
                  selectedFactories.length > 0
                    ? "border-[var(--freya-blue)]/40 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
                    : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 14 }}>factory</span>
                <span>{factoryButtonLabel}</span>
                {selectedFactories.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--freya-blue)] text-[10px] font-bold text-white">
                    {selectedFactories.length}
                  </span>
                )}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {factoryDropdownOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {factoryDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[220px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 mb-1 px-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedFactories(factories.map((f) => f.工場).filter(Boolean))}
                      className="text-[var(--freya-blue)] hover:underline"
                    >
                      {isJa ? "すべて選択" : "Select All"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFactories([])}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {isJa ? "クリア" : "Clear"}
                    </button>
                  </div>
                  <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {factories.map((f) => {
                      const factoryName = f.工場;
                      const isSelected = selectedFactories.includes(factoryName);
                      const count = factoryCounts[factoryName] || 0;
                      return (
                        <label
                          key={f._id ?? factoryName}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-[6px] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedFactories((current) =>
                                  isSelected
                                    ? current.filter((item) => item !== factoryName)
                                    : [...current, factoryName]
                                );
                              }}
                              className="h-3.5 w-3.5 rounded-[4px] border-[var(--border)] accent-[var(--freya-blue)]"
                            />
                            <span>{factoryName}</span>
                          </div>
                          <span className="rounded-[4px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                            {count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Timing Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] hidden sm:inline">
                {isJa ? "タイミング:" : "Timing:"}
              </span>
              <select
                value={timingFilter}
                onChange={(e) => setTimingFilter(e.target.value)}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <option value="all">{isJa ? "すべての点検" : "All Timings"}</option>
                <option value="pre">{isJa ? "作業前点検を含む" : "Contains Pre-Production"}</option>
                <option value="post">{isJa ? "作業後点検を含む" : "Contains Post-Production"}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] hidden sm:inline">
                {isJa ? "ステータス:" : "Status:"}
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <option value="all">{isJa ? "すべての状態" : "All Status"}</option>
                <option value="active">{isJa ? "アクティブ (稼働中)" : "Active"}</option>
                <option value="draft">{isJa ? "下書き (停止中)" : "Draft / Inactive"}</option>
                <option value="archived">{isJa ? "アーカイブ" : "Archived"}</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
                {isJa ? "リセット" : "Reset"}
              </button>
            )}
          </div>

          {/* Result count */}
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {isJa ? `${filteredTemplates.length} 件のフォームを表示中` : `Showing ${filteredTemplates.length} forms`}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-20 text-[var(--text-muted)]">
          <span className="material-symbols-outlined animate-spin text-[var(--freya-blue)]" style={{ fontSize: 24 }}>progress_activity</span>
          <span className="text-xs font-medium">{isJa ? "読み込み中..." : "Loading checklist forms..."}</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 p-4 text-xs text-[var(--status-danger)]">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            <span>{isJa ? "エラーが発生しました" : "Failed to load forms"}</span>
          </div>
          <p className="mt-1 text-xs opacity-90">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)]/50 px-6 py-20 text-center text-[var(--text-muted)]">
          <span className="material-symbols-outlined text-[var(--text-muted)] opacity-50" style={{ fontSize: 44 }}>checklist_rtl</span>
          <div>
            <h5 className="text-sm font-bold text-[var(--text-primary)]">
              {hasActiveFilters
                ? (isJa ? "一致する点検フォームがありません" : "No checklist forms match your filter")
                : (isJa ? "点検フォームがまだありません" : "No checklist forms yet")}
            </h5>
            <p className="mt-1 max-w-md text-xs text-[var(--text-muted)]">
              {hasActiveFilters
                ? (isJa ? "検索条件またはフィルターを変更してお試しください。" : "Try adjusting your search terms or clearing some filters.")
                : (isJa ? "新しい点検フォームを作成して日常点検を開始しましょう。" : "Create your first checklist form to start tracking daily and weekly checks.")}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
              {isJa ? "フィルターを解除" : "Clear Filters"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openBuilder(null, activeTab)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
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
              onToggleStatus={handleRequestToggleStatus}
              onClone={openCloner}
              language={language}
            />
          ))}
        </div>
      )}

      {/* Builder Modal */}
      {builderOpen && (
        <CheckFormBuilderModal
          initial={editTarget}
          isClone={isCloneMode}
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
          onClone={(form) => {
            setDetailTarget(null);
            openCloner(form);
          }}
          onEdit={() => {
            const nextTarget = detailTarget;
            setDetailTarget(null);
            openBuilder(nextTarget);
          }}
        />
      )}

      {/* Deactivation Confirmation Warning Modal */}
      {deactivatingTarget && (
        <DeactivateConfirmModal
          form={deactivatingTarget.form}
          machineNames={deactivatingTarget.machineNames}
          onClose={() => setDeactivatingTarget(null)}
          onConfirm={() => {
            const target = deactivatingTarget.form;
            setDeactivatingTarget(null);
            executeToggleStatus(target, "draft");
          }}
          language={language}
        />
      )}
    </div>
  );
}

function DeactivateConfirmModal({ form, machineNames = [], onClose, onConfirm, language }) {
  const isJa = language === "ja";
  const formName = isJa
    ? (form.name_ja || form.name || form.name_en)
    : (form.name_en || form.name || form.name_ja);

  const machineCount = machineNames.length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-6 py-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[6px] bg-[var(--status-warning)]/10 text-[var(--status-warning)]">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {isJa ? "点検フォームの無効化確認" : "Deactivate Checklist Form?"}
            </h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-[var(--freya-blue)]">
              {formName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="rounded-[6px] border border-[var(--status-warning)]/20 bg-[var(--status-warning)]/10 p-3 text-xs leading-relaxed text-[var(--status-warning)]">
            <p className="font-semibold">
              {isJa
                ? `このフォームを無効化すると、対象の ${machineCount} 台の設備で現場の日常点検・提出ができなくなります。`
                : `Deactivating this form will disable inspections and submissions on ${machineCount} assigned machine${machineCount === 1 ? "" : "s"}.`}
            </p>
            <p className="mt-1 text-[11px] opacity-90">
              {isJa
                ? "本当に無効化（停止）してもよろしいですか？"
                : "Are you sure you want to continue?"}
            </p>
          </div>

          {/* List of Affected Machines */}
          <div className="mt-4">
            <label className="block text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1.5">
              {isJa ? `影響を受ける対象設備 (${machineCount}台)` : `Affected Machines (${machineCount})`}
            </label>
            {machineCount > 0 ? (
              <div className="max-h-44 overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2 space-y-1">
                {machineNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-[4px] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)]"
                  >
                    <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 15 }}>precision_manufacturing</span>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic py-1">
                {isJa ? "割り当てられている設備はありません。" : "No machines currently assigned."}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--status-danger)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--status-danger)]/90 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>power_settings_new</span>
            {isJa ? "無効化する" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

