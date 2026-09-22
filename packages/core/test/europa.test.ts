import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, mulberryRng, dayIndex, seasonDay, setDayIndex,
  generateOffers, stadiumValue, signShirt, signBoard, monthlyAdvertising, seasonEndAdvertising, offerAmount, offerYears, shirtContract, boardContract, advertisingAmount,
  playCupMatch, playEuropaDay, playPlayoffDay, initialDraw, decideTie, europeanParticipants, currentPairs, cupRoundOf, legPlayed, orderList, clearCupResults,
  CUP_TABLE, CUP_ROUND, LEG_FLAG, HOLDER, DFB_WINNER, PLAYOFF_RESULT, ROUND_PAIRS, CUP_OUT, playCupDay, newSeason, tableOrder, texte, seasonEvents, releaseExpiring, playerValue
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Stadionwert und Sponsorenangebote: TEST4 liefert Beträge in der Größenordnung des Spielstands", () => {
  const g = load("TEST4.MAN");
  const sv = stadiumValue(g, 0);
  assert.ok(sv >= 0 && sv <= 100, `Stadionwert ${sv}`);
  const before = [0, 1].map((page) => Array.from({ length: 10 }, (_, s) => offerAmount(g, 0, page, s)));
  assert.deepEqual(before[0].slice(0, 4), [145225, 166960, 183860, 173631]);
  generateOffers(g, 0, mulberryRng(7));
  for (let page = 0; page < 2; page++) {
    const amounts = Array.from({ length: 10 }, (_, s) => offerAmount(g, 0, page, s)).filter((a) => a !== 0);
    assert.ok(amounts.length >= 3, `Seite ${page}: ${amounts.length} Angebote`);
    const [lo, hi] = page === 0 ? [60000, 600000] : [20000, 150000];
    for (const a of amounts) assert.ok(a >= lo && a <= hi, `Seite ${page}: ${a} DM`);
    for (let s = 0; s < 10; s++) if (offerAmount(g, 0, page, s)) assert.ok([1, 2, 3].includes(offerYears(g, 0, page, s)));
  }
});

test("Werbeverträge: Abschluss, Laufzeit, Monatsablauf und Saisonende wie im Original", () => {
  const g = load("TEST4.MAN");
  const p = g.save.plain;
  assert.deepEqual(shirtContract(g, 0), { months: 0, sponsor: 3 });
  assert.deepEqual(shirtContract(g, 1), { months: 32, sponsor: 3 });
  assert.deepEqual(boardContract(g, 0, 0), { months: 32, sponsor: 2 });
  const s = signShirt(g, 0, 0);
  assert.ok(s.ok, JSON.stringify(s));
  const years = offerYears(g, 0, 0, 0);
  assert.deepEqual(shirtContract(g, 0), { months: 12 * years, sponsor: 0 });
  assert.equal(advertisingAmount(g, 0, 0), 145225);
  assert.equal(signShirt(g, 0, 1).ok, false);
  const freeBoard = [0, 1, 2, 3, 4, 5].find((i) => boardContract(g, 0, i).months === 0)!;
  const b = signBoard(g, 0, freeBoard, 1);
  assert.ok(b.ok, JSON.stringify(b));
  assert.equal(offerAmount(g, 0, 1, 1), 0, "Bandenangebot erlischt");
  assert.equal(advertisingAmount(g, 0, 1 + freeBoard), 51043);
  p[33462] = 1; // Trikot läuft im nächsten Monat ab
  monthlyAdvertising(g, 0);
  assert.equal(shirtContract(g, 0).months, 0);
  assert.equal(advertisingAmount(g, 0, 0), Math.trunc(145225 / 10));
  // Saisonende nach einem Aufstieg (0x0CC00): der abgelaufene Trikotvertrag sinkt noch einmal
  // auf ein Zehntel, die laufende Bande behält ihren Betrag, alle Verträge enden. Kein Hinweis,
  // weil der Trikotvertrag nicht mehr lief.
  const bande = advertisingAmount(g, 0, 1 + freeBoard);
  assert.equal(seasonEndAdvertising(g, 0), false);
  assert.equal(advertisingAmount(g, 0, 0), Math.trunc(Math.trunc(145225 / 10) / 10));
  assert.equal(advertisingAmount(g, 0, 1 + freeBoard), bande, "laufende Bande behält ihren Betrag");
  for (let i = 0; i < 6; i++) assert.equal(boardContract(g, 0, i).months, 0);
  // Lief der Trikotvertrag noch, endet er, der Betrag bleibt, und der Hinweiskasten ist fällig
  assert.ok(signShirt(g, 0, 0).ok);
  const trikot = advertisingAmount(g, 0, 0);
  assert.equal(seasonEndAdvertising(g, 0), true);
  assert.equal(shirtContract(g, 0).months, 0);
  assert.equal(advertisingAmount(g, 0, 0), trikot, "Einnahmen bleiben erhalten");
});

