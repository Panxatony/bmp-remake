/**
 * Live-Konferenz des Servers: alle Spiele eines Kalendertags laufen minutenweise im Takt
 * (LiveMatch aus dem Kern), Chancen der Managervereine werden als Torszenen angekündigt,
 * die Uhr hält während einer Szene, in der Halbzeit und auf Wunsch eines Managers
 * (Klick aufs Logo, wie 0x6414/0x1C4F5 im Original); in der Pause sind Auswechslungen
 * erlaubt (ein Torwart, zwei Feldspieler, 4238:5396). Nach der 90. Minute bucht der
 * Server den Tag mit den live gespielten Ergebnissen.
 */
import {
  attendance,
  pokalZuschlag,
  dfbFinale,
  FINALE_KULISSE,
  minuteIncidents,
  newIncidentState,
  isForfeit,
  type IncidentState,
  type Incident,
  LiveMatch,
  matrixFor,
  matchStrength,
  postponementCount,
  replays,
  fixtures,
  currentPairs,
  cupRoundOf,
  CUP_ROUND,
  legPlayed,
  orderList,
  seasonDay,
  shootout,
  tieBreak,
  FIRST_LEG,
  PLAYOFF_FIRST_LEG,
  type Elfmeter,
  type Nachspiel,
  LEG_FLAG,
  FLAG_LEAGUE,
  FLAG_CUP,
  FLAG_EUROPE,
  substitutionLimits,
  bookEvents,
  type GameState,
  type Rng,
  type MatchResult,
  type LiveChance,
  texte,
} from "../core/src/index.ts";

/** Standzeit der Ankündigung vor dem Anpfiff: 50 Ticks des Originals (18,2 Hz) */
export const ANNOUNCE_MS = 2750;

export interface LiveEntry {
  key: string;
  /** Nachholspiel eines früheren Spieltags: es steht auf einer eigenen Seite */
  nachhol?: boolean;
  kind: "league" | "cup" | "playoff";
  league?: number;
  /** Spieltag der Liga (1-basiert), beim Anpfiff festgehalten: danach zeigt nextMatchday weiter */
  spieltag?: number;
  cup?: number;
  /** Platz im Pokalbereich (Byteindex), für den Hin-/Rückspielentscheid */
  idx?: number;
  /** Europapokal und Relegation: heute läuft das Rückspiel */
  secondLeg?: boolean;
  home: number;
  away: number;
  match: LiveMatch;
  /**
   * Stand nach 90 Minuten, festgehalten wenn verlängert wird: die Buchung braucht ihn, weil
   * sie daran erkennt, dass das Spiel offen war, und die Markierung +10 setzt (GitLab #72).
   */
  ergebnis90?: { home: number; away: number };
  penalties?: [number, number];
  elfmeter?: Elfmeter[];
  managerHome?: number;
  managerAway?: number;
  /** Zuschauer des Heimspiels eines Managers, beim Start berechnet und bei der Buchung übernommen */
  attendance?: number;
  /** Torschützen der Managervereine, live gebucht ("23. Name") */
  scorers: { minute: number; side: "home" | "away"; name: string; goals?: number; assist?: string }[];
  /** Karten- und Verletzungszustand je Seite (nur Managervereine) */
  incidentHome?: IncidentState;
  incidentAway?: IncidentState;
  /** Manager, dessen Spiel vor dem Anpfiff 0:2 gewertet wurde */
  forfeit?: number;
}

export interface Scene {
  /** Dateiname in assets/tore/scenes.json, z.B. "10.T" */
  id: string;
  mirror: boolean;
  goal: boolean;
  minute: number;
  side: "home" | "away";
  key: string;
  club: number;
  manager: number;
  scorer?: string;
  /** Tore des Schützen nach diesem Treffer und der Vorlagengeber (0x05186 zeigt beides) */
  scorerGoals?: number;
  assist?: string;
  started: number;
  until: number;
}

/**
 * Elfmeterschießen auf eigener Tafel (0x6733): Überschrift, die beiden Vereine und darunter
 * Schuss für Schuss. Gezeigt wird nur mit Managerbeteiligung - dann aber allen Mitspielern,
 * so entschieden in GitLab #72.
 */
