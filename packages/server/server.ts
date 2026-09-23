/**
 * Mehrspieler-Server: hält bis zu vier Spielrunden im Speicher, vergibt in jeder Sitzplätze je
 * Manager, sammelt "fertig"-Meldungen und schaltet den Tag weiter, sobald alle Manager einer
 * Runde fertig sind. Clients bekommen Änderungen per Server-Sent Events und laden dann den
 * Spielstand neu; jede Runde hat ihren eigenen Ereignisstrom (GitLab #65).
 *
 * Ordner: BMP_DIR/runden/<kennung>/SERVER.MAN je Runde, BMP_DIR/runden.json als Verzeichnis.
 * Gemeinsam bleiben MANA.DAT, die *.MAN zum Laden und Sichern und die Bestenliste HIGH.0x.
 *
 * Anmeldung: Benutzer mit Passwort-Hash (scrypt) in users.json, Sitzung per Cookie
 * (bmp_session), Sitzplätze sind an den angemeldeten Benutzer gebunden. Der Server ist für
 * den Betrieb hinter einem Reverse Proxy ausgelegt (relative Pfade im Client, Secure-Cookie
 * bei X-Forwarded-Proto https, SSE ohne Pufferung).
 *
 *   node packages/server/server.ts [--load DATEI.MAN] [--port 8765] [--fresh]
 *   --load legt ohne vorhandene Runde die erste daraus an, --fresh übergeht runden.json
 *   node packages/server/users.ts add NAME PASSWORT     (Benutzer anlegen, siehe users.ts)
 *   Umgebung: BMP_DIR (Ordner mit *.MAN), PORT, BMP_USERS (users.json), BMP_SESSIONS (sessions.json)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync, copyFileSync, renameSync, chmodSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import { randomBytes, createHash } from "node:crypto";
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
  scherztagWurf,
  christmasLines,
  playCupDay,
  playEuropaDay,
  playPlayoffDay,
  newSeason,
  releaseExpiring,
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
  type TeamStrength,
  type Nachspiel,
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
  tagesroutine,
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
  restoreSystem,
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
import { smtpZugang, sendeMail } from "./mail.ts";
import { hashPassword, verifyPassword, veraltet } from "./passwort.ts";
import { einladungsPost, ruecksetzPost } from "./einladung.ts";
import { startLive, tick, liveJson, results as liveResults, attendances as liveAttendances, nachspiele as liveNachspiele, incidentsOf, forfeitsOf, scorerLines, matchEvents, applySubstitutions, refreshStrength, setSceneFrames, HALFTIME, FULLTIME, type LiveState } from "./live.ts";

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

/**
 * Rollen (GitLab #65). "Manager" heißt im Spielstand schon der geführte Verein, darum heißt die
 * oberste Rolle Präsident. Einträge ohne Rolle gelten als Spieler: eine users.json aus der Zeit
 * davor bleibt lesbar und sperrt niemanden aus.
 */
type Rolle = "praesident" | "trainer" | "spieler";
const ROLLEN: Rolle[] = ["praesident", "trainer", "spieler"];

interface Benutzer {
  name: string;
  hash: string;
  rolle: Rolle;
  email?: string;
}

function loadUsers(): Map<string, Benutzer> {
  const out = new Map<string, Benutzer>();
  try {
    const data = JSON.parse(readFileSync(usersFile, "utf8")) as { users?: { name: string; hash: string; rolle?: string; email?: string }[] };
    for (const u of data.users ?? []) {
      if (!u.name) continue;
      const rolle = ROLLEN.includes(u.rolle as Rolle) ? (u.rolle as Rolle) : "spieler";
      // Ein Konto ohne Hash ist eingeladen, aber noch nicht freigeschaltet: anmelden kann es
      // sich nicht (verifyPassword scheitert an der leeren Zeichenkette).
      out.set(u.name, { name: u.name, hash: u.hash ?? "", rolle, email: u.email });
    }
  } catch {
    /* keine Benutzerdatei: niemand kann sich anmelden */
  }
  return out;
}

function rolleVon(user: string): Rolle {
  return loadUsers().get(user)?.rolle ?? "spieler";
}

/** Runden anlegen, laden und hochladen dürfen Präsident und Trainer. */
function darfRunden(user: string): boolean {
  const r = rolleVon(user);
  return r === "praesident" || r === "trainer";
}

/** Benutzer verwalten und fremde Runden löschen darf nur der Präsident. */
function darfVerwalten(user: string): boolean {
  return rolleVon(user) === "praesident";
}

