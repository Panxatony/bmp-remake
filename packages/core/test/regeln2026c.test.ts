/**
 * Entscheidungen B19-B22 aus dem zweiten Durchgang des Audits der Version 2026 (docs/AUDIT-2026.md,
 * "B. Entscheidungen"): fünf Ersatzleute ohne Rückwechsel (B19), keine Jugend im 1-Jahres-Spiel
 * (B20), eigene Bestenliste (B21) und eigene Torszenen in der Konferenz (B22). Im Original ändert
 * sich jeweils nichts. B26 (Rechte im Szenen-Editor) lebt nur im Server und ist dort im Probelauf
 * geprüft.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026, mulberryRng, autoLineup, nummernPflege,
  bankGroesse, hoechsteBankNummer, ENDJAHR, jugendAktiv, jugendAnlegen, jugendLesen, foerdern,
  jugendMonat, jugendSaison, jugendAufruecken, jugendVorhanden, highscoreFile, dayIndex, calendarFlag,
  parseMana, createGame, type Rng,
} from "../src/index.ts";
import { applySubstitutions, eigeneSzene, pickScene, startLive, tick, EIGENE_SZENE_CHANCE, HALFTIME, type LiveState } from "../../server/live.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const laden = (datei: string, regeln2026 = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, datei)))));
  if (regeln2026) setRuleSet(g, RULES_2026);
  return g;
};
const block = (g: GameState, m = 0) => g.save.plain.slice(21400 + m * 1300, 21400 + (m + 1) * 1300);
const nummern = (g: GameState, m = 0) => g.squadOf(m).map((l) => l.number);
const bank = (g: GameState, m = 0) => nummern(g, m).filter((n) => n >= 12).sort((a, b) => a - b);
/** Zwei Kaderplätze tauschen ihre Rückennummern (so wie der Kaderbildschirm). */
const tausch = (g: GameState, m: number, a: number, b: number) => {
  const [x, y] = [g.lineups.at(m * 25 + a), g.lineups.at(m * 25 + b)];
  const n = x.number;
  x.number = y.number;
  y.number = n;
};
const platzMit = (g: GameState, m: number, nr: number) => g.squadOf(m).findIndex((l) => l.number === nr);
const leer = () => ({ subs: {}, news: [], entries: [] }) as unknown as LiveState;

// ---- B19: fünf Ersatzleute, kein Rückwechsel -----------------------------------------------

test("B19: die Aufstellungsautomatik setzt in 2026 fünf Ersatzleute (12..16), im Original vier", () => {
  const o = laden("CLAUDE4.MAN", false);
  const n = laden("CLAUDE4.MAN");
  assert.ok(o.squadOf(0).length >= 16, "Kader groß genug");
  autoLineup(o, 0, 2, true);
  autoLineup(n, 0, 2, true);
  assert.deepEqual(bank(o), [12, 13, 14, 15]);
  assert.deepEqual(bank(n), [12, 13, 14, 15, 16]);
  // Die erste Elf und die Bank 12..15 sind in beiden gleich; der Fünfte ist ein Feldspieler
  assert.deepEqual(nummern(n).map((x) => (x === 16 ? 0 : x)), nummern(o));
  const fuenfter = n.squadOf(0).find((l) => l.number === 16)!;
  assert.ok(n.players.at(fuenfter.playerIndex).u8(31) >= 25, "Feldspieler");
  assert.equal(bankGroesse(o), 4);
  assert.equal(bankGroesse(n), 5);
  assert.equal(hoechsteBankNummer(o), 15);
  assert.equal(hoechsteBankNummer(n), 16);
});

