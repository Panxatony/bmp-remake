/**
 * Tageslauf in der Reihenfolge des Originals - nur für den bytegenauen Vergleich (GitLab #99).
 *
 * Das Original wird mit tools/seed-patch.py (Ort "tag") und tools/kontrollpunkte.py präpariert:
 * am Tagesbeginn setzt es srand(K) und schreibt an festen Aufrufen den Zustand seines
 * Zufallsgenerators ins Protokoll. Ein geladener Stand beginnt den Tag von vorn (0x1D6F6);
 * zwei Läufe damit sind bytegleich. Dieser Lauf macht dieselben Schritte mit `originalRng(K)` und
 * notiert an denselben Stellen die Zahl der Würfe. Stimmen die Zahlen, würfeln beide gleich.
 *
 * Der Server spielt einen Tag anders auf (Konferenz, Buchung danach); die Bausteine sind
 * dieselben. Abschnitte, die hier noch fehlen, beenden den Lauf - `bis` sagt, wie weit er kam.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { LiveMatch } from "./live.ts";
import { bookEvents } from "./matchday.ts";
import { minuteIncidents, newIncidentState, type IncidentState } from "./incidents.ts";
import { matchStrength } from "./matchday.ts";
import { kaderVorbereitung } from "./matchday.ts";
import { attendance, bookAttendance, bookGate } from "./attendance.ts";
import { riotCheck } from "./finance.ts";
import { isForfeit } from "./incidents.ts";
const szenen = true;
const beteiligt = (s: { seiten: unknown[] }) => s.seiten.length > 0;
import { calendarFlag, dayIndex, FLAG_LEAGUE, dateOfSeasonDay, seasonDay, seasonStartYear } from "./calendar.ts";
import { dailyFinance, DAYS_IN_MONTH } from "./finance.ts";
import { driftInterest, dailyConstruction } from "./stadium.ts";
import { advanceCampOpen, CAMP_OPEN_START } from "./training.ts";
import { driftClubs } from "./ai.ts";
import { autoLineupIfEnabled, SYSTEM_OFFSET } from "./lineup.ts";
import { refreshMarket } from "./transfer.ts";

export interface Kontrollpunkt {
  punkt: number;
  wurf: number;
}

/** Stand des Laufs: Kontrollpunkte und bis wohin er kam. */
export interface Originaltag {
  punkte: Kontrollpunkt[];
  bis: string;
}

/**
 * Die Spielmatrix steht nach 0x0F9D2 mit Flag 1 im Vereinssatz (Kondition 24.., Technik 27..,
 * Form 30..); die Live-Schleife und die Zuschauerrechnung lesen sie dort (0x04568).
 */
function matrixInVerein(g: GameState, manager: number, s: { ko: number[]; te: number[]; fo: number[] }): void {
  const c = g.clubs.at(g.managers.at(manager).clubIndex);
  for (let l = 0; l < 3; l++) {
    c.setU8(24 + l, s.ko[l] & 0xff);
    c.setU8(27 + l, s.te[l] & 0xff);
    c.setU8(30 + l, s.fo[l] & 0xff);
  }
}

