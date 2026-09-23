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
import { composeZeitung, reportFromMatch } from "./zeitung.ts";
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
import { dailyFinance, DAYS_IN_MONTH, christmasPresents, scherztagWurf } from "./finance.ts";
import { driftInterest, dailyConstruction } from "./stadium.ts";
import { advanceCampOpen, CAMP_OPEN_START, trainingInput } from "./training.ts";
import { tagesroutine } from "./tagesroutine.ts";
import { generateOffers } from "./werbung.ts";
import { driftClubs, bookBaseBonus, creditAiGoals } from "./ai.ts";
import { applyResult } from "./standings.ts";
import { bookHistory } from "./history.ts";
import { autoLineupIfEnabled, backupSystem, SYSTEM_OFFSET } from "./lineup.ts";
import { refreshMarket } from "./transfer.ts";
import { replays, verlegen, istVerlegt } from "./postpone.ts";
import { fixtures } from "./fixtures.ts";
import { afterCupDay, dfbFinale, shootout, currentPairs, legPlayed, tieBreak, CUP_RESULTS, CUP_ROUND, FIRST_LEG } from "./europa.ts";
import { pokalZuschlag, ERSATZ_PREIS, ligaBand } from "./attendance.ts";

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

/**
 * `lager`: Öffnungszeiten der Trainingslager beim Laden (4cb3:0620). Sie stehen nicht im
 * Spielstand, und bis das Original den Stand lädt, sind sie schon etliche Tage gelaufen; für
 * einen Vergleich gibt man den im Original gemessenen Wert mit (kontrollpunkte.py --dump).
 */
