/**
 * Torszenen aus einer Beschreibung (GitLab #6, Stufe 1).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { baueSzene, alsFassung, pruefeBeschreibung, SZENE_GRENZEN, TOR_LINKS, TOR_RECHTS, type Beschreibung } from "../src/index.ts";

const einfach = (): Beschreibung => ({
  name: "probe",
  bilder: 21,
  figuren: [
    { name: "laeufer", sprite: 12, pos: [40, 60], bahn: [{ art: "lauf", bis: 20, nach: [140, 60], phasen: [12, 13, 14, 15] }] },
    { name: "ball", sprite: 142, pos: [46, 66], bahn: [{ art: "folgt", bis: 10, wem: "laeufer", versatz: [6, 6] }, { art: "flug", bis: 20, nach: [300, 40], hoehe: 16, schatten: 145 }] },
  ],
});

test("Szene: der Läufer geht geradlinig und die Laufphasen wechseln", () => {
  const s = baueSzene(einfach());
  assert.equal(s.frames.length, 21);
  const x = (f: number) => s.frames[f][1][0][0];
  assert.equal(x(0), 40);
  assert.equal(x(10), 90, "auf halbem Weg");
  assert.equal(x(20), 140, "am Ziel");
  // Phasen wechseln alle zwei Bilder
  const phase = (f: number) => s.frames[f][1][0][2];
  assert.equal(phase(1), 12);
  assert.equal(phase(2), 13);
  assert.equal(phase(4), 14);
  assert.notEqual(phase(2), phase(4));
});

test("Szene: der Ball folgt erst und fliegt dann mit Schatten", () => {
  const s = baueSzene(einfach());
  // Bild 5: Ball hängt am Läufer (Versatz 6/6)
  const b5 = s.frames[5][1];
  const laeufer5 = b5[0];
  const ball5 = b5[b5.length - 3]; // vor den beiden Toren
  assert.equal(ball5[0], laeufer5[0] + 6);
  assert.equal(ball5[1], laeufer5[1] + 6);
  // Im Flug gibt es einen zusätzlichen Eintrag für den Schatten
  const b15 = s.frames[15][1];
  assert.equal(b15.length, 5, "Läufer, Schatten, Ball und zwei Tore");
  const schatten = b15[1];
  const ball15 = b15[2];
  assert.equal(schatten[2], 145);
  assert.ok(ball15[1] < schatten[1], "der Ball liegt über seinem Schatten");
});

test("Szene: die Tore stehen an ihren festen Plätzen", () => {
  const s = baueSzene(einfach());
  for (const [, sprites] of s.frames) {
    assert.deepEqual(sprites[sprites.length - 2], [0, 54, TOR_LINKS]);
    assert.deepEqual(sprites[sprites.length - 1], [296, 54, TOR_RECHTS]);
  }
  const ohne = baueSzene({ ...einfach(), tore: false });
  assert.ok(ohne.frames[0][1].every((sp) => sp[2] < 1000));
});

test("Szene: die Kamera folgt und bleibt im erlaubten Bereich", () => {
  const b = einfach();
  b.kamera = { art: "folgt", wem: "ball", ab: 5 };
  const s = baueSzene(b);
  const kx = (f: number) => s.frames[f][0] & 0xff;
  assert.equal(kx(0), 0, "vor dem Einsetzen steht sie links");
  assert.ok(kx(20) <= SZENE_GRENZEN.kameraX, "nie über die Grenze");
  assert.ok(kx(20) > kx(6), "sie wandert mit dem Ball nach rechts");
});

test("Szene: Klänge stehen im Kopf, fehlende als 255", () => {
  const b = einfach();
  b.klaenge = [18, null, 20];
  const s = baueSzene(b);
  assert.deepEqual(s.header, [18, 255, 20, 255]);
});

test("Szene: die Prüfung fängt die Grenzen des Formats ab", () => {
  const zuViele: Beschreibung = {
    name: "zuviele",
    bilder: 10,
    figuren: Array.from({ length: 26 }, (_, i) => ({ name: `f${i}`, sprite: 0, pos: [10 + i, 40] as [number, number] })),
  };
  assert.match(pruefeBeschreibung(zuViele).join(" "), /Einträge je Bild/);
  assert.match(pruefeBeschreibung({ ...einfach(), bilder: 1 }).join(" "), /Bildzahl/);
  assert.match(pruefeBeschreibung({ ...einfach(), figuren: [{ name: "x", sprite: 400, pos: [0, 0] }] }).join(" "), /Sprite 400/);
  assert.match(
    pruefeBeschreibung({ name: "p", bilder: 5, figuren: [{ name: "a", sprite: 0, pos: [0, 0], bahn: [{ art: "folgt", bis: 4, wem: "fehlt" }] }] }).join(" "),
    /"fehlt"/,
  );
  assert.deepEqual(pruefeBeschreibung(einfach()), []);
  assert.throws(() => baueSzene({ ...einfach(), bilder: 0 }), /Beschreibung/);
});

test("Szene: alle Werte bleiben in den Grenzen des Formats", () => {
  const b = einfach();
  b.figuren[0].bahn = [{ art: "lauf", bis: 20, nach: [900, 300], phasen: [12] }];
  const s = baueSzene(b);
  for (const [kopf, sprites] of s.frames) {
    assert.ok((kopf & 0xff) <= SZENE_GRENZEN.kameraX && kopf >> 8 <= SZENE_GRENZEN.kameraY);
    assert.ok(sprites.length <= SZENE_GRENZEN.sprites);
    for (const [x, y] of sprites) {
      assert.ok(x >= 0 && x <= SZENE_GRENZEN.breite, `x ${x}`);
      assert.ok(y >= 0 && y <= SZENE_GRENZEN.hoehe, `y ${y}`);
    }
  }
});

test("Szene: die Chancenfassung übernimmt den Anfang und weicht danach ab", () => {
  const b: Beschreibung = {
    ...einfach(),
    chance: { ab: 10, klaenge: [null], figuren: { ball: [{ art: "flug", bis: 20, nach: [310, 10], hoehe: 20 }] } },
  };
  const tor = baueSzene(b);
  const chance = baueSzene(alsFassung(b, b.chance!));
  // bis Bild 10 sind beide gleich
  for (let f = 0; f <= 10; f++) assert.deepEqual(chance.frames[f], tor.frames[f], `Bild ${f}`);
  // danach nicht mehr
  assert.notDeepEqual(chance.frames[20], tor.frames[20]);
  // und die Klänge der Fassung gelten
  assert.deepEqual(chance.header, [255, 255, 255, 255]);
  // die Vorlage bleibt unberührt
  assert.equal(b.figuren[1].bahn?.length, 2);
});