export interface Elfmetertafel {
  key: string;
  home: number;
  away: number;
  schuesse: Elfmeter[];
  /** Wie viele Schüsse schon auf der Tafel stehen */
  gezeigt: number;
  nextAt: number;
}

export interface LiveState {
  dayIndex: number;
  flag: number;
  entries: LiveEntry[];
  postponed: number[][];
  minute: number;
  paused: boolean;
  pausedBy?: string;
  /** Halbzeit und Schluss: wer die Seiten schon mit WEITER bestätigt hat */
  halfSeen?: string[];
  /** Schluss: der Tag ist gebucht, die Seiten laufen nur noch als Anzeige */
  booked?: boolean;
  scene?: Scene;
  sceneQueue: Scene[];
  holdUntil: number;
  nextMinuteAt: number;
  finished: boolean;
  tempoMs: number;
  /** Ankündigung vor dem ersten Anpfiff (0x31FA/0x32F2): "Ligaspiel", "DFB-Pokal" oder "Europapokal" */
  announce?: string;
  announceUntil?: number;
  /** Torszenen abspielen (Option des Originals) */
  scenesOn: boolean;
  /** Karten und Verletzungen dieser Konferenz in Reihenfolge (für Protokoll und Meldungen) */
  news: Incident[];
  /**
   * Verletzung, die die Konferenz gerade angehalten hat. Das Original öffnet dann den
   * Kaderbildschirm, damit man auswechseln kann.
   */
  verletzung?: { manager: number; name: string };
  subs: Record<number, { goalkeeper: number; field: number }>;
  /** Laufende Elfmetertafel und die, die danach noch kommen (GitLab #72) */
  elfmeter?: Elfmetertafel;
  elfmeterQueue: Elfmetertafel[];
}

export const SCENE_FRAME_MS = 70;
export const SCENE_HOLD_MS = 1800;
/** Kennung der Halbzeitpause in `pausedBy` */
export const HALFTIME = "HALBZEIT";
/** Kennung der Pause nach dem Schlusspfiff in `pausedBy` */
export const FULLTIME = "SCHLUSS";
export const HALFTIME_MS = 3000;
/** Takt der Elfmetertafel: ein Schuss, dann der nächste (GitLab #72) */
export const ELFMETER_MS = 1100;
/** Standzeit der fertigen Tafel, bevor die Konferenz weiterläuft */
export const ELFMETER_ENDE_MS = 3000;

/**
 * Auswahl der Szene wie im Lader 0x1502C: Nummer random(2, 43); Elfmeterszene bei
 * `random(0,15) = 0` (Tor) bzw. `random(0,25) = 0` (vorbei), also 1/16 bzw. 1/26; sonst mit
 * `random(0,400) = 0` die seltene Jubelszene. Der Lader liefert zurück, ob es ein Elfmeter
 * war - dann gibt es keine Vorlage (0x1BC9E). Bis GitLab #85 stand hier 1/15, 1/25 und 1/400.
 */
export function pickScene(rng: Rng, goal: boolean, available: Set<string>): { id: string; elfmeter: boolean } {
  const suffix = goal ? "T" : "V";
  let name = `${rng(2, 43)}.${suffix}`;
  const elfmeter = rng(0, goal ? 15 : 25) === 0;
  if (elfmeter) {
    const e = `${rng(2, 5)}.${suffix}E`;
    if (available.has(e)) name = e;
  } else if (rng(0, 400) === 0 && available.has(`2.${suffix}J`)) name = `2.${suffix}J`;
  return { id: available.has(name) ? name : `10.${suffix}`, elfmeter };
}

/** Auswechslungen eines Managers im Spiel (4238:90C6). */
export function wechselZahl(subs: LiveState["subs"] | undefined, manager: number): number {
  const u = subs?.[manager];
  return u ? u.goalkeeper + u.field : 0;
}

/**
 * `wechselVorher`: die Wechselzähler des vorigen Spiels. Das Original setzt 4238:90C6 erst nach
 * der Stärkerechnung vor dem Anpfiff zurück (0x1D838), die Anfangsstärke rechnet also noch mit
 * ihnen (0x0FEEF, ab Stufe-Byte < 4).
 */
