import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMasterDistinctField,
  fetchMasterFilterOptions,
  fetchMasterPage,
  fetchMasterSchema,
  fetchSetsubiDBRecords,
  uploadPceFiles,
} from "../services/api";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  buildMasterAdvancedQuery,
  buildMasterFieldDefinitions,
  createMasterFilterRow,
  cleanMasterRecords,
  formatMasterValue,
  getMasterTabUI,
  getMasterTableColumns,
} from "../utils/masterDB";
import DataTable from "./DataTable";
import MasterFilterPanel from "./MasterFilterPanel";
import PceFilesConflictModal from "./PceFilesConflictModal";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function StepBadge({ n, active, done }) {
  const base = "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold";
  if (done) return <span className={`${base} bg-emerald-500 text-white`}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span></span>;
  if (active) return <span className={`${base} bg-primary text-on-primary`}>{n}</span>;
  return <span className={`${base} bg-surface-container text-on-surface-variant`}>{n}</span>;
}

function PanelHeader({ step, active, done, title, sub }) {
  return (
    <div className="border-b border-separator/40 px-4 py-4 flex items-center gap-2.5">
      <StepBadge n={step} active={active} done={done} />
      <div>
        <h3 className="text-xs font-semibold text-on-surface">{title}</h3>
        {sub && <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

export default function PceFilesWorkspace({ onFlash }) {
  // ── Step 1: file upload ─────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);

  // ── Step 2: 背番号 selection (same filtering/table data flow as 内装品 DB) ──
  const [masterRecords, setMasterRecords] = useState([]);
  const [schemaFields, setSchemaFields] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ factories: [], rl: [], colors: [], processes: [] });
  // process is a string representing the selected Equipment in the table filter
  const [simpleFilters, setSimpleFilters] = useState({ factory: "", rl: "", color: "", process: "" });
  const [topSimpleFilters, setTopSimpleFilters] = useState({ factory: "", rl: "", color: "", process: "" });
  const [searchTags, setSearchTags] = useState([]);
  const [searchLogicMode, setSearchLogicMode] = useState("OR");
  const [advancedRows, setAdvancedRows] = useState([createMasterFilterRow()]);
  const [advancedQuery, setAdvancedQuery] = useState({});
  const [sort, setSort] = useState({ column: null, direction: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState("");
  // Set of selected 背番号 codes
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const fieldDefinitions = useMemo(() => {
    return buildMasterFieldDefinitions(schemaFields, [], "masterDB");
  }, [schemaFields]);
  // Selected group keys driving filename generation (multi-select)
  const [selectedGroupKeys, setSelectedGroupKeys] = useState(new Set());
  const requestIdRef = useRef(0);
  const [conflictState, setConflictState] = useState(null);

  const distinctCacheRef = useRef(new Map());
  const loadDistinctOptions = useCallback(async (field) => {
    const cacheKey = `masterDB:${field}`;
    if (distinctCacheRef.current.has(cacheKey)) {
      return distinctCacheRef.current.get(cacheKey);
    }
    const values = await fetchMasterDistinctField(field, "masterDB");
    distinctCacheRef.current.set(cacheKey, values);
    return values;
  }, []);

  // Equipment records (for noOfHead / tableLength lookup, keyed by 加工設備 → name)
  const [setsubiList, setSetsubiList] = useState([]);

  const tabUI = getMasterTabUI("masterDB");

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const [nextSchema, nextFilters] = await Promise.all([
          fetchMasterSchema("masterDB"),
          fetchMasterFilterOptions("masterDB"),
        ]);
        if (cancelled) return;
        setSchemaFields(Array.isArray(nextSchema) ? nextSchema : []);
        setFilterOptions(nextFilters);
      } catch (err) {
        if (!cancelled) onFlash?.({ type: "error", message: err.message || "Failed to load filter metadata." });
      }
    }
    loadMeta();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;

    async function loadRecords() {
      setTableLoading(true);
      setTableError("");
      try {
        const result = await fetchMasterPage({
          tabKey: "masterDB",
          page,
          limit: pageSize,
          sort,
          simpleFilters,
          advancedFilters: advancedQuery,
          searchTags,
          searchLogicMode,
          searchFields: ["品番", "モデル", "背番号", "品名", "工場", "型番"],
        });

        if (cancelled || requestId !== requestIdRef.current) return;
        setMasterRecords(cleanMasterRecords(result.data));
        setFilteredCount(result.filteredCount);
        setTotalPages(result.totalPages);
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setTableError(err.message || "Failed to load master records.");
        setMasterRecords([]);
        setFilteredCount(0);
        setTotalPages(0);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) setTableLoading(false);
      }
    }

    loadRecords();
    return () => { cancelled = true; };
  }, [page, pageSize, sort, simpleFilters, advancedQuery, searchTags, searchLogicMode, schemaFields]);

  useEffect(() => {
    let cancelled = false;
    fetchSetsubiDBRecords()
      .then((records) => {
        if (cancelled) return;
        setSetsubiList(Array.isArray(records) ? records : []);
      })
      .catch((err) => { if (!cancelled) onFlash?.({ type: "error", message: err.message || "Failed to load equipment list." }); });
    return () => { cancelled = true; };
  }, []);

  function handleTopSimpleFilterChange(key, value) {
    setTopSimpleFilters((current) => (
      key === "factory" ? { ...current, factory: value, process: "" } : { ...current, [key]: value }
    ));
    if (key === "factory") {
      setSelectedGroupKeys(new Set());
      setUploadResults(null);
    }
  }

  function handleSimpleFilterChange(key, value) {
    setPage(1);
    setSimpleFilters((current) => (
      key === "factory" ? { ...current, factory: value, process: "" } : { ...current, [key]: value }
    ));
    if (key === "factory") {
      setSelectedRows(new Set());
    }
  }

  function handleAddSearchTag(tag) {
    setPage(1);
    setSearchTags((current) => [...current, tag]);
  }

  function handleRemoveSearchTag(tag) {
    setPage(1);
    setSearchTags((current) => current.filter((t) => t !== tag));
  }

  function handleClearSearchTags() {
    setPage(1);
    setSearchTags([]);
  }

  function handleSearchLogicModeChange(mode) {
    setPage(1);
    setSearchLogicMode(mode);
  }

  function handleUpdateAdvancedRow(rowId, updates) {
    setAdvancedRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
  }

  function handleAddAdvancedRow() {
    setAdvancedRows((current) => [...current, createMasterFilterRow()]);
  }

  function handleRemoveAdvancedRow(rowId) {
    setAdvancedRows((current) => current.filter((row) => row.id !== rowId));
  }

  function handleApplyAdvancedFilters() {
    setPage(1);
    const nextQuery = buildMasterAdvancedQuery(advancedRows, fieldDefinitions);
    setAdvancedQuery(nextQuery);
  }

  function handleClearAdvancedFilters() {
    setPage(1);
    setAdvancedRows([createMasterFilterRow()]);
    setAdvancedQuery({});
  }

  function handleToggleGroup(groupKey) {
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
    setUploadResults(null);
  }
  function handleSort(column) {
    setPage(1);
    setSort((current) => (current.column === column ? { column, direction: current.direction * -1 } : { column, direction: 1 }));
  }

  function toggleRowSelection(record) {
    const code = String(record?.背番号 || "").trim();
    if (!code) return;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setUploadResults(null);
  }

  // Equipment options for the selected factory (setsubiDB.name scoped by setsubiDB.工場), used to
  // populate the Equipment multi-select once a factory is chosen. Records that share both
  // noOfHead and tableLength are grouped under a text heading (e.g. "1 head 1200mm") with their
  // own checkboxes underneath; records missing either field fall into an unheaded group.
  const equipmentOptionsForFactory = useMemo(() => {
    const factory = String(topSimpleFilters.factory || "").trim();

    const groups = new Map();
    const ungroupedNames = new Set();

    setsubiList
      .filter((record) => !factory || String(record?.工場 || "").trim() === factory)
      .forEach((record) => {
        const name = String(record?.name || "").trim();
        if (!name) return;
        const heads = String(record?.noOfHead ?? "").trim();
        const length = String(record?.tableLength ?? "").trim();
        if (heads && length) {
          const key = `${heads}|${length}`;
          if (!groups.has(key)) {
            groups.set(key, {
              key,
              heading: `${heads} head${heads === "1" ? "" : "s"} ${length}mm`,
              heads: Number(heads) || 0,
              length: Number(length) || 0,
              names: new Set(),
            });
          }
          groups.get(key).names.add(name);
        } else {
          ungroupedNames.add(name);
        }
      });

    const groupedSections = [...groups.values()]
      .sort((a, b) => a.heads - b.heads || a.length - b.length)
      .map(({ key, heading, heads, length, names }) => ({
        key,
        heading,
        heads,
        length,
        options: [...names].sort((a, b) => a.localeCompare(b, "ja")).map((name) => ({ key: name, label: name })),
      }));

    const ungroupedSections = ungroupedNames.size
      ? [{
          key: "__ungrouped",
          heading: null,
          options: [...ungroupedNames].sort((a, b) => a.localeCompare(b, "ja")).map((name) => ({ key: name, label: name })),
        }]
      : [];

    return [...groupedSections, ...ungroupedSections];
  }, [setsubiList, topSimpleFilters.factory]);

  // For each selected 背番号, generate one preview entry for each chosen group configuration
  const previewEntries = useMemo(() => {
    if (!selectedRows.size || !selectedGroupKeys.size) return [];
    const entries = [];
    selectedGroupKeys.forEach((groupKey) => {
      const g = equipmentOptionsForFactory.find((g) => g.key === groupKey);
      if (!g) return;
      const headsStr = String(g.heads ?? "").trim();
      const lengthDigits = String(g.length ?? "").trim().slice(0, 2);
      const suffix = headsStr && lengthDigits ? `${headsStr}h_${lengthDigits}` : null;
      [...selectedRows].forEach((code) => {
        entries.push({
          code,
          suffix,
          fileName: suffix ? `${code}_${suffix}.pce` : null,
        });
      });
    });
    return entries;
  }, [selectedRows, selectedGroupKeys, equipmentOptionsForFactory]);

  const validPreviewEntries = useMemo(() => previewEntries.filter((entry) => entry.fileName), [previewEntries]);
  const invalidPreviewEntries = useMemo(() => previewEntries.filter((entry) => !entry.fileName), [previewEntries]);
  const previewFiles = validPreviewEntries.map((entry) => entry.fileName);

  const tableColumns = useMemo(() => {
    const selectColumn = {
      key: "__select",
      label: "",
      sortable: false,
      resizable: false,
      reorderable: false,
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      headerCellClassName: "px-3 py-2.5 text-left whitespace-nowrap",
      cellClassName: "px-3 py-2.5 align-top",
      disableCellWrapper: true,
      renderCell: (record) => {
        const code = String(record?.背番号 || "").trim();
        if (!code) return null;
        return (
          <input
            type="checkbox"
            checked={selectedRows.has(code)}
            onChange={() => toggleRowSelection(record)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
          />
        );
      },
    };

    const dataColumns = getMasterTableColumns(masterRecords, schemaFields, "masterDB")
      .filter((column) => column.key !== "型番" && column.key !== "imageURL")
      .map((column) => ({
        ...column,
        width: 168,
        minWidth: 120,
        headerCellClassName: "px-3 py-2.5 text-left whitespace-nowrap",
        headerButtonClassName: "ui-table-heading inline-flex items-center gap-2 uppercase tracking-wider text-on-surface-variant transition hover:text-on-surface",
        cellClassName: "px-3 py-2.5 align-top text-on-surface",
        contentClassName: "block w-full",
        getCellTitle: (record) => formatMasterValue(record[column.key]),
        renderCell: (record) => formatMasterValue(record[column.key]),
      }));

    return [selectColumn, ...dataColumns];
  }, [masterRecords, schemaFields, selectedRows]);

  function handleFileAccept(f) {
    if (!f.name.toLowerCase().endsWith(".pce")) {
      onFlash?.({ type: "error", message: "Only .pce files are accepted." });
      return;
    }
    setFile(f);
    setUploadResults(null);
  }

  async function handleUpload(resolutions = null) {
    if (!file || !validPreviewEntries.length) return;
    setUploading(true);
    
    let overwriteFiles = false;
    let base64 = null;
    
    if (resolutions) {
      overwriteFiles = Object.keys(resolutions).filter(f => resolutions[f] === "overwrite");
      base64 = conflictState.fileBase64;
      setConflictState(null);
    } else {
      setUploadResults(null);
      setConflictState(null);
      base64 = await toBase64(file);
    }

    try {
      const result = await uploadPceFiles({
        fileBase64: base64,
        entries: validPreviewEntries,
        overwrite: overwriteFiles,
      });
      setUploadResults(result.files);
      onFlash?.({ type: "success", message: `${result.files.length} file${result.files.length === 1 ? "" : "s"} created successfully and saved to Google Drive > freyaAdmin pce` });
    } catch (err) {
      if (err.isConflict) {
        setConflictState({ fileBase64: base64, conflicts: err.conflicts });
      } else {
        onFlash?.({ type: "error", message: err.message || "Upload failed." });
      }
    } finally {
      setUploading(false);
    }
  }

  function handleResolveConflict(resolutions) {
    if (!resolutions) {
      setConflictState(null);
      return;
    }
    handleUpload(resolutions);
  }

  function handleReset() {
    setSelectedRows(new Set());
    setSelectedGroupKeys(new Set());
    setFile(null);
    setUploadResults(null);
  }

  const step1Done = !!file;
  const step2Done = selectedRows.size > 0;
  const fileCount = previewFiles.length;
  const canUpload = step1Done && selectedRows.size > 0 && selectedGroupKeys.size > 0 && validPreviewEntries.length > 0 && !uploading;

  return (
    <div className="flex flex-col gap-4">
      {/* Row: Upload File + Filtering side by side (stretched to equal height) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">

        {/* Panel 1 — File upload */}
        <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col w-full lg:w-64 lg:flex-shrink-0">
          <PanelHeader step={1} active={!step1Done} done={step1Done} title="Upload File" sub={file ? file.name : "Drop or click to browse"} />
          <div className="px-3 py-4 flex flex-col gap-3 flex-1">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileAccept(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "h-24 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed cursor-pointer text-center transition-all duration-200 px-3",
                dragging ? "border-primary bg-primary/10"
                  : file ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5",
              ].join(" ")}
            >
              <span className={`material-symbols-outlined ${file ? "text-emerald-500" : "text-on-surface-variant/50"}`} style={{ fontSize: 24 }}>
                {file ? "check_circle" : "upload_file"}
              </span>
              {file ? (
                <>
                  <p className="text-xs font-semibold text-on-surface break-all leading-tight">{file.name}</p>
                  <p className="text-[11px] text-on-surface-variant">{(file.size / 1024).toFixed(1)} KB · <span className="text-primary">replace</span></p>
                </>
              ) : (
                <p className="text-xs text-on-surface-variant">.pce files only</p>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pce" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFileAccept(e.target.files[0]); }} />
            {file && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 14 }}>warning</span>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">Filename will be replaced</p>
              </div>
            )}
          </div>
        </div>

        {/* Filtering — same filter block as 内装品 DB, scoped to the 背番号 list below */}
        <div className="flex-1 min-w-0">
          <MasterFilterPanel
            simpleFilters={topSimpleFilters}
            filterOptions={filterOptions}
            onSimpleFilterChange={handleTopSimpleFilterChange}
            processLabel={tabUI.processFilterLabel}
            processAllLabel={tabUI.processAllLabel}
            optionsCacheKey="pceFilesMasterDB"
            showRL={false}
            showColor={false}
            showSearchTags={false}
            showAdvancedFilters={false}
            requireFactoryForEquipment={false}
            equipmentVariant="groupSelect"
            equipmentOptions={equipmentOptionsForFactory}
            selectedGroups={Array.from(selectedGroupKeys)}
            onToggleGroup={handleToggleGroup}
          />
        </div>

      </div>

      {/* Step 2 — 背番号 results: same table information as 内装品 DB */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col">
        <PanelHeader
          step={2}
          active={step1Done && !step2Done}
          done={step2Done}
          title="背番号"
          sub={step2Done ? `${selectedRows.size} row${selectedRows.size === 1 ? "" : "s"} selected` : "Filter the list and select 背番号 rows"}
        />
        <div className="px-4 py-4 flex flex-col gap-4">
          <MasterFilterPanel
            simpleFilters={simpleFilters}
            filterOptions={filterOptions}
            searchTags={searchTags}
            searchLogicMode={searchLogicMode}
            fieldDefinitions={fieldDefinitions}
            advancedRows={advancedRows}
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
            loadDistinctOptions={loadDistinctOptions}
            processLabel={tabUI.processFilterLabel}
            processAllLabel={tabUI.processAllLabel}
            optionsCacheKey="pceFilesMasterDB_table"
          />
          <DataTable
            columns={tableColumns}
            rows={masterRecords}
            loading={tableLoading}
            error={tableError}
            sort={sort}
            page={page}
            pageSize={pageSize}
            filteredCount={filteredCount}
            totalPages={totalPages}
            onSort={handleSort}
            onPageChange={(nextPage) => { if (nextPage < 1 || nextPage > totalPages) return; setPage(nextPage); }}
            onPageSizeChange={(nextPageSize) => { setPage(1); setPageSize(nextPageSize); }}
            pageSizeOptions={MASTER_PAGE_SIZE_OPTIONS}
            rowKey={(record, index) => `${record._id?.$oid || record._id || index}`}
            loadingMessage="Loading master records…"
            errorTitle="Could not load master records"
            emptyTitle="No matching records"
            emptyMessage="Adjust the filters, search tags, or advanced query and try again."
            enableColumnResize
            enableColumnReorder
            layoutStorageKey="freyaAdmin2.pceMasterTableLayout"
            stickyHeader
            stickyHeaderOffset={0}
            stickyHeaderCellClassName="bg-surface-container-high shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]"
            defaultColumnWidth={168}
            defaultMinColumnWidth={120}
            tableClassName="ui-table-data w-full border-separate border-spacing-0"
            tableViewportClassName="max-h-[60vh] overflow-auto"
            headClassName="bg-surface-container-high/40 border-b border-outline-variant/20"
            rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
          />
        </div>
      </div>

      {/* Step 3 — Preview */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col">
        <PanelHeader step={3} active={step2Done && !uploadResults} done={!!uploadResults} title="Preview" sub={uploadResults ? "Upload complete" : fileCount ? `${fileCount} file${fileCount === 1 ? "" : "s"} to create` : "Waiting for selections"} />
        <div className="px-4 py-4 flex flex-col gap-2">
          {uploadResults ? (
            <>
              <ul className="grid grid-flow-col grid-rows-5 auto-cols-[minmax(180px,1fr)] gap-1.5 overflow-x-auto pb-1">
                {uploadResults.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 min-w-0">
                    <span className="material-symbols-outlined text-emerald-500 flex-shrink-0" style={{ fontSize: 16 }}>check_circle</span>
                    <span className="font-mono text-xs font-semibold text-on-surface truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleReset}
                className="mt-2 self-start flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                New upload
              </button>
            </>
          ) : step2Done ? (
            <>
              <ul className="grid grid-flow-col grid-rows-5 auto-cols-[minmax(180px,1fr)] gap-1.5 overflow-x-auto pb-1 mb-2">
                {previewFiles.map((name) => (
                  <li key={name} className="flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container px-3 py-2 min-w-0">
                    <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 16 }}>description</span>
                    <span className="font-mono text-xs font-semibold text-on-surface truncate">{name}</span>
                  </li>
                ))}
              </ul>
              {invalidPreviewEntries.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 14 }}>warning</span>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                    {invalidPreviewEntries.length} configuration{invalidPreviewEntries.length === 1 ? "" : "s"} skipped — could not resolve head/length data
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleUpload()}
                disabled={!canUpload}
                className="self-start flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                {uploading
                  ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_upload</span>}
                {uploading ? "Creating…" : `Create ${fileCount} file${fileCount === 1 ? "" : "s"}`}
              </button>
            </>
          ) : (
            <p className="text-xs text-on-surface-variant text-center leading-relaxed py-4">
              Complete steps 1–2 to see a preview
            </p>
          )}
        </div>
      </div>
      <PceFilesConflictModal
        open={!!conflictState}
        conflicts={conflictState?.conflicts || []}
        onResolve={handleResolveConflict}
        onCancel={() => handleResolveConflict("cancel")}
      />
    </div>
  );
}
