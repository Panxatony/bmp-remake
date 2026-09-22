import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { texte, SaveFile, GameState, fixtures, applyResult, updatePositions, playMatchday, afterMatch, dailyTraining, trainingInjuries, injuries, bookGoal, attendance, bookAttendance, monthlyIncome, monthlyExpenses, loanTotal, bookMonth, dailyFinance, playCupDay, cupPairs, cupRound, CUP_OUT, newSeason, tableOrder, playerValue, promoteRelegate, swapClubs, salaryDemand, mulberryRng, dayIndex, seasonDay, dateOfSeasonDay, seasonStartYear, setDayIndex } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (n: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, n)))));

test("Spielplan: erzeugte Paarungen entsprechen den gespeicherten aller Spielstände", () => {
  const files = readdirSync(BMP_DIR).filter((f) => f.endsWith(".MAN"));
  assert.ok(files.length >= 9);
  for (const f of files) {
    const g = load(f);
    for (let league = 0; league < 3; league++) {
      assert.deepEqual(fixtures(league, g.nextMatchday(league)), g.pairings(league), `${f} Liga ${league + 1}`);
    }
  }
});

for (const [from, to] of [["TEST4.MAN", "RUNA0.MAN"], ["TEST3.MAN", "RUN0.MAN"]]) test(`Tabelle: Ergebnisse von ${to} auf ${from} angewendet ergeben die Tabelle von ${to}`, () => {
  const before = load(from);
  const after = load(to);
  const md = before.nextMatchday(0) - 1;
  before.pairings(0).forEach(([h, a], m) => {
    const r = after.result(0, md, m)!;
    assert.ok(r);
    if (r.postponed) return;
    applyResult(before, h, a, r.home, r.away);
  });
  updatePositions(before, 0);
  for (let c = 0; c < 18; c++) {
    const x = before.standings.at(c);
    const y = after.standings.at(c);
    const diff: string[] = [];
    for (let i = 0; i < 54; i++) if (x.u8(i) !== y.u8(i)) diff.push(`${i}: ${x.u8(i)} vs ${y.u8(i)}`);
    assert.deepEqual(diff, [], `${before.clubs.at(c).str(0, 20).trim()}: ${diff.join(", ")}`);
  }
});

test("Kalender: Tagindex ergibt Saisontag und Datum aller Spielstände", () => {
  for (const f of readdirSync(BMP_DIR).filter((f) => f.endsWith(".MAN"))) {
    const g = load(f);
    const k = dayIndex(g);
    const p = g.save.plain;
    assert.equal(seasonDay(k), p[27972] | (p[27973] << 8), `${f} Saisontag`);
    const dt = dateOfSeasonDay(seasonDay(k), seasonStartYear(g));
    assert.deepEqual([dt.day, dt.month0, dt.year], [p[27960], p[27964], p[27968] | (p[27969] << 8)], `${f} Datum`);
    const copy = load(f);
    setDayIndex(copy, k);
    assert.deepEqual(copy.save.plain, g.save.plain, `${f} setDayIndex unverändert`);
  }
});

test("Spieltag: nach dem Spielen stimmen Spieltagszähler, Paarungen und Datum mit RUNA0 überein", () => {
  const g = load("TEST4.MAN");
  const after = load("RUNA0.MAN");
  const played = playMatchday(g, 0, mulberryRng(3));
  assert.equal(played.length, 9);
  assert.equal(g.nextMatchday(0), after.nextMatchday(0));
  assert.deepEqual(g.pairings(0), after.pairings(0));
  setDayIndex(g, dayIndex(g) + 1);
  assert.equal(dayIndex(g), dayIndex(after));
  assert.deepEqual(Array.from(g.save.plain.subarray(27960, 27976)), Array.from(after.save.plain.subarray(27960, 27976)));
  // Ergebnisse stehen in der Tabelle und Tabelle ist konsistent
  for (let m = 0; m < 9; m++) assert.ok(g.result(0, 9, m) && !g.result(0, 9, m)!.postponed);
});