export function startLive(g: GameState, rng: Rng, k: number, flag: number, tempoMs: number, wechselVorher?: LiveState["subs"]): LiveState {
  const managers = g.activeManagers();
  const managerOf = new Map<number, number>();
  managers.forEach((m, i) => managerOf.set(m.clubIndex, i));
  const entries: LiveEntry[] = [];
  const add = (kind: LiveEntry["kind"], home: number, away: number, extra: Partial<LiveEntry>) => {
    entries.push({ key: `${home}-${away}`, kind, home, away, match: new LiveMatch(matrixFor(g, home, rng, (m) => wechselZahl(wechselVorher, m)), matrixFor(g, away, rng, (m) => wechselZahl(wechselVorher, m)), rng, undefined, kind !== "league"), managerHome: managerOf.get(home), managerAway: managerOf.get(away), scorers: [], ...extra });
  };
  const postponed: number[][] = [[], [], []];
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    const pairs = g.pairings(league);
    const n = postponementCount(k, rng);
    while (postponed[league].length < n) {
      const m = rng(0, pairs.length - 1);
      if (!postponed[league].includes(m)) postponed[league].push(m);
    }
      pairs.forEach(([home, away], m) => {
      if (!postponed[league].includes(m)) add("league", home, away, { league, spieltag: g.nextMatchday(league) });
    });
  }
  // Nachholspiele dieses Tages (Kalendermarke 0x80): Paarung aus dem Spielplan des damaligen
  // Spieltags; sie laufen in derselben Konferenz, stehen aber auf einer eigenen Seite.
  for (const e of replays(g).filter((x) => x.dayIndex === k)) {
    const paar = fixtures(e.league, e.matchday)[e.match];
    if (paar) add("league", paar[0], paar[1], { league: e.league, nachhol: true, spieltag: e.matchday + 1 });
  }
  // Platz im Pokalbereich mitführen: die Konferenz braucht ihn nach der 90. Minute für den
  // Hin-/Rückspielentscheid, und die Buchung findet darüber dasselbe Paar wieder (GitLab #72).
  if (flag & 8) currentPairs(g, 0).forEach(([home, away], i) => add("cup", home, away, { cup: 0, idx: 2 * i }));
  if ((flag & 0x70) === 0x10) {
    const second = g.save.plain[LEG_FLAG] !== 0;
    const bl16 = orderList(g, 0)[15];
    const third = orderList(g, 1)[2];
    add("playoff", second ? bl16 : third, second ? third : bl16, { cup: 1, idx: 0, secondLeg: second });
  } else if (flag & 0x70) {
    for (const cup of [1, 2, 3]) {
      void cupRoundOf(g, cup);
      const second = legPlayed(g, cup);
      currentPairs(g, cup).forEach(([home, away], i) => add("cup", home, away, { cup, idx: 2 * i, secondLeg: second }));
    }
  }
  // Eingerichtet wird erst, wenn **alle** Spiele des Tages in der Liste stehen - auch Pokal und
  // Relegation, die oben erst danach dazukommen. Stand diese Schleife davor, gingen den
  // Pokalspielen die Zuschauerzahl, die Karten und Verletzungen und die 0:2-Wertung verloren:
  // im Heimspiel stand in der Tafel "(AUSW.)" (GitLab #74).
  for (const e of entries) {
    // Zuschauer auch für Pokalspiele: der Kern rechnet sie ohnehin (0x10BB0). Gebucht wird genau
    // diese Zahl (server.ts reicht sie weiter). Die Kapazität ist auch im Pokal das eigene
    // Stadion - die ausgewürfelte aus dem Ligaband gilt nur für Vereine des Rechners (#75).
    // Im DFB-Pokalfinale steht die Kulisse fest (0x1CB6B), auch gegen einen Verein des Rechners.
    // Im Pokal kommt beim Heimspiel gegen einen höherklassigen Gast der Zuschlag dazu (0x1C858).
    if (e.kind === "cup" && dfbFinale(g, e.cup ?? -1)) e.attendance = FINALE_KULISSE;
    else if (e.managerHome !== undefined) {
      const pokal = e.kind !== "league";
      const importance = !pokal ? undefined : e.cup === 0 ? 1 : g.save.plain[CUP_ROUND + 1] > 4 ? 3 : 2;
      const att = attendance(g, { manager: e.managerHome, home: e.home, away: e.away, importance, level: g.save.plain[34062] }, rng);
      e.attendance = pokal ? pokalZuschlag(g, e.managerHome, e.away, att, rng) : att;
    }
    // 0:2-Wertung bei weniger als acht einsatzfähigen Startern (0x0F9D2/0x1C5D1); geprüft wird in
    // Managerreihenfolge, der erste beendet die Buchung (0x1C632 kehrt sofort zurück)
    for (const mi of [e.managerHome, e.managerAway].filter((x) => x !== undefined).sort((a, b) => a - b)) {
      if (isForfeit(g, mi)) {
        e.forfeit = mi;
        break;
      }
    }
    if (e.forfeit !== undefined) {
      e.match.hg = e.forfeit === e.managerHome ? 0 : 2;
      e.match.ag = e.forfeit === e.managerHome ? 2 : 0;
      e.match.minute = 90;
    } else {
      if (e.managerHome !== undefined) e.incidentHome = newIncidentState();
      if (e.managerAway !== undefined) e.incidentAway = newIncidentState();
    }
  }
  const now = Date.now();
  // Vor dem Anpfiff zeigt das Original eine ganze Seite in Schwarz-Rot-Gold mit der Art des
  // Spieltags (0x1D866: erst die Ligen, dann der DFB-Pokal, dann Europa) und wartet 50 Ticks.
  const announce = flag & 7 ? "Ligaspiel" : flag & FLAG_CUP ? "DFB-Pokal" : flag & FLAG_EUROPE ? "Europapokal" : undefined;
  const halt = announce ? ANNOUNCE_MS : 1500;
  return { dayIndex: k, flag, entries, postponed, minute: 0, paused: false, sceneQueue: [], holdUntil: now + halt, nextMinuteAt: now + halt, finished: false, tempoMs, scenesOn: true, news: [], subs: {}, elfmeterQueue: [], announce, announceUntil: announce ? now + halt : undefined };
}

