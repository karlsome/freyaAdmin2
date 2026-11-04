import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FactoryLiveMonitor from "../components/factoryStatus/FactoryLiveMonitor";
import AdvancedFilterSection from "../components/AdvancedFilterSection";
import DataTable from "../components/DataTable";
import MasterTabNav from "../components/MasterTabNav";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import StatusChip from "../components/StatusChip";
import FactoryStatusLogsModal from "../components/factoryStatus/FactoryStatusLogsModal";
import { useLanguage } from "../contexts/LanguageContext";
import {
  fetchFactoryStatusFactories,
  fetchFactoryStatusSnapshot,
} from "../services/factoryStatusApi";
import { readStoredAuthUser } from "../utils/auth";
import {
  buildFactoryStatusAdvancedFilterClauses,
  buildFactoryStatusPageInfo,
  createFactoryStatusAdvancedFilterRow,
  FACTORY_STATUS_AUTO_REFRESH_MS,
  FACTORY_STATUS_OPERATOR_LABELS,
  FACTORY_STATUS_OPERATOR_LABELS_JA,
  FACTORY_STATUS_PAGE_SIZE,
  formatFactoryStatusDateTime,
  formatFactoryStatusDuration,
  formatFactoryStatusNumber,
  getFactoryStatusAccessibleFactories,
  getFactoryStatusAdvancedFilterFields,
  getFactoryStatusBadgeMeta,
  getFactoryStatusOperatorName,
  getDefaultFactoryStatusSelection,
  getFactoryStatusRowToneClass,
  sortFactoryStatusFactories,
  summarizeFactoryStatusSelection,
} from "../utils/factoryStatus";

const EMPTY_FILTER_OPTIONS = {
  equipments: [],
  workers: [],
  actions: [],
};

const EMPTY_SUMMARY = {
  totalGoalQuantity: 0,
  totalActualQuantity: 0,
  totalGoodQuantity: 0,
  totalNgQuantity: 0,
  achievementRate: 0,
  activeMachines: 0,
  staleMachines: 0,
  idleMachines: 0,
  activeSessions: 0,
  selectedFactoryCount: 0,
};

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}


function SummaryCard({ icon, label, value, subtitle, accent, loading = false }) {
  return (
    <StatSummaryCard
      variant="freya"
      icon={icon}
      label={label}
      value={value}
      subtitle={subtitle}
      accent={accent}
      loading={loading}
    />
  );
}

