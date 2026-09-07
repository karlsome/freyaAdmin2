import { useEffect, useState } from "react";
import ModalShell from "./ModalShell";
import MaterialDetailModal from "./MaterialDetailModal";
import { query } from "../services/api";

export default function MaterialPDFBulkMatchModal({
  open,
  matchData,
  selectedSerialNumbers = [],
  materialMap = new Map(),
  onClose,
  onConfirm,
}) {
  const [manualAssignments, setManualAssignments] = useState({});
  const [expandedZuban, setExpandedZuban] = useState(null);
  const [excludedMaterialIds, setExcludedMaterialIds] = useState({});
  const [detailModalData, setDetailModalData] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setManualAssignments({});
    setExpandedZuban(null);
    setExcludedMaterialIds({});
  }, [open, matchData]);

  if (!open || !matchData) return null;

  const matched = Array.isArray(matchData.matched) ? matchData.matched : [];
  const toAssign = Array.isArray(matchData.toAssign) ? matchData.toAssign : [];
  const unassignedSerials = Array.isArray(matchData.unassignedSerials) ? matchData.unassignedSerials : [];
  const totalFiles = matched.length + toAssign.length;

  function handleConfirm() {
    const assignments = [
      ...matched.map((item) => ({
        file: item.file,
        drawingNumber: item.drawingNumber,
        excludedMaterialIds: Array.from(excludedMaterialIds[item.drawingNumber] || []),
      })),
      ...toAssign.flatMap((item, index) => {
        const drawingNumber = manualAssignments[index];
        return drawingNumber ? [{
          file: item.file,
          drawingNumber,
          excludedMaterialIds: Array.from(excludedMaterialIds[drawingNumber] || []),
        }] : [];
      }),
    ];

    onConfirm(assignments);
  }

  function toggleExclusion(drawingNumber, materialId) {
    setExcludedMaterialIds((prev) => {
      const currentExclusions = prev[drawingNumber] ? new Set(prev[drawingNumber]) : new Set();
      if (currentExclusions.has(materialId)) {
        currentExclusions.delete(materialId);
      } else {
        currentExclusions.add(materialId);
      }
      return { ...prev, [drawingNumber]: currentExclusions };
    });
  }

  async function handleShowDetails(e, material) {
    e.preventDefault();
    e.stopPropagation();
    
    if (loadingDetailId) return;
    const materialId = material?._id?.$oid || material?._id;
    setLoadingDetailId(materialId);
    try {
      // Use query to fetch the full material details for the modal
      const res = await query("Sasaki_Coating_MasterDB", "materialMasterDB3", { 
        品番: material?.品番
      });
      if (Array.isArray(res) && res.length > 0) {
        setDetailModalData(res[0]);
      } else if (res && res.data && res.data.length > 0) {
        setDetailModalData(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch material details:", err);
    } finally {
      setLoadingDetailId(null);
    }
  }

  function renderMaterialsList(drawingNumber) {
    const materialsGroup = materialMap.get(drawingNumber) || [];
    if (!materialsGroup.length) return null;

    const currentExclusions = excludedMaterialIds[drawingNumber] || new Set();

    return (
      <div className="mt-2 space-y-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Link to specific materials
        </div>
        {materialsGroup.map((material, idx) => {
          const materialId = material?._id?.$oid || material?._id || String(idx);
          const isExcluded = currentExclusions.has(materialId);
          
          return (
            <label
              key={materialId}
              className={`flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 transition hover:bg-[var(--surface-hover)] ${isExcluded ? 'opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={!isExcluded}
                onChange={() => toggleExclusion(drawingNumber, materialId)}
                className="h-3.5 w-3.5 shrink-0 rounded-[3px] border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleShowDetails(e, material)}
                    className="truncate text-xs font-bold text-[var(--freya-blue)] hover:underline"
                    disabled={loadingDetailId === materialId}
                  >
                    {material?.品番 || "No 品番"}
                  </button>
                  {loadingDetailId === materialId && (
                    <span className="material-symbols-outlined animate-spin text-[12px] text-[var(--freya-blue)]">
                      sync
                    </span>
                  )}
                </div>
                <span className="truncate text-[11px] text-[var(--text-secondary)]">
                  工程: {material?.工程コード || "—"} | 品名: {material?.品目マスタ?.品名 || "—"}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="Bulk Match Review"
      title="Review filename matches"
      subtitle={`${totalFiles} files selected. ${matched.length} matched automatically, ${toAssign.length} need manual assignment.`}
      maxWidth="max-w-4xl"
      overlayOpacity="50"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
          >
            Confirm Upload
          </button>
        </div>
      }
    >
      <div className="max-h-[60vh] space-y-3.5 overflow-y-auto px-6 py-4 scrollbar-hide">
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Matched Files</div>
          <div className="mt-2.5 space-y-1.5">
            {matched.length ? matched.map((item) => (
              <div key={`${item.file.name}-${item.drawingNumber}`} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                <div 
                  className="flex cursor-pointer items-center justify-between gap-3 transition hover:opacity-80"
                  onClick={() => setExpandedZuban(expandedZuban === item.drawingNumber ? null : item.drawingNumber)}
                >
                  <span className="truncate text-[var(--text-primary)]">{item.file.name}</span>
                  <div className="flex items-center gap-2">
                    {materialMap.get(item.drawingNumber)?.length > 0 && (
                      <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--freya-blue)]/10 text-[10px] font-bold text-[var(--freya-blue)]">
                        {materialMap.get(item.drawingNumber).length}
                      </span>
                    )}
                    <span className="shrink-0 font-bold text-[var(--freya-blue)]">{item.drawingNumber}</span>
                    <span className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] transition-transform ${expandedZuban === item.drawingNumber ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </div>
                {expandedZuban === item.drawingNumber && renderMaterialsList(item.drawingNumber)}
              </div>
            )) : (
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">No automatic matches were found.</div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Manual Assignment</div>
          <div className="mt-2.5 space-y-2.5">
            {toAssign.length ? toAssign.map((item, index) => {
              const selectedDrawingNumber = manualAssignments[index];
              return (
                <div key={`${item.file.name}-${index}`} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{item.file.name}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    {item.candidates?.length ? `Candidates: ${item.candidates.join(", ")}` : "No filename match found"}
                  </div>

                  <select
                    value={selectedDrawingNumber || ""}
                    onChange={(event) => setManualAssignments((current) => ({
                      ...current,
                      [index]: event.target.value,
                    }))}
                    className="mt-2 h-8.5 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
                  >
                    <option value="">Skip this file</option>
                    {selectedSerialNumbers.map((drawingNumber) => (
                      <option key={`${item.file.name}-${drawingNumber}`} value={drawingNumber}>{drawingNumber}</option>
                    ))}
                  </select>

                  {selectedDrawingNumber && (
                    <div className="mt-2.5">
                      <button 
                        onClick={() => setExpandedZuban(expandedZuban === selectedDrawingNumber ? null : selectedDrawingNumber)}
                        className="flex items-center gap-1 text-xs font-semibold text-[var(--freya-blue)] transition hover:opacity-80"
                      >
                        {expandedZuban === selectedDrawingNumber ? "Hide Materials" : "Select Specific Materials"}
                        {materialMap.get(selectedDrawingNumber)?.length > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--freya-blue)]/10 text-[9px] font-bold text-[var(--freya-blue)]">
                            {materialMap.get(selectedDrawingNumber).length}
                          </span>
                        )}
                        <span className="material-symbols-outlined text-[16px]">
                          {expandedZuban === selectedDrawingNumber ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                      {expandedZuban === selectedDrawingNumber && renderMaterialsList(selectedDrawingNumber)}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">Every file was matched automatically.</div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Selected 図番 Without a File</div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            {unassignedSerials.length ? unassignedSerials.join(", ") : "All selected materials have at least one file match."}
          </div>
        </section>
      </div>

      <MaterialDetailModal modalData={detailModalData} onClose={() => setDetailModalData(null)} />
    </ModalShell>
  );
}