test("Nachbereitung: Pokalspiel TEST1 -> TEST2 zählt Pokaleinsätze und 16-Bit-Zähler hoch, Liga bleibt", () => {
  const g = load("TEST1.MAN");
  const after = load("TEST2.MAN");
  afterMatch(g, 0, 1, mulberryRng(5));
  const a = g.squadOf(0);
  const b = after.squadOf(0);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    for (const off of [6, 7, 13, 28, 29, 30, 31]) assert.equal(a[i].u8(off), b[i].u8(off), `Platz ${i} Byte ${off}`);
    assert.equal(g.players.at(a[i].playerIndex).appearances, after.players.at(b[i].playerIndex).appearances, `Platz ${i} Spielereinsätze`);
  }
});

test("Training: Änderungen je Tag bleiben klein und in den Grenzen", () => {
  const g = load("TEST3.MAN");
  const before = g.squadOf(0).map((l) => [l.u8(14), l.u8(16), l.u8(17), l.u8(18), l.u8(19)]);
  dailyTraining(g, 0, seasonDay(dayIndex(g)), { endless: 0, level: 3 }, mulberryRng(11));
  const after = g.squadOf(0).map((l) => [l.u8(14), l.u8(16), l.u8(17), l.u8(18), l.u8(19)]);
  let moved = 0;
  after.forEach((a, i) => {
    for (let k = 1; k <= 3; k++) {
      const d = a[k] - before[i][k];
      assert.ok(Math.abs(d) <= 3, `Platz ${i} Wert ${k}: ${d}`);
      if (d !== 0) moved++;
    }
    assert.ok(a[0] >= 30 && a[0] <= 68, `Faktor ${a[0]}`);
    assert.ok(a[4] >= 60 && a[4] <= 150, `Frische ${a[4]}`);
    if (a[3] !== before[i][3]) assert.ok(a[3] >= 45 && a[3] <= 55, `Form ${a[3]}`);
  });
  console.log("Training: bewegte Werte", moved, "von", after.length * 3);
});

test("Trainingsverletzungen: seltene Ereignisse mit Dauer aus der Tabelle", () => {
  const rng = mulberryRng(21);
  let count = 0;
  const durations: number[] = [];
  for (let day = 0; day < 400; day++) {
    const g = load("TEST4.MAN");
    for (const i of trainingInjuries(g, 0, 3, day % 2 === 0, rng)) {
      count++;
      const l = g.squadOf(0)[i];
      durations.push(l.u8(13));
      assert.ok(l.u8(9) & 2);
      assert.equal(l.number, 0);
      const w = injuries()[l.u8(23)].weeks;
      assert.ok(l.u8(13) >= w && l.u8(13) <= w + Math.trunc(w / 4) + 1, `Dauer ${l.u8(13)} bei ${w} Wochen`);
    }
  }
  // 400 Tage x ~24 gesunde Spieler, Wahrscheinlichkeit je ~1/250..1/400
  assert.ok(count > 8 && count < 80, `Verletzungen: ${count}`);
});

test("Torschützen: nur Starter, Statistik und Bewertung werden gebucht", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(31);
  const before = g.squadOf(0).map((l) => [l.number, l.u8(3), l.u8(21), g.players.at(l.playerIndex).u8(34)]);
  const counts = new Map<number, number>();
  for (let i = 0; i < 200; i++) {
    const rec = bookGoal(g, 0, 0, rng)!;
    assert.ok(rec);
    counts.set(rec.scorer, (counts.get(rec.scorer) ?? 0) + 1);
    assert.notEqual(rec.assist, rec.scorer);
  }
  const squad = g.squadOf(0);
  let total = 0;
  squad.forEach((l, i) => {
    const goals = l.u8(3) - before[i][1];
    total += goals;
    if (goals > 0) assert.ok(before[i][0] >= 1 && before[i][0] <= 11, `Platz ${i} ist kein Starter`);
    assert.equal(g.players.at(l.playerIndex).u8(34) - before[i][3], goals);
  });
  assert.equal(total, 200);
  // Stürmer treffen häufiger als Abwehrspieler
  const byLine = (lo: number, hi: number) => squad.reduce((s, l, i) => (l.number >= 1 && l.number <= 11 && l.fieldLine >= lo && l.fieldLine <= hi ? s + l.u8(3) - before[i][1] : s), 0);
  assert.ok(byLine(0, 1) > byLine(5, 7), `Sturm ${byLine(0, 1)} vs Abwehr ${byLine(5, 7)}`);
});

