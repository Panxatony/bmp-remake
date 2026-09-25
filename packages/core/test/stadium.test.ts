import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, stadiumState, stadiumCapacity, buildDays, buildWeeks, restWochen, extendStadium, dailyConstruction, bauAblehnen, bauGesperrt, setTicketPrice, takeLoan, loanRate, LOAN_MONTHS, lenderDebt, BANK, dailyFinance, texte } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Stadion: Ausbau in Tausenderschritten, Bauzeit, Fertigstellung; Komfortstufen", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  m.balance = 5000000;
  const before = stadiumState(g, 0);
  assert.equal(before[0].price, 150000);
  const bal = m.balance;
  const r = extendStadium(g, 0, 1, 2000, mulberryRng(1));
  assert.ok(r.ok, JSON.stringify(r));
  if (r.ok) {
    assert.equal(r.cost, 300000);
    assert.equal(m.balance, bal - 300000);
    assert.ok(r.days >= 84 && r.days <= 126, `Bautage ${r.days}`);
  }
  const st = stadiumState(g, 0)[0];
  assert.equal(st.pending, 2000);
  assert.equal(st.value, before[0].value);
  let done: number[] = [];
  for (let d = 0; d < 200 && done.length === 0; d++) done = dailyConstruction(g, 0);
  assert.ok(done.includes(1), `fertig: ${done}`);
  assert.equal(stadiumState(g, 0)[0].value, before[0].value + 2000);
  assert.equal(stadiumState(g, 0)[0].pending, 0);
  assert.equal(extendStadium(g, 0, 1, 1500, mulberryRng(1)).ok, false);
  const comfort = stadiumState(g, 0)[6];
  const r2 = extendStadium(g, 0, 7, comfort.value + comfort.pending + 1, mulberryRng(2));
  assert.ok(r2.ok && r2.cost === 650000, JSON.stringify(r2));
  assert.equal(extendStadium(g, 0, 7, comfort.value, mulberryRng(2)).ok, false);
  assert.equal(setTicketPrice(g, 0, 30), "Eintrittspreis 5 bis 25 DM");
  assert.equal(setTicketPrice(g, 0, 12), null);
  assert.equal(m.ticketPrice, 12);
});

test("Bank: Kredit mit Zinssatz je Laufzeit, Zinsen am Fälligkeitstag, Rückzahlung im Fälligkeitsmonat", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  const bal = m.balance;
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => loanRate(g, i)), [7, 5, 3, 2, 2, 2]);
  assert.equal(takeLoan(g, 0, 5000000, LOAN_MONTHS[0], loanRate(g, 0), { day: 30, month0: 8, year: 1997 }), [texte("ui.kreditgrenze")[0], ...texte("ui.kreditgrenze").slice(4)].join(" "));
  assert.equal(takeLoan(g, 0, 1000000, LOAN_MONTHS[1], loanRate(g, 1), { day: 30, month0: 8, year: 1997 }), null);
  assert.equal(m.balance, bal + 1000000);
  const loan = m.loans().find((l) => !l.isEmpty)!;
  assert.equal(loan.amount, 1000000);
  assert.equal(loan.monthlyInterest, 50000);
  assert.equal(LOAN_MONTHS[1], 6);
  assert.deepEqual([loan.dueDay, loan.dueMonth, loan.dueYear], [30, 2, 1998]);
  const b2 = m.balance;
  const ev = dailyFinance(g, 0, { day: 30, month0: 9, year: 1997 }, mulberryRng(3));
  assert.ok(ev.some((e) => e.kind === "interest"));
  assert.equal(m.balance, b2 - 50000);
  // Bei drei Krediten je Geldgeber ist Schluss, die Grenze zaehlt die Schulden beim selben Geber
  assert.equal(takeLoan(g, 0, 1000000, 3, 7, { day: 1, month0: 0, year: 1998 }), null);
  assert.equal(takeLoan(g, 0, 1000000, 3, 7, { day: 1, month0: 0, year: 1998 }), null);
  assert.equal(takeLoan(g, 0, 1000000, 3, 7, { day: 1, month0: 0, year: 1998 }), texte("ui.dreikredite").join(" "));
  assert.equal(lenderDebt(g, 0, BANK), 3000000);
});

