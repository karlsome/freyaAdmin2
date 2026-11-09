let pdfRuntimePromise;

async function loadPdfRuntime() {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }

  return pdfRuntimePromise;
}

export const MATERIAL_PDF_TYPES = [
  { key: "作業条件表", label: "作業条件表", description: "Operation Standards" },
  { key: "その他1", label: "その他1", description: "Other" },
  { key: "その他2", label: "その他2", description: "Other" },
];

export const DEFAULT_MATERIAL_PDF_TYPE = MATERIAL_PDF_TYPES[0].key;
export const MATERIAL_PDF_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function getMaterialPDFTypeMeta(typeKey = DEFAULT_MATERIAL_PDF_TYPE) {
  return MATERIAL_PDF_TYPES.find((type) => type.key === typeKey) || MATERIAL_PDF_TYPES[0];
}

export function sortMaterialRecords(materials = []) {
  return [...materials]
    .filter((material) => material && typeof material === "object")
    .sort((left, right) => {
      const leftZuban = String(left.図番 || "");
      const rightZuban = String(right.図番 || "");
      return leftZuban.localeCompare(rightZuban, "ja");
    });
}

export function getMaterialPDFProcessOptions(materials = []) {
  return [...new Set(materials.map((material) => material?.工程コード).filter(Boolean))].sort((left, right) =>
    String(left).localeCompare(String(right), "ja")
  );
}

export function filterSelectableMaterials(materials = [], { searchTerm = "", filterType = "process", selectedProcess = "" } = {}) {
  const normalizedSearch = String(searchTerm || "").trim().toLowerCase();

  return sortMaterialRecords(materials).filter((material) => {
    if (!material?.図番) return false;

    const matchesProcess = filterType !== "process" || !selectedProcess || material.工程コード === selectedProcess;
    if (!matchesProcess) return false;

    if (!normalizedSearch) return true;

    const haystack = [material.図番, material.品番, material.品名, material.工程コード]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

export function getMaterialSelectionForProcess(materials = [], processCode = "") {
  if (!processCode) return [];
  return sortMaterialRecords(materials)
    .filter((material) => material?.工程コード === processCode && material?.図番)
    .map((material) => String(material.図番));
}

export function getMaterialRecordMap(materials = []) {
  const map = new Map();
  sortMaterialRecords(materials).forEach((material) => {
    if (!material?.図番) return;
    const zuban = String(material.図番);
    if (!map.has(zuban)) map.set(zuban, []);
    map.get(zuban).push(material);
  });
  return map;
}

export function parseSearchTokens(value = "") {
  return String(value)
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildSearchQuery(tokens = [], inputValue = "") {
  const nextTokens = [...tokens];
  const trailing = String(inputValue || "").trim();
  if (trailing) nextTokens.push(trailing);
  return nextTokens.join(" ");
}

export function formatMaterialPDFDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return DATE_TIME_FORMATTER.format(parsed);
}

export function formatMaterialPDFTitle(item = {}, limit = 8) {
  const drawingNumbers = Array.isArray(item.図番Array) ? item.図番Array.filter(Boolean) : [];
  if (!drawingNumbers.length) return "Unknown";
  const visible = drawingNumbers.slice(0, limit).join(", ");
  return drawingNumbers.length > limit ? `${visible} +${drawingNumbers.length - limit} more` : visible;
}

export function formatMaterialPDFHinban(item = {}, limit = 6) {
  const hinbanList = Array.isArray(item.hinbanList) ? item.hinbanList : [];
  const values = hinbanList
    .map((entry) => (typeof entry === "object" ? entry?.品番 : entry))
    .filter(Boolean)
    .map((value) => String(value));

  if (!values.length) return "—";

  const visible = values.slice(0, limit).join(", ");
  return values.length > limit ? `${visible} +${values.length - limit} more` : visible;
}

export function getMaterialPDFItemId(item = {}) {
  return item?._id?.$oid || item?._id || item?.id || item?.documentId || "";
}

export function findMaterialPDFMatches(fileName, drawingNumbers = []) {
  const normalizedFileName = String(fileName || "").toUpperCase().replace(/\s+/g, '');
  const numbersInFileName = normalizedFileName.match(/\d+/g) || [];
  
  return drawingNumbers.filter((zuban) => {
    const normalizedZuban = String(zuban || "").toUpperCase().replace(/\s+/g, '');
    if (!normalizedZuban) return false;

    // Exact number match is safest for auto-detection against the whole DB
    if (numbersInFileName.includes(normalizedZuban)) return true;
    
    // Fallback: If zuban is long enough, allow substring match
    if (normalizedZuban.length >= 3 && normalizedFileName.includes(normalizedZuban)) {
      // Prevent purely numeric zubans from matching as substrings inside larger numbers (e.g. 1046 matching 10469)
      if (/^\d+$/.test(normalizedZuban)) {
        return false;
      }
      return true;
    }

    return false;
  });
}

export function buildBulkMatch(files = [], drawingNumbers = []) {
  const matched = [];
  const toAssign = [];
  const matchedZubans = new Set();

  files.forEach((file) => {
    const matches = findMaterialPDFMatches(file?.name, drawingNumbers);

    if (matches.length === 1) {
      matched.push({ file, drawingNumber: matches[0] });
      matchedZubans.add(matches[0]);
      return;
    }

    toAssign.push({ file, candidates: matches });
  });

  return {
    matched,
    toAssign,
    unassignedDrawingNumbers: drawingNumbers.filter((zuban) => !matchedZubans.has(zuban)),
  };
}

export function getTrashAgeSummary(deletedAt) {
  const deletedDate = new Date(deletedAt);
  if (Number.isNaN(deletedDate.getTime())) {
    return { daysAgo: 0, daysLeft: 30 };
  }

  const daysAgo = Math.max(0, Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    daysAgo,
    daysLeft: Math.max(0, 30 - daysAgo),
  };
}

export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.readAsDataURL(file);
  });
}

export async function convertPdfFileToPreviewImage(file) {
  const pdfjs = await loadPdfRuntime();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);

  const targetWidth = 1920;
  const targetHeight = 1080;
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(targetWidth / viewport.width, targetHeight / viewport.height);
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  context.fillStyle = "white";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.save();
  context.translate(
    (targetWidth - scaledViewport.width) / 2,
    (targetHeight - scaledViewport.height) / 2
  );

  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
  }).promise;

  context.restore();
  return canvas.toDataURL("image/jpeg", 0.95);
}