test("Zuschauer: Nürnberg - Schalke ist wie in allen Originalläufen ausverkauft (24000)", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(41);
  for (let i = 0; i < 20; i++) assert.equal(attendance(g, { manager: 0, home: 15, away: 3, level: 3 }, rng), 24000);
  // Buchung wie TEST4 -> RUNA0
  const after = load("RUNA0.MAN");
  bookAttendance(g, 0, 24000, 3);
  const a = g.managers.at(0), b = after.managers.at(0);
  assert.equal(a.attendanceTotal, b.attendanceTotal);
  assert.equal(a.u8(314), b.u8(314));
  for (let i = 0; i < 16; i++) assert.equal(a.u8(330 + i), b.u8(330 + i), `Historie ${i}`);
  // schwächerer Gegner, hoher Preis: unter der Kapazität, über 500
  const w = attendance(g, { manager: 0, home: 15, away: 4, level: 3 }, rng);
  assert.ok(w > 500 && w <= 24000, `Zuschauer ${w}`);
});

test("Finanzen: Monatsausgaben von RIED-CLI exakt, Einnahmen aus Grundwert, Werbung und Fremdzinsen", () => {
  const g = load("RIED-CLI.MAN");
  assert.equal(monthlyExpenses(g, 0), 1172205);
  const m = g.managers.at(0);
  const c = g.clubs.at(m.clubIndex);
  let s = 0;
  for (let l = 0; l < 3; l++) s += c.u8(24 + l) + c.u8(27 + l);
  const income = monthlyIncome(g, 0, 11);
  const q = m.u8(480) | (m.u8(481) << 8);
  assert.equal(q, 5 * s * g.squadOf(0).length + Math.trunc((m.u8(476) | (m.u8(477) << 8)) / 5) + 25);
  assert.equal(income, q + 775166 + loanTotal(g, 1, true) + loanTotal(g, 2, true));
  const before = m.balance;
  const b = bookMonth(g, 0, 11);
  assert.equal(m.balance, before + b.income - b.expenses);
});

test("Stadionkomfort nutzt sich ab: 1/(442 - 52·Note) je Tag, nie unter 1 (0x0E444)", () => {
  const g = load("RIED-CLI.MAN");
  const m = g.managers.at(0);
  const setzen = (note: number) => {
    for (let i = 0; i < 4; i++) m.setU8(398 + i, (note >>> (8 * i)) & 0xff);
  };
  // Häufigkeit über viele Tage: bei Note 3 erwartet man rund 1/286
  setzen(3);
  const rng = mulberryRng(11);
  let faelle = 0;
  for (let tag = 0; tag < 3000; tag++) {
    setzen(3);
    if (dailyFinance(g, 0, { day: 12, month0: 10, year: 1997 }, rng).some((e) => e.kind === "komfort")) faelle++;
  }
  assert.ok(faelle > 3 && faelle < 25, `erwartet rund 10 Fälle in 3000 Tagen, waren ${faelle}`);
  // Die Note fällt um genau eins und nie unter 1
  setzen(6);
  let runden = 0;
  while (m.i32(398) > 1 && runden++ < 100000) dailyFinance(g, 0, { day: 12, month0: 10, year: 1997 }, rng);
  assert.equal(m.i32(398), 1, "bei 1 hört die Abnutzung auf");
  const ohne = dailyFinance(g, 0, { day: 12, month0: 10, year: 1997 }, rng);
  assert.equal(ohne.some((e) => e.kind === "komfort"), false, "unter 2 wird nicht mehr gewürfelt");
});

