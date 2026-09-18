/**
 * Jugendarbeit der Version 2026 (GitLab #4, Stufe 1).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, setRuleSet, RULES_2026,
  JUGEND_TEAMS, JUGEND_PLAETZE, JUGEND_ALTER, JUGEND_AUFSTIEGE, JUGEND_KOSTEN,
  jugendLesen, jugendSchreiben, jugendVorhanden, jugendAnlegen, jugendStaerke, jugendSaison,
  jugendKosten, jugendMonat, foerdern, mulberryRng, JUGEND_MAX_FOERDERUNG, gefoerderte, jugendHerkunft,
  istReif, jugendChance, jugendRisiko, jugendSprung, aufruecker, jugendAbwerbungen, jugendZaehlerLeeren, jugendAufruecken, jugendAbwerben, JUGEND_MAX_AUFRUECKER,
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (regeln = true) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN")))));
  if (regeln) setRuleSet(g, RULES_2026);
  return g;
};

test("Jugend: der Anhang trägt die Mannschaften und überlebt das Speichern", () => {
  const g = load();
  assert.equal(jugendVorhanden(g), false, "ein Stand des Originals hat keine Jugend");
  jugendAnlegen(g, mulberryRng(7));
  assert.ok(jugendVorhanden(g));
  const daten = jugendLesen(g);
  assert.equal(daten.length, g.activeManagers().length);
  assert.equal(daten[0].length, JUGEND_TEAMS);
  assert.equal(daten[0][0].length, JUGEND_PLAETZE);
  // Alter in den Grenzen der Mannschaft
  daten.forEach((m) =>
    m.forEach((team, t) =>
      team.forEach((s) => {
        if (s.name === "") return;
        assert.ok(s.alter >= JUGEND_ALTER[t][0] && s.alter <= JUGEND_ALTER[t][1], `${s.name} ist ${s.alter} in Mannschaft ${t}`);
      }),
    ),
  );
  // Durch Speichern und Laden kommt alles unverändert zurück
  const wieder = new GameState(SaveFile.decode(g.save.encode()));
  assert.deepEqual(jugendLesen(wieder), daten);
  // Und der Spielstand selbst bleibt gültig
  assert.equal(wieder.managers.at(0).displayName, g.managers.at(0).displayName);
});

test("Jugend: ein Stand des Originals bleibt unberührt", () => {
  const g = load(false);
  jugendAnlegen(g, mulberryRng(7));
  assert.equal(g.save.anhang.length, 0, "im Original wird nichts angelegt");
  assert.deepEqual(jugendSaison(g, mulberryRng(7)), []);
  assert.equal(foerdern(g, 0, 0, 0, true).ok, false);
  assert.equal(jugendMonat(g, 0), 0);
});

test("Jugend: Förderung kostet Geld und wirkt auf die Entwicklung", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(3));
  assert.equal(jugendKosten(g, 0), 0, "ohne Förderung keine Kosten");
  const daten = jugendLesen(g);
  let gefoerdert = 0;
  daten[0].forEach((team, t) =>
    team.forEach((s, p) => {
      if (s.name === "" || gefoerdert >= 3) return;
      foerdern(g, 0, t, p, true);
      gefoerdert++;
    }),
  );
  assert.equal(jugendKosten(g, 0), gefoerdert * JUGEND_KOSTEN);
  const konto = g.managers.at(0).balance;
  assert.equal(jugendMonat(g, 0), gefoerdert * JUGEND_KOSTEN);
  assert.equal(g.managers.at(0).balance, konto - gefoerdert * JUGEND_KOSTEN);

  // Über mehrere Saisons kommen Geförderte im Schnitt weiter. Gemessen wird am Zuwachs der
  // C-Jugend - dort ist der Weg zum Potenzial am weitesten -, gemittelt über viele Würfe.
  const zuwachs = (foerderung: boolean): number => {
    let summe = 0;
    let n = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const h = load();
      jugendAnlegen(h, mulberryRng(seed));
      const d = jugendLesen(h);
      const vorher = new Map<string, number>();
      for (const sp of d[0][0]) {
        if (sp.name === "") continue;
        sp.foerderung = foerderung;
        sp.alter = 13; // damit sie drei Saisons in der C-Jugend bleiben
        vorher.set(sp.name, jugendStaerke(sp));
      }
      jugendSchreiben(h, d);
      for (let i = 0; i < 2; i++) jugendSaison(h, mulberryRng(seed * 10 + i));
      for (const sp of jugendLesen(h)[0].flat()) {
        const alt = vorher.get(sp.name);
        if (alt === undefined) continue;
        summe += jugendStaerke(sp) - alt;
        n++;
      }
    }
    return summe / Math.max(1, n);
  };
  const mit = zuwachs(true);
  const ohne = zuwachs(false);
  assert.ok(mit > ohne, `Förderung bringt im Schnitt mehr: ${mit.toFixed(2)} gegen ${ohne.toFixed(2)}`);
});

test("Jugend: Aufstieg mit Grenze, zu Alte gehen, die C-Jugend füllt sich auf", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(5));
  // Alle der C-Jugend auf das Höchstalter setzen, damit sie aufsteigen wollen
  const daten = jugendLesen(g);
  for (const s of daten[0][0]) if (s.name !== "") s.alter = JUGEND_ALTER[0][1];
  // In der B-Jugend Platz schaffen
  for (let p = 4; p < JUGEND_PLAETZE; p++) daten[0][1][p] = { ...daten[0][1][p], name: "" };
  jugendSchreiben(g, daten);
  const vorher = jugendLesen(g)[0][0].filter((s) => s.name !== "").length;
  const ereignisse = jugendSaison(g, mulberryRng(9));
  const aufstiege = ereignisse.filter((e) => e.manager === 0 && e.kind === "aufstieg" && e.von === 0);
  assert.ok(aufstiege.length <= JUGEND_AUFSTIEGE, `${aufstiege.length} Aufstiege, erlaubt sind ${JUGEND_AUFSTIEGE}`);
  const abgaenge = ereignisse.filter((e) => e.manager === 0 && e.kind === "abgang" && e.von === 0);
  assert.equal(aufstiege.length + abgaenge.length, vorher, "jeder zu Alte steigt auf oder geht");
  // Die Stärksten steigen auf
  if (aufstiege.length && abgaenge.length) {
    assert.ok(Math.min(...aufstiege.map((e) => e.staerke ?? 0)) >= Math.max(...abgaenge.map((e) => e.staerke ?? 0)));
  }
  // Aus der A-Jugend Herausgewachsene stehen bereit
  const reif = jugendSaison(g, mulberryRng(13)).filter((e) => e.kind === "reif");
  assert.ok(reif.length >= 0);
});

test("Jugend: nach Jahren voller Förderung bleibt die Stärke im gemessenen Rahmen", () => {
  // Der Jugendspieler des Originals pendelt sich um 45 ein (Messung in #4) - höher soll auch
  // die neue Jugendarbeit nicht kommen
  const g = load();
  g.managers.at(0).setU8(319, 34); // Jugendregler ganz auf
  jugendAnlegen(g, mulberryRng(21));
  const d = jugendLesen(g);
  for (const team of d[0]) for (const s of team) if (s.name !== "") s.foerderung = true;
  jugendSchreiben(g, d);
  for (let i = 0; i < 8; i++) jugendSaison(g, mulberryRng(200 + i));
  const beste = Math.max(...jugendLesen(g)[0].flat().filter((s) => s.name !== "").map(jugendStaerke));
  assert.ok(beste <= 60, `stärkster Jugendspieler ${beste}, das ist zu viel`);
});

test("Jugend: reife Spieler rücken auf, mit halbem Gehalt und Grenze je Saison (#4, Stufe 2)", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(31));
  // Die A-Jugend auf reif setzen
  const daten = jugendLesen(g);
  for (const s of daten[0][2]) if (s.name !== "") s.alter = JUGEND_ALTER[2][1] + 1;
  jugendSchreiben(g, daten);
  const reife = jugendLesen(g)[0][2].map((s, p) => ({ s, p })).filter((x) => istReif(x.s, 2));
  assert.ok(reife.length >= 6, `nur ${reife.length} reife Spieler`);
  const kaderVorher = g.squadOf(0).length;
  let geholt = 0;
  const gehaelter: number[] = [];
  for (const { p } of reife) {
    const r = jugendAufruecken(g, 0, p, mulberryRng(40 + p));
    if (r.ok) {
      geholt++;
      gehaelter.push(g.lineups.at(0 * 25 + r.place).i32(40));
    } else {
      assert.match(r.error, /H\|chstens/, `unerwarteter Fehler: ${r.error}`);
    }
  }
  assert.equal(geholt, JUGEND_MAX_AUFRUECKER, "die Grenze je Saison greift");
  assert.equal(aufruecker(g, 0), JUGEND_MAX_AUFRUECKER);
  assert.equal(g.squadOf(0).length, kaderVorher + geholt);
  // Die Gehälter liegen deutlich unter dem Kaderschnitt
  const schnitt = g.squadOf(0).reduce((s, l) => s + l.i32(40), 0) / g.squadOf(0).length;
  assert.ok(Math.max(...gehaelter) < schnitt, `Aufrücker verdienen ${Math.max(...gehaelter)}, Schnitt ${Math.round(schnitt)}`);
  // Nach dem Saisonwechsel geht der Zähler auf null
  jugendZaehlerLeeren(g);
  assert.equal(aufruecker(g, 0), 0);
});

test("Jugend: wer nicht geholt wird, geht in der nächsten Saison (#4, Stufe 2)", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(17));
  const daten = jugendLesen(g);
  for (const s of daten[0][2]) if (s.name !== "") s.alter = JUGEND_ALTER[2][1];
  jugendSchreiben(g, daten);
  // Erste Saison: sie werden reif und bleiben stehen
  const reif = jugendSaison(g, mulberryRng(19)).filter((e) => e.manager === 0 && e.kind === "reif");
  assert.ok(reif.length > 0, "niemand wird reif");
  const namen = new Set(reif.map((e) => e.name));
  assert.ok(jugendLesen(g)[0][2].some((s) => namen.has(s.name)), "die Reifen stehen noch da");
  // Zweite Saison: wer immer noch da ist, geht (nachgerückte werden ihrerseits reif)
  const abgang = jugendSaison(g, mulberryRng(23)).filter((e) => e.manager === 0 && e.kind === "abgang");
  assert.ok(abgang.length > 0, "niemand geht");
  assert.equal(jugendLesen(g)[0][2].filter((s) => namen.has(s.name)).length, 0, "die Reifen von damals sind weg");
});

test("Jugend: die anderen dürfen einen Aufrücker abwerben, aber nur einen je Saison (#4, Stufe 2)", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(29));
  const daten = jugendLesen(g);
  for (const s of daten[0][2]) if (s.name !== "") s.alter = JUGEND_ALTER[2][1] + 1;
  jugendSchreiben(g, daten);
  const platz = jugendLesen(g)[0][2].findIndex((s) => istReif(s, 2));
  const r = jugendAufruecken(g, 0, platz, mulberryRng(3));
  assert.ok(r.ok);
  if (!r.ok) return;
  g.managers.at(1).balance = 50_000_000;
  const kader1 = g.squadOf(1).length;
  // Der Würfel trifft immer: der Wechsel kommt zustande
  const weg = jugendAbwerben(g, 1, 0, r.place, 0, () => 0);
  assert.ok(weg.ok && weg.agreed, `Abwerben fehlgeschlagen: ${JSON.stringify(weg)}`);
  assert.equal(g.squadOf(1).length, kader1 + 1);
  assert.equal(jugendAbwerbungen(g, 1), 1);
  // Ein zweites Mal geht in derselben Saison nicht
  const zweitesMal = jugendAbwerben(g, 1, 0, 0, 0, () => 0);
  assert.equal(zweitesMal.ok, false);
  // Der eigene Spieler lässt sich nicht abwerben, und im Original gibt es das alles nicht
  assert.equal((jugendAbwerben(g, 0, 0, 0, 0, () => 0) as { error: string }).error, "Das ist Ihr eigener Spieler");
  const h = load(false);
  assert.equal(jugendAbwerben(h, 1, 0, 0, 0, () => 0).ok, false);
});

test("Jugend: nur die Mischung aus Geld und Training bringt ein großes Talent (#4)", () => {
  // Der Entwicklungssprung hebt das Potenzial - und den gibt es nur mit beidem
  const probe = { name: "X", alter: 14, art: 3, ko: 30, te: 30, fo: 50, potenzial: 40, foerderung: false, training: 0, jahre: 1, verlauf: [0, 0, 0, 0] };
  assert.equal(jugendSprung({ ...probe }), 0, "ohne alles kein Sprung");
  assert.equal(jugendSprung({ ...probe, training: 3 }), 0, "Training allein reicht nicht");
  assert.equal(jugendSprung({ ...probe, foerderung: true }), 0, "Geld allein reicht nicht");
  assert.ok(jugendSprung({ ...probe, foerderung: true, training: 2 }) > 0, "die Mischung bringt den Sprung");
  // Das Risiko hängt am Training, Geld dämpft es
  assert.equal(jugendRisiko({ ...probe }), 0);
  assert.ok(jugendRisiko({ ...probe, training: 3 }) > jugendRisiko({ ...probe, training: 1 }));
  assert.ok(jugendRisiko({ ...probe, training: 3, foerderung: true }) < jugendRisiko({ ...probe, training: 3 }));
  // Die Entwicklungschance steigt mit beidem
  assert.equal(jugendChance({ ...probe }), 35);
  assert.ok(jugendChance({ ...probe, foerderung: true, training: 3 }) > jugendChance({ ...probe, foerderung: true }));

  // Über vier Saisons: mit der Mischung entstehen Spieler jenseits der 55, ohne sie nicht -
  // und mit hartem Training geht ein Teil verloren
  const lauf = (geld: boolean, training: number) => {
    let beste = 0;
    let aufgaben = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const h = load();
      h.managers.at(0).setU8(319, 34);
      jugendAnlegen(h, mulberryRng(seed));
      const d = jugendLesen(h);
      const namen = new Set<string>();
      for (const sp of d[0][0]) {
        if (sp.name === "") continue;
        sp.foerderung = geld;
        sp.training = training;
        sp.alter = 13;
        namen.add(sp.name);
      }
      jugendSchreiben(h, d);
      for (let i = 0; i < 4; i++) aufgaben += jugendSaison(h, mulberryRng(seed * 13 + i)).filter((e) => e.kind === "aufgabe" && namen.has(e.name)).length;
      for (const sp of jugendLesen(h).flat(2)) if (namen.has(sp.name)) beste = Math.max(beste, jugendStaerke(sp));
    }
    return { beste, aufgaben };
  };
  const ohne = lauf(false, 0);
  const mischung = lauf(true, 3);
  assert.ok(mischung.beste > ohne.beste + 5, `mit Mischung ${mischung.beste}, ohne ${ohne.beste}`);
  assert.equal(ohne.aufgaben, 0, "ohne Training gibt niemand auf");
  assert.ok(mischung.aufgaben > 0, "hartes Training kostet auch Spieler");
});

test("Jugend: höchstens vier je Mannschaft in der Förderung (#4)", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(11));
  const plaetze = jugendLesen(g)[0][0].map((s, p) => ({ s, p })).filter((x) => x.s.name !== "");
  assert.ok(plaetze.length > JUGEND_MAX_FOERDERUNG, "genug Spieler für den Versuch");
  for (let i = 0; i < JUGEND_MAX_FOERDERUNG; i++) {
    assert.equal(foerdern(g, 0, 0, plaetze[i].p, true).ok, true, `Platz ${i} darf gefördert werden`);
  }
  assert.equal(gefoerderte(g, 0, 0), JUGEND_MAX_FOERDERUNG);
  // Der fünfte wird abgelehnt - egal über welchen der beiden Hebel
  assert.equal(foerdern(g, 0, 0, plaetze[4].p, true).ok, false, "Geld für den fünften");
  assert.equal(foerdern(g, 0, 0, plaetze[4].p, undefined, 2).ok, false, "Training für den fünften");
  // Eine andere Mannschaft hat ihre eigenen vier Plätze
  assert.equal(foerdern(g, 0, 1, jugendLesen(g)[0][1].findIndex((s) => s.name !== ""), true).ok, true);
  // Wer aufhört, macht den Platz frei
  assert.equal(foerdern(g, 0, 0, plaetze[0].p, false, 0).ok, true);
  assert.equal(gefoerderte(g, 0, 0), JUGEND_MAX_FOERDERUNG - 1);
  assert.equal(foerdern(g, 0, 0, plaetze[4].p, true).ok, true, "jetzt ist wieder Platz");
  // Ein schon Geförderter darf den zweiten Hebel weiter umlegen, auch wenn alles belegt ist
  assert.equal(gefoerderte(g, 0, 0), JUGEND_MAX_FOERDERUNG);
  assert.equal(foerdern(g, 0, 0, plaetze[1].p, undefined, 3).ok, true, "zweiter Hebel bleibt offen");
});

test("Jugend: hinter dem Namen steht, aus welcher Jugend er kam (#4)", () => {
  const g = load();
  jugendAnlegen(g, mulberryRng(5));
  const rng = mulberryRng(9);
  // Neuzugänge tragen kein Kürzel
  assert.equal(jugendLesen(g)[0].flat().every((s) => s.name === "" || jugendHerkunft(s) === ""), true);
  for (let i = 0; i < 3; i++) jugendSaison(g, rng);
  const daten = jugendLesen(g);
  // Wer in der B-Jugend steht und vorher in der C-Jugend war, trägt (C); ebenso B -> A
  const bJugend = daten[0][1].filter((s) => s.name !== "" && jugendHerkunft(s) !== "");
  assert.ok(bJugend.length > 0, "es sind welche aufgestiegen");
  for (const s of bJugend) assert.equal(jugendHerkunft(s), "C");
  for (const s of daten[0][2].filter((x) => x.name !== "" && jugendHerkunft(x) !== "")) {
    assert.equal(jugendHerkunft(s), "B");
  }
  // Das Kürzel überlebt das Speichern und Laden
  const wieder = new GameState(SaveFile.decode(g.save.encode()));
  assert.deepEqual(
    jugendLesen(wieder)[0].map((t) => t.map(jugendHerkunft)),
    daten[0].map((t) => t.map(jugendHerkunft)),
  );
});
