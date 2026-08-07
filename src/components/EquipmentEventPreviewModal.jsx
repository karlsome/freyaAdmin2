import React from "react";
import { useLanguage } from "../contexts/LanguageContext";

function isVideoUrl(url) {
  return /\.(mp4|mov|webm)$/i.test(url.split("?")[0]);
}

function isImageUrl(url) {
  return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url.split("?")[0]);
}

export default function EquipmentEventPreviewModal({ event, onClose, onEdit, onExpand }) {
  const { language } = useLanguage();

  if (!event) return null;

  const title = language === "ja" ? (event.title_ja || event.title) : (event.title_en || event.title);
  const details = language === "ja" ? (event.details_ja || event.details) : (event.details_en || event.details);

  const issueVideos = (event.imageURLs || []).filter(isVideoUrl);
  const issueImages = (event.imageURLs || []).filter(isImageUrl);

  const attempts = event.attempts || [];
  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  let attTitle = "";
  let attDesc = "";
  let attResult = "";
  let attVideos = [];
  let attImages = [];

  if (latestAttempt) {
    attTitle = language === "ja" ? (latestAttempt.title_ja || latestAttempt.title) : (latestAttempt.title_en || latestAttempt.title);
    attDesc = language === "ja" ? (latestAttempt.fixDescription_ja || latestAttempt.fixDescription) : (latestAttempt.fixDescription_en || latestAttempt.fixDescription);
    attResult = language === "ja" ? (latestAttempt.result_ja || latestAttempt.result) : (latestAttempt.result_en || latestAttempt.result);
    attVideos = (latestAttempt.imageURLs || []).filter(isVideoUrl);
    attImages = (latestAttempt.imageURLs || []).filter(isImageUrl);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-12 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
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
              <h3 className="text-base font-bold text-on-surface line-clamp-1">{title || "Equipment Event"}</h3>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => onExpand(event)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
            >
              Full View
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">Status</div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold ${
                event.status === "Resolved" ? "bg-primary/10 text-primary" :
                event.status === "Failed" ? "bg-error/10 text-error" :
                "bg-surface-container-high text-on-surface-variant"
              }`}>
                {event.status === "Resolved" ? "✅" : event.status === "Failed" ? "❌" : "🔴"} {event.status || "Open"}
              </span>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">Date</div>
              <div className="text-sm font-medium text-on-surface">{event.date || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">Factory & Machine</div>
              <div className="text-sm font-medium text-on-surface">{event["工場"]} / {event.equipmentName}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">Reported By</div>
              <div className="text-sm font-medium text-on-surface">{event["名前"] || "—"}</div>
            </div>
            {event.resolutionTime && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-1">Total Time</div>
                <div className="text-sm font-medium text-on-surface">{event.resolutionTime} hrs</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Issue Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface border-b border-separator/40 pb-2">Issue Details</h3>
              <div className="text-sm text-on-surface-variant whitespace-pre-wrap">
                {details || <span className="italic text-outline">No details provided.</span>}
              </div>
              
              {(issueVideos.length > 0 || issueImages.length > 0) && (
                <div className="pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">Attachments</div>
                  <div className="flex gap-2 flex-wrap">
                    {issueVideos.map((url, i) => (
                      <div key={`vid-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-separator/30 bg-surface-container">
                        <video src={url + "#t=0.001"} preload="metadata" className="w-full h-full object-cover bg-black" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="material-symbols-outlined text-white drop-shadow-md" style={{ fontSize: 24 }}>play_circle</span>
                        </div>
                      </div>
                    ))}
                    {issueImages.map((url, i) => (
                      <div key={`img-${i}`} className="w-16 h-16 rounded-lg overflow-hidden border border-separator/30 bg-surface-container">
                        <img src={url} alt="Issue" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Latest Attempt */}
            <div>
              <h3 className="text-sm font-bold text-on-surface border-b border-separator/40 pb-2 flex items-center justify-between">
                Latest Attempt
                {attempts.length > 1 && (
                  <span className="text-[10px] font-semibold uppercase text-outline tracking-wider bg-surface-container px-2 py-0.5 rounded">
                    {attempts.length} Total
                  </span>
                )}
              </h3>
              
              {latestAttempt ? (
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-outline">#{latestAttempt.attemptNumber || attempts.length}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        latestAttempt.status === "Success" ? "bg-primary/10 text-primary" :
                        latestAttempt.status === "Failed" ? "bg-error/10 text-error" :
                        "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        {latestAttempt.status || "Unknown"}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-on-surface">{attTitle || "Untitled Attempt"}</h4>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-outline mb-1">Action Taken</div>
                      <div className="text-sm text-on-surface-variant whitespace-pre-wrap">{attDesc || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-outline mb-1">Result</div>
                      <div className="text-sm text-on-surface-variant whitespace-pre-wrap">{attResult || "—"}</div>
                    </div>
                  </div>

                  {(attVideos.length > 0 || attImages.length > 0) && (
                    <div className="pt-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-2">Attachments</div>
                      <div className="flex gap-2 flex-wrap">
                        {attVideos.map((url, i) => (
                          <div key={`att-vid-${i}`} className="relative w-12 h-12 rounded-md overflow-hidden border border-separator/30 bg-surface-container">
                            <video src={url + "#t=0.001"} preload="metadata" className="w-full h-full object-cover bg-black" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <span className="material-symbols-outlined text-white drop-shadow-md" style={{ fontSize: 16 }}>play_circle</span>
                            </div>
                          </div>
                        ))}
                        {attImages.map((url, i) => (
                          <div key={`att-img-${i}`} className="w-12 h-12 rounded-md overflow-hidden border border-separator/30 bg-surface-container">
                            <img src={url} alt="Attempt" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-4 text-sm text-outline italic">
                  No attempts recorded yet.
                </div>
              )}
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
            Edit
          </button>
          
          <button
            type="button"
            onClick={() => onExpand(event)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            Open Full Timeline
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
