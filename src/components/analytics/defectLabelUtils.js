/**
 * Utility to resolve defect labels dynamically from defectDefinitions collection
 * or server-provided process defect labels.
 */
export function resolveDefectLabels({
  collectionName = "kensaDB",
  defectAnalysis = [],
  defectDefinitions = [],
  selectedModel = "",
  isJa = true,
}) {
  const analysis = defectAnalysis?.[0] || {};

  // For non-kensaDB processes (pressDB, slitDB, SRSDB), use server-provided defectLabels
  if (collectionName !== "kensaDB") {
    if (Array.isArray(analysis.defectLabels) && analysis.defectLabels.length > 0) {
      return analysis.defectLabels;
    }
  }

  // Generic fallback for kensaDB
  const genericLabels = Array.from({ length: 12 }, (_, i) =>
    isJa ? `カウンター${i + 1}` : `Counter ${i + 1}`
  );

  // If a specific model is selected, look up in defectDefinitions
  if (selectedModel && Array.isArray(defectDefinitions)) {
    const def = defectDefinitions.find((d) => d?.モデル === selectedModel);
    if (def) {
      const src = (!isJa && def.counters_en) ? def.counters_en : def.counters;
      const fallback = (isJa && def.counters_en) ? def.counters_en : def.counters;
      if (src && typeof src === "object") {
        return Array.from({ length: 12 }, (_, i) => {
          const key = `counter-${i + 1}`;
          const name = src[key];
          if (typeof name === "string" && name.trim()) return name.trim();
          const fb = fallback ? fallback[key] : null;
          if (typeof fb === "string" && fb.trim()) return fb.trim();
          return isJa ? `カウンター${i + 1}` : `Counter ${i + 1}`;
        });
      }
    }
  }

  return genericLabels;
}