/** Ein Zeitschritt; true, wenn sich etwas geändert hat. */
export function tick(state: LiveState, g: GameState, rng: Rng, scenes: Set<string>): boolean {
  if (state.finished || state.paused) return false;
  const now = Date.now();
  if (state.scene) {
    if (now < state.scene.until) return false;
    state.scene = undefined;
    state.holdUntil = now + 400;
    return true;
  }
  if (state.sceneQueue.length) {
    const s = state.sceneQueue.shift()!;
    s.started = now;
    s.until = now + sceneDuration(s.id, scenes);
    state.scene = s;
    return true;
  }
  // Elfmetertafel: ein Schuss nach dem anderen, danach die nächste Tafel (GitLab #72)
  if (state.elfmeter) {
    const t = state.elfmeter;
    if (now < t.nextAt) return false;
    if (t.gezeigt < t.schuesse.length) {
      t.gezeigt++;
      t.nextAt = now + (t.gezeigt === t.schuesse.length ? ELFMETER_ENDE_MS : ELFMETER_MS);
      return true;
    }
    state.elfmeter = state.elfmeterQueue.shift();
    if (state.elfmeter) state.elfmeter.nextAt = now + ELFMETER_MS;
    else state.holdUntil = now + 600;
    return true;
  }
  if (now < state.holdUntil || now < state.nextMinuteAt) return false;
  // Die Spielminuten laufen im Original nur, wenn ein Mensch an diesem Tag selbst spielt;
  // sonst steht sofort der Halbzeit- und danach der Endstand da.
  const mitManager = state.entries.some((e) => e.managerHome !== undefined || e.managerAway !== undefined);
  const ziel = mitManager ? 0 : state.minute < 45 ? 45 : 90;
  let maxMinute = 0;
  let schritte = 0;
  do {
  for (const e of state.entries) {
    if (e.forfeit !== undefined) {
      maxMinute = Math.max(maxMinute, 90);
      continue;
    }
    const laeuft = e.match.beginMinute();
    maxMinute = Math.max(maxMinute, e.match.minute);
    if (!laeuft) continue;
    // Karten und Verletzungen je Minute (0x05FE5) vor den Chancen der Minute; danach Stärke neu
    // (0x0F9D2). Nach glatt Rot oder Verletzung werden die Chancen des Spiels neu ausgelost
    // (0x0657F) - einmal je Minute, für den letzten betroffenen Manager in Managerreihenfolge.
    let neuAuslosen: number | undefined;
    // Die Manager kommen wie in 0x05FE5 in ihrer Reihenfolge dran, nicht Heim vor Gast
    const seiten = ([[e.managerHome, e.incidentHome, "home"], [e.managerAway, e.incidentAway, "away"]] as const).slice().sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99));
    for (const [manager, st, side] of seiten) {
      if (manager === undefined || !st) continue;
      const fresh = minuteIncidents(g, manager, e.match.minute, st, rng);
      if (fresh.length === 0) continue;
      state.news.push(...fresh);
      if (fresh.some((i) => i.kind !== "yellow")) {
        if (side === "home") e.match.home = matchStrength(g, manager, rng, wechselZahl(state.subs, manager));
        else e.match.away = matchStrength(g, manager, rng, wechselZahl(state.subs, manager));
      }
      if (fresh.some((i) => i.kind === "red" || i.kind === "injury")) neuAuslosen = Math.max(neuAuslosen ?? -1, manager);
    }
    if (neuAuslosen !== undefined) e.match.neuAuslosen(neuAuslosen);
    for (const c of e.match.chances()) {
      // Buchung wie im Original in der Chancenminute (0x5FE5 -> 0x1B223): Schütze, Statistik,
      // Bewertung. Mit Torszenen spielt das Original die Szene **vor** der Buchung (0x1B7FE ->
      // 0x1502C): war es ein Elfmeter, zählt keine Vorlage (GitLab #85).
      const matchType = e.kind === "league" ? 0 : e.cup === 0 ? 1 : 2;
      const beteiligt = e.managerHome !== undefined || e.managerAway !== undefined;
      const szene = state.scenesOn && beteiligt ? pickScene(rng, c.goal, scenes) : undefined;
      const booked = bookEvents(g, e.home, e.away, { home: e.match.hg, away: e.match.ag, events: [{ minute: c.minute, side: c.side, goal: c.goal }] }, matchType, rng, [szene?.elfmeter ?? false]);
      e.scorers.push(...booked);
      if (szene) queueScene(state, e, c, szene.id, booked[0]);
    }
  }
    if (++schritte > 200) break;
  } while (ziel > 0 && maxMinute < ziel);
  state.minute = maxMinute;
  state.nextMinuteAt = now + state.tempoMs;
  // Halbzeit: das Original zeigt die Übersicht der Ligen und wartet auf WEITER
  if (state.minute === 45) {
    state.holdUntil = now + HALFTIME_MS;
    state.paused = true;
    state.pausedBy = HALFTIME;
    state.halfSeen = [];
  }
  if (state.entries.every((e) => e.match.finished)) {
    // Verlängerung (0x18E46) und Elfmeterschießen (0x666D) laufen im Original nur, wenn ein
    // Managerverein dabei ist - dann aber vor allen Augen (GitLab #72).
    const verlaengert = state.entries.filter((e) => e.ergebnis90 === undefined && nachspielNoetig(state, g, e));
    if (verlaengert.length) {
      for (const e of verlaengert) {
        e.ergebnis90 = { home: e.match.hg, away: e.match.ag };
        e.match.verlaengern();
      }
      // Kurz stehenbleiben, damit der Schlusspfiff zu sehen ist; danach läuft die Uhr weiter.
      // Eine Ankündigung gibt es nicht - das Original kennt dafür keinen Text.
      state.holdUntil = now + HALFTIME_MS;
      state.nextMinuteAt = now + HALFTIME_MS;
      return true;
    }
    const elfmeter = state.entries.filter((e) => e.ergebnis90 !== undefined && e.penalties === undefined && nachspielNoetig(state, g, e));
    if (elfmeter.length) {
      for (const e of elfmeter) {
        const schuesse: Elfmeter[] = [];
        e.penalties = shootout(rng, true, schuesse);
        e.elfmeter = schuesse;
        state.elfmeterQueue.push({ key: e.key, home: e.home, away: e.away, schuesse, gezeigt: 0, nextAt: now + ANNOUNCE_MS });
      }
      state.elfmeter = state.elfmeterQueue.shift();
      return true;
    }
    // Schluss: erst Übersicht und Tabelle je Liga, dann wird der Tag gebucht
    state.finished = true;
    state.holdUntil = now + 2500;
    state.paused = true;
    state.pausedBy = FULLTIME;
    state.halfSeen = [];
  }
  return true;
}

