import { useEffect, useMemo, useState } from "react";
import ModalShell from "../ModalShell";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  downloadCsvWithBom,
  extractMachineExportValue,
  SCNA_DEFAULT_EXPORT_TEMPLATES,
  SCNA_MACHINE_EXPORT_CATEGORIES,
  SCNA_MACHINE_EXPORT_COLUMNS,
} from "../../utils/scna";

const STORAGE_KEY = "machineAnalyticsTemplates";

function loadCustomTemplates() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveCustomTemplates(templates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // ignore storage errors
  }
}

function buildColumnsFromTemplate(templateColumns = []) {
  const orderMap = new Map(
    templateColumns.map((col) => [col.key, col.order ?? null])
  );
  return SCNA_MACHINE_EXPORT_COLUMNS.map((col) => ({
    ...col,
    selected: orderMap.has(col.key),
    order: orderMap.get(col.key) ?? null,
  }));
}

export default function ScnaMachineExportModal({
  open,
  onClose,
  records = [],
  dateFrom,
  dateTo,
  onFlash,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [customTemplates, setCustomTemplates] = useState(() =>
    loadCustomTemplates()
  );
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("default");
  const [columnsState, setColumnsState] = useState(() =>
    buildColumnsFromTemplate(SCNA_DEFAULT_EXPORT_TEMPLATES.default.columns)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [editingTemplateKey, setEditingTemplateKey] = useState(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");

  useEffect(() => {
    if (open) {
      setCustomTemplates(loadCustomTemplates());
    }
  }, [open]);

  const allTemplates = useMemo(
    () => ({
      ...SCNA_DEFAULT_EXPORT_TEMPLATES,
      ...customTemplates,
    }),
    [customTemplates]
  );

  const selectedCount = useMemo(
    () => columnsState.filter((c) => c.selected).length,
    [columnsState]
  );

  if (!open) return null;

  function handleLoadTemplate(templateKey) {
    setSelectedTemplateKey(templateKey);
    const tpl = allTemplates[templateKey];
    if (tpl && Array.isArray(tpl.columns)) {
      setColumnsState(buildColumnsFromTemplate(tpl.columns));
    }
  }

  function handleToggleColumn(columnKey, checked) {
    setColumnsState((prev) => {
      const currentOrders = prev
        .filter((c) => c.selected && c.order !== null && c.key !== columnKey)
        .map((c) => c.order);
      const maxOrder = currentOrders.length > 0 ? Math.max(...currentOrders) : 0;

      return prev.map((col) => {
        if (col.key !== columnKey) return col;
        return {
          ...col,
          selected: checked,
          order: checked ? col.order || maxOrder + 1 : null,
        };
      });
    });
  }

  function handleOrderChange(columnKey, rawValue) {
    const parsed = parseInt(rawValue, 10);
    const nextOrder = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;

    setColumnsState((prev) =>
      prev.map((col) =>
        col.key === columnKey ? { ...col, order: nextOrder } : col
      )
    );
  }

  function handleSelectAll() {
    setColumnsState((prev) =>
      prev.map((col, idx) => ({
        ...col,
        selected: true,
        order: idx + 1,
      }))
    );
  }

  function handleDeselectAll() {
    setColumnsState((prev) =>
      prev.map((col) => ({
        ...col,
        selected: false,
        order: null,
      }))
    );
  }

  function handleClearOrders() {
    setColumnsState((prev) =>
      prev.map((col) => ({
        ...col,
        order: null,
      }))
    );
  }

  function handleSaveCurrentTemplate() {
    const trimmed = newTemplateName.trim();
    if (!trimmed) return;

    const selectedCols = columnsState.filter((c) => c.selected);
    if (selectedCols.length === 0) {
      onFlash?.({
        type: "warning",
        message: isJa
          ? "少なくとも1つのカラムを選択してください。"
          : "Please select at least one column before saving a template.",
      });
      return;
    }

    const templateKey = trimmed.toLowerCase().replace(/\s+/g, "_");
    const nextCustom = {
      ...customTemplates,
      [templateKey]: {
        name: trimmed,
        columns: selectedCols.map((c) => ({ key: c.key, order: c.order })),
      },
    };

    setCustomTemplates(nextCustom);
    saveCustomTemplates(nextCustom);
    setSelectedTemplateKey(templateKey);
    setNewTemplateName("");
    setShowSavePrompt(false);

    onFlash?.({
      type: "success",
      message: isJa
        ? `テンプレート「${trimmed}」を保存しました。`
        : `Template "${trimmed}" saved successfully!`,
    });
  }

  function handleRenameTemplate(key) {
    const trimmed = editingTemplateName.trim();
    if (!trimmed || !customTemplates[key]) return;

    const nextCustom = {
      ...customTemplates,
      [key]: {
        ...customTemplates[key],
        name: trimmed,
      },
    };
    setCustomTemplates(nextCustom);
    saveCustomTemplates(nextCustom);
    setEditingTemplateKey(null);
    setEditingTemplateName("");
  }

  function handleDeleteTemplate(key) {
    const nextCustom = { ...customTemplates };
    delete nextCustom[key];
    setCustomTemplates(nextCustom);
    saveCustomTemplates(nextCustom);
    if (selectedTemplateKey === key) {
      handleLoadTemplate("default");
    }
  }

  function handleExecuteExport() {
    const selectedCols = columnsState
      .filter((col) => col.selected)
      .sort((a, b) => {
        if (a.order === null && b.order === null) return 0;
        if (a.order === null) return 1;
        if (b.order === null) return -1;
        return a.order - b.order;
      });

    if (selectedCols.length === 0) {
      onFlash?.({
        type: "warning",
        message: isJa
          ? "エクスポートするカラムを1つ以上選択してください。"
          : "Please select at least one column to export.",
      });
      return;
    }

    const headers = selectedCols.map((col) => col.label);
    const csvRows = records.map((record) =>
      selectedCols.map((col) => extractMachineExportValue(record, col.key))
    );

    const filename = `SCNA_Machine_Analytics_${dateFrom || "start"}_to_${dateTo || "end"}.csv`;
    downloadCsvWithBom(headers, csvRows, filename);

    onFlash?.({
      type: "success",
      message: isJa
        ? `${records.length} 件のデータを ${selectedCols.length} カラムでエクスポートしました。`
        : `Successfully exported ${records.length} records with ${selectedCols.length} columns!`,
    });
    onClose?.();
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        eyebrow={isJa ? "SCNA 設備稼働分析" : "SCNA Machine Analytics"}
        title={
          isJa
            ? "CSVエクスポート設定 (Customize CSV Export)"
            : "Customize CSV Export"
        }
        subtitle={
          isJa
            ? "出力するカラムの選択・並び順の指定・テンプレート保存が可能です"
            : "Select columns, customize column ordering, and save reusable export templates"
        }
        maxWidth="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              <strong className="text-[var(--text-primary)]">{selectedCount}</strong>{" "}
              {isJa ? "カラム選択中" : "columns selected"} ({records.length}{" "}
              {isJa ? "件のレコード" : "records"})
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                {isJa ? "キャンセル" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleExecuteExport}
                className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  download
                </span>
                {isJa ? "CSVエクスポート" : "Export CSV"}
              </button>
            </div>
          </div>
        }
      >
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {/* Template Management Section */}
          <div className="rounded-[8px] border border-blue-500/25 bg-blue-500/[0.04] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
                  {isJa ? "テンプレート (Template)" : "Template"}
                </label>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => handleLoadTemplate(e.target.value)}
                  className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                >
                  {Object.entries(allTemplates).map(([key, tpl]) => (
                    <option key={key} value={key}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSavePrompt((prev) => !prev)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    save
                  </span>
                  {isJa ? "テンプレート保存" : "Save Template"}
                </button>
                <button
                  type="button"
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    settings
                  </span>
                  {isJa ? "管理" : "Manage"}
                </button>
              </div>
            </div>

            {showSavePrompt && (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]/60">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={
                    isJa ? "新しいテンプレート名を入力..." : "Enter template name..."
                  }
                  className="h-9 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentTemplate}
                  className="h-9 rounded-[6px] bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {isJa ? "保存" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSavePrompt(false);
                    setNewTemplateName("");
                  }}
                  className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  {isJa ? "閉じる" : "Cancel"}
                </button>
              </div>
            )}
          </div>

          {/* Search & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span
                className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                style={{ fontSize: 16 }}
              >
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isJa ? "カラムを検索..." : "Search columns..."}
                className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  done_all
                </span>
                {isJa ? "すべて選択" : "Select All"}
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  remove_done
                </span>
                {isJa ? "すべて解除" : "Deselect All"}
              </button>
              <button
                type="button"
                onClick={handleClearOrders}
                className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  format_list_numbered
                </span>
                {isJa ? "順序をクリア" : "Clear Order"}
              </button>
            </div>
          </div>

          {/* Column Selection Categories */}
          <div className="space-y-4">
            {SCNA_MACHINE_EXPORT_CATEGORIES.map((cat) => {
              const catColumns = columnsState.filter(
                (col) =>
                  col.category === cat.key &&
                  (!normalizedQuery ||
                    col.label.toLowerCase().includes(normalizedQuery) ||
                    col.key.toLowerCase().includes(normalizedQuery))
              );

              if (catColumns.length === 0) return null;

              return (
                <div
                  key={cat.key}
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
                    {isJa ? cat.titleJa : cat.title}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {catColumns.map((col) => (
                      <div
                        key={col.key}
                        className={`flex items-center justify-between gap-2 rounded-[6px] border p-2.5 transition ${
                          col.selected
                            ? "border-[var(--freya-blue)]/40 bg-[var(--freya-blue)]/[0.04]"
                            : "border-[var(--border)] bg-[var(--surface-raised)]"
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={col.selected}
                            onChange={(e) =>
                              handleToggleColumn(col.key, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-[var(--border)] text-[var(--freya-blue)]"
                          />
                          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {col.label}
                          </span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          disabled={!col.selected}
                          value={col.order ?? ""}
                          placeholder="#"
                          onChange={(e) =>
                            handleOrderChange(col.key, e.target.value)
                          }
                          className="h-7 w-14 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 text-center font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] disabled:opacity-40"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModalShell>

      {/* Manage Custom Templates Modal */}
      {manageModalOpen && (
        <ModalShell
          open={manageModalOpen}
          onClose={() => setManageModalOpen(false)}
          eyebrow={isJa ? "テンプレート管理" : "Template Manager"}
          title={isJa ? "保存済みテンプレートの管理" : "Manage Templates"}
          maxWidth="max-w-lg"
          zIndex="z-[60]"
          footer={
            <button
              type="button"
              onClick={() => setManageModalOpen(false)}
              className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)]"
            >
              {isJa ? "閉じる" : "Close"}
            </button>
          }
        >
          <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
            {Object.entries(allTemplates).map(([key, tpl]) => {
              const isDefault = key === "default" || key === "detailed";
              const isEditing = editingTemplateKey === key;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTemplateName}
                          onChange={(e) => setEditingTemplateName(e.target.value)}
                          className="h-8 flex-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-xs text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameTemplate(key)}
                          className="h-8 rounded-[4px] bg-emerald-600 px-2.5 text-xs font-semibold text-white"
                        >
                          {isJa ? "保存" : "Save"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-semibold text-[var(--text-primary)]">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {tpl.columns?.length || 0} columns
                          {isDefault ? " (Built-in)" : ""}
                        </div>
                      </>
                    )}
                  </div>

                  {!isDefault && !isEditing && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplateKey(key);
                          setEditingTemplateName(tpl.name);
                        }}
                        className="h-7 rounded-[4px] border border-[var(--border)] px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        {isJa ? "名前変更" : "Rename"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(key)}
                        className="h-7 rounded-[4px] border border-rose-500/30 bg-rose-500/10 px-2 text-xs font-semibold text-rose-600 dark:text-rose-400"
                      >
                        {isJa ? "削除" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ModalShell>
      )}
    </>
  );
}

