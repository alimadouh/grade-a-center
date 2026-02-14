import { randomBytes } from "node:crypto";
import { neon } from "@netlify/neon";

const sql = neon(); // uses env NETLIFY_DATABASE_URL

const STATE_TABLE = "gac_state";
const SESSIONS_TABLE = "gac_sessions";

export function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(data ?? {}),
  };
}

export function badRequest(message) {
  return json(400, { error: message || "Bad request" });
}

export function unauthorized(message = "Unauthorized") {
  return json(401, { error: message });
}

export function forbidden(message = "Forbidden") {
  return json(403, { error: message });
}

export async function readJsonBody(event) {
  try {
    if (!event.body) return null;
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

export function getBearerToken(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function makeToken() {
  return randomBytes(24).toString("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeUser(u) {
  return {
    id: String(u.id || ""),
    name: String(u.name || "").trim(),
    role: u.role === "admin" ? "admin" : "worker",
    password: String(u.password || ""),
    active: u.active !== false,
  };
}

export function defaultState() {
  return {
    users: [
      { id: "u_ali", name: "Ali", password: "5123", role: "admin", active: true },
      { id: "u_mousa", name: "Mousa", password: "M1", role: "worker", active: true },
      { id: "u_issa", name: "Issa", password: "Kuly", role: "worker", active: true },
    ],
    rows: [],
    payments: [],
    updatedAt: nowIso(),
  };
}

export async function ensureSchema() {
  // Create tables if missing
  await sql`
    CREATE TABLE IF NOT EXISTS gac_state (
      id INT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gac_sessions (
      token TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `;

  // Seed single state row if missing
  const existing = await sql`SELECT id FROM gac_state WHERE id = 1`;
  if (!existing || existing.length === 0) {
    await sql`INSERT INTO gac_state (id, data) VALUES (1, ${defaultState()}::jsonb)`;
  }
}

export async function getState() {
  await ensureSchema();
  const rows = await sql`SELECT data FROM gac_state WHERE id = 1`;
  const data = rows?.[0]?.data;
  if (!data || typeof data !== "object") return defaultState();

  const state = {
    ...defaultState(),
    ...data,
  };

  // Normalize users
  const users = Array.isArray(state.users) ? state.users.map(normalizeUser) : defaultState().users;
  // Ensure Ali exists
  if (!users.some((u) => u.name === "Ali")) {
    users.unshift({ id: "u_ali", name: "Ali", password: "5123", role: "admin", active: true });
  }

  // Ensure unique names
  const seen = new Set();
  const uniqueUsers = users.filter((u) => {
    if (!u.name) return false;
    const key = u.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    users: uniqueUsers,
    rows: Array.isArray(state.rows) ? state.rows : [],
    payments: Array.isArray(state.payments) ? state.payments : [],
    updatedAt: String(state.updatedAt || nowIso()),
  };
}

export async function saveState(state) {
  await ensureSchema();
  const clean = {
    users: Array.isArray(state?.users) ? state.users.map(normalizeUser) : defaultState().users,
    rows: Array.isArray(state?.rows) ? state.rows : [],
    payments: Array.isArray(state?.payments) ? state.payments : [],
    updatedAt: nowIso(),
  };

  await sql`
    UPDATE gac_state
      SET data = ${clean}::jsonb,
          updated_at = now()
    WHERE id = 1;
  `;

  return clean;
}

export async function createSession(userName) {
  await ensureSchema();
  const token = makeToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  await sql`
    INSERT INTO gac_sessions (token, user_name, expires_at)
    VALUES (${token}, ${userName}, ${expires.toISOString()}::timestamptz)
  `;

  return { token, expiresAt: expires.toISOString() };
}

export async function getSession(token) {
  if (!token) return null;
  await ensureSchema();
  const rows = await sql`
    SELECT token, user_name, expires_at
    FROM gac_sessions
    WHERE token = ${token}
    LIMIT 1
  `;

  const s = rows?.[0];
  if (!s) return null;

  const exp = new Date(s.expires_at);
  if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
    // Expired -> delete
    await sql`DELETE FROM gac_sessions WHERE token = ${token}`;
    return null;
  }

  return { token: s.token, userName: s.user_name, expiresAt: exp.toISOString() };
}

export async function deleteSessionsForUser(userName) {
  await ensureSchema();
  await sql`DELETE FROM gac_sessions WHERE user_name = ${userName}`;
}

export async function deleteSession(token) {
  if (!token) return;
  await ensureSchema();
  await sql`DELETE FROM gac_sessions WHERE token = ${token}`;
}

export function filterStateForUser(state, user) {
  if (!user) return { users: [], rows: [], payments: [], updatedAt: state.updatedAt };
  if (user.role === "admin" && user.name === "Ali") {
    return state;
  }

  return {
    users: [
      {
        id: user.id,
        name: user.name,
        role: user.role,
        password: "", // never send password to workers
        active: user.active,
      },
    ],
    rows: (state.rows || []).filter((r) => String(r.writer || "") === user.name),
    payments: (state.payments || []).filter((p) => String(p.recipient || "") === user.name),
    updatedAt: state.updatedAt,
  };
}
