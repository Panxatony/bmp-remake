/**
 * Benutzerverwaltung für den Server: users.json (Standard BMP_DIR/users.json, sonst BMP_USERS).
 *
 *   node packages/server/users.ts add NAME PASSWORT    Benutzer anlegen oder Passwort setzen
 *   node packages/server/users.ts remove NAME
 *   node packages/server/users.ts list
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

const root = resolve(import.meta.dirname, "../..");
const savesDir = process.env.BMP_DIR ?? resolve(root, "../bmp");
const usersFile = process.env.BMP_USERS ?? join(savesDir, "users.json");

interface UserFile {
  users: { name: string; hash: string }[];
}

function load(): UserFile {
  if (!existsSync(usersFile)) return { users: [] };
  return JSON.parse(readFileSync(usersFile, "utf8")) as UserFile;
}

function save(data: UserFile): void {
  writeFileSync(usersFile, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

const [cmd, name, password] = process.argv.slice(2);
const data = load();
if (cmd === "add" && name && password) {
  const salt = randomBytes(16).toString("hex");
  const hash = `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
  const existing = data.users.find((u) => u.name === name);
  if (existing) existing.hash = hash;
  else data.users.push({ name, hash });
  save(data);
  console.log(`Benutzer ${name} gespeichert in ${usersFile}`);
} else if (cmd === "remove" && name) {
  data.users = data.users.filter((u) => u.name !== name);
  save(data);
  console.log(`Benutzer ${name} entfernt`);
} else if (cmd === "list") {
  console.log(data.users.map((u) => u.name).join("\n") || "(keine Benutzer)");
} else {
  console.log("Aufruf: users.ts add NAME PASSWORT | remove NAME | list");
  process.exit(1);
}
