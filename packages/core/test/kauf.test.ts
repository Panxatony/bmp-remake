/**
 * Kaufweg des Originals (#125, Audit 2 F2, E16, E19, E24): 0x224A8 legt den Kaderplatz vor dem
 * Vertragsdialog an, der Dialog 0x251FF hat einen Versuch.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, marketEntries, buyOffer, kaufVertrag, listPlayer, takeBack, vertragsDialog, MARKET_MANAGER, type Rng } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
/** Zählt die Würfe und merkt ihre Grenzen. */
const zaehler = (seed: number) => {
  const base = mulberryRng(seed);
  const wuerfe: [number, number][] = [];
  const rng = ((lo: number, hi: number) => {
    wuerfe.push([lo, hi]);
    return base(lo, hi);
  }) as Rng;
  return { rng, wuerfe };
};

test("Vertragsdialog 0x251FF: zu lange, So dumm, Verhandlung - jeder Ausgang würfelt Byte 24", () => {
  const g = load("TEST4.MAN");
  const l = g.lineups.at(0);
  const jahre = l.u8(11);
  const gehalt = l.i32(40);
  const { rng, wuerfe } = zaehler(3);
  assert.deepEqual(vertragsDialog(g, 0, 0, 5, gehalt, rng), { einig: false, absage: "zulange" });
  assert.deepEqual(wuerfe.at(-1), [10, 18]);
  assert.equal(wuerfe.length, 1, "zu lange: keine Verhandlung");
  // mehr Jahre für weniger Gehalt
  assert.deepEqual(vertragsDialog(g, 0, 0, Math.min(4, jahre + 1), gehalt - 1000, rng), { einig: false, absage: "sodumm" });
  assert.equal(wuerfe.length, 2);
  // gleiche Laufzeit, mehr Gehalt: 0x249E0 nimmt an; Jahre und Gehalt stehen danach im Platz
  const erg = vertragsDialog(g, 0, 0, jahre, gehalt + 1000, rng);
  assert.deepEqual(erg, { einig: true });
  assert.equal(l.u8(11), jahre);
  assert.equal(l.i32(40), gehalt + 1000);
  assert.ok(l.u8(24) >= 10 && l.u8(24) <= 18);
});

test("Kauf vom Rechner: 0x224A8 würfelt vor dem Dialog, der Dialog verhandelt auch die gewählte Forderung", () => {
  const g = load("TEST4.MAN");
  g.managers.at(0).balance = 5000000;
  const e = marketEntries(g).find((x) => x.owner === MARKET_MANAGER)!;
  const { rng, wuerfe } = zaehler(9);
  const r = buyOffer(g, 0, e.slot, 5000000, false, rng);
  assert.ok(r.ok && r.state === "contract", JSON.stringify(r));
  // Nach der KI-Entscheidung die fünf Würfe der Aufnahme
  const aufnahme = wuerfe.slice(-5).map((w) => w.join(","));
  assert.deepEqual(aufnahme, ["80,120", "35,65", "1,13", "1,3", "0,1"]);
  if (!(r.ok && r.state === "contract")) return;
  const vorher = wuerfe.length;
  const k = kaufVertrag(g, 0, e.slot, r.platz, 5000000, 1, r.demands[0], rng, false);
  assert.ok(k.ok, JSON.stringify(k));
  // Verhandlung 0x249E0 (bei gleicher Laufzeit ohne Wurf, wenn das Gehalt darüber liegt) und Byte 24
  assert.deepEqual(wuerfe.at(-1), [10, 18]);
  assert.ok(wuerfe.length > vorher);
});

test("Auf den Markt und zurück: je fünf Würfe aus 0x224A8, keine neue Rückennummer (Audit 2 E16, E19)", () => {
  const g = load("TEST4.MAN");
  const { rng, wuerfe } = zaehler(4);
  const squad = g.squadOf(0);
  const platz = squad.length - 1;
  const idx = squad[platz].playerIndex;
  assert.ok(listPlayer(g, 0, platz, rng).ok);
  assert.equal(wuerfe.length, 5);
  const e = marketEntries(g).find((x) => x.playerIndex === idx)!;
  assert.ok(takeBack(g, 0, e.slot, rng).ok);
  assert.equal(wuerfe.length, 10);
  const zurueck = g.squadOf(0).find((l) => l.playerIndex === idx)!;
  assert.equal(zurueck.number, 0);
});
