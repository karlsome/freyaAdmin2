import { query } from "./api";
import { flattenApprovalEditChanges } from "../utils/approvalEdit";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postJson(endpoint, body) {
  const response = await fetch(BASE_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : data?.error || data?.message || `API ${response.status}`);
  }

  return data;
}

async function getJson(endpoint) {
  const response = await fetch(BASE_URL + endpoint);
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : data?.error || data?.message || `API ${response.status}`);
  }

  return data;
}

async function deleteJson(endpoint, body) {
  const response = await fetch(BASE_URL + endpoint, {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : data?.error || data?.message || `API ${response.status}`);
  }

  return data;
}

async function updateApprovalDocument(collectionName, itemId, update) {
  return postJson("queries", {
    dbName: "submittedDB",
    collectionName,
    query: { _id: itemId },
    update,
  });
}

export async function resolveApprovalActorName(authUser = {}) {
  const localName = [authUser?.lastName, authUser?.firstName].filter(Boolean).join(" ").trim();
  if (localName) return localName;

  const username = String(authUser?.username || "").trim();
  if (!username) return "Unknown";

  try {
    const users = await query(
      "Sasaki_Coating_MasterDB",
      "users",
      { username },
      { limit: 1, projection: { firstName: 1, lastName: 1, username: 1 } }
    );

    const user = Array.isArray(users) ? users[0] : null;
    const resolved = [user?.lastName, user?.firstName].filter(Boolean).join(" ").trim();
    return resolved || username;
  } catch {
    return username;
  }
}

export async function fetchApprovalPage({
  collectionName,
  page,
  limit,
  filters,
  userRole,
  factoryAccess,
}) {
  return postJson("api/approval-paginate", {
    collectionName,
    page,
    limit,
    maxLimit: Math.max(limit, 100),
    filters,
    userRole,
    factoryAccess,
  });
}

export async function fetchApprovalStats({
  collectionName,
  filters,
  userRole,
  factoryAccess,
}) {
  const result = await postJson("api/approval-stats", {
    collectionName,
    filters,
    userRole,
    factoryAccess,
  });

  return result?.statistics || {
    pending: 0,
    hanchoApproved: 0,
    fullyApproved: 0,
    correctionNeeded: 0,
    correctionNeededFromKacho: 0,
    todayTotal: 0,
    overallTotal: 0,
  };
}

export async function fetchApprovalFactories({ collectionName, userRole, factoryAccess }) {
  const result = await postJson("api/approval-factories", {
    collectionName,
    userRole,
    factoryAccess,
  });

  return Array.isArray(result?.factories) ? result.factories : [];
}

