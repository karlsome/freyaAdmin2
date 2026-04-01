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

export const PRODUCT_PDF_TYPES = [
  { key: "梱包", label: "梱包", description: "Packing" },
  { key: "検査基準", label: "検査基準", description: "Inspection Standards" },
  { key: "3点総合", label: "3点照合", description: "3-point comprehensive" },
  { key: "ワンポイント確認票", label: "ワンポイント確認票", description: "One-point confirmation" },
  { key: "作業要領書", label: "作業要領書", description: "Work instructions" },
  { key: "動画", label: "動画", description: "Coming soon", comingSoon: true },
  { key: "その他1", label: "その他1", description: "Other" },
  { key: "その他2", label: "その他2", description: "Other" },
  { key: "その他3", label: "その他3", description: "Other" },
];

export const DEFAULT_PRODUCT_PDF_TYPE = PRODUCT_PDF_TYPES[0].key;
export const PRODUCT_PDF_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function getProductPDFTypeMeta(typeKey = DEFAULT_PRODUCT_PDF_TYPE) {
  return PRODUCT_PDF_TYPES.find((type) => type.key === typeKey) || PRODUCT_PDF_TYPES[0];
}

export function sortProductRecords(products = []) {
  return [...products]
    .filter((product) => product && typeof product === "object")
    .sort((left, right) => {
      const leftSerial = String(left.背番号 || "");
      const rightSerial = String(right.背番号 || "");
      return leftSerial.localeCompare(rightSerial, "ja");
    });
}

export function getProductPDFModelOptions(products = []) {
  return [...new Set(products.map((product) => product?.モデル).filter(Boolean))].sort((left, right) =>
    String(left).localeCompare(String(right), "ja")
  );
}

export function filterSelectableProducts(products = [], { searchTerm = "", filterType = "model", selectedModel = "" } = {}) {
  const normalizedSearch = String(searchTerm || "").trim().toLowerCase();

  return sortProductRecords(products).filter((product) => {
    if (!product?.背番号) return false;

    const matchesModel = filterType !== "model" || !selectedModel || product.モデル === selectedModel;
    if (!matchesModel) return false;

    if (!normalizedSearch) return true;

    const haystack = [product.背番号, product.品番, product.モデル]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

export function getProductSelectionForModel(products = [], model = "") {
  if (!model) return [];
  return sortProductRecords(products)
    .filter((product) => product?.モデル === model && product?.背番号)
    .map((product) => String(product.背番号));
}

export function getProductRecordMap(products = []) {
  return new Map(
    sortProductRecords(products)
      .filter((product) => product?.背番号)
      .map((product) => [String(product.背番号), product])
  );
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

export function formatProductPDFDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return DATE_TIME_FORMATTER.format(parsed);
}

export function formatProductPDFTitle(item = {}, limit = 8) {
  const serials = Array.isArray(item.背番号Array) ? item.背番号Array.filter(Boolean) : [];
  if (!serials.length) return "Unknown";
  const visible = serials.slice(0, limit).join(", ");
  return serials.length > limit ? `${visible} +${serials.length - limit} more` : visible;
}

export function formatProductPDFHinban(item = {}, limit = 6) {
  const hinbanList = Array.isArray(item.hinbanList) ? item.hinbanList : [];
  const values = hinbanList
    .map((entry) => (typeof entry === "object" ? entry?.品番 : entry))
    .filter(Boolean)
    .map((value) => String(value));

  if (!values.length) return "—";

  const visible = values.slice(0, limit).join(", ");
  return values.length > limit ? `${visible} +${values.length - limit} more` : visible;
}

export function getProductPDFItemId(item = {}) {
  return item?._id?.$oid || item?._id || item?.id || item?.documentId || "";
}

export function findProductPDFMatches(fileName, serialNumbers = []) {
  const normalizedFileName = String(fileName || "").toUpperCase();
  return serialNumbers.filter((serial) => normalizedFileName.includes(String(serial || "").toUpperCase()));
}

export function buildBulkMatch(files = [], serialNumbers = []) {
  const matched = [];
  const toAssign = [];
  const matchedSerials = new Set();

  files.forEach((file) => {
    const matches = findProductPDFMatches(file?.name, serialNumbers);

    if (matches.length === 1) {
      matched.push({ file, serialNumber: matches[0] });
      matchedSerials.add(matches[0]);
      return;
    }

    toAssign.push({ file, candidates: matches });
  });

  return {
    matched,
    toAssign,
    unassignedSerials: serialNumbers.filter((serial) => !matchedSerials.has(serial)),
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