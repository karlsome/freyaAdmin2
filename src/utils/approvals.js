const APPROVAL_ALLOWED_ROLES = new Set(["admin", "部長", "課長", "係長", "班長"]);
const APPROVAL_SENIOR_ROLES = new Set(["admin", "部長", "課長"]);
const APPROVAL_DELETE_ROLES = new Set(["admin", "部長", "課長", "係長"]);
const RECYCLE_BIN_ROLES = new Set(["admin", "部長", "課長", "係長"]);

const APPROVAL_STATUS_SORT_WEIGHT = {
  pending_delete: 0,
  pending: 1,
  hancho_approved: 2,
  fully_approved: 3,
  correction_needed: 4,
  correction_needed_from_kacho: 5,
};

const SRS_COUNTER_FIELDS = [
  "くっつき・めくれ",
  "シワ",
  "転写位置ズレ",
  "転写不良",
  "文字欠け",
  "その他",
];

const PRESS_COUNTER_FIELDS = ["疵引不良", "加工不良", "その他"];

const DETAIL_HIDDEN_FIELDS = new Set([
  "_hasDateMismatch",
  "_hasTimeMismatch",
  "_objectIdDate",
  "_objectIdTime",
  "approvalHistory",
  "approvalStatus",
  "approvedAt",
  "approvedBy",
  "correctionAt",
  "correctionBy",
  "correctionComment",
  "correctionTarget",
  "deleteRequestReason",
  "deleteRequestStatus",
  "deleteRequestedAt",
  "deleteRequestedBy",
  "deleteRequestedByUsername",
  "hanchoApprovedAt",
  "hanchoApprovedBy",
  "kachoApprovedAt",
  "kachoApprovedBy",
]);

export const APPROVAL_TABS = [
  { key: "kensaDB", label: "Inspection" },
  { key: "pressDB", label: "Press" },
  { key: "SRSDB", label: "SRS" },
  { key: "slitDB", label: "Slit" },
];

export const APPROVAL_VIEW_MODES = [
  { key: "review", label: "Review" },
  { key: "batch", label: "Batch" },
];

export const APPROVAL_RANGE_MODES = [
  { key: "current", label: "Current Day" },
  { key: "all", label: "All History" },
];

export const APPROVAL_STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "hancho_approved", label: "Hancho Approved" },
  { value: "fully_approved", label: "Fully Approved" },
  { value: "correction_needed", label: "Correction Needed" },
  { value: "correction_needed_from_kacho", label: "Kacho Correction Request" },
];