export function originaltag(g: GameState, rng: Rng & { zaehler(): number }): Originaltag {
  const punkte: Kontrollpunkt[] = [];
  const kp = (punkt: number) => punkte.push({ punkt, wurf: rng.zaehler() });
  const managers = g.activeManagers();

  const n = managers.length;

  // Tagesbeginn 0x1D6F6: Finanzen je Manager (0x11D0D: Bau, Öffnungszeiten der Lager, Bankzins
  // mit 1/61, Kredite und Monatsende). Die Lagerzeiten stehen nicht im Stand; nach dem Laden
  // gelten die Startwerte.
  const dt = dateOfSeasonDay(seasonDay(dayIndex(g)), seasonStartYear(g));
  const lager = CAMP_OPEN_START.slice();
  for (let m = 0; m < n; m++) {
    kp(7);
    dailyConstruction(g, m);
    advanceCampOpen(lager, rng);
    if (rng(0, 60) === 0) driftInterest(g, rng);
    dailyFinance(g, m, dt, rng, undefined, false);
  }
  // 0x1D77C: Schwankung aller Vereine
  driftClubs(g, 1, rng);
  const flag = calendarFlag(g, dayIndex(g));
  if (flag !== 0 && flag !== 9) {
    // je Manager das gesicherte System zurück (079E = 079F), Aufstellung 0x22030, Anzeigestärke
    // mit Flag 0 (würfelt nicht)
    for (let m = 0; m < n; m++) {
      g.save.plain[SYSTEM_OFFSET + 2 * m] = g.save.plain[SYSTEM_OFFSET + 2 * m + 1];
      autoLineupIfEnabled(g, m);
    }
  }
  // Automatische Speicherung: 0x11E3D setzt am Monatsletzten mit Monat % 4 = 0 (Januar, Mai,
  // September; Monat 0-basiert) die Marke 4cb3:5256, das nächste Hauptmenü speichert als
  // AUTOSAVE (0x9744 -> 0x32AAE). Das Speichern würfelt viermal: eine Kennung aus zwei
  // random(0, 0x8FFF) und zwei Schlüsselbytes random(0, 255).
  let autosave = dt.day === DAYS_IN_MONTH[dt.month0] && dt.month0 % 4 === 0;
  // Züge 0x1E0A6: je Manager random(0, n+3), bei 0 Markterneuerung, dann das Hauptmenü
  for (let m = 0; m < n; m++) {
    kp(10);
    if (rng(0, n + 3) === 0) {
      kp(11);
      refreshMarket(g, rng);
    }
    kp(12);
    if (autosave) {
      for (const hi of [0x8fff, 0x8fff, 255, 255]) rng(0, hi);
      autosave = false;
    }
  }

  // Nach den Zügen: Spielstärke aller Manager (0x1D7FF, Flag 1)
  managers.forEach((_, m) => {
    kp(13);
    matrixInVerein(g, m, matchStrength(g, m, rng));
  });

  if ((flag & 7) === 0) return { punkte, bis: "kein Ligatag - weitere Tagesarten fehlen noch" };
  // Verlegungen je Liga (0x3563) würfeln nur im Winterfenster - dort fehlt der Lauf noch
  if (dayIndex(g) >= 25 && dayIndex(g) <= 69) return { punkte, bis: "Winterfenster (Verlegungen) fehlt noch" };

  // Spieltagstreiber 0x46DB: Spielvorbereitung je Paarung in Ligareihenfolge (0x4914)
  kp(1);
  const managerOf = new Map(managers.map((m, i) => [m.clubIndex, i] as const));
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    for (const [home, away] of g.pairings(league)) {
      kp(2);
      // 0x1C632: die Manager der Paarung in ihrer Reihenfolge; der erste mit zu wenigen
      // Spielern beendet die Routine
      const beteiligt = [managerOf.get(home), managerOf.get(away)].filter((x) => x !== undefined).sort((a, b) => a - b);
      for (const mi of beteiligt) {
        if (isForfeit(g, mi)) break;
        if (managers[mi].clubIndex === home) {
          const att = attendance(g, { manager: mi, home, away, level: g.save.plain[34062] }, rng);
          bookAttendance(g, mi, att, away);
          bookGate(g, mi, att);
        }
        kaderVorbereitung(g, mi, 0, rng);
        if (managers[mi].clubIndex === home) riotCheck(g, mi, rng);
      }
    }
  }
  // Live-Schleife 0x05403, erste Halbzeit: zu Beginn die Chancen jeder Paarung (0x054C2 ruft
  // 0x102B9 mit Schalter 1: Zahl je Seite, dann die Minuten erst für Heim, dann für Gast), danach
  // je Minute und Paarung Karten und Verletzungen (0x05FE5), nach glatt Rot oder Verletzung die
  // Neuauslosung (0x0657F), dann die Chancen der Minute (0x1060B, Buchung 0x1B223)
  const spiele: { home: number; away: number; match: LiveMatch; seiten: [number, IncidentState, "home" | "away"][] }[] = [];
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    for (const [home, away] of g.pairings(league)) {
      const match = new LiveMatch(g.clubs.at(home).strengthMatrix, g.clubs.at(away).strengthMatrix, rng);
      const seiten: [number, IncidentState, "home" | "away"][] = [];
      for (const [club, seite] of [[home, "home"], [away, "away"]] as const) {
        const mi = managerOf.get(club);
        if (mi !== undefined) seiten.push([mi, newIncidentState(), seite]);
      }
      seiten.sort((a, b) => a[0] - b[0]);
      spiele.push({ home, away, match, seiten });
    }
  }
  for (let minute = 1; minute <= 45; minute++) {
    for (const s of spiele) {
      if (minute === 1) kp(4);
      s.match.beginMinute();
    }
    for (const s of spiele) {
      let neu: number | undefined;
      for (const [mi, st, seite] of s.seiten) {
        const fresh = minuteIncidents(g, mi, minute, st, rng, kp);
        if (fresh.length === 0) continue;
        if (fresh.some((x) => x.kind !== "yellow")) s.match[seite] = matchStrength(g, mi, rng);
        if (fresh.some((x) => x.kind === "red" || x.kind === "injury")) neu = mi;
      }
      if (neu !== undefined) {
        kp(6);
        s.match.neuAuslosen(neu);
      }
      s.match.chances((c) => {
        // Den Chancenhandler ruft der Torwürfel nur für Spiele mit Manager (0x108EF)
        if (!beteiligt(s)) return;
        kp(16);
        bookEvents(g, s.home, s.away, { home: s.match.hg, away: s.match.ag, events: [c] }, 0, rng, [szenen ? pickScene(rng, c.goal) : false]);
      }, (seite) => kp(seite === "home" ? 14 : 15));
    }
  }
  // Halbzeitende (0x05BD6). Zwischen hier und den Chancen der zweiten Halbzeit würfelt das
  // Original in manchen Läufen noch - das ist noch nicht geklärt (#99)
  kp(21);
  return { punkte, bis: "Halbzeitpause und zweite Halbzeit fehlen noch" };
}

/** Szenenwahl des Laders 0x1502C (nur die Würfel): Nummer, Elfmeter, seltene Jubelszene. */
function pickScene(rng: Rng, goal: boolean): boolean {
  rng(2, 43);
  const elfmeter = rng(0, goal ? 15 : 25) === 0;
  if (elfmeter) rng(2, 5);
  else rng(0, 400);
  return elfmeter;

}