function saveUsers(liste: Benutzer[]): void {
  const data = { users: liste.map((u) => ({ name: u.name, hash: u.hash, rolle: u.rolle, ...(u.email ? { email: u.email } : {}) })) };
  writeFileSync(usersFile, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  // Die Rechte gelten nur beim Anlegen; eine vorhandene Datei behielte ihre
  chmodSync(usersFile, 0o600);
}

// ---- Einladung und Passwort zurücksetzen (GitLab #65) ----------------------

/**
 * Einmalige Marken für den Link in der Mail. Gespeichert wird nur ihr Hash: wer die Datei
 * liest, kann damit kein Konto übernehmen. Eine Einladung gilt sieben Tage, ein Zurücksetzen
 * eine Stunde; gebraucht wird jede Marke nur einmal.
 */
const tokensFile = process.env.BMP_TOKENS ?? join(savesDir, "tokens.json");
const MARKE_EINLADUNG = 7 * 86400000;
const MARKE_RESET = 3600000;

interface Marke {
  user: string;
  art: "einladung" | "reset";
  ablauf: number;
}
const marken = new Map<string, Marke>();

function markeHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function ladeMarken(): void {
  try {
    const data = JSON.parse(readFileSync(tokensFile, "utf8")) as Record<string, Marke>;
    for (const [hash, m] of Object.entries(data)) if (m.ablauf > Date.now()) marken.set(hash, m);
  } catch {
    /* noch keine Marken */
  }
}

function sichereMarken(): void {
  try {
    for (const [hash, m] of [...marken]) if (m.ablauf <= Date.now()) marken.delete(hash);
    writeFileSync(tokensFile, JSON.stringify(Object.fromEntries(marken)), { mode: 0o600 });
    chmodSync(tokensFile, 0o600);
  } catch (err) {
    console.error("Marken nicht gesichert:", (err as Error).message);
  }
}

function neueMarke(user: string, art: "einladung" | "reset"): string {
  // Ältere Marken desselben Benutzers verfallen: zwei gültige Links nebeneinander braucht niemand
  for (const [hash, m] of [...marken]) if (m.user === user) marken.delete(hash);
  const token = randomBytes(24).toString("base64url");
  marken.set(markeHash(token), { user, art, ablauf: Date.now() + (art === "einladung" ? MARKE_EINLADUNG : MARKE_RESET) });
  sichereMarken();
  return token;
}

/**
 * Aussenadresse für die Links in den Mails. Sie **darf nicht** aus dem Host-Kopf der Anfrage
 * kommen: den schreibt der Anfragende. Wer das Zurücksetzen für einen anderen anstößt und dabei
 * einen fremden Host einträgt, bekommt sonst eine echte Mail mit einer gültigen Marke, die auf
 * seinen eigenen Rechner zeigt - ein Klick des Opfers, und das Konto gehört ihm.
 *
 * Darum steht die Adresse in BMP_BASE_URL. Fehlt sie, wird der Host nur benutzt, wenn er in
 * BMP_HOSTS steht (Liste mit Komma); sonst bleibt es bei localhost, und der Link taugt nur auf
 * dem Rechner selbst - unbequem, aber nicht gefährlich.
 */
const baseUrl = (process.env.BMP_BASE_URL ?? "").replace(/\/+$/, "");
const erlaubteHosts = new Set(
  (process.env.BMP_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

function aussenAdresse(req: IncomingMessage): string {
  if (baseUrl) return baseUrl;
  const roh = vomProxy(req) ? (req.headers["x-forwarded-host"] ?? req.headers.host) : req.headers.host;
  const host = String(roh ?? "").split(",")[0].trim().toLowerCase();
  if (host && erlaubteHosts.has(host)) return `${isHttps(req) ? "https" : "http"}://${host}`;
  if (host && !erlaubteHosts.size && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return `http://${host}`;
  return `http://localhost:${port}`;
}

/**
 * Einladung oder Rücksetzung verschicken. Ohne SMTP-Umgebung wandert der Link ins Protokoll -
 * so lässt sich auf dem eigenen Rechner ohne Postfach entwickeln.
 */
async function schickeLink(req: IncomingMessage, u: Benutzer, art: "einladung" | "reset"): Promise<void> {
  const link = `${aussenAdresse(req)}/einladung?t=${neueMarke(u.name, art)}`;
  const zugang = smtpZugang();
  const post = art === "einladung" ? einladungsPost(u.name, u.rolle, link) : ruecksetzPost(u.name, link);
  if (!zugang || !u.email) {
    console.log(`Kein Mailversand eingerichtet - Link für ${u.name}: ${link}`);
    return;
  }
  await sendeMail(zugang, u.email, post.betreff, post.text);
}

interface Session {
  user: string;
  created: number;
  /** Runde, in der dieser Benutzer sitzt (GitLab #65); fehlt sie, steht er in der Lobby. */
  room?: string;
}
const sessions = new Map<string, Session>();

function loadSessions(): void {
  try {
    const data = JSON.parse(readFileSync(sessionsFile, "utf8")) as Record<string, Session>;
    const limit = Date.now() - SESSION_DAYS * 86400000;
    // Schluessel sind die Hashes der Marken. Eine Datei aus der Zeit davor enthaelt die Marken
    // selbst; die passen zu keinem Cookie mehr, jeder meldet sich einmal neu an.
    for (const [token, s] of Object.entries(data)) {
      if (!s.user || s.created <= limit) continue;
      sessions.set(token, s);
      if (s.room != null) activeRoom.set(s.user, s.room);
    }
  } catch {
    /* keine gespeicherten Sitzungen */
  }
}

function saveSessions(): void {
  try {
    writeFileSync(sessionsFile, JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 });
    chmodSync(sessionsFile, 0o600);
  } catch (err) {
    console.error("Sitzungen sichern fehlgeschlagen:", (err as Error).message);
  }
}

/**
 * Sitzungen liegen unter dem Hash ihrer Marke, nicht unter der Marke selbst: wer sessions.json
 * in die Hand bekommt, hat damit noch keine gueltige Anmeldung. Die Marke hat 192 Bit aus dem
 * Zufallsgenerator, ein schnelles Verfahren reicht also.
 */
function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
  const s = sessions.get(sessionHash(token));
  if (!s || s.created < Date.now() - SESSION_DAYS * 86400000) return undefined;
  return s.user;
}

/**
 * Köpfe eines vorgeschalteten Proxys (X-Forwarded-*) darf man nur glauben, wenn die Anfrage auch
 * wirklich von ihm kommt: sonst schreibt sie der Anfragende selbst. In BMP_PROXY_IPS stehen die
 * Adressen der eigenen Proxys (Liste mit Komma); von allen anderen zählt allein, was die
 * Verbindung selbst hergibt. Ist der Dienst auch direkt erreichbar - im Heimnetz etwa -, hilft
 * ein bloßer Schalter "hinter mir steht ein Proxy" nämlich nicht.
 */
const proxyIps = new Set(
  (process.env.BMP_PROXY_IPS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
);

function vomProxy(req: IncomingMessage): boolean {
  const adr = req.socket.remoteAddress ?? "";
  return proxyIps.has(adr) || proxyIps.has(adr.replace(/^::ffff:/, ""));
}

function isHttps(req: IncomingMessage): boolean {
  if (!vomProxy(req)) return false;
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  return proto === "https";
}

function setSessionCookie(req: IncomingMessage, res: ServerResponse, token: string | null): void {
  const base = token ? `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` : `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  res.setHeader("set-cookie", isHttps(req) ? base + "; Secure" : base);
}

/** Fehlversuche je Adresse: nach fünf Fehlern in zehn Minuten wird abgewiesen. */
const failures = new Map<string, number[]>();

/**
 * Adresse des Anfragenden. Hinter einem Proxy steht die echte Adresse **hinten** in
 * X-Forwarded-For (nginx haengt sie mit $proxy_add_x_forwarded_for an) - der vordere Teil kommt
 * vom Anfragenden selbst und laesst sich frei erfinden. Wer den ersten Eintrag nimmt, hat keine
 * Bremse mehr, sondern nur noch deren Anschein.
 */
function clientAddress(req: IncomingMessage): string {
  if (vomProxy(req)) {
    const kette = String(req.headers["x-forwarded-for"] ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (kette.length) return kette[kette.length - 1];
  }
  return req.socket.remoteAddress || "?";
}

/**
 * Fehlversuche je Konto. Die Bremse je Adresse allein reicht nicht: wer ueber viele Adressen
 * kommt, probiert sonst ungezaehlt weiter. Gesperrt wird nichts - das koennte ein Fremder
 * benutzen, um jemanden auszusperren -, es wird nur langsam: je Fehlversuch der letzten zehn
 * Minuten kommt Wartezeit dazu, bis zu fuenf Sekunden.
 */
const kontoFehler = new Map<string, number[]>();
function kontoBremse(name: string): number {
  const jetzt = Date.now();
  const liste = (kontoFehler.get(name.toLowerCase()) ?? []).filter((t) => t > jetzt - 600000);
  kontoFehler.set(name.toLowerCase(), liste);
  return Math.min(5000, 250 * 2 ** Math.max(0, liste.length - 2));
}
function kontoFehlversuch(name: string): void {
  const k = name.toLowerCase();
  kontoFehler.set(k, [...(kontoFehler.get(k) ?? []), Date.now()]);
}
function tooManyFailures(addr: string): boolean {
  const now = Date.now();
  const list = (failures.get(addr) ?? []).filter((t) => t > now - 600000);
  failures.set(addr, list);
  return list.length >= 5;
}

// ---- Spielraum -------------------------------------------------------------

interface Room {
  /** Kennung der Runde; zugleich der Ordnername unter BMP_DIR/runden (GitLab #65) */
  id: string;
  /** Anzeigename in der Lobby */
  name: string;
  /** Wer die Runde angelegt hat: er darf sie ersetzen und löschen */
  creator: string;
  /** Angelegt am (ms seit 1970) */
  created: number;
  /** Geschlossene Runde: hinein kommt nur, wer eingeladen ist (GitLab #66) */
  privat: boolean;
  /** Eingeladene Benutzer; der Ersteller und der Präsident brauchen keinen Eintrag */
  gaeste: string[];
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
  /**
   * Wechselzähler des letzten Spiels (4238:90C6, Laufzeitdaten wie im Original): gehen in die
   * Anfangsstärke des nächsten Spiels ein und beginnen nach einem Neustart bei 0.
   */
  letzteWechsel?: LiveState["subs"];
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
    /**
     * Wettbewerbe, die nach diesem noch drankommen. Nach einem Pokaltag sind das genau die, die
     * eben neu ausgelost wurden (GitLab #71); fehlt die Liste, gilt die alte Reihenfolge über
     * alle Wettbewerbe mit Paarungen (Spielbeginn).
     */
    folge?: number[];
  };
  /** Protokollzeilen des zuletzt gespielten Tages (Ergebnisbildschirm) */
  lastDay: string[];
  /** Zeitgeber fürs Zwischenspeichern; je Runde einer, siehe schedulePersist */
  persistTimer?: NodeJS.Timeout;
}

/** Spielgeschwindigkeit 1..9 in Millisekunden je Spielminute (Vorgabe aus BMP_TEMPO_MS). */
function tempoMs(tempo: number): number {
  return Math.max(150, 2000 - 180 * tempo);
}
function tempoOf(ms: number): number {
  return Math.max(1, Math.min(9, Math.round((2000 - ms) / 180)));
}

// ---- Räume: mehrere Spielrunden gleichzeitig (GitLab #65) ------------------

/**
 * Jede Runde hat einen eigenen Ordner BMP_DIR/runden/<id> mit ihrem SERVER.MAN; das Verzeichnis
 * der Runden steht in BMP_DIR/runden.json. Gemeinsam bleiben die Installation (MANA.DAT), der
 * Vorrat der *.MAN zum Laden und Sichern und die Bestenliste HIGH.0x - so hielt es auch das
 * Original, dort gehören diese Dateien zur Installation und nicht zur Partie.
 */
const roundsDir = join(savesDir, "runden");
const roundsIndex = join(savesDir, "runden.json");
/** Höchstens vier Runden gleichzeitig (Entscheidung zu #65). */
const MAX_ROOMS = 4;

const rooms = new Map<string, Room>();
/** Nächste Kennung; einmal vergebene werden nicht wiederverwendet, damit Ordner eindeutig bleiben. */
let nextRoomId = 1;
/** In welcher Runde ein Benutzer gerade sitzt; steht auch in seinen Sitzungen (siehe joinRoom). */
const activeRoom = new Map<string, string>();
/** Zuhörer des Ereignisstroms mit ihrem Benutzer - der Raum wechselt, der Zuhörer bleibt. */
const listeners = new Map<ServerResponse, string>();

interface RoomMeta {
  id: string;
  name: string;
  creator: string;
  created: number;
  file: string;
  privat: boolean;
  gaeste: string[];
}

/**
 * Darf der Benutzer diese Runde betreten? Eine offene Runde steht allen offen; in eine
 * geschlossene kommt, wer sie angelegt hat, wer eingeladen ist, und der Präsident - er verwaltet
 * ohnehin die Konten und kann sich den Zutritt sonst in zwei Schritten selbst verschaffen.
 */
function darfBetreten(user: string, r: Room): boolean {
  // Kein Freibrief für herrenlose Runden: die aus der Zeit vor den Runden hat keinen Ersteller,
  // und "wer keinen Besitzer hat, steht allen offen" hebelte das Schloss genau dort aus.
  return !r.privat || r.creator === user || r.gaeste.includes(user) || darfVerwalten(user);
}

/** Wer die Runde einstellen darf: ihr Ersteller und der Präsident. */
function darfRundeVerwalten(user: string, r: Room): boolean {
  return r.creator === user || r.creator === "" || darfVerwalten(user);
}

function roomOf(user: string): Room | undefined {
  const id = activeRoom.get(user);
  return id ? rooms.get(id) : undefined;
}

/**
 * Einen Benutzer in eine Runde setzen (oder mit undefined zurück in die Lobby). Die Lobby wird
 * als leere Kennung vermerkt und nicht als fehlender Eintrag: "war noch nie in einer Runde" und
 * "hat die Runde verlassen" sind zweierlei, solange die Übergangshilfe in api() den Einzelgänger
 * in die einzige Runde setzt.
 */
function joinRoom(user: string, id: string | undefined): void {
  activeRoom.set(user, id ?? "");
  for (const s of sessions.values()) if (s.user === user) s.room = id ?? "";
  saveSessions();
}

/** Verzeichnis der Runden schreiben; die Laufzeitdaten einer Runde stehen bewusst nicht darin. */
function saveRounds(): void {
  try {
    const data = {
      next: nextRoomId,
      runden: [...rooms.values()].map((r) => ({ id: r.id, name: r.name, creator: r.creator, created: r.created, file: r.file, privat: r.privat, gaeste: r.gaeste })),
    };
    writeFileSync(roundsIndex, JSON.stringify(data, null, 2) + "\n");
  } catch (err) {
    console.error("runden.json nicht geschrieben:", (err as Error).message);
  }
}

function neueRundenKennung(): string {
  return `r${nextRoomId++}`;
}

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

/** Ereignisse einer Runde gehen nur an die Zuhörer, die auch in dieser Runde sitzen (#65). */
/** Das Protokoll einer Runde waechst sonst ueber Monate unbegrenzt mit. */
function kuerzeLog(r: Room): void {
  if (r.log.length > 2000) r.log.splice(0, r.log.length - 2000);
}

function broadcast(r: Room): void {
  kuerzeLog(r);
  const data = `data: ${JSON.stringify({ version: r.version, build: buildStamp(), live: r.live ? liveJson(r.live, r.game) : null })}\n\n`;
  for (const [res, user] of listeners) if (activeRoom.get(user) === r.id) res.write(data);
  schedulePersist(r);
}

/** In der Lobby hat sich etwas geändert: wer in keiner Runde sitzt, holt die Liste neu. */
function broadcastLobby(): void {
  const data = `data: ${JSON.stringify({ version: 0, build: buildStamp(), lobby: true })}\n\n`;
  for (const [res, user] of listeners) if (!roomOf(user)) res.write(data);
}

/**
 * Zwischenspeichern: der Stand wandert einige Sekunden nach der letzten Änderung in das
 * SERVER.MAN der Runde, nicht erst beim Tageswechsel. Sonst wäre alles verloren, was seit dem letzten
 * Tageswechsel passiert ist, wenn der Dienst neu startet.
 */
function schedulePersist(r: Room): void {
  if (r.persistTimer) return;
  r.persistTimer = setTimeout(() => {
    r.persistTimer = undefined;
    void persist(r);
  }, 3000);
  r.persistTimer.unref?.();
}

/** Alle Manager sind fertig: der Tag läuft. Die Hinweise des Zuges sind damit vorbei (#31). */
/**
 * Aufstellung übernehmen (GitLab #66). Der Client schickt seinen ganzen Kaderblock, aber ändern
 * darf er daran genau **eine** Sache: die Rückennummern, denn nur die vergibt er beim Tauschen
 * zweier Zeilen (1 bis 11 steht in der Mannschaft, ab 12 auf der Bank). Alles andere - Stärken,
 * Alter, Vertrag, Gehalt, welcher Spieler überhaupt im Kader steht - kommt aus dem Spielstand
 * des Servers und wird aus der Einsendung gar nicht erst gelesen.
 *
 * Geprüft wird außerdem, dass die Nummern dieselben bleiben und nur anders verteilt sind: sonst
 * setzte sich jemand elf Einsen in die Mannschaft. Rückgabe: Fehlertext oder "" bei Erfolg.
 */
function uebernimmNummern(g: GameState, manager: number, block: Buffer): string {
  const plaetze = [...Array(25).keys()];
  const zeilen = plaetze.map((i) => g.lineups.at(manager * 25 + i));
  const belegt = plaetze.filter((i) => !zeilen[i].isEmpty);
  const neu = plaetze.map((i) => block[i * 52 + 10]);
  // Auf einen Wertebereich wird nicht geprüft: welche Nummern es gibt, sagt der Spielstand. Die
  // Null kommt vor (im Prüfstand trug Platz 8 keine Nummer), und ein Bereich 1..25 hätte sie
  // fälschlich abgewiesen. Es zählt allein, dass dieselben Nummern herauskommen wie vorher.
  const vorher = belegt.map((i) => zeilen[i].number).sort((a, b) => a - b);
  const nachher = belegt.map((i) => neu[i]).sort((a, b) => a - b);
  if (vorher.join(",") !== nachher.join(",")) return "Rückennummern lassen sich nur untereinander tauschen - hat sich der Kader geändert?";
  for (const i of belegt) zeilen[i].number = neu[i];
  return "";
}

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
    // Die anderen Manager erfahren davon und können bieten; der abgebende nicht
    r.game.activeManagers().forEach((_, i) => {
      if (i !== manager && !isAi(r.game, i)) pushMessage(r, i, ["Abl|sefrei zu haben:", erg.free!.name]);
    });
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
  // Tagesbeginn eines Spieltags (0x1D797): das gesicherte System zurück und neu aufstellen
  if (flag !== 0 && flag !== 9) {
    for (let i = 0; i < n; i++) {
      restoreSystem(g, i);
      autoLineupIfEnabled(g, i);
    }
  }
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
  const st = startLive(r.game, r.rng, k, flag, tempoMs(r.options.tempo), r.letzteWechsel);
  // Ab jetzt zählt das laufende Spiel (0x1D838 setzt nach der Stärkerechnung zurück)
  r.letzteWechsel = st.subs;
  st.scenesOn = r.options.scenes;
  st.halbzeitStaende = [0, 1, 2].map((l) => r.options.flags[3 * l] ?? true);
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
      advanceDay(r, { results: liveResults(st2), postponed: st2.postponed, scorers: scorerLines(st2), events: matchEvents(st2), attendance: liveAttendances(st2), nachspiele: liveNachspiele(st2), booking: { forfeit: (m) => forfeitsOf(st2).has(m), incidents: (m) => incidentsOf(st2, m), vorbereitet: true }, einsaetzeVorher: st2.einsaetzeVorher, staerke: new Map(st2.entries.map((e) => [e.key, [e.match.home, e.match.away] as const])) });
      nachTageswechsel(r);
      // Hat schon jeder bestätigt, verschwindet die Anzeige sofort
      if (!st2.paused) r.live = undefined;
      broadcast(r);
      return;
    }
    if (changed) broadcast(r);
  }, 200);
  broadcast(r);
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

function roomFromSave(meta: RoomMeta, save: SaveFile): Room {
  const game = new GameState(save);
  repariereKader(game);
  const r: Room = { ...meta, save, game, version: 1, seats: new Map(), done: new Set(), log: [], rng: mulberryRng(Date.now() >>> 0), balanceSums: game.activeManagers().map(() => ({ sum: 0 })), pending: [], offers: [], campOpen: CAMP_OPEN_START.slice(), msgFlags: [], sales: new Map(), purchases: new Map(), subsidies: new Map(), marketOffers: [], options: { tempo: tempoOf(TEMPO_MS), scenes: true, zeitung: true, flags: OPTION_DEFAULTS.slice() }, zeitung: new Map(), highscore: loadHighscore(game), lastDay: [], poachTried: new Set(), bauAbgelehnt: new Set(), bauTage: new Map(), auctions: new Map(), jugendFrisch: [], hinweise: [], abschluss: [], poachRequests: [], loanRequests: [], freeAgents: [], freeAgentsDay: -1, vertragsende: [] };
  return r;
}

/** Einen Spielstand von der Platte in eine Runde laden (Pfad, weil Runden eigene Ordner haben). */
async function loadRoom(meta: RoomMeta, path: string): Promise<Room> {
  const save = SaveFile.decode(new Uint8Array(await readFile(path)));
  const r = roomFromSave(meta, save);
  r.log.push(`Spielstand ${meta.file} geladen`);
  repairMarketPrices(r);
  // Vom Rechner geführte Manager warten auf nichts. Ohne das hier bliebe der Tag nach dem Laden
  // eines Spielstands mit KI-Managern für immer stehen (beim Bildvergleich für #56 aufgefallen).
  for (const i of aiList(r.game)) r.done.add(i);
  return r;
}

/** Pfad des Spielstands einer Runde: BMP_DIR/runden/<id>/SERVER.MAN */
function roomSavePath(id: string): string {
  return join(roundsDir, id, SERVER_SAVE);
}

/**
 * Kurzfassung einer Runde für die Lobby. Von einer geschlossenen Runde, in die der Fragende
 * nicht darf, steht nur da, dass es sie gibt und wem sie gehört - nicht, wer mitspielt und wie
 * weit sie ist. Ganz verschweigen wäre unfreundlich: sonst wundert man sich, warum kein Platz
 * mehr frei ist.
 */
function roomInfo(r: Room, user: string) {
  const k = dayIndex(r.game);
  const offen = darfBetreten(user, r);
  if (!offen) {
    return { id: r.id, name: r.name, creator: r.creator, created: r.created, privat: true, zutritt: false, file: "", dayIndex: 0, date: { day: 0, month0: 0, year: 0 }, live: false, managers: [], anwesend: [] };
  }
  return {
    id: r.id,
    name: r.name,
    creator: r.creator,
    created: r.created,
    privat: r.privat,
    zutritt: true,
    gaeste: darfRundeVerwalten(user, r) ? r.gaeste : undefined,
    file: r.file,
    date: dateOfSeasonDay(seasonDay(k), seasonStartYear(r.game)),
    dayIndex: k,
    live: Boolean(r.live),
    managers: r.game.activeManagers().map((m, i) => ({
      name: m.displayName,
      club: r.game.clubs.at(m.clubIndex).displayName,
      seat: r.seats.get(i) ?? null,
      ki: isAi(r.game, i),
    })),
    /** Wer die Runde betreten hat, auch ohne auf einem Platz zu sitzen */
    anwesend: [...activeRoom.entries()].filter(([, id]) => id === r.id).map(([u]) => u),
  };
}

/** Einen Benutzer aus den Plätzen einer Runde nehmen; sein Verein bleibt unbesetzt. */
function verlassen(r: Room, user: string): void {
  for (const [m, who] of [...r.seats]) {
    if (who !== user) continue;
    r.seats.delete(m);
    r.log.push(`${user} verlässt die Runde (${r.game.managers.at(m).displayName} ist wieder frei)`);
  }
}

/**
 * Runde aus der Lobby nehmen. Der Ordner wird **nicht** gelöscht, sondern auf <id>.geloescht
 * umbenannt: ein Klick soll keinen Spielstand endgültig vernichten.
 */
function loescheRunde(r: Room): void {
  if (r.liveTimer) clearInterval(r.liveTimer);
  if (r.persistTimer) clearTimeout(r.persistTimer);
  rooms.delete(r.id);
  for (const [user, id] of [...activeRoom]) if (id === r.id) joinRoom(user, undefined);
  // Wer in der gelöschten Runde saß, steht jetzt in der Lobby
  try {
    const alt = join(roundsDir, r.id);
    if (existsSync(alt)) renameSync(alt, join(roundsDir, `${r.id}.geloescht`));
  } catch (err) {
    console.error(`Ordner der Runde ${r.id} nicht umbenannt:`, (err as Error).message);
  }
  saveRounds();
}

/**
 * Ziel für "Neues Spiel", "Laden" und "Hochladen": entweder die eigene Runde, deren Inhalt
 * damit ersetzt wird, oder eine neue. Ersetzen darf nur, wer die Runde angelegt hat - die aus
 * der Zeit vor den Runden übernommene erste Partie hat keinen Ersteller und steht allen offen.
 */
function rundenZiel(user: string, ziel: Room | undefined, wunsch: string, file: string): RoomMeta | { error: string; code: number } {
  if (!darfRunden(user)) return { error: "Als Spieler dürfen Sie keine Runde anlegen oder ersetzen", code: 403 };
  const name = wunsch.replace(/[^\p{L}\p{N} .,:!?()-]/gu, "").trim().slice(0, 24);
  if (ziel) {
    if (ziel.creator && ziel.creator !== user && !darfVerwalten(user)) return { error: `Die Runde gehört ${ziel.creator}`, code: 403 };
    return { id: ziel.id, name: name || ziel.name, creator: ziel.creator || user, created: ziel.created, file, privat: ziel.privat, gaeste: ziel.gaeste };
  }
  if (rooms.size >= MAX_ROOMS) return { error: `Es laufen schon ${MAX_ROOMS} Runden`, code: 409 };
  return { id: neueRundenKennung(), name: name || `Runde ${rooms.size + 1}`, creator: user, created: Date.now(), file, privat: false, gaeste: [] };
}

/** Runde eintragen oder ihren Inhalt ersetzen und den Benutzer hineinsetzen. */
function setRoom(user: string, r: Room): void {
  const alt = rooms.get(r.id);
  if (alt) {
    // Der ersetzte Stand hat andere Manager: die Plätze werden neu vergeben, die Anwesenden
    // bleiben aber in der Runde und wählen sich einen aus.
    if (alt.liveTimer) clearInterval(alt.liveTimer);
    if (alt.persistTimer) clearTimeout(alt.persistTimer);
  }
  rooms.set(r.id, r);
  joinRoom(user, r.id);
  saveRounds();
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
  const folge = r.ceremony?.folge;
  if (folge) {
    const [naechster, ...rest] = folge;
    if (naechster === undefined) {
      r.ceremony = undefined;
      r.log.push("Auslosung: fertig");
      return;
    }
    r.ceremony = { cup: naechster, phase: "vote", ready: true, votes: {}, startedAt: null, skipped: false, seen: [], folge: rest };
    r.log.push(`Auslosung: Abfrage für ${cupNames()[naechster]}`);
    return;
  }
  const next = nextCeremonyCup(r.game, fromCup);
  if (next === null) {
    r.ceremony = undefined;
    r.log.push("Auslosung: fertig");
    return;
  }
  r.ceremony = { cup: next, phase: "vote", ready: true, votes: {}, startedAt: null, skipped: false, seen: [] };
  r.log.push(`Auslosung: Abfrage für ${cupNames()[next]}`);
}

/**
 * Zeremonie für frisch ausgeloste Wettbewerbe ansetzen. Im Original ruft die Auslosung der
 * nächsten Runde (0x18FC2, aus dem Rundenabschluss 0x192FC) die Zeremonie gleich selbst auf
 * (0x19039 -> 0x17C26) - nach jedem Pokaltag, im Europapokal erst nach dem Rückspiel, nach dem
 * Finale nicht mehr. Läuft schon eine, kommen die neuen hinten an (GitLab #71).
 */
function zeremonieAnsetzen(r: Room, cups: number[]): void {
  const neu = cups.filter((c) => cupView(r.game, c).pairs.length > 0);
  if (neu.length === 0) return;
  if (r.ceremony) {
    r.ceremony.folge = [...(r.ceremony.folge ?? []), ...neu.filter((c) => c !== r.ceremony!.cup)];
    return;
  }
  const [erster, ...rest] = neu;
  r.ceremony = { cup: erster, phase: "vote", ready: true, votes: {}, startedAt: null, skipped: false, seen: [], folge: rest };
  r.log.push(`Auslosung: Abfrage für ${cupNames()[erster]}`);
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
    rolle: rolleVon(user),
    runde: { id: r.id, name: r.name, creator: r.creator },
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
function advanceDay(r: Room, live?: { staerke?: Map<string, readonly [TeamStrength, TeamStrength]>; results: Map<string, MatchResult>; postponed: number[][]; einsaetzeVorher?: number[][]; scorers?: Map<string, { minute: number; side: "home" | "away"; name: string }[]>; events?: Map<string, { minute: number; side: "home" | "away"; goal: boolean }[]>; attendance?: Map<string, number>; booking?: LiveBooking; nachspiele?: Map<string, Nachspiel> }): void {
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
  // Vor den Spielen sichert das Original das System je Manager und schaltet auf manuell
  // (0x1D817) - einmal am Tag, der nächste Spieltag stellt es zurück (nachTageswechsel)
  let gesichert = false;
  const systemeSichern = () => {
    if (gesichert) return;
    gesichert = true;
    g.activeManagers().forEach((_, i) => backupSystem(g, i));
  };
  const sim = (home: number, away: number, hs: Parameters<typeof simulateMatch>[0], as: Parameters<typeof simulateMatch>[1], rng: Rng) => live?.results.get(`${home}-${away}`) ?? simulateMatch(hs, as, rng);
  // Verlängerung und Elfmeterschießen hat die Konferenz schon gezeigt: gebucht wird genau das,
  // sonst würde hier ein zweites Mal gewürfelt (GitLab #72)
  const nachspiel = (home: number, away: number) => live?.nachspiele?.get(`${home}-${away}`);
  const names = (c: number) => g.clubs.at(c).displayName;
  // Einsätze vor dem Tag: daran erkennt die Dopingprüfung, wer gespielt hat (#3)
  // Mit Konferenz zählt der Kaderteil die Einsätze schon beim Anpfiff - dann gilt deren Stand
  const einsaetzeVorher = live?.einsaetzeVorher ?? g.activeManagers().map((_, i) => g.squadOf(i).map((l) => l.u8(6) + l.u8(7) + l.u8(8)));
  // Die Sportzeitung gehört zum Spieltag, an dem sie entstanden ist: sie wird an jedem Spieltag
  // geleert - auch an Pokal- und Europapokaltagen, sonst stünde dort die Ausgabe des letzten
  // Ligaspieltags noch einmal in der Seitenfolge. An Tagen ohne Spiele bleibt sie stehen und
  // ist weiter im Hauptmenü abrufbar.
  if (flag !== 0) r.zeitung = new Map();
  // Nachholspiele dieses Tages (Kalendermarke 0x80): Paarung aus dem Spielplan des damaligen
  // Spieltags, danach ist der Termin abgetragen
  const faellig = replays(g).filter((e) => e.dayIndex === k);
  if (faellig.length) {
    systemeSichern();
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
    systemeSichern();
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
          // Die Bewertungen des Spiels; ohne sie stünde in der Zeitung für jeden dieselbe Note
          bewertungen: new Map(p.bewertungen?.find((x) => x.manager === i)?.werte ?? []),
          // Die Matrix, mit der die Konferenz zuletzt gespielt hat (im Original im Vereinssatz)
          staerke: ((st) => (st ? new Map([[p.home, st[0]], [p.away, st[1]]]) : undefined))(live?.staerke?.get(`${p.home}-${p.away}`)),
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
    const played = playCupDay(g, r.rng, sim, (home, away) => live?.attendance?.get(`${home}-${away}`), nachspiel, live?.booking?.vorbereitet ?? false);
    logCupMatches(r, "DFB-Pokal", played, played.finals ?? [], live?.scorers);
    zeremonieAnsetzen(r, played.gezogen ?? []);
  }
  // Tagesverteiler 0x1D8D1: genau Flag 0x10 ist die Relegation, sonst ein Europapokaltag
  if ((flag & 0x70) === 0x10) {
    const m = playPlayoffDay(g, seasonDay(k), r.rng, sim, nachspiel, live?.booking?.vorbereitet ?? false);
    r.log.push(`Relegation, ${m.leg === 1 ? "Hinspiel" : "R}ckspiel"}: ${names(m.home)} - ${names(m.away)} ${resultText(m)}${m.attendance ? ` (${m.attendance} Zuschauer)` : ""}`);
    if (m.winner !== undefined) r.log.push(`  ${names(m.winner)} spielt n{chste Saison in der Bundesliga`);
    // Das Relegationsspiel läuft in der Konferenz wie jedes andere; Ergebnis und Ausgang stehen
    // danach im Spielplan und im Verlauf. Das Original meldet nichts (GitLab #54).
  } else if (flag & 0x70) {
    const { matches, finals, gezogen } = playEuropaDay(g, seasonDay(k), r.rng, sim, (home, away) => live?.attendance?.get(`${home}-${away}`), nachspiel, live?.booking?.vorbereitet ?? false);
    logCupMatches(r, "Europapokal", matches, finals, live?.scorers);
    zeremonieAnsetzen(r, gezogen);
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
    // Auch zu Saisonbeginn lost das Original mit Zeremonie aus (0x1EAD3 und 0x1EAEE rufen die
    // Auslosung 0x18600 auf): erst den DfB-Pokal, dann die drei Europapokale (GitLab #71)
    zeremonieAnsetzen(r, [0, 1, 2, 3]);
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
      // einmal je Tag (GitLab #34). Erst die Lager, dann die Bank (0x11D2D vor 0x11DA2, #99).
      advanceCampOpen(r.campOpen, r.rng);
      if (r.rng(0, 60) === 0) driftInterest(g, r.rng);
      for (const kind of dailyConstruction(g, i)) {
        // Der Betreff steht im Original je Bauwerk fest (0x4EAEA); Flutlicht, Anzeigetafel und
        // Komfort tragen ihr Stichwort in einer zweiten Zeile (0x4FD40)
        const bau = texte("ui.bauwerke");
        const zusatz = kind === 4 ? bau[7] : kind === 5 ? bau[8] : kind === 7 ? bau[9] : "";
        const text = `${bau[kind - 1]}${zusatz ? " " + zusatz : ""} ${texte("ui.ausbaufertig")[0]}`;
        r.log.push(`${dt.day}.${dt.month0 + 1}. ${m.displayName}: ${text}`);
        pushMessage(r, i, wrap(text), dt);
      }
      // Krawall und Komfort gehören zur Tagesroutine und laufen einmal am Ankunftstag (#99)
      for (const ev of dailyFinance(g, i, dt, r.rng, r.balanceSums[i], false)) {
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
    // 12.11. und 19.4.: dieselbe Routine würfelt für ihre (nicht portierten) Scherzbildschirme
    scherztagWurf(dt, r.rng);
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
    // Die ganze Tagesroutine entfällt ab Saisontag 322 (0x0DF4F): kein Markt, keine Verträge,
    // kein Training, keine Automatik-Aufstellung. Bis GitLab #83 (F6) entfiel bei uns nur das
    // Training.
    const tagesroutine = seasonDay(kNeu) <= 321;
    g.activeManagers().forEach((m, i) => {
      const before = g.squadOf(i).map((l) => l.u8(9));
      if (tagesroutine) {
        // Tagesroutine 0x0DF0D in der Reihenfolge des Originals (sim/tagesroutine.ts): Markt,
        // Stadion, Kaderschleife je Platz (Trainingsverletzung, Karriereankündigung,
        // Verhandlungszähler, Verlängerungsangebot), Angebote fremder Vereine, Training und
        // Automatik-Aufstellung - einmal am Ankunftstag (GitLab #33, #81, #99)
        const t = tagesroutine(g, i, seasonDay(kNeu), tr, r.rng, flagNeu === 0);
        // Die Meldungsroutine 0x30AA0 datiert jede Meldung um random(0,3) Tage zurück
        const datum = (zurueck = 0) => dateOfSeasonDay(Math.max(1, seasonDay(kNeu) - zurueck), startYear);
        for (const ev of t.stadion) {
          r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: ${ev.text}`);
          pushMessage(r, i, wrap(ev.text), datum(ev.zurueck));
        }
        for (const ev of t.transfers) {
          r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: ${ev.lines.join(" ")}`);
          pushMessage(r, i, ev.lines, datum(ev.zurueck));
        }
        for (const a of t.karriereende) {
          r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: ${a.name} hört am Vertragsende auf`);
          pushMessage(r, i, a.zeilen, datum(a.zurueck));
        }
        for (const platz of t.verfallen) {
          const l = g.lineups.at(i * 25 + platz);
          r.log.push(`${dtNeu.day}.${dtNeu.month0 + 1}. ${m.displayName}: Angebot von ${g.players.at(l.playerIndex).displayName} verfallen`);
        }
        for (const offer of t.angebote) {
          r.offers.push(offer);
          r.log.push(`${m.displayName}: ${offer.name} bietet Vertragsverlängerung an (${offer.yearsFrom} -> ${offer.yearsTo} Jahre, ${offer.salary} DM)`);
          pushMessage(r, i, [`${offer.name} ${T("quell.server", 10)}`, `von ${offer.yearsFrom} auf ${offer.yearsTo}`, T("quell.server", 0)], datum(offer.zurueck));
        }
      }
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
    const jetzt = g.squadOf(i).map((l) => l.u8(6) + l.u8(7) + l.u8(8));
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
    mkdirSync(join(roundsDir, r.id), { recursive: true });
    await writeFile(roomSavePath(r.id), r.save.withFreshHeader().encode());
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

/**
 * Liegt `datei` wirklich unterhalb von `ordner`? `join` rechnet ".." schon weg, eine Suche nach
 * ".." im Ergebnis geht also ins Leere. Geprueft wird deshalb der aufgeloeste Pfad.
 */
function liegtIn(datei: string, ordner: string): boolean {
  const ziel = resolve(datei);
  const basis = resolve(ordner);
  return ziel === basis || ziel.startsWith(basis + sep);
}

/**
 * Spielstaende ohne Anmeldung ausliefern, wenn die Gegenstelle lokal aussieht, ist nur fuer den
 * Prototypen gedacht - steht der Server einmal auf demselben Rechner wie sein Proxy, gilt jeder
 * Fremde als lokal. Darum muss es ausdruecklich eingeschaltet werden.
 */
const lokalOhneAnmeldung = process.env.BMP_LOKAL_OHNE_ANMELDUNG === "1";

async function serveStatic(pathname: string, res: ServerResponse, user: string | undefined, local = false, range?: string, ifNoneMatch?: string): Promise<void> {
  let file: string | null = null;
  let ordner = web;
  if (pathname === "/" || pathname === "/index.html") file = join(web, "index.html");
  else if (pathname.startsWith("/dist/")) file = join(web, pathname);
  else if (pathname.startsWith("/assets/")) {
    file = join(root, pathname);
    ordner = join(root, "assets");
  } else if (pathname.startsWith("/saves/")) {
    if (!user && !(local && lokalOhneAnmeldung)) return json(res, 401, { error: "nicht angemeldet" });
    file = join(savesDir, pathname.slice(7));
    ordner = savesDir;
  }
  try {
    if (!file || !liegtIn(file, ordner)) throw new Error("nicht gefunden");
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

/**
 * Kommt die Anfrage von unserer eigenen Seite? Ein Formular auf einer fremden Seite kann das
 * Sitzungs-Cookie zwar nicht mitschicken (SameSite=Lax), aber darauf allein soll es nicht
 * ankommen. Browser setzen bei jedem POST einen Origin-Kopf; stimmt der nicht mit dem Host
 * überein, ist die Anfrage von woanders. Fehlt er ganz, kommt sie nicht aus einem Browser
 * (curl, Werkzeuge) - das bleibt erlaubt, sonst wäre der Server nicht mehr zu bedienen.
 */
function eigenerUrsprung(req: IncomingMessage): boolean {
  const ursprung = req.headers.origin;
  if (!ursprung) return true;
  let her: string;
  try {
    her = new URL(String(ursprung)).host.toLowerCase();
  } catch {
    return false;
  }
  const hier = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim().toLowerCase();
  if (her === hier) return true;
  if (erlaubteHosts.has(her)) return true;
  if (baseUrl) {
    try {
      return her === new URL(baseUrl).host.toLowerCase();
    } catch {
      /* unbrauchbare Angabe */
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Seite zum Passwort setzen (GitLab #65). Sie gehört nicht ins Spielbild: der Link aus der Mail
 * wird geöffnet, bevor jemand angemeldet ist, und ein Formular auf der Leinwand wäre hier nur
 * umständlich. Darum eine schlichte Seite im Stil des Anmeldefensters.
 */
function einladungsSeite(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Passwort setzen</title>
<style>
  html, body { margin: 0; background: #202028; color: #ddd; font-family: sans-serif; height: 100%; }
  body { display: flex; align-items: center; justify-content: center; }
  form { background: #2e2e44; padding: 24px 28px; border: 2px solid #8a8ab8; display: flex; flex-direction: column; gap: 10px; min-width: 280px; }
  h2 { margin: 0 0 6px; font-size: 18px; }
  label { display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
  input { font-size: 15px; padding: 4px 6px; }
  button { font-size: 15px; padding: 6px; margin-top: 4px; }
  #fehler { color: #ff8080; font-size: 13px; min-height: 1em; }
  #gut { color: #90ee90; font-size: 13px; }
</style>
</head>
<body>
<form id="f">
  <h2>Bundesliga Manager Professional</h2>
  <div>Bitte ein Passwort setzen (mindestens acht Zeichen).</div>
  <label>Passwort <input name="a" type="password" autocomplete="new-password" required minlength="8"></label>
  <label>Noch einmal <input name="b" type="password" autocomplete="new-password" required minlength="8"></label>
  <button type="submit">Speichern</button>
  <div id="fehler"></div>
</form>
<script>
  const f = document.getElementById("f");
  const fehler = document.getElementById("fehler");
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const d = new FormData(f);
    if (d.get("a") !== d.get("b")) { fehler.textContent = "Die beiden Eingaben sind nicht gleich."; return; }
    const token = new URLSearchParams(location.search).get("t") ?? "";
    const r = await fetch("api/passwort/setzen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: d.get("a") }) });
    const antwort = await r.json().catch(() => ({}));
    if (!r.ok) { fehler.textContent = antwort.error ?? "Das hat nicht geklappt."; return; }
    f.innerHTML = '<h2>Fertig</h2><div id="gut">Das Passwort steht. Sie k&ouml;nnen sich jetzt anmelden.</div><a href="./" style="color:#8ab">Zum Spiel</a>';
  };
</script>
</body>
</html>`;
}

async function api(req: IncomingMessage, url: URL, res: ServerResponse): Promise<void> {
  const p = url.pathname;
  // Alles, was etwas ändert, läuft über POST. Deshalb reicht die Prüfung hier oben.
  if (req.method === "POST" && !eigenerUrsprung(req)) return json(res, 403, { error: "Anfrage von einer fremden Seite" });
  const user = sessionUser(req);
  if (req.method === "GET" && p === "/api/me") {
    return user ? json(res, 200, { user, rolle: rolleVon(user) }) : json(res, 401, { error: "nicht angemeldet" });
  }
  if (req.method === "POST" && p === "/api/login") {
    const addr = clientAddress(req);
    if (tooManyFailures(addr)) return json(res, 429, { error: "zu viele Fehlversuche, bitte später erneut" });
    const body = await readJson(req);
    const name = String(body.user ?? "").trim().slice(0, 20);
    const password = String(body.password ?? "");
    // Wartezeit aus den bisherigen Fehlversuchen dieses Kontos, vor der Pruefung geholt: sie
    // gilt auch fuer den Treffer, damit sie nichts ueber die Richtigkeit verraet.
    const warten = kontoBremse(name);
    const konto = loadUsers().get(name);
    if (!konto || !verifyPassword(password, konto.hash)) {
      failures.set(addr, [...(failures.get(addr) ?? []), Date.now()]);
      kontoFehlversuch(name);
      await sleep(500 + warten);
      return json(res, 401, { error: "Name oder Passwort falsch" });
    }
    if (warten) await sleep(warten);
    kontoFehler.delete(name.toLowerCase());
    // Ein Hash nach dem alten Verfahren wird beim ersten richtigen Passwort stillschweigend
    // erneuert - sonst bliebe er bis in alle Ewigkeit stehen.
    if (veraltet(konto.hash)) {
      const liste = [...loadUsers().values()];
      const eintrag = liste.find((u) => u.name === konto.name);
      if (eintrag) {
        eintrag.hash = hashPassword(password);
        saveUsers(liste);
        console.log(`Passworthash von ${konto.name} erneuert`);
      }
    }
    const token = randomBytes(24).toString("base64url");
    sessions.set(sessionHash(token), { user: name, created: Date.now() });
    saveSessions();
    setSessionCookie(req, res, token);
    return json(res, 200, { user: name, rolle: konto.rolle });
  }
  if (req.method === "POST" && p === "/api/passwort/vergessen") {
    // Ohne Anmeldung. Die Antwort verrät nie, ob es das Konto gibt - sonst ließe sich die
    // Benutzerliste abfragen. Die Fehlerbremse der Anmeldung gilt hier mit.
    const addr = clientAddress(req);
    if (tooManyFailures(addr)) return json(res, 429, { error: "zu viele Versuche, bitte später erneut" });
    failures.set(addr, [...(failures.get(addr) ?? []), Date.now()]);
    const body = await readJson(req);
    const wer = String(body.name ?? "").trim().slice(0, 40).toLowerCase();
    const konto = [...loadUsers().values()].find((u) => u.name.toLowerCase() === wer || (u.email ?? "").toLowerCase() === wer);
    if (konto) {
      try {
        await schickeLink(req, konto, "reset");
      } catch (err) {
        console.error(`Mail an ${konto.name} nicht verschickt:`, (err as Error).message);
      }
    }
    await sleep(500);
    return json(res, 200, { ok: true });
  }
  if (req.method === "POST" && p === "/api/passwort/setzen") {
    const body = await readJson(req);
    const token = String(body.token ?? "");
    const marke = marken.get(markeHash(token));
    if (!marke || marke.ablauf < Date.now()) return json(res, 400, { error: "Der Link ist abgelaufen oder schon benutzt" });
    const passwort = String(body.password ?? "");
    if (passwort.length < 8) return json(res, 400, { error: "Das Passwort braucht mindestens acht Zeichen" });
    const liste = [...loadUsers().values()];
    const konto = liste.find((u) => u.name === marke.user);
    if (!konto) return json(res, 404, { error: "Das Konto gibt es nicht mehr" });
    konto.hash = hashPassword(passwort);
    saveUsers(liste);
    marken.delete(markeHash(token));
    sichereMarken();
    // Alte Sitzungen dieses Kontos enden: ein neues Passwort soll fremde Fenster aussperren
    for (const [t, sess] of [...sessions]) if (sess.user === konto.name) sessions.delete(t);
    saveSessions();
    console.log(`${konto.name} hat ein Passwort gesetzt`);
    return json(res, 200, { ok: true, user: konto.name });
  }
  if (req.method === "POST" && p === "/api/logout") {
    const token = cookieToken(req);
    if (token) sessions.delete(sessionHash(token));
    saveSessions();
    setSessionCookie(req, res, null);
    return json(res, 200, { ok: true });
  }
  if (!user) return json(res, 401, { error: "nicht angemeldet" });
  /** Die Runde des Benutzers; ab hier meint `room` immer seine eigene (GitLab #65). */
  const room = roomOf(user);
  if (req.method === "GET" && p === "/api/users") {
    if (!darfVerwalten(user)) return json(res, 403, { error: "Das darf nur der Präsident" });
    const liste = [...loadUsers().values()].map((u) => ({ name: u.name, rolle: u.rolle, email: u.email ?? "", offen: !u.hash }));
    return json(res, 200, { users: liste, versand: Boolean(smtpZugang()) });
  }
  if (req.method === "GET" && p === "/api/spieler") {
    // Nur die Namen, und nur für die, die Runden anlegen dürfen: mehr braucht die Gästeliste
    // nicht, und die Adressen gehen niemanden außer dem Präsidenten etwas an.
    if (!darfRunden(user)) return json(res, 403, { error: "Das dürfen nur Präsident und Trainer" });
    return json(res, 200, { namen: [...loadUsers().keys()] });
  }
  if (req.method === "GET" && p === "/api/rooms") {
    return json(res, 200, { rooms: [...rooms.values()].map((r) => roomInfo(r, user)), active: room?.id ?? null, max: MAX_ROOMS, user, rolle: rolleVon(user) });
  }
  if (req.method === "GET" && p === "/api/state") {
    if (!room) return json(res, 200, { version: 0, user, managers: [], log: ["keine Runde betreten"], lobby: true });
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
    // Eine offene Leitung je Fenster ist normal, ein Dutzend nicht: sonst haelt ein einzelner
    // Anwender beliebig viele Verbindungen offen.
    let offen = 0;
    for (const wer of listeners.values()) if (wer === user) offen++;
    if (offen >= 8) return json(res, 429, { error: "zu viele offene Verbindungen" });
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.write(`data: ${JSON.stringify({ version: room?.version ?? 0, build: buildStamp() })}\n\n`);
    listeners.set(res, user);
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(ping);
      listeners.delete(res);
    });
    return;
  }
  if (req.method !== "POST") return json(res, 405, { error: "nur POST" });
  const body = await readJson(req);
  if (p.startsWith("/api/users/")) {
    if (!darfVerwalten(user)) return json(res, 403, { error: "Das darf nur der Präsident" });
    const liste = [...loadUsers().values()];
    const name = String(body.name ?? "").trim().slice(0, 20);
    const konto = liste.find((u) => u.name === name);
    if (p === "/api/users/add") {
      if (!/^[A-Za-z0-9_.-]{2,20}$/.test(name)) return json(res, 400, { error: "Name: zwei bis zwanzig Zeichen, Buchstaben und Ziffern" });
      if (konto) return json(res, 409, { error: `${name} gibt es schon` });
      const email = String(body.email ?? "").trim().slice(0, 80);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "Die Adresse sieht nicht wie eine Adresse aus" });
      const rolle = ROLLEN.includes(body.rolle) ? (body.rolle as Rolle) : "spieler";
      // Ohne Passwort angelegt: erst der Link aus der Einladung schaltet das Konto frei
      const neu: Benutzer = { name, hash: "", rolle, email: email || undefined };
      liste.push(neu);
      saveUsers(liste);
      let meldung = `${name} angelegt`;
      if (email) {
        try {
          await schickeLink(req, neu, "einladung");
          meldung = `${name} angelegt, Einladung an ${email}`;
        } catch (err) {
          meldung = `${name} angelegt, aber die Mail ging nicht raus: ${(err as Error).message}`;
        }
      }
      console.log(meldung);
      return json(res, 200, { ok: true, message: meldung });
    }
    if (!konto) return json(res, 404, { error: `${name} gibt es nicht` });
    if (p === "/api/users/rolle") {
      if (!ROLLEN.includes(body.rolle)) return json(res, 400, { error: "Rolle unbekannt" });
      // Der letzte Präsident darf sich die Rolle nicht selbst nehmen, sonst kommt niemand mehr
      // an die Verwaltung heran
      if (konto.rolle === "praesident" && body.rolle !== "praesident" && liste.filter((u) => u.rolle === "praesident").length < 2)
        return json(res, 409, { error: "Es muss ein Präsident übrig bleiben" });
      konto.rolle = body.rolle as Rolle;
      saveUsers(liste);
      return json(res, 200, { ok: true, message: `${name}: ${konto.rolle}` });
    }
    if (p === "/api/users/email") {
      const email = String(body.email ?? "").trim().slice(0, 80);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "Die Adresse sieht nicht wie eine Adresse aus" });
      konto.email = email || undefined;
      saveUsers(liste);
      return json(res, 200, { ok: true, message: `${name}: ${email || "keine Adresse"}` });
    }
    if (p === "/api/users/einladen") {
      if (!konto.email) return json(res, 400, { error: `${name} hat keine Adresse` });
      try {
        await schickeLink(req, konto, konto.hash ? "reset" : "einladung");
      } catch (err) {
        return json(res, 502, { error: `Die Mail ging nicht raus: ${(err as Error).message}` });
      }
      return json(res, 200, { ok: true, message: `Link an ${konto.email}` });
    }
    if (p === "/api/users/entfernen") {
      if (konto.name === user) return json(res, 409, { error: "Sich selbst entfernen geht nicht" });
      if (konto.rolle === "praesident" && liste.filter((u) => u.rolle === "praesident").length < 2) return json(res, 409, { error: "Es muss ein Präsident übrig bleiben" });
      saveUsers(liste.filter((u) => u.name !== name));
      for (const [t, sess] of [...sessions]) if (sess.user === name) sessions.delete(t);
      saveSessions();
      activeRoom.delete(name);
      for (const r of rooms.values()) verlassen(r, name);
      broadcastLobby();
      return json(res, 200, { ok: true, message: `${name} entfernt` });
    }
    return json(res, 404, { error: "unbekannt" });
  }
  if (p === "/api/rooms/join") {
    const ziel = rooms.get(String(body.id ?? ""));
    if (!ziel) return json(res, 404, { error: "Runde gibt es nicht" });
    if (!darfBetreten(user, ziel)) return json(res, 403, { error: "Die Runde ist geschlossen - fragen Sie den, der sie angelegt hat" });
    if (room && room !== ziel) verlassen(room, user);
    joinRoom(user, ziel.id);
    ziel.version++;
    broadcast(ziel);
    broadcastLobby();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/rooms/leave") {
    if (room) {
      verlassen(room, user);
      room.version++;
      broadcast(room);
    }
    joinRoom(user, undefined);
    broadcastLobby();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/rooms/zutritt" || p === "/api/rooms/gast") {
    const ziel = rooms.get(String(body.id ?? ""));
    if (!ziel) return json(res, 404, { error: "Runde gibt es nicht" });
    if (!darfRundeVerwalten(user, ziel)) return json(res, 403, { error: "Das darf nur, wer die Runde angelegt hat" });
    if (p === "/api/rooms/zutritt") {
      const zu = Boolean(body.privat);
      // Wer schon drin sitzt, bleibt drin: beim Zuschließen werden die Anwesenden eingeladen,
      // sonst stünde jemand mitten im Spiel plötzlich vor verschlossener Tür.
      if (zu && !ziel.privat) {
        for (const [wer, id] of activeRoom) if (id === ziel.id && wer !== ziel.creator && !ziel.gaeste.includes(wer)) ziel.gaeste.push(wer);
        for (const wer of ziel.seats.values()) if (wer !== ziel.creator && !ziel.gaeste.includes(wer)) ziel.gaeste.push(wer);
      }
      ziel.privat = zu;
      ziel.log.push(zu ? `${user} schließt die Runde` : `${user} öffnet die Runde für alle`);
    } else {
      const wen = String(body.name ?? "").trim().slice(0, 20);
      if (!loadUsers().has(wen)) return json(res, 404, { error: `${wen} gibt es nicht` });
      if (body.dazu) {
        if (!ziel.gaeste.includes(wen)) ziel.gaeste.push(wen);
      } else {
        ziel.gaeste = ziel.gaeste.filter((g) => g !== wen);
        // Ausgeladen heißt auch: draußen. Der Platz wird frei, der Spielstand bleibt.
        if (ziel.privat && !darfBetreten(wen, ziel)) {
          verlassen(ziel, wen);
          if (activeRoom.get(wen) === ziel.id) joinRoom(wen, undefined);
        }
      }
    }
    ziel.version++;
    saveRounds();
    broadcast(ziel);
    broadcastLobby();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/rooms/delete") {
    const ziel = rooms.get(String(body.id ?? ""));
    if (!ziel) return json(res, 404, { error: "Runde gibt es nicht" });
    if (ziel.live) return json(res, 409, { error: "Die Konferenz läuft" });
    if (ziel.creator !== user && !darfVerwalten(user)) return json(res, 403, { error: "Nur wer die Runde angelegt hat, darf sie löschen" });
    loescheRunde(ziel);
    broadcastLobby();
    return json(res, 200, { ok: true });
  }
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
    const meta = rundenZiel(user, room, String(body.runde ?? ""), "NEU.MAN");
    if ("error" in meta) return json(res, meta.code, { error: meta.error });
    // Vorlage für das neue Spiel: die eigene Runde, sonst irgendeine laufende, sonst eine Datei.
    // Seit der Lobby ist "neues Spiel" ohne eigene Runde der Normalfall (GitLab #65).
    const vorlage = room ?? [...rooms.values()][0];
    const template = vorlage?.save.plain ?? SaveFile.decode(new Uint8Array(await readFile(join(savesDir, argOf("--load") ?? "TEST4.MAN")))).plain;
    const save = createGame(template, mana, opts, mulberryRng(Date.now() >>> 0));
    const neu = roomFromSave(meta, save);
    // Auslosung des DFB-Pokals als Zeremonie für alle (0x17C26), sobald alle Plätze besetzt sind
    neu.ceremony = { cup: 0, phase: "vote", ready: false, votes: {}, startedAt: null, skipped: false, seen: [] };
    neu.log.push(`Neues Spiel von ${user} (${opts.rules === 1 ? "Version 2026" : "Original"}): ${opts.managers.map((m: { name: string }) => m.name).join(", ")}`);
    setRoom(user, neu);
    await persist(neu);
    broadcast(neu);
    broadcastLobby();
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
    const meta = rundenZiel(user, room, String(body.runde ?? ""), name);
    if ("error" in meta) return json(res, meta.code, { error: meta.error });
    // Prüfsummen und Länge sagen nichts über den Inhalt: ein passend gebauter Stand kann beim
    // Aufbau der Runde stolpern. Das ist ein Fehler der Einsendung, kein Serverfehler.
    let neu: Room;
    try {
      neu = roomFromSave(meta, save);
    } catch (err) {
      console.error("Hochgeladener Spielstand nicht brauchbar:", err);
      return json(res, 400, { error: "Der Spielstand lässt sich nicht öffnen" });
    }
    neu.log.push(`Spielstand ${name} von ${user} hochgeladen`);
    setRoom(user, neu);
    await persist(neu);
    broadcast(neu);
    broadcastLobby();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/load") {
    const file = String(body.file ?? "").replace(/[^A-Za-z0-9_.-]/g, "").toUpperCase();
    if (!file.endsWith(".MAN")) return json(res, 400, { error: "Nur Spielstände (*.MAN)" });
    if (room?.live) return json(res, 409, { error: "Die Konferenz läuft" });
    const meta = rundenZiel(user, room, String(body.runde ?? ""), file);
    if ("error" in meta) return json(res, meta.code, { error: meta.error });
    let neu: Room;
    try {
      neu = await loadRoom(meta, join(savesDir, file));
    } catch (err) {
      console.error(`${file} nicht ladbar:`, err);
      return json(res, 404, { error: `${file} lässt sich nicht laden` });
    }
    neu.log.push(`geladen von ${user}`);
    setRoom(user, neu);
    await persist(neu);
    broadcast(neu);
    broadcastLobby();
    return json(res, 200, { ok: true });
  }
  if (!room) return json(res, 409, { error: "keine Runde betreten" });
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
    broadcast(room);
    // Die Lobby zeigt die Besetzung: wer sich setzt, ändert sie
    broadcastLobby();
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
        broadcast(room);
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
    broadcast(room);
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
    else broadcast(room);
    broadcastLobby();
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
    else broadcast(room);
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
    broadcast(room);
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
      room.log.push(`${room.game.managers.at(manager).displayName}: ${name} lehnt ${salary} DM für ${years} Jahre ab`);
      if (offen) {
        // Am Saisonende gibt es wie im Original nur einen Versuch: nach der Absage kehrt der
        // Vertragsdialog zurück, und der Spieler geht (0x0DC66). In der Version 2026 ist er
        // danach ablösefrei, und die anderen Manager können bieten (GitLab #95, D3).
        vertragsendeFreigeben(room, manager, l.playerIndex);
      } else l.setU8(24, room.rng(10, 18));
      room.version++;
      broadcast(room);
      return json(res, 200, { ok: false, message: `${name} ${texte("ui.keinInteresse").join(" ")}` });
    }
    l.setU8(11, years);
    for (let i = 0; i < 4; i++) l.setU8(40 + i, (salary >>> (8 * i)) & 0xff);
    // Auch nach einer Einigung ruht das Thema eine Weile (0x26195)
    l.setU8(24, room.rng(10, 18));
    room.log.push(`${room.game.managers.at(manager).displayName}: Vertrag mit ${name} auf ${years} Jahre verlängert (${salary} DM)`);
    if (offen) {
      // Kasten des Originals nach einer Einigung am Saisonende (0x0DDF0)
      room.vertragsende = room.vertragsende.filter((v) => v !== offen);
      // Kasten "<Name> bleibt Ihnen auch die nächste Saison erhalten." (0x0DDF0)
      room.hinweise.push({ manager, zeilen: [toDosText(name), ...texte("ui.vertragsende").slice(2)] });
    }
    room.version++;
    broadcast(room);
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
    broadcast(room);
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
        broadcast(room);
        return json(res, 200, { ok: false, message: `${offer.name} ${texte("ui.keinInteresse").join(" ")}` });
      }
      offer.yearsTo = years;
      offer.salary = salary;
    }
    room.offers.splice(idx, 1);
    if (body.accept) {
      acceptOffer(room.game, offer, room.rng);
      room.log.push(`${room.game.managers.at(manager).displayName}: Vertrag mit ${offer.name} bis ${offer.yearsTo} Jahre verlängert (${offer.salary} DM)`);
    } else declineOffer(room.game, offer, room.rng);
    room.version++;
    broadcast(room);
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
      room.live.halbzeitStaende = [0, 1, 2].map((l) => room.options.flags[3 * l] ?? true);
    }
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true, options: room.options });
  }
  if (p === "/api/abschluss") {
    // Abschlussbild weggeklickt: im Original genügt ein Klick, dann geht es weiter
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const idx = room.abschluss.findIndex((a) => a.manager === manager);
    if (idx >= 0) room.abschluss.splice(idx, 1);
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/hinweis") {
    // Hinweiskasten weggeklickt (OKAY): der älteste Hinweis dieses Managers ist erledigt
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const idx = room.hinweise.findIndex((h) => h.manager === manager);
    if (idx >= 0) room.hinweise.splice(idx, 1);
    room.version++;
    broadcast(room);
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
        broadcast(room);
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
      broadcast(room);
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
      broadcast(room);
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
      broadcast(room);
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
      // Sonst füllt eine Schleife im Browser die Platte mit Szenendateien
      try {
        const vorhanden = readdirSync(quelle).filter((f) => f.endsWith(".json"));
        if (vorhanden.length >= 200 && !vorhanden.includes(`${b.name}.json`)) return json(res, 409, { error: "200 eigene Torszenen sind genug" });
      } catch {
        /* noch keine eigenen Szenen */
      }
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
    broadcast(room);
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
    broadcast(room);
    return json(res, 200, { ok: true, rows: dopingRows(room.game, manager) });
  }
  if (p === "/api/market/list") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const result = listPlayer(room.game, manager, Number(body.place));
    if (!result.ok) return json(res, 400, { error: result.error });
    room.log.push(`${room.game.managers.at(manager).displayName}: Spieler auf den Transfermarkt gesetzt`);
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/takeback") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const result = takeBack(room.game, manager, Number(body.slot));
    if (!result.ok) return json(res, 400, { error: result.error });
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/market/offer") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const where = body.where === "market" ? "market" : "squad";
    const offer = saleOffer(room.game, manager, where, Number(body.place), room.rng);
    if (!offer) return json(res, 404, { error: "Kein Angebot" });
    room.sales.set(manager, offer);
    room.version++;
    broadcast(room);
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
    broadcast(room);
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
      broadcast(room);
      return json(res, 200, { ok: true, auction: true, message: `Gebot ${dmText(amount)} für ${entry.name} steht bis zum Tageswechsel` });
    }
    const result = buyOffer(room.game, manager, slot, amount, loan, room.rng);
    const name = room.game.managers.at(manager).displayName;
    if (!result.ok) {
      room.version++;
      broadcast(room);
      return json(res, 400, { error: result.error });
    }
    if (result.state === "contract") room.purchases.set(manager, { slot, playerIndex: entry.playerIndex, name: entry.name, amount, demands: result.demands });
    else if (result.state === "pending") {
      room.marketOffers = room.marketOffers.filter((o) => !(o.buyer === manager && o.slot === slot));
      room.marketOffers.push({ buyer: manager, owner: entry.owner, slot, playerIndex: entry.playerIndex, name: entry.name, amount, loan });
      room.log.push(`${name} bietet ${room.game.managers.at(entry.owner).displayName} ${amount} DM für ${entry.name}${loan ? " (Leihe)" : ""}`);
    } else room.log.push(`${name}: ${entry.name} für ${amount} DM ausgeliehen`);
    room.version++;
    broadcast(room);
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
        broadcast(room);
        return json(res, 200, { ok: false, message: `${pu.name} ${texte("ui.keinInteresse").join(" ")}` });
      }
      pu.demands[years - 1] = salary;
    }
    room.purchases.delete(manager);
    if (!body.accept || !(years >= 1 && years <= 4)) {
      cancelPurchase(room.game, manager, pu.slot);
      room.version++;
      broadcast(room);
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
    broadcast(room);
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
    broadcast(room);
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
    broadcast(room);
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
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/stadium/decline") {
    // Angebot abgelehnt: für diese Ausbauart gibt es heute keine Baufirma mehr (0x7E9)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    room.bauAbgelehnt.add(`${manager}:${Math.trunc(Number(body.kind))}`);
    room.version++;
    broadcast(room);
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
    broadcast(room);
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
    broadcast(room);
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
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/ticket") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const err = setTicketPrice(room.game, manager, Number(body.price));
    if (err) return json(res, 400, { error: err });
    room.version++;
    broadcast(room);
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
      broadcast(room);
      return json(res, 200, { ok: true, pending: true, message: `Anfrage über ${dmText(amount)} gestellt` });
    }
    const err = takeLoan(room.game, manager, Number(body.amount), months, rate, { day: d.day, month0: d.month - 1, year: d.year }, lender);
    if (err) return json(res, 400, { error: err });
    const von = lender === BANK ? "der Bank" : room.game.managers.at(lender).displayName;
    room.log.push(`${room.game.managers.at(manager).displayName}: Kredit von ${von} über ${Number(body.amount)} DM, ${months} Mon. zu ${rate} %`);
    room.version++;
    broadcast(room);
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
      broadcast(room);
      return json(res, 200, { ok: true, pending: true, amount: pruef.amount, message: `${name} überlegt - ${room.game.managers.at(owner).displayName} darf sich wehren` });
    }
    const r = poachAusfuehren(room, { poacher: manager, owner, place, bonus, playerIndex: l.playerIndex, name }, 0);
    if (!r) return json(res, 400, { error: "Der Wechsel findet nicht statt" });
    await persist(room);
    room.version++;
    broadcast(room);
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
    broadcast(room);
    return json(res, 200, { ok: true, agreed: r.agreed, chance: r.chance, message: r.agreed ? `${q.name} wechselt trotzdem` : `${q.name} bleibt bei Ihnen` });
  }
  if (p === "/api/derby") {
    // Einsatz für Spiele gegen andere Managervereine (Version 2026)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    if (!is2026(room.game)) return json(res, 400, { error: "Nur in der Version 2026" });
    setStakeLevel(room.game, manager, Number(body.level) | 0);
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/free/bid") {
    // Angebot für einen ablösefreien Spieler (Version 2026)
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const spieler = Number(body.playerIndex) | 0;
    const agent = room.freeAgents.find((a) => a.playerIndex === spieler);
    if (!agent) return json(res, 404, { error: "Der Spieler ist nicht mehr frei" });
    // Wer den Spieler gerade hat gehen lassen, bietet nicht mit
    if (agent.from === manager) return json(res, 400, { error: "Das war Ihr Spieler - bieten k|nnen nur die anderen" });
    if (isBlocked(room.game, manager)) return json(res, 400, { error: "Kaufsperre: Ihr Konto stand am Monatsende zu tief im Minus" });
    const salary = Math.max(0, Math.trunc(Number(body.salary)));
    agent.bids = agent.bids.filter((b) => b.manager !== manager);
    if (salary > 0) agent.bids.push({ manager, salary });
    room.log.push(`${room.game.managers.at(manager).displayName} bietet ${agent.name} ${dmText(salary)} Monatsgehalt`);
    room.version++;
    broadcast(room);
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
      broadcast(room);
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
    broadcast(room);
    return json(res, 200, { ok: true, message: `${bittsteller} bekommt ${dmText(q.amount)}` });
  }
  if (p === "/api/training") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const st = body.settings as TrainingSettings;
    const err = setTraining(room.game, manager, { balls: (st?.balls ?? []).map(Number), intensityBalls: Number(st?.intensityBalls), positions: (st?.positions ?? []).map(Number), slider: Number(st?.slider) });
    if (err) return json(res, 400, { error: err });
    room.version++;
    broadcast(room);
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
    broadcast(room);
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
    broadcast(room);
    return json(res, 200, { ok: true, value: v });
  }
  if (p === "/api/werbung") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const sponsor = Number(body.sponsor);
    const result = body.kind === "board" ? signBoard(room.game, manager, Number(body.slot), sponsor) : signShirt(room.game, manager, sponsor);
    if (!result.ok) return json(res, 400, { error: result.error });
    room.log.push(`${room.game.managers.at(manager).displayName}: ${body.kind === "board" ? `Bandenwerbung Platz ${Number(body.slot) + 1}` : "Trikotwerbung"} mit Sponsor ${sponsor + 1} abgeschlossen`);
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/messages/clear") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    room.save = room.save.clearMessages(manager);
    room.game = new GameState(room.save);
    room.version++;
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/squad") {
    if (!mine) return json(res, 403, { error: "nicht dein Manager" });
    const bytes = Buffer.from(String(body.data ?? ""), "base64");
    if (bytes.length !== SQUAD_BYTES) return json(res, 400, { error: "Kaderblock hat falsche Länge" });
    if (room.live && !room.live.paused) return json(res, 409, { error: "Erst das Spiel unterbrechen" });
    const before = room.game.save.plain.slice(SQUAD_OFFSET + manager * SQUAD_BYTES, SQUAD_OFFSET + (manager + 1) * SQUAD_BYTES);
    const fehler = uebernimmNummern(room.game, manager, bytes);
    if (fehler) return json(res, 400, { error: fehler });
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
    broadcast(room);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/save") {
    const file = String(body.file ?? room.file).replace(/[^A-Za-z0-9_.-]/g, "").toUpperCase();
    if (!file.endsWith(".MAN")) return json(res, 400, { error: "Dateiname" });
    // SERVER.MAN gehört dem Dienst: dort lag der Stand vor den Runden, und ein Neustart würde
    // eine so überschriebene Datei zur ersten Runde machen.
    if (file === SERVER_SAVE) return json(res, 409, { error: `${SERVER_SAVE} gehört dem Server - bitte einen anderen Namen` });
    // Der Vorrat der Spielstände ist allen gemeinsam. Eine fremde Datei still zu überschreiben
    // wäre die eine Art, wie ein Mitspieler einem anderen etwas kaputt machen kann - also fragen.
    if (!body.ueberschreiben && existsSync(join(savesDir, file))) return json(res, 409, { error: `${file} gibt es schon`, vorhanden: true });
    await writeFile(join(savesDir, file), room.save.withFreshHeader().encode());
    room.log.push(`gespeichert als ${file} (${user})`);
    return json(res, 200, { ok: true, file });
  }
  return json(res, 404, { error: "unbekannt" });
}

/**
 * Runden von der Platte holen. Gibt es noch kein Verzeichnis, aber ein SERVER.MAN aus der Zeit
 * vor den Runden, wird daraus die erste Runde: die laufende Partie geht weiter (GitLab #65).
 * Die alte Datei bleibt liegen, damit nichts unwiederbringlich verschoben wird.
 */
async function ladeRunden(): Promise<void> {
  mkdirSync(roundsDir, { recursive: true });
  let index: { next?: number; runden?: RoomMeta[] } | undefined;
  if (!args.includes("--fresh")) {
    try {
      index = JSON.parse(readFileSync(roundsIndex, "utf8")) as { next?: number; runden?: RoomMeta[] };
    } catch {
      /* noch kein Verzeichnis */
    }
    if (!index && existsSync(join(savesDir, SERVER_SAVE))) {
      const alt = join(savesDir, SERVER_SAVE);
      mkdirSync(join(roundsDir, "r1"), { recursive: true });
      copyFileSync(alt, roomSavePath("r1"));
      index = { next: 2, runden: [{ id: "r1", name: "Runde 1", creator: "", created: statSync(alt).mtimeMs, file: SERVER_SAVE, privat: false, gaeste: [] }] };
      console.log(`${SERVER_SAVE} übernommen als erste Runde (r1)`);
    }
  }
  nextRoomId = index?.next ?? 1;
  for (const roh of index?.runden ?? []) {
    // Ein Verzeichnis aus der Zeit vor den geschlossenen Runden kennt die beiden Felder nicht
    const meta: RoomMeta = { ...roh, privat: Boolean(roh.privat), gaeste: Array.isArray(roh.gaeste) ? roh.gaeste : [] };
    try {
      rooms.set(meta.id, await loadRoom(meta, roomSavePath(meta.id)));
    } catch (err) {
      // Eine beschädigte Runde darf den Dienst nicht in eine Neustartschleife schicken
      console.error(`Runde ${meta.id} (${meta.name}) nicht lesbar: ${String((err as Error).message)}`);
    }
    const n = Number(meta.id.replace(/^r/, ""));
    if (n >= nextRoomId) nextRoomId = n + 1;
  }
  // Ohne jede Runde, aber mit --load DATEI: daraus die erste Runde machen (Entwicklung, Tests)
  const start = argOf("--load");
  if (rooms.size === 0 && start) {
    const meta: RoomMeta = { id: neueRundenKennung(), name: start.replace(/\.MAN$/i, ""), creator: "", created: Date.now(), file: start, privat: false, gaeste: [] };
    try {
      rooms.set(meta.id, await loadRoom(meta, join(savesDir, start)));
    } catch (err) {
      console.error(`${start} nicht lesbar: ${String((err as Error).message)}`);
    }
  }
  if (!args.includes("--fresh")) saveRounds();
  // Sitzungen können auf eine Runde zeigen, die es nicht mehr gibt
  for (const [user, id] of [...activeRoom]) if (id && !rooms.has(id)) joinRoom(user, undefined);
}

loadSessions();
ladeMarken();
// Beim Beenden (auch beim Neustart des Dienstes) die laufenden Stände noch sichern
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    for (const r of rooms.values()) {
      try {
        mkdirSync(join(roundsDir, r.id), { recursive: true });
        writeFileSync(roomSavePath(r.id), r.save.withFreshHeader().encode());
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
    else if (url.pathname === "/einladung") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(einladungsSeite());
    }
    else await serveStatic(url.pathname, res, sessionUser(req), ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? ""), req.headers.range, req.headers["if-none-match"]);
  } catch (err) {
    // Die Einzelheiten bleiben im Protokoll: sie nennen Pfade und innere Zustaende
    console.error(`${req.method} ${url.pathname}:`, err);
    json(res, 500, { error: "Serverfehler" });
  }
}).listen(port, async () => {
  await ladeRunden();
  const users = loadUsers();
  const liste = [...rooms.values()].map((r) => `${r.id} ${r.name}`).join(", ");
  const leute = [...users.values()].map((u) => `${u.name} (${u.rolle})`).join(", ");
  console.log(`Bundesliga Manager Server: http://localhost:${port}/ Runden: ${liste || "keine"} Benutzer: ${leute || "keine (users.json fehlt)"}`);
  if (users.size && ![...users.values()].some((u) => u.rolle === "praesident"))
    console.warn("Kein Präsident angelegt: 'node packages/server/users.ts rolle NAME praesident'");
});