function asString(value) {
  if (value == null) return "";
  return String(value);
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseClockMinutes(value) {
  const match = asString(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getLocalDateParts(date) {
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function getObjectIdDateParts(objectId) {
  const normalized = asString(objectId).trim();
  if (!/^[a-f0-9]{24}$/i.test(normalized)) return null;

  const timestampSeconds = Number.parseInt(normalized.slice(0, 8), 16);
  if (!Number.isFinite(timestampSeconds)) return null;

  const date = new Date(timestampSeconds * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return getLocalDateParts(date);
}

function compareValues(left, right) {
  if (typeof left === "number" || typeof right === "number") {
    return normalizeNumber(left) - normalizeNumber(right);
  }

  const leftText = asString(left).toLowerCase();
  const rightText = asString(right).toLowerCase();
  return leftText.localeCompare(rightText, "ja");
}

function mergeOrFilter(filters, nextOrClause) {
  if (!nextOrClause?.length) return filters;

  if (filters.$or) {
    filters.$and = [
      { $or: filters.$or },
      { $or: nextOrClause },
    ];
    delete filters.$or;
    return filters;
  }

  filters.$or = nextOrClause;
  return filters;
}

export function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export function hasApprovalAccess(authUser = {}) {
  return APPROVAL_ALLOWED_ROLES.has(authUser?.role || "");
}

export function canAccessRecycleBin(authUser = {}) {
  return RECYCLE_BIN_ROLES.has(authUser?.role || "");
}

export function getApprovalFactoryAccess(authUser = {}) {
  const role = authUser?.role || "";
  if (!role || !["班長", "係長"].includes(role)) return [];

  const assignedFactories = authUser?.工場 || authUser?.factory || [];
  if (Array.isArray(assignedFactories)) return assignedFactories.filter(Boolean);
  return assignedFactories ? [assignedFactories] : [];
}

export function getApprovalQuantityField(tabKey) {
  if (tabKey === "kensaDB") return "Process_Quantity";
  return "Total";
}

export function getApprovalNGField(tabKey) {
  if (tabKey === "SRSDB") return "SRS_Total_NG";
  return "Total_NG";
}

export function getApprovalRecordId(record = {}) {
  if (typeof record?._id === "string") return record._id;
  if (record?._id?.$oid) return record._id.$oid;
  return asString(record?._id);
}

export function getApprovalDateTimeMismatch(record = {}) {
  const parsedObjectId = getObjectIdDateParts(getApprovalRecordId(record));
  const objectIdDate = parsedObjectId?.date || asString(record?._objectIdDate).trim();
  const objectIdTime = parsedObjectId?.time || asString(record?._objectIdTime).trim();
  const inputDate = asString(record?.Date).trim();
  const inputEndTime = asString(record?.Time_end).trim();

  const dateMismatch = objectIdDate
    ? inputDate !== objectIdDate
    : Boolean(record?._hasDateMismatch);

  let diffMinutes = null;
  let timeMismatch = false;
  const inputEndMinutes = parseClockMinutes(inputEndTime);
  const objectIdMinutes = parseClockMinutes(objectIdTime);

  if (inputEndMinutes != null && objectIdMinutes != null) {
    diffMinutes = Math.abs(inputEndMinutes - objectIdMinutes);
    timeMismatch = diffMinutes > 30;
  } else {
    timeMismatch = Boolean(record?._hasTimeMismatch);
  }

  return {
    dateMismatch,
    timeMismatch,
    diffMinutes,
    objectIdDate,
    objectIdTime,
    hasMismatch: dateMismatch || timeMismatch,
  };
}

export function getApprovalQuantityValue(record = {}, tabKey) {
  return normalizeNumber(record?.[getApprovalQuantityField(tabKey)]);
}

export function getApprovalNGValue(record = {}, tabKey) {
  return normalizeNumber(record?.[getApprovalNGField(tabKey)]);
}

export function getApprovalDefectRate(record = {}, tabKey) {
  const quantity = getApprovalQuantityValue(record, tabKey);
  const ngCount = getApprovalNGValue(record, tabKey);
  if (!quantity) return 0;
  return (ngCount / quantity) * 100;
}

export function getApprovalPrimaryApprover(record = {}) {
  return record?.kachoApprovedBy || record?.hanchoApprovedBy || record?.approvedBy || "";
}

export function getApprovalStatusKey(record = {}) {
  if (record?.deleteRequestStatus === "pending_delete") return "pending_delete";
  return record?.approvalStatus || "pending";
}

export function getApprovalStatusMeta(record = {}) {
  const statusKey = getApprovalStatusKey(record);

  switch (statusKey) {
    case "pending_delete":
      return {
        key: statusKey,
        label: "Delete Pending",
        badgeClassName: "bg-error/15 text-error",
        rowClassName: "bg-error/5",
        icon: "delete",
      };
    case "hancho_approved":
      return {
        key: statusKey,
        label: "Hancho Approved",
        badgeClassName: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        rowClassName: "bg-sky-500/5",
        icon: "task_alt",
      };
    case "fully_approved":
      return {
        key: statusKey,
        label: "Fully Approved",
        badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        rowClassName: "",
        icon: "verified",
      };
    case "correction_needed":
      return {
        key: statusKey,
        label: "Correction Needed",
        badgeClassName: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        rowClassName: "bg-rose-500/5",
        icon: "edit_note",
      };
    case "correction_needed_from_kacho":
      return {
        key: statusKey,
        label: "Kacho Correction",
        badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        rowClassName: "bg-amber-500/5",
        icon: "assignment_late",
      };
    case "pending":
    default:
      return {
        key: "pending",
        label: "Pending",
        badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        rowClassName: "bg-amber-500/5",
        icon: "schedule",
      };
  }
}

export function buildApprovalQueryFilters({
  factory = "",
  status = "",
  date = "",
  search = "",
  rangeMode = "current",
} = {}) {
  const filters = {
    timezoneOffset: new Date().getTimezoneOffset(),
  };

  if (factory) {
    filters["工場"] = factory;
  }

  if (status) {
    if (status === "pending") {
      filters.$or = [
        { approvalStatus: { $exists: false } },
        { approvalStatus: "pending" },
      ];
    } else if (status === "correction_needed") {
      filters.$or = [
        { approvalStatus: "correction_needed" },
        { approvalStatus: "correction_needed_from_kacho" },
      ];
    } else {
      filters.approvalStatus = status;
    }
  }

  const effectiveDate = date || (rangeMode === "current" ? getTodayDateString() : "");
  if (effectiveDate) {
    filters.Date = effectiveDate;
  }

  const searchTerm = search.trim();
  if (searchTerm) {
    mergeOrFilter(filters, [
      { 品番: { $regex: searchTerm, $options: "i" } },
      { 背番号: { $regex: searchTerm, $options: "i" } },
      { Worker_Name: { $regex: searchTerm, $options: "i" } },
    ]);
  }

  return filters;
}

export function buildApprovalStatsFilters({
  factory = "",
  date = "",
  search = "",
  rangeMode = "current",
} = {}) {
  const filters = {
    timezoneOffset: new Date().getTimezoneOffset(),
  };

  if (factory) {
    filters["工場"] = factory;
  }

  const effectiveDate = date || (rangeMode === "current" ? getTodayDateString() : "");
  if (effectiveDate) {
    filters.Date = effectiveDate;
  }

  const searchTerm = search.trim();
  if (searchTerm) {
    filters.$or = [
      { 品番: { $regex: searchTerm, $options: "i" } },
      { 背番号: { $regex: searchTerm, $options: "i" } },
      { Worker_Name: { $regex: searchTerm, $options: "i" } },
    ];
  }

  return filters;
}

export function getApprovalRecordTitle(record = {}) {
  const partNumber = record?.品番 || record?.品名 || record?.モデル || "Approval Record";
  const serialNumber = record?.背番号 || "";
  return serialNumber ? `${partNumber} - ${serialNumber}` : partNumber;
}

export function getApprovalRecordSubtitle(record = {}) {
  return [record?.工場, record?.Worker_Name, record?.Date].filter(Boolean).join(" · ");
}

export function getApprovalSubmittedLabel(record = {}) {
  const timeText = [record?.Time_start, record?.Time_end].filter(Boolean).join(" - ");
  return [record?.Date, timeText].filter(Boolean).join(" · ");
}

export function getApprovalCounters(record = {}, tabKey) {
  if (tabKey === "kensaDB") {
    return Object.entries(record?.Counters || {})
      .filter(([, value]) => normalizeNumber(value) > 0)
      .map(([label, value]) => ({ label, value: normalizeNumber(value) }));
  }

  const fields = tabKey === "SRSDB" ? SRS_COUNTER_FIELDS : PRESS_COUNTER_FIELDS;
  return fields
    .map((label) => ({ label, value: normalizeNumber(record?.[label]) }))
    .filter((entry) => entry.value > 0);
}

export function formatApprovalValue(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return asString(value);
    }
  }
  return asString(value);
}

export function getApprovalDetailEntries(record = {}) {
  return Object.entries(record)
    .filter(([key, value]) => {
      if (key === "_id" || DETAIL_HIDDEN_FIELDS.has(key)) return false;
      return value !== null && value !== undefined && value !== "";
    })
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, "ja"));
}

function normalizeImageList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return [];
}

