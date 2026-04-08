import { normalizeAuthUser } from "../utils/auth";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function loginUser({ username, password }) {
  const safeUsername = String(username || "").trim();
  const safePassword = String(password || "");

  if (!safeUsername || !safePassword) {
    throw new Error("Username and password are required.");
  }

  const res = await fetch(BASE_URL + "login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: safeUsername, password: safePassword }),
  });

  const data = await readJson(res);

  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `Login failed (${res.status})`;
    throw new Error(message);
  }

  const authUser = normalizeAuthUser(data);
  if (!authUser) {
    throw new Error("Login response was missing required user data.");
  }

  return authUser;
}