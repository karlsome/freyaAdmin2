import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchMasterPage } from "../../services/api";
import {
  deleteScnaNcProgram,
  fetchScnaNcProgramCounts,
  fetchScnaNcProgramPoints,
  fetchScnaNcPrograms,
  renameScnaNcProgram,
  uploadScnaNcProgram,
} from "../../services/scnaApi";
import { readStoredAuthUser } from "../../utils/auth";
import ScnaNcPreviewModal from "./ScnaNcPreviewModal";
import { parsePce } from "../../utils/pceParser";
import { parsePlt } from "../../utils/pltParser";

const PAGE_SIZE = 15;
const SEARCH_FIELDS = ["品番", "モデル", "背番号", "品名", "型番"];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export default function ScnaNcProgramsTab({ onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  // ── item list (masterDB, 工場: SCNA only) ──
  const [search, setSearch] = useState("");
  const [searchTags, setSearchTags] = useState([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ column: null, direction: 1 });
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false);
  const [counts, setCounts] = useState({});
  const requestIdRef = useRef(0);

  // ── selected item + its programs ──
  const [selected, setSelected] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  // ── upload form ──
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // ── preview modal: { title, subtitle, points|null, loading } ──
  const [previewModal, setPreviewModal] = useState(null);
  const previewRequestRef = useRef(0);

  // ── rename ──
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const loadCounts = useCallback(async () => {
    try {
      setCounts(await fetchScnaNcProgramCounts());
    } catch {
      setCounts({});
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoadingItems(true);
    fetchMasterPage({
      tabKey: "masterDB",
      page,
      limit: PAGE_SIZE,
      sort: sort.column && sort.column !== "nc" ? sort : { column: null, direction: 1 },
      // 工場 is hard-pinned to SCNA — this tab never lists any other factory
      simpleFilters: { factory: "SCNA" },
      searchTags,
      searchFields: SEARCH_FIELDS,
      searchLogicMode: "OR",
    })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setItems(result.data);
        setTotalPages(result.totalPages);
        setFilteredCount(result.filteredCount);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setItems([]);
        onFlash?.({ type: "error", message: err.message || "Failed to load SCNA items." });
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoadingItems(false);
      });
  }, [page, searchTags, sort, onFlash]);

  function handleSort(columnKey) {
    setPage(1);
    setSort((current) => (
      current.column === columnKey
        ? { column: columnKey, direction: current.direction === 1 ? -1 : 1 }
        : { column: columnKey, direction: 1 }
    ));
  }

  const displayedItems = useMemo(() => {
    if (sort.column === "nc") {
      return [...items].sort((a, b) => {
        const countA = counts[a.背番号] || 0;
        const countB = counts[b.背番号] || 0;
        if (countA !== countB) {
          return sort.direction === 1 ? countA - countB : countB - countA;
        }
        return String(a.背番号 || "").localeCompare(String(b.背番号 || ""));
      });
    }
    return items;
  }, [items, sort, counts]);

  const loadPrograms = useCallback(async (sebanggo) => {
    setLoadingPrograms(true);
    try {
      setPrograms(await fetchScnaNcPrograms(sebanggo));
    } catch (err) {
      setPrograms([]);
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setLoadingPrograms(false);
    }
  }, [onFlash]);

  async function handleOpenPreview(program) {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setPreviewModal({
      title: program.displayName,
      subtitle: `${program.fileName} · ${program.pointCount} ${isJa ? "ポイント" : "points"}`,
      points: null,
      loading: true,
    });
    try {
      const points = await fetchScnaNcProgramPoints(program._id);
      if (previewRequestRef.current !== requestId) return; // closed or replaced while loading
      setPreviewModal((m) => (m ? { ...m, points, loading: false } : m));
    } catch (err) {
      console.error(`[NC programs] Could not load preview for ${program._id}`, err);
      if (previewRequestRef.current !== requestId) return;
      setPreviewModal(null);
      onFlash?.({ type: "error", message: err.message });
    }
  }

  function handleOpenUploadPreview() {
    previewRequestRef.current += 1;
    setPreviewModal({
      title: displayName.trim() || file?.name || "",
      subtitle: `${file?.name || ""} · ${parsed.pointCount} ${isJa ? "ポイント" : "points"}`,
      points: parsed.points,
      loading: false,
    });
  }

  function closePreview() {
    previewRequestRef.current += 1;
    setPreviewModal(null);
  }

  function handleSelect(item) {
    setSelected(item);
    setRenamingId(null);
    closePreview();
    resetForm();
    loadPrograms(item.背番号);
  }

  function resetForm() {
    setFile(null);
    setParsed(null);
    setDisplayName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const term = search.trim();
    setPage(1);
    setSearchTags(term ? [term] : []);
  }

  async function handleFileChosen(f) {
    if (!f) return;
    const lowerName = f.name.toLowerCase();
    const isPce = lowerName.endsWith(".pce");
    if (!isPce && !lowerName.endsWith(".plt")) {
      onFlash?.({ type: "error", message: isJa ? ".plt / .pce ファイルのみ受け付け可能です。" : "Only .plt or .pce files are accepted." });
      resetForm();
      return;
    }
    try {
      const result = isPce ? parsePce(await f.arrayBuffer()) : parsePlt(await f.text());
      setFile(f);
      setParsed({ ...result, sourceType: isPce ? "pce" : "plt" });
      if (!displayName) setDisplayName(f.name.replace(/\.(plt|pce)$/i, ""));
    } catch (err) {
      console.error(`[NC programs] Could not read ${f.name}`, err);
      onFlash?.({ type: "error", message: `${f.name}: ${err.message}` });
      resetForm();
    }
  }

  async function handleUpload() {
    if (!selected || !file || !parsed || !displayName.trim()) return;
    setUploading(true);
    try {
      await uploadScnaNcProgram({
        sebanggo: selected.背番号,
        displayName: displayName.trim(),
        fileName: file.name,
        sourceType: parsed.sourceType,
        // the original file is kept as sent: PLT as before, PCE under its own field
        ...(parsed.sourceType === "pce"
          ? { pceBase64: await toBase64(file) }
          : { pltBase64: await toBase64(file) }),
        points: parsed.points,
        uploadedBy: readStoredAuthUser()?.username || "admin",
      });
      onFlash?.({
        type: "success",
        message: isJa
          ? `${selected.背番号} に「${displayName.trim()}」をアップロードしました（${parsed.pointCount} ポイント）`
          : `Uploaded "${displayName.trim()}" for ${selected.背番号} (${parsed.pointCount} points)`,
      });
      resetForm();
      await Promise.all([loadPrograms(selected.背番号), loadCounts()]);
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(program) {
    const name = renameValue.trim();
    if (!name || name === program.displayName) {
      setRenamingId(null);
      return;
    }
    try {
      await renameScnaNcProgram(program._id, name);
      setRenamingId(null);
      await loadPrograms(selected.背番号);
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    }
  }

  async function handleDelete(program) {
    const ok = window.confirm(
      isJa ? `「${program.displayName}」を削除しますか？` : `Delete "${program.displayName}"?`
    );
    if (!ok) return;
    try {
      await deleteScnaNcProgram(program._id);
      await Promise.all([loadPrograms(selected.背番号), loadCounts()]);
    } catch (err) {
      onFlash?.({ type: "error", message: err.message });
    }
  }

  const canUpload = Boolean(selected && file && parsed && displayName.trim()) && !uploading;
  const cell = "px-3 py-2 text-xs text-[var(--text-primary)]";
  const columns = [
    { key: "背番号", label: "背番号" },
    { key: "品番", label: "品番" },
    { key: "品名", label: isJa ? "品名" : "Name" },
    { key: "モデル", label: isJa ? "モデル" : "Model" },
    { key: "nc", label: "NC" },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Left: SCNA items */}
      <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
          <h3 className="text-xs font-bold text-[var(--text-primary)]">
            {isJa ? "SCNA 製品を選択" : "Select an SCNA item"}
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {isJa ? "工場: SCNA のみ表示されます" : "Only items with 工場: SCNA are listed"}
          </p>
        </div>
        <form onSubmit={handleSearchSubmit} className="flex gap-2 border-b border-[var(--border)] p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isJa ? "背番号・品番・モデルで検索" : "Search 背番号, 品番, model…"}
            className="flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
          />
          <button type="submit" className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white">
            {isJa ? "検索" : "Search"}
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
              <tr>
                {columns.map((col) => {
                  const isSorted = sort.column === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="group cursor-pointer select-none px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                      aria-sort={
                        isSorted
                          ? sort.direction === 1
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      title={
                        isSorted
                          ? isJa
                            ? sort.direction === 1
                              ? "昇順（クリックで降順）"
                              : "降順（クリックで昇順）"
                            : sort.direction === 1
                              ? "Ascending (click to sort descending)"
                              : "Descending (click to sort ascending)"
                          : isJa
                            ? "クリックして並び替え"
                            : "Click to sort"
                      }
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        <span
                          className={`material-symbols-outlined transition-colors ${
                            isSorted
                              ? "text-[var(--freya-blue)] opacity-100"
                              : "text-[var(--text-muted)] opacity-30 group-hover:opacity-80"
                          }`}
                          style={{ fontSize: 14 }}
                        >
                          {isSorted
                            ? sort.direction === 1
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loadingItems && (
                <tr><td colSpan={5} className={`${cell} text-[var(--text-muted)]`}>{isJa ? "読み込み中…" : "Loading…"}</td></tr>
              )}
              {!loadingItems && displayedItems.length === 0 && (
                <tr><td colSpan={5} className={`${cell} text-[var(--text-muted)]`}>{isJa ? "該当なし" : "No SCNA items found."}</td></tr>
              )}
              {!loadingItems && displayedItems.map((item) => {
                const active = selected?.背番号 === item.背番号;
                return (
                  <tr
                    key={item._id?.$oid || item._id || item.背番号}
                    onClick={() => handleSelect(item)}
                    className={`cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-subtle)] ${active ? "bg-[var(--surface-subtle)]" : ""}`}
                  >
                    <td className={`${cell} font-semibold`}>{item.背番号}</td>
                    <td className={cell}>{item.品番}</td>
                    <td className={cell}>{item.品名}</td>
                    <td className={cell}>{item.モデル}</td>
                    <td className={cell}>
                      {counts[item.背番号]
                        ? <span className="rounded-[6px] bg-[var(--freya-blue)]/10 px-2 py-0.5 font-semibold text-[var(--freya-blue)]">{counts[item.背番号]}</span>
                        : <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-[var(--text-secondary)]">
          <span>{filteredCount} {isJa ? "件" : "items"}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-[6px] border border-[var(--border)] px-2 py-1 disabled:opacity-40">‹</button>
            <span>{page} / {Math.max(totalPages, 1)}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-[6px] border border-[var(--border)] px-2 py-1 disabled:opacity-40">›</button>
          </div>
        </div>
      </div>

      {/* Right: programs for the selected item */}
      <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
          <h3 className="text-xs font-bold text-[var(--text-primary)]">
            {selected
              ? `${selected.背番号} — ${selected.品名 || selected.品番 || ""}`
              : (isJa ? "NC プログラム" : "NC programs")}
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {selected
              ? (isJa ? "タブレットにはここで付けた名前が表示されます" : "Tablet users see the names set here")
              : (isJa ? "左の一覧から製品を選択してください" : "Pick an item from the list on the left")}
          </p>
        </div>

        {selected && (
          <div className="space-y-5 p-4">
            {/* Upload */}
            <div className="space-y-3 rounded-[8px] border border-dashed border-[var(--border)] p-3">
              <p className="text-xs font-semibold text-[var(--text-primary)]">{isJa ? "PCE / PLT をアップロード" : "Upload a PCE or PLT"}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pce,.plt"
                onChange={(e) => handleFileChosen(e.target.files?.[0])}
                className="block w-full text-xs"
              />
              <p className="text-[11px] text-[var(--text-muted)]">
                {isJa
                  ? "Xiao の .pce をそのままアップロードできます（機械に接続して PLT を書き出す必要はありません）。"
                  : "You can upload the .pce saved in Xiao directly — no need to connect to the machine to export a PLT."}
              </p>
              {parsed && (
                <p className="text-[11px] text-[var(--text-secondary)]">
                  <span className="font-semibold uppercase">{parsed.sourceType}</span> ·{" "}
                  {parsed.pointCount} {isJa ? "ポイント" : "points"} · {isJa ? "レイヤー" : "layers"} {parsed.layers.join(", ")} ·
                  {" "}X {parsed.bounds.minX.toFixed(1)}–{parsed.bounds.maxX.toFixed(1)} mm ·
                  {" "}Y {parsed.bounds.minY.toFixed(1)}–{parsed.bounds.maxY.toFixed(1)} mm
                </p>
              )}
              {parsed && (
                <button type="button" onClick={handleOpenUploadPreview} className="text-xs font-semibold text-[var(--freya-blue)]">
                  {isJa ? "プレビューを表示" : "Preview before uploading"}
                </button>
              )}
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isJa ? "表示名（タブレットに表示）" : "Display name (shown on the tablet)"}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={!canUpload}
                onClick={handleUpload}
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {uploading ? (isJa ? "アップロード中…" : "Uploading…") : (isJa ? "アップロード" : "Upload")}
              </button>
            </div>

            {/* Existing programs */}
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
                {isJa ? "登録済みプログラム" : "Existing programs"} ({programs.length})
              </p>
              {loadingPrograms && <p className="text-xs text-[var(--text-muted)]">{isJa ? "読み込み中…" : "Loading…"}</p>}
              {!loadingPrograms && programs.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">{isJa ? "まだありません" : "None yet."}</p>
              )}
              <ul className="space-y-2">
                {programs.map((program) => (
                  <li key={program._id} className="rounded-[8px] border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {renamingId === program._id ? (
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(program); if (e.key === "Escape") setRenamingId(null); }}
                              className="flex-1 rounded-[6px] border border-[var(--border)] px-2 py-1 text-xs"
                            />
                            <button type="button" onClick={() => handleRename(program)} className="text-xs font-semibold text-[var(--freya-blue)]">{isJa ? "保存" : "Save"}</button>
                            <button type="button" onClick={() => setRenamingId(null)} className="text-xs text-[var(--text-muted)]">{isJa ? "取消" : "Cancel"}</button>
                          </div>
                        ) : (
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{program.displayName}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                          {program.fileName} · {program.pointCount} {isJa ? "ポイント" : "points"} · {program.uploadedBy} · {formatDate(program.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-3 text-xs">
                        <button type="button" onClick={() => handleOpenPreview(program)} className="text-[var(--freya-blue)]">
                          {isJa ? "プレビュー" : "Preview"}
                        </button>
                        <button type="button" onClick={() => { setRenamingId(program._id); setRenameValue(program.displayName); }} className="text-[var(--freya-blue)]">{isJa ? "名前変更" : "Rename"}</button>
                        <button type="button" onClick={() => handleDelete(program)} className="text-[var(--status-danger)]">{isJa ? "削除" : "Delete"}</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      {previewModal && (
        <ScnaNcPreviewModal
          title={previewModal.title}
          subtitle={previewModal.subtitle}
          points={previewModal.points}
          loading={previewModal.loading}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
