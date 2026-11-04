import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ModalShell from "./ModalShell";

export default function ProductPDFBulkMatchModal({
  open,
  matchData,
  selectedSerialNumbers = [],
  onClose,
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [manualAssignments, setManualAssignments] = useState({});

  useEffect(() => {
    if (!open) return;
    setManualAssignments({});
  }, [open, matchData]);

  if (!open || !matchData) return null;

  const matched = Array.isArray(matchData.matched) ? matchData.matched : [];
  const toAssign = Array.isArray(matchData.toAssign) ? matchData.toAssign : [];
  const unassignedSerials = Array.isArray(matchData.unassignedSerials) ? matchData.unassignedSerials : [];
  const totalFiles = matched.length + toAssign.length;

  function handleConfirm() {
    const assignments = [
      ...matched.map((item) => ({ file: item.file, serialNumber: item.serialNumber })),
      ...toAssign.flatMap((item, index) => {
        const serialNumber = manualAssignments[index];
        return serialNumber ? [{ file: item.file, serialNumber }] : [];
      }),
    ];

    onConfirm(assignments);
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isJa ? "一括照合確認" : "Bulk Match Review"}
      title={isJa ? "ファイル名の一致を確認" : "Review filename matches"}
      subtitle={
        isJa
          ? `${totalFiles} 件のファイルが選択されました。${matched.length} 件が自動照合され、${toAssign.length} 件の手動割り当てが必要です。`
          : `${totalFiles} files selected. ${matched.length} matched automatically, ${toAssign.length} need manual assignment.`
      }
      maxWidth="max-w-4xl"
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
            onClick={handleConfirm}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            {isJa ? "アップロードを確定" : "Confirm Upload"}
          </button>
        </div>
      }
    >
      <div className="max-h-[60vh] space-y-3.5 overflow-y-auto px-6 py-4 scrollbar-hide">
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {isJa ? "一致したファイル" : "Matched Files"}
          </div>
          <div className="mt-2.5 space-y-1.5">
            {matched.length ? matched.map((item) => (
              <div key={`${item.file.name}-${item.serialNumber}`} className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                <span className="truncate text-[var(--text-primary)]">{item.file.name}</span>
                <span className="shrink-0 font-bold text-[var(--freya-blue)]">{item.serialNumber}</span>
              </div>
            )) : (
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
                {isJa ? "自動一致したファイルはありません。" : "No automatic matches were found."}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {isJa ? "手動割り当て" : "Manual Assignment"}
          </div>
          <div className="mt-2.5 space-y-2.5">
            {toAssign.length ? toAssign.map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-bold text-[var(--text-primary)]">{item.file.name}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  {item.candidates?.length
                    ? `${isJa ? "候補: " : "Candidates: "}${item.candidates.join(", ")}`
                    : (isJa ? "一致するファイル名が見つかりません" : "No filename match found")}
                </div>

                <select
                  value={manualAssignments[index] || ""}
                  onChange={(event) => setManualAssignments((current) => ({
                    ...current,
                    [index]: event.target.value,
                  }))}
                  className="mt-2 h-8.5 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                >
                  <option value="">{isJa ? "このファイルをスキップ" : "Skip this file"}</option>
                  {selectedSerialNumbers.map((serialNumber) => (
                    <option key={`${item.file.name}-${serialNumber}`} value={serialNumber}>{serialNumber}</option>
                  ))}
                </select>
              </div>
            )) : (
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
                {isJa ? "すべてのファイルが自動照合されました。" : "Every file was matched automatically."}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {isJa ? "ファイルが未割り当ての背番号" : "Selected 背番号 Without a File"}
          </div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            {unassignedSerials.length
              ? unassignedSerials.join(", ")
              : (isJa ? "選択されたすべての製品にファイルが照合されています。" : "All selected products have at least one file match.")}
          </div>
        </section>
      </div>
    </ModalShell>
  );
}