test("Auslaufende Verträge: Verhandlung aufschiebbar, Freigabe bringt die Ablöse (0x0DB40)", () => {
  const g = load("TEST4.MAN");
  // Einen Spieler mit auslaufendem Vertrag herstellen und die Kaderreihenfolge merken
  const vor = g.squadOf(0).map((l) => l.playerIndex);
  // Ein junger Spieler (kein Rücktrittskandidat) mit abgelaufenem Vertrag
  const platz0 = g.squadOf(0).findIndex((l) => g.players.at(l.playerIndex).age < 30);
  const l0 = g.squadOf(0)[platz0];
  l0.setU8(11, 0);
  // Der Kaderplatz-Zeiger wandert beim Aufschieben mit, deshalb den Spieler selbst merken
  const spieler = l0.playerIndex;
  const name = g.players.at(spieler).displayName;
  const konto = g.managers.at(0).balance;
  // Mit Aufschub bleibt er im Kader und steht als offene Verhandlung in den Ereignissen
  const events = seasonEvents(g, [0, 0, 0], mulberryRng(3), true);
  const offen = events.filter((e) => e.vertrag);
  assert.ok(offen.some((e) => e.manager === 0 && e.vertrag!.playerIndex === spieler), "Verhandlung offen");
  assert.equal(g.squadOf(0).map((x) => x.playerIndex).includes(spieler), true, "Spieler bleibt im Kader");
  assert.equal(g.managers.at(0).balance, konto, "noch keine Ablöse");
  // Freigabe: Spieler weg, halber Marktwert als Ablöse (Regelwerk 1994), Kader ohne Lücke
  const platz = g.squadOf(0).findIndex((x) => x.playerIndex === spieler);
  const wert = playerValue(g, 0, platz, 0);
  const erg = releaseExpiring(g, 0, platz);
  assert.ok(erg.text.startsWith(name), erg.text);
  assert.equal(g.squadOf(0).map((x) => x.playerIndex).includes(spieler), false, "ist nicht mehr im Kader");
  assert.equal(g.managers.at(0).balance, konto + Math.trunc(wert / 2), "halber Marktwert");
  const nachher = g.squadOf(0).map((x) => x.playerIndex);
  assert.equal(nachher.length, vor.length - 1);
  assert.ok(nachher.every((x, i) => x === vor.filter((v) => v !== spieler)[i]), "Kader ist aufgeschoben, Reihenfolge bleibt");
});

