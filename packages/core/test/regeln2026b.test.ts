/**
 * Entscheidungen B15-B18 und B23-B25 aus dem zweiten Durchgang des Audits der Version 2026
 * (docs/AUDIT-2026.md, Abschnitt B; GitLab #145-#148, #153-#155). Im Original ändert sich nichts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026, mulberryRng, marketEntries, MARKET_MANAGER,
  zuschlagVollziehen, highestBid, bidOrder, bestBid, bidScore, tabellenRang, poach, poachCheck,
  abwerbungVorpruefen, setBlocked, jugendAnlegen, jugendLesen, jugendSchreiben, jugendAufruecken,
  jugendAbwerben, istReif, JUGEND_ALTER, takeLoan, dailyFinance, monthlyExpenses, monthlyIncome,
  kreditZinsen, statistics, checkDebt, debtCarry, debtMessages, DEBT_LIMIT, DEBT_POINTS,
  DEBT_CARRY_OFFSET, dopeStart, isDoped, kurenBeenden, texte,
} from "../src/index.ts";
import type { Rng } from "../src/sim/match.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const laden = (datei: string, regeln2026 = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, datei)))));
  if (regeln2026) setRuleSet(g, RULES_2026);
  return g;
};
/** Würfel, der immer die Untergrenze liefert (Zustimmung, Zuschuss mit 1/7 und 20 %) */
const unten: Rng = (lo) => lo;
/** Würfel, der immer die Obergrenze liefert (kein Zuschuss) */
const oben: Rng = (_lo, hi) => hi;

test("B15/B16: Zuschlag im Bietgefecht ohne Rückennummer, mit Sponsor-Zuschuss wie beim Kauf vom Rechner", () => {
  for (const loan of [false, true]) {
    for (const [wurf, mitZuschuss] of [[unten, true], [oben, false]] as const) {
      const g = laden("CLAUDE4.MAN");
      const e = marketEntries(g).find((x) => x.owner === MARKET_MANAGER)!;
      g.managers.at(0).balance = 50_000_000;
      // Rückennummern 12 bis 15 frei: der alte Weg (assignNumber) hätte 12 vergeben
      for (const l of g.squadOf(0)) if (l.number >= 12) l.setU8(10, 0);
      const amount = e.price * 2;
      const z = zuschlagVollziehen(g, { manager: 0, amount, loan }, e.slot, wurf);
      assert.ok(z.platz >= 0, JSON.stringify(z));
      const l = g.lineups.at(z.platz);
      assert.equal(l.playerIndex, e.playerIndex);
      assert.equal(l.number, 0, "keine Rückennummer (B15)");
      if (!loan) assert.equal(l.u8(11), 2, "zwei Jahre");
      const erwartet = mitZuschuss ? Math.trunc((Math.trunc(amount / 100) * 20) / 10000) * 10000 : 0;
      assert.equal(z.zuschuss, erwartet, `Zuschuss (Leihe ${loan})`);
    }
  }
});

test("B15: Abwerben aus Kader und Jugend vergibt keine Rückennummer", () => {
  const g = laden("RIED-CLI.MAN");
  jugendAnlegen(g, mulberryRng(29));
  const daten = jugendLesen(g);
  for (const s of daten[0][2]) if (s.name !== "") s.alter = JUGEND_ALTER[2][1] + 1;
  jugendSchreiben(g, daten);
  const platz = jugendLesen(g)[0][2].findIndex((s) => istReif(s, 2));
  const auf = jugendAufruecken(g, 0, platz, mulberryRng(3));
  assert.ok(auf.ok);
  if (!auf.ok) return;
  assert.equal(g.lineups.at(auf.place).number, 0, "Aufrücker");
  g.managers.at(1).balance = 50_000_000;
  for (const l of g.squadOf(1)) if (l.number >= 12) l.setU8(10, 0);
  const weg = jugendAbwerben(g, 1, 0, auf.place, 0, () => 0);
  assert.ok(weg.ok && weg.agreed && weg.place !== undefined, JSON.stringify(weg));
  if (!weg.ok || weg.place === undefined) return;
  assert.equal(g.lineups.at(25 + weg.place).number, 0, "Jugend-Abwerben");

  const h = laden("CLAUDE4.MAN");
  let [werber, besitzer] = [0, 1];
  if (!poachCheck(h, werber, besitzer, 0, 0).ok) [werber, besitzer] = [1, 0];
  h.managers.at(werber).balance = 50_000_000;
  for (const l of h.squadOf(werber)) if (l.number >= 12) l.setU8(10, 0);
  const place = h.squadOf(besitzer).findIndex((l) => l.u8(12) === 0 && !(l.u8(24) & 0x80));
  const r = poach(h, werber, besitzer, place, 0, () => 0);
  assert.ok(r.ok && r.agreed && r.place !== undefined, JSON.stringify(r));
  if (!r.ok || r.place === undefined) return;
  assert.equal(h.lineups.at(werber * 25 + r.place).number, 0, "Abwerben");
});