test("Tagesfinanzen: Monatsende bucht, Zinsen am Fälligkeitstag, Krawall zieht Schaden ab", () => {
  const g = load("RIED-CLI.MAN");
  const m = g.managers.at(0);
  const before = m.balance;
  assert.equal(dailyFinance(g, 0, { day: 12, month0: 10, year: 1997 }, mulberryRng(3)).length, 0);
  assert.equal(m.balance, before);
  const ev = dailyFinance(g, 0, { day: 30, month0: 10, year: 1997 }, mulberryRng(3));
  assert.ok(ev.some((e) => e.kind === "month"));
  assert.equal(m.balance, before + monthlyIncome(g, 0, 30) + Math.trunc(before / 75) - monthlyExpenses(g, 0));
  m.setU8(318, 1);
  const b2 = m.balance;
  const riot = dailyFinance(g, 0, { day: 1, month0: 11, year: 1997 }, mulberryRng(3));
  assert.equal(riot[0].kind, "riot");
  assert.ok(riot[0].amount! >= 12000 * 1 && riot[0].amount! % 1000 === 0 && m.balance === b2 - riot[0].amount!);
  assert.equal(m.u8(318) & 1, 0);
});

test("DFB-Pokal: TEST1 spielt die dritte Runde (vier Paarungen), Sieger werden neu gelost, Managerrunde gesetzt", () => {
  const g = load("TEST1.MAN");
  assert.equal(cupRound(g, dayIndex(g)), 2);
  const pairs = cupPairs(g, 2);
  assert.deepEqual(pairs, [[37, 8], [15, 12], [27, 13], [2, 25]]);
  const played = playCupDay(g, mulberryRng(8));
  assert.equal(played.length, 4);
  const winners = played.map((m) => m.winner);
  const next = cupPairs(g, 3).flat();
  assert.deepEqual(next.slice().sort(), winners.slice().sort());
  const normi = g.managers.at(0).u8(306);
  assert.ok(normi === 4 || normi === CUP_OUT, `Pokalrunde ${normi}`);
  assert.equal(normi === 4, winners.includes(15));
  for (const m of played) if (m.penalties) assert.notEqual(m.penalties[0], m.penalties[1]);
});

test("Saisonwechsel: Ligen bleiben konsistent, Tabellen und Spieltage zurückgesetzt, Datum 29. Juli, Pokal 16 Paare", () => {
  const g = load("RUNA0.MAN");
  const before = g.activeManagers().map((m) => g.clubs.at(m.clubIndex).displayName);
  const order0 = tableOrder(g, 0);
  const last = order0[17];
  newSeason(g, mulberryRng(2));
  // Managervereine folgen dem Tausch
  g.activeManagers().forEach((m, i) => assert.equal(g.clubs.at(m.clubIndex).displayName, before[i]));
  // Spielerzugehörigkeit passt zum Vereinsplatz
  g.activeManagers().forEach((m, i) => {
    for (const l of g.squadOf(i)) assert.equal(g.players.at(l.playerIndex).u8(36), m.clubIndex);
  });
  for (let l = 0; l < 3; l++) {
    assert.equal(g.nextMatchday(l), 1);
    assert.deepEqual(g.pairings(l), fixtures(l, 1));
  }
  for (let c = 0; c < 58; c++) assert.equal(g.standings.at(c).u8(0) + g.standings.at(c).u8(30), 0);
  assert.equal(dayIndex(g), 0);
  assert.deepEqual([g.date.day, g.date.month, g.date.year], [29, 7, 1998]);
  assert.equal(g.managers.at(0).u8(306), 1);
  const pairs = cupPairs(g, 0);
  assert.equal(pairs.length, 16);
  assert.equal(new Set(pairs.flat()).size, 32);
  assert.ok(pairs.flat().every((c) => c >= 0 && c <= 58));
  for (const m of g.activeManagers()) assert.ok(pairs.flat().includes(m.clubIndex), "Managerverein im Pokal");
  assert.ok(g.managers.at(0).history.length >= 1);
  // Absteiger der Bundesliga stehen jetzt in der 2. Liga, Zweitligameister in der Bundesliga
  const g2 = load("RUNA0.MAN");
  const nameOf = (c: number) => g2.clubs.at(c).displayName;
  const order1 = tableOrder(g2, 1);
  const up1 = nameOf(order1[0]);
  const up2 = nameOf(order1[1]);
  const lastName = nameOf(tableOrder(g2, 0)[17]);
  const moves = promoteRelegate(g2, mulberryRng(2));
  assert.ok(moves.down.length >= 6 && moves.up.length === moves.down.length);
  const blNames = Array.from({ length: 18 }, (_, c) => g2.clubs.at(c).displayName);
  assert.ok(blNames.includes(up1) && blNames.includes(up2), "Zweitliga-Erster und -Zweiter in der Bundesliga");
  assert.ok(!blNames.includes(lastName), "Bundesliga-Letzter abgestiegen");
  assert.ok(moves.playoff, "Relegationsspiel gespielt");
  void last;
});