test("Werbung am Saisonende: nur der Aufsteiger, alle anderen unberührt (0x0D924)", () => {
  const g = load("TEST4.MAN");
  // TEST4: die Manager sitzen auf den Vereinen 15 (Bundesliga), 21 und 31 (2. Liga). Verein 21
  // wird an die Spitze der 2. Liga gesetzt und steigt damit auf, Verein 31 bleibt unten.
  const spitze = g.standings.at(21);
  for (const [off, v] of [[0, 99], [1, 99], [22, 99], [23, 99], [26, 0], [27, 0]] as [number, number][]) spitze.setU8(off, v);
  // Allen einen laufenden Trikot- und Bandenvertrag geben, damit der Unterschied sichtbar wird
  g.activeManagers().forEach((_, i) => {
    g.save.plain[33462 + 2 * i] = 20;
    for (let s2 = 0; s2 < 6; s2++) g.save.plain[33470 + 2 * (6 * i + s2)] = 20;
  });
  const stand = (i: number) => JSON.stringify([shirtContract(g, i), [0, 1, 2, 3, 4, 5].map((s2) => boardContract(g, i, s2))]);
  const summen = (i: number) => [...Array(9).keys()].map((s2) => advertisingAmount(g, i, s2));
  const vorher = g.activeManagers().map((_, i) => stand(i));
  const betraege = g.activeManagers().map((_, i) => summen(i));
  const events = newSeason(g, mulberryRng(7));
  const auf = texte("ui.aufstieg");
  const aufsteiger = events.filter((e) => e.text === auf[0] || e.text === auf[1]).map((e) => e.manager);
  assert.deepEqual(aufsteiger, [1], "nur Manager 1 steigt auf");
  g.activeManagers().forEach((_, i) => {
    const leer = shirtContract(g, i).months === 0 && [0, 1, 2, 3, 4, 5].every((s2) => boardContract(g, i, s2).months === 0);
    assert.equal(leer, aufsteiger.includes(i), `Manager ${i}: Verträge enden genau bei Aufstieg`);
    if (!aufsteiger.includes(i)) assert.equal(stand(i), vorher[i], `Manager ${i}: Verträge unberührt`);
    assert.deepEqual(summen(i), betraege[i], `Manager ${i}: die Beträge bleiben erhalten`);
  });
  assert.deepEqual(events.find((e) => e.kasten)?.kasten, texte("ui.werbepartner"), "Hinweiskasten des Originals");
  assert.equal(events.filter((e) => e.kasten).length, 1, "nur für den Aufsteiger");
});

test("Hin-/Rückspielentscheid 0x19208: Gesamttore, Auswärtstore, offen", () => {
  const g = load("TEST4.MAN");
  const p = g.save.plain;
  const set = (h1: number, a1: number, h2: number, a2: number) => {
    // Hinspiel A (Heim) - B (Gast) h1:a1, Rückspiel B - A h2:a2; gespiegelt gespeichert
    p[28137] = a1; p[28137 + 1] = h1; p[28304 + 32] = h2; p[28304 + 33] = a2;
  };
  set(2, 0, 1, 0); assert.equal(decideTie(g, 1, 0, 100), 1, "A gewinnt 3:1 gesamt, A ist im Rückspiel Gast");
  set(0, 1, 2, 0); assert.equal(decideTie(g, 1, 0, 100), 0, "B gewinnt 3:0 gesamt, B ist Gastgeber");
  set(1, 0, 0, 2); assert.equal(decideTie(g, 1, 0, 100), 1, "A gewinnt 3:0 gesamt");
  set(1, 1, 1, 1); assert.equal(decideTie(g, 1, 0, 100), 30, "alles gleich");
  set(2, 1, 1, 0); assert.equal(decideTie(g, 1, 0, 100), 0, "2:2 gesamt, Auswärtstore B 1 gegen A 0");
  set(1, 1, 0, 0); assert.equal(decideTie(g, 1, 0, 100), 0, "1:1 gesamt, Auswärtstor für B");
  set(0, 0, 1, 1); assert.equal(decideTie(g, 1, 0, 100), 1, "1:1 gesamt, Auswärtstor für A");
  set(0, 0, 3, 3); assert.equal(decideTie(g, 1, 0, 320), 30, "Finale nach Tag 315: Unentschieden offen");
});

