import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, setRuleSet, RULES_2026, playerValue, poachPrice, poachAmount, poachChance, poachCheck, poachAllowedFrom, poach, poachCount, poachLeft, resetPoachCounts, POACH_MAX_BONUS, POACH_MIN_SQUAD, POACH_MAX_PER_OWNER, newSeason, mulberryRng, texte } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string, regeln = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
  if (regeln) setRuleSet(g, RULES_2026);
  return g;
};
/** Würfel mit festem Wert für den Zustimmungswurf */
const fest = (v: number) => () => v;

test("Abwerben: nur in der Version 2026, Ablöse ist der Marktwert mit höchstens 15 % Aufschlag", () => {
  const original = load("CLAUDE4.MAN", false);
  assert.deepEqual(poachCheck(original, 0, 1, 0, 0), { ok: false, error: "Abwerben gibt es nur in der Version 2026" });
  const g = load("CLAUDE4.MAN");
  const basis = poachPrice(g, 1, 0);
  assert.equal(basis, playerValue(g, 1, 0, 0));
  assert.ok(basis > 0);
  assert.equal(poachAmount(g, 1, 0, 0), Math.trunc(basis / 1000) * 1000);
  assert.equal(poachAmount(g, 1, 0, POACH_MAX_BONUS), Math.trunc(Math.trunc((basis * 115) / 100) / 1000) * 1000);
  assert.ok(poachAmount(g, 1, 0, POACH_MAX_BONUS) > poachAmount(g, 1, 0, 0));
  assert.equal(poachCheck(g, 0, 1, 0, 16).ok, false);
  assert.equal(poachCheck(g, 0, 0, 0, 0).ok, false, "eigener Spieler");
});

test("Abwerben: die Zustimmung steigt mit dem Aufschlag und bleibt zwischen 5 und 90", () => {
  const g = load("CLAUDE4.MAN");
  const ohne = poachChance(g, 0, 1, 0, 0);
  const voll = poachChance(g, 0, 1, 0, POACH_MAX_BONUS);
  assert.equal(voll, Math.min(90, ohne + 2 * POACH_MAX_BONUS));
  for (let b = 0; b <= POACH_MAX_BONUS; b++) {
    const c = poachChance(g, 0, 1, 0, b);
    assert.ok(c >= 5 && c <= 90, String(c));
  }
});

test("Abwerben: bei Zustimmung wechselt der Spieler mit Vertrag und Gehalt, die Ablöse wird gebucht", () => {
  const g = load("CLAUDE4.MAN");
  const vorherWerber = g.squadOf(0).length;
  const vorherBesitzer = g.squadOf(1).length;
  const l = g.lineups.at(1 * 25 + 3);
  const spieler = l.playerIndex;
  const vertrag = l.u8(11);
  const gehalt = l.i32(40);
  const name = g.players.at(spieler).displayName;
  const kasse = [g.managers.at(0).balance, g.managers.at(1).balance];
  const betrag = poachAmount(g, 1, 3, 10);
  const r = poach(g, 0, 1, 3, 10, fest(0));
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.agreed);
  if (!r.ok || !r.agreed) return;
  assert.equal(r.amount, betrag);
  assert.equal(g.squadOf(0).length, vorherWerber + 1);
  assert.equal(g.squadOf(1).length, vorherBesitzer - 1);
  const neu = g.lineups.at(0 * 25 + r.place);
  assert.equal(neu.playerIndex, spieler);
  assert.equal(g.players.at(spieler).displayName, name);
  assert.equal(neu.u8(11), vertrag);
  assert.equal(neu.i32(40), gehalt);
  assert.ok(neu.u8(10) >= 12, "neue Rückennummer");
  assert.equal(g.players.at(spieler).u8(33), 0);
  assert.equal(g.players.at(spieler).u8(36), g.managers.at(0).clubIndex);
  assert.equal(g.managers.at(0).balance, kasse[0] - betrag);
  assert.equal(g.managers.at(1).balance, kasse[1] + betrag);
  // Der Spieler steht nur noch einmal im Spiel
  const alle = [0, 1].flatMap((m) => g.squadOf(m).map((s) => s.playerIndex));
  assert.equal(alle.filter((i) => i === spieler).length, 1);
});

test("Abwerben: sagt der Spieler ab, ändert sich nichts", () => {
  const g = load("CLAUDE4.MAN");
  const vorher = g.save.plain.slice();
  const r = poach(g, 0, 1, 3, 0, fest(99));
  assert.equal(r.ok, true);
  assert.ok(r.ok && !r.agreed);
  assert.deepEqual(Array.from(g.save.plain), Array.from(vorher));
});