test("Marktwert und Saisonereignisse: Werte plausibel, Ereignisse laufen ohne Kaderbruch", () => {
  const g = load("RIED-CLI.MAN");
  const v = playerValue(g, 0, 0, 0);
  assert.ok(v > 10000 && v < 20000000, `Wert ${v}`);
  const s = playerValue(g, 0, 0, 1);
  assert.ok(s > 100 && s < 2000000, `Gehaltsbasis ${s}`);
  const events = newSeason(g, mulberryRng(5));
  g.activeManagers().forEach((m, i) => {
    for (const l of g.squadOf(i)) {
      const p = g.players.at(l.playerIndex);
      assert.equal(p.u8(33), i);
      assert.equal(p.u8(36), m.clubIndex);
    }
  });
  assert.ok(Array.isArray(events));
});

test("Gehaltsforderung: mindestens das bisherige Gehalt, mit der Laufzeit steigend", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0);
  const d1 = salaryDemand(g, 0, 0, 1);
  const d3 = salaryDemand(g, 0, 0, 3);
  assert.ok(d1 >= l.i32(40));
  assert.ok(d3 >= d1, `${d3} >= ${d1}`);
});

test("Liga des Managers wandert beim Auf- und Abstieg mit (GitLab #76)", () => {
  // In allen Spielständen des Originals stimmt Managerbyte 312 mit dem Ligaband des
  // Vereinsindex überein; das Original zieht es beim Saisonwechsel nach (0x1E3A4).
  const liga = (club: number) => (club < 18 ? 0 : club < 38 ? 1 : 2);
  const g = load("RUNA0.MAN");
  const m = g.activeManagers()[0];
  assert.equal(g.managers.at(0).u8(312), liga(m.clubIndex), "Ausgangsstand");
  const bundesligist = m.clubIndex;
  swapClubs(g, bundesligist, 25); // Abstieg in die zweite Liga
  assert.equal(g.activeManagers()[0].clubIndex, 25);
  assert.equal(g.managers.at(0).u8(312), 1, "nach dem Abstieg zweite Liga");
  swapClubs(g, 25, bundesligist); // und wieder hoch
  assert.equal(g.managers.at(0).u8(312), 0, "nach dem Aufstieg wieder Bundesliga");

  // Über einen ganzen Saisonwechsel: die Invariante muss für jeden Manager gelten
  const h = load("RUNA0.MAN");
  for (let saison = 0; saison < 3; saison++) {
    newSeason(h, mulberryRng(20 + saison));
    h.activeManagers().forEach((mg, i) => {
      assert.equal(h.managers.at(i).u8(312), liga(mg.clubIndex), `Saison ${saison}, Manager ${i}, Verein ${mg.clubIndex}`);
    });
  }
});