export function originaltag(g: GameState, rng: Rng & { zaehler(): number }, lagerBeimLaden: readonly number[] = CAMP_OPEN_START, beobachter?: (punkt: number, g: GameState) => void): Originaltag {
  const punkte: Kontrollpunkt[] = [];
  // `beobachter` sieht den Stand an jedem Punkt - für Vergleiche mit einem Speicherabzug des
  // Originals (kontrollpunkte.py --dump)
  const kp = (punkt: number) => {
    punkte.push({ punkt, wurf: rng.zaehler() });
    beobachter?.(punkt, g);
  };
  const managers = g.activeManagers();

  const n = managers.length;

  // Tagesbeginn 0x1D6F6: Finanzen je Manager (0x11D0D: Bau, Öffnungszeiten der Lager, Bankzins
  // mit 1/61, Kredite und Monatsende). Die Lagerzeiten stehen nicht im Stand; nach dem Laden
  // gelten die Startwerte.
  const dt = dateOfSeasonDay(seasonDay(dayIndex(g)), seasonStartYear(g));
  const lager = lagerBeimLaden.slice();
  for (let m = 0; m < n; m++) {
    kp(7);
    for (const _ of dailyConstruction(g, m)) rng(0, 3);
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
    // 0x1D817: System sichern und auf manuell - bis zum nächsten Spieltag
    backupSystem(g, m);
  });

  if ((flag & 7) === 0) {
    if (flag === 0x80) {
      const bis = nachholtag(g, rng, kp);
      return { punkte, bis: bis ?? folgetage(g, rng, kp, lager) };
    }
    const cups = flag === 8 ? [0] : flag === 0x70 ? [1, 2, 3] : undefined;
    if (!cups) return { punkte, bis: "weder Liga-, Pokal- noch Nachholtag - weitere Tagesarten fehlen noch" };
    const bis = pokaltag(g, rng, kp, cups);
    if (bis) return { punkte, bis };
    return { punkte, bis: folgetage(g, rng, kp, lager) };
  }
  // Verlegungen je Liga (0x1D87E -> 0x3563, nur im Winterfenster): die Bundesliga nur mit ihrem
  // Ligabit, die beiden anderen Ligen ruft das Original an jedem Ligatag auf
  for (let league = 0; league < 3; league++) {
    if (league === 0 && !(flag & 1)) continue;
    verlegen(g, dayIndex(g), league, g.nextMatchday(league), rng, (l, md, m) => fixtures(l, md)[m]);
  }
  const ligaPaare = (league: number) => g.pairings(league).filter((_, m) => !istVerlegt(g, league, g.nextMatchday(league), m));

  // Spieltagstreiber 0x46DB: Spielvorbereitung je Paarung in Ligareihenfolge (0x4914)
  kp(1);
  const managerOf = new Map(managers.map((m, i) => [m.clubIndex, i] as const));
  const zuschauer = new Map<number, number>();
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    for (const [home, away] of ligaPaare(league)) {
      kp(2);
      // 0x1C632: die Manager der Paarung in ihrer Reihenfolge; der erste mit zu wenigen
      // Spielern beendet die Routine
      const beteiligt = [managerOf.get(home), managerOf.get(away)].filter((x) => x !== undefined).sort((a, b) => a - b);
      for (const mi of beteiligt) {
        if (isForfeit(g, mi)) break;
        if (managers[mi].clubIndex === home) {
          const att = attendance(g, { manager: mi, home, away, level: g.save.plain[34062] }, rng);
          zuschauer.set(home, att);
          bookAttendance(g, mi, att, away);
          bookGate(g, mi, att);
        }
        kaderVorbereitung(g, mi, 0, rng);
        if (managers[mi].clubIndex === home) riotCheck(g, mi, rng);
      }
    }
  }
  // Live-Schleife 0x05403 je Halbzeit: zu Beginn die Chancen jeder Paarung (0x054C2 ruft
  // 0x102B9 mit Schalter 1: Zahl je Seite, dann die Minuten erst für Heim, dann für Gast), danach
  // je Minute und Paarung Karten und Verletzungen (0x05FE5), nach glatt Rot oder Verletzung die
  // Neuauslosung (0x0657F), dann die Chancen der Minute (0x1060B, Buchung 0x1B223)
  // Verlegte Paarungen bleiben in der Liste: der Punkt vor den Chancen läuft für sie mit, gewürfelt
  // wird nichts
  const spiele: { home: number; away: number; verlegt: boolean; match: LiveMatch; seiten: [number, IncidentState, "home" | "away"][]; schuetzen: { minute: number; side: "home" | "away"; name: string }[] }[] = [];
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    const md = g.nextMatchday(league);
    for (const [m, [home, away]] of g.pairings(league).entries()) {
      const verlegt = istVerlegt(g, league, md, m);
      const match = new LiveMatch(g.clubs.at(home).strengthMatrix, g.clubs.at(away).strengthMatrix, rng);
      const seiten: [number, IncidentState, "home" | "away"][] = [];
      for (const [club, seite] of [[home, "home"], [away, "away"]] as const) {
        const mi = managerOf.get(club);
        if (mi !== undefined) seiten.push([mi, newIncidentState(), seite]);
      }
      seiten.sort((a, b) => a[0] - b[0]);
      spiele.push({ home, away, verlegt, match, seiten, schuetzen: [] });
    }
  }
  const managerLigen = new Set(managers.map((m) => (m.clubIndex < 18 ? 0 : m.clubIndex < 38 ? 1 : 2)));
  const staerkeNeu = () => {
    managers.forEach((m, mi) => {
      const st = matchStrength(g, mi, rng);
      matrixInVerein(g, mi, st);
      for (const sp of spiele) {
        if (sp.home === m.clubIndex) sp.match.home = st;
        if (sp.away === m.clubIndex) sp.match.away = st;
      }
    });
  };
  for (let minute = 1; minute <= 90; minute++) {
    for (const s of spiele) {
      if (minute === 1 || minute === 46) kp(4);
      if (!s.verlegt) s.match.beginMinute();
    }
    for (const s of spiele) {
      if (s.verlegt) continue;
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
        s.schuetzen.push(...bookEvents(g, s.home, s.away, { home: s.match.hg, away: s.match.ag, events: [c] }, 0, rng, [szenen ? pickScene(rng, c.goal) : false]));
      }, (seite) => kp(seite === "home" ? 14 : 15));
    }
    if (minute !== 45 && minute !== 90) continue;
    // Halbzeitende (0x05BD6)
    kp(21);
    if (minute === 90) break;
    // Übersicht je Liga (0x5C48): mit gesetztem Schalter "Halbzeitstände" der Liga zeigt das
    // Original ihre Seite (0x2B61A), und die rechnet am Ende die Spielstärke aller Manager mit
    // Flag 1 neu (0x2C10C) - mit Würfeln, und die neue Matrix gilt in der zweiten Halbzeit.
    // Die Schalter stehen auf den Ligen der Manager (0xDA40).
    for (let league = 0; league < 3; league++) {
      if (!(flag & FLAG_LEAGUE[league]) || !managerLigen.has(league)) continue;
      staerkeNeu();
    }
  }
  // Nach der 90. Minute je Liga (0x05C48): Tabelle mit Grundzuschlag je Paarung (0x2D143 ->
  // 0x2C3FC, Heim dann Gast), dann die Torschützen der KI-Vereine (0x160A2 -> 0x15F14), dann
  // mit dem Schalter "Ergebnisse" die Übersicht - und mit ihr die Stärke aller Manager neu
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    const paare = spiele.filter((sp) => !sp.verlegt && ligaPaare(league).some(([h, a]) => h === sp.home && a === sp.away));
    kp(22);
    for (const sp of paare) {
      const { hg, ag } = sp.match;
      applyResult(g, sp.home, sp.away, hg, ag);
      bookHistory(g, sp.home, sp.away, hg, ag);
      bookBaseBonus(g, sp.home, hg - ag, rng);
      bookBaseBonus(g, sp.away, ag - hg, rng);
    }
    kp(23);
    for (const sp of paare) {
      creditAiGoals(g, sp.home, sp.match.hg, rng);
      creditAiGoals(g, sp.away, sp.match.ag, rng);
    }
    if (managerLigen.has(league)) staerkeNeu();
  }
  // Sportzeitung (0x3074A): je Manager, der heute gespielt hat, in Managerreihenfolge erst die
  // Noten (ohne Würfel), dann die Seite (0x2F243)
  managers.forEach((m, mi) => {
    const sp = spiele.find((x) => !x.verlegt && (x.home === m.clubIndex || x.away === m.clubIndex));
    if (!sp) return;
    const inc = sp.seiten.flatMap(([, st]) => st.incidents);
    const eigene = inc.filter((x) => x.manager === mi);
    const bewertungen = new Map(g.squadOf(mi).filter((l) => !l.isEmpty).map((l) => [l.playerIndex, (l.u8(21) << 24) >> 24] as const));
    kp(24);
    const report = reportFromMatch(g, mi, {
      home: sp.home,
      away: sp.away,
      result: sp.match.result(),
      scorers: sp.schuetzen,
      attendance: zuschauer.get(sp.home),
      yellowNames: eigene.filter((x) => x.kind === "yellow").map((x) => x.name),
      redNames: eigene.filter((x) => x.kind === "red" || x.kind === "yellowred").map((x) => x.name),
      cards: inc.filter((x) => x.kind !== "injury").length,
      bewertungen,
    }, rng);
    composeZeitung(report, rng);
  });
  kp(25);
  return { punkte, bis: folgetage(g, rng, kp, lager) };
}

