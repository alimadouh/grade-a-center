import { json, getState } from "./_lib.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" }, { allow: "GET" });
  }

  const state = await getState();
  const users = (state.users || [])
    .filter((u) => u.active !== false)
    .map((u) => ({ id: u.id, name: u.name, role: u.role }));

  // Sort Ali first, then others alphabetically
  users.sort((a, b) => {
    if (a.name === "Ali") return -1;
    if (b.name === "Ali") return 1;
    return a.name.localeCompare(b.name);
  });

  return json(200, { users });
};
