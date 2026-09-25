import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, playerValue, marketEntries, listPlayer, takeBack, saleOffer, decideSale, buyOffer, completePurchase, completeLoan, cancelPurchase, aiAccepts, kaderZahl, kaderVoll, TABLES, refreshMarket, dailyTransfers, listedCount, OFFER_SQUAD, OFFER_MARKET, MARKET_MANAGER, texte } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Marktwert: Marktpreise des Originals liegen im Zufallsband der Formel (Flag 4)", () => {
  const g = load("TEST4.MAN");
  const entries = marketEntries(g);
  assert.deepEqual(entries.map((e) => e.price), [428000, 525000, 446000, 477000, 444000]);
  for (const e of entries) {
    const base = playerValue(g, MARKET_MANAGER, e.slot, 0);
    // Aufschlag random(v/20, v/10) - v/15 mit 16-Bit-Überlauf: Ergebnis zwischen v·0,87 und v·1,04
    assert.ok(e.price >= base * 0.86 && e.price <= base * 1.04, `${e.name}: ${e.price} zu ${base}`);
    let hit = 0;
    for (let seed = 0; seed < 200; seed++) if (Math.abs(playerValue(g, MARKET_MANAGER, e.slot, 4, mulberryRng(seed)) - e.price) < 1000) hit++;
    assert.ok(hit > 0, `${e.name}: Preis ${e.price} nicht erreichbar`);
  }
  assert.equal(playerValue(g, 0, 0, 0) % 1000, 0);
  assert.equal(playerValue(g, 0, 0, 1) % 100, 0);
});

test("Transfermarkt: KI-Entscheidung, Kauf mit Vertrag, Ablehnungsbit, Leihe", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  m.balance = 3000000;
  const rng = mulberryRng(7);
  assert.equal(aiAccepts(100000, 50000, rng), false);
  assert.equal(aiAccepts(100000, 140000, rng), true);
  const first = marketEntries(g)[0];
  const squadBefore = g.squadOf(0).length;
  // Zu niedriges Angebot wird abgelehnt und gemerkt
  const low = buyOffer(g, 0, 0, 100000, false, rng);
  assert.equal(low.ok, false);
  assert.equal(g.lineups.at(100).u8(3) & 0x81, 0x81);
  const again = buyOffer(g, 0, 0, 500000, false, rng);
  assert.ok(!again.ok && again.error === texte("ui.schonabgelehnt").join(" "));
  g.lineups.at(100).setU8(3, 0);
  // Hohes Angebot wird angenommen, Vertrag folgt
  const r = buyOffer(g, 0, 0, 600000, false, rng);
  assert.ok(r.ok && r.state === "contract", JSON.stringify(r));
  if (r.ok && r.state === "contract") {
    assert.equal(r.demands.length, 4);
    assert.ok(r.demands[0] > 0);
    const place = completePurchase(g, 0, 0, 600000, 2, r.demands[1], rng);
    assert.ok(place >= 0);
    const l = g.lineups.at(place);
    assert.equal(l.playerIndex, first.playerIndex);
    assert.equal(l.contractYears, 2);
    assert.equal(l.i32(40), r.demands[1]);
    assert.ok(l.number >= 12);
    assert.equal(g.players.at(first.playerIndex).u8(33), 0);
    assert.equal(g.players.at(first.playerIndex).u8(36), m.clubIndex);
    assert.equal(m.balance, 3000000 - 600000);
    assert.equal(g.squadOf(0).length, squadBefore + 1);
    assert.equal(marketEntries(g).length, 4);
    assert.equal(marketEntries(g)[0].name, "BOGDAN");
  }
  // Abgebrochene Verhandlung setzt das Ablehnungsbit
  cancelPurchase(g, 0, 0);
  assert.equal(g.lineups.at(100).u8(3) & 1, 1);
  g.lineups.at(100).setU8(3, 0);
  // Leihe: Drittel des Preises, Vertrag 1 Jahr, Byte 12 = Verein | 0x80, Besitzer bleibt der Markt
  const e = marketEntries(g)[0];
  const bal = m.balance;
  const loan = buyOffer(g, 0, 0, Math.trunc(e.price / 3) + 50000, true, rng);
  assert.ok(loan.ok && loan.state === "done", JSON.stringify(loan));
  if (loan.ok && loan.state === "done") {
    const l = g.lineups.at(loan.place);
    assert.equal(l.contractYears, 1);
    assert.equal(l.u8(12), (e.club | 0x80) & 0xff);
    assert.equal(g.players.at(e.playerIndex).u8(33), MARKET_MANAGER);
    assert.equal(m.balance, bal - Math.trunc(e.price / 3) - 50000);
    assert.ok(!listPlayer(g, 0, loan.place).ok, "Leihspieler nicht auf den Markt");
  }
});

