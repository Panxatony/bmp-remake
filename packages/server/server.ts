/**
 * Mehrspieler-Server: hält einen Spielstand im Speicher, vergibt Sitzplätze je Manager,
 * sammelt "fertig"-Meldungen und schaltet den Tag weiter, sobald alle Manager fertig sind.
 * Clients bekommen Änderungen per Server-Sent Events und laden dann den Spielstand neu.
 *
 * Anmeldung: Benutzer mit Passwort-Hash (scrypt) in users.json, Sitzung per Cookie
 * (bmp_session), Sitzplätze sind an den angemeldeten Benutzer gebunden. Der Server ist für
 * den Betrieb hinter einem Reverse Proxy ausgelegt (relative Pfade im Client, Secure-Cookie
 * bei X-Forwarded-Proto https, SSE ohne Pufferung).
 *
 *   node packages/server/server.ts [--load DATEI.MAN] [--port 8765] [--fresh]
 *   node packages/server/users.ts add NAME PASSWORT     (Benutzer anlegen, siehe users.ts)
 *   Umgebung: BMP_DIR (Ordner mit *.MAN), PORT, BMP_USERS (users.json), BMP_SESSIONS (sessions.json)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  SaveFile,
  GameState,
  toDosText,
  mulberryRng,
  playMatchday,
  postponementCount,
  scheduleReplays,
  replays,
  removeReplays,
  playReplays,
  fixtures,
  dailyTraining,
  medWeek,
  jugendMonat,
  jugendSaison,
  jugendAnlegen,
  jugendVorhanden,
  jugendLesen,
  jugendSchreiben,
  foerdern,
  jugendAufruecken,
  jugendAbwerben,
  jugendZaehlerLeeren,
  jugendPreis,
  JUGEND_NAMEN,
  baueSzene,
  alsFassung,
  pruefeBeschreibung,
  dopeMatchday,
  dopingCleanup,
  dopeStart,
  dopeStop,
  dopingRows,
  injuryKind,
  medSet,
  MED_LEVELS,
  trainingInput,
  injuries,
  dailyFinance,
  sponsorSubsidy,
  acceptSubsidy,
  christmasPresents,
  christmasLines,
  playCupDay,
  playEuropaDay,
  playPlayoffDay,
  newSeason,
  releaseExpiring,
  contractOffers,
  contractRefusalAnnouncements,
  acceptOffer,
  declineOffer,
  generateOffers,
  signShirt,
  ADV_OFFSET,
  signBoard,
  type ContractOffer,
  type CupMatch,
  type CupFinal,
  cupNames,
  cupView,
  calendarFlag,
  dayIndex,
  setDayIndex,
  seasonDay,
  dateOfSeasonDay,
  seasonStartYear,
  isSaturday,
  CALENDAR_DAYS,
  FLAG_LEAGUE,
  type Rng,
  type MatchResult,
  simulateMatch,
  parseMana,
  createGame,
  setTraining,
  trainingCamp,
  campCost,
  camps,
  CAMP_OPEN_START,
  advanceCampOpen,
  campCountdown,
  extendStadium,
  dailyConstruction,
  setTicketPrice,
  takeLoan,
  poachCheck,
  poach,
  loanRequestCheck,
  raiseSalary,
  POACH_COUNTER_MAX,
  checkDebt,
  isBlocked,
  setStakeLevel,
  stakeLevel,
  stakeOf,
  derbyStake,
  playDerby,
  bestBid,
  resolveAuction,
  sureBid,
  is2026,
  addToSquad,
  sortSquad,
  assignNumber,
  updatePositions,
  isAi,
  setAi,
  aiList,
  BANK,
  stadiumKinds,
  stadiumMessages,
  buildDays,
  buildWeeks,
  type TrainingSettings,
  type ManaData,
  type LiveBooking,
  driftClubs,
  driftInterest,
  autoLineupIfEnabled,
  standingsMessages,
  relegationMessage,
  isWinterBreakDay,
  winterBreakLines,
  bookChampion,
  bookCupTitle,
  composeZeitung,
  reportFromMatch,
  type Zeitung,
  highscoreEntry,
  insertHighscore,
  decodeHighscore,
  encodeHighscore,
  highscoreFile,
  type HighscoreEntry,
  setSystem,
  systemOf,
  backupSystem,
  SYSTEM_MANUAL,
  SYSTEM_NAMES,
  DAYS_IN_MONTH,
  marketEntries,
  listPlayer,
  takeBack,
  saleOffer,
  decideSale,
  buyOffer,
  cancelPurchase,
  completePurchase,
  completeLoan,
  refreshMarket,
  dailyTransfers,
  salaryDemand,
  contractCheck,
  rejectOffer,
  MAX_CONTRACT_YEARS,
  tooLongText,
  playerValue,
  MARKET_MANAGER,
  OFFER_MARKET,
  OFFER_SQUAD,
  type SaleOffer,
  text as T,
  texte,
} from "../core/src/index.ts";
import { ladeTexte } from "../core/src/data/texte-node.ts";
import { startLive, tick, liveJson, results as liveResults, attendances as liveAttendances, incidentsOf, forfeitsOf, scorerLines, matchEvents, applySubstitutions, refreshStrength, setSceneFrames, HALFTIME, FULLTIME, type LiveState } from "./live.ts";

const root = resolve(import.meta.dirname, "../..");
const web = resolve(root, "packages/web");
const savesDir = process.env.BMP_DIR ?? resolve(root, "../bmp");
const usersFile = process.env.BMP_USERS ?? join(savesDir, "users.json");

/** Highscore-Datei des Startjahrs lesen (0x34474: HIGH.00/01/02 im Spielstandordner). */
function loadHighscore(g: GameState): HighscoreEntry[] {
  const file = join(savesDir, highscoreFile(seasonStartYear(g)));
  if (!existsSync(file)) return [];
  try {
    return decodeHighscore(new Uint8Array(readFileSync(file)));
  } catch {
    return [];
  }
}
const sessionsFile = process.env.BMP_SESSIONS ?? join(savesDir, "sessions.json");
const args = process.argv.slice(2);
const argOf = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const port = Number(argOf("--port") ?? process.env.PORT ?? 8765);
/** Laufender Stand; wird nach jedem Tag geschrieben und beim Start bevorzugt geladen (--fresh übergeht ihn). */
const SERVER_SAVE = "SERVER.MAN";
/** Vorgabe der fünfzehn Schalter im Einstellungsbildschirm (im Original alles an, Blenden aus) */
const OPTION_DEFAULTS = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, false];
const OPTION_SCENES = 9;
const OPTION_ZEITUNG = 13;

const SQUAD_OFFSET = 21400;
const SQUAD_BYTES = 25 * 52;
const SESSION_COOKIE = "bmp_session";
const SESSION_DAYS = 30;
/** Sekunden je Spielminute in der Live-Konferenz (Tempo) */
const TEMPO_MS = Number(process.env.BMP_TEMPO_MS ?? 900);

// Textkatalog: die Texte des Originals stehen nicht im Repo, sondern werden beim Einrichten aus
// der eigenen Installation gezogen (tools/texte.py, siehe README).
if (!ladeTexte()) {
  console.error("assets/text/spiel.json fehlt. Bitte einmal 'npm run texte -- <Pfad>/BMMAIN.EXE' ausführen.");
  process.exit(1);
}

// Bilder, Klänge und Torszenen entstehen aus der eigenen Installation. Sind die Werkzeuge
// seither geändert worden, sind sie veraltet (tools/assets.mjs schreibt assets/stand.json).
try {
  const stand = JSON.parse(readFileSync(join(root, "assets", "stand.json"), "utf8")) as { werkzeuge?: number };
  const werkzeuge = readdirSync(join(root, "tools"))
    .filter((f) => f.endsWith(".py") || f.endsWith(".mjs"))
    .map((f) => statSync(join(root, "tools", f)).mtimeMs);
  if (stand.werkzeuge && Math.max(...werkzeuge) > stand.werkzeuge + 1000)
    console.warn("Achtung: assets/ ist älter als die Werkzeuge in tools/. Bitte 'npm run assets -- <Pfad>' neu laufen lassen.");
} catch {
  console.warn("Hinweis: assets/stand.json fehlt - erzeugt wurde assets/ vermutlich mit einer älteren Fassung der Werkzeuge ('npm run assets -- <Pfad>').");
}

/** Stammdaten für neue Spiele (MANA.DAT im Spielstandordner). */
let mana: ManaData | undefined;
try {
  mana = parseMana(new Uint8Array(readFileSync(join(savesDir, "MANA.DAT"))));
} catch {
  /* ohne MANA.DAT kein neues Spiel */
}

/** Torszenen aus assets/tore/scenes.json: Namen und Bildzahl für die Szenendauer. */
const sceneNames = new Set<string>();
try {
  const scenes = JSON.parse(readFileSync(join(root, "assets/tore/scenes.json"), "utf8")) as Record<string, { frames: unknown[] }>;
  for (const [name, sc] of Object.entries(scenes)) {
    sceneNames.add(name);
    setSceneFrames(name, sc.frames.length);
  }
} catch {
  /* ohne Szenen läuft die Konferenz ohne Animation */
}

// ---- Benutzer und Sitzungen ------------------------------------------------

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const parts = hash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const want = Buffer.from(parts[2], "hex");
  const got = scryptSync(password, parts[1], want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}

function loadUsers(): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const data = JSON.parse(readFileSync(usersFile, "utf8")) as { users?: { name: string; hash: string }[] };
    for (const u of data.users ?? []) if (u.name && u.hash) out.set(u.name, u.hash);
  } catch {
    /* keine Benutzerdatei: niemand kann sich anmelden */
  }
  return out;
}

interface Session {
  user: string;
  created: number;
}
const sessions = new Map<string, Session>();

function loadSessions(): void {
  try {
    const data = JSON.parse(readFileSync(sessionsFile, "utf8")) as Record<string, Session>;
    const limit = Date.now() - SESSION_DAYS * 86400000;
    for (const [token, s] of Object.entries(data)) if (s.user && s.created > limit) sessions.set(token, s);
  } catch {
    /* keine gespeicherten Sitzungen */
  }
}

function saveSessions(): void {
  try {
    writeFileSync(sessionsFile, JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 });
  } catch (err) {
    console.error("Sitzungen sichern fehlgeschlagen:", (err as Error).message);
  }
}

function cookieToken(req: IncomingMessage): string | undefined {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === SESSION_COOKIE && v) return decodeURIComponent(v);
  }
  return undefined;
}

function sessionUser(req: IncomingMessage): string | undefined {
  const token = cookieToken(req);
  if (!token) return undefined;
  const s = sessions.get(token);
  if (!s || s.created < Date.now() - SESSION_DAYS * 86400000) return undefined;
  return s.user;
}

function isHttps(req: IncomingMessage): boolean {
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  return proto === "https";
}

