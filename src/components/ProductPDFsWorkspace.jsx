import { useDeferredValue, useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  batchDeleteProductPDFs,
  checkExistingProductPDFs,
  deleteProductPDF,
  fetchProductPDFProducts,
  fetchProductPDFsByType,
  fetchProductPDFTrash,
  permanentlyDeleteProductPDF,
  recoverProductPDF,
  uploadProductPDFFile,
  uploadProductPDFImage,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import {
  buildBulkMatch,
  buildSearchQuery,
  convertPdfFileToPreviewImage,
  DEFAULT_PRODUCT_PDF_TYPE,
  getProductPDFItemId,
  getProductPDFModelOptions,
  getProductPDFTypeMeta,
  getProductRecordMap,
  getProductSelectionForModel,
  parseSearchTokens,
  PRODUCT_PDF_TYPES,
  readFileAsDataUrl,
  sortProductRecords,
} from "../utils/productPDFs";
import LiquidSegmentedControl from "./LiquidSegmentedControl";
import ProductPDFBulkMatchModal from "./ProductPDFBulkMatchModal";
import ProductPDFConflictModal from "./ProductPDFConflictModal";
import ProductPDFList from "./ProductPDFList";
import ProductPDFPreviewModal from "./ProductPDFPreviewModal";
import ProductPDFProductSelectorModal from "./ProductPDFProductSelectorModal";
import ProductPDFTrashModal from "./ProductPDFTrashModal";
import ProductPDFUploadPanel from "./ProductPDFUploadPanel";

function assertApiSuccess(result, fallbackMessage) {
  if (result?.success === false) {
    throw new Error(result?.error || fallbackMessage);
  }

  return result;
}

function getReturnedDocumentId(result) {
  return result?.documentId?.$oid || result?.documentId || result?.insertedId?.$oid || result?.insertedId || result?._id?.$oid || result?._id || "";
}

export default function ProductPDFsWorkspace({ refreshToken = 0, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [activeType, setActiveType] = useState(DEFAULT_PRODUCT_PDF_TYPE);
  const [products, setProducts] = useState([]);
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
  const [modelFilter, setModelFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [uploadExpanded, setUploadExpanded] = useState(false);
  const [filterType, setFilterType] = useState("model");
  const [selectedModel, setSelectedModel] = useState("");
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
  const activeTypeMeta = getProductPDFTypeMeta(activeType);
  const modelOptions = getProductPDFModelOptions(products);
  const productMap = getProductRecordMap(products);
  const currentLinkedProducts = new Set(
    items.flatMap((item) => (Array.isArray(item?.背番号Array) ? item.背番号Array : [])).filter(Boolean)
  ).size;

  function publishFlash(type, message) {
    if (typeof onFlash === "function") {
      onFlash({ type, message });
    }
  }

  function refreshLists() {
    setRefreshNonce((current) => current + 1);
  }

  async function uploadPreparedFile(file, serialNumbers, resolutions = {}) {
    const authUser = getAuthUser();
    const [pdfBase64, imageBase64] = await Promise.all([
      readFileAsDataUrl(file),
      convertPdfFileToPreviewImage(file),
    ]);
    const uploadResult = assertApiSuccess(
      await uploadProductPDFFile({
        pdfType: activeType,
        serialNumbers,
        pdfBase64,
        fileName: file.name,
        uploadedBy: authUser.username || "admin",
        resolutions,
      }),
      isJa ? "アップロードに失敗しました。" : "Upload failed."
    );
    const documentId = getReturnedDocumentId(uploadResult);

    if (!documentId) {
      throw new Error(isJa ? "アップロードは完了しましたがドキュメントIDが返されませんでした。" : "Upload completed but no document ID was returned.");
    }

    assertApiSuccess(
      await uploadProductPDFImage({ documentId, imageBase64, pdfType: activeType }),
      isJa ? "プレビュー画像のアップロードに失敗しました。" : "Preview image upload failed."
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const nextProducts = await fetchProductPDFProducts();
        if (cancelled) return;
        setProducts(sortProductRecords(nextProducts));
      } catch (loadError) {
        if (cancelled) return;
        publishFlash("error", loadError.message || (isJa ? "PDF紐付け用製品メタデータの読み込みに失敗しました。" : "Failed to load product metadata for PDF linking."));
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [isJa]);

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
        const result = await fetchProductPDFsByType({
          pdfType: activeType,
          page,
          limit: pageSize,
          searchQuery: buildSearchQuery(searchTokens, deferredSearchInput),
          model: modelFilter,
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
        setError(loadError.message || (isJa ? "製品PDFの読み込みに失敗しました。" : "Failed to load product PDFs."));
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
    modelFilter,
    page,
    pageSize,
    refreshNonce,
    refreshToken,
    searchTokens,
    sort.column,
    sort.direction,
    isJa,
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
        const result = await fetchProductPDFTrash({ page: trashPage, limit: trashPageSize });
        if (cancelled) return;
        setTrashItems(Array.isArray(result.items) ? result.items : []);
        setTrashTotalCount(Number(result.total) || 0);
        setTrashTotalPages(Number(result.totalPages) || 1);
      } catch (loadError) {
        if (cancelled) return;
        setTrashItems([]);
        setTrashTotalCount(0);
        setTrashTotalPages(1);
        setTrashError(loadError.message || (isJa ? "ゴミ箱のPDFの読み込みに失敗しました。" : "Failed to load deleted PDFs."));
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
  }, [trashOpen, trashPage, trashPageSize, refreshNonce, isJa]);

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

  function handleModelFilterChange(nextModel) {
    setModelFilter(nextModel);
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

    setSelectedIds(new Set(items.map((item) => getProductPDFItemId(item)).filter(Boolean)));
  }

  function handleFilterTypeChange(nextFilterType) {
    setFilterType(nextFilterType);
    setSelectedModel("");
    setSelectedSerialNumbers([]);
  }

  function handleSelectedModelChange(nextModel) {
    setSelectedModel(nextModel);
    setSelectedSerialNumbers(getProductSelectionForModel(products, nextModel));
  }

  function handleRemoveSelectedSerial(serialNumber) {
    setSelectedSerialNumbers((current) => current.filter((item) => item !== serialNumber));
  }

  async function handleDeleteItem(item) {
    const documentId = getProductPDFItemId(item);
    if (!documentId) {
      publishFlash("error", isJa ? "このファイルにはIDがないため削除できません。" : "This file is missing an ID and cannot be deleted.");
      return;
    }
    const promptText = isJa ? `「${item?.fileName || "このPDF"}」を削除しますか？` : `Delete ${item?.fileName || "this PDF"}?`;
    if (!window.confirm(promptText)) return;

    try {
      assertApiSuccess(await deleteProductPDF(documentId), isJa ? "PDFの削除に失敗しました。" : "Failed to delete PDF.");
      publishFlash("success", isJa ? "PDFをゴミ箱に移動しました。" : "PDF moved to trash.");
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "選択したPDFの削除に失敗しました。" : "Failed to delete the selected PDF."));
    }
  }

  async function handleDeleteSelected() {
    const documentIds = [...selectedIds].filter(Boolean);
    if (!documentIds.length) return;
    const promptText = isJa
      ? `選択した ${documentIds.length} 件のPDFファイルを削除しますか？`
      : `Delete ${documentIds.length} selected PDF file(s)?`;
    if (!window.confirm(promptText)) return;

    try {
      assertApiSuccess(await batchDeleteProductPDFs(documentIds), isJa ? "一括削除に失敗しました。" : "Batch delete failed.");
      publishFlash("success", isJa ? `${documentIds.length} 件のファイルをゴミ箱に移動しました。` : `${documentIds.length} file(s) moved to trash.`);
      setSelectedIds(new Set());
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "選択したファイルの削除に失敗しました。" : "Failed to delete the selected files."));
    }
  }

  async function executeSingleUpload(file, serialNumbers, resolutions = {}) {
    setSingleUploading(true);

    try {
      await uploadPreparedFile(file, serialNumbers, resolutions);
      setSingleFile(null);
      setSelectedModel("");
      setSelectedSerialNumbers([]);
      publishFlash("success", isJa ? `${activeTypeMeta.label} PDFを正常にアップロードしました。` : `${activeTypeMeta.label} PDF uploaded successfully.`);
      refreshLists();
    } catch (uploadError) {
      publishFlash("error", uploadError.message || (isJa ? "PDFのアップロードに失敗しました。" : "Failed to upload the PDF."));
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
        const resolution = resolutions[assignment.serialNumber];
        if (resolution === "skip") continue;

        try {
          await uploadPreparedFile(
            assignment.file,
            [assignment.serialNumber],
            resolution ? { [assignment.serialNumber]: resolution } : {}
          );
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }

      setBulkFiles([]);
      if (!successCount && !failureCount) {
        publishFlash("warning", isJa ? "一致したすべての製品がスキップされたため、何もアップロードされませんでした。" : "Every matched product was skipped, so nothing was uploaded.");
      } else if (failureCount) {
        publishFlash("warning", isJa ? `一括アップロード完了: 成功 ${successCount} 件、失敗 ${failureCount} 件` : `Bulk upload finished. Uploaded ${successCount}, failed ${failureCount}.`);
      } else {
        publishFlash("success", isJa ? `一括アップロード完了: ${successCount} 件のファイルをアップロードしました。` : `Bulk upload finished. Uploaded ${successCount} file${successCount === 1 ? "" : "s"}.`);
      }
      refreshLists();
    } finally {
      setBulkUploading(false);
    }
  }

  async function handleUploadSingle() {
    if (!singleFile) {
      publishFlash("warning", isJa ? "アップロードするPDFファイルを選択してください。" : "Select a PDF file before uploading.");
      return;
    }
    if (!selectedSerialNumbers.length) {
      publishFlash("warning", isJa ? "アップロード前に対象製品を1つ以上選択してください。" : "Select at least one product before uploading.");
      return;
    }

    try {
      const conflicts = await checkExistingProductPDFs({ pdfType: activeType, serialNumbers: selectedSerialNumbers });
      if (conflicts?.hasConflicts) {
        setConflictState({
          kind: "single",
          payload: { file: singleFile, serialNumbers: selectedSerialNumbers },
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
    if (!selectedSerialNumbers.length) {
      publishFlash("warning", isJa ? "一括アップロード前に対象製品を1つ以上選択してください。" : "Select at least one product before bulk upload.");
      return;
    }

    setBulkMatchState(buildBulkMatch(bulkFiles, selectedSerialNumbers));
  }

  async function handleConfirmBulkAssignments(assignments) {
    setBulkMatchState(null);

    if (!assignments.length) {
      publishFlash("warning", isJa ? "製品に割り当てられたファイルがありません。" : "No files were assigned to products.");
      return;
    }

    try {
      const conflicts = await checkExistingProductPDFs({
        pdfType: activeType,
        serialNumbers: assignments.map((assignment) => assignment.serialNumber),
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
      publishFlash("error", checkError.message || (isJa ? "一括アップロード前の既存PDF検証に失敗しました。" : "Failed to validate existing PDFs for the bulk upload."));
    }
  }

  async function handleConfirmConflict(resolutions) {
    const nextState = conflictState;
    setConflictState(null);
    if (!nextState) return;

    if (nextState.kind === "single") {
      await executeSingleUpload(nextState.payload.file, nextState.payload.serialNumbers, resolutions);
      return;
    }

    await executeBulkUpload(nextState.payload.assignments, resolutions);
  }

  async function handleRecoverTrashItem(item) {
    const documentId = getProductPDFItemId(item);
    const promptText = isJa ? `「${item?.fileName || "このPDF"}」を復元しますか？` : `Recover ${item?.fileName || "this PDF"}?`;
    if (!documentId || !window.confirm(promptText)) return;

    setTrashBusy(true);
    try {
      assertApiSuccess(await recoverProductPDF(documentId), isJa ? "PDFの復元に失敗しました。" : "Failed to recover PDF.");
      publishFlash("success", isJa ? "PDFを復元しました。" : "PDF recovered successfully.");
      refreshLists();
    } catch (recoverError) {
      publishFlash("error", recoverError.message || (isJa ? "PDFの復元に失敗しました。" : "Failed to recover the PDF."));
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleDeleteTrashItem(item) {
    const documentId = getProductPDFItemId(item);
    if (!documentId) return;
    const promptText1 = isJa ? `「${item?.fileName || "このPDF"}」を完全に削除しますか？ この操作は取り消せません。` : `Permanently delete ${item?.fileName || "this PDF"}? This cannot be undone.`;
    if (!window.confirm(promptText1)) return;
    const promptText2 = isJa ? "最終確認: 完全に削除しますか？" : "Final confirmation: delete permanently?";
    if (!window.confirm(promptText2)) return;

    setTrashBusy(true);
    try {
      assertApiSuccess(await permanentlyDeleteProductPDF(documentId), isJa ? "完全削除に失敗しました。" : "Permanent delete failed.");
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
    const promptText = isJa ? `ゴミ箱の ${trashItems.length} 件のファイルをすべて復元しますか？` : `Recover all ${trashItems.length} deleted file(s)?`;
    if (!window.confirm(promptText)) return;

    setTrashBusy(true);
    try {
      for (const item of trashItems) {
        const documentId = getProductPDFItemId(item);
        if (!documentId) continue;
        assertApiSuccess(await recoverProductPDF(documentId), isJa ? "一部のPDFの復元に失敗しました。" : "Failed to recover one or more PDFs.");
      }
      publishFlash("success", isJa ? `ゴミ箱から ${trashItems.length} 件のファイルを復元しました。` : `Recovered ${trashItems.length} file(s) from trash.`);
      refreshLists();
    } catch (recoverError) {
      publishFlash("error", recoverError.message || (isJa ? "削除済みPDFの復元中にエラーが発生しました。" : "Failed while recovering deleted PDFs."));
    } finally {
      setTrashBusy(false);
    }
  }

  async function handleDeleteAllTrash() {
    if (!trashItems.length) return;
    const promptText1 = isJa ? `ゴミ箱の ${trashItems.length} 件のファイルをすべて完全に削除しますか？` : `Permanently delete all ${trashItems.length} item(s) in trash?`;
    if (!window.confirm(promptText1)) return;
    const promptText2 = isJa ? "最終確認: ゴミ箱の全ファイルを完全に削除しますか？" : "Final confirmation: delete everything permanently?";
    if (!window.confirm(promptText2)) return;

    setTrashBusy(true);
    try {
      for (const item of trashItems) {
        const documentId = getProductPDFItemId(item);
        if (!documentId) continue;
        assertApiSuccess(await permanentlyDeleteProductPDF(documentId), isJa ? "一部のPDFの完全削除に失敗しました。" : "Failed to permanently delete one or more PDFs.");
      }
      publishFlash("success", isJa ? `ゴミ箱から ${trashItems.length} 件のファイルを完全に削除しました。` : `Permanently deleted ${trashItems.length} file(s) from trash.`);
      refreshLists();
    } catch (deleteError) {
      publishFlash("error", deleteError.message || (isJa ? "ゴミ箱のPDFの完全削除中にエラーが発生しました。" : "Failed while permanently deleting trashed PDFs."));
    } finally {
      setTrashBusy(false);
    }
  }

  const stats = [
    { label: isJa ? "総ファイル数" : "Total Files", value: totalCount, icon: "description", accent: "bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]" },
    { label: isJa ? "表示件数" : "Visible Page", value: items.length, icon: "grid_view", accent: "bg-[var(--surface-hover)] text-[var(--text-secondary)]" },
    { label: isJa ? "選択中" : "Selected", value: selectedIds.size, icon: "task_alt", accent: "bg-[var(--status-success)]/10 text-[var(--status-success)]" },
    { label: isJa ? "紐付き製品" : "Linked Products", value: currentLinkedProducts, icon: "sell", accent: "bg-[var(--status-warning)]/10 text-[var(--status-warning)]" },
  ];

  return (
    <div>
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {isJa ? "文書ライブラリ" : "Document Library"}
            </div>
            <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">梱包 / 検査基準 / 3点照合</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-2xl">
              {isJa
                ? "文書種別ごとに製品紐付きPDFを管理します。重複チェック、ファイル名の一括自動マッチング、ゴミ箱・復元機能に対応しています。"
                : "Manage product-linked PDFs by document type. Uploads preserve the legacy conflict checks, bulk filename matching, and trash/recovery workflow."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setTrashPage(1);
              setTrashOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            {isJa ? "ゴミ箱を開く" : "Open Trash"}
          </button>
        </div>

        <div className="mt-5">
          <LiquidSegmentedControl
            items={PRODUCT_PDF_TYPES.map((type) => ({ key: type.key, label: type.label }))}
            activeKey={activeType}
            onChange={handleTypeChange}
          />
        </div>
      </div>

      {activeTypeMeta.comingSoon ? (
        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center mb-6">
          <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 48 }}>video_library</span>
          <h4 className="mt-3 text-lg font-bold text-[var(--text-primary)]">{activeTypeMeta.label}</h4>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            {isJa
              ? "このセクションは準備中です。タブの切り替えは可能ですが、アップロードや閲覧はまだ有効化されていません。"
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

          <ProductPDFUploadPanel
            typeMeta={activeTypeMeta}
            uploadExpanded={uploadExpanded}
            onToggleExpanded={() => setUploadExpanded((current) => !current)}
            filterType={filterType}
            onFilterTypeChange={handleFilterTypeChange}
            selectedModel={selectedModel}
            modelOptions={modelOptions}
            onSelectedModelChange={handleSelectedModelChange}
            selectedSerialNumbers={selectedSerialNumbers}
            productMap={productMap}
            onOpenProductSelector={() => setSelectorOpen(true)}
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

          <ProductPDFList
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
            modelFilter={modelFilter}
            modelOptions={modelOptions}
            onModelFilterChange={handleModelFilterChange}
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

      <ProductPDFProductSelectorModal
        open={selectorOpen}
        products={products}
        filterType={filterType}
        selectedModel={selectedModel}
        selectedSerialNumbers={selectedSerialNumbers}
        onClose={() => setSelectorOpen(false)}
        onConfirm={(nextSelection) => {
          setSelectedSerialNumbers(nextSelection);
          setSelectorOpen(false);
        }}
      />

      <ProductPDFConflictModal
        open={!!conflictState}
        conflicts={conflictState?.conflicts}
        onClose={() => setConflictState(null)}
        onConfirm={handleConfirmConflict}
      />

      <ProductPDFBulkMatchModal
        open={!!bulkMatchState}
        matchData={bulkMatchState}
        selectedSerialNumbers={selectedSerialNumbers}
        onClose={() => setBulkMatchState(null)}
        onConfirm={handleConfirmBulkAssignments}
      />

      <ProductPDFPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />

      <ProductPDFTrashModal
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