function collectMaterialLabelImages(record = {}) {
  const images = [...normalizeImageList(record?.["材料ラベル画像"])];

  Object.entries(record).forEach(([key, value]) => {
    if (key !== "材料ラベル画像" && key.startsWith("材料ラベル画像")) {
      images.push(...normalizeImageList(value));
    }
  });

  return images;
}

function collectMaintenancePhotos(record = {}) {
  const photos = [];
  const maintenanceRecords = record?.Maintenance_Data?.records;

  if (Array.isArray(maintenanceRecords)) {
    maintenanceRecords.forEach((entry) => {
      photos.push(...normalizeImageList(entry?.photos));
    });
  }

  return photos;
}

export function collectApprovalImageEntries(record = {}, tabKey) {
  const entries = [];
  const seen = new Set();

  function pushEntries(labelBase, urls, sourceKey) {
    urls.forEach((url, index) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      entries.push({
        label: urls.length > 1 ? `${labelBase} #${index + 1}` : labelBase,
        url,
        sourceKey,
      });
    });
  }

  pushEntries("Initial Check", normalizeImageList(record?.["初物チェック画像"]), "初物チェック画像");
  pushEntries("Final Check", normalizeImageList(record?.["終物チェック画像"]), "終物チェック画像");
  pushEntries("Material Label", collectMaterialLabelImages(record), "材料ラベル画像");
  pushEntries("Maintenance", collectMaintenancePhotos(record), "Maintenance_Data");

  Object.entries(record).forEach(([key, value]) => {
    if (["初物チェック画像", "終物チェック画像", "材料ラベル画像", "Maintenance_Data"].includes(key)) {
      return;
    }

    if (!/(画像|image|photo)/i.test(key)) return;
    pushEntries(key, normalizeImageList(value), key);
  });

  if (tabKey === "pressDB" && !entries.length) {
    return [];
  }

  return entries;
}