test("B19: Nummernpflege - in 2026 wird aus 17 die 16 und eine fehlende 16 besetzt, im Original aus 16 die 15", () => {
  const n = laden("CLAUDE4.MAN");
  autoLineup(n, 0, 2, true);
  const p16 = platzMit(n, 0, 16);
  n.lineups.at(p16).number = 17;
  nummernPflege(n, 0);
  assert.equal(n.lineups.at(p16).number, 16);
  // Neben einer 16 verliert ein zweiter Ausgewechselter mit 17 seine Nummer
  const p12 = platzMit(n, 0, 12);
  n.lineups.at(p12).number = 17;
  nummernPflege(n, 0);
  assert.equal(n.lineups.at(p12).number, 0);
  assert.deepEqual(bank(n), [13, 14, 15, 16]);
  // Ein Stand mit vier Ersatzleuten (vor B19 oder manuell aufgestellt) bekommt die 16 dazu
  const alt = laden("CLAUDE4.MAN");
  autoLineup(alt, 0, 2, true);
  const fuenfter = platzMit(alt, 0, 16);
  alt.lineups.at(fuenfter).number = 0;
  nummernPflege(alt, 0);
  assert.equal(alt.lineups.at(fuenfter).number, 16);
  const o = laden("CLAUDE4.MAN", false);
  autoLineup(o, 0, 2, true);
  const vier = o.save.plain.slice();
  nummernPflege(o, 0);
  assert.deepEqual(o.save.plain, vier, "Original: volle Bank bleibt, wie sie ist");
  const p15 = platzMit(o, 0, 15);
  o.lineups.at(p15).number = 16;
  nummernPflege(o, 0);
  assert.equal(o.lineups.at(p15).number, 15);
});

test("B19: in 2026 keine Wiedereinwechslung, fünf Wechsel gehen mit fünf Ersatzleuten", () => {
  const g = laden("CLAUDE4.MAN");
  autoLineup(g, 0, 2, true);
  const st = leer();
  const raus: number[] = [];
  // Fünf Feldspieler der ersten Elf gegen die Bank 12..16
  for (let k = 0; k < 5; k++) {
    const vorher = block(g);
    const aus = g.squadOf(0).findIndex((l, i) => l.number >= 2 && l.number <= 11 && !raus.includes(i));
    const ein = platzMit(g, 0, 12 + k);
    tausch(g, 0, aus, ein);
    assert.deepEqual(applySubstitutions(st, g, 0, vorher, mulberryRng(k)), { ok: true }, `Wechsel ${k + 1}`);
    raus.push(aus);
  }
  // Der erste Ausgewechselte trug 17, dann 12, 13, ... (kleinste freie ab 12)
  assert.equal(g.squadOf(0)[raus[0]].number, 17);
  assert.deepEqual(st.ausgewechselt?.[0], raus.map((i) => g.squadOf(0)[i].playerIndex));
  // Verlängerung: ein sechster Wechsel wäre frei - aber nur mit einem schon Ausgewechselten
  (st as unknown as { entries: unknown[] }).entries = [{ managerHome: 0, kind: "cup", ergebnis90: { home: 1, away: 1 } }];
  const vorher = block(g);
  const aus = g.squadOf(0).findIndex((l) => l.number >= 2 && l.number <= 11);
  tausch(g, 0, aus, raus[0]);
  assert.deepEqual(applySubstitutions(st, g, 0, vorher, mulberryRng(9)), { ok: false, error: "Ausgewechselte d}rfen nicht zur}ck" });
});

test("B19: in 2026 rückt im Spiel niemand von der Tribüne auf die Bank nach; im Original geht beides", () => {
  for (const regeln2026 of [true, false]) {
    const g = laden("CLAUDE4.MAN", regeln2026);
    autoLineup(g, 0, 2, true);
    const st = leer();
    // Ein Wechsel: Nummer 2 raus, 12 rein
    let vorher = block(g);
    const aus = platzMit(g, 0, 2);
    tausch(g, 0, aus, platzMit(g, 0, 12));
    assert.equal(applySubstitutions(st, g, 0, vorher, mulberryRng(1)).ok, true);
    // Tribüne (Nummer 0) tauscht mit dem Ausgewechselten
    vorher = block(g);
    const tribuene = g.squadOf(0).findIndex((l) => l.number === 0 && (l.u8(9) & 3) === 0);
    tausch(g, 0, aus, tribuene);
    const r1 = applySubstitutions(st, g, 0, vorher, mulberryRng(2));
    assert.deepEqual(r1, regeln2026 ? { ok: false, error: "Die Bank steht seit dem Anpfiff fest" } : { ok: true });
    if (regeln2026) g.save.plain.set(vorher, 21400);
    // Rückwechsel: der Ausgewechselte (jetzt auf der Bank bzw. Tribüne) für Nummer 3
    if (!regeln2026) continue;
    vorher = block(g);
    tausch(g, 0, platzMit(g, 0, 3), aus);
    assert.deepEqual(applySubstitutions(st, g, 0, vorher, mulberryRng(3)), { ok: false, error: "Ausgewechselte d}rfen nicht zur}ck" });
  }
  // Original: Rückwechsel bleibt erlaubt wie im DOS-Programm, ohne Merker
  const o = laden("CLAUDE4.MAN", false);
  autoLineup(o, 0, 2, true);
  const st = leer();
  let vorher = block(o);
  const aus = platzMit(o, 0, 2);
  tausch(o, 0, aus, platzMit(o, 0, 12));
  assert.equal(applySubstitutions(st, o, 0, vorher, mulberryRng(1)).ok, true);
  vorher = block(o);
  tausch(o, 0, platzMit(o, 0, 3), aus);
  assert.equal(applySubstitutions(st, o, 0, vorher, mulberryRng(2)).ok, true);
  assert.equal(st.ausgewechselt, undefined);
});