export async function fetchApprovalRecord(collectionName, itemId) {
  const rows = await query("submittedDB", collectionName, { _id: itemId }, { limit: 1 });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function fetchApprovalMasterReference({ partNumber, serialNumber }) {
  if (!partNumber && !serialNumber) return "";

  const searchQueries = [];
  if (partNumber) searchQueries.push({ 品番: partNumber });
  if (serialNumber) searchQueries.push({ 背番号: serialNumber });

  for (const searchQuery of searchQueries) {
    const matches = await query(
      "Sasaki_Coating_MasterDB",
      "masterDB",
      searchQuery,
      { limit: 1, projection: { imageURL: 1 } }
    );

    if (Array.isArray(matches) && matches[0]?.imageURL) {
      return matches[0].imageURL;
    }
  }

  return "";
}

export async function searchApprovalMasterProducts(search = "") {
  const params = new URLSearchParams();
  if (search) {
    params.set("q", search);
  }

  const result = await getJson(`api/approvals/masterdb-products${params.toString() ? `?${params.toString()}` : ""}`);
  return Array.isArray(result?.data) ? result.data : [];
}

export async function editApprovalDocument({ collectionName, itemId, draft, actorName, username, note = "" }) {
  return postJson("api/approvals/edit-document", {
    collection: collectionName,
    docId: itemId,
    changes: flattenApprovalEditChanges(draft),
    editedBy: actorName,
    editedByUsername: username || null,
    editNote: note,
  });
}

export async function approveApprovalRecord({ collectionName, record, authUser, actorName }) {
  const role = authUser?.role || "";
  const status = record?.approvalStatus || "pending";
  const now = new Date();

  let nextStatus = "";
  let actionLabel = "";
  let approvalByField = "approvedBy";
  let approvalAtField = "approvedAt";

  if (role === "班長" && status === "pending") {
    nextStatus = "hancho_approved";
    actionLabel = "班長承認";
    approvalByField = "hanchoApprovedBy";
    approvalAtField = "hanchoApprovedAt";
  } else if (role === "班長" && status === "correction_needed_from_kacho") {
    nextStatus = "hancho_approved";
    actionLabel = "修正完了・再承認";
    approvalByField = "hanchoApprovedBy";
    approvalAtField = "hanchoApprovedAt";
  } else if (["課長", "admin", "部長"].includes(role) && status === "hancho_approved") {
    nextStatus = "fully_approved";
    actionLabel = "課長承認";
    approvalByField = "kachoApprovedBy";
    approvalAtField = "kachoApprovedAt";
  } else {
    throw new Error("You do not have permission to approve this record.");
  }

  return updateApprovalDocument(collectionName, record._id, {
    $set: {
      approvalStatus: nextStatus,
      [approvalByField]: actorName,
      [approvalAtField]: now,
      approvedBy: actorName,
      approvedAt: now,
    },
    $push: {
      approvalHistory: {
        action: actionLabel,
        user: actorName,
        timestamp: now,
      },
    },
  });
}

export async function requestApprovalCorrection({ collectionName, record, authUser, actorName, comment }) {
  const role = authUser?.role || "";
  const status = record?.approvalStatus || "pending";
  const now = new Date();

  let nextStatus = "";
  let correctionTarget = "submitter";

  if (role === "班長" && (status === "pending" || status === "correction_needed_from_kacho")) {
    nextStatus = "correction_needed";
    correctionTarget = "submitter";
  } else if (["課長", "admin", "部長"].includes(role) && status === "hancho_approved") {
    nextStatus = "correction_needed_from_kacho";
    correctionTarget = "班長";
  } else {
    throw new Error("You do not have permission to request a correction for this record.");
  }

  return updateApprovalDocument(collectionName, record._id, {
    $set: {
      approvalStatus: nextStatus,
      correctionBy: actorName,
      correctionAt: now,
      correctionComment: comment,
      correctionTarget,
    },
    $push: {
      approvalHistory: {
        action: "修正要求",
        user: actorName,
        timestamp: now,
        comment,
        target: correctionTarget,
      },
    },
  });
}

export async function requestApprovalDeletion({ collectionName, itemId, actorName, username, reason }) {
  return postJson("api/approvals/request-delete", {
    itemId,
    collectionName,
    reason,
    requestedBy: actorName,
    requestedByUsername: username || null,
  });
}

export async function softDeleteApproval({ collectionName, itemId, actorName, username, reason }) {
  return postJson("api/approvals/soft-delete", {
    itemId,
    collectionName,
    reason,
    deletedBy: actorName,
    deletedByUsername: username || null,
  });
}

export async function approveApprovalDeleteRequest({ collectionName, itemId, actorName, username }) {
  return postJson("api/approvals/approve-delete-request", {
    itemId,
    collectionName,
    approvedBy: actorName,
    approvedByUsername: username || null,
  });
}

export async function rejectApprovalDeleteRequest({ collectionName, itemId, actorName, username, rejectReason }) {
  return postJson("api/approvals/reject-delete-request", {
    itemId,
    collectionName,
    rejectedBy: actorName,
    rejectedByUsername: username || null,
    rejectReason,
  });
}

export async function cancelApprovalDeleteRequest({ collectionName, itemId, actorName, username }) {
  return postJson("api/approvals/cancel-delete-request", {
    itemId,
    collectionName,
    canceledBy: actorName,
    canceledByUsername: username || null,
  });
}

export async function fetchApprovalRecycleBin() {
  const result = await getJson("api/approvals/recycle-bin");
  return Array.isArray(result?.data) ? result.data : [];
}

export async function restoreApprovalFromRecycleBin({ binDocId, actorName, username }) {
  return postJson("api/approvals/restore", {
    binDocId,
    restoredBy: actorName,
    restoredByUsername: username || null,
  });
}

export async function permanentlyDeleteApprovalFromRecycleBin({ binDocId, actorName }) {
  return deleteJson("api/approvals/permanent-delete", {
    binDocId,
    deletedBy: actorName,
  });
}