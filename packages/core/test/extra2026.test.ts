import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026,
  checkDebt, isBlocked, setBlocked, DEBT_LIMIT, DEBT_POINTS,
  DERBY_STAKES, setStakeLevel, stakeOf, derbyStake, playDerby,
  bidScore, bestBid, highestBid, resolveAuction, sureBid,
  poachChance, raiseSalary, POACH_COUNTER_MAX,
  takeLoan, loanRequestCheck, BANK, dailyFinance, INTEREST_CAP, playerValue, MARKET_MANAGER, mulberryRng,
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string, regeln = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
  if (regeln) setRuleSet(g, RULES_2026);
  return g;
};

test("2026: Überschuldung kostet Punkte und sperrt den Einkauf", () => {
  const g = load("RIED-CLI.MAN");
  const s = g.standings.at(g.managers.at(0).clubIndex);
  const punkte = () => s.u8(0) + s.u8(1);
  g.managers.at(0).balance = DEBT_LIMIT - 1;
  g.managers.at(1).balance = 500_000;
  const vorher = punkte();
  const r = checkDebt(g);
  assert.equal(r.length, 1);
  assert.equal(r[0].manager, 0);
  assert.equal(punkte(), Math.max(0, vorher - DEBT_POINTS));
  assert.equal(isBlocked(g, 0), true);
  assert.equal(isBlocked(g, 1), false);
  // Spiegelbytes bleiben stimmig
  assert.equal(s.u8(2), s.u8(0));
  assert.equal(s.u8(3), s.u8(1));
  // Wer ausgleicht, ist die Sperre beim nächsten Monat los
  g.managers.at(0).balance = 100;
  assert.deepEqual(checkDebt(g), []);
  assert.equal(isBlocked(g, 0), false);
  // Im Original passiert nichts
  const alt = load("RIED-CLI.MAN", false);
  alt.managers.at(0).balance = DEBT_LIMIT - 1;
  assert.deepEqual(checkDebt(alt), []);
  setBlocked(alt, 0, true);
  assert.equal(isBlocked(alt, 0), false, "ohne Regelwerk 2026 keine Sperre");
});

test("2026: Derby-Einsatz ist der kleinere der beiden Beträge", () => {
  const g = load("RIED-CLI.MAN");
  setStakeLevel(g, 0, 3);
  setStakeLevel(g, 1, 1);
  assert.equal(stakeOf(g, 0), DERBY_STAKES[3]);
  assert.equal(derbyStake(g, 0, 1), DERBY_STAKES[1]);
  const kasse = [g.managers.at(0).balance, g.managers.at(1).balance];
  const r = playDerby(g, 0, 1, 2, 1);
  assert.deepEqual(r, { winner: 0, loser: 1, amount: DERBY_STAKES[1] });
  assert.equal(g.managers.at(0).balance, kasse[0] + DERBY_STAKES[1]);
  assert.equal(g.managers.at(1).balance, kasse[1] - DERBY_STAKES[1]);
  assert.equal(playDerby(g, 0, 1, 1, 1), null, "Unentschieden");
  // Aussteigen geht nicht mehr: die unterste Stufe ist der Mindesteinsatz
  setStakeLevel(g, 1, 0);
  assert.equal(derbyStake(g, 0, 1), DERBY_STAKES[0]);
  assert.equal(DERBY_STAKES[0], 50_000);
  assert.deepEqual(playDerby(g, 0, 1, 3, 0), { winner: 0, loser: 1, amount: DERBY_STAKES[0] });
});

test("2026: Bietgefecht - höchstes Gebot gewinnt, bei Gleichstand der schlechtere Platz", () => {
  const g = load("RIED-CLI.MAN");
  const platz = (m: number) => g.standings.at(g.managers.at(m).clubIndex).u8(46);
  const schlechter = platz(0) > platz(1) ? 0 : 1;
  const besser = schlechter === 0 ? 1 : 0;
  assert.equal(highestBid(g, [{ manager: 0, amount: 100, loan: false }, { manager: 1, amount: 200, loan: false }])?.manager, 1);
  assert.equal(highestBid(g, [{ manager: besser, amount: 500, loan: false }, { manager: schlechter, amount: 500, loan: false }])?.manager, schlechter);
  assert.equal(highestBid(g, []), null);
  assert.equal(highestBid(g, [{ manager: 0, amount: 0, loan: false }]), null);
  // Zu niedrige Gebote lehnt der abgebende Verein ab
  const rng = (lo: number) => lo;
  assert.equal(resolveAuction(g, 1_000_000, [{ manager: 0, amount: 10_000, loan: false }], rng).winner, null);
  assert.ok(resolveAuction(g, 1_000_000, [{ manager: 0, amount: 2_000_000, loan: false }], rng).winner);
  // Der Betrag aus der Absage muss der Verein bei jedem Würfelwurf annehmen (#19)
  const preis = 837_000;
  const sicher = sureBid(preis);
  for (let seed = 1; seed <= 200; seed++) {
    const r = mulberryRng(seed);
    assert.ok(resolveAuction(g, preis, [{ manager: 0, amount: sicher, loan: false }], r).winner, `Zuschlag fehlt bei Wurf ${seed}`);
  }
});

test("2026: ablösefreie Spieler gehen an das beste Angebot, höhere Liga zählt mehr", () => {
  const g = load("RIED-CLI.MAN");
  const bids = [
    { manager: 0, salary: 10_000 },
    { manager: 1, salary: 10_000 },
  ];
  const b = bestBid(g, bids);
  assert.ok(b);
  // Der Verein in der höheren Liga (kleinere Ligazahl) bekommt den besseren Wert
  const liga = (m: number) => { const c = g.managers.at(m).clubIndex; return c < 18 ? 0 : c < 38 ? 1 : 2; };
  if (liga(0) !== liga(1)) assert.equal(b.manager, liga(0) < liga(1) ? 0 : 1);
  assert.ok(bidScore(g, { manager: 0, salary: 10_000 }) >= 10_000);
  assert.equal(bestBid(g, [{ manager: 0, salary: 0 }]), null);
});