// ---- B20: keine Jugend im 1-Jahres-Spiel ---------------------------------------------------

const spielartSetzen = (g: GameState, jahr: number) => {
  g.save.plain[ENDJAHR] = jahr & 0xff;
  g.save.plain[ENDJAHR + 1] = jahr >> 8;
};

test("B20: im 1-Jahres-Spiel der Version 2026 gibt es keine Jugend - kein Anlegen, keine Förderung, keine Kosten", () => {
  const g = laden("CLAUDE4.MAN");
  const drei = laden("CLAUDE4.MAN");
  spielartSetzen(g, 1993);
  spielartSetzen(drei, 1995);
  assert.equal(jugendAktiv(g), false);
  assert.equal(jugendAktiv(drei), true);
  assert.equal(jugendAktiv(laden("CLAUDE4.MAN", false)), false);
  // Anlegen würfelt nicht und schreibt nichts
  let wuerfe = 0;
  const rng: Rng = (a, b) => (wuerfe++, a + 0 * b);
  const vorher = g.save.encode();
  assert.deepEqual(jugendAnlegen(g, rng), []);
  assert.equal(wuerfe, 0);
  assert.deepEqual(g.save.encode(), vorher);
  // Im 3-Jahres-Spiel wird angelegt
  assert.ok(jugendAnlegen(drei, mulberryRng(4)).length > 0);
  // Ein Stand, der schon Jugend hat (z.B. vor B20 angelegt), wird im 1-Jahres-Spiel nicht mehr bedient
  spielartSetzen(drei, 1993);
  const team = jugendLesen(drei)[0].findIndex((t) => t.some((s) => s.name !== ""));
  const platz = jugendLesen(drei)[0][team].findIndex((s) => s.name !== "");
  assert.equal(foerdern(drei, 0, team, platz, true).ok, false);
  assert.equal(jugendMonat(drei, 0), 0);
  assert.deepEqual(jugendSaison(drei, mulberryRng(1)), []);
  assert.equal(jugendAufruecken(drei, 0, 0, mulberryRng(1)).ok, false);
});

test("B20: ein neues 1-Jahres-Spiel der Version 2026 legt keine Jugend an, ein 3-Jahres-Spiel schon", () => {
  const mana = parseMana(new Uint8Array(readFileSync(join(BMP_DIR, "MANA.DAT"))));
  const template = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))).plain;
  const managers = [{ name: "Lars", club: 0, portrait: 2 }];
  const eins = new GameState(SaveFile.decode(createGame(template, mana, { managers, level: 3, rules: RULES_2026, spielart: 1 }, mulberryRng(7)).encode()));
  const drei = new GameState(SaveFile.decode(createGame(template, mana, { managers, level: 3, rules: RULES_2026, spielart: 3 }, mulberryRng(7)).encode()));
  assert.equal(jugendVorhanden(eins), false);
  assert.equal(jugendVorhanden(drei), true);
});

// ---- B21: eigene Bestenliste -----------------------------------------------------------------

test("B21: die Version 2026 schreibt in HIGH26.xy, das Original bleibt bei HIGH.xy", () => {
  const o = laden("CLAUDE4.MAN", false);
  const n = laden("CLAUDE4.MAN");
  const level = 5 - o.save.plain[34062];
  assert.equal(highscoreFile(o), `HIGH.0${level}`);
  assert.equal(highscoreFile(n), `HIGH26.0${level}`);
  spielartSetzen(o, 1993);
  spielartSetzen(n, 1995);
  assert.equal(highscoreFile(o), `HIGH.1${level}`);
  assert.equal(highscoreFile(n), `HIGH26.3${level}`);
  // 8.3-Namen
  for (const f of [highscoreFile(o), highscoreFile(n)]) assert.match(f, /^[A-Z0-9]{1,8}\.[0-9]{2}$/);
});

