import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  fetchDefectDefinitions,
  fetchFuryoModelProducts,
  fetchFuryoModels,
  saveDefectDefinition,
  translateJapaneseText,
} from "../services/api";
import {
  canEditFuryoDefinitions,
  countDefinedCounters,
  filterFuryoModels,
  FURYO_COUNTER_COUNT,
  FURYO_COUNTER_KEYS,
  getEmptyCounterMap,
  hasCounterChanges,
  normalizeCounterMap,
  normalizeDefectDefinitions,
  sortFuryoModels,
} from "../utils/furyoKanri";
import { getAuthUser } from "../utils/masterDB";
import FuryoDefinitionPanel from "./FuryoDefinitionPanel";
import FuryoModelInfoModal from "./FuryoModelInfoModal";
import FuryoModelListPanel from "./FuryoModelListPanel";

function cloneCounterMap(counterMap = {}) {
  return { ...counterMap };
}

export default function FuryoKanriWorkspace({ refreshToken = 0, onFlash }) {
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
  const selectedModelRef = useRef(selectedModel);

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
        setError(loadError.message || "Failed to load defect definitions.");
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
  }, [refreshToken]);

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
        setInfoError(loadError.message || "Failed to load products for the selected model.");
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
  }, [infoModel]);

  function handleSelectModel(model) {
    if (editMode && hasChanges && !window.confirm("Unsaved changes will be lost. Continue?")) {
      return;
    }

    setSelectedModel(model);
    loadDraftForModel(model);
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
      publishFlash("success", `${selectedModel} defect definition saved successfully.`);
    } catch (saveError) {
      publishFlash("error", saveError.message || "Failed to save the defect definition.");
    } finally {
      setSaving(false);
    }
  }

  const stats = [
    { label: "Total Models", value: models.length, icon: "inventory_2", accent: "bg-primary/12 text-primary" },
    { label: "Defined", value: definedModels, icon: "rule", accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
    { label: "Complete", value: completeModels, icon: "task_alt", accent: "bg-secondary/12 text-secondary" },
    { label: "Access", value: canEdit ? "Edit" : "View", icon: "lock_open", accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  ];

  return (
    <div>
      <div className="glass-card rounded-3xl px-5 py-5 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Quality Setup</div>
            <h3 className="mt-1 text-2xl font-bold text-on-surface">不良管理</h3>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Manage model-specific defect labels for counters 1 through 12. This ports the legacy definition workflow, including bilingual fields, edit-role gating, and model product lookup.
            </p>
          </div>

          <div className="rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            {authUser?.username || "Unknown user"}
            {authUser?.role ? ` · ${authUser.role}` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {stats.map((card) => (
          <div key={card.label} className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
                  {card.icon}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">{card.label}</div>
                <div className="mt-1 text-2xl font-black text-on-surface">{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-3xl border border-error/20 bg-error/10 px-5 py-4 text-sm font-medium text-error">
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