test("2026: Gegenwehr beim Abwerben senkt die Zustimmung und hebt das Gehalt", () => {
  const g = load("RIED-CLI.MAN");
  const ohne = poachChance(g, 0, 2, 3, 10);
  const mit = poachChance(g, 0, 2, 3, 10, 20);
  assert.equal(mit, Math.max(5, ohne - 20));
  assert.equal(poachChance(g, 0, 2, 3, 10, 500), Math.max(5, ohne - POACH_COUNTER_MAX));
  const l = g.lineups.at(2 * 25 + 3);
  const gehalt = l.i32(40);
  const neu = raiseSalary(g, 2, 3, 20);
  assert.equal(neu, Math.trunc((gehalt * 120) / 100));
  assert.equal(g.lineups.at(2 * 25 + 3).i32(40), neu);
  assert.equal(raiseSalary(g, 2, 3, 0), neu, "ohne Erhöhung bleibt das Gehalt");
});

test("2026: Zinsen zum festen Monatstermin statt nach dem Aufnahmetag", () => {
  const zins = (regeln: boolean, tag: number) => {
    const g = load("RIED-CLI.MAN", regeln);
    // Kredit am 7. aufnehmen: im Original ist der 7. der Zinstermin, ab 2026 der Monatsletzte
    assert.equal(takeLoan(g, 0, 1_000_000, 12, 5, { day: 7, month0: 9, year: 1997 }, BANK), null);
    const vorher = g.managers.at(0).balance;
    dailyFinance(g, 0, { day: tag, month0: 10, year: 1997 }, (lo) => lo);
    return vorher - g.managers.at(0).balance;
  };
  // Original: am 7. wird gebucht, am 30. nicht
  assert.ok(zins(false, 7) > 0, "Original bucht am Aufnahmetag");
  // Version 2026: am 7. passiert nichts, am Monatsletzten schon
  assert.equal(zins(true, 7), 0, "2026 bucht nicht am Aufnahmetag");
  assert.ok(zins(true, 30) > 0, "2026 bucht am Monatsletzten");
});

test("2026: Guthabenzins nur bis zur Obergrenze", () => {
  const ertrag = (regeln: boolean, kontostand: number) => {
    const g = load("RIED-CLI.MAN", regeln);
    const m = g.managers.at(0);
    m.balance = kontostand;
    // Keine Kredite, damit nur die Monatsabrechnung wirkt
    for (let i = 0; i < 5 * 3; i++) for (let k = 0; k < 18; k++) m.setU8(508 + i * 18 + k, 0);
    const vorher = m.balance;
    dailyFinance(g, 0, { day: 30, month0: 10, year: 1997 }, (lo) => lo);
    return m.balance - vorher;
  };
  const klein = INTEREST_CAP / 2;
  // Unter der Grenze ist alles wie im Original
  assert.equal(ertrag(true, klein), ertrag(false, klein));
  // Darüber bringt die Version 2026 genau den Zins oberhalb der Grenze weniger (die
  // Vermögenssteuer des Originals ab zwei Millionen wirkt in beiden Regelwerken gleich)
  const gross = INTEREST_CAP * 4;
  assert.ok(ertrag(true, gross) < ertrag(false, gross));
  assert.equal(ertrag(false, gross) - ertrag(true, gross), Math.trunc(gross / 75) - Math.trunc(INTEREST_CAP / 75));
});

test("2026: Marktpreise laufen nicht mehr über", () => {
  const g = load("RIED-CLI.MAN");
  const alt = load("RIED-CLI.MAN", false);
  // Würfel, der den Überlauf des Originals sichtbar macht: immer der obere Rand
  const rng = (lo: number, hi: number) => hi;
  let teuer = -1;
  for (let s = 0; s < 12; s++) if (!g.lineups.at(100 + s).isEmpty && playerValue(g, MARKET_MANAGER, s, 0) > 500_000) teuer = s;
  if (teuer < 0) return;
  const preis2026 = playerValue(g, MARKET_MANAGER, teuer, 4, rng);
  const basis = playerValue(g, MARKET_MANAGER, teuer, 0);
  assert.ok(preis2026 > 0, "kein negativer Preis");
  assert.ok(preis2026 >= basis, `Aufschlag statt Abschlag: ${preis2026} zu ${basis}`);
  // Das Original darf hier weiter überlaufen - nur prüfen, dass die Funktion beide Wege kennt
  assert.equal(typeof playerValue(alt, MARKET_MANAGER, teuer, 4, rng), "number");
});

test("2026: Kreditanfrage an einen Mitspieler wird vorab geprüft", () => {
  const g = load("RIED-CLI.MAN");
  assert.equal(loanRequestCheck(g, 0, 0, 1), "Betrag ungültig");
  assert.equal(loanRequestCheck(g, 0, 100_000, 0), "Geldgeber ungültig");
  g.managers.at(1).balance = 50_000;
  assert.ok(loanRequestCheck(g, 0, 100_000, 1)?.includes("gar nicht"));
  g.managers.at(1).balance = 5_000_000;
  assert.equal(loanRequestCheck(g, 0, 100_000, 1), null);
  assert.ok(loanRequestCheck(g, 0, 2_000_000, 1)?.includes("1 Mio"));
});