/**
 * Braucht dieses Spiel nach dem Abpfiff eine Entscheidung? Im DFB-Pokal bei Gleichstand, im
 * Europapokal und in der Relegation nur im Rückspiel, wenn auch die Auswärtstorregel nichts
 * hergibt (0x19208). Gezeigt wird das nur mit Managerbeteiligung; ohne sie rechnet die Buchung
 * es wie bisher im Stillen aus (GitLab #72).
 */
function nachspielNoetig(state: LiveState, g: GameState, e: LiveEntry): boolean {
  if (e.kind === "league" || e.forfeit !== undefined) return false;
  if (e.managerHome === undefined && e.managerAway === undefined) return false;
  if (e.cup === 0) return e.match.hg === e.match.ag;
  if (!e.secondLeg || e.idx === undefined) return false;
  const p = g.save.plain;
  // Die Relegation hält ihr Hinspiel an eigener Stelle (playPlayoffDay schreibt es erst um)
  const leg = e.kind === "playoff" ? PLAYOFF_FIRST_LEG : FIRST_LEG + 32 * (e.cup! - 1) + e.idx;
  return tieBreak(p[leg], p[leg + 1], e.match.hg, e.match.ag, seasonDay(state.dayIndex)) === 30;
}

function queueScene(state: LiveState, e: LiveEntry, c: LiveChance, id: string, tor?: { name: string; goals?: number; assist?: string }): void {
  const manager = c.side === "home" ? e.managerHome : e.managerAway;
  const opponentManager = c.side === "home" ? e.managerAway : e.managerHome;
  if (manager === undefined && opponentManager === undefined) return;
  const club = c.side === "home" ? e.home : e.away;
  state.sceneQueue.push({ id, mirror: c.side === "away", goal: c.goal, minute: c.minute, side: c.side, key: e.key, club, manager: manager ?? opponentManager!, scorer: tor?.name, scorerGoals: tor?.goals, assist: tor?.assist, started: 0, until: 0 });
}

