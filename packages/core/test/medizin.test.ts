/**
 * Medizinische Versorgung der Version 2026 (GitLab #2).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026, RULES_ORIGINAL,
  MED_LEVELS, MED_SETBACK, MED_LONG, injuryKind, medLevel, setMedLevel, isInjured, injuryFloor,
  medWeek, medRows, medCost, medSet, INJURY_WEEKS, injuries, mulberryRng,
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string, regeln = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
  if (regeln) setRuleSet(g, RULES_2026);
  return g;
};

/** Kaderplatz 0 des Managers verletzen: Art `kind`, `weeks` Wochen. */
function verletzen(g: GameState, manager: number, kind: number, weeks: number, place = 0) {
  const l = g.lineups.at(manager * 25 + place);
  l.setU8(9, l.u8(9) | 2);
  l.setU8(13, weeks);
  l.setU8(23, kind);
  return l;
}

/** Würfel, der immer denselben Wert liefert. */
const fest = (v: number) => () => v;
/** Würfel, der die Trefferfrage (1..100) immer bestehen lässt und sonst den kleinsten Wert nimmt. */
const trifft = (anteil?: number) => (lo: number, hi: number) => (hi === 100 ? 1 : (anteil ?? lo));

test("Medizin: Stufe steht in Byte 23 und lässt die Art der Verletzung unberührt", () => {
  const g = load("RIED-CLI.MAN");
  const l = verletzen(g, 0, 16, 20); // Leistenbruch, 20 Wochen
  assert.equal(injuryKind(l), 16);
  assert.equal(medLevel(l), 0);
  for (let s = 0; s < MED_LEVELS.length; s++) {
    setMedLevel(l, s);
    assert.equal(medLevel(l), s, `Stufe ${s}`);
    assert.equal(injuryKind(l), 16, `Art bei Stufe ${s}`);
  }
  // Der Name der Verletzung kommt weiter aus dem Katalog
  assert.equal(injuries()[injuryKind(l)].weeks, INJURY_WEEKS[16]);
  // Ein Stand des Originals hat die oberen Bits nicht gesetzt
  const h = load("RIED-CLI.MAN");
  assert.equal(medLevel(verletzen(h, 0, 3, 2)), 0);
});

test("Medizin: die Behandlung verkürzt anteilig, mindestens eine Woche", () => {
  // Stufe 3 trifft bei Wurf 1 immer (chance 75) und nimmt dann min..max Prozent
  const s = MED_LEVELS[3];
  const g = load("RIED-CLI.MAN");
  const l = verletzen(g, 0, 16, 20);
  setMedLevel(l, 3);
  g.managers.at(0).balance = 10_000_000;
  const ev = medWeek(g, 0, trifft(s.min));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, "verkuerzt");
  assert.equal(ev[0].weeks, Math.trunc((20 * s.min) / 100));
  assert.equal(l.u8(13), 20 - Math.trunc((20 * s.min) / 100));

  // Kleiner Anteil: er ergäbe null, es wird trotzdem eine Woche - solange die Untergrenze es
  // zulässt (Kreuzbandriß, Grunddauer 12, Untergrenze 8)
  const h = load("RIED-CLI.MAN");
  const k = verletzen(h, 0, 10, 9);
  setMedLevel(k, 1);
  h.managers.at(0).balance = 10_000_000;
  const ev2 = medWeek(h, 0, trifft(MED_LEVELS[1].min));
  assert.equal(Math.trunc((9 * MED_LEVELS[1].min) / 100), 0, "der Anteil allein ergäbe null");
  assert.equal(ev2[0].weeks, 1);
  assert.equal(k.u8(13), 8);

  // Auf der Untergrenze ist Schluss: eine kurze Verletzung lässt sich gar nicht verkürzen
  const j = load("RIED-CLI.MAN");
  const kurz = verletzen(j, 0, 1, 2); // Grunddauer 2 -> Untergrenze 2
  setMedLevel(kurz, 3);
  j.managers.at(0).balance = 10_000_000;
  assert.deepEqual(medWeek(j, 0, trifft()), []);
  assert.equal(kurz.u8(13), 2);
});