function setSessionCookie(req: IncomingMessage, res: ServerResponse, token: string | null): void {
  const base = token ? `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` : `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  res.setHeader("set-cookie", isHttps(req) ? base + "; Secure" : base);
}

/** Fehlversuche je Adresse: nach fünf Fehlern in zehn Minuten wird abgewiesen. */
const failures = new Map<string, number[]>();
function clientAddress(req: IncomingMessage): string {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "?";
}
function tooManyFailures(addr: string): boolean {
  const now = Date.now();
  const list = (failures.get(addr) ?? []).filter((t) => t > now - 600000);
  failures.set(addr, list);
  return list.length >= 5;
}

// ---- Spielraum -------------------------------------------------------------

interface Room {
  file: string;
  save: SaveFile;
  game: GameState;
  version: number;
  seats: Map<number, string>;
  done: Set<number>;
  log: string[];
  rng: Rng;
  /** Tagessummen des Kontostands je Manager (Guthabenzins über den Monatsdurchschnitt) */
  balanceSums: { sum: number }[];
  /** Während eines Tageswechsels gesammelte Meldungen */
  pending: { manager: number; text: string }[];
  /** Offene Vertragsangebote der Spieler (Laufzeitdaten wie im Original) */
  offers: ContractOffer[];
  /** Laufende Live-Konferenz */
  live?: LiveState;
  liveTimer?: NodeJS.Timeout;
  /**
   * Öffnungszeiten der acht Trainingslager (4cb3:0620). Wie im Original nur Laufzeitdaten: sie
   * stehen nicht im Spielstand und beginnen beim Start des Servers wieder bei den Vorgaben.
   */
  campOpen: number[];
  /** Merkbits der Tabellenmeldungen je Manager (4238:4BEC, nur im Speicher) */
  msgFlags: number[];
  /** Transfermarkt: offener Verkaufsdialog je Manager (Angebot beim Anklicken gewürfelt) */
  sales: Map<number, SaleOffer>;
  /** Transfermarkt: angenommener Kauf, Vertrag noch auszuhandeln */
  purchases: Map<number, { slot: number; playerIndex: number; name: string; amount: number; demands: number[] }>;
  /** Offene Sponsor-Zuschüsse nach einem Kauf (0x0272D) je Manager */
  subsidies: Map<number, number>;
  /** Transfermarkt: Angebote an andere Manager ("Nehmen Sie das Angebot ... an?") */
  marketOffers: { buyer: number; owner: number; slot: number; playerIndex: number; name: string; amount: number; loan: boolean }[];
  /**
   * Stadionausbau: wer ein Angebot ablehnt, bekommt am selben Tag keine Baufirma mehr für diese
   * Ausbauart (0x7E9 prüft einen Merker je Art). Schlüssel "Manager:Art".
   */
  bauAbgelehnt: Set<string>;
  /**
   * Stadionausbau: die Bauzeit würfelt das Original schon für die Rückfrage ("BAUZEIT: CIRKA
   * ... WOCHEN") und baut dann genau so lange. Hier steht sie in Tagen je "Manager:Art", bis
   * der Tag wechselt (GitLab #55).
   */
  bauTage: Map<string, number>;
  /** Optionen (Diskette-Untermenü): Spielgeschwindigkeit 1..9, Torszenen */
  options: { tempo: number; scenes: boolean; zeitung: boolean; flags: boolean[] };
  /** Sportzeitung des letzten Spieltags je Manager (0x2F243, Laufzeitdaten) */
  zeitung: Map<number, Zeitung>;
  /** Highscore aus HIGH.0x (0x34474) */
  highscore: HighscoreEntry[];
  /**
   * Bietgefecht (Version 2026): Gebote je **Spieler** (Spielernummer), ausgewertet zu Beginn des
   * Tageswechsels. Der Marktplatz taugt nicht als Schlüssel: er rückt bei jedem Abgang auf, und
   * eine Markterneuerung setzt einen ganz anderen Spieler darauf.
   */
  auctions: Map<number, { name: string; bids: { manager: number; amount: number; loan: boolean }[] }>;
  /** Frisch aus der Jugend aufgerückte Spieler; die anderen dürfen sie bis zum Tageswechsel abwerben (#4). */
  jugendFrisch: { manager: number; place: number; name: string; preis: number }[];
  /**
   * Kalendermeldungen des Hauptmenüs (0x143ED): das Original zeigt sie beim ersten Öffnen des
   * Hauptmenüs im Hinweiskasten mit OKAY (0x3174A), nicht in der Meldungsliste. Sie gelten für
   * den Tag, an dem sie entstanden sind, und stehen nicht im Spielstand (GitLab #31).
   */
  hinweise: { manager: number; zeilen: string[] }[];
  /**
   * Abschlussbild (0x1A36D): Vereinsname, "gewinnt die/den" und der Titel über der
   * Deutschlandfahne. Das Original zeigt es dem Manager, dessen Verein Meister wird oder ein
   * Endspiel gewinnt - Meldungen schreibt es dazu keine (GitLab #54).
   * kind 0 = Meisterschaft, 1..4 = DfB-Pokal, Landesmeister, Pokalsieger, UEFA-Pokal.
   */
  abschluss: { manager: number; kind: number; verein: string }[];
  /** Abwerbeversuche, über die der Besitzer noch entscheiden kann (Version 2026) */
  poachRequests: { poacher: number; owner: number; place: number; bonus: number; playerIndex: number; name: string }[];
  /** Kalendertag, an dem die ablösefreien Spieler entstanden sind (sie gelten erst am Tag darauf) */
  freeAgentsDay: number;
  /** Kreditanfragen an Mitspieler, über die der Geldgeber noch entscheidet (Version 2026) */
  loanRequests: { borrower: number; lender: number; amount: number }[];
  /**
   * Abgelaufene Verträge, über die noch verhandelt wird (0x0DB40 mit Dialog 0x251FF). Das
   * Original hält den Saisonwechsel dafür an und fragt Spieler für Spieler; im
   * Mehrspielerbetrieb bleibt der Spieler stattdessen mit 0 Vertragsjahren im Kader, und der
   * Manager verhandelt im ersten Zug der neuen Saison. Wer am Zugende noch in der Liste steht,
   * verlässt den Verein - im Original das "kein Angebot".
   */
  vertragsende: { manager: number; playerIndex: number; name: string }[];
  /** Ablösefreie Spieler nach dem Saisonwechsel mit den Angeboten (Version 2026) */
  freeAgents: { playerIndex: number; name: string; position: string; age: number; strength: number[]; from: number; salary: number; value: number; bids: { manager: number; salary: number }[] }[];
  /**
   * Abwerbeversuche des laufenden Spieltags (Version 2026): "Werber:Spieler". Jeder Spieler
   * lässt sich nur einmal am Tag ansprechen; am Tageswechsel ist die Liste wieder leer.
   * Laufzeitdaten des Servers wie die Vertragsangebote.
   */
  poachTried: Set<string>;
  /**
   * Auslosungszeremonie nach einem neuen Spiel (0x17C26). Ablauf: `ready`, sobald alle Manager
   * besetzt sind; dann stimmt jeder ab ("ABER KLAR" / "KEIN GEDANKE", `votes`). Haben alle
   * abgestimmt, startet sie ab `startedAt` bei allen gleichzeitig; wollte niemand zusehen, ist
   * `skipped` gesetzt und die Tafel steht sofort komplett da (wie "KEIN GEDANKE" im Original).
   * `seen` sind die Benutzer, die weggeklickt haben; ist niemand mehr offen, verschwindet sie.
   */
  ceremony?: {
    cup: number;
    /** "vote" Abfrage, "draw" Tafel mit Auslosung, "list" Spielübersicht */
    phase: "vote" | "draw" | "list";
    ready: boolean;
    votes: Record<string, boolean>;
    startedAt: number | null;
    skipped: boolean;
    seen: string[];
  };
  /** Protokollzeilen des zuletzt gespielten Tages (Ergebnisbildschirm) */
  lastDay: string[];
}

/** Spielgeschwindigkeit 1..9 in Millisekunden je Spielminute (Vorgabe aus BMP_TEMPO_MS). */
function tempoMs(tempo: number): number {
  return Math.max(150, 2000 - 180 * tempo);
}
function tempoOf(ms: number): number {
  return Math.max(1, Math.min(9, Math.round((2000 - ms) / 180)));
}

let room: Room | undefined;
const listeners = new Set<ServerResponse>();

const MONTHS = ["Januar", "Februar", "M{rz", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/**
 * Bietgefecht auswerten (Version 2026, sim/auktion.ts): je Marktplatz bekommt das höchste Gebot
 * den Zuschlag, sofern der abgebende Verein es annimmt. Der Vertrag wird dabei ohne Verhandlung
 * über zwei Jahre zur üblichen Forderung geschlossen - es ist eine Versteigerung, kein Gespräch.
 */
function resolveAuctions(r: Room): void {
  const g = r.game;
  if (r.auctions.size === 0) return;
  const offen = [...r.auctions.entries()].map(([playerIndex, a]) => ({ playerIndex, ...a }));
  r.auctions.clear();
  for (const a of offen) {
    const alle = a.bids.map((b) => b.manager);
    const eintrag = a.playerIndex ? marketEntries(g).find((e) => e.playerIndex === a.playerIndex) : undefined;
    if (!eintrag || eintrag.owner !== MARKET_MANAGER) {
      // Der Spieler ist weg (verkauft, zurückgeholt oder mit dem Markt erneuert): das darf nicht
      // stillschweigend geschehen, sonst wartet jemand vergeblich auf seinen Zuschlag.
      r.log.push(`Bietgefecht um ${a.name}: der Spieler ist nicht mehr auf dem Markt`);
      for (const m of alle) pushMessage(r, m, [a.name, "ist nicht mehr auf dem", "Markt - kein Zuschlag."]);
      continue;
    }
    const slot = eintrag.slot;
    const preis = g.lineups.at(100 + slot).i32(40);
    const res = resolveAuction(g, preis, a.bids, r.rng);
    if (!res.winner) {
      // Der Verein würfelt wie im Original (aiAccepts). Damit niemand im Dunkeln bietet, nennt
      // die Absage den Betrag, ab dem es sicher gereicht hätte (#19, lhunos Entscheidung).
      r.log.push(`Bietgefecht um ${eintrag.name}: kein Gebot reichte dem Verein (sicher ab ${dmText(sureBid(preis))})`);
      for (const b of a.bids) {
        const sicher = sureBid(b.loan ? Math.trunc(preis / 3) : preis);
        pushMessage(r, b.manager, [`Ihr Gebot f}r ${eintrag.name}`, "war zu niedrig.", `Sicher ab ${dmText(sicher)}.`]);
      }
      continue;
    }
    const w = res.winner;
    if (g.managers.at(w.manager).balance < w.amount) {
      r.log.push(`Bietgefecht um ${eintrag.name}: ${g.managers.at(w.manager).displayName} kann nicht zahlen`);
      pushMessage(r, w.manager, [texte("ui.zuwenig")[0], `${texte("ui.zuwenig")[1]} f}r ${eintrag.name}.`]);
      continue;
    }
    let frei = 0;
    while (frei < 24 && !g.lineups.at(w.manager * 25 + frei).isEmpty) frei++;
    if (frei >= 24) {
      pushMessage(r, w.manager, ["Ihr Kader ist voll:", `${eintrag.name} bleibt`, "auf dem Markt."]);
      continue;
    }
    let platz = -1;
    let gehalt = 0;
    if (w.loan) platz = completeLoan(g, w.manager, slot, w.amount, MARKET_MANAGER, r.rng);
    else {
      gehalt = salaryDemand(g, w.manager, frei, 2, { manager: MARKET_MANAGER, place: slot });
      platz = completePurchase(g, w.manager, slot, w.amount, 2, gehalt, r.rng);
    }
    if (platz < 0) {
      r.log.push(`Bietgefecht um ${eintrag.name}: der Wechsel kam nicht zustande`);
      continue;
    }
    autoLineupIfEnabled(g, w.manager);
    const name = g.managers.at(w.manager).displayName;
    r.log.push(`Bietgefecht um ${eintrag.name}: Zuschlag an ${name} für ${dmText(w.amount)}${w.loan ? " (Leihe)" : ` (2 Jahre, ${dmText(gehalt)})`}`);
    pushMessage(r, w.manager, ["Zuschlag:", `${eintrag.name} f}r`, dmText(w.amount)]);
    for (const m of alle) {
      if (m === w.manager) continue;
      pushMessage(r, m, [`${eintrag.name} ging`, `an ${name} f}r`, dmText(w.amount)]);
    }
  }
}

/** Unbeantwortete Abwerbeversuche entscheiden sich beim Tageswechsel ohne Gegenwehr. */
function resolvePoachRequests(r: Room): void {
  const offen = r.poachRequests;
  r.poachRequests = [];
  for (const q of offen) poachAusfuehren(r, q, 0);
}

/**
 * Ablösefreie Spieler vergeben (Version 2026, sim/abloesefrei.ts): das beste Angebot bekommt den
 * Spieler mit einem Zweijahresvertrag zum gebotenen Gehalt, alle anderen eine Absage. Wer keinen
 * Abnehmer findet, geht zu einem anderen Verein.
 */
function resolveFreeAgents(r: Room): void {
  const g = r.game;
  if (r.freeAgents.length === 0) return;
  // Am Tag ihrer Entstehung (Saisonwechsel) konnte noch niemand bieten
  if (dayIndex(g) === r.freeAgentsDay) return;
  const liste = r.freeAgents;
  r.freeAgents = [];
  for (const a of liste) {
    const best = bestBid(g, a.bids);
    if (!best) {
      r.log.push(`${a.name} findet keinen Verein und geht ins Ausland`);
      continue;
    }
    const platz = addToSquad(g, best.manager, a.playerIndex, 2, r.rng);
    if (platz < 0) {
      pushMessage(r, best.manager, ["Ihr Kader ist voll:", `${a.name} geht`, "woanders hin."]);
      continue;
    }
    const idx = best.manager * 25 + platz;
    const off = 21400 + idx * 52 + 40;
    for (let i = 0; i < 4; i++) g.save.plain[off + i] = (best.salary >>> (8 * i)) & 0xff;
    assignNumber(g, best.manager, platz);
    autoLineupIfEnabled(g, best.manager);
    const name = g.managers.at(best.manager).displayName;
    r.log.push(`Abl|sefrei: ${a.name} unterschreibt bei ${name} (2 Jahre, ${dmText(best.salary)})`.replace("Abl|sefrei", "Ablösefrei"));
    pushMessage(r, best.manager, [`${a.name} unterschreibt`, "bei Ihnen: 2 Jahre,", dmText(best.salary)]);
    for (const b of a.bids) {
      if (b.manager === best.manager) continue;
      pushMessage(r, b.manager, [`${a.name} geht`, `zu ${name}.`]);
    }
  }
}

/**
 * Abwerbung ausführen und alle Beteiligten benachrichtigen (Version 2026, sim/abwerben.ts).
 * `counter` ist die Gehaltserhöhung, mit der sich der Besitzer gewehrt hat.
 */
function poachAusfuehren(
  r: Room,
  q: { poacher: number; owner: number; place: number; bonus: number; playerIndex: number; name: string },
  counter: number,
): { agreed: boolean; amount: number; chance: number } | null {
  const g = r.game;
  const l = g.lineups.at(q.owner * 25 + q.place);
  if (l.isEmpty || l.playerIndex !== q.playerIndex) {
    r.log.push(`${q.name} ist nicht mehr da - die Abwerbung entfällt`);
    return null;
  }
  const res = poach(g, q.poacher, q.owner, q.place, q.bonus, r.rng, counter);
  if (!res.ok) {
    r.log.push(`Abwerbung von ${q.name}: ${res.error}`);
    return null;
  }
  const werber = g.managers.at(q.poacher).displayName;
  const besitzer = g.managers.at(q.owner).displayName;
  if (res.agreed) {
    r.log.push(`${werber} wirbt ${q.name} von ${besitzer} ab (${dmText(res.amount)}, Zustimmung ${res.chance} %)`);
    pushMessage(r, q.poacher, [`${q.name} wechselt`, `zu Ihnen. Abl|se:`, dmText(res.amount)]);
    pushMessage(r, q.owner, [`${q.name} verl{~t Sie`, `Richtung ${g.clubs.at(g.managers.at(q.poacher).clubIndex).displayName}.`, `${texte("ui.abloese")[1]} ${dmText(res.amount)}`]);
  } else {
    r.log.push(`${werber} wirbt vergeblich um ${q.name} (${besitzer}, Zustimmung ${res.chance} %)`);
    pushMessage(r, q.poacher, [`${q.name} bleibt bei`, besitzer + ".", "Er hat abgelehnt."]);
    pushMessage(r, q.owner, [`${werber} wollte Ihnen`, `${q.name} abwerben.`, "Er ist geblieben."]);
  }
  flushMessages(r);
  return { agreed: res.agreed, amount: res.amount, chance: res.chance };
}

/** Geldbetrag wie im Spiel schreiben: Tausenderpunkte und "DM". */
function dmText(v: number): string {
  return `${Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} DM`;
}

/** Meldung wie im Original vormerken: "Tag. Monat Jahr^Zeile^..."; wird am Ende des Tageswechsels angehängt. */
function pushMessage(r: Room, manager: number, lines: string[], date?: { day: number; month0: number; year: number }): void {
  const d = date ?? { day: r.game.date.day, month0: r.game.date.month - 1, year: r.game.date.year };
  const text = [`${d.day}. ${MONTHS[d.month0]} ${d.year}`, ...lines.map((l) => toDosText(l))].join("^");
  r.pending.push({ manager, text });
}

/** Vorgemerkte Meldungen in den Spielstand schreiben (neuer Puffer, GameState neu aufbauen). */
function flushMessages(r: Room): void {
  if (r.pending.length === 0) return;
  r.save = r.save.withMessages([...r.save.messages(), ...r.pending]);
  r.game = new GameState(r.save);
  r.pending = [];
}

/** Langen Text in Zeilen von höchstens 24 Zeichen brechen. */
function wrap(text: string, width = 24): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > width && line) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function broadcast(): void {
  if (!room) return;
  const data = `data: ${JSON.stringify({ version: room.version, build: buildStamp(), live: room.live ? liveJson(room.live, room.game) : null })}\n\n`;
  for (const res of listeners) res.write(data);
  schedulePersist();
}

/**
 * Zwischenspeichern: der Stand wandert einige Sekunden nach der letzten Änderung nach
 * SERVER.MAN, nicht erst beim Tageswechsel. Sonst wäre alles verloren, was seit dem letzten
 * Tageswechsel passiert ist, wenn der Dienst neu startet.
 */
let persistTimer: NodeJS.Timeout | undefined;
function schedulePersist(): void {
  if (persistTimer || !room) return;
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    if (room) void persist(room);
  }, 3000);
  persistTimer.unref?.();
}

/** Alle Manager sind fertig: der Tag läuft. Die Hinweise des Zuges sind damit vorbei (#31). */
/** Kaderplatz eines Spielers; -1, wenn er nicht mehr im Kader steht (der Kader schiebt auf). */
function platzVon(g: GameState, manager: number, playerIndex: number): number {
  for (let place = 0; place < 25; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (!l.isEmpty && l.playerIndex === playerIndex) return place;
  }
  return -1;
}

/** Einen Spieler mit abgelaufenem Vertrag ziehen lassen, mit Kasten und Eintrag im Verlauf. */
function vertragsendeFreigeben(r: Room, manager: number, playerIndex: number): void {
  const place = platzVon(r.game, manager, playerIndex);
  r.vertragsende = r.vertragsende.filter((v) => !(v.manager === manager && v.playerIndex === playerIndex));
  if (place < 0) return;
  const erg = releaseExpiring(r.game, manager, place);
  r.log.push(`${r.game.managers.at(manager).displayName}: ${erg.text}`);
  if (!isAi(r.game, manager)) r.hinweise.push({ manager, zeilen: wrap(erg.text).map((z) => toDosText(z)) });
  if (erg.free) {
    r.freeAgents.push({ ...erg.free, bids: [] });
    r.freeAgentsDay = dayIndex(r.game);
  }
}

/**
 * Offene Vertragsverhandlungen eines Managers beenden (0x0DB40 nach "kein Angebot"): die
 * Spieler verlassen den Verein, der Kasten nennt Ablöse bzw. die Ablösefreiheit.
 */
function vertragsendeAufloesen(r: Room, manager: number): void {
  const offen = r.vertragsende.filter((v) => v.manager === manager);
  if (offen.length === 0) return;
  for (const v of offen) vertragsendeFreigeben(r, manager, v.playerIndex);
  r.version++;
}

function zugBeenden(r: Room): void {
  r.hinweise = [];
  startLiveDay(r);
}

/**
 * Nach einem gebuchten Tag: bekommen die Manager am neuen Tag einen Zug?
 *
 * Im Original nicht an Tagen ohne Spiele. Der Tagesablauf liest das Kalenderbyte des neuen Tages
 * (0x1D73C; 9 zählt wie 0, 0x1D744) und springt bei 0 an den Zügen vorbei zur Weiterrechnung
 * (0x1D782 -> 0x1D917): Finanzen, Training, nächster Tag. Das gilt bis Saisontag 322, danach
 * kommt die Schlussrunde der Saison mit Zügen (0x1DC52). Die Winterpause vom 6.12. bis 17.2.
 * läuft so in einem Tageswechsel durch, ebenso jeder einzelne spielfreie Tag zwischen zwei
 * Spieltagen (GitLab #32; am Original gemessen: vom 2.12. ein Wechsel bis zum 21.2.).
 *
 * Beginnt ein Zug, würfelt das Original vor jedem Manager die Markterneuerung (0x1E0E9:
 * Zufall(0, Manager + 3) = 0 -> 0x245A8) - nur an Tagen mit Zug (GitLab #33).
 */
function nachTageswechsel(r: Room): void {
  const g = r.game;
  const k = dayIndex(g);
  const flag = calendarFlag(g, k);
  if ((flag === 0 || flag === 9) && seasonDay(k) <= 322 && !r.ceremony) {
    const bisher = r.lastDay;
    startLiveDay(r);
    // Die Ergebnisübersicht zeigt den ganzen Wechsel, nicht nur den letzten Tag
    r.lastDay = [...bisher, ...r.lastDay];
    return;
  }
  if (seasonDay(k) > 322) return;
  const n = g.activeManagers().length;
  const dt = dateOfSeasonDay(seasonDay(k), seasonStartYear(g));
  for (let i = 0; i < n; i++) {
    if (r.rng(0, n + 3) !== 0) continue;
    refreshMarket(g, r.rng);
    r.log.push(`${dt.day}.${dt.month0 + 1}. Transfermarkt erneuert: ${marketEntries(g).filter((e) => e.owner === MARKET_MANAGER).map((e) => e.name).join(", ") || "leer"}`);
  }
}

/** Live-Konferenz starten; ohne Spiele an diesem Tag wird der Tag sofort gebucht. */
function startLiveDay(r: Room): void {
  const k = dayIndex(r.game);
  const flag = calendarFlag(r.game, k);
  const st = startLive(r.game, r.rng, k, flag, tempoMs(r.options.tempo));
  st.scenesOn = r.options.scenes;
  if (st.entries.length === 0) {
    advanceDay(r, { results: new Map(), postponed: st.postponed });
    nachTageswechsel(r);
    return;
  }
  r.live = st;
  r.log.push(`Live-Konferenz: ${st.entries.length} Spiele`);
  r.liveTimer = setInterval(() => {
    if (!r.live) return;
    const vorher = r.live.news.length;
    const changed = tick(r.live, r.game, r.rng, sceneNames);
    // Verletzt sich ein Spieler eines Managers, hält das Original die Konferenz an und öffnet
    // den Kaderbildschirm - dort kann man auswechseln (GitLab #16).
    for (const n of r.live.news.slice(vorher)) {
      if (n.kind !== "injury") continue;
      const platz = r.seats.get(n.manager);
      if (!platz || r.live.paused) continue;
      r.live.paused = true;
      r.live.pausedBy = platz;
      r.live.verletzung = { manager: n.manager, name: n.name };
      r.log.push(`  ${n.minute}. ${n.name} verletzt - Konferenz angehalten`);
    }
    // Schlusspfiff: der Tag wird sofort gebucht, damit Tabellen und Zeitungen schon den neuen
    // Stand zeigen; die Konferenz bleibt danach nur noch als Anzeige stehen, bis alle
    // Mitspieler die Seiten mit WEITER bestätigt haben.
    if (r.live.finished && !r.live.booked) {
      clearInterval(r.liveTimer);
      const st2 = r.live;
      st2.booked = true;
      advanceDay(r, { results: liveResults(st2), postponed: st2.postponed, scorers: scorerLines(st2), events: matchEvents(st2), attendance: liveAttendances(st2), booking: { forfeit: (m) => forfeitsOf(st2).has(m), incidents: (m) => incidentsOf(st2, m) } });
      nachTageswechsel(r);
      // Hat schon jeder bestätigt, verschwindet die Anzeige sofort
      if (!st2.paused) r.live = undefined;
      broadcast();
      return;
    }
    if (changed) broadcast();
  }, 200);
  broadcast();
}

/**
 * Reparatur beim Laden: Kader, in die ein Spieler unsortiert geraten ist, wieder nach
 * Mannschaftsteilen ordnen (bis 18.9.2026 hängte `takeBack` einen Spieler vom Transfermarkt
 * hinten an, statt ihn einzusortieren).
 */
function repariereKader(game: GameState): void {
  game.activeManagers().forEach((_, i) => {
    if (sortSquad(game, i)) console.log(`Kader von ${game.managers.at(i).displayName} neu sortiert`);
  });
}

function roomFromSave(file: string, save: SaveFile): Room {
  const game = new GameState(save);
  repariereKader(game);
  const r: Room = { file, save, game, version: 1, seats: new Map(), done: new Set(), log: [], rng: mulberryRng(Date.now() >>> 0), balanceSums: game.activeManagers().map(() => ({ sum: 0 })), pending: [], offers: [], campOpen: CAMP_OPEN_START.slice(), msgFlags: [], sales: new Map(), purchases: new Map(), subsidies: new Map(), marketOffers: [], options: { tempo: tempoOf(TEMPO_MS), scenes: true, zeitung: true, flags: OPTION_DEFAULTS.slice() }, zeitung: new Map(), highscore: loadHighscore(game), lastDay: [], poachTried: new Set(), bauAbgelehnt: new Set(), bauTage: new Map(), auctions: new Map(), jugendFrisch: [], hinweise: [], abschluss: [], poachRequests: [], loanRequests: [], freeAgents: [], freeAgentsDay: -1, vertragsende: [] };
  return r;
}

async function loadRoom(file: string): Promise<Room> {
  const data = new Uint8Array(await readFile(join(savesDir, file)));
  const save = SaveFile.decode(data);
  const game = new GameState(save);
  repariereKader(game);
  const r: Room = { file, save, game, version: 1, seats: new Map(), done: new Set(), log: [], rng: mulberryRng(Date.now() >>> 0), balanceSums: game.activeManagers().map(() => ({ sum: 0 })), pending: [], offers: [], campOpen: CAMP_OPEN_START.slice(), msgFlags: [], sales: new Map(), purchases: new Map(), subsidies: new Map(), marketOffers: [], options: { tempo: tempoOf(TEMPO_MS), scenes: true, zeitung: true, flags: OPTION_DEFAULTS.slice() }, zeitung: new Map(), highscore: loadHighscore(game), lastDay: [], poachTried: new Set(), bauAbgelehnt: new Set(), bauTage: new Map(), auctions: new Map(), jugendFrisch: [], hinweise: [], abschluss: [], poachRequests: [], loanRequests: [], freeAgents: [], freeAgentsDay: -1, vertragsende: [] };
  r.log.push(`Spielstand ${file} geladen`);
  repairMarketPrices(r);
  // Vom Rechner geführte Manager warten auf nichts. Ohne das hier bliebe der Tag nach dem Laden
  // eines Spielstands mit KI-Managern für immer stehen (beim Bildvergleich für #56 aufgefallen).
  for (const i of aiList(r.game)) r.done.add(i);
  return r;
}

function managerInfo(r: Room) {
  return r.game.activeManagers().map((m, i) => ({
    index: i,
    name: m.displayName,
    club: r.game.clubs.at(m.clubIndex).displayName,
    clubIndex: m.clubIndex,
    seat: r.seats.get(i) ?? null,
    done: r.done.has(i),
    ki: isAi(r.game, i),
  }));
}

/** Ältere Spielstände des Remakes trugen auf dem Markt die Gehaltsbasis statt des Preises. */
function repairMarketPrices(r: Room): void {
  let n = 0;
  for (const e of marketEntries(r.game)) {
    if (e.owner !== MARKET_MANAGER || (e.price >= 30000 && e.price % 1000 === 0)) continue;
    const l = r.game.lineups.at(100 + e.slot);
    const v = playerValue(r.game, MARKET_MANAGER, e.slot, 4, r.rng);
    for (let k = 0; k < 4; k++) l.setU8(40 + k, (v >>> (8 * k)) & 0xff);
    n++;
  }
  if (n) r.log.push(`Transfermarkt: ${n} Preise neu berechnet`);
}

/** Nächster Wettbewerb der Zeremonie: nach dem DFB-Pokal die drei Europapokale, soweit ausgelost. */
function nextCeremonyCup(g: GameState, cup: number): number | null {
  for (let c = cup + 1; c < 4; c++) if (cupView(g, c).pairs.length > 0) return c;
  return null;
}

/**
 * Zum nächsten Wettbewerb weiterschalten. Das Original ruft die Zeremonie 0x17C26 für jeden
 * Wettbewerb einzeln auf (0x09448: erst der DFB-Pokal, dann die drei Europapokale) und fragt
 * dort jedes Mal neu. "KEIN GEDANKE" überspringt deshalb nur diesen einen Wettbewerb samt
 * seiner Übersichtsseite (0x17DBF setzt 0x57C8 auf 0, 0x18A71 lässt die Übersicht dann aus).
 */
function advanceCeremony(r: Room, fromCup: number): void {
  const next = nextCeremonyCup(r.game, fromCup);
  if (next === null) {
    r.ceremony = undefined;
    r.log.push("Auslosung: fertig");
    return;
  }
  r.ceremony = { cup: next, phase: "vote", ready: true, votes: {}, startedAt: null, skipped: false, seen: [] };
  r.log.push(`Auslosung: Abfrage für ${cupNames()[next]}`);
}

function listedCountOf(r: Room, manager: number): number {
  return marketEntries(r.game).filter((e) => e.owner === manager).length;
}

/** Stand des Client-Programms (Änderungszeit von dist/app.js); der Client lädt die Seite neu, wenn er sich ändert. */
function buildStamp(): number {
  try {
    return Math.floor(statSync(join(web, "dist/app.js")).mtimeMs / 1000);
  } catch {
    return 0;
  }
}

function stateJson(r: Room, user: string) {
  const k = dayIndex(r.game);
  const dt = dateOfSeasonDay(seasonDay(k), seasonStartYear(r.game));
  return {
    version: r.version,
    build: buildStamp(),
    user,
    file: r.file,
    dayIndex: k,
    flag: calendarFlag(r.game, k),
    saturday: isSaturday(k),
    date: dt,
    managers: managerInfo(r),
    offers: r.offers,
    options: r.options,
    campOpen: r.campOpen,
    lastDay: r.lastDay,
    zeitung: [...r.zeitung.entries()].map(([manager, z]) => ({ manager, ...z })),
    highscore: r.highscore,
    // Tagessummen der Kontostände (4cb3:0644): der Statistikbildschirm braucht sie für den
    // Guthabenzins in der Monatsvorschau
    kontosummen: r.balanceSums.map((b) => b.sum),
    ceremony: r.ceremony ?? null,
    market: {
      entries: marketEntries(r.game),
      listed: r.game.activeManagers().map((_, i) => listedCountOf(r, i)),
      sales: [...r.sales.values()],
      purchases: [...r.purchases.entries()].map(([manager, pu]) => ({ manager, ...pu })),
      subsidies: [...r.subsidies.entries()].map(([manager, amount]) => ({ manager, amount })),
      offers: r.marketOffers,
      // Bietgefecht (Version 2026): verdeckt - jeder sieht nur sein eigenes Gebot und wie viele
      // Gebote insgesamt vorliegen
      auctions: [...r.auctions.entries()].flatMap(([playerIndex, a]) => {
        const platz = marketEntries(r.game).find((e) => e.playerIndex === playerIndex);
        if (!platz) return [];
        const ich = r.game.activeManagers().findIndex((_, i) => r.seats.get(i) === user);
        const mein = a.bids.find((b2) => b2.manager === ich);
        return [{ slot: platz.slot, anzahl: a.bids.length, mein: mein ? mein.amount : null, loan: mein ? mein.loan : false }];
      }),
    },
    // Zusätze der Version 2026
    extra: {
      blocked: r.game.activeManagers().map((_, i) => isBlocked(r.game, i)),
      bauAbgelehnt: [...r.bauAbgelehnt],
      derby: r.game.activeManagers().map((_, i) => stakeLevel(r.game, i)),
      poachRequests: r.poachRequests,
      loanRequests: r.loanRequests,
      freeAgents: r.freeAgents,
      jugendFrisch: r.jugendFrisch,
    },
    vertragsende: r.vertragsende.map((v) => ({ manager: v.manager, place: platzVon(r.game, v.manager, v.playerIndex), name: v.name })),
    hinweise: r.hinweise,
    abschluss: r.abschluss,
    log: r.log.slice(-120),
    live: r.live ? liveJson(r.live, r.game) : null,
    data: Buffer.from(r.save.encode()).toString("base64"),
  };
}

function resultText(m: CupMatch): string {
  return `${m.result.home}:${m.result.away}${m.penalties ? ` n.E. ${m.penalties[0]}:${m.penalties[1]}` : m.extraTime ? " n.V." : ""}`;
}

/** Pokalspiele ins Protokoll und als Meldung an beteiligte Manager. */
function logCupMatches(r: Room, title: string, matches: CupMatch[], finals: CupFinal[], liveScorers?: Map<string, { minute: number; side: "home" | "away"; name: string }[]>): void {
  const g = r.game;
  const names = (c: number) => g.clubs.at(c).displayName;
  r.log.push(`${title}, ${matches.length} Spiele`);
  for (const p of matches) {
    const leg = p.leg === 1 ? " (Hinspiel)" : p.leg === 2 ? " (R}ckspiel)" : "";
    r.log.push(`  ${cupNames()[p.cup]}: ${names(p.home)} - ${names(p.away)} ${resultText(p)}${leg}${p.attendance ? ` (${p.attendance} Zuschauer, ${p.gate} DM)` : ""}`);
    for (const sc of (liveScorers?.get(p.home + "-" + p.away) ?? p.scorers)) r.log.push(`    ${sc.minute}. ${sc.name} (${names(sc.side === "home" ? p.home : p.away)})`);
  }
  // Das Original schreibt über Pokalspiele keine Meldung (die Meldungsroutine 0x30AA0 hat sieben
  // Aufrufstellen, keine davon im Pokal; von lhuno bestätigt, GitLab #41). Das Ergebnis steht in
  // der Konferenz, im Spielplan und im Verlauf.
  void names;
  for (const f of finals) {
    r.log.push(`  ${names(f.winner)} ${T("quell.server", 7)} ${cupNames()[f.cup]} gegen ${names(f.loser)}`);
    // Titel (Byte 58 + Pokal) und Abschlussbild (0x1A36D) für den Sieger, falls ein Manager
    // dahintersteht. Das Original schreibt dazu keine Meldung - das Bild ist die Meldung.
    if (bookCupTitle(r.game, f.cup, f.winner) >= 0) {
      g.activeManagers().forEach((m, i) => {
        if (m.clubIndex === f.winner) r.abschluss.push({ manager: i, kind: f.cup + 1, verein: g.clubs.at(f.winner).displayName });
      });
    }
  }
}

/** Spielt die Ereignisse des aktuellen Kalendertags und schaltet auf den nächsten; mit live gespielten Ergebnissen, wenn vorhanden. */
function advanceDay(r: Room, live?: { results: Map<string, MatchResult>; postponed: number[][]; scorers?: Map<string, { minute: number; side: "home" | "away"; name: string }[]>; events?: Map<string, { minute: number; side: "home" | "away"; goal: boolean }[]>; attendance?: Map<string, number>; booking?: LiveBooking }): void {
  const g = r.game;
  const k = dayIndex(g);
  const flag = calendarFlag(g, k);
  const logStart = r.log.length;
  // Tagesbeginn des Originals (0x1D77C): die Vereinsmatrix aller Vereine schwankt an **jedem**
  // Kalendertag, nicht erst am Monatsende - der Aufruf steht dort ohne Bedingung hinter der
  // täglichen Finanzroutine, in der die Monatsabrechnung nur ein Teil ist (GitLab #35).
  driftClubs(g, 1, r.rng);
  // Abwerbeversuche gelten je Spieltag (Version 2026)
  r.poachTried.clear();
  // Das Bietgefecht lief bis zum Tageswechsel: es wird als Erstes entschieden, noch vor der
  // Markterneuerung und den Transfers der KI-Vereine - sonst ist der umkämpfte Spieler weg,
  // bevor jemand den Zuschlag bekommt.
  resolveAuctions(r);
  const sim = (home: number, away: number, hs: Parameters<typeof simulateMatch>[0], as: Parameters<typeof simulateMatch>[1], rng: Rng) => live?.results.get(`${home}-${away}`) ?? simulateMatch(hs, as, rng);
  const names = (c: number) => g.clubs.at(c).displayName;
  // Einsätze vor dem Tag: daran erkennt die Dopingprüfung, wer gespielt hat (#3)
  const einsaetzeVorher = g.activeManagers().map((_, i) => g.squadOf(i).map((l) => l.leagueApps + l.cupApps));
  // Die Sportzeitung gehört zum Spieltag, an dem sie entstanden ist: sie wird an jedem Spieltag
  // geleert - auch an Pokal- und Europapokaltagen, sonst stünde dort die Ausgabe des letzten
  // Ligaspieltags noch einmal in der Seitenfolge. An Tagen ohne Spiele bleibt sie stehen und
  // ist weiter im Hauptmenü abrufbar.
  if (flag !== 0) r.zeitung = new Map();
  // Nachholspiele dieses Tages (Kalendermarke 0x80): Paarung aus dem Spielplan des damaligen
  // Spieltags, danach ist der Termin abgetragen
  const faellig = replays(g).filter((e) => e.dayIndex === k);
  if (faellig.length) {
    g.activeManagers().forEach((_, i) => backupSystem(g, i));
    const nachgeholt = playReplays(g, faellig, r.rng, sim, (home, away) => live?.attendance?.get(`${home}-${away}`), live?.booking);
    removeReplays(g, faellig);
    r.log.push(`Nachholspiele (${nachgeholt.length})`);
    for (const p2 of nachgeholt) r.log.push(`  ${names(p2.home)} - ${names(p2.away)} ${p2.result.home}:${p2.result.away}`);
  }
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    const md = g.nextMatchday(league);
    const postponed: number[] = live ? live.postponed[league] : [];
    if (!live) {
      const n = postponementCount(k, r.rng);
      const count = g.pairings(league).length;
      while (postponed.length < n) {
        const m = r.rng(0, count - 1);
        if (!postponed.includes(m)) postponed.push(m);
      }
    }
    // Vor dem Spieltag sichert das Original das System je Manager (0x1D817)
    g.activeManagers().forEach((_, i) => backupSystem(g, i));
    const played = playMatchday(g, league, r.rng, postponed, sim, (home, away) => live?.attendance?.get(`${home}-${away}`), live?.booking);
    r.log.push(`${["Bundesliga", "2. Liga", "Oberliga"][league]}, ${md}. Spieltag`);
    // Verlegte Spiele auf Nachholtermine legen (0x03563 mit 0x36F1)
    if (postponed.length) {
      const neu = scheduleReplays(g, k, league, md, postponed.slice().sort((a, b) => a - b), (l, m2, i) => fixtures(l, m2)[i]);
      for (const e of neu) {
        const [h, a] = fixtures(e.league, e.matchday)[e.match];
        r.log.push(`verlegt: ${names(h)} - ${names(a)} (${md}. Spieltag) auf Tag ${e.dayIndex}`);
      }
    }
    for (const p of played) {
      r.log.push(`  ${names(p.home)} - ${names(p.away)} ${p.result.home}:${p.result.away}${p.attendance ? ` (${p.attendance} Zuschauer, ${p.gate} DM)` : ""}`);
      for (const sc of live?.scorers?.get(`${p.home}-${p.away}`) ?? p.scorers) r.log.push(`    ${sc.minute}. ${sc.name} (${names(sc.side === "home" ? p.home : p.away)})`);
      // Sportzeitung (0x2F243) für die beteiligten Manager aus dem Spielbericht (0x305DE)
      g.activeManagers().forEach((mg, i) => {
        if (mg.clubIndex !== p.home && mg.clubIndex !== p.away) return;
        const inc = (p.incidents ?? []).filter((x) => x.manager === i);
        // Nach einer Konferenz stehen die Torereignisse nicht im Ergebnis (sie sind live schon
        // gebucht); für die Zeitung kommen sie deshalb aus dem Konferenzstand
        const ev = live?.events?.get(`${p.home}-${p.away}`);
        const report = reportFromMatch(g, i, {
          home: p.home,
          away: p.away,
          result: ev && ev.length ? { ...p.result, events: ev } : p.result,
          scorers: live?.scorers?.get(`${p.home}-${p.away}`) ?? p.scorers,
          attendance: p.attendance,
          yellowNames: inc.filter((x) => x.kind === "yellow").map((x) => x.name),
          redNames: inc.filter((x) => x.kind === "red" || x.kind === "yellowred").map((x) => x.name),
          cards: (p.incidents ?? []).filter((x) => x.kind !== "injury").length,
        }, r.rng);
        r.zeitung.set(i, composeZeitung(report, r.rng));
      });
      // Derby zweier Managervereine (Version 2026): der kleinere der beiden Einsätze wechselt
      const mgrOf = (club: number) => g.activeManagers().findIndex((mg) => mg.clubIndex === club);
      const dh = mgrOf(p.home);
      const da = mgrOf(p.away);
      if (dh >= 0 && da >= 0) {
        const derby = playDerby(g, dh, da, p.result.home, p.result.away);
        if (derby) {
          const sieger = g.managers.at(derby.winner).displayName;
          const verlierer = g.managers.at(derby.loser).displayName;
          r.log.push(`    Derby-Einsatz: ${verlierer} zahlt ${dmText(derby.amount)} an ${sieger}`);
          pushMessage(r, derby.winner, ["Derby gewonnen:", `${verlierer} zahlt Ihnen`, dmText(derby.amount)]);
          pushMessage(r, derby.loser, ["Derby verloren:", `Zahlung an ${sieger}`, dmText(derby.amount)]);
        }
      }
      if (p.forfeit !== undefined) {
        r.log.push(`    0:2-Wertung gegen ${g.managers.at(p.forfeit).displayName} (weniger als acht einsatzfähige Spieler), 200.000 DM Strafe`);
        // Im Original steht die 0:2-Wertung im Hinweiskasten (0x1C614), nicht in der
        // Meldungsliste (GitLab #36)
        r.hinweise.push({ manager: p.forfeit, zeilen: [T("quell.server", 2), T("quell.server", 3), T("quell.server", 4)] });
      }
      // Karten und Verletzungen stehen in der Konferenz unter der Szene (0x05FE5) und im
      // Spielbericht der Zeitung; das Original schreibt dazu keine Meldung (GitLab #54)
      for (const inc of p.incidents ?? []) {
        const what = inc.kind === "yellow" ? T("quell.server", 9) : inc.kind === "red" ? `Rote Karte, ${inc.duration} Spiele Sperre` : inc.kind === "yellowred" ? "Gelb-Rote Karte, 1 Spiel Sperre" : `Verletzt (${inc.injury ?? "?"}), ${inc.duration} Wochen`;
        r.log.push(`    ${inc.minute}. ${inc.name}: ${what}`);
      }
    }
    if (postponed.length) r.log.push(`  verlegt: ${postponed.map((m) => `${names(g.pairings(league)[m][0])} - ${names(g.pairings(league)[m][1])}`).join(", ")}`);
  }
  if (flag & 8) {
    const played = playCupDay(g, r.rng, sim, (home, away) => live?.attendance?.get(`${home}-${away}`));
    logCupMatches(r, "DFB-Pokal", played, played.finals ?? [], live?.scorers);
  }
  // Tagesverteiler 0x1D8D1: genau Flag 0x10 ist die Relegation, sonst ein Europapokaltag
  if ((flag & 0x70) === 0x10) {
    const m = playPlayoffDay(g, seasonDay(k), r.rng, sim);
    r.log.push(`Relegation, ${m.leg === 1 ? "Hinspiel" : "R}ckspiel"}: ${names(m.home)} - ${names(m.away)} ${resultText(m)}${m.attendance ? ` (${m.attendance} Zuschauer)` : ""}`);
    if (m.winner !== undefined) r.log.push(`  ${names(m.winner)} spielt n{chste Saison in der Bundesliga`);
    // Das Relegationsspiel läuft in der Konferenz wie jedes andere; Ergebnis und Ausgang stehen
    // danach im Spielplan und im Verlauf. Das Original meldet nichts (GitLab #54).
  } else if (flag & 0x70) {
    const { matches, finals } = playEuropaDay(g, seasonDay(k), r.rng, sim, (home, away) => live?.attendance?.get(`${home}-${away}`));
    logCupMatches(r, "Europapokal", matches, finals, live?.scorers);
  }
  const fromDay = seasonDay(k);
  if (k + 1 < CALENDAR_DAYS) setDayIndex(g, k + 1);
  else {
    // Deutscher Meister (0x1DE87 -> 0x1A36D): Titel und Abschlussbild für einen Managerverein
    const champ = bookChampion(g);
    r.log.push(`${g.clubs.at(champ.club).name} ${T("quell.server", 8)} ${T("quell.server", 5)}`);
    // Auch hier ersetzt das Abschlussbild die Meldung (0x1DE87 -> 0x1A36D)
    // Der Vereinsname wird gleich festgehalten: die neue Saison würfelt die Vereine innerhalb
    // der Ligen neu durch, der Index zeigt danach auf einen anderen Verein
    if (champ.manager >= 0) r.abschluss.push({ manager: champ.manager, kind: 0, verein: g.clubs.at(champ.club).displayName });
    // Highscore (0x1E871 -> 0x34CDA je Manager, 0x34616): Einträge einordnen und Datei schreiben
    let list = loadHighscore(g);
    g.activeManagers().forEach((_, i) => {
      const e = highscoreEntry(g, i);
      list = insertHighscore(list, e);
      r.log.push(`Highscore: ${e.name} (${e.club}) ${e.points} Punkte`);
    });
    r.highscore = list;
    try {
      writeFileSync(join(savesDir, highscoreFile(seasonStartYear(g))), encodeHighscore(list));
    } catch (err) {
      r.log.push(`Highscore-Datei nicht geschrieben: ${String(err)}`);
    }
    r.msgFlags = [];
    const events = newSeason(g, r.rng, true);
    // Spieler der KI-Manager verhandeln nicht: ihre auslaufenden Verträge enden sofort
    events.filter((ev) => ev.vertrag && isAi(g, ev.manager)).forEach((ev) => {
      const place = platzVon(g, ev.manager, ev.vertrag!.playerIndex);
      ev.vertrag = undefined;
      if (place < 0) return;
      const erg = releaseExpiring(g, ev.manager, place);
      ev.text = erg.text;
      ev.free = erg.free;
    });
    // Ablösefreie Spieler (Version 2026) sammeln, alle Manager dürfen bieten
    r.freeAgents = events.filter((ev) => ev.free).map((ev) => ({ ...ev.free!, bids: [] }));
    r.freeAgentsDay = dayIndex(g);
    if (r.freeAgents.length) {
      r.log.push(`Ablösefrei: ${r.freeAgents.map((a2) => a2.name).join(", ")}`);
      g.activeManagers().forEach((_, i) => {
        if (!isAi(g, i)) pushMessage(r, i, ["Abl|sefrei zu haben:", ...r.freeAgents.slice(0, 3).map((a2) => a2.name), r.freeAgents.length > 3 ? "und weitere." : ""].filter(Boolean));
      });
    }
    // Jugendarbeit (Version 2026, #4): ein Jahr älter, Entwicklung, Aufstiege und Abgänge
    jugendZaehlerLeeren(g);
    for (const ev of jugendSaison(g, r.rng)) {
      const wer = g.managers.at(ev.manager).displayName;
      if (ev.kind === "aufstieg") {
        r.log.push(`Jugend ${wer}: ${ev.name} steigt in die ${JUGEND_NAMEN[ev.nach ?? 0]} auf (Stärke ${ev.staerke})`);
        pushMessage(r, ev.manager, [`${ev.name} steigt in die`, `${JUGEND_NAMEN[ev.nach ?? 0]} auf.`]);
      } else if (ev.kind === "reif") {
        r.log.push(`Jugend ${wer}: ${ev.name} ist aus der A-Jugend herausgewachsen (Stärke ${ev.staerke})`);
        pushMessage(r, ev.manager, [`${ev.name} ist aus der`, "A-Jugend heraus."]);
      } else if (ev.kind === "abgang") {
        r.log.push(`Jugend ${wer}: ${ev.name} verlässt den Verein`);
      } else if (ev.kind === "aufgabe") {
        r.log.push(`Jugend ${wer}: ${ev.name} hat die Lust verloren und hört auf`);
        pushMessage(r, ev.manager, [`${ev.name} hat die Lust`, "verloren und h|rt auf."]);
      } else if (ev.kind === "sprung") {
        r.log.push(`Jugend ${wer}: ${ev.name} macht einen Entwicklungssprung (Potenzial ${ev.staerke})`);
        pushMessage(r, ev.manager, [ev.name, "macht einen gro~en", "Entwicklungssprung."]);
      }
    }
    r.log.push(`Saisonwechsel: neue Saison ${g.date.year}/${g.date.year + 1}, Auf- und Abstieg, Ligaplätze gemischt, Pokale neu gelost, neue Sponsorenangebote`);
    // Abgelaufene Verträge: der Dialog des Originals folgt im ersten Zug der neuen Saison
    r.vertragsende = events.filter((ev) => ev.vertrag).map((ev) => ({ manager: ev.manager, playerIndex: ev.vertrag!.playerIndex, name: ev.vertrag!.name }));
    if (r.vertragsende.length) {
      r.log.push(`Vertragsende: ${r.vertragsende.map((v) => `${g.managers.at(v.manager).displayName}/${v.name}`).join(", ")}`);
      g.activeManagers().forEach((_, i) => {
        const meine = r.vertragsende.filter((v) => v.manager === i);
        if (meine.length && !isAi(g, i)) pushMessage(r, i, ["Vertrag l{uft aus:", ...meine.slice(0, 3).map((v) => v.name), meine.length > 3 ? "und weitere." : ""].filter(Boolean));
      });
    }
    for (const ev of events) {
      if (ev.vertrag) continue;
      r.log.push(`  ${g.managers.at(ev.manager).displayName}: ${ev.text}`);
      // Das Vertragsende zeigt das Original im Hinweiskasten ("... kehrt Ihrem Verein den
      // Rücken. Sie erhalten eine Ablösesumme von ...", BMMAIN 0x503CF; GitLab #36), den
      // Hinweis auf die Werbeverträge nach einem Aufstieg ebenso (0x0CC77; GitLab #38). Die
      // übrigen Saisonende-Meldungen bleiben vorerst in der Meldungsliste.
      if (ev.kasten) r.hinweise.push({ manager: ev.manager, zeilen: ev.kasten });
      // Das Karriereende hat im Original einen festen Zeilenschnitt und keine Überschrift (#58)
      else if (ev.meldung) pushMessage(r, ev.manager, ev.meldung);
      else if (/kehrt Ihrem Verein/.test(ev.text)) r.hinweise.push({ manager: ev.manager, zeilen: wrap(ev.text).map((z) => toDosText(z)) });
      else pushMessage(r, ev.manager, ["Saisonende", ...wrap(ev.text)]);
    }
  }
  // Nach den Spielen nimmt das Original an jedem Kalendertag gesperrte und verletzte Spieler aus
  // der Aufstellung: Rückennummer 0, wenn Byte 13 nicht 0 ist (0x1DA23). Bei uns geschah das nur
  // im Augenblick der Verletzung (GitLab #34).
  g.activeManagers().forEach((_, i) => {
    for (let platz = 0; platz < 24; platz++) {
      const l = g.lineups.at(i * 25 + platz);
      if (!l.isEmpty && l.u8(13) !== 0 && l.u8(10) !== 0) l.setU8(10, 0);
    }
  });
  // Tägliche Finanzroutine für jeden übersprungenen Kalendertag (Original läuft Tag für Tag)
  const toDay = seasonDay(dayIndex(g));
  const startYear = seasonStartYear(g);
  for (let d = fromDay + 1; d <= toDay; d++) {
    const dt = dateOfSeasonDay(d, startYear);
    g.activeManagers().forEach((m, i) => {
      // Meldungen, die im Original im Hinweiskasten stehen (0x3174A), kommen in die Hinweisliste
      const hinweis = (zeilen: string[]) => r.hinweise.push({ manager: i, zeilen: zeilen.map((z) => toDosText(z)) });
      // Die tägliche Finanzroutine läuft je Manager; darin würfelt das Original mit 1/61 die
      // Zinstabelle der Bank neu (0x11DA2 -> 0x112AA) und zählt die Öffnungszeiten der
      // Trainingslager weiter (0x11D2D). Beides hing bei uns am Monatsende bzw. lief nur
      // einmal je Tag (GitLab #34).
      if (r.rng(0, 60) === 0) driftInterest(g, r.rng);
      advanceCampOpen(r.campOpen, r.rng);
      for (const kind of dailyConstruction(g, i)) {
        // Der Betreff steht im Original je Bauwerk fest (0x4EAEA); Flutlicht, Anzeigetafel und
        // Komfort tragen ihr Stichwort in einer zweiten Zeile (0x4FD40)
        const bau = texte("ui.bauwerke");
        const zusatz = kind === 4 ? bau[7] : kind === 5 ? bau[8] : kind === 7 ? bau[9] : "";
        const text = `${bau[kind - 1]}${zusatz ? " " + zusatz : ""} ${texte("ui.ausbaufertig")[0]}`;
        r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: ${text}`);
        pushMessage(r, i, wrap(text), dt);
      }
      for (const ev of dailyFinance(g, i, dt, r.rng, r.balanceSums[i])) {
        r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: ${ev.text}`);
        // Was der Manager davon zu sehen bekommt, richtet sich nach dem Original (GitLab #41):
        // "Ihr Kredit von ... wurde heute fällig." steht in der Texttabelle des Hinweiskastens
        // (BMMAIN 0x50472, GitLab #36), die Randale schreibt das Original als Meldung (0x0E21A
        // baut die drei Zeilen und gibt sie über 0x0239E an die Meldungsroutine 0x30AA0).
        // Zinsen, Monatsabrechnung und der Fanwert dagegen laufen im Original still: die
        // Fanerhöhung (0x11F76) schreibt keine Meldung, und Einnahmen und Ausgaben stehen im
        // Finanzbildschirm, nicht in der Meldungsliste. Sie bleiben deshalb im Verlauf.
        if (ev.kind === "repaid") hinweis(wrap(ev.text));
        else if (ev.kind === "riot" || ev.kind === "komfort") pushMessage(r, i, wrap(ev.text), dt);
        // Jugendförderung (Version 2026, #4) läuft mit der Monatsabrechnung
        if (ev.kind !== "month") continue;
        const jugend = jugendMonat(g, i);
        if (jugend > 0) {
          r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: Jugendförderung ${dmText(jugend)}`);
          pushMessage(r, i, ["Jugendf|rderung:", dmText(jugend)], dt);
        }
      }
      // Sperre nach einem Trainingslager läuft ab (0x11DEE)
      campCountdown(g, i);
      // Kalendermeldungen des Hauptmenüs (0x143ED): Winterpause, Relegation, gesichert/verspielt.
      // Sie kommen in den Hinweiskasten, nicht in die Meldungsliste (GitLab #31)
      if (isWinterBreakDay(dt)) hinweis(winterBreakLines());
      const rel = relegationMessage(g, i, dt);
      if (rel) {
        hinweis(rel);
        r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: Relegationsspiel`);
      }
      const flags = { v: r.msgFlags[i] ?? 0 };
      for (const lines of standingsMessages(g, i, flags, dt)) {
        hinweis(lines);
        r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: ${lines.join(" ")}`);
      }
      r.msgFlags[i] = flags.v;
    });
    // Weihnachten (0x1D6F6 -> 0x1CF86 am 24.12.): Gruß mit 1/4, darin Weihnachtspakete mit 1/2
    if (dt.day === 24 && dt.month0 === 11) {
      const x = christmasPresents(g, r.rng);
      if (x) {
        g.activeManagers().forEach((m, i) => {
          const lines = [T("quell.server", 6)];
          if (x.base > 0) lines.push(...christmasLines(), `BUNDESLIGA: ${x.base} DM, 2.LIGA: ${Math.trunc(x.base / 2)} DM,`, `AMATEUR-OBERLIGA: ${Math.trunc(x.base / 3)} DM (INCL. MWST.)`);
          pushMessage(r, i, lines, dt);
          r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: Frohe Weihnachten${x.base > 0 ? `, Weihnachtspakete ${x.amounts[i]} DM` : ""}`);
        });
      }
    }
    if (dt.day === DAYS_IN_MONTH[dt.month0]) {
      // Überschuldung (Version 2026): Punktabzug und Kaufsperre
      for (const d of checkDebt(g)) {
        const mg = g.managers.at(d.manager);
        const liga = mg.clubIndex < 18 ? 0 : mg.clubIndex < 38 ? 1 : 2;
        updatePositions(g, liga);
        r.log.push(`${dt.day}.${dt.month0 + 1}. ${mg.displayName}: ${dmText(d.balance)} im Minus - ${d.points} Punkte Abzug und ein Monat Kaufsperre`);
        pushMessage(r, d.manager, ["Ihr Konto ist zu tief", "im Minus: " + d.points + " Punkte", "Abzug, ein Monat", "keine Eink{ufe."], dt);
        g.activeManagers().forEach((_, i) => {
          if (i !== d.manager) pushMessage(r, i, [`${mg.displayName} bekommt`, `${d.points} Punkte Abzug`, "wegen Schulden."], dt);
        });
      }
    }
  }
  // Tagesroutine 0x0DF0D: Vertragsangebote, Training, Frische und Verletzungen aller
  // Managerkader. Das Original ruft sie erst nach den Spielen auf, wenn der Saisontag den
  // nächsten Kalendertag erreicht hat (0x1DA87 zählt hoch, 0x1DBFE trainiert) - also für den
  // Tag, an dem der Zug ankommt. Ein gespeicherter Stand enthält das Training seines Tages damit
  // schon. Bis GitLab #27 lief es hier vor den Spielen für den alten Tag: das Training war einen
  // Kalendertag verschoben, und ein Stand des Originals wurde am ersten Tag doppelt trainiert.
  // Über die Winterpause am Original gemessen: nur mit dem Ankunftstag stimmt die Frische.
  if (k + 1 < CALENDAR_DAYS) {
    const kNeu = dayIndex(g);
    const flagNeu = calendarFlag(g, kNeu);
    const tr = trainingInput(g);
    const dtNeu = dateOfSeasonDay(seasonDay(kNeu), startYear);
    g.activeManagers().forEach((m, i) => {
      // Marktteile derselben Routine (Frische der Marktspieler 0xDF8F, Angebote fremder Vereine):
      // einmal je Kalendertag, nicht je Saisontag (GitLab #33). Im Original stehen sie vor dem
      // Kader (0xDF72 vor 0xEFA1).
      for (const ev of dailyTransfers(g, i, seasonDay(kNeu), r.rng)) {
        r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: ${ev.lines.join(" ")}`);
        pushMessage(r, i, ev.lines, dtNeu);
      }
      // Ankündigung, dass ein Spieler im letzten Vertragsjahr nicht verlängert (0x0E9C1,
      // GitLab #59) - die Vorwarnung zum Vertragsende
      for (const a of contractRefusalAnnouncements(g, i, r.rng)) {
        r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: ${a.name} verlängert nicht`);
        pushMessage(r, i, a.zeilen, dtNeu);
      }
      for (const offer of contractOffers(g, i, r.rng)) {
        r.offers.push(offer);
        r.log.push(`${m.displayName}: ${offer.name} bietet Vertragsverlängerung an (${offer.yearsFrom} -> ${offer.yearsTo} Jahre, ${offer.salary} DM)`);
        pushMessage(r, i, [`${offer.name} ${T("quell.server", 10)}`, `von ${offer.yearsFrom} auf ${offer.yearsTo}`, T("quell.server", 0)]);
      }
      const before = g.squadOf(i).map((l) => l.u8(9));
      dailyTraining(g, i, seasonDay(kNeu), tr, r.rng, flagNeu === 0);
      // Automatische Aufstellung (0x0DF0D -> 0x22030), wenn ein System gewählt ist - nach
      // Training und Verletzungen, einmal je Kalendertag
      autoLineupIfEnabled(g, i);
      // Sponsorenangebote alle 14 Saisontage neu (0x1DC27: Saisontag mod 14 = 0 -> 0x176F4).
      // Bei uns standen sie die ganze Saison über fest (GitLab #34).
      if (seasonDay(kNeu) % 14 === 0) {
        generateOffers(g, i, r.rng);
        r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: neue Sponsorenangebote`);
      }
      g.squadOf(i).forEach((l, j) => {
        if ((l.u8(9) & 2) && !(before[j] & 2)) {
          r.log.push(`${m.displayName}: ${g.players.at(l.playerIndex).displayName} verletzt (${injuries()[injuryKind(l)]?.name ?? "?"}, ${l.u8(13)} Wochen)`);
          pushMessage(r, i, [T("quell.server", 1), g.players.at(l.playerIndex).displayName, ` (${injuries()[injuryKind(l)]?.name ?? "?"})`]);
        }
      });
      // Medizinische Versorgung (Version 2026, #2): eine Behandlungswoche an denselben Tagen,
      // an denen die Verletzung herunterzählt - nach dem Training, die reguläre Woche ist dann ab
      if (seasonDay(kNeu) % 7 === 0) {
        for (const ev of medWeek(g, i, r.rng)) {
          const name = g.players.at(ev.playerIndex).displayName;
          const stufe = MED_LEVELS[ev.level].name;
          if (ev.kind === "klamm") {
            r.log.push(`${m.displayName}: Behandlung von ${name} (${stufe}) nicht bezahlbar - zurück auf Vereinsarzt`);
            pushMessage(r, i, [`${name}:`, "Behandlung nicht bezahlbar,", "wieder beim Vereinsarzt."]);
          } else if (ev.kind === "laenger") {
            r.log.push(`${m.displayName}: ${name} braucht eine Woche länger (${ev.left} Wochen)`);
            pushMessage(r, i, [name, "braucht eine Woche", `l{nger (noch ${ev.left}).`]);
          } else if (ev.kind === "geheilt") {
            r.log.push(`${m.displayName}: ${name} ist nach Behandlung (${stufe}) wieder fit`);
            pushMessage(r, i, [name, "ist nach der Behandlung", "wieder fit."]);
          } else {
            r.log.push(`${m.displayName}: ${name} ${ev.weeks} Woche(n) früher zurück (${stufe}, noch ${ev.left})`);
            pushMessage(r, i, [name, `ist ${ev.weeks} Woche${ev.weeks === 1 ? "" : "n"} fr}her`, `zur}ck (noch ${ev.left}).`]);
          }
        }
      }
    });
  }
  // Derby-Einsatz (Version 2026): steht am neuen Tag ein Spiel gegen einen Managerverein an,
  // bekommen beide eine Meldung mit ihrem eigenen Einsatz - sonst denkt niemand daran, ihn vor
  // dem Anpfiff zu setzen (GitLab #9).
  if (is2026(g)) {
    const heute = calendarFlag(g, dayIndex(g));
    const managerVon = new Map<number, number>();
    g.activeManagers().forEach((m, i) => managerVon.set(m.clubIndex, i));
    for (let liga = 0; liga < 3; liga++) {
      if (!(heute & FLAG_LEAGUE[liga])) continue;
      for (const [heim, gast] of g.pairings(liga)) {
        const a = managerVon.get(heim);
        const b = managerVon.get(gast);
        if (a === undefined || b === undefined) continue;
        for (const [wer, gegner] of [[a, gast], [b, heim]] as const) {
          if (isAi(g, wer)) continue;
          pushMessage(r, wer, ["Derby gegen", names(gegner) + ":", `Ihr Einsatz ${dmText(stakeOf(g, wer))}`]);
        }
        r.log.push(`Derby am Spieltag: ${names(heim)} - ${names(gast)} (Einsätze ${dmText(stakeOf(g, a))} / ${dmText(stakeOf(g, b))})`);
      }
    }
  }
  // Doping (Version 2026, #3): nach den Spielen wird für jeden gedopten Spieler gewürfelt, der
  // eingesetzt war. Wer auffliegt, ist Wochen gesperrt, der Verein zahlt, und alle erfahren es.
  g.activeManagers().forEach((m, i) => {
    const jetzt = g.squadOf(i).map((l) => l.leagueApps + l.cupApps);
    const vorher = einsaetzeVorher[i] ?? [];
    const erwischt = dopeMatchday(g, i, (place) => (jetzt[place] ?? 0) > (vorher[place] ?? 0), r.rng);
    for (const ev of erwischt) {
      const name = g.players.at(ev.playerIndex).displayName;
      r.log.push(`Doping: ${name} (${m.displayName}) überführt - ${ev.weeks} Wochen gesperrt, ${dmText(ev.fine)} Strafe`);
      pushMessage(r, i, [`${name} ist des Dopings`, `}berf}hrt: ${ev.weeks} Wochen`, `gesperrt, ${dmText(ev.fine)} Strafe.`]);
      // Das gehört öffentlich gemacht
      g.activeManagers().forEach((_, j) => {
        if (j === i || isAi(g, j)) return;
        pushMessage(r, j, ["Dopingfall bei", `${m.displayName}:`, `${name}, ${ev.weeks} Wochen.`]);
      });
    }
  });
  dopingCleanup(g);
  // Laufzeitdaten des Marktes verfallen mit dem Tag, ebenso die abgelehnten Bauangebote und
  // die Abwerbefrist für frisch aufgerückte Jugendspieler
  r.jugendFrisch = [];
  r.bauAbgelehnt.clear();
  r.bauTage.clear();
  r.sales.clear();
  r.purchases.clear();
  r.marketOffers = [];
  flushMessages(r);
  r.lastDay = r.log.slice(logStart);
  r.done.clear();
  // Vom Rechner geführte Manager warten auf nichts (sim/ki.ts)
  for (const i of aiList(r.game)) r.done.add(i);
  // Offene Geschäfte der Version 2026 abschließen, bevor der neue Tag beginnt (das Bietgefecht
  // ist schon zu Beginn entschieden worden)
  resolvePoachRequests(r);
  resolveFreeAgents(r);
  // Unbeantwortete Kreditanfragen verfallen mit dem Tag
  for (const q of r.loanRequests) {
    r.log.push(`Kreditanfrage von ${r.game.managers.at(q.borrower).displayName} verfällt`);
    pushMessage(r, q.borrower, [`${r.game.managers.at(q.lender).displayName}`, "hat nicht geantwortet."]);
  }
  r.loanRequests = [];
  r.version++;
  void persist(r);
}