test("Transfermarkt: eigene Spieler anbieten, zurückholen, verkaufen; Markterneuerung; Tagesroutine", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  const rng = mulberryRng(11);
  const squad = g.squadOf(0);
  const last = squad.length - 1;
  const idx = squad[last].playerIndex;
  assert.ok(listPlayer(g, 0, last).ok);
  assert.equal(listedCount(g, 0), 1);
  assert.equal(g.squadOf(0).length, squad.length - 1);
  const mine = marketEntries(g).find((e) => e.playerIndex === idx)!;
  assert.equal(mine.owner, 0);
  assert.ok(mine.price > 0);
  assert.ok(!buyOffer(g, 0, mine.slot, 100000, false, rng).ok);
  // zurückholen
  assert.ok(takeBack(g, 0, mine.slot).ok);
  assert.equal(g.squadOf(0).length, squad.length);
  assert.equal(listedCount(g, 0), 0);
  // drei auf dem Markt sind die Grenze
  for (let i = 0; i < 3; i++) assert.ok(listPlayer(g, 0, g.squadOf(0).length - 1).ok);
  assert.equal(listPlayer(g, 0, 0).ok, false);
  // Verkauf eines Kaderspielers mit KI-Angebot
  const l0 = g.lineups.at(0);
  l0.setU8(9, l0.u8(9) | OFFER_SQUAD);
  l0.setU8(22, 30);
  const offer = saleOffer(g, 0, "squad", 0, rng)!;
  const v = playerValue(g, 0, 0, 0);
  assert.ok(offer.amount >= v * 0.85 && offer.amount <= v * 1.5, `${offer.amount} zu ${v}`);
  assert.equal(offer.amount % 100, 0);
  assert.equal(offer.fee, offer.amount - Math.trunc(offer.amount / 7) * offer.years);
  const bal = m.balance;
  const pi = offer.playerIndex;
  const strengthBefore = g.clubs.at(30).u8(24) + g.clubs.at(30).u8(25) + g.clubs.at(30).u8(26) + g.clubs.at(30).u8(27) + g.clubs.at(30).u8(28) + g.clubs.at(30).u8(29);
  assert.ok(decideSale(g, offer, true, rng).ok);
  assert.equal(m.balance, bal + offer.fee);
  assert.equal(g.players.at(pi).u8(33), 5);
  assert.equal(g.players.at(pi).u8(36), 30);
  const strengthAfter = g.clubs.at(30).u8(24) + g.clubs.at(30).u8(25) + g.clubs.at(30).u8(26) + g.clubs.at(30).u8(27) + g.clubs.at(30).u8(28) + g.clubs.at(30).u8(29);
  assert.ok(strengthAfter > strengthBefore);
  // Verkauf eines eigenen Marktspielers, BEHALTEN löscht nur das Angebot
  const me = marketEntries(g).find((e) => e.owner === 0)!;
  const ml = g.lineups.at(100 + me.slot);
  ml.setU8(9, ml.u8(9) | OFFER_MARKET);
  ml.setU8(22, 12);
  const o2 = saleOffer(g, 0, "market", me.slot, rng)!;
  assert.ok(o2.amount > 0);
  assert.ok(decideSale(g, o2, false, rng).ok);
  assert.equal(ml.u8(9) & OFFER_MARKET, 0);
  // Markterneuerung: eigene Spieler bleiben, KI-Spieler tragen Preise
  refreshMarket(g, rng);
  const after = marketEntries(g);
  assert.equal(after.filter((e) => e.owner === 0).length, 3);
  for (const e of after.filter((e) => e.owner === MARKET_MANAGER)) {
    assert.ok(e.price > 0 && e.price % 1000 === 0, `${e.name} ${e.price}`);
    // Ein gültiger Verein; freie Spieler tragen im Original auch 58..63 (TEST4: 15, 21, 90 ...)
    // und behalten ihn auf dem Markt, solange kein Manager den Verein führt
    assert.ok(g.players.at(e.playerIndex).u8(36) < 64);
    assert.ok(!g.activeManagers().some((mm) => mm.clubIndex === g.players.at(e.playerIndex).u8(36)));
  }
  // Tagesroutine liefert irgendwann Angebote für eigene Marktspieler
  let events = 0;
  for (let d = 1; d < 400 && events === 0; d++) events += dailyTransfers(g, 0, d, rng).length;
  assert.ok(events > 0, "keine Angebote");
});