test("Medizin: lange Verletzungen lassen sich halbieren, kurze nur um ein Drittel", () => {
  const g = load("RIED-CLI.MAN");
  // Über zehn Wochen reicht die Behandlung bis zur Hälfte, darunter bis zwei Drittel
  const grenze = injuryFloor(16); // Leistenbruch, 20 Wochen -> 10
  assert.equal(grenze, 10);
  assert.equal(grenze, Math.ceil(INJURY_WEEKS[16] / 2));
  for (let kind = 0; kind < INJURY_WEEKS.length; kind++) {
    const w = INJURY_WEEKS[kind];
    const soll = Math.max(1, Math.ceil(w > MED_LONG ? w / 2 : (2 * w) / 3));
    assert.equal(injuryFloor(kind), soll, `Art ${kind} (${w} Wochen)`);
    assert.ok(injuryFloor(kind) >= Math.ceil(w / 2), `Art ${kind}: nie unter die Hälfte`);
  }
  const l = verletzen(g, 0, 16, 20);
  setMedLevel(l, 3);
  g.managers.at(0).balance = 10_000_000;
  // Viele Wochen mit der besten Behandlung und dem größten Anteil
  for (let w = 0; w < 30; w++) medWeek(g, 0, (lo: number, hi: number) => (hi === 100 ? 1 : MED_LEVELS[3].max));
  assert.equal(l.u8(13), grenze, "Untergrenze");
  // Auf der Grenze kostet die Woche nichts mehr
  const konto = g.managers.at(0).balance;
  medWeek(g, 0, (lo: number, hi: number) => (hi === 100 ? 1 : MED_LEVELS[3].max));
  assert.equal(g.managers.at(0).balance, konto);
});

test("Medizin: Kosten werden gebucht, ein leeres Konto wirft auf Stufe 0 zurück", () => {
  const g = load("RIED-CLI.MAN");
  const l = verletzen(g, 0, 16, 20);
  setMedLevel(l, 2);
  g.managers.at(0).balance = MED_LEVELS[2].cost + 100;
  medWeek(g, 0, (lo: number, hi: number) => (hi === 100 ? 100 : lo)); // Wurf trifft nicht
  assert.equal(g.managers.at(0).balance, 100, "Kosten gebucht");
  assert.equal(medLevel(l), 2);
  const ev = medWeek(g, 0, (lo: number, hi: number) => (hi === 100 ? 100 : lo));
  assert.equal(ev[0].kind, "klamm");
  assert.equal(medLevel(l), 0, "Rückfall auf Stufe 0");
  assert.equal(g.managers.at(0).balance, 100, "nichts abgebucht");
});

test("Medizin: ohne Behandlung dauert es manchmal eine Woche länger", () => {
  const g = load("RIED-CLI.MAN");
  const l = verletzen(g, 0, 9, 6);
  assert.equal(medLevel(l), 0);
  const ev = medWeek(g, 0, fest(MED_SETBACK)); // Wurf genau auf der Grenze trifft
  assert.equal(ev[0].kind, "laenger");
  assert.equal(l.u8(13), 7);
  const ev2 = medWeek(g, 0, fest(MED_SETBACK + 1));
  assert.equal(ev2.length, 0);
  assert.equal(l.u8(13), 7);
});

test("Medizin: die letzte Woche macht den Spieler sofort wieder fit", () => {
  const g = load("RIED-CLI.MAN");
  const l = verletzen(g, 0, 0, 2); // Grunddauer 1 Woche, Untergrenze 1
  setMedLevel(l, 3);
  g.managers.at(0).balance = 10_000_000;
  const ev = medWeek(g, 0, (lo: number, hi: number) => (hi === 100 ? 1 : MED_LEVELS[3].max));
  assert.equal(l.u8(13), 1);
  assert.equal(ev[0].kind, "verkuerzt");
  assert.ok(isInjured(l));
});

test("Medizin: Bildschirmzeilen, Wochenkosten und die Prüfung beim Setzen", () => {
  const g = load("RIED-CLI.MAN");
  const l = verletzen(g, 0, 16, 20);
  verletzen(g, 0, 2, 1, 1);
  setMedLevel(l, 3);
  const zeilen = medRows(g, 0);
  assert.equal(zeilen.length, 2);
  assert.equal(zeilen[0].kind, 16);
  assert.equal(zeilen[0].level, 3);
  assert.equal(zeilen[0].weeks, 20);
  assert.equal(medCost(g, 0), MED_LEVELS[3].cost, "Stufe 0 des zweiten Spielers kostet nichts");
  // Setzen
  assert.deepEqual(medSet(g, 0, 1, 2), { ok: true });
  assert.equal(medLevel(g.lineups.at(1)), 2);
  assert.equal(medSet(g, 0, 5, 1).ok, false, "nicht verletzt");
  assert.equal(medSet(g, 0, 0, 9).ok, false, "Stufe gibt es nicht");
  // Im Original gibt es das alles nicht
  const h = load("RIED-CLI.MAN", false);
  verletzen(h, 0, 16, 20);
  assert.equal(medSet(h, 0, 0, 2).ok, false);
  assert.deepEqual(medWeek(h, 0, fest(1)), []);
});
