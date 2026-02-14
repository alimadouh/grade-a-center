import { json, ensureSchema } from "./_lib.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" }, { allow: "GET" });
  }
  await ensureSchema();
  return json(200, { ok: true });
};
