import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import {
  fetchDefectDefinitions,
  fetchFuryoModelProducts,
  fetchFuryoModels,
  fetchProcessDefectDefinitions,
  saveDefectDefinition,
  translateJapaneseText,
} from "../services/api";
import {
  canEditFuryoDefinitions,
  countDefinedCounters,
  filterFuryoModels,
  FURYO_COUNTER_COUNT,
  FURYO_COUNTER_KEYS,
  FURYO_DEFAULT_PROCESS,
  FURYO_PROCESS_DEFECTS,
  getEmptyCounterMap,
  hasCounterChanges,
  normalizeCounterMap,
  normalizeDefectDefinitions,
  sortFuryoModels,
} from "../utils/furyoKanri";
import { getAuthUser } from "../utils/masterDB";
import FuryoDefinitionPanel from "./FuryoDefinitionPanel";
import FuryoFixedDefectsPanel from "./FuryoFixedDefectsPanel";
import FuryoModelInfoModal from "./FuryoModelInfoModal";
import FuryoModelListPanel from "./FuryoModelListPanel";

// Built-in items for each fixed-field process, used until the server list loads (or if it fails)
function getDefaultProcessDefs() {
  return Object.fromEntries(
    Object.entries(FURYO_PROCESS_DEFECTS)
      .filter(([, proc]) => proc.counters)
      .map(([key, proc]) => [key, { items: proc.counters.map((c) => ({ ...c, builtIn: true })), updatedAt: null, updatedBy: "" }]),
  );
}

function cloneCounterMap(counterMap = {}) {
  return { ...counterMap };
}