export default function FactoryStatusPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const navigate = useNavigate();
  const { tab } = useParams();
  const activeTab = tab || "live-monitor";
  const [authUser] = useState(() => readStoredAuthUser());
  const requestIdRef = useRef(0);
  const [factoryOptions, setFactoryOptions] = useState([]);
  const [selectedFactories, setSelectedFactories] = useState([]);
  const [date, setDate] = useState(() => todayString());
  const [advancedRows, setAdvancedRows] = useState(() => [createFactoryStatusAdvancedFilterRow()]);
  const [advancedFilters, setAdvancedFilters] = useState([]);
  const [pagesByFactory, setPagesByFactory] = useState({});
  const [sort, setSort] = useState({ column: "", direction: 1 });
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [groups, setGroups] = useState([]);
  const [filterOptions, setFilterOptions] = useState(EMPTY_FILTER_OPTIONS);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [logsModalState, setLogsModalState] = useState({ open: false, factory: "", equipment: "" });

  const selectionSummary = summarizeFactoryStatusSelection(selectedFactories, language);
  const selectedFactoriesKey = selectedFactories.join("||");
  const pagesByFactoryKey = JSON.stringify(pagesByFactory);

  const advancedFieldDefinitions = useMemo(() => (
    getFactoryStatusAdvancedFilterFields(language).map((field) => ({
      ...field,
      options: Array.isArray(field.options)
        ? field.options
        : field.field === "equipment"
          ? filterOptions.equipments
          : field.field === "workerName"
            ? filterOptions.workers
            : field.field === "latestAction"
              ? filterOptions.actions
              : [],
    }))
  ), [filterOptions.actions, filterOptions.equipments, filterOptions.workers, language]);

  useEffect(() => {
    let cancelled = false;
    setLoadingFactories(true);

    async function loadFactories() {
      try {
        const nextFactories = await fetchFactoryStatusFactories();
        if (cancelled) return;

        const accessibleFactories = getFactoryStatusAccessibleFactories(authUser, nextFactories);
        setFactoryOptions(accessibleFactories);
        setSelectedFactories((current) => {
          const validCurrent = sortFactoryStatusFactories(current.filter((factory) => accessibleFactories.includes(factory)));
          return validCurrent.length ? validCurrent : getDefaultFactoryStatusSelection(accessibleFactories);
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load factories.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFactories(false);
        }
      }
    }

    void loadFactories();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshNonce((current) => current + 1);
    }, FACTORY_STATUS_AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedFactories.length) {
      setSummary(EMPTY_SUMMARY);
      setGroups([]);
      setFilterOptions(EMPTY_FILTER_OPTIONS);
      setGeneratedAt("");
      return;
    }

    let cancelled = false;
    const requestId = ++requestIdRef.current;

    async function loadSnapshot() {
      setLoadingSnapshot(true);
      setError("");

      try {
        const result = await fetchFactoryStatusSnapshot({
          date,
          factories: selectedFactories,
          advancedFilters,
          pagesByFactory,
          limit: FACTORY_STATUS_PAGE_SIZE,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        setSummary(result?.summary || EMPTY_SUMMARY);
        setGroups(Array.isArray(result?.groups) ? result.groups : []);
        setFilterOptions(result?.filterOptions || EMPTY_FILTER_OPTIONS);
        setGeneratedAt(result?.generatedAt || "");
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError(loadError.message || "Failed to load factory status data.");
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoadingSnapshot(false);
        }
      }
    }

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [advancedFilters, date, pagesByFactory, pagesByFactoryKey, refreshNonce, selectedFactories, selectedFactoriesKey, sort]);

  function toggleFactory(factory) {
    setSelectedFactories((current) => {
      const next = current.includes(factory)
        ? current.filter((value) => value !== factory)
        : [...current, factory];
      return factoryOptions.filter((option) => next.includes(option));
    });
    setPagesByFactory({});
  }

  function handleSelectAllFactories() {
    setSelectedFactories(factoryOptions);
    setPagesByFactory({});
  }

  function handleClearFactories() {
    setSelectedFactories([]);
    setPagesByFactory({});
  }

  function handleSort(column) {
    setPagesByFactory({});
    setSort((current) => {
      if (current.column === column) {
        return { column, direction: current.direction === 1 ? -1 : 1 };
      }

      return { column, direction: 1 };
    });
  }

  function handleUpdateAdvancedRow(rowId, patch) {
    setAdvancedRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function handleRemoveAdvancedRow(rowId) {
    setAdvancedRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createFactoryStatusAdvancedFilterRow()];
    });
  }

  function handleApplyAdvancedFilters() {
    setPagesByFactory({});
    setAdvancedFilters(buildFactoryStatusAdvancedFilterClauses(advancedRows, advancedFieldDefinitions));
  }

  function handleClearAdvancedFilters() {
    setPagesByFactory({});
    setAdvancedRows([createFactoryStatusAdvancedFilterRow()]);
    setAdvancedFilters([]);
  }

  function buildLogsPageUrl({ factory = "", equipment = "" } = {}) {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (factory) {
      params.set("factory", factory);
    } else if (selectedFactories.length === 1) {
      params.set("factory", selectedFactories[0]);
    } else if (selectedFactories.length > 1) {
      params.set("factories", selectedFactories.join(","));
    }
    if (equipment) params.set("equipment", equipment);
    return `/factoryStatus/logs?${params.toString()}`;
  }

  function openLogsPage(options = {}) {
    navigate(buildLogsPageUrl(options));
  }

  function openLogsForEquipment(factory, equipment) {
    setLogsModalState({ open: true, factory, equipment });
  }

  const columns = useMemo(() => ([
    {
      key: "equipment",
      label: isJa ? "設備" : "Equipment",
      width: 150,
      renderCell: (row) => <span className="text-xs font-semibold text-[var(--text-primary)]">{row.equipment || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "statusKey",
      label: isJa ? "ステータス" : "Status",
      width: 120,
      renderCell: (row) => {
        const meta = getFactoryStatusBadgeMeta(row.statusKey, language);
        return <StatusChip icon={meta.icon} label={meta.label} className={`text-xs ${meta.badgeClassName}`} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "workerName",
      label: isJa ? "作業者" : "Operator",
      width: 160,
      renderCell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{getFactoryStatusOperatorName(row) || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "latestAction",
      label: isJa ? "直近アクション" : "Latest Action",
      width: 260,
      renderCell: (row) => <div className="whitespace-normal text-xs text-[var(--text-secondary)]">{row.latestAction || "—"}</div>,
      disableCellWrapper: true,
    },
    {
      key: "partNumber",
      label: isJa ? "品番" : "Part Number",
      width: 180,
      renderCell: (row) => <span className="text-xs font-mono font-medium text-[var(--text-primary)]">{row.partNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "backNumber",
      label: isJa ? "背番号" : "Serial Number",
      width: 150,
      renderCell: (row) => <span className="text-xs font-mono text-[var(--text-primary)]">{row.backNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "elapsedMinutes",
      label: isJa ? "経過時間" : "Elapsed",
      width: 120,
      renderCell: (row) => <span className="font-mono freya-tabular text-xs font-semibold text-[var(--text-primary)]">{formatFactoryStatusDuration(row.elapsedMinutes)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "lastUpdatedAt",
      label: isJa ? "最終更新" : "Last Update",
      width: 220,
      renderCell: (row) => (
        <div className="min-w-0">
          <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">{formatFactoryStatusDateTime(row.lastUpdatedAt)}</div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {row.lastUpdatedMinutes != null ? `${formatFactoryStatusNumber(row.lastUpdatedMinutes)} ${isJa ? "分前" : "min ago"}` : "—"}
          </div>
        </div>
      ),
      disableCellWrapper: true,
    },
    {
      key: "todayActualQuantity",
      label: isJa ? "本日実績" : "Today Actual",
      width: 130,
      renderCell: (row) => <span className="font-mono freya-tabular text-xs font-bold text-[var(--freya-blue)]">{formatFactoryStatusNumber(row.todayActualQuantity)}</span>,
      disableCellWrapper: true,
    },
  ]), [isJa, language]);

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <div className="w-full">
        <PageHeader
          eyebrow={isJa ? "リアルタイム運用" : "Live Operations"}
          badge={isJa ? "ライブ" : "LIVE"}
          title={isJa ? "工場ステータス" : "Factory Status"}
          subtitle={isJa
            ? "タブレットログから設備の稼働状況を把握し、目標と実績を比較して工場ごとの現在の設備状態を確認します。"
            : "Track live machine activity from tablet logs, compare goals versus actual production, and review the current machine state by factory."}
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => openLogsPage()}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
              >
                {isJa ? "ログページ" : "Logs Page"}
              </button>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-mono text-[var(--text-secondary)]">
                {generatedAt ? (isJa ? `更新日時 ${formatFactoryStatusDateTime(generatedAt)}` : `Updated ${formatFactoryStatusDateTime(generatedAt)}`) : (isJa ? "初回読み込み待機中..." : "Waiting for first load...")}
              </div>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loadingSnapshot || loadingFactories}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-none"
              >
                {loadingSnapshot ? (isJa ? "更新中..." : "Refreshing...") : (isJa ? "更新" : "Refresh")}
              </button>
            </>
          )}
        />

        {error ? (
          <div className="mb-4 rounded-[6px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "フィルター" : "Filters"}</p>
              <h2 className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{isJa ? "対象工場" : "Factory Scope"}</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{selectionSummary.countLabel} · {selectionSummary.selectedText}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllFactories}
                disabled={!factoryOptions.length}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isJa ? "すべて選択" : "Select All"}
              </button>
              <button
                type="button"
                onClick={handleClearFactories}
                disabled={!selectedFactories.length}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isJa ? "クリア" : "Clear"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_260px]">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "工場一覧" : "Factories"}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {factoryOptions.map((factory) => {
                  const active = selectedFactories.includes(factory);

                  return (
                    <button
                      key={factory}
                      type="button"
                      onClick={() => toggleFactory(factory)}
                      className={joinClasses(
                        "rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] font-semibold"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      {factory}
                    </button>
                  );
                })}
                {!factoryOptions.length && !loadingFactories ? (
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {isJa ? "アクセス可能な工場がありません。" : "No accessible factories found."}
                  </div>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "日付" : "Date"}</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPagesByFactory({});
                }}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {isJa ? "初期値は本日。60秒ごとに自動更新されます。" : "Defaults to today and auto-refreshes every 60 seconds."}
              </p>
            </label>
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <AdvancedFilterSection
              rows={advancedRows}
              fieldDefinitions={advancedFieldDefinitions}
              onUpdateRow={handleUpdateAdvancedRow}
              onAddRow={() => setAdvancedRows((current) => [...current, createFactoryStatusAdvancedFilterRow()])}
              onRemoveRow={handleRemoveAdvancedRow}
              onClearRows={handleClearAdvancedFilters}
              operatorLabels={isJa ? FACTORY_STATUS_OPERATOR_LABELS_JA : FACTORY_STATUS_OPERATOR_LABELS}
              useOperatorLabelsInSelect
              title={isJa ? "詳細フィルター" : "Advanced Filters"}
              activeSummaryDescription={isJa
                ? "上位の工場・日付範囲を変更せずに、設備一覧テーブルを絞り込みます。"
                : "Filter the grouped machine tables without changing the top-level factory and date scope."}
              variant="compact"
              framed
              enableTextSuggestions
              inputIdPrefix="factory-status-filter-options"
              footer={(
                <>
                  <button
                    type="button"
                    onClick={handleApplyAdvancedFilters}
                    className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-none"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>filter_alt</span>
                    {isJa ? "フィルター適用" : "Apply Filters"}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAdvancedFilters}
                    className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
                    {isJa ? "フィルター解除" : "Reset Filters"}
                  </button>
                </>
              )}
            />
          </div>
        </div>

        <MasterTabNav
          tabs={[
            { key: "live-monitor", label: isJa ? "ライブモニター" : "Live Monitor", ready: true },
            { key: "live-status", label: isJa ? "生産ステータス" : "Production Status", ready: true },
          ]}
          activeTab={activeTab}
          onSelect={(tab) => navigate(`/factoryStatus/${tab.key}`, { replace: true })}
        />

        {activeTab === "live-status" && (
          <div className="mt-4 space-y-6">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <SummaryCard
                icon="flag"
                label={isJa ? "目標数" : "Goal"}
                value={formatFactoryStatusNumber(summary.totalGoalQuantity)}
                subtitle={isJa ? "選択中の工場" : "Selected factories"}
                loading={loadingSnapshot && !generatedAt}
              />
              <SummaryCard
                icon="precision_manufacturing"
                label={isJa ? "実績数" : "Actual"}
                value={formatFactoryStatusNumber(summary.totalActualQuantity)}
                subtitle={isJa ? "pressDB 本日分" : "Today from pressDB"}
                loading={loadingSnapshot && !generatedAt}
              />
              <SummaryCard
                icon="trending_up"
                label={isJa ? "達成率" : "Achievement"}
                value={`${summary.achievementRate.toLocaleString()}%`}
                subtitle={isJa ? "目標比" : "Goal vs actual"}
                loading={loadingSnapshot && !generatedAt}
              />
              <SummaryCard
                icon="play_circle"
                label={isJa ? "稼働設備" : "Active Machines"}
                value={formatFactoryStatusNumber(summary.activeMachines)}
                subtitle={isJa ? "セッション進行中" : "Live sessions in progress"}
                loading={loadingSnapshot && !generatedAt}
              />
              <SummaryCard
                icon="schedule"
                label={isJa ? "停滞設備" : "Stale Machines"}
                value={formatFactoryStatusNumber(summary.staleMachines)}
                subtitle={isJa ? "稼働中だが未更新" : "Active but not recently updated"}
                loading={loadingSnapshot && !generatedAt}
              />
              <SummaryCard
                icon="pause_circle"
                label={isJa ? "停止設備" : "Idle Machines"}
                value={formatFactoryStatusNumber(summary.idleMachines)}
                subtitle={isJa ? `${formatFactoryStatusNumber(summary.activeSessions)} 件の稼働セッション` : `${formatFactoryStatusNumber(summary.activeSessions)} active sessions`}
                loading={loadingSnapshot && !generatedAt}
              />
            </div>

            {!selectedFactories.length && !loadingFactories ? (
              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {isJa ? "工場を1つ以上選択してください" : "Choose at least one factory"}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {isJa ? "工場を選択すると設備一覧テーブルが表示されます。" : "The grouped machine tables appear after you select one or more factories."}
                </p>
              </div>
            ) : null}

            {groups.map((group) => (
              <div key={group.factory} className="space-y-3">
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "工場" : "Factory"}</p>
                      <h2 className="mt-0.5 text-xl font-semibold text-[var(--text-primary)]">{group.factory}</h2>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {isJa ? (
                          <>
                            <span className="font-semibold text-[var(--text-primary)] font-mono freya-tabular">{formatFactoryStatusNumber(group.overview.filteredMachineCount)}</span> / <span className="font-semibold text-[var(--text-primary)] font-mono freya-tabular">{formatFactoryStatusNumber(group.overview.machineCount)}</span> 台がフィルターに一致
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-[var(--text-primary)] font-mono freya-tabular">{formatFactoryStatusNumber(group.overview.filteredMachineCount)}</span> of <span className="font-semibold text-[var(--text-primary)] font-mono freya-tabular">{formatFactoryStatusNumber(group.overview.machineCount)}</span> machines match current filters.
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openLogsPage({ factory: group.factory })}
                      className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
                    >
                      {isJa ? "ログページ" : "Logs Page"}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "目標" : "Goal"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.goal.totalTargetQuantity)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "実績" : "Actual"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.actualQuantity)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "良品" : "Good"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.goodQuantity)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "不良" : "NG"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.ngQuantity)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "進捗" : "Progress"}</span> <span className="font-mono freya-tabular font-semibold text-[var(--freya-blue)]">{group.overview.achievementRate.toLocaleString()}%</span></span>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--freya-blue)] transition-all duration-300"
                      style={{ width: `${Math.min(group.overview.achievementRate, 100)}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "稼働中" : "Running"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.activeMachines)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "停滞" : "Stale"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.staleMachines)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "停止" : "Idle"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.idleMachines)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "セッション" : "Sessions"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.activeSessions)}</span></span>
                    <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1"><span className="font-semibold text-[var(--text-primary)]">{isJa ? "レコード" : "Records"}</span> <span className="font-mono freya-tabular font-medium">{formatFactoryStatusNumber(group.overview.recordCount)}</span></span>
                  </div>
                </div>

                <DataTable
                  columns={columns}
                  rows={group.rows}
                  loading={false}
                  error=""
                  sort={sort}
                  page={group.pagination.currentPage}
                  pageSize={FACTORY_STATUS_PAGE_SIZE}
                  filteredCount={group.pagination.totalItems}
                  totalPages={group.pagination.totalPages}
                  onSort={handleSort}
                  onPageChange={(nextPage) => {
                    setPagesByFactory((current) => ({ ...current, [group.factory]: nextPage }));
                  }}
                  onRowClick={(row) => openLogsForEquipment(group.factory, row?.equipment)}
                  rowKey={(row) => `${group.factory}-${row.equipment}`}
                  getRowClassName={(row) => getFactoryStatusRowToneClass(row)}
                  renderPageInfo={({ filteredCount, page, pageSize }) => (
                    <span className="text-xs text-[var(--text-secondary)] font-mono">{buildFactoryStatusPageInfo({ filteredCount, page, pageSize }, language)}</span>
                  )}
                  emptyTitle={isJa ? "一致する設備がありません" : "No matching machines"}
                  emptyMessage={isJa ? "詳細フィルターを調整するか、最新データに更新してください。" : "Adjust the advanced filters or refresh the live factory data."}
                  pageSizeLabel={isJa ? "件数" : "Rows"}
                  layoutStorageKey="factory-status-table-layout"
                  enableColumnResize
                  enableColumnReorder
                  tableClassName="ui-table-data min-w-full border-separate border-spacing-0 text-xs"
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm"
                  topBarClassName="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                  bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === "live-monitor" && (
          <div className="mt-4">
            <FactoryLiveMonitor 
              factories={selectedFactories} 
              onMachineClick={(factory, equipment) => setLogsModalState({ open: true, factory, equipment })}
            />
          </div>
        )}

        <FactoryStatusLogsModal
          open={logsModalState.open}
          factory={logsModalState.factory}
          equipment={logsModalState.equipment}
          date={date}
          onClose={() => setLogsModalState({ open: false, factory: "", equipment: "" })}
          onOpenFullPage={() => {
            openLogsPage({ factory: logsModalState.factory, equipment: logsModalState.equipment });
            setLogsModalState({ open: false, factory: "", equipment: "" });
          }}
        />
      </div>
    </div>
  );
}