test("Abwerben: dem Besitzer müssen zwölf Spieler bleiben und der Werbende muss zahlen können", () => {
  const g = load("CLAUDE4.MAN");
  // Kader des Besitzers auf die Untergrenze schrumpfen
  while (g.squadOf(1).length > POACH_MIN_SQUAD) {
    const letzter = g.squadOf(1).length - 1;
    g.lineups.at(1 * 25 + letzter).setU8(9, 0);
    g.save.plain.fill(0, 21400 + (25 + letzter) * 52, 21400 + (25 + letzter + 1) * 52);
  }
  assert.equal(poachCheck(g, 0, 1, 0, 0).ok, false);
  const h = load("CLAUDE4.MAN");
  h.managers.at(0).balance = 0;
  const r = poachCheck(h, 0, 1, 0, 0);
  assert.deepEqual(r, { ok: false, error: texte("ui.zuwenig").join(" ") });
});

test("Abwerben: höchstens zwei Spieler je Manager und Saison, der Zähler steht im Spielstand", () => {
  const g = load("RIED-CLI.MAN");
  // Gewildert wird nur nach oben (#1): LARS (2. Liga) bei NORMI (Bundesliga)
  const werber = 1;
  const besitzer = 0;
  assert.equal(poachCount(g, werber, besitzer), 0);
  assert.equal(poachLeft(g, werber, besitzer), POACH_MAX_PER_OWNER);
  // Geld muss reichen, sonst greift die Kontoprüfung vor der Grenze
  g.managers.at(werber).balance = 50_000_000;
  for (let n = 1; n <= POACH_MAX_PER_OWNER; n++) {
    const r = poach(g, werber, besitzer, 0, 0, fest(0));
    assert.ok(r.ok && r.agreed, `Wechsel ${n}`);
    assert.equal(poachCount(g, werber, besitzer), n);
    assert.equal(poachLeft(g, werber, besitzer), POACH_MAX_PER_OWNER - n);
  }
  const grenze = poachCheck(g, werber, besitzer, 0, 0);
  assert.equal(grenze.ok, false);
  assert.match((grenze as { error: string }).error, /Von diesem Manager haben Sie/);
  // Bei einem anderen Manager zählt es getrennt
  assert.equal(poachLeft(g, werber, 1), POACH_MAX_PER_OWNER);
  // Ein abgelehnter Versuch zählt nicht
  const h = load("RIED-CLI.MAN");
  h.managers.at(werber).balance = 50_000_000;
  poach(h, werber, besitzer, 0, 0, fest(99));
  assert.equal(poachCount(h, werber, besitzer), 0);
  // Der Zähler überlebt das Speichern und wird zum Saisonwechsel geleert
  const wieder = new GameState(SaveFile.decode(g.save.encode()));
  assert.equal(poachCount(wieder, werber, besitzer), POACH_MAX_PER_OWNER);
  newSeason(wieder, mulberryRng(3));
  assert.equal(poachCount(wieder, werber, besitzer), 0);
  resetPoachCounts(g);
  assert.equal(poachCount(g, werber, besitzer), 0);
});

test("Abwerben: nur nach oben - höhere Liga oder besserer Tabellenplatz (#1)", () => {
  const g = load("RIED-CLI.MAN");
  // RIED-CLI: NORMI Bundesliga und Erster, BLACKY 2. Liga Platz 6, LARS 2. Liga Platz 13
  assert.equal(poachAllowedFrom(g, 1, 0), true, "LARS darf beim Bundesligisten wildern");
  assert.equal(poachAllowedFrom(g, 2, 0), true, "BLACKY auch");
  assert.equal(poachAllowedFrom(g, 1, 2), true, "LARS beim besser platzierten BLACKY");
  assert.equal(poachAllowedFrom(g, 0, 1), false, "der Bundesligist darf nirgends");
  assert.equal(poachAllowedFrom(g, 0, 2), false);
  assert.equal(poachAllowedFrom(g, 2, 1), false, "nicht beim Schlechterplatzierten");
  g.managers.at(0).balance = 50_000_000;
  const runter = poachCheck(g, 0, 2, 0, 0);
  assert.equal(runter.ok, false);
  assert.match((runter as { error: string }).error, /nur nach oben/i);
  g.managers.at(1).balance = 50_000_000;
  assert.equal(poachCheck(g, 1, 0, 0, 0).ok, true, "nach oben geht");
});