test("Tagesroutine (#83): Komfort nur in der Bundesliga, Krawall schadet Komfort 390, ab Tag 322 Ruhe", () => {
  const g = load("RIED-CLI.MAN");
  const m = g.managers.at(0);
  const i32 = (o: number, v: number) => { for (let i = 0; i < 4; i++) m.setU8(o + i, (v >>> (8 * i)) & 0xff); };
  const tag = { day: 12, month0: 10, year: 1997 };
  const null0 = (lo: number) => lo; // jeder Wurf ist der kleinste, also 0

  // F2: die Abnutzung von Komfort 398 gilt nur in der Bundesliga (0x0E49B)
  i32(398, 4);
  m.setU8(312, 1);
  assert.equal(dailyFinance(g, 0, tag, null0).some((e) => e.kind === "komfort"), false, "Zweitligist nutzt nicht ab");
  assert.equal(m.i32(398), 4);
  m.setU8(312, 0);
  assert.equal(dailyFinance(g, 0, tag, null0).some((e) => e.kind === "komfort"), true, "Bundesligist nutzt ab");
  assert.equal(m.i32(398), 3);

  // F1: nach Krawall sinkt Komfort 390 (0x0E3BC) - mit dem kleinsten Wurf trifft es
  i32(390, 4);
  m.setU8(318, m.u8(318) | 1);
  dailyFinance(g, 0, tag, null0);
  assert.equal(m.i32(390), 3, "Komfort 390 nach Krawall um eins gesunken");
  // ... aber nie unter 1
  i32(390, 1);
  m.setU8(318, m.u8(318) | 1);
  dailyFinance(g, 0, tag, null0);
  assert.equal(m.i32(390), 1);
  // Ohne Treffer (größter Wurf) bleibt er stehen
  i32(390, 4);
  m.setU8(318, m.u8(318) | 1);
  dailyFinance(g, 0, tag, (_lo: number, hi: number) => hi);
  assert.equal(m.i32(390), 4, "kein Treffer, kein Schaden am Komfort");

  // F6: ab Saisontag 322 kein Krawallschaden und keine Abnutzung (die Tagesroutine entfällt)
  i32(398, 4);
  m.setU8(318, m.u8(318) | 1);
  const vorher = m.i32(496);
  const ev = dailyFinance(g, 0, tag, null0, undefined, false);
  assert.equal(ev.some((e) => e.kind === "riot" || e.kind === "komfort"), false);
  assert.equal(m.i32(496), vorher, "kein Schaden gebucht");
  assert.equal(m.u8(318) & 1, 1, "der Krawall bleibt vorgemerkt");
});

test("Karriereende am Saisonende wie im Original (0x0D475, #81)", () => {
  const g = load("RIED-CLI.MAN");
  const p = g.save.plain;
  void p;
  // Zwei Kaderspieler: einer hat angekündigt und sein Vertrag läuft aus, einer ist nur alt
  const kader = g.squadOf(0);
  const ankuendiger = kader[2];
  const alter = kader[3];
  const idxA = ankuendiger.playerIndex;
  const idxB = alter.playerIndex;
  ankuendiger.setU8(11, 1); // läuft nach dem Herunterzählen aus
  ankuendiger.setU8(24, 0x80);
  g.players.at(idxA).setU8(26, 29); // nicht einmal alt
  alter.setU8(11, 3);
  alter.setU8(24, 0);
  g.players.at(idxB).setU8(26, 36); // sehr alt, aber ohne Ankündigung
  // Ein Spieler ohne Verein, 34 Jahre: geht bei random(32,34) < 34
  const imKader = new Set<number>();
  for (let s = 0; s < 125; s++) { const l = g.lineups.at(s); if (!l.isEmpty) imKader.add(l.playerIndex); }
  let pool = 1;
  while (imKader.has(pool)) pool++;
  g.players.at(pool).setU8(26, 34);

  const events = newSeason(g, mulberryRng(8));
  const indizes = new Set(g.squadOf(0).map((l) => l.playerIndex));
  assert.equal(indizes.has(idxA), false, "wer angekündigt hat und ausläuft, geht");
  assert.ok(events.some((e) => e.manager === 0 && e.text.includes(texte("ui.karriereende")[2])), "mit der Meldung");
  assert.equal(indizes.has(idxB), true, "ein 36-Jähriger mit Vertrag bleibt");
  // Neu belegt nach dem Altern (0x0D420 vor 0x0D5BE): also 18 bis 25
  assert.ok(g.players.at(idxA).u8(26) >= 18 && g.players.at(idxA).u8(26) <= 25, "Datensatz neu belegt");
  // Wie in allen Originalspielständen: danach ist kein Spieler ohne Verein älter als 34 - erst
  // wird gealtert, und ein 35-Jähriger liegt immer über random(32,34)
  for (let x = 1; x < 151; x++) {
    if (g.squadOf(0).some((l) => l.playerIndex === x)) continue;
    let inKader = false;
    for (let s = 0; s < 125; s++) if (!g.lineups.at(s).isEmpty && g.lineups.at(s).playerIndex === x) inKader = true;
    if (inKader) continue;
    assert.ok(g.players.at(x).u8(26) <= 34, `Poolspieler ${x} ist ${g.players.at(x).u8(26)}`);
  }
});