// ---- B22: eigene Torszenen -------------------------------------------------------------------

test("B22: eigeneSzene zieht nur Editor-Szenen der passenden Art, mit Chance 1/10", () => {
  const eigene = ["konter.T", "konter.V", "flanke.T", "12.T"];
  assert.equal(eigeneSzene(true, eigene, () => 0), "konter.T");
  assert.equal(eigeneSzene(true, eigene, (() => { const w = [0, 0.99]; return () => w.shift()!; })()), "flanke.T");
  assert.equal(eigeneSzene(false, eigene, () => 0), "konter.V");
  // Kein Treffer im ersten Wurf
  assert.equal(eigeneSzene(true, eigene, () => 1 / EIGENE_SZENE_CHANCE), undefined);
  // Nur Nummern (Original) oder nichts Passendes: keine eigene Szene
  assert.equal(eigeneSzene(true, ["12.T"], () => 0), undefined);
  assert.equal(eigeneSzene(false, ["konter.T"], () => 0), undefined);
  // pickScene selbst bleibt beim Original
  const r = pickScene(mulberryRng(3), true, new Set(["10.T", "konter.T"]));
  assert.match(r.id, /^\d+\.T/);
});

/**
 * Eine Konferenz bis zum Schluss laufen lassen, mit gestellter Uhr. Liefert die gezeigten Szenen,
 * die Zahl der Würfe des Spiels und die Endstände.
 */
function konferenz(g: GameState, eigene: string[], zufall: () => number) {
  let wuerfe = 0;
  const basis = mulberryRng(11);
  const rng: Rng = (a, b) => (wuerfe++, basis(a, b));
  const k = dayIndex(g);
  const echt = Date.now;
  let uhr = echt();
  Date.now = () => (uhr += 100_000);
  try {
    const st = startLive(g, rng, k, calendarFlag(g, k), 1);
    const szenen: string[] = [];
    const alle = new Set(Array.from({ length: 42 }, (_, i) => [`${i + 2}.T`, `${i + 2}.V`]).flat());
    for (let i = 0; i < 20000 && !st.finished; i++) {
      if (st.paused) {
        if (st.pausedBy !== HALFTIME && !st.finished) break;
        st.paused = false;
      }
      tick(st, g, rng, alle, eigene, zufall);
      if (st.scene && szenen[szenen.length - 1] !== `${st.scene.minute}:${st.scene.id}`) szenen.push(`${st.scene.minute}:${st.scene.id}`);
    }
    return { finished: st.finished, szenen, wuerfe, stand: st.entries.map((e) => `${e.match.hg}:${e.match.ag}`).join(" ") };
  } finally {
    Date.now = echt;
  }
}

test("B22: in 2026 laufen eigene Szenen in der Konferenz, ohne die Zufallsfolge des Spiels zu ändern", () => {
  const ohne = konferenz(laden("CLAUDE4.MAN"), [], () => 0);
  const mit = konferenz(laden("CLAUDE4.MAN"), ["konter.T", "konter.V"], () => 0);
  assert.ok(ohne.finished && mit.finished);
  assert.ok(ohne.szenen.length > 0, "es gab Szenen");
  assert.equal(mit.wuerfe, ohne.wuerfe, "gleich viele Würfe");
  assert.equal(mit.stand, ohne.stand, "gleiche Ergebnisse");
  // Mit zufall = 0 läuft jede normale Szene als eigene (Elfmeterszenen bleiben)
  assert.ok(mit.szenen.some((s) => s.endsWith("konter.T") || s.endsWith("konter.V")));
  assert.deepEqual(mit.szenen.map((s) => s.split(":")[0]), ohne.szenen.map((s) => s.split(":")[0]));
  // Im Original nie, auch wenn es eigene Szenen gibt
  const orig = konferenz(laden("CLAUDE4.MAN", false), ["konter.T", "konter.V"], () => 0);
  const origOhne = konferenz(laden("CLAUDE4.MAN", false), [], () => 0);
  assert.ok(!orig.szenen.some((s) => s.includes("konter")));
  assert.deepEqual(orig, origOhne);
});
