import { useDeferredValue, useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
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
import UploadProgressModal from "./UploadProgressModal";

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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, isUploading: false });
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
        publishFlash("error", loadError.message || (isJa ? "PDF連携用の材料メタデータの取得に失敗しました。" : "Failed to load material metadata for PDF linking."));
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
        setError(loadError.message || (isJa ? "材料PDFの読み込みに失敗しました。" : "Failed to load material PDFs."));
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
        setTrashError(loadError.message || (isJa ? "削除済みPDFの読み込みに失敗しました。" : "Failed to load deleted PDFs."));
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
      publishFlash("error", isJa ? "このファイルにはIDがないため削除できません。" : "This file is missing an ID and cannot be deleted.");
      return;
    }
    if (!window.confirm(isJa ? `「${item?.fileName || "このPDF"}」を削除しますか？` : `Delete ${item?.fileName || "this PDF"}?`)) return;

    try {
      assertApiSuccess(await deleteMaterialPDF(documentId), isJa ? "PDFの削除に失敗しました。" : "Failed to delete PDF.");
      publishFlash("success", isJa ? "PDFをゴミ箱に移動しました。" : "PDF moved to trash.");
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "選択したPDFの削除に失敗しました。" : "Failed to delete the selected PDF."));
    }
  }

  async function handleDeleteSelected() {
    const documentIds = [...selectedIds].filter(Boolean);
    if (!documentIds.length) return;
    if (!window.confirm(isJa ? `選択された ${documentIds.length} 件のPDFファイルを削除しますか？` : `Delete ${documentIds.length} selected PDF file(s)?`)) return;

    try {
      assertApiSuccess(await batchDeleteMaterialPDFs(documentIds), isJa ? "一括削除に失敗しました。" : "Batch delete failed.");
      publishFlash("success", isJa ? `${documentIds.length} 件のファイルをゴミ箱に移動しました。` : `${documentIds.length} file(s) moved to trash.`);
      setSelectedIds(new Set());
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "選択したファイルの削除に失敗しました。" : "Failed to delete the selected files."));
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
    setUploadProgress({ current: 0, total: assignments.length, isUploading: true });
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
        
        setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      setBulkFiles([]);
      if (!successCount && !failureCount) {
        publishFlash("warning", isJa ? "一致したすべての材料がスキップされたため、何もアップロードされませんでした。" : "Every matched material was skipped, so nothing was uploaded.");
      } else if (failureCount) {
        publishFlash("warning", isJa ? `一括アップロード完了。成功: ${successCount} 件、失敗: ${failureCount} 件。` : `Bulk upload finished. Uploaded ${successCount}, failed ${failureCount}.`);
      } else {
        publishFlash("success", isJa ? `一括アップロード完了。${successCount} 件のファイルをアップロードしました。` : `Bulk upload finished. Uploaded ${successCount} file${successCount === 1 ? "" : "s"}.`);
      }
      refreshLists();
    } finally {
      setBulkUploading(false);
      setUploadProgress({ current: 0, total: 0, isUploading: false });
    }
  }

  async function handleUploadSingle() {
    if (!singleFile) {
      publishFlash("warning", isJa ? "アップロードするPDFファイルを選択してください。" : "Select a PDF file before uploading.");
      return;
    }
    if (!selectedSerialNumbers.length) {
      publishFlash("warning", isJa ? "アップロードする前に少なくとも1つの材料を選択してください。" : "Select at least one material before uploading.");
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
      publishFlash("error", checkError.message || (isJa ? "アップロード前の既存PDF検証に失敗しました。" : "Failed to validate existing PDFs before upload."));
    }
  }

  function handleReviewBulkUpload() {
    if (!bulkFiles.length) {
      publishFlash("warning", isJa ? "一括アップロード用のPDFファイルを1つ以上選択してください。" : "Select one or more PDF files for bulk upload.");
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
      publishFlash("warning", isJa ? "材料に割り当てられたファイルがありません。" : "No files were assigned to materials.");
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
      publishFlash("error", checkError.message || (isJa ? "一括アップロード用の既存PDF検証に失敗しました。" : "Failed to validate existing PDFs for the bulk upload."));
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
    if (!documentId || !window.confirm(isJa ? `「${item?.fileName || "このPDF"}」を復元しますか？` : `Recover ${item?.fileName || "this PDF"}?`)) return;

    setTrashBusy(true);
    try {
      assertApiSuccess(await recoverMaterialPDF(documentId), isJa ? "PDFの復元に失敗しました。" : "Failed to recover PDF.");
      publishFlash("success", isJa ? "PDFを正常に復元しました。" : "PDF recovered successfully.");
      refreshLists();
    } catch (recoverError) {
      publishFlash("error", recoverError.message || (isJa ? "PDFの復元に失敗しました。" : "Failed to recover the PDF."));
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleDeleteTrashItem(item) {
    const documentId = getMaterialPDFItemId(item);
    if (!documentId) return;
    if (!window.confirm(isJa ? `「${item?.fileName || "このPDF"}」を完全に削除しますか？この操作は取り消せません。` : `Permanently delete ${item?.fileName || "this PDF"}? This cannot be undone.`)) return;
    if (!window.confirm(isJa ? "最終確認: 完全に削除しますか？" : "Final confirmation: delete permanently?")) return;

    setTrashBusy(true);
    try {
      assertApiSuccess(await permanentlyDeleteMaterialPDF(documentId), isJa ? "完全削除に失敗しました。" : "Permanent delete failed.");
      publishFlash("success", isJa ? "PDFを完全に削除しました。" : "PDF permanently deleted.");
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "PDFの完全削除に失敗しました。" : "Failed to permanently delete the PDF."));
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleRecoverAllTrash() {
    if (!trashItems.length) return;
    if (!window.confirm(isJa ? `削除済みの ${trashItems.length} 件のファイルをすべて復元しますか？` : `Recover all ${trashItems.length} deleted file(s)?`)) return;

    setTrashBusy(true);
    try {
      for (const item of trashItems) {
        const documentId = getMaterialPDFItemId(item);
        if (!documentId) continue;
        assertApiSuccess(await recoverMaterialPDF(documentId), isJa ? "一部のPDFの復元に失敗しました。" : "Failed to recover one or more PDFs.");
      }
      publishFlash("success", isJa ? `ゴミ箱から ${trashItems.length} 件のファイルを復元しました。` : `Recovered ${trashItems.length} file(s) from trash.`);
      refreshLists();
    } catch (recoverError) {
      publishFlash("error", recoverError.message || (isJa ? "削除済みPDFの復元中に失敗しました。" : "Failed while recovering deleted PDFs."));
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleDeleteAllTrash() {
    if (!trashItems.length) return;
    if (!window.confirm(isJa ? `ゴミ箱内の全 ${trashItems.length} 件を完全に削除しますか？` : `Permanently delete all ${trashItems.length} item(s) in trash?`)) return;
    if (!window.confirm(isJa ? "最終確認: すべて完全に削除しますか？" : "Final confirmation: delete everything permanently?")) return;

    setTrashBusy(true);
    try {
      for (const item of trashItems) {
        const documentId = getMaterialPDFItemId(item);
        if (!documentId) continue;
        assertApiSuccess(await permanentlyDeleteMaterialPDF(documentId), isJa ? "一部のPDFの完全削除に失敗しました。" : "Failed to permanently delete one or more PDFs.");
      }
      publishFlash("success", isJa ? `ゴミ箱から ${trashItems.length} 件のファイルを完全に削除しました。` : `Permanently deleted ${trashItems.length} file(s) from trash.`);
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "ゴミ箱のPDFの完全削除中に失敗しました。" : "Failed while permanently deleting trashed PDFs."));
    } finally {
      setTrashBusy(false);
    }
  }

  const stats = [
    { label: isJa ? "合計ファイル数" : "Total Files", value: totalCount, icon: "description", accent: "bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]" },
    { label: isJa ? "表示中のページ" : "Visible Page", value: items.length, icon: "grid_view", accent: "bg-[var(--text-primary)]/10 text-[var(--text-primary)]" },
    { label: isJa ? "選択中" : "Selected", value: selectedIds.size, icon: "task_alt", accent: "bg-[var(--status-success)]/10 text-[var(--status-success)]" },
    { label: isJa ? "連携材料数" : "Linked Materials", value: currentLinkedMaterials, icon: "sell", accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div>
      <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {isJa ? "ドキュメントライブラリ" : "Document Library"}
            </div>
            <h3 className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">作業条件表 (PSA) / その他1 / その他2</h3>
            <p className="mt-1 max-w-2xl text-xs text-[var(--text-secondary)]">
              {isJa
                ? "文書タイプ別に材料連携PDFを管理します。従来の重複確認、ファイル名の一括照合、ゴミ箱・復元ワークフローに対応しています。"
                : "Manage material-linked PDFs by document type. Uploads preserve the legacy conflict checks, bulk filename matching, and trash/recovery workflow."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setTrashPage(1);
              setTrashOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            {isJa ? "ゴミ箱を開く" : "Open Trash"}
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
        <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 48 }}>video_library</span>
          <h4 className="mt-3 text-lg font-bold text-[var(--text-primary)]">{activeTypeMeta.label}</h4>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            {isJa
              ? "このレガシーセクションは準備中です。ナビゲーションのサブタブは有効ですが、アップロードや閲覧はまだ開始されていません。"
              : "This legacy section is still marked as coming soon. The sub-tab is live in navigation, but uploads and browsing are not enabled yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            {stats.map((card) => (
              <div key={card.label} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] ${card.accent}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                      {card.icon}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{card.label}</div>
                    <div className="mt-0.5 text-xl font-bold tracking-tight text-[var(--text-primary)]">{card.value}</div>
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