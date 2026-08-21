import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import MasterBatchEditModal from "../components/MasterBatchEditModal";
import MasterCsvImportCard from "../components/MasterCsvImportCard";
import MasterDetailDrawer from "../components/MasterDetailDrawer";
import MaterialDetailModal from "../components/MaterialDetailModal";
import MasterProductDetailModal from "../components/MasterProductDetailModal";
import MasterFilterPanel from "../components/MasterFilterPanel";
import PageHeader from "../components/PageHeader";
import MasterRecordModal from "../components/MasterRecordModal";
import MasterProductEditModal from "../components/MasterProductEditModal";
import MasterStatsStrip from "../components/MasterStatsStrip";
import MasterTable from "../components/MasterTable";
import MasterTabNav from "../components/MasterTabNav";
import {
  batchUpdateMasterRecords,
  createMasterRecord,
  fetchMasterDistinctField,
  fetchMasterFilterOptions,
  fetchMasterPage,
  fetchMasterRecordIds,
  fetchMasterSchema,
  getMasterCollectionConfig,
  updateMasterRecord,
  uploadMasterImage,
} from "../services/api";
import {
  MASTER_TABS,
  buildMasterAdvancedQuery,
  buildMasterFieldDefinitions,
  buildSearchFields,
  cleanMasterRecords,
  createMasterFilterRow,
  decodeMasterCsvBuffer,
  extractRecordId,
  getAuthUser,
  getMasterTabMeta,
  getMasterTabUI,
  getMasterTableColumns,
} from "../utils/masterDB";