/**
 * Nach dem Spieltag bis zum Ankunftstag des nächsten Kalendereintrags: Finanzen je Tag,
 * Weihnachten, am Ankunftstag die Tagesroutine je Manager.
 */
function folgetage(g: GameState, rng: Rng, kp: (punkt: number) => void, lager: number[]): string {
  const n = g.activeManagers().length;
  // Tage bis zum nächsten Kalendereintrag (0x1DADC): je Tag das Datum, die Finanzen je Manager
  // (0x1DAFA -> 0x11D0D) und die Sondertage (0x1CF86, Weihnachten). Der Ankunftstag selbst
  // bekommt seine Finanzen erst am nächsten Tagesbeginn (0x1D757).
  const k = dayIndex(g);
  const bisTag = seasonDay(k + 1);
  for (let d = seasonDay(k) + 1; d < bisTag; d++) {
    const dtd = dateOfSeasonDay(d, seasonStartYear(g));
    for (let m = 0; m < n; m++) {
      kp(8);
      // "Der Ausbau ... ist abgeschlossen" geht durch die Meldungsroutine (0x022E2 -> 0x30AA0)
      for (const _ of dailyConstruction(g, m)) rng(0, 3);
      advanceCampOpen(lager, rng);
      if (rng(0, 60) === 0) driftInterest(g, rng);
      dailyFinance(g, m, dtd, rng, undefined, false);
    }
    if (dtd.day === 24 && dtd.month0 === 11) christmasPresents(g, rng);
    scherztagWurf(dtd, rng);
  }
  // Ankunftstag: je Manager die Tagesroutine (0x1DBFE -> 0x0DF0D), alle 14 Saisontage danach
  // neue Sponsorenangebote (0x1DC27 -> 0x176F4)
  const kNeu = k + 1;
  const tagNeu = seasonDay(kNeu);
  const tr = trainingInput(g);
  const spielfrei = calendarFlag(g, kNeu) === 0;
  for (let m = 0; m < n; m++) {
    kp(9);
    tagesroutine(g, m, tagNeu, tr, rng, spielfrei);
    if (tagNeu % 14 === 0) generateOffers(g, m, rng);
  }
  kp(26);
  return "nächster Tag";
}

