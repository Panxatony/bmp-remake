import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, contractCheck, retirementAnnouncements, contractOffers, contractCooldown, contractScore, salaryDemand, playerValue, LEAGUES } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const mid = (lo: number, hi: number) => Math.trunc((lo + hi) / 2);

test("Vertragsverhandlung (0x249E0): gleiche Laufzeit nach Gehalt, kürzere Laufzeit 105/120 %, sonst Schwelle unter der Forderung", () => {
  const g = load("TEST4.MAN");
  const l = g.lineups.at(0);
  const years = l.u8(11);
  const cur = l.i32(40);
  assert.ok(years >= 1 && cur > 0);
  assert.equal(contractCheck(g, 0, 0, years, cur + 1, mid), true);
  assert.equal(contractCheck(g, 0, 0, years, cur - 1, mid), false);
  if (years > 1) {
    assert.equal(contractCheck(g, 0, 0, years - 1, Math.trunc(cur * 1.2) + 1, mid), true);
    assert.equal(contractCheck(g, 0, 0, years - 1, Math.trunc(cur * 1.05), mid), false);
  }
  // Längere Laufzeit: die Forderung (0x25C27, +122) liegt über der Annahmeschwelle (+110)
  const longer = years + 1;
  const demand = salaryDemand(g, 0, 0, longer);
  assert.equal(contractCheck(g, 0, 0, longer, demand, mid), true);
  // Schwellenband: v·(q-6)/100 .. v·(q+4)/100
  const league = g.managers.at(0).u8(312);
  const prog = Math.trunc((g.nextMatchday(league) * -100) / LEAGUES[league].matchdays) + 100;
  // Schiebehilfe 0x3BBC8 schiebt nach links (·8), nicht nach rechts
  const q = Math.trunc(((Math.trunc(((longer - 1) * 100 + prog) / 6) + 110) << 3) / 10);
  const v = playerValue(g, 0, 0, 5);
  const lo = Math.trunc((v * (Math.trunc(q) - 6)) / 100);
  const hi = Math.trunc((v * (Math.trunc(q) + 4)) / 100);
  assert.ok(hi < demand, `Schwelle ${hi} unter Forderung ${demand}`);
  const rng = mulberryRng(21);
  let accepted = 0;
  for (let i = 0; i < 200; i++) if (contractCheck(g, 0, 0, longer, Math.max(1, Math.trunc((lo + hi) / 2)), rng)) accepted++;
  assert.ok(accepted > 0 && accepted < 200, `angenommen ${accepted}`);
  for (let i = 0; i < 50; i++) assert.equal(contractCheck(g, 0, 0, longer, lo, rng), false);
  for (let i = 0; i < 50; i++) assert.equal(contractCheck(g, 0, 0, longer, hi + 1, rng), true);
  assert.equal(contractCheck(g, 0, 0, longer, 200000, mid), true);
});

test("Angebot: im letzten Vertragsjahr bietet der Spieler an, von 1 auf 2-4 Jahre zu verlängern (0x0E83E, #81)", () => {
  // Vorlage 0 "$ bietet an, von # auf # Jahre zu verlängern" mit Vertragsjahren und Stufe;
  // Kaderbyte 24 = 100 + Jahre (0x0E98C). Bis #81 war das die Ankündigung, nicht zu verlängern.
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  l.setU8(11, 1); // letztes Vertragsjahr
  l.setU8(24, 0);
  l.setU8(12, 0);
  // Immer der kleinste Wurf: das Angebot kommt sofort, Jahre = 2 (random(0,100) = 0)
  const angebote = contractOffers(g, 0, (lo: number) => lo);
  const a = angebote.find((x) => x.place === 3)!;
  assert.ok(a, "Angebot kommt");
  assert.equal(a.yearsFrom, 1);
  assert.equal(a.yearsTo, 2);
  assert.ok(a.salary > 0);
  assert.equal(l.u8(24), 102, "Byte 24 = 100 + Jahre");
  // Ein liegendes Angebot blockiert ein zweites
  assert.equal(contractOffers(g, 0, (lo: number) => lo).some((x) => x.place === 3), false);
  // Mit großem Jahreswurf bietet er vier Jahre an
  l.setU8(24, 0);
  let n = 0;
  const hoch = (lo: number, hi: number) => (hi === 100 ? 95 : (n++, lo));
  assert.equal(contractOffers(g, 0, hoch).find((x) => x.place === 3)?.yearsTo, 4);
});

test("Angebot: nur im letzten Vertragsjahr, nie von Leihspielern (0x0E650, #83 F4)", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 4);
  l.setU8(11, 2);
  l.setU8(24, 0);
  assert.equal(contractOffers(g, 0, (lo: number) => lo).some((x) => x.place === 4), false, "zwei Jahre Restvertrag");
  l.setU8(11, 1);
  l.setU8(12, 0x80 | 7); // geliehen
  assert.equal(contractOffers(g, 0, (lo: number) => lo).some((x) => x.place === 4), false, "Leihspieler");
  l.setU8(12, 0);
  assert.equal(contractOffers(g, 0, (lo: number) => lo).some((x) => x.place === 4), true, "ohne Leihe bietet er an");
});

