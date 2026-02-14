import {
  json,
  badRequest,
  unauthorized,
  forbidden,
  readJsonBody,
  getBearerToken,
  getSession,
  getState,
  saveState,
  deleteSessionsForUser,
} from "./_lib.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" }, { allow: "POST" });
  }

  const token = getBearerToken(event);
  const session = await getSession(token);
  if (!session) return unauthorized();

  const state = await getState();
  const actor = (state.users || []).find((u) => u.name === session.userName);
  if (!actor || actor.active === false) return unauthorized();
  if (!(actor.role === "admin" && actor.name === "Ali")) return forbidden();

  const body = await readJsonBody(event);
  if (!body) return badRequest("Invalid JSON");

  const targetName = String(body.name || "").trim();
  const active = body.active === true;
  if (!targetName) return badRequest("Missing name");
  if (targetName === "Ali") return badRequest("Ali cannot be disabled");

  const users = (state.users || []).map((u) => {
    if (u.name !== targetName) return u;
    return { ...u, active };
  });

  const found = (state.users || []).some((u) => u.name === targetName);
  if (!found) return badRequest("User not found");

  const next = await saveState({ ...state, users });

  if (!active) {
    await deleteSessionsForUser(targetName);
  }

  return json(200, { ok: true, users: next.users });
};