export function canApproveApproval(record = {}, authUser = {}) {
  if (record?.deleteRequestStatus === "pending_delete") return false;

  const role = authUser?.role || "";
  const status = record?.approvalStatus || "pending";

  if (role === "班長") {
    return status === "pending" || status === "correction_needed_from_kacho";
  }

  if (APPROVAL_SENIOR_ROLES.has(role)) {
    return status === "hancho_approved";
  }

  return false;
}

export function getApproveActionLabel(record = {}, authUser = {}) {
  const role = authUser?.role || "";
  const status = record?.approvalStatus || "pending";

  if (role === "班長" && status === "correction_needed_from_kacho") {
    return "Fix Complete · Re-approve";
  }

  if (role === "班長") return "Hancho Approve";
  if (APPROVAL_SENIOR_ROLES.has(role)) return "Kacho Approve";
  return "Approve";
}

export function canRequestCorrection(record = {}, authUser = {}) {
  if (record?.deleteRequestStatus === "pending_delete") return false;

  const role = authUser?.role || "";
  const status = record?.approvalStatus || "pending";

  if (role === "班長") {
    return status === "pending" || status === "correction_needed_from_kacho";
  }

  if (APPROVAL_SENIOR_ROLES.has(role)) {
    return status === "hancho_approved";
  }

  return false;
}

export function getCorrectionActionLabel(record = {}, authUser = {}) {
  if (authUser?.role === "班長" && record?.approvalStatus === "correction_needed_from_kacho") {
    return "Request Factory Correction";
  }

  return "Request Correction";
}

export function canSoftDeleteApproval(record = {}, authUser = {}) {
  if (record?.deleteRequestStatus === "pending_delete") return false;
  return APPROVAL_DELETE_ROLES.has(authUser?.role || "");
}

export function canRequestApprovalDeletion(record = {}, authUser = {}) {
  if (record?.deleteRequestStatus === "pending_delete") return false;
  return authUser?.role === "班長";
}

export function canApproveDeleteRequest(record = {}, authUser = {}) {
  return record?.deleteRequestStatus === "pending_delete" && APPROVAL_DELETE_ROLES.has(authUser?.role || "");
}

export function canRejectDeleteRequest(record = {}, authUser = {}) {
  return record?.deleteRequestStatus === "pending_delete" && APPROVAL_DELETE_ROLES.has(authUser?.role || "");
}

export function canCancelDeleteRequest(record = {}, authUser = {}) {
  return record?.deleteRequestStatus === "pending_delete" && authUser?.role === "班長";
}

export function canRestoreRecycleBin(authUser = {}) {
  return RECYCLE_BIN_ROLES.has(authUser?.role || "");
}

export function canPermanentlyDeleteRecycleBin(authUser = {}) {
  return authUser?.role === "admin";
}

export function isBatchSelectable(record = {}, authUser = {}) {
  return canApproveApproval(record, authUser) || canRequestCorrection(record, authUser);
}

export function sortApprovalRows(rows = [], sort, tabKey) {
  if (!Array.isArray(rows)) return [];

  const nextRows = [...rows];
  if (!sort?.column) return nextRows;

  const direction = sort?.direction === -1 ? -1 : 1;
  const column = sort.column;

  nextRows.sort((leftRow, rightRow) => {
    let leftValue;
    let rightValue;

    switch (column) {
      case "approvalStatus":
      case "status":
        leftValue = APPROVAL_STATUS_SORT_WEIGHT[getApprovalStatusKey(leftRow)] ?? 999;
        rightValue = APPROVAL_STATUS_SORT_WEIGHT[getApprovalStatusKey(rightRow)] ?? 999;
        break;
      case "quantity":
        leftValue = getApprovalQuantityValue(leftRow, tabKey);
        rightValue = getApprovalQuantityValue(rightRow, tabKey);
        break;
      case "ng":
        leftValue = getApprovalNGValue(leftRow, tabKey);
        rightValue = getApprovalNGValue(rightRow, tabKey);
        break;
      case "defectRate":
        leftValue = getApprovalDefectRate(leftRow, tabKey);
        rightValue = getApprovalDefectRate(rightRow, tabKey);
        break;
      case "approvedBy":
        leftValue = getApprovalPrimaryApprover(leftRow);
        rightValue = getApprovalPrimaryApprover(rightRow);
        break;
      case "deletedAt":
        leftValue = asString(leftRow?.deletedAt);
        rightValue = asString(rightRow?.deletedAt);
        break;
      case "collection":
        leftValue = asString(leftRow?.originalCollection);
        rightValue = asString(rightRow?.originalCollection);
        break;
      default:
        leftValue = leftRow?.[column] ?? "";
        rightValue = rightRow?.[column] ?? "";
        break;
    }

    return compareValues(leftValue, rightValue) * direction;
  });

  return nextRows;
}