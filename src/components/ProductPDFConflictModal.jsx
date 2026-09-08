import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { formatProductPDFDateTime } from "../utils/productPDFs";
import ModalShell from "./ModalShell";

export default function ProductPDFConflictModal({ open, conflicts, onClose, onConfirm }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    if (!open || !conflicts?.existing) return;

    const defaults = {};
    conflicts.existing.forEach((item) => {
      defaults[item.背番号] = Array.isArray(item.pdfs) && item.pdfs.length > 1 ? "all" : "overwrite";
    });
    setResolutions(defaults);
  }, [open, conflicts]);

  if (!open || !conflicts) return null;

  const existing = Array.isArray(conflicts.existing) ? conflicts.existing : [];
  const newProducts = Array.isArray(conflicts.newProducts) ? conflicts.newProducts : [];

  return (
    <ModalShell
      open={!!open}
      onClose={onClose}
      eyebrow={isJa ? "重複確認" : "Conflict Check"}
      title={isJa ? "既存のPDFが検出されました" : "Existing PDFs Detected"}
      subtitle={
        isJa
          ? `${existing.length} 件の製品に既に${conflicts.pdfType ? `「${conflicts.pdfType}」` : ""}ファイルが存在します。処理方法を選択してください。`
          : `${existing.length} product(s) already have ${conflicts.pdfType || "this type of"} files. Choose how each one should be handled.`
      }
      maxWidth="max-w-3xl"
      overlayOpacity="50"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(resolutions)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            {isJa ? "アップロードを続行" : "Continue Upload"}
          </button>
        </div>
      }
    >
      <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-4 scrollbar-hide">
        <div className="space-y-2.5">
          {existing.map((item) => {
            const pdfCount = Array.isArray(item.pdfs) ? item.pdfs.length : 0;
            const selectValue = resolutions[item.背番号] || (pdfCount > 1 ? "all" : "overwrite");

            return (
              <div key={item.背番号} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{item.背番号}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {isJa ? `既存ファイル: ${pdfCount} 件` : `${pdfCount} existing file${pdfCount === 1 ? "" : "s"}`}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {(item.pdfs || []).map((pdf) => formatProductPDFDateTime(pdf?.uploadedAt)).join(" / ") || (isJa ? "アップロード日時不明" : "Unknown upload dates")}
                    </div>
                  </div>

                  <select
                    value={selectValue}
                    onChange={(event) => setResolutions((current) => ({
                      ...current,
                      [item.背番号]: event.target.value,
                    }))}
                    className="h-8.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                  >
                    {pdfCount > 1 ? (
                      <>
                        <option value="all">{isJa ? "すべて上書き" : "Overwrite all"}</option>
                        <option value="newest">{isJa ? "最新のみ上書き" : "Overwrite newest only"}</option>
                        <option value="skip">{isJa ? "この製品をスキップ" : "Skip this product"}</option>
                      </>
                    ) : (
                      <>
                        <option value="overwrite">{isJa ? "上書き" : "Overwrite"}</option>
                        <option value="skip">{isJa ? "この製品をスキップ" : "Skip this product"}</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {newProducts.length > 0 && (
          <div className="rounded-[8px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--freya-blue)]">
              {isJa ? "重複なし" : "No Conflict"}
            </div>
            <div className="mt-1 text-xs text-[var(--text-primary)]">
              {newProducts.join(", ")}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
