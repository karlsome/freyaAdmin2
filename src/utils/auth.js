const AUTH_STORAGE_KEY = "authUser";

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeFactories(value) {
  if (Array.isArray(value)) {
    return value.map(asTrimmedString).filter(Boolean);
  }

  const singleValue = asTrimmedString(value);
  return singleValue ? [singleValue] : [];
}

export function normalizeAuthUser(value) {
  if (!value || typeof value !== "object") return null;

  const username = asTrimmedString(value.username);
  const role = asTrimmedString(value.role);

  if (!username || !role) return null;

  const factories = normalizeFactories(value.工場 ?? value.factory);
  const normalized = {
    ...value,
    username,
    role,
  };

  if (factories.length > 0) {
    normalized.工場 = factories;
    normalized.factory = factories;
  }

  return normalized;
}

export function readStoredAuthUser() {
  try {
    return normalizeAuthUser(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

export function persistAuthUser(authUser) {
  const normalized = normalizeAuthUser(authUser);

  if (!normalized) {
    clearStoredAuthUser();
    return null;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearStoredAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticatedUser(authUser) {
  return Boolean(authUser?.username && authUser?.role);
}

export function getAuthDisplayName(authUser = {}) {
  const fullName = [authUser?.lastName, authUser?.firstName]
    .map(asTrimmedString)
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || asTrimmedString(authUser?.username) || "Unknown user";
}

export function getAuthInitials(authUser = {}) {
  const displayName = getAuthDisplayName(authUser);
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FA";
}