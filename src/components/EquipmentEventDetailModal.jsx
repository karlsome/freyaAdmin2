import React, { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";

function isVideoUrl(url) {
  return /\.(mp4|mov|webm)$/i.test(url.split("?")[0]);
}

function isImageUrl(url) {
  return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url.split("?")[0]);
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce(
    (str, [key, value]) => str.replace(`{${key}}`, value),
    template
  );
}

export default function EquipmentEventDetailModal({ event, onClose, onEdit }) {
  const { language, t } = useLanguage();
  const [previewState, setPreviewState] = useState(null);
  const [expandedIndices, setExpandedIndices] = useState(() => new Set());

  useEffect(() => {
    setExpandedIndices(new Set());
  }, [event?._id?.$oid ?? event?._id]);

  if (!event) return null;

  const title = language === "ja" ? (event.title_ja || event.title) : (event.title_en || event.title);
  const details = language === "ja" ? (event.details_ja || event.details) : (event.details_en || event.details);

  return (
    <div className="dashboard-section rounded-2xl shadow-sm flex flex-col slide-in-from-right animate-in fade-in duration-300 border border-separator/20 bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 flex h-[72px] shrink-0 items-center justify-between rounded-t-2xl border-b border-separator/40 bg-surface/95 px-6 backdrop-blur-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
            {t("recordDetails")}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-on-surface">
            {title || t("equipmentEventFallback")}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all shadow-md"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            {t("editRecordAction")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="p-6">
        <div className="max-w-5xl mx-auto space-y-10">
          
          {/* Top Info Section */}
          <div className="bg-surface p-6 rounded-2xl border border-separator/30 shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1.5">{t("status")}</div>
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-bold ${
                event.status === "Resolved" ? "bg-primary/10 text-primary" :
                event.status === "Failed" ? "bg-error/10 text-error" :
                "bg-surface-container-high text-on-surface-variant"
              }`}>
                {event.status === "Resolved" ? "✅" : event.status === "Failed" ? "❌" : "🔴"}{" "}
                {event.status === "Resolved" ? t("statusResolved") : event.status === "Failed" ? t("statusFailed") : t("statusOpen")}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">{t("date")}</div>
              <div className="text-sm font-medium text-on-surface">{event.date || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">{t("factoryAndMachine")}</div>
              <div className="text-sm font-medium text-on-surface">{event["工場"]} / {event.equipmentName}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">{t("reportedBy")}</div>
              <div className="text-sm font-medium text-on-surface">{event["名前"] || "—"}</div>
            </div>
            {event.resolutionTime && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">{t("totalTime")}</div>
                <div className="text-sm font-medium text-on-surface">{event.resolutionTime} {t("hrsSuffix")}</div>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="bg-surface-container/30 p-6 rounded-2xl border border-separator/20 space-y-4">
            <h3 className="text-sm font-bold text-on-surface border-b border-separator/40 pb-2">{t("issueDetails")}</h3>
            <div className="text-base text-on-surface-variant whitespace-pre-wrap">
              {details || <span className="italic text-outline">{t("noDetailsProvided")}</span>}
            </div>
            {event.imageURLs && event.imageURLs.length > 0 && (() => {
              const videos = event.imageURLs.filter(isVideoUrl);
              const images = event.imageURLs.filter(isImageUrl);
              const others = event.imageURLs.filter(u => !isVideoUrl(u) && !isImageUrl(u));
              
              const allMedia = [...videos, ...images]; // for the carousel
              const openPreview = (url) => {
                const idx = allMedia.indexOf(url);
                if (idx >= 0) {
                  setPreviewState({
                    images: allMedia.map(u => ({ url: u, label: t("eventFileLabel") })),
                    activeIndex: idx,
                    displayName: t("reportAttachments"),
                    eyebrow: title || t("eventFallback")
                  });
                } else {
                  window.open(url, "_blank");
                }
              };

              return (
                <div className="space-y-4 pt-4">
                  {videos.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("videos")}</div>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {videos.map((url, i) => (
                          <div key={i} className="relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-separator/30 bg-surface-container cursor-pointer hover:opacity-80 transition-opacity group" onClick={() => openPreview(url)}>
                            <video src={url + "#t=0.001"} preload="metadata" className="w-full h-full object-cover bg-black" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                              <span className="material-symbols-outlined text-white drop-shadow-md" style={{ fontSize: 40 }}>play_circle</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {images.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("images")}</div>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {images.map((url, i) => (
                          <div key={i} className="flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-separator/30 bg-surface-container cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openPreview(url)}>
                            <img src={url} alt={t("issueTitle")} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {others.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("otherFiles")}</div>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {others.map((url, i) => (
                          <div key={i} className="flex-shrink-0 w-16 h-16 rounded-xl border border-separator/30 bg-surface-container flex items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors" onClick={() => window.open(url, "_blank")}>
                            <span className="material-symbols-outlined text-outline" style={{ fontSize: 24 }}>insert_drive_file</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Attempts Timeline */}
          {event.attempts && event.attempts.length > 0 && (() => {
            const attemptsCount = event.attempts.length;
            const isAllExpanded = attemptsCount > 0 && expandedIndices.size === attemptsCount;

            const toggleExpandAll = () => {
              if (isAllExpanded) {
                setExpandedIndices(new Set());
              } else {
                setExpandedIndices(new Set(event.attempts.map((_, i) => i)));
              }
            };

            const toggleExpand = (idx) => {
              setExpandedIndices((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) {
                  next.delete(idx);
                } else {
                  next.add(idx);
                }
                return next;
              });
            };

            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-separator/40 pb-2">
                  <h3 className="text-sm font-bold text-on-surface">{t("troubleshootingTimeline")}</h3>
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {isAllExpanded ? "unfold_less" : "unfold_more"}
                    </span>
                    {isAllExpanded ? t("collapseAll") : t("expandAll")}
                  </button>
                </div>
                
                <div className="relative border-l-2 border-separator/40 ml-4 space-y-6 pb-8">
                  {event.attempts.map((att, idx) => {
                    const attTitle = language === "ja" ? (att.title_ja || att.title) : (att.title_en || att.title);
                    const attDesc = language === "ja" ? (att.fixDescription_ja || att.fixDescription) : (att.fixDescription_en || att.fixDescription);
                    const attResult = language === "ja" ? (att.result_ja || att.result) : (att.result_en || att.result);
                    const isExpanded = expandedIndices.has(idx);
                    const prevAtt = idx > 0 ? event.attempts[idx - 1] : null;
                    const dayGap = prevAtt?.date && att.date
                      ? Math.round((new Date(att.date) - new Date(prevAtt.date)) / 86400000)
                      : null;

                    return (
                      <div key={idx} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-surface ${
                          att.status === "Success" ? "bg-emerald-500" :
                          att.status === "Failed" ? "bg-error" :
                          "bg-surface-container-high"
                        }`} />

                        {dayGap !== null && dayGap > 0 && (
                          <div className="mb-2 flex items-center gap-1 text-[11px] font-medium text-outline">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                            {fillTemplate(t("daysLaterTemplate"), { days: dayGap })}
                          </div>
                        )}

                        {/* Attempt Card */}
                        <div className="bg-surface rounded-2xl shadow-sm border border-separator/20 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleExpand(idx)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-container/40 transition-colors"
                          >
                            <span className="text-xs font-bold text-outline shrink-0">#{att.attemptNumber || idx + 1}</span>
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              att.status === "Success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                              att.status === "Failed" ? "bg-error/10 text-error" :
                              "bg-surface-container-high text-on-surface-variant"
                            }`}>
                              {att.status === "Success" ? t("attemptStatusSuccess") : att.status === "Failed" ? t("attemptStatusFailed") : t("statusUnknown")}
                            </span>
                            <span className="text-sm font-bold text-on-surface flex-1 truncate">{attTitle || t("untitledAttempt")}</span>
                            {att.timeToResolve ? (
                              <span className="hidden sm:inline text-xs text-on-surface-variant shrink-0">{att.timeToResolve} {t("hrsSuffix")}</span>
                            ) : null}
                            <span className="text-xs text-on-surface-variant shrink-0">{att.date || "—"}</span>
                            <span className="material-symbols-outlined text-outline shrink-0" style={{ fontSize: 20 }}>
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                          </button>

                        {isExpanded && (
                        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-separator/20">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-outline mb-1.5">{t("actionTaken")}</div>
                            <div className="text-sm text-on-surface-variant whitespace-pre-wrap">{attDesc || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-outline mb-1.5">{t("result")}</div>
                            <div className="text-sm text-on-surface-variant whitespace-pre-wrap">{attResult || "—"}</div>
                          </div>
                        </div>

                        {att.imageURLs && att.imageURLs.length > 0 && (() => {
                          const attVideos = att.imageURLs.filter(isVideoUrl);
                          const attImages = att.imageURLs.filter(isImageUrl);
                          const attOthers = att.imageURLs.filter(u => !isVideoUrl(u) && !isImageUrl(u));
                          
                          const allAttMedia = [...attVideos, ...attImages];
                          const openAttPreview = (url) => {
                            const idx = allAttMedia.indexOf(url);
                            if (idx >= 0) {
                              setPreviewState({
                                images: allAttMedia.map(u => ({ url: u, label: t("attemptFileLabel") })),
                                activeIndex: idx,
                                displayName: attTitle || fillTemplate(t("attemptNumberTemplate"), { number: att.attemptNumber || idx + 1 }),
                                eyebrow: title || t("eventFallback")
                              });
                            } else {
                              window.open(url, "_blank");
                            }
                          };

                          return (
                            <div className="pt-2 space-y-4">
                              {attVideos.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("videos")}</div>
                                  <div className="flex flex-wrap gap-3">
                                    {attVideos.map((url, i) => (
                                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-separator/30 bg-surface-container cursor-pointer hover:opacity-80 transition-opacity group" onClick={() => openAttPreview(url)}>
                                        <video src={url + "#t=0.001"} preload="metadata" className="w-full h-full object-cover bg-black" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                          <span className="material-symbols-outlined text-white drop-shadow-md" style={{ fontSize: 32 }}>play_circle</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {attImages.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("images")}</div>
                                  <div className="flex flex-wrap gap-3">
                                    {attImages.map((url, i) => (
                                      <div key={i} className="w-24 h-24 rounded-lg overflow-hidden border border-separator/30 bg-surface-container cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openAttPreview(url)}>
                                        <img src={url} alt={t("attemptFileLabel")} className="w-full h-full object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {attOthers.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("otherFiles")}</div>
                                  <div className="flex flex-wrap gap-3">
                                    {attOthers.map((url, i) => (
                                      <div key={i} className="w-12 h-12 rounded-lg border border-separator/30 bg-surface-container flex items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors" onClick={() => window.open(url, "_blank")}>
                                        <span className="material-symbols-outlined text-outline" style={{ fontSize: 20 }}>insert_drive_file</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {att.fixedBy && att.fixedBy.length > 0 && (
                          <div className="flex justify-end pt-2 border-t border-separator/20">
                            <div className="text-xs text-on-surface-variant">
                              <span className="text-outline">{t("personnel")}:</span> {att.fixedBy.join(", ")}
                            </div>
                          </div>
                        )}
                        </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        </div>
      </div>
      
      {previewState && (
        <SensorDevicePhotoPreviewModal 
          preview={previewState} 
          onClose={() => setPreviewState(null)} 
          onNavigate={(dir) => {
            setPreviewState(prev => prev ? { ...prev, activeIndex: prev.activeIndex + dir } : null);
          }} 
        />
      )}
    </div>
  );
}