const frameCounts = new Map<string, number>();
export function setSceneFrames(id: string, frames: number): void {
  frameCounts.set(id, frames);
}
function sceneDuration(id: string, scenes: Set<string>): number {
  const frames = frameCounts.get(id) ?? 50;
  return (scenes.has(id) ? frames * SCENE_FRAME_MS : 0) + SCENE_HOLD_MS;
}

function cardSummary(st?: IncidentState): { yellow: number; red: number; injured: number; players: number } | null {
  if (!st) return null;
  const yellow = st.incidents.filter((i) => i.kind === "yellow").length;
  const red = st.incidents.filter((i) => i.kind === "red" || i.kind === "yellowred").length;
  const injured = st.incidents.filter((i) => i.kind === "injury").length;
  return { yellow, red, injured, players: 11 - red - injured };
}

/** Karten/Verletzungen je Manager für die Tagesbuchung (schon im Kader gebucht). */
export function incidentsOf(state: LiveState, manager: number): Incident[] {
  return state.news.filter((i) => i.manager === manager);
}

export function forfeitsOf(state: LiveState): Set<number> {
  return new Set(state.entries.filter((e) => e.forfeit !== undefined).map((e) => e.forfeit!));
}

export function liveJson(state: LiveState, g: GameState) {
  const names = (c: number) => g.clubs.at(c).displayName;
  // Ein Tor gehört erst auf die Tafel, wenn seine Szene gelaufen ist. Der Server bucht es schon
  // in der Chancenminute; die Szene beginnt erst einen Zeitschritt später. Dazwischen würde die
  // Tafel den neuen Stand verraten, deshalb werden Tore mit wartender Szene hier abgezogen (die
  // gerade laufende Szene deckt der Client selbst ab: dort fällt der Stand mit dem letzten Bild).
  const wartend = (key: string, side: "home" | "away"): number =>
    state.paused ? 0 : state.sceneQueue.filter((s) => s.key === key && s.side === side && s.goal).length;
  return {
    minute: state.minute,
    paused: state.paused,
    announce: state.announce ?? null,
    announceLeft: state.announceUntil ? Math.max(0, state.announceUntil - Date.now()) : 0,
    pausedBy: state.pausedBy ?? null,
    halfSeen: state.halfSeen ?? null,
    finished: state.finished,
    scene: state.scene ? { ...state.scene, homeName: names(state.entries.find((e) => e.key === state.scene!.key)!.home), awayName: names(state.entries.find((e) => e.key === state.scene!.key)!.away), clubName: names(state.scene.club), now: Date.now() } : null,
    entries: state.entries.map((e) => ({ key: e.key, kind: e.kind, nachhol: e.nachhol ?? false, league: e.league ?? null, cup: e.cup ?? null, home: e.home, away: e.away, homeName: names(e.home), awayName: names(e.away), hg: e.match.hg - wartend(e.key, "home"), ag: e.match.ag - wartend(e.key, "away"), minute: e.match.minute, attendance: e.attendance ?? null, forfeit: e.forfeit ?? null, cards: { home: cardSummary(e.incidentHome), away: cardSummary(e.incidentAway) }, managerHome: e.managerHome ?? null, managerAway: e.managerAway ?? null, spieltag: e.spieltag ?? null, chances: e.match.events.map((ev) => [ev.minute, ev.side === "home" ? 0 : 1, ev.goal ? 1 : 0]), scorers: e.scorers })),
    subs: state.subs,
    verletzung: state.verletzung ?? null,
    // Elfmetertafel: nur die Schüsse, die schon gefallen sind - der Client soll den Ausgang
    // nicht vorher kennen (GitLab #72)
    elfmeter: state.elfmeter
      ? {
          home: state.elfmeter.home,
          away: state.elfmeter.away,
          homeName: names(state.elfmeter.home),
          awayName: names(state.elfmeter.away),
          schuesse: state.elfmeter.schuesse.slice(0, state.elfmeter.gezeigt).map((s) => ({ seite: s.seite, tor: s.tor, stand: s.stand })),
          fertig: state.elfmeter.gezeigt === state.elfmeter.schuesse.length,
        }
      : null,
    // Karten und Verletzungen der Managerspiele: der Client blendet die letzte Meldung unter der
    // Szene ein, gelb für Gelb, rot für Rot (im Original nachgesehen)
    news: state.news.map((i) => ({ minute: i.minute, manager: i.manager, name: i.name, kind: i.kind, count: i.count })),
  };
}

