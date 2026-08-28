import { useEffect, useMemo, useRef, useState } from "react";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchCheckFormTemplateById } from "../services/api";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function TemplateQuickPeekModal({
  activeFieldId = null,
  isOptional = false,
  onClose,
  template: initialTemplate = null,
  templateId = null,
}) {
  const { language, t } = useLanguage();
  const [template, setTemplate] = useState(initialTemplate);
  const [loading, setLoading] = useState(!initialTemplate && !!templateId);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const targetItemRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate);
      setLoading(false);
      return;
    }

    let active = true;
    async function load() {
      const resolvedId = templateId || initialTemplate?._id;
      if (!resolvedId) {
        setError(t("failedToLoadTemplate") || "No template ID.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchCheckFormTemplateById(resolvedId);
        if (active) {
          setTemplate(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || t("failedToLoadTemplate") || "Failed to load template");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [templateId, initialTemplate, t]);

  useEffect(() => {
    if (!loading && template && targetItemRef.current) {
      const timer = setTimeout(() => {
        targetItemRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [loading, template, activeFieldId]);

  const templateName = language === "en"
    ? (template?.name_en || template?.name)
    : (template?.name_ja || template?.name);
  const templateDesc = language === "en"
    ? (template?.description_en || template?.description)
    : (template?.description_ja || template?.description);

  const templateImages = useMemo(() => {
    if (!Array.isArray(template?.fields)) return [];
    return template.fields
      .filter((field) => Boolean(field.imageURL))
      .map((field) => ({
        url: field.imageURL,
        label: language === "en" ? (field.label_en || field.label) : (field.label_ja || field.label),
      }));
  }, [template?.fields, language]);

  function openFieldPreviewImage(fieldImageUrl) {
    const foundIndex = templateImages.findIndex((img) => img.url === fieldImageUrl);
    if (foundIndex < 0) return;
    setPreviewImage({
      activeIndex: foundIndex,
      images: templateImages,
    });
  }

  function handlePreviewNavigate(direction) {
    setPreviewImage((current) => {
      const images = Array.isArray(current?.images) ? current.images : [];
      const currentIndex = Number.isInteger(current?.activeIndex) ? current.activeIndex : 0;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= images.length) return current;
      return { ...current, activeIndex: nextIndex };
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="dashboard-section rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-separator/40 bg-surface/90 px-6 py-5 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                {t("quickPeekTemplate") || "Quick Peek Template"}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-on-surface">{templateName || (t("loadingTemplate") || "Loading...")}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Dedicated banner when targeting a defect or optional note */}
          {activeFieldId && (
            <div className={joinClasses(
              "flex items-center justify-between border-b px-6 py-2.5 text-xs font-bold",
              isOptional
                ? "border-blue-500/30 bg-blue-500/15 text-blue-800 dark:text-blue-200"
                : "border-rose-500/30 bg-rose-500/15 text-rose-800 dark:text-rose-200"
            )}>
              <div className="flex items-center gap-2">
                <span className={joinClasses("material-symbols-outlined animate-bounce", isOptional ? "text-blue-600" : "text-rose-600")} style={{ fontSize: 16 }}>
                  arrow_downward
                </span>
                <span>
                  {isOptional
                    ? (language === "ja" ? "申し送り・連絡事項の該当項目へスクロールしました" : "Scrolled to focused optional handover note checkpoint")
                    : (language === "ja" ? "不具合・NG指摘の該当項目へスクロールしました" : "Scrolled to focused defect checkpoint")}
                </span>
              </div>
              <span className={joinClasses(
                "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold",
                isOptional ? "bg-blue-500/20 text-blue-800 dark:text-blue-200" : "bg-rose-500/20 text-rose-800 dark:text-rose-200"
              )}>
                {language === "ja" ? "自動フォーカス" : "Auto-focused"}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-outline gap-3">
                <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 24 }}>sync</span>
                <p className="text-xs font-medium">{t("loadingTemplate") || "Loading template..."}</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-center text-xs font-semibold text-error">
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-separator/40 bg-surface-container-low p-4">
                  {templateDesc && <p className="text-xs text-outline leading-relaxed whitespace-pre-line mb-3">{templateDesc}</p>}
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-outline">
                    {template?.工場 && (
                      <span className="rounded-lg bg-surface-container px-2.5 py-1 flex items-center gap-1 text-on-surface">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>factory</span>
                        {template.工場}
                      </span>
                    )}
                    {template?.schedule && (
                      <span className="rounded-lg bg-surface-container px-2.5 py-1 flex items-center gap-1 capitalize text-on-surface">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>event_repeat</span>
                        {template.schedule}
                      </span>
                    )}
                    {Array.isArray(template?.fields) && (
                      <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-primary font-semibold">
                        {template.fields.length} Check Items
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Checklist Items ({template?.fields?.length || 0})</p>
                  {Array.isArray(template?.fields) && template.fields.map((f, idx) => {
                    const isCurrentItem = activeFieldId && (
                      String(f.id ?? "").toLowerCase() === String(activeFieldId).toLowerCase() ||
                      String(f.fieldId ?? "").toLowerCase() === String(activeFieldId).toLowerCase() ||
                      String(f.label ?? "").toLowerCase() === String(activeFieldId).toLowerCase() ||
                      String(f.label_ja ?? "").toLowerCase() === String(activeFieldId).toLowerCase() ||
                      String(f.label_en ?? "").toLowerCase() === String(activeFieldId).toLowerCase() ||
                      String(idx) === String(activeFieldId)
                    );
                    const label = language === "en" ? (f.label_en || f.label) : (f.label_ja || f.label);
                    const desc = language === "en" ? (f.description_en || f.description) : (f.description_ja || f.description);

                    return (
                      <div
                        key={f.id || idx}
                        ref={isCurrentItem ? targetItemRef : null}
                        className={joinClasses(
                          "rounded-2xl border p-4 transition-all scroll-mt-6",
                          isCurrentItem
                            ? isOptional
                              ? "border-blue-500/40 bg-blue-500/5 shadow-xs ring-2 ring-blue-500/30 dark:bg-blue-950/20"
                              : "border-error/40 bg-error/5 shadow-xs ring-2 ring-error/30 dark:bg-red-950/20"
                            : "border-separator/40 bg-surface-container hover:border-separator/80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-semibold text-outline">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {isCurrentItem && (
                                  <span className={joinClasses(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-2xs animate-pulse",
                                    isOptional ? "bg-blue-600 text-white" : "bg-error text-white"
                                  )}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                                      {isOptional ? "chat_bubble" : "error"}
                                    </span>
                                    {isOptional
                                      ? (language === "ja" ? "対象項目 (申し送り)" : "Target Item (Optional)")
                                      : (t("currentTicketItem") || (language === "ja" ? "対象項目 (不具合)" : "Target Item (Defect)"))}
                                  </span>
                                )}
                                {(() => {
                                  const rawTiming = f.timing || "pre";
                                  const isPostTiming = String(rawTiming).toLowerCase().includes("post") || String(rawTiming).includes("後");
                                  const timingLabel = isPostTiming
                                    ? (t("postProductionTiming") || (language === "en" ? "Post-Production" : "作業後点検"))
                                    : (t("preProductionTiming") || (language === "en" ? "Pre-Production" : "作業前点検"));

                                  return (
                                    <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                                      {timingLabel}
                                    </span>
                                  );
                                })()}
                                <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
                                  {f.type || "toggle"}
                                </span>
                              </div>

                              <p className="mt-1 text-sm font-semibold text-on-surface leading-snug">{label || "Untitled check item"}</p>
                              {desc && <p className="mt-1 text-xs text-outline leading-relaxed whitespace-pre-line">{desc}</p>}

                              {/* Allowed Range for Numeric Check */}
                              {f.type === "number" && (f.min != null || f.max != null) && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs text-on-surface border border-separator/40 font-medium">
                                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>straighten</span>
                                  <span>
                                    {language === "ja" ? "基準値:" : "Allowed:"}{" "}
                                    <strong className="font-semibold text-primary">
                                      {f.min != null && f.max != null
                                        ? `${f.min} ～ ${f.max} ${f.unit || ""}`
                                        : f.min != null
                                          ? `≥ ${f.min} ${f.unit || ""}`
                                          : `≤ ${f.max} ${f.unit || ""}`}
                                    </strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {f.imageURL && (
                            <button
                              type="button"
                              onClick={() => openFieldPreviewImage(f.imageURL)}
                              className="group relative shrink-0 overflow-hidden rounded-xl border border-separator/40 w-16 h-16 bg-black/5 block shadow-xs transition hover:border-primary hover:shadow-md active:scale-95 cursor-pointer"
                            >
                              <img src={f.imageURL} alt={label} className="w-full h-full object-cover transition group-hover:scale-105" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                                <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>zoom_in</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SensorDevicePhotoPreviewModal
        preview={previewImage ? {
          ...previewImage,
          eyebrow: "Checklist Template Reference Photo",
          displayName: templateName || "Template Reference Photo",
          subtitle: template?.工場 || undefined,
        } : null}
        onClose={() => setPreviewImage(null)}
        onNavigate={handlePreviewNavigate}
      />
    </>
  );
}