test("B17: Gleichstand - erst die niedrigere Liga, dann der schlechtere Platz", () => {
  // RIED-6TE: Manager 0 ist Bundesliga-17. (Platz 16), Manager 1 Zweitliga-15. (Platz 14)
  const g = laden("RIED-6TE.MAN");
  const platz = (m: number) => g.standings.at(g.managers.at(m).clubIndex).u8(46);
  assert.ok(g.managers.at(0).clubIndex < 18 && g.managers.at(1).clubIndex >= 18);
  assert.ok(platz(0) > platz(1), "nach dem alten Vergleich gewönne der Bundesligist");
  assert.ok(tabellenRang(g, 1) > tabellenRang(g, 0));
  const bids = [{ manager: 0, amount: 1_000_000, loan: false }, { manager: 1, amount: 1_000_000, loan: false }];
  assert.equal(highestBid(g, bids)!.manager, 1);
  assert.equal(highestBid(g, bids.slice().reverse())!.manager, 1);
  assert.equal(bidOrder(g, bids)[0].manager, 1, "VORN nennt denselben");
  // Mehr Geld gewinnt weiterhin
  assert.equal(highestBid(g, [{ manager: 0, amount: 1_000_001, loan: false }, bids[1]])!.manager, 0);
  // Gleiche Liga: der schlechtere Platz (Manager 1 und 2 sind beide Zweitligisten)
  assert.ok(g.managers.at(2).clubIndex >= 18 && g.managers.at(2).clubIndex < 38);
  const schlechter = platz(1) > platz(2) ? 1 : 2;
  assert.equal(highestBid(g, [{ manager: 1, amount: 5, loan: false }, { manager: 2, amount: 5, loan: false }])!.manager, schlechter);
  // Ablösefrei: gleiche Bewertung (Bundesliga zählt 120 %, zweite Liga 110 %)
  const frei = [{ manager: 0, salary: 110_000 }, { manager: 1, salary: 120_000 }];
  assert.equal(bidScore(g, frei[0]), bidScore(g, frei[1]));
  assert.equal(bestBid(g, frei)!.manager, 1);
  assert.equal(bestBid(g, frei.slice().reverse())!.manager, 1);
});

test("B18: eine scheiternde Abwerbung meldet sich beim Werber", () => {
  const g = laden("CLAUDE4.MAN");
  let [werber, besitzer] = [0, 1];
  if (!poachCheck(g, werber, besitzer, 0, 0).ok) [werber, besitzer] = [1, 0];
  g.managers.at(werber).balance = 50_000_000;
  const place = g.squadOf(besitzer).findIndex((l) => l.u8(12) === 0 && !(l.u8(24) & 0x80));
  const playerIndex = g.lineups.at(besitzer * 25 + place).playerIndex;
  const q = { poacher: werber, owner: besitzer, playerIndex, bonus: 0, name: "MUSTER" };
  assert.deepEqual(abwerbungVorpruefen(g, q), { ok: true, place });
  // Kaufsperre
  setBlocked(g, werber, true);
  const sperre = abwerbungVorpruefen(g, q);
  assert.ok(!sperre.ok && sperre.meldung.join(" ").includes("Kaufsperre"), JSON.stringify(sperre));
  setBlocked(g, werber, false);
  // Zu wenig Geld (eine Regel aus poachCheck): die Meldung nennt den Grund, Zeilen höchstens 24
  g.managers.at(werber).balance = 0;
  const geld = abwerbungVorpruefen(g, q);
  assert.ok(!geld.ok);
  if (!geld.ok) {
    assert.ok(geld.meldung.join(" ").includes(texte("ui.zuwenig")[0]), JSON.stringify(geld));
    assert.ok(geld.meldung.every((z) => z.length <= 24), JSON.stringify(geld.meldung));
  }
  // Der Spieler ist weg (hier: schon abgeworben - die zweite Anfrage beim selben Besitzer)
  g.managers.at(werber).balance = 50_000_000;
  const r = poach(g, werber, besitzer, place, 0, () => 0);
  assert.ok(r.ok && r.agreed);
  const weg = abwerbungVorpruefen(g, q);
  assert.ok(!weg.ok && /nicht/.test(weg.meldung[0]) && weg.meldung.join(" ").includes("entf{llt"), JSON.stringify(weg));
});

