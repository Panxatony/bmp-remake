/**
 * Passwörter zu Hashes und zurück prüfen (GitLab #66). Eigene Datei, weil sowohl der Server als
 * auch das Kommandozeilenwerkzeug sie brauchen - beim Import von server.ts liefe der Dienst los.
 *
 * Format: `scrypt2$N$r$p$Salz$Hash`. Die Kosten stehen mit im Hash, sonst ließen sie sich später
 * nicht anheben, ohne alle Passwörter ungültig zu machen. Die alte Form `scrypt$Salz$Hash` mit
 * den Vorgaben von Node wird weiter geprüft; wer sich anmeldet, bekommt beim nächsten Setzen
 * seines Passworts von selbst die neue.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * N=65536 braucht 128·N·r = 64 MiB und rund eine Zehntelsekunde. Nodes Vorgabe (N=16384) ist
 * für heutige Grafikkarten dünn; mehr als das hier ginge auch, kostet aber bei jeder Anmeldung
 * Zeit, und davor steht ohnehin die Bremse je Konto und je Adresse.
 */
const N = 65536;
const R = 8;
const P = 1;
const LAENGE = 32;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = scryptSync(password, salt, LAENGE, { N, r: R, p: P, maxmem: 256 * N * R }).toString("hex");
  return `scrypt2$${N}$${R}$${P}$${salt}$${hash}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const teile = hash.split("$");
  let salz: string;
  let soll: Buffer;
  let werte: { N: number; r: number; p: number };
  if (teile.length === 6 && teile[0] === "scrypt2") {
    werte = { N: Number(teile[1]), r: Number(teile[2]), p: Number(teile[3]) };
    if (!Number.isInteger(werte.N) || werte.N < 2 || !Number.isInteger(werte.r) || !Number.isInteger(werte.p)) return false;
    // Eine unsinnig große Kostenangabe im Hash soll den Dienst nicht lahmlegen
    if (werte.N > 1 << 20 || werte.r > 32 || werte.p > 16) return false;
    salz = teile[4];
    soll = Buffer.from(teile[5], "hex");
  } else if (teile.length === 3 && teile[0] === "scrypt") {
    werte = { N: 16384, r: 8, p: 1 };
    salz = teile[1];
    soll = Buffer.from(teile[2], "hex");
  } else return false;
  if (soll.length === 0) return false;
  const ist = scryptSync(password, salz, soll.length, { ...werte, maxmem: 256 * werte.N * werte.r });
  return soll.length === ist.length && timingSafeEqual(soll, ist);
}

/** Ob der Hash noch nach dem alten Verfahren gebildet wurde (zum Nachziehen beim Anmelden). */
export function veraltet(hash: string): boolean {
  return hash.startsWith("scrypt$");
}
