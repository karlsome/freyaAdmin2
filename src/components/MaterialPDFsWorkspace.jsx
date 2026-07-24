import { useDeferredValue, useEffect, useState } from "react";
import {
  batchDeleteMaterialPDFs,
  checkExistingMaterialPDFs,
  deleteMaterialPDF,
  fetchMaterialPDFMaterials,
  fetchMaterialPDFsByType,
  fetchMaterialPDFTrash,
  permanentlyDeleteMaterialPDF,
  recoverMaterialPDF,
  uploadMaterialPDFFile,
  uploadMaterialPDFImage,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import {
  buildBulkMatch,
  buildSearchQuery,
  convertPdfFileToPreviewImage,
  DEFAULT_MATERIAL_PDF_TYPE,
  getMaterialPDFItemId,
  getMaterialPDFProcessOptions,
  getMaterialPDFTypeMeta,
  getMaterialRecordMap,
  getMaterialSelectionForProcess,
  parseSearchTokens,
  MATERIAL_PDF_TYPES,
  readFileAsDataUrl,
  sortMaterialRecords,
} from "../utils/materialPDFs";
import LiquidSegmentedControl from "./LiquidSegmentedControl";
import MaterialPDFBulkMatchModal from "./MaterialPDFBulkMatchModal";
import MaterialPDFConflictModal from "./MaterialPDFConflictModal";
import MaterialPDFList from "./MaterialPDFList";
import MaterialPDFPreviewModal from "./MaterialPDFPreviewModal";
import MaterialPDFMaterialSelectorModal from "./MaterialPDFMaterialSelectorModal";
import MaterialPDFTrashModal from "./MaterialPDFTrashModal";
import MaterialPDFUploadPanel from "./MaterialPDFUploadPanel";

function assertApiSuccess(result, fallbackMessage) {
  if (result?.success === false) {
    throw new Error(result?.error || fallbackMessage);
  }

  return result;
}

function getReturnedDocumentId(result) {
  return result?.documentId?.$oid || result?.documentId || result?.insertedId?.$oid || result?.insertedId || result?._id?.$oid || result?._id || "";
}

export default function MaterialPDFsWorkspace({ refreshToken = 0, onFlash }) {
  const [activeType, setActiveType] = useState(DEFAULT_MATERIAL_PDF_TYPE);
  const [materials, setMaterials] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState("grid");
  const [sort, setSort] = useState({ column: "uploadedAt", direction: -1 });
  const [searchTokens, setSearchTokens] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [uploadExpanded, setUploadExpanded] = useState(false);
  const [filterType, setFilterType] = useState("process");
  const [selectedProcess, setSelectedProcess] = useState("");
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState([]);
  const [singleFile, setSingleFile] = useState(null);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [singleUploading, setSingleUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const [bulkMatchState, setBulkMatchState] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashItems, setTrashItems] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState("");
  const [trashPage, setTrashPage] = useState(1);
  const [trashPageSize, setTrashPageSize] = useState(25);
  const [trashTotalPages, setTrashTotalPages] = useState(1);
  const [trashTotalCount, setTrashTotalCount] = useState(0);
  const [trashBusy, setTrashBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const deferredSearchInput = useDeferredValue(searchInput);
  const activeTypeMeta = getMaterialPDFTypeMeta(activeType);
  const processOptions = getMaterialPDFProcessOptions(materials);
  const materialMap = getMaterialRecordMap(materials);
  const currentLinkedMaterials = new Set(
    items.flatMap((item) => (Array.isArray(item?.図番Array) ? item.図番Array : [])).filter(Boolean)
  ).size;

  function publishFlash(type, message) {
    if (typeof onFlash === "function") {
      onFlash({ type, message });
    }
  }

  function refreshLists() {
    setRefreshNonce((current) => current + 1);
  }

  async function uploadPreparedFile(file, drawingNumbers, resolutions = {}, excludedMaterialIds = []) {
    const authUser = getAuthUser();
    const [pdfBase64, imageBase64] = await Promise.all([
      readFileAsDataUrl(file),
      convertPdfFileToPreviewImage(file),
    ]);
    const uploadResult = assertApiSuccess(
      await uploadMaterialPDFFile({
        pdfType: activeType,
        drawingNumbers,
        pdfBase64,
        fileName: file.name,
        uploadedBy: authUser.username || "admin",
        resolutions,
        excludedMaterialIds,
      }),
      "Upload failed."
    );
    const documentId = getReturnedDocumentId(uploadResult);

    if (!documentId) {
      throw new Error("Upload completed but no document ID was returned.");
    }

    assertApiSuccess(
      await uploadMaterialPDFImage({ documentId, imageBase64, pdfType: activeType }),
      "Preview image upload failed."
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMaterials() {
      try {
        const nextMaterials = await fetchMaterialPDFMaterials();
        if (cancelled) return;
        setMaterials(sortMaterialRecords(nextMaterials));
      } catch (loadError) {
        if (cancelled) return;
        publishFlash("error", loadError.message || "Failed to load material metadata for PDF linking.");
      }
    }

    loadMaterials();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTypeMeta.comingSoon) {
      setItems([]);
      setTotalCount(0);
      setTotalPages(1);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchMaterialPDFsByType({
          pdfType: activeType,
          page,
          limit: pageSize,
          searchQuery: buildSearchQuery(searchTokens, deferredSearchInput),
          process: processFilter,
          sortField: sort.column,
          sortDir: sort.direction === 1 ? "asc" : "desc",
          includeHinban: true,
        });

        if (cancelled) return;
        setItems(Array.isArray(result.items) ? result.items : []);
        setTotalCount(Number(result.total) || 0);
        setTotalPages(Number(result.totalPages) || 1);
      } catch (loadError) {
        if (cancelled) return;
        setItems([]);
        setTotalCount(0);
        setTotalPages(1);
        setError(loadError.message || "Failed to load material PDFs.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadItems();
    return () => {
      cancelled = true;
    };
  }, [
    activeType,
    activeTypeMeta.comingSoon,
    deferredSearchInput,
    processFilter,
    page,
    pageSize,
    refreshNonce,
    refreshToken,
    searchTokens,
    sort.column,
    sort.direction,
  ]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [items]);

  useEffect(() => {
    if (!trashOpen) return undefined;

    let cancelled = false;

    async function loadTrash() {
      setTrashLoading(true);
      setTrashError("");

      try {
        const result = await fetchMaterialPDFTrash({ page: trashPage, limit: trashPageSize });
        if (cancelled) return;
        setTrashItems(Array.isArray(result.items) ? result.items : []);
        setTrashTotalCount(Number(result.total) || 0);
        setTrashTotalPages(Number(result.totalPages) || 1);
      } catch (loadError) {
        if (cancelled) return;
        setTrashItems([]);
        setTrashTotalCount(0);
        setTrashTotalPages(1);
        setTrashError(loadError.message || "Failed to load deleted PDFs.");
      } finally {
        if (!cancelled) {
          setTrashLoading(false);
        }
      }
    }

    loadTrash();
    return () => {
      cancelled = true;
    };
  }, [trashOpen, trashPage, trashPageSize, refreshNonce]);

  function handleTypeChange(nextType) {
    setActiveType(nextType);
    setPage(1);
    setSelectedIds(new Set());
    setPreviewItem(null);
  }

  function handleSearchInputChange(nextValue) {
    setPage(1);
    setSearchInput(nextValue);
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const nextTokens = parseSearchTokens(searchInput);
      if (!nextTokens.length) return;

      setSearchTokens((current) => {
        const existing = new Set(current);
        nextTokens.forEach((token) => existing.add(token));
        return [...existing];
      });
      setSearchInput("");
      setPage(1);
      return;
    }

    if (event.key === "Backspace" && !searchInput && searchTokens.length) {
      setSearchTokens((current) => current.slice(0, -1));
      setPage(1);
    }
  }

  function handleRemoveSearchToken(token) {
    setSearchTokens((current) => current.filter((item) => item !== token));
    setPage(1);
  }

  function handleProcessFilterChange(nextProcess) {
    setProcessFilter(nextProcess);
    setPage(1);
  }

  function handleSort(column) {
    setPage(1);
    setSort((current) => (
      current.column === column
        ? { column, direction: current.direction * -1 }
        : { column, direction: 1 }
    ));
  }

  function handleToggleItemSelection(documentId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  function handleToggleSelectAll(checked) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(items.map((item) => getMaterialPDFItemId(item)).filter(Boolean)));
  }

  function handleFilterTypeChange(nextFilterType) {
    setFilterType(nextFilterType);
    setSelectedProcess("");
    setSelectedSerialNumbers([]);
  }

  function handleSelectedProcessChange(nextProcess) {
    setSelectedProcess(nextProcess);
    setSelectedSerialNumbers(getMaterialSelectionForProcess(materials, nextProcess));
  }

  function handleRemoveSelectedSerial(drawingNumber) {
    setSelectedSerialNumbers((current) => current.filter((item) => item !== drawingNumber));
  }

  async function handleDeleteItem(item) {
    const documentId = getMaterialPDFItemId(item);
    if (!documentId) {
      publishFlash("error", "This file is missing an ID and cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete ${item?.fileName || "this PDF"}?`)) return;

    try {
      assertApiSuccess(await deleteMaterialPDF(documentId), "Failed to delete PDF.");
      publishFlash("success", "PDF moved to trash.");
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || "Failed to delete the selected PDF.");
    }
  }

  async function handleDeleteSelected() {
    const documentIds = [...selectedIds].filter(Boolean);
    if (!documentIds.length) return;
    if (!window.confirm(`Delete ${documentIds.length} selected PDF file(s)?`)) return;

    try {
      assertApiSuccess(await batchDeleteMaterialPDFs(documentIds), "Batch delete failed.");
      publishFlash("success", `${documentIds.length} file(s) moved to trash.`);
      setSelectedIds(new Set());
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || "Failed to delete the selected files.");
    }
  }

  async function executeSingleUpload(file, drawingNumbers, resolutions = {}) {
    setSingleUploading(true);

    try {
      await uploadPreparedFile(file, drawingNumbers, resolutions);
      setSingleFile(null);
      setSelectedProcess("");
      setSelectedSerialNumbers([]);
      publishFlash("success", `${activeTypeMeta.label} PDF uploaded successfully.`);
      refreshLists();
    } catch (uploadError) {
      publishFlash("error", uploadError.message || "Failed to upload the PDF.");
    } finally {
      setSingleUploading(false);
    }
  }

  async function executeBulkUpload(assignments, resolutions = {}) {
    setBulkUploading(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const assignment of assignments) {
        const resolution = resolutions[assignment.drawingNumber];
        if (resolution === "skip") continue;

        try {
          await uploadPreparedFile(
            assignment.file,
            [assignment.drawingNumber],
            resolution ? { [assignment.drawingNumber]: resolution } : {},
            assignment.excludedMaterialIds || []
          );
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }

      setBulkFiles([]);
      if (!successCount && !failureCount) {
        publishFlash("warning", "Every matched material was skipped, so nothing was uploaded.");
      } else if (failureCount) {
        publishFlash("warning", `Bulk upload finished. Uploaded ${successCount}, failed ${failureCount}.`);
      } else {
        publishFlash("success", `Bulk upload finished. Uploaded ${successCount} file${successCount === 1 ? "" : "s"}.`);
      }
      refreshLists();
    } finally {
      setBulkUploading(false);
    }
  }

  async function handleUploadSingle() {
    if (!singleFile) {
      publishFlash("warning", "Select a PDF file before uploading.");
      return;
    }
    if (!selectedSerialNumbers.length) {
      publishFlash("warning", "Select at least one material before uploading.");
      return;
    }

    try {
      const conflicts = await checkExistingMaterialPDFs({ pdfType: activeType, drawingNumbers: selectedSerialNumbers });
      if (conflicts?.hasConflicts) {
        setConflictState({
          kind: "single",
          payload: { file: singleFile, drawingNumbers: selectedSerialNumbers },
          conflicts,
        });
        return;
      }

      await executeSingleUpload(singleFile, selectedSerialNumbers);
    } catch (checkError) {
      publishFlash("error", checkError.message || "Failed to validate existing PDFs before upload.");
    }
  }

  function handleReviewBulkUpload() {
    if (!bulkFiles.length) {
      publishFlash("warning", "Select one or more PDF files for bulk upload.");
      return;
    }

    const targetZubans = selectedSerialNumbers.length > 0 
      ? selectedSerialNumbers 
      : Array.from(materialMap.keys());

    setBulkMatchState(buildBulkMatch(bulkFiles, targetZubans));
  }

  async function handleConfirmBulkAssignments(assignments) {
    setBulkMatchState(null);

    if (!assignments.length) {
      publishFlash("warning", "No files were assigned to materials.");
      return;
    }

    try {
      const conflicts = await checkExistingMaterialPDFs({
        pdfType: activeType,
        drawingNumbers: assignments.map((assignment) => assignment.drawingNumber),
      });

      if (conflicts?.hasConflicts) {
        setConflictState({
          kind: "bulk",
          payload: { assignments },
          conflicts,
        });
        return;
      }

      await executeBulkUpload(assignments);
    } catch (checkError) {
      publishFlash("error", checkError.message || "Failed to validate existing PDFs for the bulk upload.");
    }
  }

  async function handleConfirmConflict(resolutions) {
    const nextState = conflictState;
    setConflictState(null);
    if (!nextState) return;

    if (nextState.kind === "single") {
      await executeSingleUpload(nextState.payload.file, nextState.payload.drawingNumbers, resolutions);
      return;
    }

    await executeBulkUpload(nextState.payload.assignments, resolutions);
  }

  async function handleRecoverTrashItem(item) {
    const documentId = getMaterialPDFItemId(item);
    if (!documentId || !window.confirm(`Recover ${item?.fileName || "this PDF"}?`)) return;

    setTrashBusy(true);
    try {
      assertApiSuccess(await recoverMaterialPDF(documentId), "Failed to recover PDF.");
      publishFlash("success", "PDF recovered successfully.");
      refreshLists();
    } catch (recoverError) {
      publishFlash("error", recoverError.message || "Failed to recover the PDF.");
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleDeleteTrashItem(item) {
    const documentId = getMaterialPDFItemId(item);
    if (!documentId) return;
    if (!window.confirm(`Permanently delete ${item?.fileName || "this PDF"}? This cannot be undone.`)) return;
    if (!window.confirm("Final confirmation: delete permanently?")) return;

    setTrashBusy(true);
    try {
      assertApiSuccess(await permanentlyDeleteMaterialPDF(documentId), "Permanent delete failed.");
      publishFlash("success", "PDF permanently deleted.");
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || "Failed to permanently delete the PDF.");
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleRecoverAllTrash() {
    if (!trashItems.length) return;
    if (!window.confirm(`Recover all ${trashItems.length} deleted file(s)?`)) return;

    setTrashBusy(true);
    try {
      for (const item of trashItems) {
        const documentId = getMaterialPDFItemId(item);
        if (!documentId) continue;
        assertApiSuccess(await recoverMaterialPDF(documentId), "Failed to recover one or more PDFs.");
      }
      publishFlash("success", `Recovered ${trashItems.length} file(s) from trash.`);
      refreshLists();
    } catch (recoverError) {
      publishFlash("error", recoverError.message || "Failed while recovering deleted PDFs.");
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleDeleteAllTrash() {
    if (!trashItems.length) return;
    if (!window.confirm(`Permanently delete all ${trashItems.length} item(s) in trash?`)) return;
    if (!window.confirm("Final confirmation: delete everything permanently?")) return;

    setTrashBusy(true);
    try {
      for (const item of trashItems) {
        const documentId = getMaterialPDFItemId(item);
        if (!documentId) continue;
        assertApiSuccess(await permanentlyDeleteMaterialPDF(documentId), "Failed to permanently delete one or more PDFs.");
      }
      publishFlash("success", `Permanently deleted ${trashItems.length} file(s) from trash.`);
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || "Failed while permanently deleting trashed PDFs.");
    } finally {
      setTrashBusy(false);
    }
  }

  const stats = [
    { label: "Total Files", value: totalCount, icon: "description", accent: "bg-primary/12 text-primary" },
    { label: "Visible Page", value: items.length, icon: "grid_view", accent: "bg-secondary/12 text-secondary" },
    { label: "Selected", value: selectedIds.size, icon: "task_alt", accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
    { label: "Linked Materials", value: currentLinkedMaterials, icon: "sell", accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  ];

  return (
    <div>
      <div className="glass-card rounded-3xl px-5 py-5 mb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">Document Library</div>
            <h3 className="mt-1 text-2xl font-semibold text-on-surface">作業条件表 (PSA) / その他1 / その他2</h3>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Manage material-linked PDFs by document type. Uploads preserve the legacy conflict checks, bulk filename matching, and trash/recovery workflow.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setTrashPage(1);
              setTrashOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-separator/40 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            Open Trash
          </button>
        </div>

        <div className="mt-5">
          <LiquidSegmentedControl
            items={MATERIAL_PDF_TYPES.map((type) => ({ key: type.key, label: type.label }))}
            activeKey={activeType}
            onChange={handleTypeChange}
          />
        </div>
      </div>

      {activeTypeMeta.comingSoon ? (
        <div className="glass-card rounded-3xl px-6 py-16 text-center mb-8">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: 56 }}>video_library</span>
          <h4 className="mt-4 text-xl font-semibold text-on-surface">{activeTypeMeta.label}</h4>
          <p className="mt-2 text-sm text-on-surface-variant">This legacy section is still marked as coming soon. The sub-tab is live in navigation, but uploads and browsing are not enabled yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            {stats.map((card) => (
              <div key={card.label} className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>
                      {card.icon}
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">{card.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-on-surface">{card.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <MaterialPDFUploadPanel
            typeMeta={activeTypeMeta}
            uploadExpanded={uploadExpanded}
            onToggleExpanded={() => setUploadExpanded((current) => !current)}
            filterType={filterType}
            onFilterTypeChange={handleFilterTypeChange}
            selectedProcess={selectedProcess}
            processOptions={processOptions}
            onSelectedProcessChange={handleSelectedProcessChange}
            selectedSerialNumbers={selectedSerialNumbers}
            materialMap={materialMap}
            onOpenMaterialSelector={() => setSelectorOpen(true)}
            onRemoveSelectedSerial={handleRemoveSelectedSerial}
            singleFile={singleFile}
            singleUploading={singleUploading}
            onSingleFileChange={setSingleFile}
            onClearSingleFile={() => setSingleFile(null)}
            onUploadSingle={handleUploadSingle}
            bulkFiles={bulkFiles}
            bulkUploading={bulkUploading}
            onBulkFilesChange={setBulkFiles}
            onClearBulkFiles={() => setBulkFiles([])}
            onReviewBulkUpload={handleReviewBulkUpload}
          />

          <MaterialPDFList
            typeMeta={activeTypeMeta}
            items={items}
            loading={loading}
            error={error}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchInput={searchInput}
            searchTokens={searchTokens}
            onSearchInputChange={handleSearchInputChange}
            onSearchKeyDown={handleSearchKeyDown}
            onRemoveSearchToken={handleRemoveSearchToken}
            processFilter={processFilter}
            processOptions={processOptions}
            onProcessFilterChange={handleProcessFilterChange}
            selectedIds={selectedIds}
            onToggleItemSelection={handleToggleItemSelection}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteSelected={handleDeleteSelected}
            onDeleteItem={handleDeleteItem}
            onPreviewItem={setPreviewItem}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              if (nextPage < 1 || nextPage > totalPages) return;
              setPage(nextPage);
            }}
            onPageSizeChange={(nextSize) => {
              setPage(1);
              setPageSize(nextSize);
            }}
            sort={sort}
            onSort={handleSort}
          />
        </>
      )}

      <MaterialPDFMaterialSelectorModal
        open={selectorOpen}
        materials={materials}
        filterType={filterType}
        selectedProcess={selectedProcess}
        selectedSerialNumbers={selectedSerialNumbers}
        onClose={() => setSelectorOpen(false)}
        onConfirm={(nextSelection) => {
          setSelectedSerialNumbers(nextSelection);
          setSelectorOpen(false);
        }}
      />

      <MaterialPDFConflictModal
        open={!!conflictState}
        conflicts={conflictState?.conflicts}
        onClose={() => setConflictState(null)}
        onConfirm={handleConfirmConflict}
      />

      <MaterialPDFBulkMatchModal
        open={!!bulkMatchState}
        matchData={bulkMatchState}
        selectedSerialNumbers={selectedSerialNumbers.length ? selectedSerialNumbers : Array.from(materialMap.keys())}
        materialMap={materialMap}
        onClose={() => setBulkMatchState(null)}
        onConfirm={handleConfirmBulkAssignments}
      />

      <MaterialPDFPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />

      <MaterialPDFTrashModal
        open={trashOpen}
        loading={trashLoading}
        error={trashError}
        items={trashItems}
        page={trashPage}
        pageSize={trashPageSize}
        totalCount={trashTotalCount}
        totalPages={trashTotalPages}
        actionBusy={trashBusy}
        onClose={() => setTrashOpen(false)}
        onPageChange={(nextPage) => {
          if (nextPage < 1 || nextPage > trashTotalPages) return;
          setTrashPage(nextPage);
        }}
        onPageSizeChange={(nextSize) => {
          setTrashPage(1);
          setTrashPageSize(nextSize);
        }}
        onRecover={handleRecoverTrashItem}
        onDeletePermanent={handleDeleteTrashItem}
        onRecoverAll={handleRecoverAllTrash}
        onDeleteAll={handleDeleteAllTrash}
      />
    </div>
  );
}