test("Europapokaltag: TEST4 spielt die Rückspiele der zweiten Runde, danach Runde 3 mit vier Paaren je Pokal", () => {
  const g = load("TEST4.MAN");
  for (const cup of [1, 2, 3]) {
    assert.equal(cupRoundOf(g, cup), 2);
    assert.ok(legPlayed(g, cup));
    assert.equal(currentPairs(g, cup).length, 8);
  }
  const before = [1, 2, 3].map((cup) => currentPairs(g, cup).flat());
  const { matches } = playEuropaDay(g, seasonDay(dayIndex(g)), mulberryRng(3));
  assert.equal(matches.length, 24);
  for (const m of matches) {
    assert.equal(m.leg, 2);
    assert.ok(m.winner === m.home || m.winner === m.away);
  }
  for (const cup of [1, 2, 3]) {
    assert.equal(cupRoundOf(g, cup), 3);
    assert.ok(!legPlayed(g, cup));
    const next = currentPairs(g, cup).flat();
    assert.equal(next.length, 8);
    assert.equal(new Set(next).size, 8);
    const winners = matches.filter((m) => m.cup === cup).map((m) => m.winner);
    assert.deepEqual(next.slice().sort((a, b) => a - b), winners.slice().sort((a, b) => a - b));
    for (const c of next) assert.ok(before[cup - 1].includes(c));
  }
  for (const m of g.activeManagers()) assert.deepEqual([m.u8(307), m.u8(308), m.u8(309)], [CUP_OUT, CUP_OUT, CUP_OUT]);
  assert.ok(g.save.plain.subarray(28304, 28432).every((b) => b === 0), "Ergebnistabelle gelöscht");
});

test("Auslosung 0x18600: Europabereiche mit 32 verschiedenen Vereinen, deutsche Teilnehmer auf Plätzen 1..31, DFB-Pokal mit Managervereinen", () => {
  const g = load("RUNA0.MAN");
  const p = g.save.plain;
  europeanParticipants(g);
  const champion = orderList(g, 0)[0];
  assert.equal(p[27988], champion);
  const rng = mulberryRng(11);
  for (let cup = 0; cup < 4; cup++) initialDraw(g, cup, rng);
  for (let cup = 0; cup < 4; cup++) {
    const slots = Array.from(p.subarray(CUP_TABLE + 32 * cup, CUP_TABLE + 32 * cup + 32));
    assert.equal(new Set(slots).size, 32, `Pokal ${cup}`);
    assert.equal(p[CUP_ROUND + cup], 1);
    if (cup === 0) {
      assert.ok(slots.every((c) => c <= 58));
      for (const m of g.activeManagers()) assert.ok(slots.includes(m.clubIndex));
    } else {
      assert.ok(p[CUP_TABLE + 32 * cup] >= 64, "Platz 0 bleibt ausländisch");
      for (let i = 0; i < 6; i++) {
        const c = p[27988 + 6 * (cup - 1) + i];
        if (c === 0x80) break;
        assert.ok(slots.includes(c), `deutscher Teilnehmer ${c} in Pokal ${cup}`);
      }
    }
  }
  const foreign = [1, 2, 3].flatMap((cup) => Array.from(p.subarray(CUP_TABLE + 32 * cup, CUP_TABLE + 32 * cup + 32)).filter((c) => c >= 64));
  assert.equal(new Set(foreign).size, foreign.length, "kein Auslandsverein in zwei Pokalen");
  assert.ok(g.activeManagers().some((m) => m.u8(306) === 1));
});

test("Relegation an den Tagen 91/92: Hin- und Rückspiel, Ausgang in 34367, Bereich 1 unverändert", () => {
  const g = load("RUNA0.MAN");
  const p = g.save.plain;
  const area = Array.from(p.subarray(CUP_TABLE + 32, CUP_TABLE + 64));
  const bl16 = orderList(g, 0)[15];
  const third = orderList(g, 1)[2];
  p[LEG_FLAG] = 0; // die Europapokale sind an diesem Tag beendet
  setDayIndex(g, 91);
  const first = playPlayoffDay(g, seasonDay(91), mulberryRng(4));
  assert.deepEqual([first.home, first.away, first.leg], [third, bl16, 1]);
  assert.equal(p[LEG_FLAG], 1);
  assert.deepEqual([p[28007], p[28008]], [first.result.away, first.result.home]);
  setDayIndex(g, 92);
  const second = playPlayoffDay(g, seasonDay(92), mulberryRng(5));
  assert.deepEqual([second.home, second.away, second.leg], [bl16, third, 2]);
  assert.equal(p[LEG_FLAG], 0);
  assert.ok(p[PLAYOFF_RESULT] === 0 || p[PLAYOFF_RESULT] === 1);
  assert.equal(second.winner, p[PLAYOFF_RESULT] === 1 ? third : bl16);
  assert.deepEqual(Array.from(p.subarray(CUP_TABLE + 32, CUP_TABLE + 64)), area);
});