test("Leihe: das Gehalt trägt den Abschlag des Originals, ein Drittel (GitLab #79)", () => {
  // 0x23E79 übergibt an 0x224A8 die 99, wenn der Schalter auf LEIHEN steht; die Routine
  // rechnet das Gehalt dann bei 0x226FA mit Modus 3 statt 1 - Modus 3 ist die Gehaltsbasis
  // durch drei (sim/value.ts, Bit 1).
  const g = load("TEST4.MAN");
  const markt = marketEntries(g);
  assert.ok(markt.length > 0);
  const slot = markt[0].slot;
  const spieler = markt[0].playerIndex;
  const vollesGehalt = playerValue(g, MARKET_MANAGER, slot, 1, mulberryRng(4));
  const platz = completeLoan(g, 0, slot, 50000, MARKET_MANAGER, mulberryRng(4));
  assert.ok(platz >= 0);
  const l = g.lineups.at(platz);
  assert.equal(l.playerIndex, spieler);
  assert.equal(l.contractYears, 1, "Leihe läuft ein Jahr");
  const gehalt = l.i32(40);
  assert.ok(gehalt > 0, "Gehalt gesetzt");
  // Ein Drittel, bis auf die Rundung auf volle 100 DM
  assert.ok(Math.abs(gehalt - Math.trunc(vollesGehalt / 3)) <= 200, `${gehalt} statt rund ${Math.trunc(vollesGehalt / 3)}`);
  assert.ok(gehalt < vollesGehalt / 2, `Leihgehalt ${gehalt} ist nicht kleiner als das halbe volle ${vollesGehalt}`);
});

test("Kaderzahl 0x11354: eigene Spieler auf dem Markt zählen mit; ab 24 kein Kauf mehr (0x224A8)", () => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN")))));
  // Manager 0: 15 Kaderplätze und Spieler 47 auf dem Markt (Besitzer 0)
  assert.equal(g.squadOf(0).length, 15);
  assert.equal(kaderZahl(g, 0), 16);
  assert.equal(kaderZahl(g, 1), 12);
  // Manager 2: 15 belegte Plätze (mit der Lücke auf 14), niemand anderswo
  assert.equal(kaderZahl(g, 2), 15);
  // Kader von Manager 0 auf 23 Plätze auffüllen: mit dem Marktspieler sind es 24
  for (let i = 15; i < 23; i++) g.save.plain.copyWithin(TABLES.lineups.offset + i * 52, TABLES.lineups.offset, TABLES.lineups.offset + 52);
  assert.equal(kaderZahl(g, 0), 24);
  const fremd = g.lineups.at(100).playerIndex;
  assert.equal(kaderVoll(g, 0, fremd), true);
  // Ein Spieler des eigenen Vereins fällt nicht unter die Grenze
  assert.equal(kaderVoll(g, 0, g.lineups.at(0).playerIndex), false);
  // Ohne den Marktspieler wären es 23: dann geht es noch
  g.players.at(47).setU8(33, 4);
  assert.equal(kaderVoll(g, 0, fremd), false);
});
