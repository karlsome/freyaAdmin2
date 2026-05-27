import { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";

export default function CheckFormImageLightboxModal({ image, onClose }) {
  const imageURL = String(image?.imageURL || "").trim();

  useEffect(() => {
    if (!imageURL) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [imageURL, onClose]);

  if (!imageURL) return null;

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
          className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 text-white shadow-[0_32px_100px_rgba(15,23,42,0.28)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Preview</p>
              <h3 className="mt-1 truncate text-lg font-black text-white">{image.name || "Reference image"}</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">Click outside or press Escape to close.</p>
            </div>

            <IconButton icon="close" onClick={onClose} variant="light" size="xl" ariaLabel="Close dialog" />
          </div>

          <div className="flex min-h-[50vh] items-center justify-center bg-black/25 p-4 sm:p-6">
            <img
              src={imageURL}
              alt={image.name || "Reference image"}
              className="max-h-[72vh] max-w-full rounded-[24px] object-contain shadow-2xl"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
            <a
              href={imageURL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
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