/**
 * Pokaltag im Spieltagstreiber 0x46DB (DFB-Pokal: Wettbewerb 0, Europapokale: 1..3):
 * Vorbereitung je Paar (0x4A33 -> 0x1C632, Art 1 bzw. 2), die Live-Schleife mit (1,45) und
 * (46,90), dann 0x18E46: steht ein Spiel offen (DFB-Pokal unentschieden, Europapokal im Rückspiel
 * nach 0x19208), bekommt es die Markierung +10 und die Schleife läuft für **alle** Paare
 * (91,105) und (106,120); danach 0x18E46 noch einmal mit dem Elfmeterschießen, Rundenabschluss
 * 0x192FC. Eine Zeitung gibt es nach Pokaltagen nicht. Liefert, woran der Lauf scheiterte.
 */
function pokaltag(g: GameState, rng: Rng, kp: (punkt: number) => void, cups: number[]): string | undefined {
  const p = g.save.plain;
  if (cups.includes(0) && dfbFinale(g, 0)) return "DFB-Pokalfinale fehlt noch";
  const tag = seasonDay(dayIndex(g));
  const managers = g.activeManagers();
  const managerOf = new Map(managers.map((m, i) => [m.clubIndex, i] as const));
  const paare = cups.flatMap((cup) => currentPairs(g, cup).map(([home, away], i) => ({ cup, idx: 2 * i, home, away })));
  kp(1);
  for (const { cup, home, away } of paare) {
    kp(3);
    const art = cup === 0 ? 1 : 2;
    const importance = cup === 0 ? 1 : p[CUP_ROUND + 1] > 4 ? 3 : 2;
    const beteiligt = [managerOf.get(home), managerOf.get(away)].filter((x) => x !== undefined).sort((a, b) => a - b);
    for (const mi of beteiligt) {
      // Die Rückgabe der 0:2-Prüfung verwirft der Treiber im Pokal (V2) - hier nicht nachgebaut
      if (isForfeit(g, mi)) return "0:2-Prüfung im Pokal fehlt noch";
      if (managers[mi].clubIndex === home) {
        const att = pokalZuschlag(g, mi, away, attendance(g, { manager: mi, home, away, importance, level: p[34062] }, rng), rng);
        bookGate(g, mi, att, 2);
        const ma = managerOf.get(away);
        if (ma !== undefined) bookGate(g, ma, att, 2, managers[mi].u8(266));
      } else if (managerOf.get(home) === undefined) {
        const preis = ERSATZ_PREIS[ligaBand(home)] + rng(0, 1);
        const att = attendance(g, { manager: mi, home, away, importance: 1, fremdesStadion: true, preis, level: p[34062] }, rng);
        bookGate(g, mi, att, 2, preis);
      }
      kaderVorbereitung(g, mi, art, rng);
      if (managers[mi].clubIndex === home) riotCheck(g, mi, rng);
    }
  }
  const spiele = paare.map((pa) => {
    const match = new LiveMatch(g.clubs.at(pa.home).strengthMatrix, g.clubs.at(pa.away).strengthMatrix, rng, [[1, 45], [46, 90]], true);
    const seiten: [number, IncidentState, "home" | "away"][] = [];
    for (const [club, seite] of [[pa.home, "home"], [pa.away, "away"]] as const) {
      const mi = managerOf.get(club);
      if (mi !== undefined) seiten.push([mi, newIncidentState(false), seite]);
    }
    seiten.sort((a, b) => a[0] - b[0]);
    return { ...pa, match, seiten, schuetzen: [] as { minute: number; side: "home" | "away"; name: string }[] };
  });
  const halbzeit = (von: number, bis: number) => {
    for (let minute = von; minute <= bis; minute++) {
      for (const s of spiele) {
        if (minute === von) kp(5);
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
          if (!beteiligt(s)) return;
          kp(16);
          s.schuetzen.push(...bookEvents(g, s.home, s.away, { home: s.match.hg, away: s.match.ag, events: [c] }, s.cup === 0 ? 1 : 2, rng, [szenen ? pickScene(rng, c.goal) : false]));
        }, (seite) => kp(seite === "home" ? 14 : 15));
      }
    }
    kp(21);
  };
  // Offen nach 0x18E46: DFB-Pokal bei Gleichstand, Europapokal nur im Rückspiel mit 0x19208 = 30
  const offen = (s: (typeof spiele)[number]) => {
    if (s.cup === 0) return s.match.hg === s.match.ag;
    if (!legPlayed(g, s.cup)) return false;
    const leg = FIRST_LEG + 32 * (s.cup - 1) + s.idx;
    return tieBreak(p[leg], p[leg + 1], s.match.hg, s.match.ag, tag) === 30;
  };
  halbzeit(1, 45);
  halbzeit(46, 90);
  const verlaengert = spiele.filter(offen);
  if (verlaengert.length > 0) {
    for (const s of spiele) {
      s.match.marke = verlaengert.includes(s) ? 10 : 0;
      s.match.verlaengern();
    }
    halbzeit(91, 105);
    halbzeit(106, 120);
  }
  // Ergebnisbereich wie 0x18E46: +10 nach Verlängerung, +20 und die Elfmeter nach dem Schießen
  for (const s of spiele) {
    let h = s.match.hg;
    let a = s.match.ag;
    if (verlaengert.includes(s)) {
      h += 10;
      if (offen(s)) {
        const [ph, pa] = shootout(rng, beteiligt(s));
        h += 10 + ph;
        a += pa;
      }
    }
    p[CUP_RESULTS + 32 * s.cup + s.idx] = h & 0xff;
    p[CUP_RESULTS + 32 * s.cup + s.idx + 1] = a & 0xff;
  }
  afterCupDay(g, cups, tag, rng);
  kp(25);
  return undefined;
}

