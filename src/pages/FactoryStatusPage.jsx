import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdvancedFilterSection from "../components/AdvancedFilterSection";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import StatusChip from "../components/StatusChip";
import FactoryStatusLogsModal from "../components/factoryStatus/FactoryStatusLogsModal";
import {
  fetchFactoryStatusFactories,
  fetchFactoryStatusSnapshot,
} from "../services/factoryStatusApi";
import { useLanguage } from "../contexts/LanguageContext";
import { readStoredAuthUser } from "../utils/auth";
import {
  buildFactoryStatusAdvancedFilterClauses,
  buildFactoryStatusPageInfo,
  createFactoryStatusAdvancedFilterRow,
  FACTORY_STATUS_ADVANCED_FILTER_FIELDS,
  FACTORY_STATUS_AUTO_REFRESH_MS,
  FACTORY_STATUS_OPERATOR_LABELS,
  FACTORY_STATUS_PAGE_SIZE,
  formatFactoryStatusDateTime,
  formatFactoryStatusDuration,
  formatFactoryStatusNumber,
  getFactoryStatusAccessibleFactories,
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
      icon={icon}
      label={label}
      value={value}
      subtitle={subtitle}
      accent={accent}
      loading={loading}
      valueClassName="planner-data-text text-2xl font-semibold tabular-nums"
      labelClassName="planner-data-text text-[11px] font-semibold text-on-surface-variant"
      subtitleClassName="planner-data-text text-[10px] text-outline"
      iconClassName="shadow-none"
    />
  );
}