test("DFB-Pokal-Finale setzt Pokalsieger und Finalist; Saisonwechsel lost alle vier Pokale neu", () => {
  const g = load("RUNA0.MAN");
  const p = g.save.plain;
  p[CUP_ROUND] = 5;
  const played = playCupDay(g, mulberryRng(9));
  assert.equal(played.length, 1);
  assert.equal(p[DFB_WINNER], played[0].winner! + 1);
  assert.equal(p[2344], (played[0].winner === played[0].home ? played[0].away : played[0].home) + 1);
  newSeason(g, mulberryRng(6));
  for (let cup = 0; cup < 4; cup++) assert.equal(p[CUP_ROUND + cup], 1);
  assert.equal(new Set(Array.from(p.subarray(CUP_TABLE + 32, CUP_TABLE + 64))).size, 32);
  assert.equal(tableOrder(g, 0).length, 18);
  void HOLDER; void ROUND_PAIRS; void clearCupResults;
});

test("Pokaleinnahmen: der Gast bekommt seine Hälfte auch beim Rechnerverein (GitLab #75)", () => {
  const g = load("RUNA0.MAN");
  const p = g.save.plain;
  const geld = (m: number) => g.managers.at(m).i32(496);
  const tag = seasonDay(dayIndex(g));

  // Auswärts bei einem Amateurverein: im Original (0x1CA12 bis 0x1CA87) würfelt die
  // Spielvorbereitung Kulisse und Eintrittspreis aus und bucht dem Gast die Hälfte.
  p[CUP_TABLE] = 60; // Amateur-Oberliga, kein Managerverein
  p[CUP_TABLE + 1] = 15; // Verein des ersten Managers
  const zaehler = g.managers.at(0).u8(314);
  const vorher = geld(0);
  const auswaerts = playCupMatch(g, 0, 0, false, tag, mulberryRng(11));
  const anteil = geld(0) - vorher;
  assert.ok(anteil > 0, `Gast geht leer aus: ${anteil} DM`);
  // Hälfte von Kulisse mal Ligasatz (8 oder 9 DM in der Oberliga), Kulisse höchstens 6000·10
  assert.ok(anteil <= (9 * 60000) / 2, `${anteil} DM sind zu viel für eine Oberligakulisse`);
  assert.equal(auswaerts.attendance, undefined, "kein Heimspiel, also keine Zuschauerzahl");
  assert.equal(g.managers.at(0).u8(314), zaehler, "die Zuschauerhistorie bleibt dem Heimverein");

  // Manager gegen Manager: beide bekommen dieselbe Hälfte, gerechnet mit dem Preis des
  // Heimvereins (19 DM) - nicht jeder mit seinem eigenen (0x1C9DC nimmt den Satz über -0x1e).
  p[CUP_TABLE] = 15;
  p[CUP_TABLE + 1] = 21;
  const stand = [geld(0), geld(1)];
  const daheim = playCupMatch(g, 0, 0, false, tag, mulberryRng(12));
  assert.equal(geld(0) - stand[0], daheim.gate, "der Gastgeber bucht seine Hälfte");
  assert.equal(geld(1) - stand[1], daheim.gate, "der Gast bekommt dieselbe Hälfte");
  assert.equal(daheim.gate, Math.trunc((daheim.attendance! * 19) / 2), "Preis des Heimvereins");
});
