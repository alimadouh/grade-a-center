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
  filterStateForUser,
} from "./_lib.js";

export const handler = async (event) => {
  const token = getBearerToken(event);
  const session = await getSession(token);
  if (!session) return unauthorized();

  const full = await getState();
  const user = (full.users || []).find((u) => u.name === session.userName);
  if (!user || user.active === false) return unauthorized();

  if (event.httpMethod === "GET") {
    const view = filterStateForUser(full, user);
    return json(200, view);
  }

  if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
    // Only Ali admin can write
    if (!(user.role === "admin" && user.name === "Ali")) return forbidden();

    const body = await readJsonBody(event);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON");

    const next = await saveState(body);
    return json(200, next);
  }

  return json(405, { error: "Method not allowed" }, { allow: "GET, POST, PUT" });
};