test("Angebot: viele Einsätze senken die Schwelle, N = N₀ - N₀·T/10 (0x0E8B5, #83 F3)", () => {
  // Gemessen wird die Obergrenze des ersten Wurfs random(0, N)
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 5);
  l.setU8(11, 1);
  l.setU8(24, 0);
  l.setU8(12, 0);
  // Jeder Kaderplatz ohne Leihe würfelt genau einmal random(0, N), solange der Wurf nicht 0 ist
  // (dann folgt kein zweiter). Die Würfe kommen in Platzreihenfolge; Platz 5 hat den k-ten.
  let k = 0;
  for (let p = 0; p < 5; p++) {
    const x = g.lineups.at(p);
    if (!x.isEmpty && x.u8(12) === 0) k++;
  }
  const grenze = () => {
    const wuerfe: number[] = [];
    contractOffers(g, 0, (lo: number, hi: number) => {
      if (lo === 0 && hi !== 3 && hi !== 100) wuerfe.push(hi);
      return 1; // nie 0: kein Angebot, nur messen
    });
    return wuerfe[k];
  };
  for (const o of [28, 30, 32]) { l.setU8(o, 0); l.setU8(o + 1, 0); }
  const ohne = grenze();
  l.setU8(28, 180); // 180 Ligaeinsätze -> T = 5
  const mit = grenze();
  assert.ok(ohne > 0);
  assert.equal(mit, ohne - Math.trunc((ohne * 5 * 10) / 100), `${mit} statt ${ohne} - die Hälfte`);
});

test("Karriereankündigung: Bit 7, Meldung 4 'kündigt an', keine Verhandlung (0x0E76F, #81)", () => {
  const g = load("RIED-CLI.MAN");
  // Ein Feldspieler, dessen Wert (0x16FC8) mit 34 Jahren über dem kleinsten Wurf 32 liegt
  let platz = -1;
  for (let p = 0; p < 25 && platz < 0; p++) {
    const x = g.lineups.at(p);
    if (x.isEmpty) continue;
    g.players.at(x.playerIndex).setU8(26, 34);
    if (contractScore(g, 0, p) > 32) platz = p;
  }
  assert.ok(platz >= 0, "kein passender Spieler");
  for (let p = 0; p < 25; p++) g.lineups.at(p).setU8(24, 0);
  const l = g.lineups.at(platz);
  const ank = retirementAnnouncements(g, 0, (lo: number) => lo);
  const a = ank.find((x) => x.place === platz)!;
  assert.ok(a, "Ankündigung kommt");
  assert.match(a.zeilen[0], /k\}ndigt an,$/);
  assert.equal(l.u8(24) & 0x80, 0x80, "Bit 7 gesetzt");
  // Kein Verlängerungsangebot mehr für ihn, auch im letzten Vertragsjahr
  l.setU8(11, 1);
  l.setU8(12, 0);
  assert.equal(contractOffers(g, 0, (lo: number) => lo).some((o) => o.place === platz), false);
  // Und die Ankündigung kommt nur einmal
  assert.equal(retirementAnnouncements(g, 0, (lo: number) => lo).some((x) => x.place === platz), false);
});

test("Liegendes Angebot verfällt mit einem Sechstel je Tag (GitLab #80, Deutung #81)", () => {
  // 0x0E5DC: Byte 24 über 99 und Bit 7 frei -> random(0,5) == 0 setzt es auf random(9,17);
  // sonst zählt der Wert täglich um eins herunter (0x0E64C).
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  l.setU8(24, 102); // Angebot liegt

  // Ein Wurf, der nie 0 wird: nichts passiert
  const nie = (lo: number, hi: number) => hi;
  for (let tag = 0; tag < 20; tag++) assert.equal(contractCooldown(g, 0, nie).length, 0);
  assert.equal(l.u8(24), 102, "das Angebot liegt weiter");

  // Kleinster Wurf: der Spieler kommt zurück, und zwar auf 9..17
  const klein = (lo: number) => lo;
  const zurueck = contractCooldown(g, 0, klein);
  assert.ok(zurueck.includes(3), "Platz 3 verhandelt wieder");
  assert.ok(l.u8(24) >= 9 && l.u8(24) <= 17, `Byte 24 = ${l.u8(24)}`);
  // Damit steht er wieder unter der Schwelle, ab der die Tagesroutine Angebote macht
  assert.ok(l.u8(24) < 100 && !(l.u8(24) & 0x80), "wieder verhandlungsbereit");

  // Unter 100 zählt der Wert täglich herunter
  l.setU8(24, 5);
  l.setU8(9, l.u8(9) & 0x7f);
  contractCooldown(g, 0, nie);
  assert.equal(l.u8(24), 4, "täglich eins herunter");
  // Ein offenes Angebot (Bit 7) bleibt unberührt
  l.setU8(24, 0x80 | 12);
  contractCooldown(g, 0, klein);
  assert.equal(l.u8(24), 0x80 | 12, "mit offenem Angebot passiert nichts");
});