export default function FactoryStatusPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
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

  const selectionSummary = summarizeFactoryStatusSelection(selectedFactories);
  const selectedFactoriesKey = selectedFactories.join("||");
  const pagesByFactoryKey = JSON.stringify(pagesByFactory);

  const advancedFieldDefinitions = useMemo(() => (
    FACTORY_STATUS_ADVANCED_FILTER_FIELDS.map((field) => ({
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
  ), [filterOptions.actions, filterOptions.equipments, filterOptions.workers]);

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
      label: t("equipment"),
      width: 150,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.equipment || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "statusKey",
      label: t("status"),
      width: 120,
      renderCell: (row) => {
        const meta = getFactoryStatusBadgeMeta(row.statusKey);
        return <StatusChip icon={meta.icon} label={meta.label} className={`planner-data-text ${meta.badgeClassName}`} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "workerName",
      label: t("operator"),
      width: 160,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{getFactoryStatusOperatorName(row) || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "latestAction",
      label: t("latestAction"),
      width: 260,
      renderCell: (row) => <div className="planner-data-text whitespace-normal text-sm text-on-surface-variant">{row.latestAction || "—"}</div>,
      disableCellWrapper: true,
    },
    {
      key: "partNumber",
      label: t("partNumber"),
      width: 180,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.partNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "backNumber",
      label: t("serialNumber") || "Serial Number",
      width: 150,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.backNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "elapsedMinutes",
      label: t("elapsed"),
      width: 120,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold tabular-nums text-on-surface">{formatFactoryStatusDuration(row.elapsedMinutes)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "lastUpdatedAt",
      label: t("lastUpdate"),
      width: 220,
      renderCell: (row) => (
        <div className="planner-data-text min-w-0">
          <div className="text-sm font-semibold text-on-surface">{formatFactoryStatusDateTime(row.lastUpdatedAt)}</div>
          <div className="mt-1 text-xs text-on-surface-variant">
            {row.lastUpdatedMinutes != null ? t("minAgo").replace("{minutes}", formatFactoryStatusNumber(row.lastUpdatedMinutes)) : "—"}
          </div>
        </div>
      ),
      disableCellWrapper: true,
    },
    {
      key: "todayActualQuantity",
      label: t("todayActual"),
      width: 130,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold tabular-nums text-primary">{formatFactoryStatusNumber(row.todayActualQuantity)}</span>,
      disableCellWrapper: true,
    },
  ]), []);

  return (
    <section className="h-screen overflow-y-auto scrollbar-hide px-8 pb-16 pt-24">
      <div className="w-full">
        <PageHeader
          eyebrow={t("liveOperations")}
          eyebrowClassName="tracking-[0.18em] text-primary"
          title={t("factoryStatus")}
          subtitle={t("factoryStatusSubtitle")}
          subtitleClassName="max-w-4xl"
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => openLogsPage()}
                className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Logs Page
              </button>
              <div className="planner-data-text rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 px-4 py-2.5 text-sm text-on-surface-variant">
                {generatedAt ? `Updated ${formatFactoryStatusDateTime(generatedAt)}` : t("waitingForFirstLoad")}
              </div>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loadingSnapshot || loadingFactories}
                className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingSnapshot ? t("refreshing") : t("refresh")}
              </button>
            </>
          )}
        />

        {error ? (
          <div className="planner-data-text mb-6 rounded-2xl border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        <div className="dashboard-section mb-6 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("filters") || "Filters"}</p>
              <h2 className="mt-1 text-lg font-semibold text-on-surface">{t("factoryScope")}</h2>
              <p className="planner-data-text mt-2 text-sm text-on-surface-variant">{selectionSummary.countLabel} · {selectionSummary.selectedText}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllFactories}
                disabled={!factoryOptions.length}
                className="rounded-2xl border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearFactories}
                disabled={!selectedFactories.length}
                className="rounded-2xl border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_260px]">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("factories")}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {factoryOptions.map((factory) => {
                  const active = selectedFactories.includes(factory);

                  return (
                    <button
                      key={factory}
                      type="button"
                      onClick={() => toggleFactory(factory)}
                      className={joinClasses(
                        "planner-data-text rounded-full border px-3 py-2 text-sm font-semibold transition",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-outline-variant/20 bg-white text-on-surface hover:bg-surface-container dark:bg-surface-container"
                      )}
                    >
                      {factory}
                    </button>
                  );
                })}
                {!factoryOptions.length && !loadingFactories ? (
                  <div className="planner-data-text rounded-2xl border border-outline-variant/20 bg-surface-container-low/35 px-4 py-3 text-sm text-on-surface-variant">
                    {t("noAccessibleFactories")}
                  </div>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("date")}</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPagesByFactory({});
                }}
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
              <p className="planner-data-text mt-2 text-xs text-on-surface-variant">{t("dateFieldDescription")}</p>
            </label>
          </div>

          <AdvancedFilterSection
            rows={advancedRows}
            fieldDefinitions={advancedFieldDefinitions}
            onUpdateRow={handleUpdateAdvancedRow}
            onAddRow={() => setAdvancedRows((current) => [...current, createFactoryStatusAdvancedFilterRow()])}
            onRemoveRow={handleRemoveAdvancedRow}
            onClearRows={handleClearAdvancedFilters}
            operatorLabels={FACTORY_STATUS_OPERATOR_LABELS}
            useOperatorLabelsInSelect
            title={t("advancedFilters")}
            activeSummaryDescription={t("advancedFiltersDescription")}
            variant="compact"
            framed
            enableTextSuggestions
            inputIdPrefix="factory-status-filter-options"
            footer={(
              <>
                <button
                  type="button"
                  onClick={handleApplyAdvancedFilters}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
                  Apply Advanced Filters
                </button>

                <button
                  type="button"
                  onClick={handleClearAdvancedFilters}
                  className="flex items-center gap-2 rounded-xl border border-outline-variant/20 px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                  Reset Advanced Filters
                </button>
              </>
            )}
          />
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            icon="flag"
            label={t("goal")}
            value={formatFactoryStatusNumber(summary.totalGoalQuantity)}
            subtitle={t("selectedFactories")}
            accent="bg-primary/10 text-primary"
            loading={loadingSnapshot && !generatedAt}
          />
          <SummaryCard
            icon="precision_manufacturing"
            label={t("actual")}
            value={formatFactoryStatusNumber(summary.totalActualQuantity)}
            subtitle={t("todayFromPressDB")}
            accent="bg-sky-500/10 text-sky-600 dark:text-sky-300"
            loading={loadingSnapshot && !generatedAt}
          />
          <SummaryCard
            icon="trending_up"
            label={t("achievement")}
            value={`${summary.achievementRate.toLocaleString()}%`}
            subtitle={t("goalVsActual")}
            accent="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            loading={loadingSnapshot && !generatedAt}
          />
          <SummaryCard
            icon="play_circle"
            label={t("activeMachines")}
            value={formatFactoryStatusNumber(summary.activeMachines)}
            subtitle={t("liveSessionsInProgress")}
            accent="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            loading={loadingSnapshot && !generatedAt}
          />
          <SummaryCard
            icon="schedule"
            label={t("staleMachines")}
            value={formatFactoryStatusNumber(summary.staleMachines)}
            subtitle={t("activeButNotRecentlyUpdated")}
            accent="bg-amber-500/10 text-amber-700 dark:text-amber-300"
            loading={loadingSnapshot && !generatedAt}
          />
          <SummaryCard
            icon="pause_circle"
            label={t("idleMachines")}
            value={formatFactoryStatusNumber(summary.idleMachines)}
            subtitle={t("activeSessionsCount").replace("{count}", formatFactoryStatusNumber(summary.activeSessions))}
            accent="bg-surface-container text-on-surface-variant"
            loading={loadingSnapshot && !generatedAt}
          />
        </div>

        {!selectedFactories.length && !loadingFactories ? (
          <div className="glass-card rounded-2xl px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-on-surface">{t("chooseAtLeastOneFactory")}</h2>
            <p className="planner-data-text mt-2 text-sm text-on-surface-variant">{t("groupedMachineTablesAppearAfter")}</p>
          </div>
        ) : null}

        {groups.map((group) => (
          <div key={group.factory} className="mb-6">
            <div className="mb-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("factory")}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-on-surface">{group.factory}</h2>
                  <p className="planner-data-text mt-2 text-sm text-on-surface-variant">
                    {t("machinesMatchCurrentTableFilters").replace("{filtered}", formatFactoryStatusNumber(group.overview.filteredMachineCount)).replace("{total}", formatFactoryStatusNumber(group.overview.machineCount))}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openLogsPage({ factory: group.factory })}
                  className="planner-data-text rounded-2xl border border-outline-variant/20 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                >
                  Logs Page
                </button>
              </div>

              <div className="planner-data-text mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
                <span><span className="font-semibold text-on-surface">{t("goal")}</span> {formatFactoryStatusNumber(group.goal.totalTargetQuantity)}</span>
                <span><span className="font-semibold text-on-surface">{t("actual")}</span> {formatFactoryStatusNumber(group.overview.actualQuantity)}</span>
                <span><span className="font-semibold text-on-surface">{t("good") || "Good"}</span> {formatFactoryStatusNumber(group.overview.goodQuantity)}</span>
                <span><span className="font-semibold text-on-surface">{t("ng") || "NG"}</span> {formatFactoryStatusNumber(group.overview.ngQuantity)}</span>
                <span><span className="font-semibold text-on-surface">{t("progress")}</span> {group.overview.achievementRate.toLocaleString()}%</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(group.overview.achievementRate, 100)}%` }}
                />
              </div>

              <div className="planner-data-text mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
                <span><span className="font-semibold text-on-surface">{t("running")}</span> {formatFactoryStatusNumber(group.overview.activeMachines)}</span>
                <span><span className="font-semibold text-on-surface">{t("stale")}</span> {formatFactoryStatusNumber(group.overview.staleMachines)}</span>
                <span><span className="font-semibold text-on-surface">{t("idle")}</span> {formatFactoryStatusNumber(group.overview.idleMachines)}</span>
                <span><span className="font-semibold text-on-surface">{t("sessions")}</span> {formatFactoryStatusNumber(group.overview.activeSessions)}</span>
                <span><span className="font-semibold text-on-surface">{t("records")}</span> {formatFactoryStatusNumber(group.overview.recordCount)}</span>
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
                <span className="planner-data-text">{buildFactoryStatusPageInfo({ filteredCount, page, pageSize })}</span>
              )}
              emptyTitle={t("noMatchingMachines")}
              emptyMessage={t("adjustAdvancedFilters")}
              layoutStorageKey="factory-status-table-layout"
              enableColumnResize
              enableColumnReorder
              tableClassName="ui-table-data min-w-full border-separate border-spacing-0"
              className="glass-card overflow-hidden rounded-[28px]"
              topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
              bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
              rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
            />
          </div>
        ))}

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
    </section>
  );
}