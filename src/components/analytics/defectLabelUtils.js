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

/**
 * Wraps long defect labels into multiline arrays for Chart.js labels.
 * Splits on common separators (spaces, slashes, commas, Japanese delimiters)
 * while keeping words whole so full defect names remain completely readable without ellipses.
 */
export function wrapLabelToLines(label, maxCharsPerLine = 18) {
  if (!label || typeof label !== "string") return label || "";
  if (label.length <= maxCharsPerLine) return label;

  const tokens = label.match(/[^ \t/・、,()（）]+[ \t/・、,()（）]*/g) || [label];
  const lines = [];
  let current = "";

  for (const token of tokens) {
    if (!token) continue;
    if ((current + token).trim().length <= maxCharsPerLine) {
      current += token;
    } else {
      if (current.trim()) lines.push(current.trim());
      current = token;
    }
  }
  if (current.trim()) lines.push(current.trim());

  return lines.length > 1 ? lines : label;
}
