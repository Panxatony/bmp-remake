/**
 * Doping der Version 2026 (GitLab #3).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026,
  DOPING_BONUS, DOPING_FRESH, DOPING_RISK, DOPING_RISK_STEP, DOPING_RISK_MAX, DOPING_BAN, DOPING_FINE_BASE, DOPING_FINE_PERCENT, DOPING_MAX_CURES, dopeCures, DOPING_MALUS,
  dopeStart, dopeStop, dopeMatchday, dopingCleanup, dopingRows, dopingRisk, dopingFine, isDoped, isDopeBanned, dopeBonus, dopeFresh, dopeApps, migriereDopingBytes, DOPING_ZUSTAND, DOPING_AUFSCHLAG,
  medRows, medSet, medWeek, playerInfo,
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string, regeln = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
  if (regeln) setRuleSet(g, RULES_2026);
  return g;
};
const immer = () => () => 1;

test("Doping: die Kur hebt die Werte und nimmt sie genau wieder zurück", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  const vorher = [l.u8(16), l.u8(17), l.u8(18), l.u8(19)];
  assert.deepEqual(dopeStart(g, 0, 3), { ok: true });
  assert.ok(isDoped(l));
  const bonus = dopeBonus(l);
  const fresh = dopeFresh(l);
  assert.ok(bonus > 0 && bonus <= DOPING_BONUS, `Aufschlag ${bonus}`);
  assert.ok(fresh > 0 && fresh <= DOPING_FRESH, `Frische ${fresh}`);
  assert.equal(l.u8(16), vorher[0] + bonus);
  assert.equal(l.u8(17), vorher[1] + bonus);
  assert.equal(l.u8(18), vorher[2] + bonus);
  assert.equal(l.u8(19), vorher[3] + fresh);
  assert.ok(Math.max(l.u8(16), l.u8(17), l.u8(18)) <= 99, "keine Wert stößt an die Obergrenze");
  // Zweimal starten geht nicht
  assert.equal(dopeStart(g, 0, 3).ok, false);
  assert.deepEqual(dopeStop(g, 0, 3), { ok: true });
  assert.deepEqual([l.u8(16), l.u8(17), l.u8(18), l.u8(19)], vorher, "genau zurück, auch bei Deckelung");
  assert.equal(isDoped(l), false);
});

test("Doping: das Risiko steigt mit jedem Einsatz", () => {
  assert.equal(dopingRisk(0), DOPING_RISK);
  assert.equal(dopingRisk(1), DOPING_RISK + DOPING_RISK_STEP);
  assert.equal(dopingRisk(99), DOPING_RISK_MAX);
  const g = load("RIED-CLI.MAN");
  dopeStart(g, 0, 3);
  // Würfel knapp über dem Risiko: es geht jedes Mal gut, der Zähler steigt
  const knapp = (lo: number, hi: number) => (hi === 100 ? 100 : lo);
  for (let n = 1; n <= 3; n++) {
    assert.deepEqual(dopeMatchday(g, 0, (p) => p === 3, knapp), []);
    assert.equal(dopingRows(g, 0)[0].apps, n);
    assert.equal(dopingRows(g, 0)[0].risk, dopingRisk(n));
  }
  // Wer nicht spielt, riskiert nichts
  assert.deepEqual(dopeMatchday(g, 0, () => false, immer()), []);
  assert.equal(dopingRows(g, 0)[0].apps, 3);
});

test("Doping: beim Auffliegen Sperre, Geldstrafe 50.000 + 5 % vom Vermögen, Werte zurück", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  const vorher = [l.u8(16), l.u8(17), l.u8(18), l.u8(19)];
  g.managers.at(0).balance = 10_000_000;
  const konto = g.managers.at(0).balance;
  dopeStart(g, 0, 3);
  l.setU8(10, 5); // stand in der Aufstellung
  const ev = dopeMatchday(g, 0, (p) => p === 3, (lo: number) => lo); // Wurf 1: erwischt
  assert.equal(ev.length, 1);
  assert.equal(ev[0].weeks, DOPING_BAN[0]);
  assert.equal(ev[0].fine, dopingFine(konto));
  assert.equal(ev[0].fine, DOPING_FINE_BASE + Math.trunc((konto * DOPING_FINE_PERCENT) / 100), "50.000 + 5 %");
  assert.equal(g.managers.at(0).balance, konto - ev[0].fine);
  // Werte zurück, Form mit Malus
  assert.equal(l.u8(16), vorher[0]);
  assert.equal(l.u8(17), vorher[1]);
  assert.equal(l.u8(18), Math.max(1, vorher[2] - DOPING_MALUS));
  assert.equal(l.u8(19), vorher[3]);
  // Gesperrt: Wochenzähler wie eine Verletzung, aber als Doping gekennzeichnet
  assert.equal(l.u8(13), ev[0].weeks);
  assert.equal(l.u8(9) & 2, 2);
  assert.equal(l.u8(10), 0, "aus der Aufstellung genommen");
  assert.ok(isDopeBanned(l));
  assert.equal(isDoped(l), false);
  assert.match(playerInfo(g, 3).status, new RegExp(`NOCH ${ev[0].weeks} WOCHEN GESPERRT \\(DOPING\\)`));
  // Sockel plus Anteil; ein Minus auf dem Konto senkt die Strafe nicht
  assert.equal(dopingFine(0), DOPING_FINE_BASE);
  assert.equal(dopingFine(1_000_000), DOPING_FINE_BASE + 50_000);
  assert.equal(dopingFine(-5_000_000), DOPING_FINE_BASE);
});

test("Doping: höchstens drei Kuren gleichzeitig", () => {
  const g = load("RIED-CLI.MAN");
  const frei = g.squadOf(0).map((l, i) => [l, i] as const).filter(([l]) => (l.u8(9) & 3) === 0).map(([, i]) => i);
  for (const platz of frei.slice(0, DOPING_MAX_CURES)) assert.equal(dopeStart(g, 0, platz).ok, true);
  assert.equal(dopeCures(g, 0), DOPING_MAX_CURES);
  const zuviel = dopeStart(g, 0, frei[DOPING_MAX_CURES]);
  assert.equal(zuviel.ok, false);
  assert.match(zuviel.error ?? "", /H.chstens 3 Kuren/);
  // Nach dem Beenden einer Kur ist wieder Platz
  assert.equal(dopeStop(g, 0, frei[0]).ok, true);
  assert.equal(dopeStart(g, 0, frei[DOPING_MAX_CURES]).ok, true);
});

test("Doping: eine Dopingsperre ist kein Fall für den Arzt", () => {
  const g = load("RIED-CLI.MAN");
  g.managers.at(0).balance = 10_000_000;
  dopeStart(g, 0, 3);
  dopeMatchday(g, 0, (p) => p === 3, (lo: number) => lo);
  assert.equal(medRows(g, 0).some((r) => r.place === 3), false, "steht nicht im Arztbildschirm");
  assert.equal(medSet(g, 0, 3, 3).ok, false, "keine Behandlung wählbar");
  const wochen = g.lineups.at(3).u8(13);
  medWeek(g, 0, () => 1);
  assert.equal(g.lineups.at(3).u8(13), wochen, "keine Woche herausgeholt");
});

test("Doping: abgelaufene Sperren räumen das Kennzeichen wieder ab", () => {
  const g = load("RIED-CLI.MAN");
  g.managers.at(0).balance = 10_000_000;
  dopeStart(g, 0, 3);
  dopeMatchday(g, 0, (p) => p === 3, (lo: number) => lo);
  assert.equal(dopingRows(g, 0).length, 1);
  const l = g.lineups.at(3);
  l.setU8(13, 0);
  l.setU8(9, l.u8(9) & 0xfc);
  dopingCleanup(g);
  assert.equal(dopingRows(g, 0).length, 0);
  assert.equal(isDopeBanned(g.lineups.at(3)), false);
});

test("Doping: Grenzen - verletzte Spieler, höchstens drei Kuren, Original unberührt", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 4);
  l.setU8(9, l.u8(9) | 2);
  l.setU8(13, 5);
  assert.equal(dopeStart(g, 0, 4).ok, false, "verletzt");
  // Höchstens drei Kuren gleichzeitig (GitLab #48); jeder Platz trägt seinen Zustand selbst
  let n = 0;
  for (let p = 0; p < 25; p++) {
    const k = g.lineups.at(p);
    if (k.isEmpty || (k.u8(9) & 3) !== 0) continue;
    if (dopeStart(g, 0, p).ok) n++;
  }
  assert.equal(n, DOPING_MAX_CURES, "höchstens drei gleichzeitig");
  // Die Angaben stehen im Kaderplatz und überleben das Speichern
  const wieder = new GameState(SaveFile.decode(g.save.encode()));
  assert.equal(dopingRows(wieder, 0).length, n);
  // Im Original gibt es das alles nicht
  const h = load("RIED-CLI.MAN", false);
  assert.equal(dopeStart(h, 0, 3).ok, false);
  assert.deepEqual(dopeMatchday(h, 0, () => true, immer()), []);
});

test("Doping liegt in Kaderbyte 44/45: Europapokaltore (Byte 5) und -einsätze (Byte 8) berühren es nicht (#88)", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  assert.deepEqual(dopeStart(g, 0, 3), { ok: true });
  const zustand = [l.u8(DOPING_ZUSTAND), l.u8(DOPING_AUFSCHLAG)];
  assert.equal(l.u8(5), 0);
  assert.equal(l.u8(8), 0);
  // Ein Europapokaltor und ein Einsatz, wie sie 0x1BA9C und 0x1CC11 buchen
  l.setU8(5, l.u8(5) + 1);
  l.setU8(8, l.u8(8) + 1);
  assert.ok(isDoped(l));
  assert.deepEqual([l.u8(DOPING_ZUSTAND), l.u8(DOPING_AUFSCHLAG)], zustand);
});

test("Umzug alter 2026-Stände: Byte 5/8 nach 44/45, einmalig (#88)", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  // So stand eine Dopingsperre vor dem Umzug: Zustand 2 mit 3 Einsätzen in Byte 5, Aufschlag in 8
  l.setU8(5, 2 | (3 << 2));
  l.setU8(8, 5 | (4 << 4));
  assert.equal(migriereDopingBytes(g), 1);
  assert.ok(isDopeBanned(l));
  assert.equal(dopeApps(l), 3);
  assert.equal(dopeBonus(l), 5);
  assert.equal(dopeFresh(l), 8);
  assert.equal(l.u8(5), 0);
  assert.equal(l.u8(8), 0);
  // Ein zweiter Lauf ändert nichts mehr
  l.setU8(5, 1);
  assert.equal(migriereDopingBytes(g), 0);
  assert.equal(l.u8(5), 1);
});
