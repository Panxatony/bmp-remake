/**
 * "Info über <Verein>" (0x2A41E) und Restprogramm (0x028C4) gegen das Original: RIED-CLI in
 * DOSBox geladen, Tabelle der Bundesliga, Werder Bremen (gesamt) und Mönchengladbach (heim).
 * Die Stärken zeigt das Original nach dem Tagesbeginn, den es beim Laden ausführt (Schwankung
 * 0x10067); hier zählt deshalb nur die Formel, nicht der Wert aus dem Foto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, vereinsInfo, restprogramm, markiereVerein, vereinMarkiert, clubStrength, type InfoBefehl } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const laden = () => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN")))));
/** Zeilen als "y: Text | Text" (nur Texte, ohne Knöpfe) */
const zeilen = (b: InfoBefehl[]) => {
  const m = new Map<number, string[]>();
  for (const x of b) if (x.art === "text" || x.art === "titel") m.set(x.y, [...(m.get(x.y) ?? []), x.text]);
  return [...m.entries()].sort((a, c) => a[0] - c[0]).map(([y, t]) => `${y}: ${t.join(" | ")}`);
};

test("Vereinsinfo Werder Bremen, gesamt, wie im Original", () => {
  const g = laden();
  const z = zeilen(vereinsInfo(g, 0, 2, 0, 0));
  assert.deepEqual(z, [
    "57: Info ]ber SV WERDER BREMEN",
    `69: 11. PLATZ IN DER BUNDESLIGA, ST[RKE: ${clubStrength(g, 0).total}`,
    "79: HEIMBILANZ: | 5 SIEGE, 0 UNENT., 3 NIED.",
    "87: AUSW[RTSBILANZ: | 2 SIEGE, 0 UNENT., 5 NIED.",
    "95: DIE LETZTEN SPIELE: | N | s | S | n | S | n | N | s",
    "103: TORE PRO SPIEL (GESAMT):   | 1.6:1.9",
    "111: SERIEN (GESAMT):  ",
    "119: KEINE BEMERKENSWERTE SERIE VORHANDEN.",
    "129: H|CHSTER SIEG | 5:0 (HALLESCHER FC) (H)",
    "137: H|CHSTE NIEDERL. | 0:4 (VFB STUTTGART) (A)",
    "145: ERZIELTE TORE | 5 (HALLESCHER FC) (H)",
    "153: KASSIERTE TORE | 5 (EINTRACHT FRANKFURT) (A)",
    "163: HISTORISCHE ERGEBNISSE GEGEN 1.FC N\x9ARNBERG",
    "171: H:  NOCH KEINE -- A: 1:2",
    "181: PUNKTE IN DER EWIGEN TABELLE: 359",
  ]);
});

test("Vereinsinfo Mönchengladbach, heim: Serien mit aufgefüllter Länge, Platz der Heimtabelle", () => {
  const z = zeilen(vereinsInfo(laden(), 8, 0, 0, 0, 13));
  assert.ok(z[1].startsWith("69: 13. PLATZ IN DER BUNDESLIGA"));
  assert.deepEqual(z.slice(5, 11), [
    "103: TORE PRO SPIEL (HEIM):   | 1.4:1.0",
    "111: SERIEN (HEIM):  ",
    "119: ^3 SPIELE IN FOLGE ~UNENTSCHIEDEN",
    "127: ^4 SPIELE IN FOLGE ~NICHT GEWONNEN",
    "135: ^3 SPIELE IN FOLGE ~NICHT VERLOREN",
    "143: ^2 SPIELE IN FOLGE ~OHNE GEGENTOR",
  ]);
  assert.equal(z[11], "153: H|CHSTER H-SIEG | 5:0 (HANSA ROSTOCK)");
});

test("Restprogramm: Tore des Vereins vorn, Datum für offene Spiele", () => {
  const z = zeilen(restprogramm(laden(), 0, 0, false));
  assert.equal(z[0], "57: Hinspiele SV WERDER BREMEN");
  assert.equal(z[2], "77: (H) STUTTGARTER KICK. | 13. (69) | 2 | : | 1");
  // Auswärts in Schalke 0:1 verloren - das Original zeigt Werders Tore zuerst
  assert.match(z[3], /^84: \(A\) FC SCHALKE 04 \| \^8\. \(\d+\) \| 0 \| : \| 1$/);
  assert.match(z[z.length - 2], /^182: \(A\) HERTHA BSC \| \^7\. \(\d+\) \| 18\.11\.$/);
  assert.match(z[z.length - 1], /^189: \(H\) SVW MANNHEIM \| \^5\. \(\d+\) \| 25\.11\.$/);
});

test("ANZEIGEN kippt Bit 7 von Vereinsbyte 33, der Knopf wird rot", () => {
  const g = laden();
  const farbe = () => vereinsInfo(g, 0, 2, 0, 0).find((b) => b.art === "knopf" && b.aktion === "anzeigen")!;
  assert.equal(vereinMarkiert(g, 0), false);
  markiereVerein(g, 0);
  assert.equal(vereinMarkiert(g, 0), true);
  assert.equal((farbe() as { farbe: number }).farbe, 17);
  markiereVerein(g, 0);
  assert.equal(g.clubs.at(0).u8(33) & 0x80, 0);
});
