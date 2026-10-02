/**
 * Korrekturen aus dem zweiten Durchgang des Audits der Version 2026 (docs/AUDIT-2026.md,
 * "Zweiter Durchgang": A23, A27, A30, A34).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026, mulberryRng, TABLES, dayIndex, calendarFlag,
  marketEntries, MARKET_MANAGER, salaryDemand, completePurchase, einsaetzeJeSpieler, gespieltSeit,
  poach, poachCheck, setStakeLevel, derbyStake, playDerby, derbysHeute, addReplay, replays, fixtures,
  kreditFaelligAm, bidOrder, highestBid, debtMessages,
} from "../src/index.ts";
import { startLive } from "../../server/live.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const laden = (datei: string, regeln2026 = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, datei)))));
  if (regeln2026) setRuleSet(g, RULES_2026);
  return g;
};
const eins = (l: { u8(o: number): number }) => l.u8(6) + l.u8(7) + l.u8(8);

test("A23: die Dopingprüfung erkennt Einsätze über den Spieler, auch wenn sich der Kader verschiebt", () => {
  const g = laden("CLAUDE4.MAN");
  const vorher = einsaetzeJeSpieler(g);
  const altAlsListe = g.squadOf(0).map(eins);
  // Zuschlag wie resolveAuctions: der Spieler wird mitten in den Kader einsortiert
  const e = marketEntries(g).find((x) => x.owner === MARKET_MANAGER)!;
  let frei = 0;
  while (!g.lineups.at(frei).isEmpty) frei++;
  g.managers.at(0).balance = 50_000_000;
  const gehalt = salaryDemand(g, 0, frei, 2, { manager: MARKET_MANAGER, place: e.slot });
  const platz = completePurchase(g, 0, e.slot, e.price * 2, 2, gehalt, mulberryRng(7));
  assert.ok(platz >= 0 && platz < g.squadOf(0).length - 1, `eingefügt auf Platz ${platz}`);
  const kader = g.squadOf(0);
  // Der alte Vergleich nach Platz hätte Spieler ohne Einsatz als eingesetzt gezählt
  assert.ok(kader.some((l, i) => eins(l) > (altAlsListe[i] ?? 0)), "Beleg: nach Platz falsch");
  // Ohne Spiel hat niemand gespielt - auch der Neue nicht (er stand beim Anpfiff in keinem Kader)
  const gespielt = gespieltSeit(g, 0, vorher);
  assert.deepEqual(kader.map((_, i) => gespielt(i)).filter(Boolean), []);
  // Ein Einsatz hinter der Einfügestelle trifft genau diesen Spieler
  const ziel = kader.length - 1;
  kader[ziel].setU8(6, kader[ziel].u8(6) + 1);
  const nachher = gespieltSeit(g, 0, vorher);
  assert.deepEqual(kader.map((_, i) => i).filter((i) => nachher(i)), [ziel]);
});

test("A27: Abwerben nimmt Verlängerungsangebot und Meldungszeiger nicht mit", () => {
  for (const [b24, erwartet] of [[103, 0], [127, 0], [5, 5]] as const) {
    const g = laden("CLAUDE4.MAN");
    let [werber, besitzer] = [0, 1];
    const pruef = poachCheck(g, werber, besitzer, 0, 0);
    if (!pruef.ok && /nach oben/.test(pruef.error)) [werber, besitzer] = [1, 0];
    g.managers.at(werber).balance = 50_000_000;
    const place = g.squadOf(besitzer).findIndex((l) => l.u8(12) === 0 && !(l.u8(24) & 0x80));
    const l = g.lineups.at(besitzer * 25 + place);
    const spieler = l.playerIndex;
    // Liegendes Angebot (100 + Jahre) bzw. ein laufender Zähler nach einem Gespräch
    l.setU8(24, b24);
    for (let o = 48; o < 52; o++) l.setU8(o, 0x11 * (o - 47));
    const res = poach(g, werber, besitzer, place, 15, (lo: number) => lo, 0);
    assert.ok(res.ok && res.agreed, JSON.stringify(res));
    const n = g.lineups.at(werber * 25 + (res as { place: number }).place);
    assert.equal(n.playerIndex, spieler);
    assert.equal(n.u8(24), erwartet, `Byte 24 vorher ${b24}`);
    assert.deepEqual([n.u8(48), n.u8(49), n.u8(50), n.u8(51)], [0, 0, 0, 0], "Meldungszeiger");
  }
});

test("A30: der Derby-Einsatz steht beim Anpfiff fest, Ausgaben im Spiel drücken ihn nicht", () => {
  const g = laden("CLAUDE4.MAN");
  const k = dayIndex(g);
  // Manager 0 übernimmt den Gegner von Manager 1 am heutigen Spieltag: Derby 44 - 49
  const paar = g.pairings(2).find(([h, a]) => h === g.managers.at(1).clubIndex || a === g.managers.at(1).clubIndex)!;
  g.managers.at(0).clubIndex = paar[0] === g.managers.at(1).clubIndex ? paar[1] : paar[0];
  const heim = paar[0] === g.managers.at(0).clubIndex ? 0 : 1;
  const gast = 1 - heim;
  setStakeLevel(g, 0, 3);
  setStakeLevel(g, 1, 3);
  g.managers.at(0).balance = 600_000;
  g.managers.at(1).balance = 600_000;
  const st = startLive(g, mulberryRng(5), k, calendarFlag(g, k), 1000);
  const key = `${paar[0]}-${paar[1]}`;
  assert.equal(st.derbyBetrag.get(key), 500_000);
  assert.equal(st.derbyBetrag.size, 1, "nur das Derby");
  // Der Gast liegt 0:2 zurück und gibt sein Geld aus
  g.managers.at(gast).balance = 10_000;
  const vorher = g.managers.at(heim).balance;
  assert.equal(derbyStake(g, heim, gast), 10_000, "ohne Festschreibung wären es 10.000 DM");
  const r = playDerby(g, heim, gast, 2, 0, st.derbyBetrag.get(key));
  assert.deepEqual(r, { winner: heim, loser: gast, amount: 500_000 });
  assert.equal(g.managers.at(heim).balance, vorher + 500_000);
  // Im Original gibt es kein Derby, auch nicht mit Betrag
  const o = laden("CLAUDE4.MAN", false);
  assert.equal(playDerby(o, 0, 1, 2, 0, 500_000), null);
});

test("A34/G12: die Derby-Ankündigung kennt die Nachholspiele des Tages", () => {
  const g = laden("CLAUDE4.MAN");
  const k = dayIndex(g);
  // Ein Spiel vom 1. Spieltag als Derby auf heute nachholen
  const [h, a] = fixtures(2, 1)[3];
  g.managers.at(0).clubIndex = h;
  g.managers.at(1).clubIndex = a;
  assert.deepEqual(derbysHeute(g).filter(([x, y]) => x === h && y === a), []);
  addReplay(g, { dayIndex: k, league: 2, matchday: 1, match: 3 });
  g.save.plain[TABLES.results.offset + (2 * 38 + 0) * 20 + 3 * 2] = 30;
  assert.equal(replays(g).length, 1);
  assert.deepEqual(derbysHeute(g).filter(([x, y]) => x === h && y === a), [[h, a, 0, 1]]);
  assert.deepEqual(derbysHeute(laden("CLAUDE4.MAN", false)), [], "Original: keine Derbys");
});

test("A34/G9: die Bank zeigt in 2026 den Monatsletzten als Fälligkeit", () => {
  const g = laden("CLAUDE4.MAN");
  assert.equal(kreditFaelligAm(g, { dueDay: 15, dueMonth: 0 }), 31);
  assert.equal(kreditFaelligAm(g, { dueDay: 15, dueMonth: 1 }), 28);
  assert.equal(kreditFaelligAm(laden("CLAUDE4.MAN", false), { dueDay: 15, dueMonth: 0 }), 15, "Original: Byte 9");
});

test("A34/G10: ohne Punktabzug keine Meldung \"0 Punkte Abzug\"", () => {
  const null0 = debtMessages({ manager: 0, balance: -2_000_000, points: 0 }, "LARS");
  assert.ok(![...null0.own, ...null0.others].some((z) => /0 Punkte/.test(z)), JSON.stringify(null0));
  assert.ok(null0.own.join(" ").includes("keine Eink{ufe"));
  assert.ok(null0.others.join(" ").includes("Kaufsperre"));
  const drei = debtMessages({ manager: 0, balance: -2_000_000, points: 3 }, "LARS");
  assert.deepEqual(drei.own, ["Ihr Konto ist zu tief", "im Minus: 3 Punkte", "Abzug, ein Monat", "keine Eink{ufe."]);
  assert.deepEqual(drei.others, ["LARS bekommt", "3 Punkte Abzug", "wegen Schulden."]);
});

test("A34/Q5: \"VORN\" nennt bei Gleichstand den, der den Zuschlag bekommt", () => {
  const g = laden("CLAUDE4.MAN");
  const platz = (m: number) => g.standings.at(g.managers.at(m).clubIndex).u8(46);
  // Der besser Platzierte bietet zuerst
  const [besser, schlechter] = platz(0) < platz(1) ? [0, 1] : [1, 0];
  assert.notEqual(platz(0), platz(1));
  const bids = [{ manager: besser, amount: 1_000_000, loan: false }, { manager: schlechter, amount: 1_000_000, loan: false }, { manager: besser, amount: 500_000, loan: true }];
  const order = bidOrder(g, bids);
  assert.equal(order[0].manager, highestBid(g, bids)!.manager);
  assert.equal(order[0].manager, schlechter);
  assert.equal(order[2].amount, 500_000);
  // Gleicher Betrag, gleicher Platz: wie highestBid das erste Gebot
  const gleich = [{ manager: 0, amount: 7, loan: false }, { manager: 0, amount: 7, loan: true }];
  assert.equal(bidOrder(g, gleich)[0], highestBid(g, gleich));
});