async function persist(r: Room): Promise<void> {
  try {
    await writeFile(join(savesDir, SERVER_SAVE), r.save.withFreshHeader().encode());
  } catch (err) {
    r.log.push("Sichern fehlgeschlagen: " + String((err as Error).message));
  }
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 4_000_000) throw new Error("Anfrage zu groß");
    chunks.push(c as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg", ".wav": "audio/wav" };

async function serveStatic(pathname: string, res: ServerResponse, user: string | undefined, local = false, range?: string, ifNoneMatch?: string): Promise<void> {
  let file: string | null = null;
  if (pathname === "/" || pathname === "/index.html") file = join(web, "index.html");
  else if (pathname.startsWith("/dist/")) file = join(web, pathname);
  else if (pathname.startsWith("/assets/")) file = join(root, pathname);
  else if (pathname.startsWith("/saves/")) {
    if (!user && !local) return json(res, 401, { error: "nicht angemeldet" });
    file = join(savesDir, pathname.slice(7));
  }
  try {
    if (!file || file.includes("..")) throw new Error("nicht gefunden");
    let data = await readFile(file);
    if (file.endsWith("index.html")) {
      // Versionsstempel, damit Browser nach jeder Auslieferung die Programmdatei neu laden
      const stamp = Math.floor((await stat(join(web, "dist/app.js"))).mtimeMs / 1000);
      data = Buffer.from(data.toString("utf8").replace("dist/app.js", `dist/app.js?v=${stamp}`));
    }
    // Die Seite selbst darf nie aus dem Zwischenspeicher kommen: sie traegt den Versionsstempel
    // der Programmdatei, und Safari hat "no-cache" ohne Pruefmerkmal schon als "darf ich behalten"
    // gelesen. Bilder und Schriften duerfen liegen bleiben.
    // Bilder, Klänge und Texte werden aus der eigenen Installation erzeugt und ändern sich, wenn
    // jemand `npm run assets` neu laufen lässt. Mit einer festen Haltbarkeit hing danach das alte
    // Bild im Browser (so blieb die bunte Zeitungsgrafik sichtbar); deshalb jedes Mal nachfragen,
    // aber mit Prüfmerkmal, damit die Antwort in der Regel nur "unverändert" lautet.
    const cache = file.endsWith("index.html") ? "no-store, max-age=0" : "no-cache";
    const stamp = await stat(file);
    const etag = `W/"${stamp.size.toString(16)}-${Math.floor(stamp.mtimeMs).toString(16)}"`;
    if (ifNoneMatch === etag && !range) {
      res.writeHead(304, { etag, "cache-control": cache });
      res.end();
      return;
    }
    const type = types[extname(file)] ?? "application/octet-stream";
    // Safari spielt Ton nur ab, wenn der Server teilweise Auslieferung beherrscht
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (m) {
      // "bytes=a-b", "bytes=a-" und der Sonderfall "bytes=-n" (die letzten n Bytes)
      const start = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2] || 0));
      const ende = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
      if (start > ende || start < 0) {
        res.writeHead(416, { "content-range": `bytes */${data.length}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        "content-type": type,
        "cache-control": cache,
        etag,
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${ende}/${data.length}`,
        "content-length": String(ende - start + 1),
      });
      res.end(data.subarray(start, ende + 1));
      return;
    }
    res.writeHead(200, { "content-type": type, "cache-control": cache, etag, "accept-ranges": "bytes" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("nicht gefunden");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(req: IncomingMessage, url: URL, res: ServerResponse): Promise<void> {
  const p = url.pathname;
  const user = sessionUser(req);
  if (req.method === "GET" && p === "/api/me") {
    return user ? json(res, 200, { user }) : json(res, 401, { error: "nicht angemeldet" });
  }
  if (req.method === "POST" && p === "/api/login") {
    const addr = clientAddress(req);
    if (tooManyFailures(addr)) return json(res, 429, { error: "zu viele Fehlversuche, bitte später erneut" });
    const body = await readJson(req);
    const name = String(body.user ?? "").trim().slice(0, 20);
    const password = String(body.password ?? "");
    const hash = loadUsers().get(name);
    if (!hash || !verifyPassword(password, hash)) {
      failures.set(addr, [...(failures.get(addr) ?? []), Date.now()]);
      await sleep(500);
      return json(res, 401, { error: "Name oder Passwort falsch" });
    }
    const token = randomBytes(24).toString("base64url");
    sessions.set(token, { user: name, created: Date.now() });
    saveSessions();
    setSessionCookie(req, res, token);
    return json(res, 200, { user: name });
  }
  if (req.method === "POST" && p === "/api/logout") {
    const token = cookieToken(req);
    if (token) sessions.delete(token);
    saveSessions();
    setSessionCookie(req, res, null);
    return json(res, 200, { ok: true });
  }
  if (!user) return json(res, 401, { error: "nicht angemeldet" });
  if (req.method === "GET" && p === "/api/state") {
    if (!room) return json(res, 200, { version: 0, user, managers: [], log: ["kein Spielstand geladen"] });
    return json(res, 200, stateJson(room, user));
  }
  if (req.method === "GET" && p === "/api/live") {
    return json(res, 200, { live: room?.live ? liveJson(room.live, room.game) : null });
  }
  if (req.method === "GET" && p === "/api/mana") {
    if (!mana) return json(res, 404, { error: "MANA.DAT fehlt" });
    return json(res, 200, { clubs: mana.names.slice(0, 64).map((name, i) => ({ index: i, name, logo: mana!.logos[i], league: i < 18 ? 0 : i < 38 ? 1 : 2 })) });
  }
  if (req.method === "GET" && p === "/api/saves") {
    const files = (await readdir(savesDir)).filter((f) => f.toUpperCase().endsWith(".MAN")).sort();
    return json(res, 200, { files });
  }
  if (req.method === "GET" && p === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.write(`data: ${JSON.stringify({ version: room?.version ?? 0, build: buildStamp() })}\n\n`);
    listeners.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(ping);
      listeners.delete(res);
    });
    return;
  }
  if (req.method !== "POST") return json(res, 405, { error: "nur POST" });
  const body = await readJson(req);
  if (p === "/api/newgame") {
    if (!mana) return json(res, 409, { error: "MANA.DAT fehlt auf dem Server" });
    if (room?.live) return json(res, 409, { error: "Die Konferenz läuft" });
    const managers = Array.isArray(body.managers) ? body.managers : [];
    if (managers.length < 1 || managers.length > 4) return json(res, 400, { error: "1 bis 4 Manager" });
    const opts = {
      managers: managers.map((m: any) => ({ name: String(m.name ?? "").trim().slice(0, 12) || "MANAGER", club: Number(m.club) | 0, portrait: Number(m.portrait) || 1 })),
      level: 5 - Math.max(1, Math.min(4, Number(body.level) || 2)),
      rules: Number(body.rules) === 1 ? 1 : 0,
    };
    const template = room?.save.plain ?? SaveFile.decode(new Uint8Array(await readFile(join(savesDir, argOf("--load") ?? "TEST4.MAN")))).plain;
    const save = createGame(template, mana, opts, mulberryRng(Date.now() >>> 0));
    room = roomFromSave("NEU.MAN", save);
    // Auslosung des DFB-Pokals als Zeremonie für alle (0x17C26), sobald alle Plätze besetzt sind
    room.ceremony = { cup: 0, phase: "vote", ready: false, votes: {}, startedAt: null, skipped: false, seen: [] };
    room.log.push(`Neues Spiel von ${user} (${opts.rules === 1 ? "Version 2026" : "Original"}): ${opts.managers.map((m: { name: string }) => m.name).join(", ")}`);
    await persist(room);
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/upload") {
    if (room?.live) return json(res, 409, { error: "Die Konferenz läuft" });
    let save: SaveFile;
    try {
      save = SaveFile.decode(new Uint8Array(Buffer.from(String(body.data ?? ""), "base64")));
    } catch (err) {
      return json(res, 400, { error: "Kein gültiger Spielstand: " + String((err as Error).message) });
    }
    const name = String(body.name ?? "UPLOAD.MAN").replace(/[^A-Za-z0-9_.-]/g, "").toUpperCase() || "UPLOAD.MAN";
    room = roomFromSave(name, save);
    room.log.push(`Spielstand ${name} von ${user} hochgeladen`);
    await persist(room);
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/load") {
    const file = String(body.file ?? "").replace(/[^A-Za-z0-9_.-]/g, "");
    room = await loadRoom(file);
    room.log.push(`geladen von ${user}`);
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (!room) return json(res, 409, { error: "kein Spielstand geladen" });
  const manager = Number(body.manager);
  const count = room.game.activeManagers().length;
  const validManager = manager >= 0 && manager < count;
  const mine = validManager && room.seats.get(manager) === user;
  if (p === "/api/seat") {
    if (!validManager) return json(res, 400, { error: "Manager ungültig" });
    const taken = room.seats.get(manager);
    if (taken && taken !== user) return json(res, 409, { error: `Manager wird von ${taken} gespielt` });
    for (const [m, who] of room.seats) if (who === user) room.seats.delete(m);
    room.seats.set(manager, user);
    // Wer einen vom Rechner geführten Verein übernimmt, holt ihn zurück in Menschenhand
    if (isAi(room.game, manager)) {
      setAi(room.game, manager, false);
      room.done.delete(manager);
      room.log.push(`${user} übernimmt ${room.game.managers.at(manager).displayName} wieder vom Rechner`);
    }
    // Die Abfrage kommt, sobald jeder Manager einen Spieler hat
    if (room.ceremony && !room.ceremony.ready && room.seats.size >= count) {
      room.ceremony.ready = true;
      room.log.push("Auslosung: alle Plätze besetzt");
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/ceremony") {
    const c = room.ceremony;
    if (!c) return json(res, 200, { ok: true });
    const seated = [...room.seats.values()];
    // Bestätigt wird immer ein bestimmter Wettbewerb in einer bestimmten Phase. Ohne diese
    // Angabe könnte ein Klick, der noch auf dem alten Bild landet, die nächste Zeremonie
    // weiterschalten - dann bekäme niemand sie zu sehen.
    if (body.cup !== undefined && Number(body.cup) !== c.cup) return json(res, 200, { ok: true });
    if (body.phase !== undefined && String(body.phase) !== c.phase) return json(res, 200, { ok: true });
    if (body.vote !== undefined) {
      // Abstimmung "ABER KLAR" / "KEIN GEDANKE"; übersprungen wird nur, wenn niemand zusehen will
      if (c.phase !== "vote") return json(res, 200, { ok: true });
      c.votes[user] = Boolean(body.vote);
      if (seated.length > 0 && seated.every((u) => u in c.votes)) {
        c.skipped = seated.every((u) => !c.votes[u]);
        if (c.skipped) {
          // Niemand will zusehen: Tafel und Übersicht entfallen ganz (wie im Original)
          room.log.push(`Auslosung ${cupNames()[c.cup]}: übersprungen`);
          advanceCeremony(room, c.cup);
        } else {
          c.startedAt = Date.now();
          c.phase = "draw";
          room.log.push("Auslosung: Zeremonie läuft");
        }
      }
    } else {
      // Bestätigen zählt erst, wenn die Zeremonie dieses Wettbewerbs auch läuft
      if (c.phase === "vote" || c.startedAt === null) return json(res, 200, { ok: true });
      if (!c.seen.includes(user)) c.seen.push(user);
      if (!seated.every((u) => c.seen.includes(u))) {
        room.version++;
        broadcast();
        return json(res, 200, { ok: true });
      }
      if (c.phase === "draw") {
        // Erst wenn alle "TASTE DRÜCKEN" bestätigt haben, kommt die Spielübersicht
        c.phase = "list";
        c.seen = [];
        room.log.push(`Auslosung ${cupNames()[c.cup]}: Spielübersicht`);
      } else advanceCeremony(room, c.cup);
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/quit") {
    // Aufhören: der Rechner übernimmt den Verein (sim/ki.ts, Rückfrage wie im Original 0x0A7DD)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.live) return json(res, 409, { error: "Die Konferenz läuft" });
    setAi(room.game, manager, true);
    room.seats.delete(manager);
    room.done.add(manager);
    // Ohne eigenes System stellt der Rechner nach 1-4-4-2 auf
    if (systemOf(room.game, manager) === SYSTEM_MANUAL) setSystem(room.game, manager, 2);
    autoLineupIfEnabled(room.game, manager);
    const name = room.game.managers.at(manager).displayName;
    room.log.push(`${user} hört auf: ${name} wird vom Rechner geführt`);
    room.game.activeManagers().forEach((_, i) => {
      if (i !== manager && !isAi(room.game, i)) pushMessage(room, i, [`${name} h|rt auf.`, "Den Verein f}hrt", "jetzt der Rechner."]);
    });
    flushMessages(room);
    await persist(room);
    room.version++;
    if (room.done.size >= count) zugBeenden(room);
    else broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/done" || p === "/api/undone") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.live) return json(res, 409, { error: "Die Konferenz läuft" });
    if (p === "/api/done") {
      // Wer nicht verlängert hat, macht dem Spieler kein Angebot - er geht (0x0DB40)
      vertragsendeAufloesen(room, manager);
      room.done.add(manager);
    }
    else room.done.delete(manager);
    room.version++;
    if (room.done.size >= count) zugBeenden(room);
    else broadcast();
    return json(res, 200, { ok: true, advanced: room.done.size === 0 });
  }
  if (p === "/api/live/pause" || p === "/api/live/resume") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const st = room.live;
    if (!st) return json(res, 409, { error: "keine Konferenz" });
    if (p === "/api/live/pause") {
      if (st.paused) return json(res, 409, { error: `Unterbrochen von ${st.pausedBy}` });
      st.paused = true;
      st.pausedBy = user;
      room.log.push(`${room.game.managers.at(manager).displayName} unterbricht das Spiel (${st.minute}. Minute)`);
    } else if (st.pausedBy === HALFTIME || st.pausedBy === FULLTIME) {
      // Halbzeit: es geht weiter, sobald alle besetzten Manager bestätigt haben
      st.halfSeen ??= [];
      if (!st.halfSeen.includes(user)) st.halfSeen.push(user);
      const seated = [...room.seats.values()];
      if (seated.every((u) => st.halfSeen!.includes(u))) {
        st.paused = false;
        st.pausedBy = undefined;
        st.halfSeen = undefined;
        st.holdUntil = Date.now();
        // Nach dem Schlusspfiff ist der Tag längst gebucht: die Anzeige verschwindet einfach
        if (st.booked) room.live = undefined;
      }
    } else {
      if (st.paused && st.pausedBy !== user && [...room.seats.values()].includes(st.pausedBy ?? "")) return json(res, 403, { error: `Nur ${st.pausedBy} kann fortsetzen` });
      // Wie im Original beim Verlassen des Kaderbildschirms (0x21190): Aufstellung, Positionen
      // und Einsatz wirken sich jetzt auf die Stärke aus - einmal, nicht nach jedem Handgriff
      refreshStrength(st, room.game, manager, room.rng);
      st.paused = false;
      st.pausedBy = undefined;
      st.verletzung = undefined;
      st.holdUntil = Date.now() + 500;
    }
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/newcontract") {
    // Vertragsverlängerung aus der Vertragsansicht des Kaderbildschirms (0x251FF -> 0x249E0):
    // der Manager bietet von sich aus Laufzeit und Gehalt an.
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const place = Number(body.place) | 0;
    const years = Math.trunc(Number(body.years));
    const salary = Math.trunc(Number(body.salary));
    const l = room.game.squadOf(manager)[place];
    if (!l) return json(res, 400, { error: "kein Spieler" });
    if (!(years >= 1) || !(salary >= 0)) return json(res, 400, { error: "Angabe ungültig" });
    if (years > MAX_CONTRACT_YEARS) return json(res, 200, { ok: false, message: tooLongText() });
    const name = room.game.players.at(l.playerIndex).displayName;
    const offen = room.vertragsende.find((v) => v.manager === manager && v.playerIndex === l.playerIndex);
    if (!contractCheck(room.game, manager, place, years, salary, room.rng)) {
      // Am Saisonende darf der Manager nachbessern, solange er den Spieler nicht gehen lässt;
      // in der Saison sperrt die Absage den Platz für eine Weile (Byte 24)
      if (!offen) l.setU8(24, room.rng(10, 18));
      room.log.push(`${room.game.managers.at(manager).displayName}: ${name} lehnt ${salary} DM für ${years} Jahre ab`);
      room.version++;
      broadcast();
      return json(res, 200, { ok: false, message: `${name} ${texte("ui.keinInteresse").join(" ")}` });
    }
    l.setU8(11, years);
    for (let i = 0; i < 4; i++) l.setU8(40 + i, (salary >>> (8 * i)) & 0xff);
    l.setU8(24, l.u8(24) & 0x7f);
    room.log.push(`${room.game.managers.at(manager).displayName}: Vertrag mit ${name} auf ${years} Jahre verlängert (${salary} DM)`);
    if (offen) {
      // Kasten des Originals nach einer Einigung am Saisonende (0x0DDF0)
      room.vertragsende = room.vertragsende.filter((v) => v !== offen);
      // Kasten "<Name> bleibt Ihnen auch die nächste Saison erhalten." (0x0DDF0)
      room.hinweise.push({ manager, zeilen: [toDosText(name), ...texte("ui.vertragsende").slice(2)] });
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, message: `${name} unterschreibt.` });
  }
  if (p === "/api/vertragsende") {
    // "Kein Angebot" im Vertragsdialog des Saisonendes: der Spieler verlässt den Verein
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const place = Number(body.place) | 0;
    const l = room.game.squadOf(manager)[place];
    const offen = l && room.vertragsende.find((v) => v.manager === manager && v.playerIndex === l.playerIndex);
    if (!offen) return json(res, 404, { error: "keine offene Verhandlung" });
    vertragsendeFreigeben(room, manager, offen.playerIndex);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/contract") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const place = Number(body.place);
    const idx = room.offers.findIndex((o) => o.manager === manager && o.place === place);
    if (idx < 0) return json(res, 404, { error: "kein Angebot" });
    const offer = room.offers[idx];
    if (body.accept && body.salary !== undefined) {
      // Eigenes Angebot (Vertragsdialog 0x251FF -> 0x249E0); bei Ablehnung bleibt das Angebot offen
      const years = Math.trunc(Number(body.years));
      const salary = Math.trunc(Number(body.salary));
      if (!(years >= 1) || !(salary >= 0)) return json(res, 400, { error: "Angabe ungültig" });
      if (years > MAX_CONTRACT_YEARS) return json(res, 200, { ok: false, message: tooLongText() });
      if (!contractCheck(room.game, manager, offer.place, years, salary, room.rng)) {
        room.offers.splice(idx, 1);
        rejectOffer(room.game, offer, room.rng);
        room.log.push(`${room.game.managers.at(manager).displayName}: ${offer.name} lehnt ${salary} DM für ${years} Jahre ab`);
        room.version++;
        broadcast();
        return json(res, 200, { ok: false, message: `${offer.name} ${texte("ui.keinInteresse").join(" ")}` });
      }
      offer.yearsTo = years;
      offer.salary = salary;
    }
    room.offers.splice(idx, 1);
    if (body.accept) {
      acceptOffer(room.game, offer);
      room.log.push(`${room.game.managers.at(manager).displayName}: Vertrag mit ${offer.name} bis ${offer.yearsTo} Jahre verlängert (${offer.salary} DM)`);
    } else declineOffer(room.game, offer);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/options") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (body.tempo !== undefined) room.options.tempo = Math.max(1, Math.min(9, Math.trunc(Number(body.tempo))));
    // Die fünfzehn Schalter des Originals führen die Einstellungen; Torszenen (9) und
    // Zeitung (13) sind dieselben, die es im Remake schon gab
    if (body.scenes !== undefined) room.options.flags[OPTION_SCENES] = Boolean(body.scenes);
    if (body.zeitung !== undefined) room.options.flags[OPTION_ZEITUNG] = Boolean(body.zeitung);
    if (body.flag !== undefined) {
      const i = Math.trunc(Number(body.flag));
      if (i >= 0 && i < room.options.flags.length) room.options.flags[i] = Boolean(body.value);
    }
    room.options.scenes = room.options.flags[OPTION_SCENES];
    room.options.zeitung = room.options.flags[OPTION_ZEITUNG];
    if (room.live) {
      room.live.tempoMs = tempoMs(room.options.tempo);
      room.live.scenesOn = room.options.scenes;
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, options: room.options });
  }
  if (p === "/api/abschluss") {
    // Abschlussbild weggeklickt: im Original genügt ein Klick, dann geht es weiter
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const idx = room.abschluss.findIndex((a) => a.manager === manager);
    if (idx >= 0) room.abschluss.splice(idx, 1);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/hinweis") {
    // Hinweiskasten weggeklickt (OKAY): der älteste Hinweis dieses Managers ist erledigt
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const idx = room.hinweise.findIndex((h) => h.manager === manager);
    if (idx >= 0) room.hinweise.splice(idx, 1);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/jugend") {
    // Jugendarbeit (Version 2026, #4): Mannschaften anlegen und Förderung schalten
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (!is2026(room.game)) return json(res, 400, { error: "Nur in der Version 2026" });
    const was = String(body.was ?? "foerdern");
    if (was === "anlegen") {
      if (!jugendVorhanden(room.game)) {
        jugendAnlegen(room.game, room.rng);
        room.log.push("Jugendmannschaften angelegt");
        room.version++;
        broadcast();
      }
      return json(res, 200, { ok: true });
    }
    if (was === "foerdern") {
      const erg = foerdern(
        room.game,
        manager,
        Math.trunc(Number(body.team)),
        Math.trunc(Number(body.platz)),
        body.geld === undefined ? undefined : Boolean(body.geld),
        body.training === undefined ? undefined : Math.trunc(Number(body.training)),
      );
      if (!erg.ok) return json(res, 400, { error: erg.error });
      room.version++;
      broadcast();
      return json(res, 200, { ok: true });
    }
    if (was === "aufruecken") {
      const erg = jugendAufruecken(room.game, manager, Math.trunc(Number(body.platz)), room.rng);
      if (!erg.ok) return json(res, 400, { error: erg.error });
      const wer = room.game.managers.at(manager).displayName;
      room.jugendFrisch.push({ manager, place: erg.place, name: erg.name, preis: jugendPreis(room.game, manager, erg.place) });
      room.log.push(`Jugend ${wer}: ${erg.name} rückt in die Männermannschaft auf (Stärke ${erg.staerke})`);
      pushMessage(room, manager, [`${erg.name} r}ckt in die`, "Mannschaft auf."]);
      // Die anderen erfahren davon und dürfen ihn bis zum Tageswechsel abwerben (#4, Stufe 2)
      room.game.activeManagers().forEach((_, i) => {
        if (i === manager || isAi(room.game, i)) return;
        pushMessage(room, i, [`${wer} holt`, `${erg.name} aus der Jugend.`, "Abwerben m|glich."]);
      });
      flushMessages(room);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, place: erg.place, name: erg.name });
    }
    if (was === "abwerben") {
      const owner = Math.trunc(Number(body.owner));
      const place = Math.trunc(Number(body.place));
      const frisch = room.jugendFrisch.find((x) => x.manager === owner && x.place === place);
      if (!frisch) return json(res, 400, { error: "Spieler steht nicht mehr zur Abwerbung" });
      const name = frisch.name;
      const erg = jugendAbwerben(room.game, manager, owner, place, Math.trunc(Number(body.bonus) || 0), room.rng);
      if (!erg.ok) return json(res, 400, { error: erg.error });
      const wer = room.game.managers.at(manager).displayName;
      if (!erg.agreed) {
        room.log.push(`Jugend: ${name} bleibt bei ${room.game.managers.at(owner).displayName} (${wer} abgeblitzt)`);
        pushMessage(room, manager, [name, "bleibt, wo er ist."]);
      } else {
        room.jugendFrisch = room.jugendFrisch.filter((x) => x !== frisch);
        room.log.push(`Jugend: ${wer} wirbt ${name} von ${room.game.managers.at(owner).displayName} ab (${dmText(erg.amount)})`);
        pushMessage(room, manager, [name, "wechselt zu Ihnen.", dmText(erg.amount)]);
        pushMessage(room, owner, [`${name} verl{sst Sie`, `Richtung ${wer}.`, dmText(erg.amount)]);
      }
      flushMessages(room);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, agreed: erg.agreed, amount: erg.amount, chance: erg.chance });
    }
    return json(res, 400, { error: "Unbekannter Auftrag" });
  }
  if (p === "/api/szene") {
    // Torszenen-Editor (GitLab #6): Beschreibungen liegen in tore-eigen/, die gebauten Szenen
    // in assets/eigen/tore/ - von dort lädt sie der Browser zum Katalog des Originals dazu.
    const quelle = join(root, "tore-eigen");
    const ziel = join(root, "assets", "eigen", "tore");
    const was = String(body.was ?? "liste");
    if (was === "liste") {
      let namen: string[] = [];
      try {
        namen = readdirSync(quelle).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
      } catch {
        /* noch keine eigenen Szenen */
      }
      return json(res, 200, { ok: true, namen });
    }
    if (was === "laden") {
      const name = String(body.name ?? "").replace(/[^a-z0-9_-]/gi, "");
      if (!name) return json(res, 400, { error: "Kein Name" });
      try {
        return json(res, 200, { ok: true, beschreibung: JSON.parse(readFileSync(join(quelle, `${name}.json`), "utf8")) });
      } catch {
        return json(res, 404, { error: "Beschreibung nicht gefunden" });
      }
    }
    if (was === "speichern") {
      const b = body.beschreibung as Parameters<typeof baueSzene>[0];
      if (!b || typeof b !== "object") return json(res, 400, { error: "Keine Beschreibung" });
      b.name = String(b.name ?? "").replace(/[^a-z0-9_-]/gi, "") || "szene";
      const fehler = pruefeBeschreibung(b);
      if (fehler.length) return json(res, 400, { error: fehler[0] });
      mkdirSync(quelle, { recursive: true });
      mkdirSync(ziel, { recursive: true });
      writeFileSync(join(quelle, `${b.name}.json`), JSON.stringify(b, null, 2) + "\n");
      const fassungen: [string, ReturnType<typeof baueSzene>][] = [[".T", baueSzene(b)]];
      if (b.chance) fassungen.push([".V", baueSzene(alsFassung(b, b.chance))]);
      for (const [endung, szene] of fassungen) writeFileSync(join(ziel, `${b.name}${endung}.json`), JSON.stringify(szene));
      // Verzeichnis fortschreiben
      let liste: string[] = [];
      try {
        liste = JSON.parse(readFileSync(join(ziel, "szenen.json"), "utf8")) as string[];
      } catch {
        /* noch keins */
      }
      for (const [endung] of fassungen) if (!liste.includes(`${b.name}${endung}`)) liste.push(`${b.name}${endung}`);
      liste.sort();
      writeFileSync(join(ziel, "szenen.json"), JSON.stringify(liste, null, 2) + "\n");
      room?.log.push(`Torszene "${b.name}" gespeichert (${b.bilder} Bilder${b.chance ? ", mit Chancenfassung" : ""})`);
      return json(res, 200, { ok: true, bilder: b.bilder, fassungen: fassungen.length });
    }
    return json(res, 400, { error: "Unbekannter Auftrag" });
  }
  if (p === "/api/medizin") {
    // Medizinische Versorgung (Version 2026, #2): Behandlungsstufe eines verletzten Spielers
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const erg = medSet(room.game, manager, Math.trunc(Number(body.place)), Math.trunc(Number(body.level)));
    if (!erg.ok) return json(res, 400, { error: erg.error });
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/doping") {
    // Doping (Version 2026, #3): Kur eines Spielers an- oder abschalten
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const place = Math.trunc(Number(body.place));
    const an = Boolean(body.on);
    const erg = an ? dopeStart(room.game, manager, place) : dopeStop(room.game, manager, place);
    if (!erg.ok) return json(res, 400, { error: erg.error });
    const l = room.game.lineups.at(manager * 25 + place);
    room.log.push(`${room.game.managers.at(manager).displayName}: ${room.game.players.at(l.playerIndex).displayName} ${an ? "beginnt eine Dopingkur" : "beendet die Dopingkur"}`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, rows: dopingRows(room.game, manager) });
  }
  if (p === "/api/market/list") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const result = listPlayer(room.game, manager, Number(body.place));
    if (!result.ok) return json(res, 400, { error: result.error });
    room.log.push(`${room.game.managers.at(manager).displayName}: Spieler auf den Transfermarkt gesetzt`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/takeback") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const result = takeBack(room.game, manager, Number(body.slot));
    if (!result.ok) return json(res, 400, { error: result.error });
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/offer") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const where = body.where === "market" ? "market" : "squad";
    const offer = saleOffer(room.game, manager, where, Number(body.place), room.rng);
    if (!offer) return json(res, 404, { error: "Kein Angebot" });
    room.sales.set(manager, offer);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, offer });
  }
  if (p === "/api/market/decide") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const offer = room.sales.get(manager);
    if (!offer) return json(res, 404, { error: "Kein Angebot" });
    room.sales.delete(manager);
    const result = decideSale(room.game, offer, Boolean(body.sell), room.rng);
    if (!result.ok) return json(res, 400, { error: result.error });
    if (body.sell) room.log.push(`${room.game.managers.at(manager).displayName}: ${offer.name} für ${offer.fee} DM an ${room.game.clubs.at(offer.club).displayName} verkauft`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/buy") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.purchases.has(manager)) return json(res, 409, { error: "Erst den Vertrag aushandeln" });
    const slot = Number(body.slot);
    const amount = Math.trunc(Number(body.amount));
    const loan = Boolean(body.loan);
    const entry = marketEntries(room.game).find((e) => e.slot === slot);
    if (!entry) return json(res, 404, { error: "Kein Spieler" });
    if (isBlocked(room.game, manager)) return json(res, 400, { error: "Kaufsperre: Ihr Konto stand am Monatsende zu tief im Minus" });
    // Bietgefecht (Version 2026): Gebote auf Spieler ohne Manager laufen bis zum Tageswechsel
    if (is2026(room.game) && entry.owner === MARKET_MANAGER) {
      if (!(amount > 0)) return json(res, 400, { error: "Ihr Angebot?" });
      if (room.game.managers.at(manager).balance < amount) return json(res, 400, { error: texte("ui.zuwenig").join(" ") });
      let frei = 0;
      while (frei < 24 && !room.game.lineups.at(manager * 25 + frei).isEmpty) frei++;
      if (frei >= 24) return json(res, 400, { error: "Ihr Kader ist voll" });
      const liste = room.auctions.get(entry.playerIndex)?.bids ?? [];
      const gebote = liste.filter((x) => x.manager !== manager);
      gebote.push({ manager, amount, loan });
      room.auctions.set(entry.playerIndex, { name: entry.name, bids: gebote });
      const wer = room.game.managers.at(manager).displayName;
      room.log.push(`${wer} bietet ${dmText(amount)} für ${entry.name}${loan ? " (Leihe)" : ""} - Zuschlag beim Tageswechsel`);
      room.game.activeManagers().forEach((_, i) => {
        if (i !== manager && !isAi(room.game, i)) pushMessage(room, i, [`${wer} bietet auf`, entry.name + ".", "Bieten Sie mit?"]);
      });
      flushMessages(room);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, auction: true, message: `Gebot ${dmText(amount)} für ${entry.name} steht bis zum Tageswechsel` });
    }
    const result = buyOffer(room.game, manager, slot, amount, loan, room.rng);
    const name = room.game.managers.at(manager).displayName;
    if (!result.ok) {
      room.version++;
      broadcast();
      return json(res, 400, { error: result.error });
    }
    if (result.state === "contract") room.purchases.set(manager, { slot, playerIndex: entry.playerIndex, name: entry.name, amount, demands: result.demands });
    else if (result.state === "pending") {
      room.marketOffers = room.marketOffers.filter((o) => !(o.buyer === manager && o.slot === slot));
      room.marketOffers.push({ buyer: manager, owner: entry.owner, slot, playerIndex: entry.playerIndex, name: entry.name, amount, loan });
      room.log.push(`${name} bietet ${room.game.managers.at(entry.owner).displayName} ${amount} DM für ${entry.name}${loan ? " (Leihe)" : ""}`);
    } else room.log.push(`${name}: ${entry.name} für ${amount} DM ausgeliehen`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, result });
  }
  if (p === "/api/market/contract") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const pu = room.purchases.get(manager);
    if (!pu) return json(res, 404, { error: "Kein Kauf offen" });
    const entry = marketEntries(room.game).find((e) => e.slot === pu.slot && e.playerIndex === pu.playerIndex);
    if (!entry) {
      room.purchases.delete(manager);
      return json(res, 409, { error: "Der Spieler ist nicht mehr da" });
    }
    const years = Math.trunc(Number(body.years));
    if (body.accept && body.salary !== undefined) {
      // Eigenes Angebot (0x249E0 mit den Daten des Marktplatzes); bei Ablehnung bleibt der Kauf offen
      const salary = Math.trunc(Number(body.salary));
      if (!(years >= 1) || !(salary >= 0)) return json(res, 400, { error: "Angabe ungültig" });
      if (years > MAX_CONTRACT_YEARS) return json(res, 200, { ok: false, message: tooLongText() });
      if (!contractCheck(room.game, manager, 0, years, salary, room.rng, { manager: MARKET_MANAGER, place: pu.slot })) {
        // Wie ABBRUCH: der Spieler bleibt auf dem Markt, das Ablehnungsbit wird gesetzt
        room.purchases.delete(manager);
        cancelPurchase(room.game, manager, pu.slot);
        room.log.push(`${room.game.managers.at(manager).displayName}: ${pu.name} lehnt ${salary} DM für ${years} Jahre ab`);
        room.version++;
        broadcast();
        return json(res, 200, { ok: false, message: `${pu.name} ${texte("ui.keinInteresse").join(" ")}` });
      }
      pu.demands[years - 1] = salary;
    }
    room.purchases.delete(manager);
    if (!body.accept || !(years >= 1 && years <= 4)) {
      cancelPurchase(room.game, manager, pu.slot);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, cancelled: true });
    }
    const salary = pu.demands[years - 1];
    const place = completePurchase(room.game, manager, pu.slot, pu.amount, years, salary, room.rng);
    if (place < 0) return json(res, 400, { error: texte("ui.keintransfer").join(" ") });
    autoLineupIfEnabled(room.game, manager); // 0x22FBA
    room.log.push(`${room.game.managers.at(manager).displayName}: ${pu.name} für ${pu.amount} DM gekauft (${years} Jahre, ${salary} DM)`);
    // Sponsor-Zuschuss (0x0272D): mit 1/7 ein Angebot über random(20,65) % des Preises
    const subsidy = sponsorSubsidy(pu.amount, room.rng);
    if (subsidy > 0) room.subsidies.set(manager, subsidy);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/system") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const system = Math.trunc(Number(body.system));
    if (!(system >= 1 && system <= 4)) return json(res, 400, { error: "System ungültig" });
    if (room.live && !room.live.paused) return json(res, 409, { error: "Erst das Spiel unterbrechen" });
    // Systemwahl im Kaderbildschirm (0x21776) mit sofortiger Aufstellung (0x217B8)
    const vorher = room.game.save.plain.slice(SQUAD_OFFSET + manager * SQUAD_BYTES, SQUAD_OFFSET + (manager + 1) * SQUAD_BYTES);
    setSystem(room.game, manager, system);
    autoLineupIfEnabled(room.game, manager);
    // Im laufenden Spiel zählt das als Auswechslung: die automatische Aufstellung füllte sonst
    // auch den Platz eines vom Feld gestellten Spielers wieder auf (GitLab #53)
    if (room.live) {
      const sub = applySubstitutions(room.live, room.game, manager, vorher, room.rng);
      if (!sub.ok) {
        room.game.save.plain.set(vorher, SQUAD_OFFSET + manager * SQUAD_BYTES);
        return json(res, 400, { error: sub.error });
      }
    }
    room.log.push(`${room.game.managers.at(manager).displayName}: Aufstellung ${SYSTEM_NAMES[system - 1]}`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/subsidy") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const amount = room.subsidies.get(manager);
    if (amount === undefined) return json(res, 404, { error: "Kein Zuschuss offen" });
    room.subsidies.delete(manager);
    if (body.accept) {
      acceptSubsidy(room.game, manager, amount);
      room.log.push(`${room.game.managers.at(manager).displayName}: Sponsor-Zuschuss ${amount} DM angenommen`);
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/answer") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const buyer = Number(body.buyer);
    const slot = Number(body.slot);
    const i = room.marketOffers.findIndex((o) => o.owner === manager && o.buyer === buyer && o.slot === slot);
    if (i < 0) return json(res, 404, { error: "Kein Angebot" });
    const offer = room.marketOffers.splice(i, 1)[0];
    const entry = marketEntries(room.game).find((e) => e.slot === slot && e.playerIndex === offer.playerIndex);
    if (!entry) return json(res, 409, { error: "Der Spieler ist nicht mehr da" });
    const owner = room.game.managers.at(manager).displayName;
    const buyerName = room.game.managers.at(buyer).displayName;
    if (!body.accept) {
      cancelPurchase(room.game, buyer, slot);
      pushMessage(room, buyer, [owner, "lehnt Ihr Angebot für", offer.name, "ab."]);
      flushMessages(room);
      room.log.push(`${owner} lehnt das Angebot von ${buyerName} für ${offer.name} ab`);
    } else {
      if (room.game.managers.at(buyer).balance < offer.amount) return json(res, 400, { error: "Der Käufer hat nicht genug Geld" });
      if (offer.loan) {
        const place = completeLoan(room.game, buyer, slot, offer.amount, manager, room.rng);
        if (place < 0) return json(res, 400, { error: texte("ui.keintransfer").join(" ") });
      } else {
        // Wie im Original folgt die Vertragsverhandlung des Käufers (0x251FF); sie läuft im Marktbildschirm des Käufers
        let free = 0;
        while (free < 24 && !room.game.lineups.at(buyer * 25 + free).isEmpty) free++;
        if (free >= 24) return json(res, 400, { error: texte("ui.keintransfer").join(" ") });
        const demands = [1, 2, 3, 4].map((years) => salaryDemand(room.game, buyer, free, years, { manager: MARKET_MANAGER, place: slot }));
        room.purchases.set(buyer, { slot, playerIndex: offer.playerIndex, name: offer.name, amount: offer.amount, demands });
      }
      pushMessage(room, buyer, [owner, "nimmt Ihr Angebot für", offer.name, offer.loan ? "an." : "an - Vertrag aushandeln!"]);
      flushMessages(room);
      room.log.push(`${owner} verkauft ${offer.name} für ${offer.amount} DM an ${buyerName}${offer.loan ? " (Leihe)" : ""}`);
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/stadium/decline") {
    // Angebot abgelehnt: für diese Ausbauart gibt es heute keine Baufirma mehr (0x7E9)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    room.bauAbgelehnt.add(`${manager}:${Math.trunc(Number(body.kind))}`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/stadium/bauzeit") {
    // Bauzeit für die Rückfrage: einmal je Ausbauart und Tag gewürfelt, damit im Kasten und im
    // Bauplan dieselbe Zahl steht (0x0000; GitLab #55)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const kind = Math.trunc(Number(body.kind));
    if (!(kind >= 1 && kind <= 7)) return json(res, 400, { error: "Ausbauart ungültig" });
    const key = `${manager}:${kind}`;
    let days = room.bauTage.get(key);
    if (days === undefined) {
      days = buildDays(room.game, manager, kind, room.rng);
      room.bauTage.set(key, days);
    }
    return json(res, 200, { ok: true, days });
  }
  if (p === "/api/stadium") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.bauAbgelehnt.has(`${manager}:${Math.trunc(Number(body.kind))}`)) {
      const abs = stadiumMessages();
      return json(res, 400, { error: `${abs[2]} ${abs[3]}` });
    }
    const result = extendStadium(room.game, manager, Number(body.kind), Number(body.amount), room.rng, room.bauTage.get(`${manager}:${Math.trunc(Number(body.kind))}`));
    if (!result.ok) return json(res, 400, { error: result.error });
    room.log.push(`${room.game.managers.at(manager).displayName}: ${stadiumKinds()[Number(body.kind) - 1].name} (${result.cost} DM, ca. ${buildWeeks(result.days)} Wochen)`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, result });
  }
  if (p === "/api/position") {
    // Spielerposition auf dem Spielfeld: Kaderbytes 25 (Spalte 0..6) und 26 (Reihe 0..7).
    // Steht dort schon ein Mitspieler, tauschen die beiden die Plätze (0x21776).
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.live && !room.live.paused) return json(res, 409, { error: "Erst das Spiel unterbrechen" });
    const place = Number(body.place) | 0;
    const col = Math.max(0, Math.min(6, Number(body.col) | 0));
    const row = Math.max(0, Math.min(7, Number(body.row) | 0));
    const squad = room.game.squadOf(manager);
    const l = squad[place];
    if (!l || l.number < 1 || l.number > 11) return json(res, 400, { error: "kein Spieler der ersten Elf" });
    const other = squad.find((x, i) => i !== place && x.number >= 1 && x.number <= 11 && x.u8(25) === col && x.u8(26) === row);
    if (other) {
      other.setU8(25, l.u8(25));
      other.setU8(26, l.u8(26));
    }
    l.setU8(25, col);
    l.setU8(26, row);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/einsatz") {
    // Einsatzregler des Kaderbildschirms: Managerbyte 305, 0..34 (Vorgabe 16, Maximum 34;
    // durch Vergleich der Spielstände CLAUDE.MAN und EINSATY.MAN bestimmt)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.live && !room.live.paused) return json(res, 409, { error: "Erst das Spiel unterbrechen" });
    const v = Math.max(0, Math.min(34, Number(body.value) | 0));
    room.game.managers.at(manager).setU8(305, v);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/ticket") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const err = setTicketPrice(room.game, manager, Number(body.price));
    if (err) return json(res, 400, { error: err });
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/loan") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const d = room.game.date;
    const lender = body.lender === undefined ? BANK : Number(body.lender);
    const months = Number(body.months);
    const rate = Number(body.rate);
    // Version 2026: an das Geld eines Mitspielers kommt nur, wer ihn fragt - er setzt die
    // Bedingungen oder lehnt ab (sim/regeln.ts)
    if (lender !== BANK && is2026(room.game)) {
      const amount = Math.trunc(Number(body.amount));
      const fehler = loanRequestCheck(room.game, manager, amount, lender);
      if (fehler) return json(res, 400, { error: fehler });
      if (isAi(room.game, lender)) return json(res, 400, { error: "Der Rechner verleiht kein Geld" });
      room.loanRequests = room.loanRequests.filter((q) => !(q.borrower === manager && q.lender === lender));
      room.loanRequests.push({ borrower: manager, lender, amount });
      const wer = room.game.managers.at(manager).displayName;
      room.log.push(`${wer} bittet ${room.game.managers.at(lender).displayName} um ${dmText(amount)}`);
      pushMessage(room, lender, [`${wer} bittet Sie`, "um einen Kredit von", dmText(amount)]);
      flushMessages(room);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, pending: true, message: `Anfrage über ${dmText(amount)} gestellt` });
    }
    const err = takeLoan(room.game, manager, Number(body.amount), months, rate, { day: d.day, month0: d.month - 1, year: d.year }, lender);
    if (err) return json(res, 400, { error: err });
    const von = lender === BANK ? "der Bank" : room.game.managers.at(lender).displayName;
    room.log.push(`${room.game.managers.at(manager).displayName}: Kredit von ${von} über ${Number(body.amount)} DM, ${months} Mon. zu ${rate} %`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/poach") {
    // Abwerben (Version 2026): der Spieler entscheidet, der Werbende zahlt und kann nicht zurück
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.live) return json(res, 409, { error: "Die Konferenz läuft" });
    const owner = Number(body.owner) | 0;
    const place = Number(body.place) | 0;
    const bonus = Number(body.bonus) | 0;
    const l = room.game.lineups.at(owner * 25 + place);
    if (l.isEmpty) return json(res, 400, { error: "Kein Spieler" });
    const name = room.game.players.at(l.playerIndex).displayName;
    const schluessel = `${manager}:${l.playerIndex}`;
    if (room.poachTried.has(schluessel)) return json(res, 409, { error: `${name} will heute nicht mehr reden` });
    if (isBlocked(room.game, manager)) return json(res, 400, { error: "Kaufsperre: Ihr Konto stand am Monatsende zu tief im Minus" });
    const pruef = poachCheck(room.game, manager, owner, place, bonus);
    if (!pruef.ok) return json(res, 400, { error: pruef.error });
    room.poachTried.add(schluessel);
    // Gegenwehr (Version 2026): der Besitzer erfährt davon und darf mit einer Gehaltserhöhung
    // antworten; erst danach - spätestens beim Tageswechsel - entscheidet der Spieler
    if (!isAi(room.game, owner)) {
      room.poachRequests = room.poachRequests.filter((q) => !(q.poacher === manager && q.playerIndex === l.playerIndex));
      room.poachRequests.push({ poacher: manager, owner, place, bonus, playerIndex: l.playerIndex, name });
      const wer = room.game.managers.at(manager).displayName;
      room.log.push(`${wer} wirbt um ${name} (${room.game.managers.at(owner).displayName}), Angebot ${dmText(pruef.amount)}`);
      pushMessage(room, owner, [`${wer} will Ihnen`, `${name} abwerben.`, "Wehren Sie sich!"]);
      flushMessages(room);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, pending: true, amount: pruef.amount, message: `${name} überlegt - ${room.game.managers.at(owner).displayName} darf sich wehren` });
    }
    const r = poachAusfuehren(room, { poacher: manager, owner, place, bonus, playerIndex: l.playerIndex, name }, 0);
    if (!r) return json(res, 400, { error: "Der Wechsel findet nicht statt" });
    await persist(room);
    room.version++;
    broadcast();
    const besitzer = room.game.managers.at(owner).displayName;
    const message = r.agreed ? `${name} wechselt zu Ihnen (${dmText(r.amount)})` : `${name} bleibt bei ${besitzer} (Zustimmung ${r.chance} %)`;
    return json(res, 200, { ok: true, agreed: r.agreed, amount: r.amount, chance: r.chance, name, message });
  }
  if (p === "/api/poach/answer") {
    // Gegenwehr des Besitzers (Version 2026): Gehaltserhöhung 0..50 %, danach entscheidet der Spieler
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const idx = room.poachRequests.findIndex((q) => q.owner === manager && q.playerIndex === (Number(body.playerIndex) | 0));
    if (idx < 0) return json(res, 404, { error: "Keine Anfrage offen" });
    const q = room.poachRequests[idx];
    const counter = Math.max(0, Math.min(POACH_COUNTER_MAX, Number(body.counter) | 0));
    room.poachRequests.splice(idx, 1);
    if (counter > 0) {
      const neuesGehalt = raiseSalary(room.game, q.owner, q.place, counter);
      room.log.push(`${room.game.managers.at(q.owner).displayName} h{lt ${q.name} mit ${counter} % mehr Gehalt (${dmText(neuesGehalt)})`.replace("h{lt", "hält"));
      pushMessage(room, q.poacher, [`${room.game.managers.at(q.owner).displayName}`, `erh|ht das Gehalt`, `von ${q.name} um ${counter} %`]);
    }
    const r = poachAusfuehren(room, q, counter);
    if (!r) return json(res, 400, { error: "Der Wechsel findet nicht statt" });
    await persist(room);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, agreed: r.agreed, chance: r.chance, message: r.agreed ? `${q.name} wechselt trotzdem` : `${q.name} bleibt bei Ihnen` });
  }
  if (p === "/api/derby") {
    // Einsatz für Spiele gegen andere Managervereine (Version 2026)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (!is2026(room.game)) return json(res, 400, { error: "Nur in der Version 2026" });
    setStakeLevel(room.game, manager, Number(body.level) | 0);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/free/bid") {
    // Angebot für einen ablösefreien Spieler (Version 2026)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const spieler = Number(body.playerIndex) | 0;
    const agent = room.freeAgents.find((a) => a.playerIndex === spieler);
    if (!agent) return json(res, 404, { error: "Der Spieler ist nicht mehr frei" });
    if (isBlocked(room.game, manager)) return json(res, 400, { error: "Kaufsperre: Ihr Konto stand am Monatsende zu tief im Minus" });
    const salary = Math.max(0, Math.trunc(Number(body.salary)));
    agent.bids = agent.bids.filter((b) => b.manager !== manager);
    if (salary > 0) agent.bids.push({ manager, salary });
    room.log.push(`${room.game.managers.at(manager).displayName} bietet ${agent.name} ${dmText(salary)} Monatsgehalt`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, message: `Angebot ${dmText(salary)} für ${agent.name}` });
  }
  if (p === "/api/loan/answer") {
    // Geldgeber entscheidet über eine Kreditanfrage (Version 2026): Laufzeit und Zins sind seine
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const borrower = Number(body.borrower) | 0;
    const idx = room.loanRequests.findIndex((q) => q.lender === manager && q.borrower === borrower);
    if (idx < 0) return json(res, 404, { error: "Keine Anfrage offen" });
    const q = room.loanRequests[idx];
    room.loanRequests.splice(idx, 1);
    const wer = room.game.managers.at(manager).displayName;
    const bittsteller = room.game.managers.at(borrower).displayName;
    if (!body.accept) {
      room.log.push(`${wer} lehnt den Kredit für ${bittsteller} ab`);
      pushMessage(room, borrower, [`${wer} gibt Ihnen`, "kein Geld."]);
      flushMessages(room);
      room.version++;
      broadcast();
      return json(res, 200, { ok: true, message: `Anfrage von ${bittsteller} abgelehnt` });
    }
    const d2 = room.game.date;
    const err = takeLoan(room.game, borrower, q.amount, Number(body.months), Number(body.rate), { day: d2.day, month0: d2.month - 1, year: d2.year }, manager);
    if (err) {
      room.loanRequests.push(q);
      return json(res, 400, { error: err });
    }
    room.log.push(`${wer} gibt ${bittsteller} ${dmText(q.amount)} zu ${Number(body.rate)} % für ${Number(body.months)} Monate`);
    pushMessage(room, borrower, [`${wer} gibt Ihnen`, `${dmText(q.amount)} zu`, `${Number(body.rate)} % f}r ${Number(body.months)} Mon.`]);
    flushMessages(room);
    await persist(room);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, message: `${bittsteller} bekommt ${dmText(q.amount)}` });
  }
  if (p === "/api/training") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const st = body.settings as TrainingSettings;
    const err = setTraining(room.game, manager, { balls: (st?.balls ?? []).map(Number), intensityBalls: Number(st?.intensityBalls), positions: (st?.positions ?? []).map(Number), slider: Number(st?.slider) });
    if (err) return json(res, 400, { error: err });
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/camp") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (room.live) return json(res, 409, { error: "Die Konferenz läuft" });
    const camp = Number(body.camp);
    if (!Number.isInteger(camp) || camp < 0 || camp >= camps().length) return json(res, 400, { error: "Unbekanntes Lager" });
    if (room.campOpen[camp] > 0) return json(res, 409, { error: `${camps()[camp].name} ${texte("ui.lagerzu")[0]}` });
    const result = trainingCamp(room.game, manager, camp, room.rng);
    if (typeof result === "string") return json(res, 400, { error: result });
    room.log.push(`${room.game.managers.at(manager).displayName}: Trainingslager ${camps()[camp].name} (${result.cost} DM), Frische ${result.freshness}, St{rken ${result.strength.join("/")}`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, result });
  }
  if (p === "/api/werbebudget") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    // Werbeausgaben je Klick um 2500 DM (0x29455); über 50.000 springt es auf 2.500 zurück
    const step = Number(body.up) === 0 ? -2500 : 2500;
    const off = ADV_OFFSET + manager * 36 + 4 * 8;
    const plain = room.game.save.plain;
    let v = (plain[off] | (plain[off + 1] << 8) | (plain[off + 2] << 16) | (plain[off + 3] << 24)) | 0;
    v += step;
    if (v > 50000) v = 2500;
    if (v < 2500) v = 50000;
    for (let i = 0; i < 4; i++) plain[off + i] = (v >>> (8 * i)) & 0xff;
    room.version++;
    broadcast();
    return json(res, 200, { ok: true, value: v });
  }
  if (p === "/api/werbung") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const sponsor = Number(body.sponsor);
    const result = body.kind === "board" ? signBoard(room.game, manager, Number(body.slot), sponsor) : signShirt(room.game, manager, sponsor);
    if (!result.ok) return json(res, 400, { error: result.error });
    room.log.push(`${room.game.managers.at(manager).displayName}: ${body.kind === "board" ? `Bandenwerbung Platz ${Number(body.slot) + 1}` : "Trikotwerbung"} mit Sponsor ${sponsor + 1} abgeschlossen`);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/messages/clear") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    room.save = room.save.clearMessages(manager);
    room.game = new GameState(room.save);
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/squad") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const bytes = Buffer.from(String(body.data ?? ""), "base64");
    if (bytes.length !== SQUAD_BYTES) return json(res, 400, { error: "Kaderblock hat falsche Länge" });
    if (room.live && !room.live.paused) return json(res, 409, { error: "Erst das Spiel unterbrechen" });
    const before = room.game.save.plain.slice(SQUAD_OFFSET + manager * SQUAD_BYTES, SQUAD_OFFSET + (manager + 1) * SQUAD_BYTES);
    room.game.save.plain.set(bytes, SQUAD_OFFSET + manager * SQUAD_BYTES);
    // Handänderung schaltet das System auf manuell (0x20226)
    setSystem(room.game, manager, SYSTEM_MANUAL);
    if (room.live) {
      const sub = applySubstitutions(room.live, room.game, manager, before, room.rng);
      if (!sub.ok) {
        room.game.save.plain.set(before, SQUAD_OFFSET + manager * SQUAD_BYTES);
        return json(res, 400, { error: sub.error });
      }
      room.log.push(`${room.game.managers.at(manager).displayName}: Auswechslung in der ${room.live.minute}. Minute`);
    }
    room.version++;
    broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/save") {
    const file = String(body.file ?? room.file).replace(/[^A-Za-z0-9_.-]/g, "").toUpperCase();
    if (!file.endsWith(".MAN")) return json(res, 400, { error: "Dateiname" });
    await writeFile(join(savesDir, file), room.save.withFreshHeader().encode());
    room.log.push(`gespeichert als ${file} (${user})`);
    return json(res, 200, { ok: true, file });
  }
  return json(res, 404, { error: "unbekannt" });
}

