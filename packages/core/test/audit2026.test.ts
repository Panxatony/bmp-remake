/**
 * Korrekturen aus dem Audit der Version 2026 (docs/AUDIT-2026.md, Teil A).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026, mulberryRng, texte, TABLES,
  jugendLesen, jugendSchreiben, jugendAnlegen, jugendAufruecken, jugendAbwerben, JUGEND_ALTER, istReif,
  poachCheck, medRows, medSet, saisonbilanz, dopeStart, dopeMatchday,
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const laden = () => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN")))));
  setRuleSet(g, RULES_2026);
  return g;
};

/** Einen reifen A-Jugendspieler mit Positionsart `art` aufrücken lassen. */
const aufruecken = (g: GameState, art: number) => {
  jugendAnlegen(g, mulberryRng(29));
  const daten = jugendLesen(g);
  for (const s of daten[0][2]) if (s.name !== "") s.alter = JUGEND_ALTER[2][1] + 1;
  const platz = daten[0][2].findIndex((s) => istReif(s, 2));
  daten[0][2][platz].art = art;
  jugendSchreiben(g, daten);
  const r = jugendAufruecken(g, 0, platz, mulberryRng(3));
  assert.ok(r.ok, JSON.stringify(r));
  return r as { ok: true; playerIndex: number; place: number };
};

test("A7/A8: Aufrücker bekommen den Positionswert ihres Mannschaftsteils und die Aufnahme 0x224A8", () => {
  for (const [art, gruppe] of [[0, 0], [1, 1], [2, 1], [3, 2], [5, 3]] as const) {
    const g = laden();
    // Der Datensatz, den die Jugend übernimmt, trägt noch Tore und Einsätze seines Vorgängers
    for (let i = 1; i < 151; i++) if (g.players.at(i).u8(33) === 5) g.players.at(i).setU8(34, 7);
    const r = aufruecken(g, art);
    const p = g.players.at(r.playerIndex);
    const l = g.lineups.at(r.place);
    assert.equal(Math.trunc(p.u8(31) / 25), gruppe, `Art ${art}: Positionswert ${p.u8(31)}`);
    assert.equal(p.u8(33), 0, "Besitzer");
    assert.equal(p.u8(34), 0, "Ligatore gelöscht");
    assert.notEqual(l.u8(20), 0, "Trainingsprogramm gesetzt");
    assert.ok(l.u8(19) >= 80 && l.u8(19) <= 120, `Frische ${l.u8(19)}`);
    assert.ok(l.number >= 12, `Nummer ${l.number}`);
  }
});

test("A6: ein Leihspieler lässt sich nicht als Jugendspieler abwerben", () => {
  const g = laden();
  const r = aufruecken(g, 3);
  g.managers.at(1).balance = 50_000_000;
  g.lineups.at(r.place).setU8(12, 0x80 | 5);
  assert.deepEqual(jugendAbwerben(g, 1, 0, r.place, 0, () => 0), { ok: false, error: texte("ui.leihspieler").join(" ") });
});

test("A3: Abwerben achtet auf die Kaderzahl 0x11354", () => {
  const g = laden();
  g.managers.at(1).balance = 50_000_000;
  // Manager 1 (12 Spieler) auf 23 Plätze auffüllen und einen eigenen Spieler auf den Markt stellen
  for (let i = 12; i < 23; i++) g.save.plain.copyWithin(TABLES.lineups.offset + (25 + i) * 52, TABLES.lineups.offset + 25 * 52, TABLES.lineups.offset + 26 * 52);
  g.players.at(g.lineups.at(100).playerIndex).setU8(33, 1);
  const ziel = g.squadOf(0).findIndex((l) => g.players.at(l.playerIndex).u8(33) === 0 && l.u8(12) === 0);
  // Wer darf von wem abwerben, hängt am Tabellenplatz; Manager 0 steht oben
  const erg = poachCheck(g, 1, 0, ziel, 0);
  assert.deepEqual(erg, { ok: false, error: texte("ui.kadervoll").join(" ") });
});

test("A12: Medizin trifft bei einer Lücke im Kader den richtigen Platz", () => {
  const g = laden();
  // Manager 2: Platz 14 leer, Spieler 120 auf Platz 15
  const l = g.lineups.at(2 * 25 + 15);
  l.setU8(9, (l.u8(9) & ~3) | 2);
  l.setU8(13, 6);
  l.setU8(23, 3);
  const zeile = medRows(g, 2).find((z) => z.playerIndex === 120)!;
  assert.equal(zeile.place, 15);
  assert.deepEqual(medSet(g, 2, zeile.place, 1), { ok: true });
});

test("A15: Minuspunkte der Ewigen Bilanz mit drei Punkten je Sieg laufen nicht über", () => {
  const g = laden();
  const m = g.managers.at(0);
  const st = g.standings.at(m.clubIndex);
  const vorher = m.u16(432);
  saisonbilanz(g);
  // Heim: 3 · Spiele - Punkte
  assert.equal(m.u16(432), (vorher + 3 * st.u8(30) - st.u8(0)) & 0xffff);
  assert.ok(3 * st.u8(30) - st.u8(0) >= 0);
});

test("A19: Rot und Auffliegen im selben Spiel - die Dopingsperre bleibt eine Wochensperre", () => {
  const g = laden();
  const platz = g.squadOf(0).findIndex((l) => (l.u8(9) & 3) === 0);
  assert.ok(dopeStart(g, 0, platz).ok);
  const l = g.lineups.at(platz);
  l.setU8(9, l.u8(9) | 1); // Rote Karte: zwei Spiele Sperre
  l.setU8(13, 2);
  dopeMatchday(g, 0, (p) => p === platz, (lo: number) => lo);
  assert.equal(l.u8(9) & 3, 2, "nur noch die Wochensperre");
  assert.ok(l.u8(13) >= 12, `Sperre ${l.u8(13)}`);
});
