/**
 * Benutzerverwaltung für den Server: users.json (Standard BMP_DIR/users.json, sonst BMP_USERS).
 *
 *   node packages/server/users.ts add NAME PASSWORT [ROLLE] [EMAIL]   anlegen oder Passwort setzen
 *   node packages/server/users.ts rolle NAME ROLLE                    praesident | trainer | spieler
 *   node packages/server/users.ts email NAME ADRESSE
 *   node packages/server/users.ts remove NAME
 *   node packages/server/users.ts list
 *
 * Rollen (GitLab #65): der Präsident verwaltet Benutzer und darf jede Runde löschen, Präsident
 * und Trainer legen Runden an, der Spieler spielt mit. Wer ohne Rolle in der Datei steht, gilt
 * als Spieler. Der erste angelegte Benutzer wird Präsident - sonst käme niemand an die
 * Verwaltung heran.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { hashPassword } from "./passwort.ts";

const root = resolve(import.meta.dirname, "../..");
const savesDir = process.env.BMP_DIR ?? resolve(root, "../bmp");
const usersFile = process.env.BMP_USERS ?? join(savesDir, "users.json");

const ROLLEN = ["praesident", "trainer", "spieler"] as const;
type Rolle = (typeof ROLLEN)[number];

interface UserFile {
  users: { name: string; hash: string; rolle?: Rolle; email?: string }[];
}

function load(): UserFile {
  if (!existsSync(usersFile)) return { users: [] };
  return JSON.parse(readFileSync(usersFile, "utf8")) as UserFile;
}

function save(data: UserFile): void {
  writeFileSync(usersFile, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  // Die Rechte gelten nur beim Anlegen; eine vorhandene Datei behielte ihre
  chmodSync(usersFile, 0o600);
}

/** Passwort ohne Argument von der Eingabe lesen: auf der Kommandozeile sähe es jeder mit. */
async function frage(): Promise<string> {
  process.stdout.write("Passwort: ");
  const teile: Buffer[] = [];
  for await (const c of process.stdin) teile.push(c as Buffer);
  return Buffer.concat(teile).toString("utf8").split("\n")[0].trim();
}

const NAME = /^[A-Za-z0-9_.-]{2,20}$/;

const [cmd, name, wert, wert2] = process.argv.slice(2);
const data = load();
const istRolle = (r: string | undefined): r is Rolle => ROLLEN.includes(r as Rolle);

if (cmd === "add" && name) {
  if (!NAME.test(name)) {
    console.error("Name: zwei bis zwanzig Zeichen aus Buchstaben, Ziffern, _ . -");
    process.exit(1);
  }
  const passwort = wert || (await frage());
  if (passwort.length < 8) {
    console.error("Das Passwort braucht mindestens acht Zeichen");
    process.exit(1);
  }
  const hash = hashPassword(passwort);
  const rolle = istRolle(wert2) ? wert2 : data.users.length === 0 ? "praesident" : "spieler";
  const email = wert2 && !istRolle(wert2) ? wert2 : undefined;
  const existing = data.users.find((u) => u.name === name);
  if (existing) {
    existing.hash = hash;
    if (istRolle(wert2)) existing.rolle = wert2;
    if (email) existing.email = email;
  } else data.users.push({ name, hash, rolle, ...(email ? { email } : {}) });
  save(data);
  console.log(`Benutzer ${name} gespeichert in ${usersFile} (${existing?.rolle ?? rolle})`);
} else if (cmd === "rolle" && name && istRolle(wert)) {
  const u = data.users.find((x) => x.name === name);
  if (!u) {
    console.error(`Benutzer ${name} gibt es nicht`);
    process.exit(1);
  }
  u.rolle = wert;
  save(data);
  console.log(`${name} ist jetzt ${wert}`);
} else if (cmd === "email" && name && wert) {
  const u = data.users.find((x) => x.name === name);
  if (!u) {
    console.error(`Benutzer ${name} gibt es nicht`);
    process.exit(1);
  }
  u.email = wert;
  save(data);
  console.log(`${name}: ${wert}`);
} else if (cmd === "remove" && name) {
  data.users = data.users.filter((u) => u.name !== name);
  save(data);
  console.log(`Benutzer ${name} entfernt`);
} else if (cmd === "list") {
  console.log(data.users.map((u) => `${u.name}\t${u.rolle ?? "spieler"}\t${u.email ?? ""}`).join("\n") || "(keine Benutzer)");
} else {
  console.log("Aufruf: users.ts add NAME PASSWORT [ROLLE|EMAIL] | rolle NAME " + ROLLEN.join("|") + " | email NAME ADRESSE | remove NAME | list");
  process.exit(1);
}
