import { useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { formatProductPDFTitle } from "../utils/productPDFs";
import IconButton from "./IconButton";

export default function ProductPDFPreviewModal({ item, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const modalRef = useRef(null);

  useEffect(() => {
    if (!item) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    function handleMouseDown(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="freya-card flex w-full max-w-5xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {isJa ? "プレビュー" : "Preview"}
              </div>
              <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">{formatProductPDFTitle(item)}</h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {item.fileName || (isJa ? "名称未設定ファイル" : "Untitled file")}
              </p>
            </div>

            <IconButton icon="close" onClick={onClose} size="md" ariaLabel={isJa ? "閉じる" : "Close dialog"} />
          </div>

          <div className="flex min-h-[50vh] items-center justify-center bg-[var(--surface-subtle)] p-4">
            {item.imageURL ? (
              <img src={item.imageURL} alt={item.fileName} className="max-h-[68vh] max-w-full rounded-[6px] border border-[var(--border)] object-contain shadow-md" />
            ) : (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-xs text-[var(--text-muted)]">
                {isJa ? "このファイルのプレビュー画像はありません。" : "Preview image not available for this file."}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3.5">
            {item.imageURL && (
              <a
                href={item.imageURL}
                target="_blank"
                rel="noreferrer"
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                {isJa ? "プレビュー画像を開く" : "Open Preview Image"}
              </a>
            )}
            {item.pdfURL && (
              <a
                href={item.pdfURL}
                target="_blank"
                rel="noreferrer"
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
              >
                {isJa ? "PDF原本を開く" : "Open Original PDF"}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}