const ProductPDFsWorkspace = lazy(() => import("../components/ProductPDFsWorkspace"));
const MaterialPDFsWorkspace = lazy(() => import("../components/MaterialPDFsWorkspace"));
const FuryoKanriWorkspace = lazy(() => import("../components/FuryoKanriWorkspace"));
const FactoryDBWorkspace = lazy(() => import("../components/FactoryDBWorkspace"));
const SetsubiDBWorkspace = lazy(() => import("../components/SetsubiDBWorkspace"));
const PceFilesWorkspace = lazy(() => import("../components/PceFilesWorkspace"));
const BomWorkspace = lazy(() => import("../components/BomWorkspace"));

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "bg-error/10 text-error border-error/20"
    : flash.type === "success"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";

  return (
    <div className={`mb-6 rounded-3xl border px-5 py-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">Status</div>
          <p className="mt-1 text-sm font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => {
      const payload = String(reader.result || "").split(",")[1];
      resolve(payload || "");
    };
    reader.readAsDataURL(file);
  });
}

export default function MasterDBPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const searchFromUrl = searchParams.get("search");

  const [activeTab, setActiveTab] = useState(() => {
    return tabFromUrl && MASTER_TABS.some((item) => item.key === tabFromUrl) ? tabFromUrl : "masterDB";
  });
  const [records, setRecords] = useState([]);
  const [schemaFields, setSchemaFields] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ factories: [], rl: [], colors: [], processes: [] });
  const [simpleFilters, setSimpleFilters] = useState({ factory: "", rl: "", color: "", process: "" });
  const [searchTags, setSearchTags] = useState([]);
  const [searchLogicMode, setSearchLogicMode] = useState("OR");
  const [advancedRows, setAdvancedRows] = useState([createMasterFilterRow()]);
  const [advancedQuery, setAdvancedQuery] = useState({});
  const [sort, setSort] = useState({ column: null, direction: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ totalCount: 0, filteredCount: 0, withImageCount: 0, withoutImageCount: 0 });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerUploading, setDrawerUploading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchPreparing, setBatchPreparing] = useState(false);
  const [batchRecordIds, setBatchRecordIds] = useState([]);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestIdRef = useRef(0);
  const distinctCacheRef = useRef(new Map());

  const activeTabMeta = getMasterTabMeta(activeTab);
  const activeTabUI = getMasterTabUI(activeTab);
  const isProductPDFTab = activeTab === "productPDFs";
  const isMaterialPDFTab = activeTab === "materialPDFs";
  const isFuryoKanriTab = activeTab === "furyoKanri";
  const isFactoryTab = activeTab === "factoryDB";
  const isSetsubiTab = activeTab === "setsubiDB";
  const isPceFilesTab = activeTab === "pceFiles";
  const isBomDBTab = activeTab === "bomDB";
  const isSpecialTab = isProductPDFTab || isMaterialPDFTab || isFuryoKanriTab || isFactoryTab || isSetsubiTab || isPceFilesTab || isBomDBTab;
  const fieldDefinitions = buildMasterFieldDefinitions(schemaFields, records, activeTab);
  const columns = getMasterTableColumns(records, schemaFields, activeTab);
  const batchEditEnabled = Object.keys(advancedQuery).length > 0 && stats.filteredCount > 0;

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let cancelled = false;

    if (isSpecialTab) {
      setSchemaFields([]);
      setFilterOptions({ factories: [], rl: [], colors: [], processes: [] });
      return undefined;
    }

    async function loadPageMeta() {
      try {
        const [nextSchema, nextFilters] = await Promise.all([
          fetchMasterSchema(activeTab),
          fetchMasterFilterOptions(activeTab),
        ]);

        if (cancelled) return;
        setSchemaFields(Array.isArray(nextSchema) ? nextSchema : []);
        setFilterOptions(nextFilters);
      } catch (loadError) {
        if (cancelled) return;
        setFlash({ type: "error", message: loadError.message || "Failed to load master page metadata." });
      }
    }

    loadPageMeta();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isSpecialTab]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;

    if (isSpecialTab) {
      setLoading(false);
      setError("");
      setRecords([]);
      setStats({ totalCount: 0, filteredCount: 0, withImageCount: 0, withoutImageCount: 0 });
      setTotalPages(0);
      return undefined;
    }

    async function loadRecords() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchMasterPage({
          tabKey: activeTab,
          page,
          limit: pageSize,
          sort,
          simpleFilters,
          advancedFilters: advancedQuery,
          searchTags,
          searchFields: buildSearchFields(buildMasterFieldDefinitions(schemaFields, [], activeTab), activeTab),
          searchLogicMode,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        const cleanedRecords = cleanMasterRecords(result.data);
        setRecords(cleanedRecords);
        setStats({
          totalCount: result.totalCount,
          filteredCount: result.filteredCount,
          withImageCount: result.withImageCount,
          withoutImageCount: Math.max(result.totalCount - result.withImageCount, 0),
        });
        setTotalPages(result.totalPages);
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError(loadError.message || "Failed to load master records.");
        setRecords([]);
        setStats({ totalCount: 0, filteredCount: 0, withImageCount: 0, withoutImageCount: 0 });
        setTotalPages(0);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [activeTab, page, pageSize, sort, simpleFilters, advancedQuery, searchTags, schemaFields, searchLogicMode, refreshNonce, isSpecialTab]);

  const loadDistinctOptions = useCallback(async (field) => {
    const cacheKey = `${activeTab}:${field}`;
    if (distinctCacheRef.current.has(cacheKey)) {
      return distinctCacheRef.current.get(cacheKey);
    }

    const values = await fetchMasterDistinctField(field, activeTab);
    distinctCacheRef.current.set(cacheKey, values);
    return values;
  }, [activeTab]);

  function resetFirstTabState(nextTab) {
    setActiveTab(nextTab);
    setSimpleFilters({ factory: "", rl: "", color: "", process: "" });
    setSearchTags([]);
    setSearchLogicMode("OR");
    setAdvancedRows([createMasterFilterRow()]);
    setAdvancedQuery({});
    setSort({ column: null, direction: 1 });
    setPage(1);
    setPageSize(25);
    setSelectedRecord(null);
    setAddModalOpen(false);
    setBatchModalOpen(false);
    setBatchRecordIds([]);
    setCsvFileName("");
    setCsvRows([]);
    distinctCacheRef.current.clear();
  }

  useEffect(() => {
    if (tabFromUrl && MASTER_TABS.some((item) => item.key === tabFromUrl)) {
      if (tabFromUrl !== activeTab) {
        resetFirstTabState(tabFromUrl);
      }
    }
  }, [tabFromUrl, activeTab]);

  function handleTabSelect(tab) {
    if (!tab.ready) {
      const liveTabs = MASTER_TABS.filter((item) => item.ready).map((item) => item.label).join(" / ");
      setFlash({ type: "warning", message: `${tab.label} is queued for the next migration pass. Live tabs: ${liveTabs}.` });
      return;
    }

    if (tab.key !== activeTab) {
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.set("tab", tab.key);
        next.delete("search");
        return next;
      });
      resetFirstTabState(tab.key);
    }
  }

  function handleSimpleFilterChange(key, value) {
    setPage(1);
    setSimpleFilters((current) => ({ ...current, [key]: value }));
  }

  function handleAddSearchTag(tag) {
    const trimmed = String(tag).trim();
    if (!trimmed || searchTags.includes(trimmed)) return;
    setPage(1);
    setSearchTags((current) => [...current, trimmed]);
  }

  function handleRemoveSearchTag(tag) {
    setPage(1);
    setSearchTags((current) => current.filter((item) => item !== tag));
  }

  function handleClearSearchTags() {
    setPage(1);
    setSearchTags([]);
  }

  function handleSearchLogicModeChange(mode) {
    setPage(1);
    setSearchLogicMode(mode);
  }

  function handleAddAdvancedRow() {
    setAdvancedRows((current) => [...current, createMasterFilterRow()]);
  }

  function handleUpdateAdvancedRow(rowId, patch) {
    setAdvancedRows((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      return { ...row, ...patch };
    }));
  }

  function handleRemoveAdvancedRow(rowId) {
    setAdvancedRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createMasterFilterRow()];
    });
  }

  function handleApplyAdvancedFilters() {
    const nextQuery = buildMasterAdvancedQuery(advancedRows, fieldDefinitions);
    setPage(1);
    setAdvancedQuery(nextQuery);
  }

  function handleClearAdvancedFilters() {
    setPage(1);
    setAdvancedRows([createMasterFilterRow()]);
    setAdvancedQuery({});
  }

  function handleSort(column) {
    setPage(1);
    setSort((current) => (
      current.column === column
        ? { column, direction: current.direction * -1 }
        : { column, direction: 1 }
    ));
  }

  function handleRefresh() {
    distinctCacheRef.current.clear();
    setRefreshNonce((current) => current + 1);
  }

  async function handleCsvFileSelect(file) {
    if (!file) {
      setCsvFileName("");
      setCsvRows([]);
      return;
    }

    setCsvParsing(true);
    setCsvFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const csvText = decodeMasterCsvBuffer(buffer);
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const parsedRows = cleanMasterRecords(Array.isArray(parsed.data) ? parsed.data : []);

      if (!parsedRows.length) {
        throw new Error("The selected CSV did not produce any rows.");
      }

      setCsvRows(parsedRows);
      setFlash({ type: "success", message: `${parsedRows.length} CSV rows parsed successfully.` });
    } catch (parseError) {
      setCsvRows([]);
      setFlash({ type: "error", message: parseError.message || "Failed to parse the selected CSV file." });
    } finally {
      setCsvParsing(false);
    }
  }

  async function handleCsvImport() {
    if (!csvRows.length) return;
    if (!window.confirm(`Insert ${csvRows.length} CSV records into ${activeTabMeta.label}?`)) return;

    setCsvImporting(true);
    const authUser = getAuthUser();
    let successCount = 0;
    let failCount = 0;

    for (const record of csvRows) {
      try {
        const result = await createMasterRecord({
          data: record,
          username: authUser.username,
          role: authUser.role,
          tabKey: activeTab,
        });

        if (result?.insertedId) successCount += 1;
        else failCount += 1;
      } catch {
        failCount += 1;
      }
    }

    setCsvImporting(false);
    setFlash({
      type: failCount ? "warning" : "success",
      message: `CSV import finished. Inserted ${successCount} record${successCount === 1 ? "" : "s"}, failed ${failCount}.`,
    });
    setCsvFileName("");
    setCsvRows([]);
    setRefreshNonce((current) => current + 1);
  }

  async function handleCreateRecord(draft, imageFile) {
    setAddSubmitting(true);

    try {
      const authUser = getAuthUser();
      const result = await createMasterRecord({
        data: draft,
        username: authUser.username,
        role: authUser.role,
        tabKey: activeTab,
      });

      if (!result?.insertedId) {
        throw new Error("Record creation did not return a new ID.");
      }

      if (imageFile) {
        const base64 = await toBase64(imageFile);
        await uploadMasterImage({
          base64,
          recordId: result.insertedId,
          username: authUser.username,
          tabKey: activeTab,
        });
      }

      setAddModalOpen(false);
      setFlash({ type: "success", message: "New master record created successfully." });
      setRefreshNonce((current) => current + 1);
    } catch (createError) {
      setFlash({ type: "error", message: createError.message || "Failed to create the new master record." });
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleSaveRecord(draft) {
    if (!selectedRecord) return;
    const recordId = extractRecordId(selectedRecord);
    if (!recordId) {
      setFlash({ type: "error", message: "This record is missing an ID and cannot be updated." });
      return;
    }

    setDrawerSaving(true);

    try {
      const authUser = getAuthUser();
      await updateMasterRecord({
        recordId,
        updates: draft,
        username: authUser.username,
        role: authUser.role,
        tabKey: activeTab,
      });

      setSelectedRecord(null);
      setFlash({ type: "success", message: "Master record updated successfully." });
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setFlash({ type: "error", message: saveError.message || "Failed to update the selected record." });
    } finally {
      setDrawerSaving(false);
    }
  }

  async function handleUploadImage(file) {
    if (!selectedRecord) return;
    const recordId = extractRecordId(selectedRecord);
    if (!recordId) {
      setFlash({ type: "error", message: "This record is missing an ID and cannot accept an image upload." });
      return;
    }

    setDrawerUploading(true);

    try {
      const authUser = getAuthUser();
      const base64 = await toBase64(file);
      const result = await uploadMasterImage({
        base64,
        recordId,
        username: authUser.username,
        tabKey: activeTab,
      });

      setSelectedRecord((current) => current ? { ...current, imageURL: result.imageURL } : current);
      setFlash({ type: "success", message: "Master image uploaded successfully." });
      setRefreshNonce((current) => current + 1);
    } catch (uploadError) {
      setFlash({ type: "error", message: uploadError.message || "Failed to upload the master image." });
    } finally {
      setDrawerUploading(false);
    }
  }

  async function handleOpenBatchEdit() {
    if (!batchEditEnabled) {
      setFlash({ type: "warning", message: "Apply at least one advanced filter before using batch edit." });
      return;
    }

    setBatchPreparing(true);

    try {
      const { baseQuery } = getMasterCollectionConfig(activeTab);
      const query = Object.keys(advancedQuery).length ? { $and: [baseQuery, advancedQuery] } : baseQuery;
      const ids = await fetchMasterRecordIds({ query, tabKey: activeTab });
      setBatchRecordIds(ids);
      setBatchModalOpen(true);
    } catch (batchError) {
      setFlash({ type: "error", message: batchError.message || "Failed to prepare the batch edit session." });
    } finally {
      setBatchPreparing(false);
    }
  }

  async function handleBatchSubmit(changes) {
    const entries = Object.entries(changes);
    if (!entries.length) return;

    if (!window.confirm(`Apply ${entries.length} change${entries.length === 1 ? "" : "s"} to ${stats.filteredCount} records?`)) {
      return;
    }

    setBatchSubmitting(true);

    try {
      const authUser = getAuthUser();
      const fallbackIds = records.map(extractRecordId).filter(Boolean);
      const recordIds = batchRecordIds.length ? batchRecordIds : fallbackIds;
      const result = await batchUpdateMasterRecords({
        recordIds,
        updates: changes,
        username: authUser.username,
        tabKey: activeTab,
      });

      setBatchModalOpen(false);
      setBatchRecordIds([]);
      setFlash({
        type: "success",
        message: `Batch edit completed. Updated ${result?.modifiedCount ?? recordIds.length} record${recordIds.length === 1 ? "" : "s"}.`,
      });
      setRefreshNonce((current) => current + 1);
    } catch (batchError) {
      setFlash({ type: "error", message: batchError.message || "Failed to update the filtered records." });
    } finally {
      setBatchSubmitting(false);
    }
  }

  return (
    <section className="pt-24 pb-16 px-4 md:px-8 overflow-y-auto h-screen scrollbar-hide">
      <PageHeader
        title="Master Product Management"
        className="mb-6 md:flex-row md:items-end md:justify-between"
        actionsClassName="self-start md:self-auto md:justify-end"
        actions={(
          <>
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-primary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              Refresh
            </button>

            {!isSpecialTab && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-all hover:opacity-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                Add New Record
              </button>
            )}
          </>
        )}
      />

      <FlashBanner flash={flash} onClose={() => setFlash(null)} />

      <MasterTabNav tabs={MASTER_TABS} activeTab={activeTab} onSelect={handleTabSelect} />

      {!isSpecialTab && batchPreparing && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface shadow-sm">
          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
          Preparing batch edit…
        </div>
      )}

      {isSpecialTab ? (
        <Suspense
          fallback={(
            <div className="dashboard-section rounded-2xl px-6 py-10 text-sm font-medium text-on-surface-variant">
              Loading workspace…
            </div>
          )}
        >
          {isProductPDFTab ? (
            <ProductPDFsWorkspace refreshToken={refreshNonce} onFlash={setFlash} />
          ) : isMaterialPDFTab ? (
            <MaterialPDFsWorkspace refreshToken={refreshNonce} onFlash={setFlash} />
          ) : isFuryoKanriTab ? (
            <FuryoKanriWorkspace refreshToken={refreshNonce} onFlash={setFlash} />
          ) : isFactoryTab ? (
            <FactoryDBWorkspace refreshToken={refreshNonce} onFlash={setFlash} />
          ) : isPceFilesTab ? (
            <PceFilesWorkspace onFlash={setFlash} />
          ) : isBomDBTab ? (
            <BomWorkspace initialSearch={searchFromUrl || ""} onFlash={setFlash} />
          ) : (
            <SetsubiDBWorkspace refreshToken={refreshNonce} />
          )}
        </Suspense>
      ) : (
        <>
          <MasterCsvImportCard
            fileName={csvFileName}
            parsedRows={csvRows}
            parsing={csvParsing}
            importing={csvImporting}
            onFileSelect={handleCsvFileSelect}
            onImport={handleCsvImport}
          />

          <MasterFilterPanel
            simpleFilters={simpleFilters}
            filterOptions={filterOptions}
            searchTags={searchTags}
            searchLogicMode={searchLogicMode}
            fieldDefinitions={fieldDefinitions}
            advancedRows={advancedRows}
            canBatchEdit={batchEditEnabled}
            batchCount={stats.filteredCount}
            onSimpleFilterChange={handleSimpleFilterChange}
            onAddSearchTag={handleAddSearchTag}
            onRemoveSearchTag={handleRemoveSearchTag}
            onClearSearchTags={handleClearSearchTags}
            onSearchLogicModeChange={handleSearchLogicModeChange}
            onUpdateAdvancedRow={handleUpdateAdvancedRow}
            onAddAdvancedRow={handleAddAdvancedRow}
            onRemoveAdvancedRow={handleRemoveAdvancedRow}
            onApplyAdvancedFilters={handleApplyAdvancedFilters}
            onClearAdvancedFilters={handleClearAdvancedFilters}
            onOpenBatchEdit={handleOpenBatchEdit}
            loadDistinctOptions={loadDistinctOptions}
            processLabel={activeTabUI.processFilterLabel}
            processAllLabel={activeTabUI.processAllLabel}
            optionsCacheKey={activeTab}
          />

          <MasterStatsStrip stats={stats} />

          <MasterTable
            columns={columns}
            records={records}
            loading={loading}
            error={error}
            sort={sort}
            page={page}
            pageSize={pageSize}
            filteredCount={stats.filteredCount}
            totalPages={totalPages}
            onSort={handleSort}
            onPageChange={(nextPage) => {
              if (nextPage < 1 || nextPage > totalPages) return;
              setPage(nextPage);
            }}
            onPageSizeChange={(nextPageSize) => {
              setPage(1);
              setPageSize(nextPageSize);
            }}
            onRowClick={(record) => setSelectedRecord(record)}
          />
        </>
      )}

      {!isSpecialTab && selectedRecord && (
        activeTab === "materialDB" ? (
          <MaterialDetailModal
            key={extractRecordId(selectedRecord) || selectedRecord?.['品番'] || "material-detail"}
            modalData={selectedRecord}
            onClose={() => setSelectedRecord(null)}
          />
        ) : (
          <MasterProductDetailModal
            key={extractRecordId(selectedRecord) || selectedRecord?.['品番'] || "product-detail"}
            open={!!selectedRecord}
            record={selectedRecord}
            saving={drawerSaving}
            uploading={drawerUploading}
            onClose={() => setSelectedRecord(null)}
            onSave={handleSaveRecord}
            onUploadImage={handleUploadImage}
          />
        )
      )}

      {!isSpecialTab && addModalOpen && (
        activeTab === "masterDB" ? (
          <MasterProductEditModal
            open={addModalOpen}
            isNew={true}
            submitting={addSubmitting}
            onClose={() => setAddModalOpen(false)}
            onSubmit={(draft) => handleCreateRecord(draft)}
          />
        ) : (
          <MasterRecordModal
            open={addModalOpen}
            fieldDefinitions={fieldDefinitions}
            tabLabel={activeTabMeta.label}
            recordLabel={activeTabUI.recordLabel}
            submitting={addSubmitting}
            onClose={() => setAddModalOpen(false)}
            onSubmit={handleCreateRecord}
          />
        )
      )}

      {!isSpecialTab && batchModalOpen && (
        <MasterBatchEditModal
          open={batchModalOpen}
          fieldDefinitions={fieldDefinitions}
          previewRecords={records}
          tabKey={activeTab}
          totalCount={stats.filteredCount}
          submitting={batchSubmitting}
          onClose={() => setBatchModalOpen(false)}
          onSubmit={handleBatchSubmit}
          loadDistinctOptions={loadDistinctOptions}
        />
      )}
    </section>
  );
  // comment
}