/** Ergebnisse für die Tagesbuchung; die Ereignisse sind schon live gebucht und bleiben deshalb leer. */
/** Live berechnete Zuschauerzahlen je Spiel für die Tagesbuchung. */
export function attendances(state: LiveState): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of state.entries) if (e.attendance !== undefined) out.set(e.key, e.attendance);
  return out;
}

/**
 * Ergebnisse für die Tagesbuchung. Wurde verlängert, steht hier der Stand nach 90 Minuten:
 * die Buchung erkennt daran, dass das Spiel offen war, setzt die Markierung +10 und holt sich
 * den Rest aus `nachspiele` (GitLab #72).
 */
export function results(state: LiveState): Map<string, MatchResult> {
  const out = new Map<string, MatchResult>();
  for (const e of state.entries) out.set(e.key, { home: e.ergebnis90?.home ?? e.match.hg, away: e.ergebnis90?.away ?? e.match.ag, events: [] });
  return out;
}

/** Verlängerung und Elfmeterschießen, die die Konferenz schon gezeigt hat (GitLab #72). */
export function nachspiele(state: LiveState): Map<string, Nachspiel> {
  const out = new Map<string, Nachspiel>();
  for (const e of state.entries) {
    if (e.ergebnis90 === undefined) continue;
    out.set(e.key, { verlaengerung: { home: e.match.hg, away: e.match.ag }, penalties: e.penalties, elfmeter: e.elfmeter });
  }
  return out;
}