test("B23: Kredit unter Managern - in 2026 genau n Raten an genau den Geldgeber, im Original wie bisher", () => {
  // Kredit 1 Mio. DM von Manager 0 an Manager 1, 3 Monate, 10 %, am 15.10. (AUDIT-2026 G5). Der
  // Geldgeber rechnet seinen Monat zuerst ab, so ändern die Raten seine Steuer nicht
  const lauf = (regeln2026: boolean, mitKredit: boolean): number[] => {
    const g = laden("RIED-4TE.MAN", regeln2026);
    const n = g.activeManagers().length;
    // Fremde Kredite der Stände weg, damit nur dieser wirkt
    g.activeManagers().forEach((m) => { for (let i = 0; i < 15 * 18; i++) m.setU8(508 + i, 0); });
    g.managers.at(0).balance = 5_000_000;
    if (mitKredit) assert.equal(takeLoan(g, 1, 1_000_000, 3, 10, { day: 15, month0: 9, year: 1997 }, 0), null);
    const summe = new Array(n).fill(0);
    for (const [tag, monat, jahr] of [[31, 9, 1997], [30, 10, 1997], [31, 11, 1997], [31, 0, 1998], [28, 1, 1998]]) {
      // Gleicher Kontostand in beiden Läufen: Steuer und Guthabenzins rechnen gleich
      for (let i = 0; i < n; i++) g.managers.at(i).balance = 500_000;
      for (let i = 0; i < n; i++) dailyFinance(g, i, { day: tag, month0: monat, year: jahr }, mulberryRng(5 + i), undefined, false);
      for (let i = 0; i < n; i++) summe[i] += g.managers.at(i).balance - 500_000;
    }
    return summe;
  };
  const mit = lauf(true, true);
  const ohne = lauf(true, false);
  const diff = mit.map((v, i) => v - ohne[i]);
  // Borger: drei Raten zu 100.000 und die Rückzahlung; Geldgeber: genau das; der Dritte: nichts
  assert.deepEqual(diff, [3 * 100_000 + 1_000_000, -3 * 100_000 - 1_000_000, 0]);
  // Original unverändert: Zinsen zum Termin und in den Monatsausgaben, Einnahme bei allen anderen
  const o = lauf(false, true);
  const oo = lauf(false, false);
  const od = o.map((v, i) => v - oo[i]);
  // (hier nur Monatsletzte: der Termin des Originals am Aufnahmetag fällt nicht hinein)
  assert.notDeepEqual(od, diff);
  assert.ok(od[2] > 0, "im Original bekommt auch der Dritte Zinsen");

  // Statistik 2026: Zinsen zählen als Ausgabe bzw. Einnahme der Monatsrechnung
  const g = laden("RIED-4TE.MAN");
  g.activeManagers().forEach((m) => { for (let i = 0; i < 15 * 18; i++) m.setU8(508 + i, 0); });
  g.managers.at(0).balance = 5_000_000;
  const vorherA = monthlyExpenses(g, 1);
  const vorherE = monthlyIncome(g, 2, 1);
  assert.equal(takeLoan(g, 1, 1_000_000, 3, 10, { day: 15, month0: 9, year: 1997 }, 0), null);
  g.managers.at(1).balance -= 1_000_000;
  assert.equal(monthlyIncome(g, 2, 1), vorherE, "der Dritte bekommt keine fremden Zinsen");
  assert.equal(monthlyExpenses(g, 1), vorherA, "eigene Zinsen nicht in den Monatsausgaben");
  assert.deepEqual(kreditZinsen(g, 1), { gezahlt: 100_000, erhalten: 0 });
  assert.deepEqual(kreditZinsen(g, 0), { gezahlt: 0, erhalten: 100_000 });
  assert.equal(statistics(g, 1).expenses, monthlyExpenses(g, 1) + 100_000);
  assert.equal(statistics(g, 0).income, monthlyIncome(g, 0, 1) + 100_000);
});

