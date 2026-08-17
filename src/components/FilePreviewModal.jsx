import { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";

function isVideoUrl(url) {
  return /\.(mp4|mov)$/i.test(url.split("?")[0]);
}

function isPdfUrl(url) {
  return /\.pdf$/i.test(url.split("?")[0]);
}

export default function FilePreviewModal({ url, name, onClose }) {
  const fileURL = String(url || "").trim();

  useEffect(() => {
    if (!fileURL) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [fileURL, onClose]);

  if (!fileURL) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[105] bg-black/75 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => event.stopPropagation()}
          className="flex w-full max-w-5xl h-[90vh] flex-col overflow-hidden rounded-[28px] border border-separator/40 bg-slate-950/95 text-white shadow-[0_32px_100px_rgba(15,23,42,0.28)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-separator/40 px-5 py-4 sm:px-6 shrink-0">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Preview</p>
              <h3 className="mt-1 truncate text-lg font-semibold text-white">{name || "Attached File"}</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">Click outside or press Escape to close.</p>
            </div>
            <IconButton icon="close" onClick={onClose} variant="light" size="xl" ariaLabel="Close dialog" />
          </div>

          <div className="flex flex-1 items-center justify-center bg-black/25 p-4 sm:p-6 w-full min-h-0 overflow-hidden">
            {isVideoUrl(fileURL) ? (
              <video
                src={fileURL}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-[24px] object-contain shadow-2xl"
              />
            ) : isPdfUrl(fileURL) ? (
              <iframe 
                src={fileURL} 
                className="w-full h-full rounded-[24px] shadow-2xl bg-white" 
                title={name || "PDF Preview"} 
              />
            ) : (
              <img
                src={fileURL}
                alt={name || "Preview"}
                className="max-h-full max-w-full rounded-[24px] object-contain shadow-2xl"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-separator/40 px-5 py-4 sm:px-6 shrink-0">
            <a
              href={fileURL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Open in new tab
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