export default function FuryoKanriWorkspace({ refreshToken = 0, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const authUser = getAuthUser();
  const canEdit = canEditFuryoDefinitions(authUser?.role);
  const [models, setModels] = useState([]);
  const [definitionsByModel, setDefinitionsByModel] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const [selectedModel, setSelectedModel] = useState("");
  const [draftCounters, setDraftCounters] = useState(getEmptyCounterMap());
  const [draftCountersEn, setDraftCountersEn] = useState(getEmptyCounterMap());
  const [originalCounters, setOriginalCounters] = useState(getEmptyCounterMap());
  const [originalCountersEn, setOriginalCountersEn] = useState(getEmptyCounterMap());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState({});
  const [infoModel, setInfoModel] = useState("");
  const [infoProducts, setInfoProducts] = useState([]);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  // Selected process lives in the URL (?process=pressDB) so each list is linkable / back-button friendly
  const [searchParams, setSearchParams] = useSearchParams();
  const processFromUrl = searchParams.get("process");
  const selectedProcess = processFromUrl && FURYO_PROCESS_DEFECTS[processFromUrl] ? processFromUrl : FURYO_DEFAULT_PROCESS;
  const previousProcessRef = useRef(selectedProcess);
  const [processDefs, setProcessDefs] = useState(getDefaultProcessDefs);
  const [processDefsError, setProcessDefsError] = useState("");
  const [fixedDirty, setFixedDirty] = useState(false);
  const selectedModelRef = useRef(selectedModel);
  const processDef = FURYO_PROCESS_DEFECTS[selectedProcess];
  const isModelProcess = !processDef?.counters;

  const filteredModels = filterFuryoModels(models, deferredSearchValue);
  const currentDefinition = selectedModel
    ? definitionsByModel[selectedModel] || { counters: getEmptyCounterMap(), countersEn: getEmptyCounterMap() }
    : null;
  const hasChanges = hasCounterChanges(draftCounters, originalCounters) || hasCounterChanges(draftCountersEn, originalCountersEn);
  const definedModels = models.filter((model) => countDefinedCounters(definitionsByModel[model]?.counters) > 0).length;
  const completeModels = models.filter((model) => countDefinedCounters(definitionsByModel[model]?.counters) === FURYO_COUNTER_COUNT).length;

  function publishFlash(type, message) {
    if (typeof onFlash === "function") {
      onFlash({ type, message });
    }
  }

  function loadDraftForModel(model, nextDefinitions = definitionsByModel) {
    const definition = nextDefinitions[model];
    const counters = normalizeCounterMap(definition?.counters);
    const countersEn = normalizeCounterMap(definition?.countersEn);
    setDraftCounters(cloneCounterMap(counters));
    setDraftCountersEn(cloneCounterMap(countersEn));
    setOriginalCounters(cloneCounterMap(counters));
    setOriginalCountersEn(cloneCounterMap(countersEn));
    setEditMode(false);
    setTranslating({});
  }

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  // Process changed via URL (back/forward or a link): drop any in-progress edits
  useEffect(() => {
    if (previousProcessRef.current === selectedProcess) return;
    previousProcessRef.current = selectedProcess;
    setFixedDirty(false);
    setEditMode(false);
    setTranslating({});
    setDraftCounters(cloneCounterMap(originalCounters));
    setDraftCountersEn(cloneCounterMap(originalCountersEn));
  }, [selectedProcess, originalCounters, originalCountersEn]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setError("");

      try {
        const [nextModels, nextDefinitions] = await Promise.all([
          fetchFuryoModels(),
          fetchDefectDefinitions(),
        ]);

        if (cancelled) return;

        const sortedModels = sortFuryoModels(nextModels);
        const normalizedDefinitions = normalizeDefectDefinitions(nextDefinitions);

        setModels(sortedModels);
        setDefinitionsByModel(normalizedDefinitions);

        const currentSelectedModel = selectedModelRef.current;

        if (currentSelectedModel && sortedModels.includes(currentSelectedModel)) {
          const definition = normalizedDefinitions[currentSelectedModel];
          const counters = normalizeCounterMap(definition?.counters);
          const countersEn = normalizeCounterMap(definition?.countersEn);
          setDraftCounters(cloneCounterMap(counters));
          setDraftCountersEn(cloneCounterMap(countersEn));
          setOriginalCounters(cloneCounterMap(counters));
          setOriginalCountersEn(cloneCounterMap(countersEn));
          setEditMode(false);
          setTranslating({});
        } else if (currentSelectedModel && !sortedModels.includes(currentSelectedModel)) {
          setSelectedModel("");
          setDraftCounters(getEmptyCounterMap());
          setDraftCountersEn(getEmptyCounterMap());
          setOriginalCounters(getEmptyCounterMap());
          setOriginalCountersEn(getEmptyCounterMap());
          setEditMode(false);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || (isJa ? "不良項目定義の読み込みに失敗しました。" : "Failed to load defect definitions."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, isJa]);

  useEffect(() => {
    let cancelled = false;

    async function loadProcessDefs() {
      setProcessDefsError("");
      try {
        const docs = await fetchProcessDefectDefinitions();
        if (cancelled) return;
        setProcessDefs((current) => {
          const next = { ...current };
          docs.forEach((doc) => {
            if (!next[doc.process] || !Array.isArray(doc.items)) return;
            next[doc.process] = { items: doc.items, updatedAt: doc.updatedAt || null, updatedBy: doc.updatedBy || "" };
          });
          return next;
        });
      } catch (loadError) {
        if (cancelled) return;
        setProcessDefsError(
          (isJa ? "工程別の不良項目を読み込めませんでした（既定項目を表示中）: " : "Couldn't load per-process defect items (showing built-ins): ")
            + (loadError.message || ""),
        );
      }
    }

    loadProcessDefs();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, isJa]);

  useEffect(() => {
    if (!infoModel) return undefined;
    let cancelled = false;

    async function loadModelProducts() {
      setInfoLoading(true);
      setInfoError("");

      try {
        const products = await fetchFuryoModelProducts(infoModel);
        if (cancelled) return;
        setInfoProducts(Array.isArray(products) ? products : []);
      } catch (loadError) {
        if (cancelled) return;
        setInfoProducts([]);
        setInfoError(loadError.message || (isJa ? "選択したモデルの製品一覧の取得に失敗しました。" : "Failed to load products for the selected model."));
      } finally {
        if (!cancelled) {
          setInfoLoading(false);
        }
      }
    }

    loadModelProducts();
    return () => {
      cancelled = true;
    };
  }, [infoModel, isJa]);

  function handleSelectModel(model) {
    if (editMode && hasChanges && !window.confirm(isJa ? "保存されていない変更は破棄されます。続行しますか？" : "Unsaved changes will be lost. Continue?")) {
      return;
    }

    setSelectedModel(model);
    loadDraftForModel(model);
  }

  function handleSelectProcess(processKey) {
    if (processKey === selectedProcess) return;
    const dirty = (editMode && hasChanges) || fixedDirty;
    if (dirty && !window.confirm(isJa ? "保存されていない変更は破棄されます。続行しますか？" : "Unsaved changes will be lost. Continue?")) {
      return;
    }
    if (editMode) handleCancelEdit();
    setFixedDirty(false);
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (processKey === FURYO_DEFAULT_PROCESS) next.delete("process");
      else next.set("process", processKey);
      return next;
    });
  }

  function handleStartEdit() {
    if (!selectedModel || !canEdit) return;
    setEditMode(true);
  }

  function handleCancelEdit() {
    setDraftCounters(cloneCounterMap(originalCounters));
    setDraftCountersEn(cloneCounterMap(originalCountersEn));
    setEditMode(false);
    setTranslating({});
  }

  function handleClear() {
    setDraftCounters(getEmptyCounterMap());
    setDraftCountersEn(getEmptyCounterMap());
  }

  function handleChangeJP(counterKey, value) {
    setDraftCounters((current) => ({ ...current, [counterKey]: value }));
  }

  function handleChangeEN(counterKey, value) {
    setDraftCountersEn((current) => ({ ...current, [counterKey]: value }));
  }

  async function handleBlurJP(counterKey) {
    if (!editMode) return;

    const jpText = String(draftCounters[counterKey] || "").trim();
    const enText = String(draftCountersEn[counterKey] || "").trim();
    if (!jpText || enText) return;

    setTranslating((current) => ({ ...current, [counterKey]: true }));
    try {
      const translated = await translateJapaneseText(jpText);
      if (translated) {
        setDraftCountersEn((current) => {
          if (String(current[counterKey] || "").trim()) return current;
          return { ...current, [counterKey]: translated };
        });
      }
    } catch {
      // Silent fallback: legacy behavior only logged translation failures.
    } finally {
      setTranslating((current) => ({ ...current, [counterKey]: false }));
    }
  }

  async function handleSave() {
    if (!selectedModel || !canEdit || !hasChanges) return;

    setSaving(true);
    try {
      const counters = normalizeCounterMap(draftCounters);
      const countersEn = normalizeCounterMap(draftCountersEn);

      await saveDefectDefinition({
        model: selectedModel,
        counters,
        countersEn,
        username: authUser?.username || "unknown",
      });

      const nextDefinition = {
        model: selectedModel,
        counters,
        countersEn,
        updatedAt: new Date().toISOString(),
        updatedBy: authUser?.username || "unknown",
      };

      setDefinitionsByModel((current) => ({
        ...current,
        [selectedModel]: nextDefinition,
      }));
      setOriginalCounters(cloneCounterMap(counters));
      setOriginalCountersEn(cloneCounterMap(countersEn));
      setEditMode(false);
      publishFlash("success", isJa ? `モデル「${selectedModel}」の不良項目定義を保存しました。` : `${selectedModel} defect definition saved successfully.`);
    } catch (saveError) {
      publishFlash("error", saveError.message || (isJa ? "不良項目定義の保存に失敗しました。" : "Failed to save the defect definition."));
    } finally {
      setSaving(false);
    }
  }

  const stats = [
    { label: isJa ? "総モデル数" : "Total Models", value: models.length, icon: "inventory_2", accent: "bg-primary/12 text-primary" },
    { label: isJa ? "定義済み" : "Defined", value: definedModels, icon: "rule", accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
    { label: isJa ? "全項目完了" : "Complete", value: completeModels, icon: "task_alt", accent: "bg-secondary/12 text-secondary" },
    { label: isJa ? "編集権限" : "Access", value: canEdit ? (isJa ? "編集可能" : "Edit") : (isJa ? "閲覧のみ" : "View"), icon: "lock_open", accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  ];

  return (
    <div>
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 mb-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "品質設定" : "Quality Setup"}
            </div>
            <h3 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
              {isJa ? "不良項目管理 (不良管理)" : "Defect Management (不良管理)"}
            </h3>
            <p className="mt-1.5 max-w-3xl text-xs text-[var(--text-secondary)] leading-relaxed">
              {isJa
                ? "プロセスごとの不良項目を確認します。検査 (kensaDB) はカウンター1〜12のモデル別不良項目名を管理でき、プレス・スリット・転写は固定項目です。"
                : "Review defect items per process. Inspection (kensaDB) has model-specific labels for counters 1–12; Press, Slit and Transfer use fixed items."}
            </p>
          </div>

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-mono text-[var(--text-secondary)]">
            {authUser?.username || (isJa ? "不明なユーザー" : "Unknown user")}
            {authUser?.role ? ` · ${authUser.role}` : ""}
          </div>
        </div>
      </div>

      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 mb-6 shadow-sm">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          {isJa ? "プロセスを選択" : "Select process"}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(FURYO_PROCESS_DEFECTS).map(([key, proc]) => {
            const active = key === selectedProcess;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectProcess(key)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-[8px] border-2 px-3 py-3 transition ${
                  active
                    ? "border-[var(--freya-blue)] bg-primary/10 text-primary"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{proc.icon}</span>
                <span className="text-xs font-semibold">
                  {isJa ? proc.labelJa : proc.labelEn} <span className="font-mono font-normal opacity-70">({key})</span>
                </span>
                <span className="text-[11px] opacity-70">
                  {proc.counters
                    ? `${processDefs[key]?.items?.length ?? proc.counters.length}${isJa ? "項目" : " items"}`
                    : (isJa ? "モデル別定義" : "Per-model")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!isModelProcess ? (
        <>
          {processDefsError && (
            <div className="mb-4 rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-4 py-3 text-xs font-medium text-[var(--status-danger)]">
              {processDefsError}
            </div>
          )}
          <FuryoFixedDefectsPanel
            key={selectedProcess}
            processKey={selectedProcess}
            process={processDef}
            items={processDefs[selectedProcess]?.items || []}
            updatedAt={processDefs[selectedProcess]?.updatedAt}
            updatedBy={processDefs[selectedProcess]?.updatedBy}
            canEdit={canEdit && !processDefsError}
            username={authUser?.username || "unknown"}
            onDirtyChange={setFixedDirty}
            onFlash={onFlash}
            onSaved={(processKey, items) => {
              setProcessDefs((current) => ({
                ...current,
                [processKey]: { items, updatedAt: new Date().toISOString(), updatedBy: authUser?.username || "unknown" },
              }));
            }}
          />
        </>
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {stats.map((card) => (
          <div key={card.label} className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-[6px] ${card.accent}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                  {card.icon}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{card.label}</div>
                <div className="mt-0.5 text-2xl font-bold font-mono text-[var(--text-primary)]">{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-4 py-3 text-xs font-medium text-[var(--status-danger)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <FuryoModelListPanel
          models={filteredModels}
          definitionsByModel={definitionsByModel}
          selectedModel={selectedModel}
          searchValue={searchValue}
          loading={loading}
          onSearchChange={setSearchValue}
          onSelectModel={handleSelectModel}
          onOpenModelInfo={(model) => setInfoModel(model)}
        />

        <FuryoDefinitionPanel
          selectedModel={selectedModel}
          definition={currentDefinition}
          draftCounters={draftCounters}
          draftCountersEn={draftCountersEn}
          editMode={editMode}
          canEdit={canEdit}
          hasChanges={hasChanges}
          saving={saving}
          translating={translating}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onClear={handleClear}
          onSave={handleSave}
          onChangeJP={handleChangeJP}
          onBlurJP={handleBlurJP}
          onChangeEN={handleChangeEN}
        />
      </div>
      </>
      )}

      <FuryoModelInfoModal
        model={infoModel}
        loading={infoLoading}
        error={infoError}
        products={infoProducts}
        onClose={() => {
          setInfoModel("");
          setInfoProducts([]);
          setInfoError("");
        }}
      />
    </div>
  );
}