/**
 * Nachholtag (Kalendermarke 0x80): der Treiber spielt die fälligen Nachholspiele wie Ligaspiele
 * (Vorbereitung 0x1C632, Live-Schleife mit Ligabits 0). Zur Halbzeit und nach der 90. Minute zeigt
 * 0x5C1A die Seite "NACHHOLSPIELE" (Schalter 4cb3:060A) - mit ihr rechnet das Original die
 * Spielstärke aller Manager neu; nach der 90. davor Tabelle und Torschützen der KI-Vereine.
 */
function nachholtag(g: GameState, rng: Rng, kp: (punkt: number) => void): string | undefined {
  const managers = g.activeManagers();
  const managerOf = new Map(managers.map((m, i) => [m.clubIndex, i] as const));
  const k = dayIndex(g);
  const paare = replays(g)
    .filter((e) => e.dayIndex === k)
    .map((e) => fixtures(e.league, e.matchday)[e.match])
    .filter((x): x is [number, number] => x !== undefined);
  if (paare.some(([h, a]) => managerOf.has(h) || managerOf.has(a))) return "Nachholspiel mit Managerverein fehlt noch";
  kp(1);
  for (const _ of paare) kp(2);
  const spiele = paare.map(([home, away]) => ({ home, away, match: new LiveMatch(g.clubs.at(home).strengthMatrix, g.clubs.at(away).strengthMatrix, rng) }));
  const staerkeNeu = () => managers.forEach((_, mi) => matrixInVerein(g, mi, matchStrength(g, mi, rng)));
  for (let minute = 1; minute <= 90; minute++) {
    for (const s of spiele) {
      if (minute === 1 || minute === 46) kp(4);
      s.match.beginMinute();
    }
    for (const s of spiele) s.match.chances(undefined, (seite) => kp(seite === "home" ? 14 : 15));
    if (minute !== 45 && minute !== 90) continue;
    kp(21);
    if (minute === 45) staerkeNeu();
  }
  kp(22);
  for (const s of spiele) {
    const { hg, ag } = s.match;
    applyResult(g, s.home, s.away, hg, ag);
    bookHistory(g, s.home, s.away, hg, ag);
    bookBaseBonus(g, s.home, hg - ag, rng);
    bookBaseBonus(g, s.away, ag - hg, rng);
  }
  kp(23);
  for (const s of spiele) {
    creditAiGoals(g, s.home, s.match.hg, rng);
    creditAiGoals(g, s.away, s.match.ag, rng);
  }
  staerkeNeu();
  kp(25);
  return undefined;
}

/** Szenenwahl des Laders 0x1502C (nur die Würfel): Nummer, Elfmeter, seltene Jubelszene. */
function pickScene(rng: Rng, goal: boolean): boolean {
  rng(2, 43);
  const elfmeter = rng(0, goal ? 15 : 25) === 0;
  if (elfmeter) rng(2, 5);
  // seltene Jubelszene: ihre Nummer random(2, 2) - es gibt nur 2.TJ und 2.VJ
  else if (rng(0, 400) === 0) rng(2, 2);
  return elfmeter;

}