loadSessions();
// Beim Beenden (auch beim Neustart des Dienstes) den laufenden Stand noch sichern
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (room) {
      try {
        writeFileSync(join(savesDir, SERVER_SAVE), room.save.withFreshHeader().encode());
      } catch {
        // beim Beenden nicht weiter stören
      }
    }
    process.exit(0);
  });
}
createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  try {
    if (url.pathname.startsWith("/api/")) await api(req, url, res);
    else await serveStatic(url.pathname, res, sessionUser(req), ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? ""), req.headers.range, req.headers["if-none-match"]);
  } catch (err) {
    json(res, 500, { error: String((err as Error).message) });
  }
}).listen(port, async () => {
  let file = argOf("--load");
  if (existsSync(join(savesDir, SERVER_SAVE)) && !args.includes("--fresh")) file = SERVER_SAVE;
  if (file) {
    try {
      room = await loadRoom(file);
    } catch (err) {
      // Ein beschädigter Serverstand darf den Dienst nicht in eine Neustartschleife schicken
      console.error(`${file} nicht lesbar: ${String((err as Error).message)}`);
      const fallback = argOf("--load");
      if (fallback && fallback !== file) {
        console.error(`lade stattdessen ${fallback}`);
        room = await loadRoom(fallback);
        file = fallback;
      } else file = undefined;
    }
  }
  const users = loadUsers();
  console.log(`Bundesliga Manager Server: http://localhost:${port}/ ${file ? "(" + file + ")" : ""} Benutzer: ${users.size ? [...users.keys()].join(", ") : "keine (users.json fehlt)"}`);
});
