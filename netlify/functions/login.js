import { json, badRequest, forbidden, readJsonBody, createSession, getState } from "./_lib.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" }, { allow: "POST" });
  }

  const body = await readJsonBody(event);
  if (!body) return badRequest("Invalid JSON");

  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  if (!name || !password) return badRequest("Missing credentials");

  const state = await getState();
  const user = (state.users || []).find((u) => String(u.name) === name);
  if (!user) return forbidden("Wrong username or password");
  if (user.active === false) return forbidden("This account is disabled");

  // Simple password compare (as requested by user)
  if (String(user.password || "") !== password) {
    return forbidden("Wrong username or password");
  }

  const session = await createSession(user.name);

  return json(200, {
    token: session.token,
    user: { name: user.name, role: user.role },
    expiresAt: session.expiresAt,
  });
};