test("B24: Punktabzug ohne Punkte wird vorgetragen und nachgeholt", () => {
  const g = laden("RIED-CLI.MAN");
  const m = g.managers.at(0);
  const s = g.standings.at(m.clubIndex);
  const punkte = () => s.u8(0) + s.u8(1);
  const setze = (heim: number, ausw: number) => { s.setU8(0, heim); s.setU8(2, heim); s.setU8(1, ausw); s.setU8(3, ausw); };
  g.activeManagers().forEach((mm) => { mm.balance = 100_000; });
  // 30.6.: Tabellen geleert, Konto unter der Grenze -> Kaufsperre, drei Punkte vorgetragen
  setze(0, 0);
  m.balance = DEBT_LIMIT - 1;
  let r = checkDebt(g);
  assert.deepEqual(r, [{ manager: 0, balance: DEBT_LIMIT - 1, points: 0, gesperrt: true, offen: DEBT_POINTS }]);
  assert.equal(debtCarry(g, 0), DEBT_POINTS);
  assert.ok(debtMessages(r[0], "LARS").own.join(" ").includes("folgt"));
  // 31.7.: ein Unentschieden am ersten Spieltag, Konto ausgeglichen -> 1 Punkt nachgeholt
  setze(1, 0);
  m.balance = 0;
  r = checkDebt(g);
  assert.deepEqual(r, [{ manager: 0, balance: 0, points: 1, gesperrt: false, offen: DEBT_POINTS - 1 }]);
  assert.equal(punkte(), 0);
  const text = debtMessages(r[0], "LARS");
  assert.ok(text.own.join(" ").includes("Nachgeholt") || text.own[0].includes("Nachgeholter"), JSON.stringify(text));
  // 31.8.: genug Punkte -> der Rest kommt weg, danach ist nichts mehr offen
  setze(4, 3);
  r = checkDebt(g);
  assert.equal(r[0].points, DEBT_POINTS - 1);
  assert.equal(punkte(), 7 - (DEBT_POINTS - 1));
  assert.equal(debtCarry(g, 0), 0);
  assert.deepEqual(checkDebt(g), []);
  // Neue Schulden mit zu wenig Punkten: abgezogen wird, was da ist, der Rest wartet
  setze(0, 1);
  m.balance = DEBT_LIMIT - 1;
  r = checkDebt(g);
  assert.equal(r[0].points, 1);
  assert.equal(r[0].offen, DEBT_POINTS - 1);
  // Original: keine Prüfung, das Byte bleibt unberührt
  const o = laden("RIED-CLI.MAN", false);
  o.managers.at(0).balance = DEBT_LIMIT - 1;
  const vorher = o.save.plain.slice();
  assert.deepEqual(checkDebt(o), []);
  assert.equal(debtCarry(o, 0), 0);
  assert.deepEqual(o.save.plain, vorher);
  assert.equal(o.save.plain[DEBT_CARRY_OFFSET], 0);
});

test("B25: wer aufhört, beendet seine Kuren", () => {
  const g = laden("RIED-CLI.MAN");
  const plaetze = [2, 5];
  for (const p of plaetze) assert.deepEqual(dopeStart(g, 0, p), { ok: true });
  const fremd = 25 + 3;
  assert.deepEqual(dopeStart(g, 1, 3), { ok: true });
  assert.equal(kurenBeenden(g, 0), 2);
  for (const p of plaetze) assert.equal(isDoped(g.lineups.at(p)), false);
  assert.equal(isDoped(g.lineups.at(fremd)), true, "die Kuren der Mitspieler bleiben");
  assert.equal(kurenBeenden(g, 0), 0);
  // Original: nichts
  const o = laden("RIED-CLI.MAN", false);
  const vorher = o.save.plain.slice();
  assert.equal(kurenBeenden(o, 0), 0);
  assert.deepEqual(o.save.plain, vorher);
});
