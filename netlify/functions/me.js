import { json, unauthorized, getBearerToken, getSession, getState } from "./_lib.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" }, { allow: "GET" });
  }

  const token = getBearerToken(event);
  const session = await getSession(token);
  if (!session) return unauthorized();

  const state = await getState();
  const user = (state.users || []).find((u) => u.name === session.userName);
  if (!user || user.active === false) return unauthorized();

  return json(200, {
    user: { name: user.name, role: user.role, active: user.active !== false },
    expiresAt: session.expiresAt,
  });
};