test("Bank: Kredit von einem Mitspieler (0x1320B) mit Grenzen fuer Laufzeit, Satz und Kontostand", () => {
  const g = load("TEST4.MAN");
  const me = 0;
  const other = 1;
  const lender = g.managers.at(other);
  lender.balance = 900000;
  const date = { day: 12, month0: 4, year: 1997 };
  assert.equal(takeLoan(g, me, 200000, 30, 6, date, other), "Maximal 24 Monate.");
  assert.equal(takeLoan(g, me, 200000, 12, 14, date, other), texte("ui.wucher").join(" "));
  assert.equal(takeLoan(g, me, 200000, 12, 2, date, other), texte("ui.mindestzins").slice(1).join(" "));
  assert.equal(takeLoan(g, me, 950000, 12, 6, date, other), `${texte("ui.kreditabsage")[0]} ${texte("ui.kreditabsage")[1]} ${lender.displayName} ${texte("ui.kreditabsage")[2]}`);
  const mine = g.managers.at(me).balance;
  assert.equal(takeLoan(g, me, 200000, 12, 6, date, other), null);
  assert.equal(g.managers.at(me).balance, mine + 200000);
  assert.equal(lender.balance, 700000);
  const l = g.managers.at(me).loans(other)[0];
  assert.deepEqual([l.amount, l.monthlyInterest, l.ratePercent, l.dueDay, l.dueMonth, l.dueYear], [200000, 12000, 6, 12, 4, 1998]);
  // Die Grenze zaehlt die Schulden beim selben Mitspieler; sein Kontostand wird vorher geprueft
  lender.balance = 5000000;
  assert.equal(takeLoan(g, me, 900000, 12, 6, date, other), texte("ui.kreditgrenze").slice(0, 4).join(" "));
  assert.equal(takeLoan(g, me, 800000, 12, 6, date, other), null);
});

test("Gesamtkapazität und Bauwochen wie im Original (TEST4 in DOSBox nachgemessen, GitLab #55)", () => {
  const g = load("TEST4.MAN");
  // Stand des Spielstands: 8.000 Sitz-, 16.000 Stehplätze, 0 überdachte, 2.000 überdachte im Bau
  const st = stadiumState(g, 0);
  assert.deepEqual([st[0].value, st[1].value, st[2].value, st[2].pending], [8000, 16000, 0, 2000]);
  // Das Original zeigt in beiden Spalten 24.000: überdachte Plätze zählen nicht mit
  assert.deepEqual(stadiumCapacity(g, 0), { jetzt: 24000, nachAusbau: 24000 });
  // Auch fertig gebaut ändern sie die Kapazität nicht
  const m = g.managers.at(0);
  for (let i = 0; i < 4; i++) m.setU8(366 + i, i === 0 ? 0xd0 : i === 1 ? 0x07 : 0); // 2000
  for (let i = 0; i < 4; i++) m.setU8(370 + i, 0);
  assert.deepEqual(stadiumCapacity(g, 0), { jetzt: 24000, nachAusbau: 24000 });
  // Restzeit in Wochen wie 0x1FBB, im Original gemessen mit den nach dem Laden gespeicherten
  // Tagen (#117): 83 -> 12, 82 -> 12, 84 -> 13, 90 -> 13, 89 -> 13, 76 -> 11, 77 -> 12
  assert.deepEqual([83, 82, 84, 90, 89, 76, 77].map(restWochen), [12, 12, 13, 13, 13, 11, 12]);
  // Die Bauzeit der Rückfrage ist der Wert, mit dem dann auch gebaut wird
  const rng = mulberryRng(7);
  const tage = buildDays(g, 0, 1, rng);
  m.balance = 5000000;
  const r = extendStadium(g, 0, 1, 1000, mulberryRng(99), tage);
  assert.ok(r.ok && r.days === tage, JSON.stringify(r));
  assert.equal(stadiumState(g, 0)[0].days, tage);
});

test("Abgelehntes Bauangebot sperrt die Art random(15,55) Tage für alle, jede Baurunde zählt herunter (0x0584, 0x2362)", () => {
  const g = load("TEST4.MAN");
  const tage = bauAblehnen(g, 3, mulberryRng(4));
  assert.ok(tage >= 15 && tage <= 55);
  assert.equal(bauGesperrt(g, 3), true);
  assert.equal(bauGesperrt(g, 2), false);
  // Die Baurunde läuft je Manager: jeder Aufruf zählt einen Tag herunter
  for (let i = 0; i < tage - 1; i++) dailyConstruction(g, i % 3);
  assert.equal(bauGesperrt(g, 3), true);
  dailyConstruction(g, 0);
  assert.equal(bauGesperrt(g, 3), false);
});
