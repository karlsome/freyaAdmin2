import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";

function isVideoUrl(url) {
  return /\.(mp4|mov|webm)$/i.test(url.split("?")[0]);
}

function isImageUrl(url) {
  return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url.split("?")[0]);
}

export default function EquipmentEventPreviewModal({ event, onClose, onEdit, onExpand }) {
  const { language, t } = useLanguage();
  const [previewState, setPreviewState] = useState(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  if (!event) return null;

  const title = language === "ja" ? (event.title_ja || event.title) : (event.title_en || event.title);
  const details = language === "ja" ? (event.details_ja || event.details) : (event.details_en || event.details);

  const issueVideos = (event.imageURLs || []).filter(isVideoUrl);
  const issueImages = (event.imageURLs || []).filter(isImageUrl);
  const issueMedia = [...issueVideos, ...issueImages];

  const attempts = event.attempts || [];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-4xl max-h-full flex flex-col bg-surface rounded-2xl shadow-xl border border-separator/20 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-separator/20 bg-surface-container-lowest shrink-0">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
              event.status === "Resolved" ? "bg-primary/10 text-primary" :
              event.status === "Failed" ? "bg-error/10 text-error" :
              "bg-surface-container-high text-on-surface-variant"
            }`}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {event.status === "Resolved" ? "check_circle" : event.status === "Failed" ? "error" : "info"}
              </span>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-0.5">
                {event.date} • {event["工場"]} / {event.equipmentName}
              </p>
              <h3 className="text-base font-bold text-on-surface line-clamp-1">{title || t("equipmentEventFallback")}</h3>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => onExpand(event)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
            >
              {t("fullView")}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* Top Info Section */}
          <div className="flex flex-wrap items-start gap-8 border-b border-separator/20 pb-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">{t("status")}</div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold ${
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Issue Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface border-b border-separator/40 pb-2">{t("issueDetails")}</h3>
              <div className="text-sm text-on-surface-variant whitespace-pre-wrap">
                {details || <span className="italic text-outline">{t("noDetailsProvided")}</span>}
              </div>

              {issueMedia.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">
                    {t("attachments")} {issueMedia.length > 1 && `(${activeMediaIndex + 1} / ${issueMedia.length})`}
                  </div>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/5 border border-separator/20 group select-none">
                    {isVideoUrl(issueMedia[activeMediaIndex]) ? (
                      <div 
                        className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity relative"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setPreviewState({
                            images: issueMedia.map(u => ({ url: u, label: t("eventFileLabel") })),
                            activeIndex: activeMediaIndex,
                            displayName: t("reportAttachments"),
                            eyebrow: title || t("eventFallback")
                          });
                        }}
                      >
                        <video src={issueMedia[activeMediaIndex] + "#t=0.001"} preload="metadata" className="w-full h-full object-contain pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="material-symbols-outlined text-white drop-shadow-md" style={{ fontSize: 48 }}>play_circle</span>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setPreviewState({
                            images: issueMedia.map(u => ({ url: u, label: t("eventFileLabel") })),
                            activeIndex: activeMediaIndex,
                            displayName: t("reportAttachments"),
                            eyebrow: title || t("eventFallback")
                          });
                        }}
                      >
                        <img src={issueMedia[activeMediaIndex]} alt={t("issueTitle")} className="w-full h-full object-contain pointer-events-none" />
                      </div>
                    )}
                    
                    {issueMedia.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMediaIndex((prev) => (prev - 1 + issueMedia.length) % issueMedia.length);
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMediaIndex((prev) => (prev + 1) % issueMedia.length);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Attempts List */}
            <div className="flex flex-col h-full max-h-[500px]">
              <h3 className="text-sm font-bold text-on-surface border-b border-separator/40 pb-2 mb-4 flex items-center justify-between shrink-0">
                {t("troubleshootingAttempts")}
                <span className="text-[10px] font-semibold uppercase text-outline tracking-wider bg-surface-container px-2 py-0.5 rounded">
                  {attempts.length} {t("totalSuffix")}
                </span>
              </h3>
              
              <div className="overflow-y-auto pr-2 space-y-8 pb-4">
                {attempts.length > 0 ? (
                  attempts.map((att, idx) => {
                    const attTitle = language === "ja" ? (att.title_ja || att.title) : (att.title_en || att.title);
                    const attDesc = language === "ja" ? (att.fixDescription_ja || att.fixDescription) : (att.fixDescription_en || att.fixDescription);
                    const attResult = language === "ja" ? (att.result_ja || att.result) : (att.result_en || att.result);
                    const attVideos = (att.imageURLs || []).filter(isVideoUrl);
                    const attImages = (att.imageURLs || []).filter(isImageUrl);

                    const attMedia = [...attVideos, ...attImages];

                    return (
                      <div key={idx} className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-outline">#{att.attemptNumber || idx + 1}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              att.status === "Success" ? "bg-primary/10 text-primary" :
                              att.status === "Failed" ? "bg-error/10 text-error" :
                              "bg-surface-container-high text-on-surface-variant"
                            }`}>
                              {att.status === "Success" ? t("attemptStatusSuccess") : att.status === "Failed" ? t("attemptStatusFailed") : t("statusUnknown")}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-on-surface">{attTitle || t("untitledAttempt")}</h4>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-outline mb-1">{t("actionTaken")}</div>
                            <div className="text-sm text-on-surface-variant whitespace-pre-wrap">{attDesc || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-outline mb-1">{t("result")}</div>
                            <div className="text-sm text-on-surface-variant whitespace-pre-wrap">{attResult || "—"}</div>
                          </div>
                        </div>

                        {(attVideos.length > 0 || attImages.length > 0) && (
                          <div className="pt-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">{t("attachments")}</div>
                            <div className="flex gap-2 flex-wrap">
                              {attVideos.map((url, i) => (
                                <div 
                                  key={`att-vid-${i}`} 
                                  className="relative w-12 h-12 rounded-md overflow-hidden border border-separator/30 bg-surface-container cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const mediaIdx = attMedia.indexOf(url);
                                    setPreviewState({
                                      images: attMedia.map(u => ({ url: u, label: t("attemptFileLabel") })),
                                      activeIndex: mediaIdx >= 0 ? mediaIdx : 0,
                                      displayName: t("attemptAttachments"),
                                      eyebrow: attTitle || t("attemptLabel")
                                    });
                                  }}
                                >
                                  <video src={url + "#t=0.001"} preload="metadata" className="w-full h-full object-cover bg-black pointer-events-none" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <span className="material-symbols-outlined text-white drop-shadow-md" style={{ fontSize: 16 }}>play_circle</span>
                                  </div>
                                </div>
                              ))}
                              {attImages.map((url, i) => (
                                <div 
                                  key={`att-img-${i}`} 
                                  className="w-12 h-12 rounded-md overflow-hidden border border-separator/30 bg-surface-container cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const mediaIdx = attMedia.indexOf(url);
                                    setPreviewState({
                                      images: attMedia.map(u => ({ url: u, label: t("attemptFileLabel") })),
                                      activeIndex: mediaIdx >= 0 ? mediaIdx : 0,
                                      displayName: t("attemptAttachments"),
                                      eyebrow: attTitle || t("attemptLabel")
                                    });
                                  }}
                                >
                                  <img src={url} alt={t("attemptLabel")} className="w-full h-full object-cover pointer-events-none" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-outline italic">
                    {t("noAttemptsRecorded")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 px-6 bg-surface-container-lowest border-t border-separator/20 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            {t("edit")}
          </button>

          <button
            type="button"
            onClick={() => onExpand(event)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            {t("openFullTimeline")}
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
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
    </div>,
    document.body
  );
}
