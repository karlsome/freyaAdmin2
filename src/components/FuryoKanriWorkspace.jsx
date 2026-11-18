import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import {
  fetchDefectCatalog,
  fetchFuryoModels,
  fetchModelDefectOverrides,
  fetchProcessDefectDefinitions,
} from "../services/api";
import {
  canEditFuryoDefinitions,
  DEFECT_OTHER_ID,
  FURYO_DEFAULT_PROCESS,
  FURYO_MASTER_KEY,
  FURYO_PROCESS_KEYS,
  FURYO_SECTIONS,
  isFuryoProcess,
  sortFuryoModels,
} from "../utils/furyoKanri";
import { getAuthUser } from "../utils/masterDB";
import DefectCatalogPanel from "./DefectCatalogPanel";
import FuryoLegacyCounterWorkspace from "./FuryoLegacyCounterWorkspace";
import ProcessDefectPanel from "./ProcessDefectPanel";

const SECTION_ORDER = [FURYO_MASTER_KEY, ...FURYO_PROCESS_KEYS];

// 不良管理: defect master (不良マスタ) + per-process base lists + per-model differences.
// URL: ?process=master|pressDB|slitDB|SRSDB (kensaDB is the default), kensa legacy view: &view=legacy
export default function FuryoKanriWorkspace({ refreshToken = 0, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const authUser = getAuthUser();
  const canEdit = canEditFuryoDefinitions(authUser?.role);
  const username = authUser?.username || "unknown";

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get("process");
  const section = sectionFromUrl === FURYO_MASTER_KEY || isFuryoProcess(sectionFromUrl) ? sectionFromUrl : FURYO_DEFAULT_PROCESS;
  const kensaView = section === "kensaDB" && searchParams.get("view") === "legacy" ? "legacy" : "lists";

  const [catalog, setCatalog] = useState([]);
  const [baseLists, setBaseLists] = useState({});
  const [overrides, setOverrides] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [nextCatalog, nextBase, nextOverrides, nextModels] = await Promise.all([
          fetchDefectCatalog(),
          fetchProcessDefectDefinitions(),
          fetchModelDefectOverrides(),
          fetchFuryoModels(),
        ]);
        if (cancelled) return;
        setCatalog(nextCatalog);
        setBaseLists(Object.fromEntries(nextBase.map((doc) => [doc.process, doc])));
        setOverrides(nextOverrides);
        setModels(sortFuryoModels(nextModels));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || (isJa ? "不良項目の読み込みに失敗しました。" : "Failed to load defect lists."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, isJa]);

  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const usage = new Map();
  FURYO_PROCESS_KEYS.forEach((key) => {
    (baseLists[key]?.items || []).forEach((id) => {
      if (id === DEFECT_OTHER_ID) return;
      usage.set(id, [...(usage.get(id) || []), key]);
    });
  });

  function confirmLeave() {
    return !dirty || window.confirm(isJa ? "保存されていない変更は破棄されます。続行しますか？" : "Unsaved changes will be lost. Continue?");
  }

  function updateUrl(nextSection, nextView = "") {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (nextSection === FURYO_DEFAULT_PROCESS) next.delete("process");
      else next.set("process", nextSection);
      if (nextView) next.set("view", nextView);
      else next.delete("view");
      return next;
    });
  }

  function selectSection(key) {
    if (key === section || !confirmLeave()) return;
    setDirty(false);
    updateUrl(key);
  }

  function selectKensaView(view) {
    if (view === kensaView || !confirmLeave()) return;
    setDirty(false);
    updateUrl("kensaDB", view === "legacy" ? "legacy" : "");
  }

  // Back/forward or a link changed the section: unmounted panels drop their edits
  useEffect(() => {
    setDirty(false);
  }, [section, kensaView]);

  function sectionCount(key) {
    if (key === FURYO_MASTER_KEY) return catalog.filter((item) => !item.deleted).length;
    return (baseLists[key]?.items || []).filter((id) => id === DEFECT_OTHER_ID || (catalogById.get(id) && !catalogById.get(id).deleted)).length;
  }

  const editable = canEdit && !error && !loading;

  return (
    <div>
      <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "品質設定" : "Quality Setup"}</div>
            <h3 className="mt-1 text-xl font-bold text-[var(--text-primary)]">{isJa ? "不良項目管理 (不良管理)" : "Defect Management (不良管理)"}</h3>
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-[var(--text-secondary)]">
              {isJa
                ? "不良マスタに登録した不良から、工程ごとの基本リストとモデル別の違いを設定します。タブレットはこの設定に従って不良ボタンを表示します。"
                : "Pick each process's base list, and per-model differences, from the defect master. Tablets show defect buttons from these lists."}
            </p>
          </div>
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)]">
            {authUser?.username || (isJa ? "不明なユーザー" : "Unknown user")}
            {authUser?.role ? ` · ${authUser.role}` : ""}
            {!canEdit && ` · ${isJa ? "閲覧のみ" : "view only"}`}
          </div>
        </div>
      </div>

      <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SECTION_ORDER.map((key) => {
            const meta = FURYO_SECTIONS[key];
            const active = key === section;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectSection(key)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-[8px] border-2 px-3 py-3 transition ${
                  active
                    ? "border-[var(--freya-blue)] bg-primary/10 text-primary"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{meta.icon}</span>
                <span className="text-xs font-semibold">
                  {isJa ? meta.labelJa : meta.labelEn}
                  {key !== FURYO_MASTER_KEY && <span className="font-mono font-normal opacity-70"> ({key})</span>}
                </span>
                <span className="text-[11px] opacity-70">
                  {loading ? "…" : `${sectionCount(key)}${isJa ? "項目" : " items"}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-4 py-3 text-xs font-medium text-[var(--status-danger)]">
          {error}
        </div>
      )}

      {section === "kensaDB" && (
        <div className="mb-4 inline-flex rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
          {[
            { key: "lists", ja: "不良リスト", en: "Defect lists" },
            { key: "legacy", ja: "旧カウンター定義", en: "Legacy counters" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectKensaView(tab.key)}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
                kensaView === tab.key ? "bg-[var(--freya-blue)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              {isJa ? tab.ja : tab.en}
            </button>
          ))}
        </div>
      )}

      {loading && !catalog.length ? (
        <div className="flex h-48 items-center justify-center text-xs text-[var(--text-muted)]">
          <span className="material-symbols-outlined mr-2 animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
          {isJa ? "読み込み中..." : "Loading..."}
        </div>
      ) : section === FURYO_MASTER_KEY ? (
        <DefectCatalogPanel
          catalog={catalog}
          usage={usage}
          baseLists={baseLists}
          overrides={overrides}
          canEdit={editable}
          username={username}
          onDirtyChange={setDirty}
          onFlash={onFlash}
          onChanged={(item) => {
            setCatalog((current) => (current.some((x) => x.id === item.id) ? current.map((x) => (x.id === item.id ? item : x)) : [...current, item]));
          }}
        />
      ) : section === "kensaDB" && kensaView === "legacy" ? (
        <FuryoLegacyCounterWorkspace refreshToken={refreshToken} onFlash={onFlash} onDirtyChange={setDirty} />
      ) : (
        <ProcessDefectPanel
          key={section}
          processKey={section}
          catalog={catalog}
          catalogById={catalogById}
          baseIds={baseLists[section]?.items || [DEFECT_OTHER_ID]}
          baseMeta={baseLists[section]}
          overrides={overrides.filter((doc) => doc.process === section)}
          models={models}
          canEdit={editable}
          username={username}
          onDirtyChange={setDirty}
          onFlash={onFlash}
          onBaseSaved={(items, meta) => {
            setBaseLists((current) => ({ ...current, [section]: { ...current[section], process: section, items, ...meta } }));
          }}
          onOverrideSaved={(model, doc) => {
            setOverrides((current) => {
              const rest = current.filter((x) => !(x.process === section && x.model === model));
              return doc ? [...rest, doc] : rest;
            });
          }}
        />
      )}
    </div>
  );
}
