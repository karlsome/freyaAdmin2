import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMasterFilterOptions,
  fetchMasterPage,
  fetchMasterSchema,
  fetchSetsubiDBRecords,
  uploadPceFiles,
} from "../services/api";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  cleanMasterRecords,
  formatMasterValue,
  getMasterTabUI,
  getMasterTableColumns,
} from "../utils/masterDB";
import DataTable from "./DataTable";
import MasterFilterPanel from "./MasterFilterPanel";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function StepBadge({ n, active, done }) {
  const base = "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-black";
  if (done) return <span className={`${base} bg-emerald-500 text-white`}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span></span>;
  if (active) return <span className={`${base} bg-primary text-on-primary`}>{n}</span>;
  return <span className={`${base} bg-surface-container text-on-surface-variant`}>{n}</span>;
}

function PanelHeader({ step, active, done, title, sub }) {
  return (
    <div className="border-b border-separator/35 px-4 py-4 flex items-center gap-2.5">
      <StepBadge n={step} active={active} done={done} />
      <div>
        <h3 className="text-xs font-black text-on-surface">{title}</h3>
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
  // process is an array of selected 加工設備 names (multi-select, scoped to the chosen factory)
  const [simpleFilters, setSimpleFilters] = useState({ factory: "", process: [] });
  const [sort, setSort] = useState({ column: null, direction: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState("");
  // Map of 背番号 → that row's 加工設備 value, used to derive noOfHead/tableLength for the filename
  const [selectedRows, setSelectedRows] = useState(() => new Map());
  const requestIdRef = useRef(0);

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
  }, [page, pageSize, sort, simpleFilters, schemaFields]);

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

  function handleSimpleFilterChange(key, value) {
    setPage(1);
    setSimpleFilters((current) => (
      // changing the factory invalidates the previously selected equipment (it's scoped per-factory)
      key === "factory" ? { ...current, factory: value, process: [] } : { ...current, [key]: value }
    ));
  }
  function handleToggleEquipment(name) {
    setPage(1);
    setSimpleFilters((current) => {
      const list = Array.isArray(current.process) ? current.process : [];
      const next = list.includes(name) ? list.filter((item) => item !== name) : [...list, name];
      return { ...current, process: next };
    });
  }
  function handleSort(column) {
    setPage(1);
    setSort((current) => (current.column === column ? { column, direction: current.direction * -1 } : { column, direction: 1 }));
  }

  function toggleRowSelection(record) {
    const code = String(record?.背番号 || "").trim();
    if (!code) return;
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (next.has(code)) next.delete(code);
      else next.set(code, String(record?.加工設備 || "").trim());
      return next;
    });
    setUploadResults(null);
  }

  // setsubiDB equipment records keyed by name, so each row's 加工設備 value can resolve noOfHead/tableLength
  // (only records with both fields present can produce a usable filename suffix)
  const setsubiByName = useMemo(() => {
    const map = new Map();
    setsubiList.forEach((record) => {
      const name = String(record?.name || "").trim();
      const heads = String(record?.noOfHead ?? "").trim();
      const length = String(record?.tableLength ?? "").trim();
      if (name && heads && length) map.set(name, record);
    });
    return map;
  }, [setsubiList]);

  // Equipment names available for the selected factory (setsubiDB.name scoped by setsubiDB.工場),
  // used to populate the Equipment multi-select once a factory is chosen
  const equipmentOptionsForFactory = useMemo(() => {
    const factory = String(simpleFilters.factory || "").trim();
    if (!factory) return [];
    const names = setsubiList
      .filter((record) => String(record?.工場 || "").trim() === factory)
      .map((record) => String(record?.name || "").trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "ja"));
  }, [setsubiList, simpleFilters.factory]);

  const selectedCodesList = useMemo(
    () => [...selectedRows.keys()].sort((a, b) => a.localeCompare(b, "ja")),
    [selectedRows]
  );

  // For each selected 背番号, resolve its filename from that row's own 加工設備 value
  const previewEntries = useMemo(() => selectedCodesList.map((code) => {
    const equipment = selectedRows.get(code) || "";
    const machine = equipment ? setsubiByName.get(equipment) : null;
    let suffix = null;
    if (machine) {
      const heads = String(machine.noOfHead).trim();
      const lengthDigits = String(machine.tableLength).trim().slice(0, 2);
      if (heads && lengthDigits) suffix = `${heads}h_${lengthDigits}`;
    }
    return {
      code,
      equipment,
      suffix,
      fileName: suffix ? `${code}_${suffix}.pce` : null,
    };
  }), [selectedCodesList, selectedRows, setsubiByName]);

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

  async function handleUpload() {
    if (!file || !validPreviewEntries.length) return;
    setUploading(true);
    try {
      const fileBase64 = await toBase64(file);
      // Group by suffix so each upload call still sends a single machineSuffix, as the backend expects
      const groups = new Map();
      validPreviewEntries.forEach(({ code, suffix }) => {
        if (!groups.has(suffix)) groups.set(suffix, []);
        groups.get(suffix).push(code);
      });
      const allFiles = [];
      for (const [suffix, codes] of groups) {
        const result = await uploadPceFiles({ fileBase64, sebanggoList: codes, machineSuffix: suffix });
        allFiles.push(...result.files);
      }
      setUploadResults(allFiles);
      onFlash?.({ type: "success", message: `${allFiles.length} file${allFiles.length === 1 ? "" : "s"} created successfully and saved to Google Drive > freyaAdmin pce` });
    } catch (err) {
      onFlash?.({ type: "error", message: err.message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setSelectedRows(new Map());
    setFile(null);
    setUploadResults(null);
  }

  const step1Done = !!file;
  const step2Done = selectedCodesList.length > 0;
  const fileCount = previewFiles.length;
  const canUpload = step1Done && step2Done && validPreviewEntries.length > 0 && !uploading;

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
              <span className={`material-symbols-outlined ${file ? "text-emerald-500" : "text-on-surface-variant/50"}`} style={{ fontSize: 26 }}>
                {file ? "check_circle" : "upload_file"}
              </span>
              {file ? (
                <>
                  <p className="text-xs font-bold text-on-surface break-all leading-tight">{file.name}</p>
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
            simpleFilters={simpleFilters}
            filterOptions={filterOptions}
            onSimpleFilterChange={handleSimpleFilterChange}
            processLabel={tabUI.processFilterLabel}
            processAllLabel={tabUI.processAllLabel}
            optionsCacheKey="pceFilesMasterDB"
            showRL={false}
            showColor={false}
            showSearchTags={false}
            showAdvancedFilters={false}
            equipmentVariant="multiSelect"
            equipmentOptions={equipmentOptionsForFactory}
            selectedEquipment={Array.isArray(simpleFilters.process) ? simpleFilters.process : []}
            onToggleEquipment={handleToggleEquipment}
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
          sub={step2Done ? `${selectedCodesList.length} record${selectedCodesList.length === 1 ? "" : "s"} selected` : "Filter the list and check rows to select 背番号"}
        />
        <div className="px-4 py-4 flex flex-col gap-4">
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

      {/* Step 3 — Preview (filenames derive noOfHead/tableLength from each row's own 加工設備 value) */}
      <div className="dashboard-section rounded-2xl overflow-hidden flex flex-col">
        <PanelHeader step={3} active={step2Done && !uploadResults} done={!!uploadResults} title="Preview" sub={uploadResults ? "Upload complete" : fileCount ? `${fileCount} file${fileCount === 1 ? "" : "s"} to create` : "Waiting for selections"} />
        <div className="px-4 py-4 flex flex-col gap-2">
          {uploadResults ? (
            <>
              <ul className="grid grid-flow-col grid-rows-5 auto-cols-[minmax(180px,1fr)] gap-1.5 overflow-x-auto pb-1">
                {uploadResults.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 min-w-0">
                    <span className="material-symbols-outlined text-emerald-500 flex-shrink-0" style={{ fontSize: 15 }}>check_circle</span>
                    <span className="font-mono text-xs font-bold text-on-surface truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleReset}
                className="mt-2 self-start flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                New upload
              </button>
            </>
          ) : step2Done ? (
            <>
              <ul className="grid grid-flow-col grid-rows-5 auto-cols-[minmax(180px,1fr)] gap-1.5 overflow-x-auto pb-1 mb-2">
                {previewFiles.map((name) => (
                  <li key={name} className="flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container px-3 py-2 min-w-0">
                    <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 15 }}>description</span>
                    <span className="font-mono text-xs font-bold text-on-surface truncate">{name}</span>
                  </li>
                ))}
              </ul>
              {invalidPreviewEntries.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 14 }}>warning</span>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                    {invalidPreviewEntries.length} row{invalidPreviewEntries.length === 1 ? "" : "s"} skipped — no matching equipment record for{" "}
                    {invalidPreviewEntries.map((entry, index) => (
                      <span key={entry.code}>
                        {index > 0 && ", "}
                        <span className="font-mono font-bold">{entry.code}</span> ("{entry.equipment || "—"}")
                      </span>
                    ))}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
                className="self-start flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
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

    </div>
  );
}
