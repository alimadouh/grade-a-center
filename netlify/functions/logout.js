import { json, getBearerToken, deleteSession } from "./_lib.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" }, { allow: "POST" });
  }

  const token = getBearerToken(event);
  await deleteSession(token);
  return json(200, { ok: true });
};