/**
 * Torereignisse je Spiel für den Zeitungsbericht. Für die Buchung bleiben sie leer (sie sind
 * live schon gebucht), die Zeitung braucht sie aber, sonst steht dort "TORE: FEHLANZEIGE".
 */
export function matchEvents(state: LiveState): Map<string, { minute: number; side: "home" | "away"; goal: boolean }[]> {
  return new Map(state.entries.map((e) => [e.key, e.match.events.map((v) => ({ minute: v.minute, side: v.side, goal: v.goal }))]));
}

export function scorerLines(state: LiveState): Map<string, { minute: number; side: "home" | "away"; name: string }[]> {
  return new Map(state.entries.map((e) => [e.key, e.scorers]));
}

/**
 * Auswechslungen eines Managers prüfen (Nummern 1..11 = Spielfeld) und die Stärke des
 * Vereins im laufenden Spiel neu berechnen (Spielweg wie beim Verlassen des Kaderbildschirms).
 */
export function applySubstitutions(state: LiveState, g: GameState, manager: number, before: Uint8Array, rng: Rng): { ok: true } | { ok: false; error: string } {
  // Über die Kaderplätze selbst laufen, nicht über die verdichtete Liste: squadOf() lässt leere
  // Plätze weg, der Block davor hat sie noch - bei einer Lücke im Kader läge der Vergleich sonst
  // auf dem falschen Platz.
  const outs: number[] = [];
  const ins: number[] = [];
  const onField = (n: number) => n >= 1 && n <= 11;
  for (let slot = 0; slot < 25; slot++) {
    const l = g.lineups.at(manager * 25 + slot);
    if (l.isEmpty) continue;
    const was = before[slot * 52 + 10];
    const now = l.number;
    if (onField(was) && !onField(now)) outs.push(slot);
    if (!onField(was) && onField(now)) ins.push(slot);
  }
  if (outs.length !== ins.length) {
    // Nach einem Platzverweis spielt die Mannschaft zu zehnt weiter - dafür darf niemand
    // nachrücken. Die Meldung sagt das jetzt auch (GitLab #53).
    const rot = state.news.filter((i) => i.manager === manager && (i.kind === "red" || i.kind === "yellowred")).length;
    if (ins.length > outs.length && rot > 0) return { ok: false, error: "Ein Platzverweis l{~t sich nicht ersetzen" };
    return { ok: false, error: "Elf Spieler m}ssen auf dem Feld stehen" };
  }
  const used = (state.subs[manager] ??= { goalkeeper: 0, field: 0 });
  let gk = 0;
  let field = 0;
  for (const slot of outs) {
    const p = g.players.at(g.lineups.at(manager * 25 + slot).playerIndex);
    if (p.positionValue < 25) gk++;
    else field++;
  }
  // Grenzen nach Regelwerk: im Original ein Torwart und zwei Feldspieler, in der Version 2026
  // fünf Wechsel ohne Rücksicht auf die Position
  const grenze = substitutionLimits(g);
  if (
    used.goalkeeper + gk > grenze.goalkeeper ||
    used.field + field > grenze.field ||
    used.goalkeeper + used.field + gk + field > grenze.total
  )
    return { ok: false, error: texte("ui.keinwechsel").join(" ") };
  used.goalkeeper += gk;
  used.field += field;
  return { ok: true };
}

/**
 * Stärke eines Managervereins im laufenden Spiel neu berechnen. Das Original macht das beim
 * Verlassen des Kaderbildschirms (0x21190), also einmal nach allen Änderungen - und nicht nach
 * jedem Handgriff, sonst liesse sich der Zufallsanteil beliebig neu würfeln.
 */
export function refreshStrength(state: LiveState, g: GameState, manager: number, rng: Rng): void {
  const club = g.managers.at(manager).clubIndex;
  for (const e of state.entries) {
    if (e.home === club) e.match.home = matchStrength(g, manager, rng, wechselZahl(state.subs, manager));
    if (e.away === club) e.match.away = matchStrength(g, manager, rng, wechselZahl(state.subs, manager));
  }
}
