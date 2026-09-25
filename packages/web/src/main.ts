/**
 * Prototyp 0: Spielstand-Browser im Originallook.
 * Lädt eine *.MAN-Datei, zeigt Hauptmenü, Mannschaft (mit Aufstellung),
 * Tabelle, Finanzen, Stadion und Meldungen und schreibt den geänderten
 * Spielstand als *.MAN zurück.
 */
import { SaveFile, GameState, replays, fixtures, vereinsInfo, restprogramm, restStartRueck, infoX, INFO_Y, INFO_BREITE, INFO_HOEHE, type InfoBefehl, sperreAusgesetzt, text as T, texte, dosText, statistics, allTimeTable, allTimeBalance, seriesRows, recordRows, roundNames, cupNames, strengthTable, strengthModes, tableOrder, matchdayView, matchdayDate, clubStrength, leagueScorers, playerScorers, squadScorers, cupView, LEAGUES, shirtContract, boardContract, offerAmount, offerYears, advertisingAmount, trainingSettings, trainingBars, TRAINING_BUDGET, camps, campTraits, CAMP_OPEN_START, campCost, stadiumState, stadiumCapacity, stadiumKinds, buildWeeks, stadiumMessages, sizeNames, statusNames, TICKET_RANGE, LOAN_MONTHS, LOAN_RATE_MIN, loanRate, lenderDebt, BANK, MARKET_MANAGER, OFFER_SQUAD, SYSTEM_NAMES, SYSTEM_OFFSET, playerInfo, nextCupDate, dayIndex, seasonDay, winPoints, is2026, ruleName, poachPrice, poachAmount, poachChance, poachLeft, poachAllowedFrom, salaryDemand, contractRefusals, squadHelp, tendencyWords, liveTexts, shootoutTexts, POACH_MAX_BONUS, POACH_MAX_PER_OWNER, DERBY_STAKES, POACH_COUNTER_MAX, MED_LEVELS, medRows, medCost, injuries, dopingRows, dopingRisk, isDoped, isDopeBanned, dopeApps, dopeBonus, DOPING_BONUS, DOPING_FRESH, DOPING_BAN, DOPING_FINE_BASE, DOPING_FINE_PERCENT, DOPING_MAX_CURES, dopingFine, baueSzene, pruefeBeschreibung, SZENE_GRENZEN, jugendLesen, jugendStaerke, jugendVorhanden, jugendKosten, jugendChance, jugendRisiko, jugendSprung, istReif, aufruecker, jugendAbwerbungen, JUGEND_MAX_ABWERBEN, JUGEND_MAX_FOERDERUNG, wirdGefoerdert, jugendHerkunft, JUGEND_NAMEN, JUGEND_ALTER, JUGEND_KOSTEN, JUGEND_PLAETZE, JUGEND_TRAINING, JUGEND_MAX_AUFRUECKER, JUGEND_TEAMS, type Beschreibung, type Szene, type Figur, type Lineup, type Standing, type MarketEntry, type SaleOffer } from "../../core/src/index.ts";
import { Assets, Sounds, COLORS, W, H, bevel, panel, button, hline, drawIcon, drawIconOver, toGame, upperGame, cp437ToGame, dm, type Font } from "./gfx.ts";
import { Scenes, SCENE_FRAME_MS, VIEW, type SceneData } from "./scene.ts";

/**
 * Auslosung, im Original gemessen (DOSBox-X mit 12000 Zyklen): das Schild steht rund eine
 * Sekunde in der Trommel und wandert dann mit gleichbleibender Geschwindigkeit von 12
 * Bildpunkten je Achse und 100 ms auf seinen Platz. Weite Wege dauern also länger; im Schnitt
 * ergibt das 1,6 s je Verein und knapp eine Minute für 32 Vereine.
 */
const DRUM_MS = 1000;
const FLY_PX_PER_STEP = 12;
const FLY_STEP_MS = 100;

/**
 * Auslosungstafel (PIC/47.VGA) im Original vermessen: Bild bei (16,7), 16 Zeilen im Abstand
 * von 10 Pixeln ab y = 19, Namensschilder links x 34 und rechts x 163, je 112 breit und 7 hoch;
 * die Beschriftung der Lostrommel steht mittig bei y = 193.
 */
const BOARD = { x: 16, y: 7, row0: 19, step: 10, left: 34, right: 163, w: 112, drumX: 104, drumY: 193, drumTop: 192 };
/** Schildfarbe und Schriftfarbe je Liga (Bundesliga, 2. Liga, Oberliga) aus dem Original. */
const PLATE = "#d3c3b2";
/** Beschriftung, Wert und Rahmen der Tafeln: die Palettenplätze 1, 2 und 6 aus PIC/1.PAL. */
const BESCHRIFTUNG = "#a2a2c3";
const WERT = "#8282a2";
const RAHMEN = "#414161";
/**
 * Der Statistikbildschirm überschreibt die Palettenplätze 19 bis 31 mit einem Verlauf von Rot
 * nach Grün für seine Finanzskala (0x27A5D). Platz 21 färbt nebenbei auch die Balken der
 * Zuschauergrafik, die vorher gezeichnet werden - daher deren ungewohntes Orange.
 */
const SKALA = ["#d30000", "#d32000", "#d34100", "#d36100", "#d38200", "#c3a200", "#c3c300", "#a2c300", "#82c300", "#61c300", "#41c300", "#20c300", "#00c300"];
/** Zeilenfarbe nach Mannschaftsteil, im Original abgelesen: Tor am dunkelsten, Angriff am hellsten. */
const GRUPPENFARBE: Record<string, string> = { TOR: "#714110", ABW: "#826141", MIT: "#928251", ANG: "#b2a271" };
const LEAGUE_INK = ["#000000", "#303051", "#826141"];
const leagueOfClub = (club: number): number => (club < 18 ? 0 : club < 38 ? 1 : 2);
/** Überschriften und Gruppenreihenfolge der Pokalübersicht (0x198EB, Tabellen 4cb3:0654/065C). */
const LEAGUE_CAPS = ["BUNDESLIGA", "ZWEITE LIGA", "AM.-OBERLIGA"];
const LEAGUE_GROUPS: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 2]];

type Screen = "start" | "lobby" | "verwaltung" | "zutritt" | "menu" | "squad" | "table" | "stadium" | "messages" | "seat" | "results" | "werbung" | "verlauf" | "live" | "start-online" | "newgame" | "training" | "camp" | "bank" | "market" | "spiele" | "staerken" | "bestenliste" | "pokal" | "statistik" | "ewige" | "optionen" | "zeitung" | "highscore" | "auslosung" | "abwerben" | "medizin" | "toreditor" | "jugend" | "extra2026";

interface ServerManager {
  index: number;
  name: string;
  club: string;
  clubIndex: number;
  seat: string | null;
  done: boolean;
  /** Der Manager hat aufgehört, sein Verein wird vom Rechner geführt (sim/ki.ts) */
  ki?: boolean;
}

/** Zusätze der Version 2026 (Server) */
interface ServerExtra {
  blocked: boolean[];
  /** Ausbauarten, deren Angebot dieser Tag schon abgelehnt hat ("Manager:Art") */
  bauAbgelehnt?: string[];
  derby: number[];
  poachRequests: { poacher: number; owner: number; place: number; bonus: number; playerIndex: number; name: string }[];
  loanRequests: { borrower: number; lender: number; amount: number }[];
  freeAgents: { playerIndex: number; name: string; position: string; age: number; strength: number[]; from: number; salary: number; value: number; bids: { manager: number; salary: number }[] }[];
  /** Frisch aus der Jugend aufgerückte Spieler; sie stehen bis zum Tageswechsel zur Abwerbung (#4) */
  jugendFrisch?: { manager: number; place: number; name: string; preis: number }[];
}

interface ServerOffer {
  manager: number;
  place: number;
  name: string;
  yearsFrom: number;
  yearsTo: number;
  salary: number;
}

interface MarketState {
  entries: MarketEntry[];
  listed: number[];
  sales: SaleOffer[];
  purchases: { manager: number; slot: number; playerIndex: number; name: string; amount: number; demands: number[] }[];
  subsidies?: { manager: number; amount: number }[];
  offers: { buyer: number; owner: number; slot: number; playerIndex: number; name: string; amount: number; loan: boolean }[];
  /** Bietgefecht der Version 2026: verdeckt - nur das eigene Gebot und die Zahl der Gebote */
  auctions?: { slot: number; anzahl: number; mein: number | null; loan: boolean }[];
}

interface LiveEntry {
  key: string;
  nachhol?: boolean;
  kind: "league" | "cup" | "playoff";
  league: number | null;
  cup: number | null;
  home: number;
  away: number;
  homeName: string;
  awayName: string;
  hg: number;
  ag: number;
  minute: number;
  managerHome: number | null;
  managerAway: number | null;
  /** Spieltag der Liga, beim Anpfiff festgehalten */
  spieltag?: number | null;
  attendance?: number | null;
  forfeit?: number | null;
  cards?: { home: { yellow: number; red: number; injured: number; players: number } | null; away: { yellow: number; red: number; injured: number; players: number } | null };
  chances: [number, number, number][];
}

interface LiveScene {
  id: string;
  mirror: boolean;
  goal: boolean;
  minute: number;
  side: "home" | "away";
  key: string;
  club: number;
  clubName: string;
  homeName: string;
  awayName: string;
  manager: number;
  scorer?: string;
  scorerGoals?: number;
  assist?: string;
  /** Schuss im Elfmeterschießen (#72) */
  elfmeter?: number;
  started: number;
  until: number;
  now: number;
}

/**
 * Plätze der fünfzehn Schalter im Einstellungsbildschirm (Tabellen 4cb3:5454 und 4cb3:5464):
 * 0..2 Halbzeitstände/Ergebnisse/Tabelle der 1. Liga, 3..5 der 2., 6..8 der 3. Liga,
 * 9 Torszenen, 10 DfB-Pokal, 11 Europapokale, 12 Nachholspiele, 13 Zeitung, 14 Blenden.
 */
const OPTION_PLACES: [number, number][] = [
  [122, 35], [122, 54], [122, 73],
  [180, 35], [180, 54], [180, 73],
  [238, 35], [238, 54], [238, 73],
  [122, 100], [122, 119], [122, 138], [122, 157],
  [238, 100], [238, 119],
];
const OPTION_DEFAULTS = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, false];
const OPTION_DFB = 10;
const OPTION_EUROPA = 11;
const OPTION_NACHHOL = 12;
const OPTION_BLENDEN = 14;
/** Dauer einer Überblendung */
const BLENDE_MS = 260;
const OPTION_ZEITUNG = 13;

interface LiveState {
  minute: number;
  paused: boolean;
  pausedBy: string | null;
  /** Halbzeit: wer die Ligaübersicht schon bestätigt hat */
  halfSeen?: string[] | null;
  finished: boolean;
  /** Ankündigung vor dem Anpfiff und ihre Restzeit beim Empfang */
  announce?: string | null;
  announceLeft?: number;
  scene: LiveScene | null;
  entries: LiveEntry[];
  subs: Record<string, { goalkeeper: number; field: number }>;
  news?: { minute: number; manager: number; name: string; kind: "yellow" | "red" | "yellowred" | "injury"; count?: number }[];
  /** Verletzung, die die Konferenz angehalten hat (Kaderbildschirm zum Auswechseln) */
  verletzung?: { manager: number; name: string } | null;
  /** Laufendes Elfmeterschießen; es steht vor der Konferenz, und alle sehen dasselbe (#72) */
  elfmeter?: LiveElfmeter | null;
}

/**
 * Gespielte Minuten der linken und der rechten Balkenhälfte (0x4EEF, 0x5186): regulär 1..45 und
 * 46..90, in der Verlängerung 91..105 und 106..120 - dort beginnen beide Balken wieder leer.
 */
function halbzeitMinuten(minute: number): [number, number] {
  if (minute > 90) return [Math.min(minute, 105) - 90, Math.max(0, minute - 105)];
  return [Math.min(minute, 45), Math.max(0, Math.min(minute, 90) - 45)];
}

/**
 * Elfmeterschießen (0x6733): erst die Tafel mit der Überschrift (`titel`), danach laufen die
 * Schüsse als Szenen der Konferenz. Es kommen nur die Schüsse, deren Szene vorbei ist.
 */
interface LiveElfmeter {
  home: number;
  away: number;
  homeName: string;
  awayName: string;
  schuesse: { seite: 0 | 1; tor: boolean; stand: [number, number] }[];
  titel: boolean;
  fertig: boolean;
}

/** Eine Spielrunde in der Lobby (GitLab #65) */
interface RoomInfo {
  id: string;
  name: string;
  creator: string;
  created: number;
  /** Geschlossene Runde: hinein kommt nur, wer eingeladen ist (GitLab #66) */
  privat: boolean;
  /** Ob der Fragende hinein darf; sonst stehen Datum und Besetzung nicht drin */
  zutritt: boolean;
  /** Eingeladene - nur für den, der die Runde einstellen darf */
  gaeste?: string[];
  file: string;
  date: { day: number; month0: number; year: number };
  dayIndex: number;
  live: boolean;
  managers: { name: string; club: string; seat: string | null; ki: boolean }[];
  anwesend: string[];
}

interface ServerState {
  version: number;
  build?: number;
  user?: string;
  /** Der Benutzer sitzt in keiner Runde: die Lobby ist dran */
  lobby?: boolean;
  rolle?: string;
  runde?: { id: string; name: string; creator: string };
  live?: LiveState | null;
  file?: string;
  dayIndex?: number;
  managers: ServerManager[];
  offers?: ServerOffer[];
  market?: MarketState;
  /** Zusätze der Version 2026 */
  extra?: ServerExtra;
  options?: { tempo: number; scenes: boolean; zeitung?: boolean; flags?: boolean[] };
  /** Öffnungszeiten der acht Trainingslager (4cb3:0620), über 0 heißt geschlossen */
  campOpen?: number[];
  ceremony?: { cup: number; phase: "vote" | "draw" | "list"; ready: boolean; votes: Record<string, boolean>; startedAt: number | null; skipped: boolean; seen: string[] } | null;
  highscore?: { name: string; club: string; titles: [number, number, number]; points: number }[];
  /** Tagessummen der Kontostände je Manager (für den Guthabenzins der Monatsvorschau) */
  kontosummen?: number[];
  merkbits?: number[];
  zeitung?: { manager: number; headline: string[]; sentences: string[]; picture: number; lineup: string; goals: string; yellow: string; red: string }[];
  lastDay?: string[];
  /** Kalendermeldungen des Hauptmenüs für den Hinweiskasten (0x143ED, GitLab #31) */
  hinweise?: { manager: number; zeilen: string[] }[];
  /** Abschlussbild: Meisterschaft (kind 0) oder Pokalsieg (1..4) eines Managervereins */
  abschluss?: { manager: number; kind: number; verein: string }[];
  /** Abgelaufene Verträge, über die noch verhandelt wird (Saisonende, 0x0DB40 mit 0x251FF) */
  vertragsende?: { manager: number; place: number; name: string }[];
  log: string[];
  data?: string;
}

interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Der Klickpunkt in Spielkoordinaten kommt mit, für Regler und Leisten */
  action: (x: number, y: number) => void;
}

/** Farben der fünf Kennbuchstaben im Trainingslager (Palette 24, 1, 15, 19, 18) */
const TRAIT_COLORS = ["#b2a271", "#a2a2c3", "#719241", "#c37120", "#b20020"];

const MONTHS = ["Januar", "Februar", "M{rz", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
// Das Original rechnet den Wochentag vier Tage versetzt (11.11.1997 = Samstag, 15.11.1997 = Mittwoch).
const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

class App {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  assets = new Assets();
  save?: SaveFile;
  game?: GameState;
  fileName = "SPIEL.MAN";
  manager = 0;
  screen: Screen = "start";
  hits: Hit[] = [];
  selectedRow = -1;
  /** Meldungen im Hauptmenü: erste angezeigte Meldung */
  msgTop = 0;
  /** Stärketabelle: 0 GESAMT, 1 ABWEHR, 2 MITTELFELD, 3 STURM */
  staerkenMode = 0;
  /** Stadion: Zeile unter dem Mauszeiger (0 = Gesamtkapazität, 1..8 = Ausbauarten) */
  stadiumHover = -1;
  /** Letzter Fehler beim Zeichnen; steht oben im Bild, statt das Fenster stehen zu lassen */
  zeichenFehler = "";
  /** Klänge aus SOUND/DIGI.VOC */
  klaenge = new Sounds();
  /** Torszene: laufende Szene und das letzte Bild, zu dem die Klänge schon gespielt wurden */
  tonSzene = "";
  /**
   * Zuletzt gespielte Torszene der Konferenz. Das Original legt beim Laden einer Szene deren
   * Urheber in den Puffer 4cb3:4BD8; ein Rechtsklick zeigt ihn dann im Hinweiskasten (GitLab #28).
   */
  letzteSzene = "";
  tonBild = -1;
  /** Torszene: der abschließende Klang (Tor bzw. kein Tor) ist schon gelaufen */
  tonSchluss = false;
  /** Konferenz: zuletzt gepfiffene Spielminute (Anpfiff je Halbzeit) */
  tonMinute = -1;
  /** Konferenz: zuletzt eingeblendete Karten-/Verletzungsmeldung und wie lange noch */
  kartenMeldung: { text: string; farbe: string; bild: number; manager: number; bis: number } | null = null;
  kartenGesehen = 0;
  /** Konferenz: zuletzt gesehene Karten und Verletzungen je Spielseite */
  tonKarten = new Map<string, [number, number]>();
  /** Rückfrage "Möchten Sie das Spiel wirklich beenden ?" im Hauptmenü */
  endeDialog = false;
  /** Zusatzbildschirm 2026: gewählter ablösefreier Spieler */
  freiSel = -1;
  /** Abwerben (Version 2026): angesehener Mitspieler, gewählter Kaderplatz, Aufschlag in Prozent */
  abwerbenOwner = -1;
  abwerbenPlace = -1;
  abwerbenBonus = 0;
  /** Blenden (Schalter 14): Ende der laufenden Überblendung */
  blendeBis = 0;
  blendeLaeuft = false;
  /** Letzte bekannte Zeigerposition in Bildschirmpunkten (-1, solange der Zeiger draußen ist) */
  maus = { x: -1, y: -1 };
  /** Kredite: gewählter Geldgeber (4 = Bank), Summenanzeige statt Liste, Zeile unter dem Zeiger */
  bankLender = BANK;
  bankSummary = false;
  bankHover = -1;
  /** Trainingslager: 0..4 Kennwert, 5..12 Lager unter dem Mauszeiger, sonst -1 */
  campHover = -1;
  /** Stadion: angeklickte Ausbauart 1..8 und die eingestellte Menge */
  stadiumPick = 0;
  stadiumAmount = 0;
  /** Stadion: die Rückfrage "NA KLAR !" / "ACH NEE..." steht an */
  stadiumAsk = false;
  /** Stadion: die vom Server gewürfelte Bauzeit in Tagen je Ausbauart, wie sie die Rückfrage nennt */
  bauTage: Record<number, number> = {};
  /** Halbzeit: welche Liga die Übersicht gerade zeigt */
  halfPage = 0;
  resultPage = 0;
  /** Medizin: angeklickte Zeile */
  medPlace = -1;
  /** Torszenen-Editor (GitLab #6): Beschreibung, gebaute Szene und Bedienzustand */
  /** Hat dieser Sitzung die Hilfe des Editors schon gesehen? */
  editorGesehen = false;
  editor: {
    b: Beschreibung;
    szene: Szene | null;
    bild: number;
    figur: number;
    zwiebel: boolean;
    laeuft: boolean;
    ziehen: number | null;
    meldung: string;
    /** Der Hilfetext liegt als Blatt über dem Editor (GitLab #6). */
    hilfe: boolean;
    /** Wiedergabe wie in der Konferenz: nur der Kameraausschnitt, dazu die Klänge. */
    wieImSpiel: boolean;
    /** Namen der auf dem Server abgelegten Szenen, für den Schalter SZENE >. */
    namen: string[];
  } | null = null;
  /** Medizin: Arzt oder Doping */
  medView: "arzt" | "doping" = "arzt";
  /** Jugend: gewählte Mannschaft und Zeile */
  jugendTeam = 2;
  jugendPlatz = -1;
  jugendMeldung = "";
  /** Kader: Spielfeld eingeblendet, dazu der angeklickte Kaderplatz */
  pitchOpen = false;
  pitchSel = -1;
  /**
   * Offene Tafel "Info über <Verein>" (0x2A41E) über Tabelle, Spielplan oder Stärkeliste; `rest`
   * zeigt statt dessen das Restprogramm (0x028C4), `rueck` dessen Rückrunde.
   */
  vereinsInfo: { club: number; modus: number; versatz: number; platz?: number; rest: boolean; rueck: boolean } | null = null;
  /** Seite im Managerverlauf (16 Saisons je Seite wie 0x29BFE). */
  verlaufSeite = 0;
  /** Kaderbildschirm: Liste der Stärken oder der Verträge */
  squadView: "kader" | "vertrag" = "kader";
  /** Vertragsansicht: angeklickter Kaderplatz für die Verlängerung */
  vertragPlace = -1;
  /** Kader: Feld unter dem Mauszeiger auf dem Spielfeld */
  pitchHover: { col: number; row: number } | null = null;
  /** Kaderplatz der offenen Spielerinfo (0x15346), -1 = zu */
  infoPlace = -1;
  /** Zahl der bereits gezogenen Namen der Auslosung (0x17C26/0x184BA) */
  drawStep = 0;
  /** Zeremonie wurde vom Server erzwungen (nach einem neuen Spiel) */
  forcedCeremony = false;
  /** Startzeit einer selbst gestarteten Zeremonie */
  drawStartedAt = 0;
  tableMode: "gesamt" | "heim" | "auswaerts" = "gesamt";
  marketMode: "kaufen" | "leihen" = "kaufen";
  marketSel = -1;
  /** Hauptmenü: geöffnetes Untermenü (linke/rechte Symbolspalte), füllt die mittleren neun Felder */
  submenu: "buero" | "wappen" | "trikots" | "pokal" | "diskette" | null = null;
  tableLeague = -1;
  spieleLeague = 0;
  spieleMd = 0;
  staerkenLeague = 0;
  bestMode: "liga" | "spieler" = "liga";
  bestLeague = 0;
  cup = 0;
  status = "";
  // Mehrspieler: Zustand vom Server
  online = false;
  server: ServerState = { version: 0, managers: [], log: [] };
  /** Lobby: die laufenden Runden, die eigene und die eigene Rolle (GitLab #65) */
  rooms: RoomInfo[] = [];
  aktiveRunde: string | null = null;
  rolle = "spieler";
  /** Name, den eine neu angelegte Runde bekommen soll (leer: der Server vergibt einen) */
  rundenName = "";
  /** Benutzerverwaltung (nur Präsident): Liste, ob Mailversand eingerichtet ist, Seite */
  benutzer: { name: string; rolle: string; email: string; offen: boolean }[] = [];
  versand = false;
  benutzerSeite = 0;
  /** Zutrittsbildschirm: welche Runde, und die Namen aller Konten für die Gästeliste */
  zutrittRunde: RoomInfo | null = null;
  namen: string[] = [];
  player = "";
  lastMatchday = -1;
  /** Werbebildschirm: 0 Trikot, 1 Banden */
  werbungPage = 0;
  /** gewählter Bandenplatz, betrachtetes Angebot und ob die Sponsorenansicht offen ist */
  werbungSlot = 0;
  werbungOffer = 0;
  werbungActive = false;
  /** Live-Konferenz: Zustand vom Server, Zeitpunkt des Empfangs, Szenenbilder */
  live: LiveState | null = null;
  liveReceived = 0;
  wasLive = false;
  /** Bis dahin bleibt eine Servermeldung in der Statuszeile stehen */
  statusUntil = 0;
  /**
   * Zahleneingabe im Spielbild (das Original hat dafür Eingabefelder, keine Browser-Dialoge).
   * `imKasten` heißt: die Felder stehen im Vertragskasten des Kaderbildschirms selbst.
   */
  /** Kaderbildschirm: Zeile unter der Maus und Nummer der Spalte für die Hilfszeile */
  squadHover = -1;
  squadSpalte = -1;
  /** Antwort der letzten Vertragsverhandlung, steht unter der Tabelle */
  vertragsAntwort = "";
  /** Kalendertag, an dem die Runde der auslaufenden Verträge schon geöffnet wurde */
  vertragsRunde = -1;
  /** Trainingslager gebucht: bis wann der Kasten mit dem Kopf steht (0x119CD) */
  lagerBis = 0;
  /** Rückfrage im Kasten des Originals statt eines Browserfensters */
  frage: { zeilen: string[]; ja: () => void } | null = null;
  /** Kurze Rückmeldung des Originals mit einem Knopf (z.B. "ist im Moment nicht verhandlungsbereit") */
  hinweis: string[] | null = null;
  /** OKAY auf einen Serverhinweis ist abgeschickt, die Antwort steht noch aus */
  hinweisQuittiert = -1;
  eingabe: { titel: string; felder: { label: string; wert: string; max: number; text?: boolean; roh?: boolean }[]; feld: number; imKasten: boolean; okLabel?: string; ok: (werte: number[], texte: string[]) => void; gehaltFuer?: (jahre: number) => number } | null = null;
  /** Programmstand des Servers beim Laden (dist/app.js) */
  buildId = 0;
  scenes = new Scenes();
  animating = false;
  /** Neues Spiel: Vereinsliste vom Server, Logo-Leiste, Manager-Plätze */
  setup = { clubs: [] as { index: number; name: string; logo: number; league: number }[], strip: 0, selected: 0, slots: [0, 1, 2, 3].map((i) => ({ name: "", club: -1, portrait: i + 1 })), level: 2, regeln: 0 };

  constructor() {
    this.canvas = document.getElementById("screen") as HTMLCanvasElement;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.addEventListener("click", (e) => this.onClick(e));
    const bewegung = (e: MouseEvent) => {
      this.onMove(e);
      this.onMovePitch(e);
    };
    this.canvas.addEventListener("mousemove", bewegung);
    // Zweite Quelle: Safari liefert je nach Eingabegerät keine mousemove-Ereignisse
    this.canvas.addEventListener("pointermove", (e) => bewegung(e as unknown as MouseEvent));
    this.canvas.addEventListener("mouseleave", () => {
      this.maus = { x: -1, y: -1 };
      if (this.hoverZeile()) this.render();
    });
    // Im Original verlässt man ein Untermenü mit der rechten Maustaste
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.onRightClick();
    });
    // Zahleneingaben laufen über die Tastatur (Vertragsdauer, Gehalt, Angebote)
    window.addEventListener("keydown", (e) => this.onKey(e));
    const input = document.getElementById("file") as HTMLInputElement;
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      if (f) void (this.online ? this.uploadFile(f) : this.openFile(f));
    });
  }

  async init(): Promise<void> {
    await this.assets.load("");
    this.klaenge.laden("", ["digi0", "digi1", "digi2", "digi3", "digi4"]);
    this.musikPflegen();
    // Entwicklung: ?load=RIED-CLI.MAN&screen=squad&manager=0
    const q = new URLSearchParams(location.search);
    const load = q.get("load");
    if (load) {
      const r = await fetch("saves/" + load);
      if (r.ok) {
        await this.openFile(new File([await r.arrayBuffer()], load));
        if (q.get("manager")) this.manager = Number(q.get("manager"));
        const s = q.get("screen") as Screen | null;
        if (s) this.go(s);
        // Entwicklung: &info=Verein[&modus=0..2&platz=n&rest=1] öffnet die Vereinsinfo
        if (q.get("info")) {
          this.oeffneVereinsInfo(Number(q.get("info")), Number(q.get("modus") ?? 2), Number(q.get("versatz") ?? 0), q.get("platz") ? Number(q.get("platz")) : undefined);
          if (this.vereinsInfo && q.get("rest")) this.vereinsInfo.rest = true;
        }
        // Entwicklung: ?live=10.T[&mirror=1] spielt eine Torszene in einer nachgestellten Konferenz
        const sceneId = q.get("live");
        if (sceneId && this.game) this.demoLive(sceneId, q.get("mirror") === "1", Number(q.get("frame") ?? -1));
      }
    } else {
      await this.connect();
    }
    this.render();
  }

  // ---- Mehrspieler -------------------------------------------------------

  /** Anmeldeformular (index.html) zeigen; nach erfolgreicher Anmeldung wird neu verbunden. */
  showLogin(): void {
    const box = document.getElementById("login") as HTMLElement;
    const form = document.getElementById("loginForm") as HTMLFormElement;
    const err = document.getElementById("loginError") as HTMLElement;
    box.hidden = false;
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const data = new FormData(form);
      const r = await fetch("api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: data.get("user"), password: data.get("password") }) });
      if (!r.ok) {
        err.textContent = ((await r.json()) as { error?: string }).error ?? "Anmeldung fehlgeschlagen";
        return;
      }
      err.textContent = "";
      box.hidden = true;
      await this.connect();
      this.render();
    };
    // Passwort vergessen: der Server schickt einen Link an die hinterlegte Adresse und verrät
    // dabei nicht, ob es das Konto überhaupt gibt (GitLab #65)
    const vergessen = document.getElementById("vergessen") as HTMLButtonElement | null;
    if (vergessen)
      vergessen.onclick = async () => {
        const name = (form.elements.namedItem("user") as HTMLInputElement).value.trim();
        if (!name) {
          err.textContent = "Bitte erst den Namen oder die Adresse eintragen.";
          return;
        }
        await fetch("api/passwort/vergessen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        err.textContent = "Ist die Adresse bekannt, liegt gleich eine Mail im Postfach.";
      };
    (form.elements.namedItem("user") as HTMLInputElement).focus();
  }

  async connect(): Promise<void> {
    const me = await fetch("api/me", { cache: "no-store" });
    if (me.status === 401) {
      this.showLogin();
      return;
    }
    if (!me.ok) return;
    const konto = (await me.json()) as { user: string; rolle?: string };
    this.player = konto.user;
    this.rolle = konto.rolle ?? "spieler";
    await this.fetchState();
    this.online = true;
    const es = new EventSource("api/events");
    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as { version: number; build?: number; live?: LiveState | null; lobby?: boolean };
      // Neuer Programmstand auf dem Server: Seite neu laden. Das muss hier stehen und nicht nur
      // in fetchState(), sonst erfährt ein offenes Fenster nie davon, solange niemand am Spiel
      // etwas ändert - der Datenstrom meldet sich nach einem Neustart mit derselben Version.
      if (msg.build && this.buildId && msg.build !== this.buildId && !msg.live && !this.live) {
        location.reload();
        return;
      }
      if (msg.build) this.buildId = msg.build;
      // In der Lobby hat sich etwas getan: die Liste der Runden neu holen
      if (msg.lobby) {
        void this.fetchRooms().then(() => this.render());
        return;
      }
      this.onLive(msg.live ?? null);
      if (msg.version !== this.server.version) void this.fetchState().then(() => this.render());
      else this.render();
    };
    await this.fetchRooms();
    this.screen = !this.aktiveRunde ? "lobby" : this.server.version === 0 ? "start-online" : "seat";
  }

  /** Die laufenden Runden vom Server holen (Lobby, GitLab #65). */
  async fetchRooms(): Promise<void> {
    const r = await fetch("api/rooms", { cache: "no-store" });
    if (!r.ok) return;
    const d = (await r.json()) as { rooms: RoomInfo[]; active: string | null; rolle?: string };
    this.rooms = d.rooms;
    this.aktiveRunde = d.active;
    this.rolle = d.rolle ?? this.rolle;
  }

  /** Einer Runde beitreten; danach steht die Managerwahl an. */
  async beitreten(id: string): Promise<void> {
    if (!(await this.post("api/rooms/join", { id })).ok) return;
    await this.fetchRooms();
    this.go(this.server.version > 0 ? "seat" : "start-online");
    this.render();
  }

  /** Zurück in die Lobby: der Platz in der Runde wird frei. */
  async zurueckZurLobby(): Promise<void> {
    if (this.aktiveRunde) await this.post("api/rooms/leave", {});
    await this.fetchRooms();
    this.go("lobby");
    this.render();
  }

  /** Eine neue Runde anlegen heißt: die eigene verlassen und ein Spiel beginnen oder hochladen. */
  async neueRunde(): Promise<void> {
    if (this.aktiveRunde) await this.post("api/rooms/leave", {});
    await this.fetchRooms();
    this.rundenName = "";
    this.go("start-online");
    this.render();
  }

  /** Gesicherten Spielstand (*.MAN) auf den Server laden; er ersetzt das laufende Spiel. */
  async uploadFile(f: File): Promise<void> {
    // Rückfragen stellt das Spiel in seinem eigenen Kasten, nicht der Browser (GitLab #36)
    await new Promise<void>((weiter) => this.fragJaNein([toGame(f.name.toUpperCase()), "HOCHLADEN?", "DAS LAUFENDE SPIEL", "WIRD ERSETZT."], () => weiter()));
    const data = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
    await this.post("api/upload", { name: f.name, data, runde: this.rundenName });
    await this.fetchRooms();
    if (this.server.version > 0) this.go("seat");
    this.render();
  }

  async loadSetup(): Promise<void> {
    const r = await fetch("api/mana", { cache: "no-store" });
    if (!r.ok) {
      this.status = "Server: " + ((await r.json()) as { error?: string }).error;
      return;
    }
    this.setup.clubs = ((await r.json()) as { clubs: typeof this.setup.clubs }).clubs;
    this.go("newgame");
    this.render();
  }

  startNewGame(): void {
    const managers = this.setup.slots.filter((sl) => sl.name && sl.club >= 0);
    if (managers.length === 0) {
      this.hinweis = ["MINDESTENS EIN MANAGER", "BRAUCHT NAME UND VEREIN."];
      this.render();
      return;
    }
    const starten = () =>
      void this.post("api/newgame", { managers, level: this.setup.level, rules: this.setup.regeln, runde: this.rundenName }).then(() => {
        void this.fetchRooms();
        if (this.server.version > 0) this.go("seat");
        this.render();
      });
    if (this.server.version > 0) this.fragJaNein(["NEUES SPIEL BEGINNEN?", "DAS LAUFENDE SPIEL", "WIRD ERSETZT."], starten);
    else starten();
  }

  /**
   * Trainingsbildschirm (0x139EC), Maße aus dem Original abgelesen und mit dem Code abgeglichen:
   * links und rechts die senkrechten Leisten aus PIC/1.VGA (Ausschnitt 0,0 21x165) bei (3,14)
   * und (298,14); darin stehen von unten die noch freien Bälle (0x22995, Zeilen 0 und 1) bei
   * x 5 bzw. 300 und y 177 - 16·k, höchstens zehn sichtbar.
   *
   * Die Balken sind Ausschnitte desselben Bildes: links zwei Stücke (21,0 84x21 bei x 30 und
   * 23,0 82x21 bei x 112), rechts nur eines (21,0 84x21 bei x 209). Zeile i liegt bei
   * y = 34 + 37·i, die Intensität bei y = 188. Die Bälle sitzen bei x = 31 + 16·(k-1) bzw.
   * 210 + 16·(k-1) und y = Balken + 2; ihr Schlüsselfarbe ist Index 0 (PIC/1.VGA.a).
   *
   * Die Beschriftung (0x74EC) steht mittig zwischen 29 und 191 (Intensität 193) bzw. 208 und
   * 290, mit schwarzem Schatten ein Pixel rechts; y = Balken + 28 ist die unterste Zeile, die
   * Schrift beginnt also sechs Zeilen höher.
   *
   * Links unten der Kasten (3,183)-(22,232) mit den drei Balken K, T und E (0x10AF2), rechts
   * unten der Jugendregler aus PIC/37.VGA (0,54 50x41) bei (209,193) mit dem weißen Strich bei
   * y 212/213 ab x 217 und dem Betrag (Byte 319 + 1)·625 in der kleinen Schrift.
   */
  drawTraining(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const m = this.manager;
    const st = trainingSettings(g, m);
    const pic = this.assets.img("1.VGA");
    const ball = this.assets.img("1.VGA.a");
    const regler = this.assets.img("37.VGA");
    const mine = this.online ? this.myManagerLive() === m : true;
    const send = () => {
      if (!mine) {
        this.status = "Nur der eigene Manager kann das Training {ndern";
        return;
      }
      void this.post("api/training", { manager: m, settings: st });
    };
    const restCat = TRAINING_BUDGET.categories - st.balls.reduce((a, b) => a + b, 0);
    const restPos = TRAINING_BUDGET.positions - st.positions.reduce((a, b) => a + b, 0);
    // Beschriftung: Text in Farbe 11, davor derselbe Text schwarz ein Pixel weiter rechts
    const label = (text: string, cx: number, y: number) => {
      f.drawCenter(ctx, text, cx + 1, y, COLORS.black, false);
      f.drawCenter(ctx, text, cx, y, "#d3c3b2", false);
    };
    // Senkrechte Leisten mit den freien Bällen
    if (pic) {
      ctx.drawImage(pic, 0, 0, 21, 165, 3, 14, 21, 165);
      ctx.drawImage(pic, 0, 0, 21, 165, 298, 14, 21, 165);
    }
    if (ball)
      for (const [x, n] of [
        [5, restCat],
        [300, restPos],
      ] as [number, number][])
        for (let k = 1; k <= n; k++) {
          const y = 177 - 16 * k;
          if (y <= 15) break;
          ctx.drawImage(ball, 21, 21, 15, 15, x, y, 15, 15);
        }
    // Ein Balken mit seinen Bällen und der Beschriftung darunter
    const bar = (x: number, y: number, slots: number, text: string, cx: number, ly: number, hy: number, value: number, set: (v: number) => void) => {
      if (pic) {
        ctx.drawImage(pic, 21, 0, 84, 21, x, y, 84, 21);
        if (slots > 5) ctx.drawImage(pic, 23, 0, 82, 21, x + 82, y, 82, 21);
      }
      if (ball) for (let k = 1; k <= Math.min(value, slots); k++) ctx.drawImage(ball, 21, 21, 15, 15, x + 1 + 16 * (k - 1), y + 2, 15, 15);
      label(text, cx, ly);
      this.hit(x + 1, hy, 16 * slots, 17, (mx) => set(Math.min(slots, Math.floor((mx - x) / 16) + 1)));
    };
    ["Kondition", "Spiel", "Schuss", "Taktik"].forEach((n, i) =>
      bar(30, 34 + 37 * i, 10, n, 110, 56 + 37 * i, 34 + 37 * i, st.balls[i], (v) => {
        if (v - st.balls[i] > restCat) {
          this.status = `Nur ${TRAINING_BUDGET.categories} B{lle f}r die Bereiche`;
          return;
        }
        st.balls[i] = v;
        send();
      }),
    );
    ["Tor", "Abwehr", "Mittelfeld", "Angriff"].forEach((n, i) =>
      bar(209, 34 + 37 * i, 5, n, 249, 56 + 37 * i, 34 + 37 * i, st.positions[i], (v) => {
        if (v - st.positions[i] > restPos) {
          this.status = `Nur ${TRAINING_BUDGET.positions} B{lle f}r die Positionen`;
          return;
        }
        st.positions[i] = v;
        send();
      }),
    );
    bar(30, 188, 10, "Intensit{t", 111, 209, 189, st.intensityBalls, (v) => {
      st.intensityBalls = v;
      send();
    });
    // Kasten links unten: K, T und E (0x10AF2), Balken je 4 Pixel breit im Abstand 6
    ctx.fillStyle = "#303051";
    ctx.fillRect(3, 183, 20, 50);
    ctx.strokeStyle = "#a2a2c3";
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 183.5, 19, 49);
    const werte = trainingBars(g, m);
    const balken = ["#617120", "#618230", "#719241"];
    werte.forEach((v, i) => {
      const x = 5 + 6 * i;
      const y = 223 - v;
      ctx.fillStyle = balken[i];
      ctx.fillRect(x, y, 4, 224 - y);
      ctx.strokeStyle = COLORS.black;
      ctx.strokeRect(x + 0.5, y + 0.5, 3, 223 - y);
      s.draw(ctx, "KTE"[i], x, 226, balken[i], false);
    });
    // Jugendregler (0x227F1): Klickfläche 209..260 x 193..232, Wert = x - 217, 0..34
    if (regler) ctx.drawImage(regler, 0, 54, 50, 41, 209, 193, 50, 41);
    ctx.fillStyle = "#f3f3f3";
    // Der Balken reicht bis zum eingestellten Punkt einschließlich: Wert 0 ist ein Punkt breit
    ctx.fillRect(217, 212, st.slider + 1, 2);
    s.drawCenter(ctx, String((st.slider + 1) * 625), 236, 219, "#f3f3f3", false);
    this.hit(209, 193, 52, 40, (mx) => {
      st.slider = Math.max(0, Math.min(TRAINING_BUDGET.slider, Math.round(mx) - 217));
      send();
    });
    // Nur das Symbol HAUPT MENU, der Rest der rechten Spalte fehlt im Original
    this.iconFrame(270, 196);
    drawIcon(ctx, this.assets, "hauptmenu", 277, 202);
    this.hit(270, 196, 46, 36, () => this.go("menu"));
  }

  /**
   * Trainingslager (0x113E5), am Original vermessen: PIC/5.VGA ist ein Bogen aus 2x4 Kacheln zu
   * 130x39 (Balkentafel und Foto), Kachel i steht bei (Spalte·132 + 4, Zeile·52 + 7). Ein Lager,
   * das gerade nicht geöffnet hat (4cb3:0620), bekommt die Spinnwebe PIC/43.VGA bei
   * (Spalte·86 + 52, Zeile·52 + 9) übergeblendet. Unter jeder Kachel stehen in kleiner Schrift
   * die fünf Kennbuchstaben E F P R V bei x = Rand + 8·k + 8 (Rand 0 bzw. 217) in den Farben
   * 24, 1, 15, 19 und 18 sowie der Name mittig zwischen Spalte·86 + 47 und + 141; die unterste
   * Zeile ist Zeile·52 + 51.
   *
   * Unten zeigt das Original beim Überfahren (0x0243F) in großer Schrift mittig zwischen 0 und
   * 266 bei y 225 entweder den Kennwert ("Erholungswert") oder "<Lager>, <Preis> DM/Woche.".
   * Ein Klick auf ein geschlossenes Lager meldet "... hat nicht geöffnet...", sonst wird gebucht
   * und der Bildschirm schließt sich.
   */
  drawCamp(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const pic = this.assets.img("5.VGA");
    const web = this.assets.img("43.VGA.a");
    const open = this.server.campOpen ?? CAMP_OPEN_START;
    const text = (font: typeof f, str: string, x: number, y: number, color: string) => {
      font.draw(ctx, str, x + 1, y, COLORS.black, false);
      font.draw(ctx, str, x, y, color, false);
    };
    const center = (font: typeof f, str: string, x1: number, x2: number, y: number, color: string) => {
      text(font, str, x1 + Math.trunc((x2 - x1) / 2) - Math.trunc(font.width(str) / 2), y, color);
    };
    camps().forEach((c, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      if (pic) ctx.drawImage(pic, col * 130, row * 39, 130, 39, col * 132 + 4, row * 52 + 7, 130, 39);
      if (open[i] > 0 && web) ctx.drawImage(web, col * 86 + 52, row * 52 + 9);
      const name = upperGame(c.name);
      center(s, name, col * 86 + 47, col * 86 + 141, row * 52 + 47, "#f3f3f3");
      campTraits().forEach((t, k) => text(s, t.letter, (col ? 217 : 0) + 8 * k + 8, row * 52 + 47, TRAIT_COLORS[k]));
      // Kacheln sind anklickbar (x 52..130 bzw. 137..216, y Zeile·52 + 9..41)
      this.hit(col * 85 + 52, row * 52 + 9, 79, 33, () => this.bookCamp(i));
    });
    // Hinweiszeile: Kennwert oder Lager mit Wochenpreis
    if (this.campHover >= 0) {
      const h = this.campHover;
      const line = h < 5 ? campTraits()[h].name : `${camps()[h - 5].name}, ${campCost(g, this.manager, h - 5)} DM/Woche.`;
      center(f, toGame(dosText(line)), 0, 266, 219, "#a2a2c3");
    }
    // Nur das Symbol HAUPT MENU wie im Original
    this.iconFrame(270, 196);
    drawIcon(ctx, this.assets, "hauptmenu", 277, 202);
    this.hit(270, 196, 46, 36, () => this.go("menu"));
    // Nach der Buchung steht kurz der Kasten mit dem Kopf (im Original Bild 28 bei (132,78),
    // 57x58; von lhuno am Original wiedererkannt)
    if (this.lagerBis > Date.now()) {
      this.hits = [];
      bevel(ctx, 132, 78, 57, 58, COLORS.black);
      const kopf = this.assets.img("28.VGA");
      if (kopf) ctx.drawImage(kopf, 133, 79);
      this.hit(0, 0, W, H, () => undefined);
    }
  }

  /** Lager buchen: geschlossene Lager und die Sperre meldet der Server wie das Original. */
  bookCamp(camp: number): void {
    const open = this.server.campOpen ?? CAMP_OPEN_START;
    if (open[camp] > 0) {
      this.status = toGame(dosText(camps()[camp].name)) + " " + T("ui.lagerzu");
      this.statusUntil = Date.now() + 6000;
      return;
    }
    void this.post("api/camp", { manager: this.manager, camp }).then((antwort) => {
      if (!antwort.ok) return;
      // Das Original zeigt während der Rechnung einen Kasten mit dem Kopf (Bild 28 bei 132,78,
      // 57x58) und wartet, bevor es zurückkehrt (0x119E4 lädt, 0x11A1E zeichnet, 0x11CFD wartet)
      this.lagerBis = Date.now() + 1200;
      this.render();
      window.setTimeout(() => {
        this.lagerBis = 0;
        this.go("menu");
        // go() zeichnet nicht selbst: es blendet nur über, und die Blende ist in der Vorgabe
        // abgeschaltet. Ohne das render() hier blieb der Kasten mit dem Kopf stehen, bis
        // irgendetwas anderes ein Neuzeichnen auslöste (GitLab #69).
        this.render();
      }, 1200);
    });
  }

  /**
   * Lobby (GitLab #65): welche Spielrunden laufen, wer sitzt darin, wo ist noch Platz. Der
   * Server hält höchstens vier; ein freier Platz in der Liste ist zugleich der Weg zu einer
   * neuen Runde - anlegen dürfen das Präsident und Trainer.
   */
  drawLobby(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 8, 46, 304, 178);
    f.drawCenter(ctx, toGame("Spielrunden"), 160, 52, COLORS.white);
    const darfNeu = this.rolle === "praesident" || this.rolle === "trainer";
    for (let i = 0; i < 4; i++) {
      const r = this.rooms[i];
      const y = 66 + 33 * i;
      bevel(ctx, 16, y, 288, 30);
      if (!r) {
        s.drawCenter(ctx, toGame(darfNeu ? "frei - hier eine neue Runde anlegen" : "frei"), 160, y + 12, COLORS.white, false);
        if (darfNeu) this.hit(16, y, 288, 30, () => void this.neueRunde());
        continue;
      }
      const drin = r.id === this.aktiveRunde;
      const meins = r.creator === this.player || this.rolle === "praesident";
      // Der Name links, Datum rechts; die Breite ist knapp, also wird gekürzt
      f.draw(ctx, this.kuerzen(f, toGame(r.name), meins ? 130 : 160), 22, y + 3, drin ? COLORS.white : undefined, false);
      if (r.zutritt) f.drawRight(ctx, toGame(`${r.date.day}.${r.date.month0 + 1}.${r.date.year}`), meins ? 246 : 298, y + 3, COLORS.text, false);
      // Zweite Zeile: wer auf welchem Verein sitzt - bei einer verschlossenen Runde steht dort
      // nur, dass sie zu ist und wem sie gehört
      const plaetze = r.managers.map((m) => (m.seat ? toGame(m.seat) : m.ki ? "RECHNER" : "FREI")).join("  ");
      const zeile = !r.zutritt ? `geschlossen - ${r.creator ? r.creator + " lädt ein" : "nicht eingeladen"}` : r.live ? "Konferenz läuft - " + plaetze : r.privat ? "geschlossen - " + plaetze : plaetze;
      s.draw(ctx, this.kuerzen(s, toGame(zeile), meins ? 220 : 272), 22, y + 18, !r.zutritt ? COLORS.panelDark : r.live ? COLORS.red : COLORS.white, false);
      this.hit(16, y, meins ? 232 : 288, 30, () =>
        r.zutritt ? void this.beitreten(r.id) : (this.hinweis = this.umbrechen(toGame("DIESE RUNDE IST GESCHLOSSEN."), 176, 3)),
      );
      if (meins) {
        button(ctx, f, r.privat ? "ZU" : "AUF", 250, y + 7, 26, r.privat);
        this.hit(248, y, 30, 30, () => void this.zutrittOeffnen(r));
        button(ctx, f, "X", 282, y + 7, 16);
        this.hit(280, y, 24, 30, () => this.rundeLoeschen(r));
      }
    }
    const wer = `${this.player ?? ""} (${{ praesident: "Präsident", trainer: "Trainer" }[this.rolle] ?? "Spieler"})`;
    s.drawCenter(ctx, this.kuerzen(s, toGame("Angemeldet als " + wer), 290), 160, 206, COLORS.textDim, false);
    if (this.rolle === "praesident") {
      button(ctx, f, "BENUTZER", 8, 224, 76);
      this.hit(8, 224, 76, 16, () =>
        void this.ladeBenutzer().then(() => {
          this.go("verwaltung");
          this.render();
        }),
      );
    }
  }

  /**
   * Benutzerverwaltung (GitLab #65), nur für den Präsidenten. Angelegt wird ohne Passwort: erst
   * der Link aus der Einladung schaltet ein Konto frei. Ohne eingerichteten Mailversand steht
   * der Link im Protokoll des Servers - dann trägt man ihn von Hand weiter.
   */
  drawVerwaltung(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 8, 46, 304, 178);
    f.drawCenter(ctx, toGame("Benutzer"), 160, 52, COLORS.white);
    const proSeite = 7;
    const seiten = Math.max(1, Math.ceil(this.benutzer.length / proSeite));
    this.benutzerSeite = Math.min(this.benutzerSeite, seiten - 1);
    const sichtbar = this.benutzer.slice(this.benutzerSeite * proSeite, this.benutzerSeite * proSeite + proSeite);
    const kurz: Record<string, string> = { praesident: "PR[SIDENT", trainer: "TRAINER", spieler: "SPIELER" };
    sichtbar.forEach((u, i) => {
      const y = 64 + 20 * i;
      bevel(ctx, 16, y, 288, 18);
      s.draw(ctx, this.kuerzen(s, toGame(u.name), 66), 20, y + 6, COLORS.white, false);
      // Rolle anklicken schaltet weiter; der Server lässt den letzten Präsidenten nicht fallen
      s.draw(ctx, kurz[u.rolle] ?? "SPIELER", 90, y + 6, u.rolle === "praesident" ? COLORS.red : COLORS.text, false);
      this.hit(88, y, 56, 18, () => this.rolleWeiter(u));
      s.draw(ctx, this.kuerzen(s, toGame(u.email || (u.offen ? "keine Adresse" : "-")), 106), 146, y + 6, COLORS.panelDark, false);
      this.hit(144, y, 108, 18, () =>
        this.fragText("ADRESSE", "EMAIL", u.email, 40, (e) => void this.post("api/users/email", { name: u.name, email: e }).then(() => this.ladeBenutzer()).then(() => this.render()), true),
      );
      // Einladen verschickt den Link neu: bei einem offenen Konto die Einladung, sonst ein
      // Zurücksetzen des Passworts
      button(ctx, f, u.offen ? "!" : "M", 258, y + 1, 16, u.offen);
      this.hit(256, y, 20, 18, () => void this.post("api/users/einladen", { name: u.name }).then(() => this.ladeBenutzer()).then(() => this.render()));
      button(ctx, f, "X", 282, y + 1, 16);
      this.hit(280, y, 22, 18, () =>
        this.fragJaNein([this.kuerzen(f, toGame(u.name.toUpperCase()), 176), toGame("ENTFERNEN?")], () => void this.post("api/users/entfernen", { name: u.name }).then(() => this.ladeBenutzer()).then(() => this.render())),
      );
    });
    if (seiten > 1) {
      button(ctx, f, "<", 16, 206, 16);
      button(ctx, f, ">", 36, 206, 16);
      this.hit(16, 206, 16, 16, () => (this.benutzerSeite = Math.max(0, this.benutzerSeite - 1)));
      this.hit(36, 206, 16, 16, () => (this.benutzerSeite = Math.min(seiten - 1, this.benutzerSeite + 1)));
      s.draw(ctx, `${this.benutzerSeite + 1}/${seiten}`, 58, 211, COLORS.textDim, false);
    }
    if (!this.versand) s.drawCenter(ctx, toGame("Kein Mailversand eingerichtet - die Links stehen im Protokoll"), 160, 211, COLORS.textDim, false);
    button(ctx, f, "NEUER BENUTZER", 8, 224, 110);
    this.hit(8, 224, 110, 16, () => this.neuerBenutzer());
    button(ctx, f, "LOBBY", 246, 224, 60);
    this.hit(246, 224, 60, 16, () => {
      this.go("lobby");
      this.render();
    });
  }

  /** Rolle weiterschalten: Spieler, Trainer, Präsident. */
  rolleWeiter(u: { name: string; rolle: string }): void {
    const folge = ["spieler", "trainer", "praesident"];
    const naechste = folge[(folge.indexOf(u.rolle) + 1) % folge.length];
    void this.post("api/users/rolle", { name: u.name, rolle: naechste })
      .then(() => this.ladeBenutzer())
      .then(() => this.render());
  }

  /** Neuen Benutzer anlegen: Name, dann Adresse; mit Adresse geht die Einladung gleich raus. */
  neuerBenutzer(): void {
    this.fragText("NEUER BENUTZER", "NAME", "", 20, (name) => {
      if (!name.trim()) return;
      this.fragText(
        "EINLADUNG AN",
        "EMAIL",
        "",
        40,
        (email) => {
          void this.post("api/users/add", { name: name.trim().toLowerCase(), email: email.trim(), rolle: "spieler" })
            .then(() => this.ladeBenutzer())
            .then(() => this.render());
        },
        true,
      );
    });
  }

  async ladeBenutzer(): Promise<void> {
    const r = await fetch("api/users", { cache: "no-store" });
    if (!r.ok) return;
    const d = (await r.json()) as { users: typeof this.benutzer; versand: boolean };
    this.benutzer = d.users;
    this.versand = d.versand;
  }

  /**
   * Zutritt zu einer Runde (GitLab #66): offen für alle oder nur für Eingeladene. Die Gästeliste
   * steht dem offen, der die Runde angelegt hat, und dem Präsidenten.
   */
  drawZutritt(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const r = this.zutrittRunde;
    if (!r) {
      this.go("lobby");
      return;
    }
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 8, 46, 304, 178);
    f.drawCenter(ctx, this.kuerzen(f, toGame(`Zutritt: ${r.name}`), 290), 160, 52, COLORS.white);
    // Der Schalter: offen für alle oder nur für Eingeladene
    bevel(ctx, 16, 64, 288, 20);
    s.draw(ctx, toGame(r.privat ? "Nur wer eingeladen ist, kommt herein." : "Offen: jeder darf beitreten."), 22, 71, COLORS.white, false);
    button(ctx, f, toGame(r.privat ? "ÖFFNEN" : "SCHLIESSEN"), 218, 66, 80);
    this.hit(218, 66, 80, 18, () => void this.zutrittSchalten(r, !r.privat));
    const gaeste = r.gaeste ?? [];
    // Der Ersteller steht immer drin und braucht keine Einladung
    const liste = this.namen.filter((n) => n !== r.creator);
    liste.slice(0, 6).forEach((n, i) => {
      const y = 90 + 20 * i;
      const drin = gaeste.includes(n);
      bevel(ctx, 16, y, 288, 18);
      // Die Leiste ist hell: Weiß für die Eingeladenen, Dunkelblau für die anderen. Das blasse
      // Braun der Statuszeilen verschwand darauf fast (vom Anwender gemeldet).
      s.draw(ctx, this.kuerzen(s, toGame(n), 150), 22, y + 6, drin ? COLORS.white : COLORS.panelDark, false);
      s.draw(ctx, toGame(drin ? "eingeladen" : "nicht eingeladen"), 176, y + 6, drin ? COLORS.white : COLORS.panelDark, false);
      button(ctx, f, drin ? "-" : "+", 282, y + 1, 16, drin);
      this.hit(16, y, 288, 18, () => void this.gastSchalten(r, n, !drin));
    });
    if (liste.length > 6) s.drawCenter(ctx, toGame(`und ${liste.length - 6} weitere - die Liste zeigt sechs`), 160, 214, COLORS.textDim, false);
    else s.drawCenter(ctx, this.kuerzen(s, toGame(`${r.creator || "niemand"} hat die Runde angelegt und ist immer dabei`), 290), 160, 214, COLORS.textDim, false);
    button(ctx, f, "LOBBY", 246, 224, 60);
    this.hit(246, 224, 60, 16, () => {
      this.go("lobby");
      this.render();
    });
  }

  /** Zutrittsbildschirm öffnen; dazu die Namen der Konten holen. */
  async zutrittOeffnen(r: RoomInfo): Promise<void> {
    const antwort = await fetch("api/spieler", { cache: "no-store" });
    this.namen = antwort.ok ? ((await antwort.json()) as { namen: string[] }).namen : [];
    this.zutrittRunde = r;
    this.go("zutritt");
    this.render();
  }

  /** Nach jeder Änderung die Runden neu holen, damit der Bildschirm den Stand des Servers zeigt. */
  private async zutrittAuffrischen(id: string): Promise<void> {
    await this.fetchRooms();
    this.zutrittRunde = this.rooms.find((x) => x.id === id) ?? null;
    this.render();
  }

  async zutrittSchalten(r: RoomInfo, privat: boolean): Promise<void> {
    if (!(await this.post("api/rooms/zutritt", { id: r.id, privat })).ok) return;
    await this.zutrittAuffrischen(r.id);
  }

  async gastSchalten(r: RoomInfo, name: string, dazu: boolean): Promise<void> {
    if (!(await this.post("api/rooms/gast", { id: r.id, name, dazu })).ok) return;
    await this.zutrittAuffrischen(r.id);
  }

  /** Runde löschen: der Spielstand wird auf dem Server nur beiseitegelegt, nicht weggeworfen. */
  rundeLoeschen(r: RoomInfo): void {
    this.fragJaNein([this.kuerzen(this.assets.font, toGame(r.name.toUpperCase()), 176), toGame("RUNDE LÖSCHEN?"), toGame("DER SPIELSTAND WIRD"), toGame("BEISEITE GELEGT.")], () => {
      void this.post("api/rooms/delete", { id: r.id })
        .then(() => this.fetchRooms())
        .then(() => this.render());
    });
  }

  drawStartOnline(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 40, 60, 240, 150);
    f.drawCenter(ctx, "BUNDESLIGA MANAGER PROFESSIONAL", 160, 68, COLORS.white);
    let y = 90;
    const item = (label: string, action: () => void) => {
      bevel(ctx, 60, y, 200, 22);
      f.drawCenter(ctx, label, 160, y + 7, COLORS.white);
      this.hit(60, y, 200, 22, action);
      y += 30;
    };
    // Die Schaltflächen sind 200 breit: ein langer Dateiname fällt weg, bevor er über den Rand läuft
    const fortsetzen = toGame(`SPIEL FORTSETZEN (${this.server.file ?? ""})`);
    if (this.server.version > 0) item(f.width(fortsetzen) <= 190 ? fortsetzen : "SPIEL FORTSETZEN", () => this.go("seat"));
    item("NEUES SPIEL", () => void this.loadSetup());
    // Der Kasten ist innen 236 breit; in einer Zeile lief der Hinweis darüber hinaus
    f.drawCenter(ctx, toGame("Spielstand hochladen:"), 160, y + 4);
    f.drawCenter(ctx, toGame("Datei unten wählen"), 160, y + 16);
    // Name der Runde: leer heißt, der Server vergibt einen (GitLab #65)
    const s = this.assets.micro;
    s.drawCenter(ctx, this.kuerzen(s, toGame(`Runde: ${this.rundenName || "(Name vom Server)"} - zum Ändern klicken`), 230), 160, 188, COLORS.white, false);
    this.hit(60, 184, 200, 12, () =>
      this.fragText("NAME DER RUNDE", "NAME", this.rundenName, 24, (n) => {
        this.rundenName = n;
        this.render();
      }),
    );
    f.drawCenter(ctx, toGame("Angemeldet als " + this.player), 160, 200);
    button(ctx, f, "LOBBY", 246, 224, 60);
    this.hit(246, 224, 60, 16, () => void this.zurueckZurLobby());
  }

  drawNewGame(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const st = this.setup;
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 0, 40, 320, 200);
    // Logo-Leiste wie im Original: sechs Vereine, breite Pfeile links und rechts, Name darunter
    bevel(ctx, 4, 42, 312, 58);
    const perPage = 6;
    const visible = st.clubs.slice(st.strip, st.strip + perPage);
    visible.forEach((c, i) => {
      const x = 30 + i * 44;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, 46, 40, 40);
      const logo = this.assets.img(80 + c.logo + ".VGA");
      if (logo) ctx.drawImage(logo, x, 46);
      if (c.index === st.selected) {
        ctx.strokeStyle = COLORS.red;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, 45, 42, 42);
        ctx.lineWidth = 1;
      }
      this.hit(x, 46, 40, 40, () => (st.selected = c.index));
    });
    const maxStrip = Math.max(0, st.clubs.length - perPage);
    button(ctx, f, "<", 6, 58, 20, st.strip > 0);
    button(ctx, f, ">", 294, 58, 20, st.strip < maxStrip);
    this.hit(4, 42, 24, 58, () => (st.strip = Math.max(0, st.strip - perPage)));
    this.hit(292, 42, 24, 58, () => (st.strip = Math.min(maxStrip, st.strip + perPage)));
    const sel = st.clubs[st.selected];
    s.drawCenter(ctx, cp437ToGame(sel ? `${sel.name}  (${["1.LIGA", "2.LIGA", "3.LIGA"][sel.league]})` : ""), 160, 90, COLORS.white);
    s.drawCenter(ctx, `SEITE ${Math.floor(st.strip / perPage) + 1}/${Math.ceil(st.clubs.length / perPage)}  -  WAPPEN ANKLICKEN, DANN AUF DAS VEREINSFELD EINES MANAGERS`, 160, 101, COLORS.textDim);
    // vier Manager-Plätze: Verein oben, Porträt unten, Name darunter
    st.slots.forEach((sl, i) => {
      const x = 20 + i * 75;
      bevel(ctx, x, 106, 64, 116);
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 12, 110, 40, 40);
      if (sl.club >= 0) {
        const c = st.clubs[sl.club];
        const logo = c && this.assets.img(80 + c.logo + ".VGA");
        ctx.fillStyle = "#fff";
        ctx.fillRect(x + 12, 110, 40, 40);
        if (logo) ctx.drawImage(logo, x + 12, 110);
      } else s.drawCenter(ctx, "VEREIN", x + 32, 128, COLORS.white);
      this.hit(x + 12, 110, 40, 40, () => (sl.club = st.selected));
      const faces = this.assets.img("0.VGA");
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 12, 156, 40, 40);
      if (faces) ctx.drawImage(faces, (sl.portrait - 1) * 41, 0, 40, 40, x + 12, 156, 40, 40);
      this.hit(x + 12, 156, 40, 40, () => (sl.portrait = (sl.portrait % 4) + 1));
      s.drawCenter(ctx, cp437ToGame(sl.name || "NAME ?"), x + 32, 204, sl.name ? COLORS.white : COLORS.textDim);
      this.hit(x, 200, 64, 20, () =>
        this.fragText("NAME DES MANAGERS", "NAME", sl.name, 12, (n) => {
          sl.name = n;
          this.render();
        }),
      );
    });
    if (this.status) s.drawCenter(ctx, toGame(this.status.toUpperCase()), 160, 214, COLORS.red);

    s.draw(ctx, `SPIEL-LEVEL ${st.level}`, 6, 228, COLORS.white);
    button(ctx, f, "-", 62, 224, 16);
    button(ctx, f, "+", 82, 224, 16);
    this.hit(62, 224, 16, 16, () => (st.level = Math.max(1, st.level - 1)));
    this.hit(82, 224, 16, 16, () => (st.level = Math.min(4, st.level + 1)));
    // Regelwerk: das Original spielt nach den Regeln von 1993, die Version 2026 nach den heutigen
    s.draw(ctx, "REGELN", 104, 228, COLORS.white);
    button(ctx, f, st.regeln === 1 ? "2026" : "1993", 132, 224, 44, st.regeln === 1);
    this.hit(132, 224, 44, 16, () => (st.regeln = st.regeln === 1 ? 0 : 1));
    button(ctx, f, "START", 180, 224, 60, true);
    this.hit(180, 224, 60, 16, () => this.startNewGame());
    button(ctx, f, "ZUR}CK", 246, 224, 60);
    this.hit(246, 224, 60, 16, () => this.go("start-online"));
  }

  async fetchState(): Promise<void> {
    const r = await fetch("api/state", { cache: "no-store" });
    if (r.status === 401) {
      this.showLogin();
      return;
    }
    if (!r.ok) return;
    const st = (await r.json()) as ServerState;
    // Neuer Programmstand auf dem Server: Seite neu laden (außer während einer laufenden Konferenz)
    if (st.build && this.buildId && st.build !== this.buildId && !st.live) {
      location.reload();
      return;
    }
    if (st.build) this.buildId = st.build;
    this.server = st;
    this.hinweisQuittiert = -1;
    this.onLive(st.live ?? null);
    // Die eigene Runde ist weg (gelöscht oder verlassen): zurück in die Lobby
    if (st.lobby && this.online && !["lobby", "verwaltung", "zutritt", "start-online", "newgame"].includes(this.screen)) {
      await this.fetchRooms();
      this.go("lobby");
      return;
    }
    if (!st.data) return;
    const bytes = Uint8Array.from(atob(st.data), (c) => c.charCodeAt(0));
    this.save = SaveFile.decode(bytes);
    this.game = new GameState(this.save);
    this.fileName = st.file ?? this.fileName;
    // eigener Sitzplatz
    const mine = st.managers.find((m) => m.seat === this.player && this.player);
    if (mine) this.manager = mine.index;
    // nach einem Spieltag: Ergebnisse zeigen
    const md = this.game.nextMatchday(this.leagueOf(this.manager));
    const seitenlauf = !!st.live?.paused && (st.live.pausedBy === "HALBZEIT" || st.live.pausedBy === "SCHLUSS");
    if (this.lastMatchday >= 0 && md !== this.lastMatchday && this.screen !== "seat" && !seitenlauf) this.go("results");
    this.lastMatchday = md;
    // Auslaufende Verträge (0x0DB40): das Original hält den Saisonwechsel an und führt für
    // jeden Spieler den Vertragsdialog. Hier öffnet sich die Vertragsansicht einmal je Tag beim
    // ersten Spieler; wer am Zugende noch offen ist, verlässt den Verein ("kein Angebot").
    const offen = this.offeneVertraege();
    if (offen.length && this.vertragsRunde !== dayIndex(this.game) && !st.live && this.screen !== "seat") {
      this.vertragsRunde = dayIndex(this.game);
      this.squadView = "vertrag";
      this.go("squad");
      this.vertragOeffnen(offen[0].place);
    }
    // Zeremonie: hinein, solange sie offen ist, hinaus, wenn alle bestätigt haben. Nach einem
    // Pokaltag steht sie schon an, während die Konferenz noch ihre Schlusstafeln zeigt - erst
    // wenn die weggeklickt sind, ist die Auslosung dran, wie im Original nach dem Spieltag (#71)
    if (this.ceremonyPending() && !this.live) {
      if (this.screen !== "auslosung") {
        this.cup = this.server.ceremony!.cup;
        this.go("auslosung");
      }
    } else if (this.screen === "auslosung" && !this.server.ceremony && this.forcedCeremony) {
      this.forcedCeremony = false;
      this.go("menu");
    }
    this.updateStatus();
  }

  /** Meine noch offenen Verhandlungen über abgelaufene Verträge, in Kaderreihenfolge. */
  offeneVertraege(): { place: number; name: string }[] {
    return (this.server.vertragsende ?? [])
      .filter((v) => v.manager === this.manager && v.place >= 0)
      .map((v) => ({ place: v.place, name: v.name }))
      .sort((a, b) => a.place - b.place);
  }

  /** Läuft der Vertrag dieses Kaderplatzes aus und ist noch nicht entschieden? */
  vertragOffen(place: number): boolean {
    return this.offeneVertraege().some((v) => v.place === place);
  }

  /** Vertragskasten für einen Kaderplatz öffnen (Zeile auswählen und Eingabe starten). */
  vertragOeffnen(place: number): void {
    const l = this.game?.squadOf(this.manager)[place];
    if (!l) return;
    this.selectedRow = place;
    this.vertragPlace = place;
    this.vertragsAntwort = "";
    this.vertragEingabe(l, place, 0);
  }

  /**
   * Spalte des Managerkopfs in PIC/0.VGA. Das Bild wählt der Spieler beim neuen Spiel, es steht
   * als 1..4 in Managerbyte 29 - nicht die Nummer des Managers (in DOSBox aufgefallen: NORMI
   * hat Bild 3, das Remake zeigte Bild 1; GitLab #56).
   */
  gesichtSpalte(manager: number): number {
    const v = this.game?.managers.at(manager).u8(29) ?? 1;
    return Math.max(0, Math.min(3, v - 1)) * 41;
  }

  leagueOf(manager: number): number {
    const c = this.game!.managers.at(manager).clubIndex;
    return c < 18 ? 0 : c < 38 ? 1 : 2;
  }

  updateStatus(): void {
    if (!this.online) return;
    if (Date.now() < this.statusUntil) return;
    if (this.live) {
      this.status = "";
      return;
    }
    const waiting = this.server.managers.filter((m) => !m.done).map((m) => m.name);
    const me = this.server.managers[this.manager];
    this.status = me?.done ? "Fertig. Warten auf: " + waiting.join(", ") : waiting.length ? "Noch nicht fertig: " + waiting.join(", ") : "";
  }

  /**
   * Anfrage an den Server. `stumm` unterdrückt die Statuszeile - dann trägt der Aufrufer die
   * Antwort selbst ein (der Vertragskasten zeigt sie im Original unter der Tabelle).
   */
  async post(path: string, body: unknown, stumm = false): Promise<{ ok: boolean; message?: string }> {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 401) {
      this.showLogin();
      return { ok: false };
    }
    let antwort: { ok: boolean; message?: string } = { ok: r.ok };
    if (!r.ok) {
      const fehler = ((await r.json().catch(() => ({}))) as { error?: string }).error;
      antwort = { ok: false, message: fehler };
      // Absagen zeigt das Original im Hinweiskasten; die Statuszeile ist eine Zutat des
      // Remakes und gehört nicht dorthin (GitLab #36)
      if (!stumm && fehler) this.hinweis = this.umbrechen(toGame(fehler.toUpperCase()), 176, 4);
    } else {
      const daten = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      antwort = { ok: daten.ok !== false, message: daten.message };
      if (daten.message && !stumm) {
        this.status = daten.message;
        this.statusUntil = Date.now() + 6000;
      }
    }
    await this.fetchState();
    this.render();
    return antwort;
  }

  takeSeat(index: number): void {
    const name = this.player;
    if (!name) {
      this.showLogin();
      return;
    }
    this.manager = index;
    this.lastMatchday = this.game ? this.game.nextMatchday(this.leagueOf(index)) : -1;
    void this.post("api/seat", { manager: index, player: name }).then(() => {
      // Nach einem neuen Spiel wartet die Auslosung; sie läuft bei allen gleichzeitig
      this.go(this.ceremonyPending() ? "auslosung" : "menu");
      this.render();
    });
  }

  /** Eigenen Kaderblock (25 Kaderplätze) an den Server schicken. */
  async sendSquad(): Promise<void> {
    const me = this.server.managers[this.manager];
    if (!me || me.seat !== this.player) {
      this.status = "Nur der eigene Kader kann geändert werden";
      return;
    }
    const block = this.save!.plain.subarray(21400 + this.manager * 1300, 21400 + (this.manager + 1) * 1300);
    const data = btoa(String.fromCharCode(...block));
    await this.post("api/squad", { manager: this.manager, player: this.player, data });
    this.status = "Aufstellung an den Server gesendet";
    this.render();
  }

  finishTurn(): void {
    if (!this.online) {
      this.status = "Tageswechsel nur im Mehrspielermodus";
      return;
    }
    const me = this.server.managers[this.manager];
    if (!me || me.seat !== this.player) {
      this.status = "Erst einen Manager übernehmen (Manager-Knopf)";
      return;
    }
    void this.post(me.done ? "api/undone" : "api/done", { manager: this.manager });
  }

  /** Laufende Toreinblendungen markierter Vereine (0x1093F), je mit ihrem Ende. */
  ticker: { text: string; bis: number }[] = [];

  /**
   * Tor in einem Spiel ohne Manager, an dem ein markierter Verein (ANZEIGEN, Vereinsbyte 33 Bit 7)
   * beteiligt ist: das Original blendet unten "HEIM - GAST   h:a" ein (Tore je auf die letzte
   * Ziffer gekürzt) und wartet 70/3 Timerticks (0x10A5C bis 0x10AD7). Mehrere nacheinander.
   */
  tickerNachTor(before: LiveState | null, live: LiveState | null): void {
    if (!before || !live || !this.game) return;
    const g = this.game;
    const markiert = (c: number) => c < 64 && (g.clubs.at(c).u8(33) & 0x80) !== 0;
    const DAUER = Math.round((70 / 3 / 18.2) * 1000);
    for (const e of live.entries) {
      if (e.managerHome !== null || e.managerAway !== null) continue;
      if (!markiert(e.home) && !markiert(e.away)) continue;
      const alt = before.entries.find((x) => x.key === e.key);
      if (!alt || (e.hg <= alt.hg && e.ag <= alt.ag)) continue;
      const start = Math.max(Date.now(), this.ticker.length ? this.ticker[this.ticker.length - 1].bis : 0);
      this.ticker.push({ text: `${cp437ToGame(e.homeName)} - ${cp437ToGame(e.awayName)}   ${e.hg % 10}:${e.ag % 10}`, bis: start + DAUER });
    }
  }

  /** Toreinblendung: Streifen y 231..239 schwarz, Text mittig über 0..320 in Farbe 29 (0x10A71, 0x10AA2). */
  drawTicker(): void {
    const jetzt = Date.now();
    this.ticker = this.ticker.filter((t) => t.bis > jetzt);
    const t = this.ticker[0];
    if (!t) return;
    const ctx = this.ctx;
    const s = this.assets.micro;
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(0, 231, W, 9);
    s.draw(ctx, t.text, Math.trunc(320 / 2) - Math.trunc(s.width(t.text) / 2), 233, "#f3f3f3", false);
    setTimeout(() => this.render(), Math.max(50, t.bis - jetzt));
  }

  /** Neuer Live-Zustand vom Server: Bildschirm wechseln, Szenenbilder nachladen, Animation starten. */
  onLive(live: LiveState | null): void {
    const before = this.live;
    this.live = live;
    this.liveReceived = Date.now();
    this.tickerNachTor(before, live);
    if (live) {
      this.wasLive = true;
      if (!this.scenes.ready) void this.scenes.load("").then(() => this.render());
      const wasPaused = before?.paused ?? false;
      const away = this.screen !== "live" && this.screen !== "squad";
      const seitenlauf = live.paused && (live.pausedBy === "HALBZEIT" || live.pausedBy === "SCHLUSS");
      // Läuft die Konferenz (nicht unterbrochen), holt sie jeden zurück; in der Unterbrechung darf man sich frei bewegen
      if (seitenlauf) {
        if (this.screen !== "live") this.go("live");
      } else if (away && (!live.paused || !before)) this.go("live");
      else if (away && wasPaused && !live.paused) this.go("live");
      if (live.scene && !this.animating) this.animate();
      // Verletzung eines eigenen Spielers: das Original hält an und öffnet den Kaderbildschirm
      const v = live.verletzung;
      if (v && live.paused && v.manager === this.myManagerLive() && this.screen !== "squad") {
        this.go("squad");
        this.status = toGame(`${cp437ToGame(v.name)} ist verletzt - auswechseln?`);
        this.statusUntil = Date.now() + 20000;
        this.render();
      }
    } else if (before && this.wasLive) {
      this.wasLive = false;
      // Nach den Seiten des Originals (Übersicht, Tabellen, Zeitungen) geht es direkt ins
      // Hauptmenü; eine Liste aller Spiele des Tages gibt es dort nicht.
      if (this.screen === "live" || this.screen === "squad") this.go("menu");
    }
  }

  /** Läuft eine Auslosungszeremonie, die ich noch nicht bestätigt habe? */
  /** Läuft eine Auslosung, die mich betrifft? Der Bildschirm bleibt dann gesperrt. */
  ceremonyPending(): boolean {
    const c = this.server.ceremony;
    return !!c && !!this.player && this.server.managers.some((m) => m.seat === this.player);
  }

  animate(): void {
    this.animating = true;
    const step = () => {
      if (!this.live?.scene || this.screen !== "live") {
        this.animating = false;
        return;
      }
      this.render();
      setTimeout(step, SCENE_FRAME_MS);
    };
    step();
  }

  myManagerLive(): number | null {
    const me = this.server.managers.find((m) => m.seat === this.player && this.player);
    return me ? me.index : null;
  }

  livePause(): void {
    const m = this.myManagerLive();
    if (m === null || !this.live) return;
    if (this.live.paused) {
      this.go("squad");
      this.render();
      return;
    }
    // Nach dem Bildschirmwechsel neu zeichnen: post() zeichnet noch mit dem alten Bildschirm,
    // und solange die Konferenz steht, kommt vom Server kein neuer Zustand mehr - ohne das
    // Neuzeichnen bliebe die Konferenztafel stehen und niemand käme zum Auswechseln.
    void this.post("api/live/pause", { manager: m }).then(() => {
      this.go("squad");
      this.render();
    });
  }

  liveResume(): void {
    const m = this.myManagerLive();
    if (m === null) return;
    void this.post("api/live/resume", { manager: m }).then(() => {
      this.go("live");
      this.render();
    });
  }

  /**
   * Ankündigung vor dem Anpfiff (0x31FA mit 0x32F2): die ganze Seite in Schwarz-Rot-Gold mit
   * einem Rand in Palettenfarbe 11, darauf in der großen Schrift 3 mittig "Ligaspiel",
   * "DFB-Pokal" oder "Europapokal". Kästen (im Original: box 1,1..318,79 / 80..160 / 161..238),
   * Text zentriert zwischen x 0 und 319 mit Grundlinie y 128.
   */
  drawAnkuendigung(text: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#d3c3b2";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#000000";
    ctx.fillRect(1, 1, 318, 79);
    ctx.fillStyle = "#b20020";
    ctx.fillRect(1, 80, 318, 81);
    ctx.fillStyle = "#c37120";
    ctx.fillRect(1, 161, 318, 78);
    const gr = this.assets.gross;
    gr.draw(ctx, text, 159 - Math.trunc(gr.width(text) / 2), 114, COLORS.white, false);
  }

  /**
   * Elfmeterschießen (0x6733): dieselbe Tafel wie vor dem Anpfiff, darauf die Überschrift und
   * die beiden Vereine. Die Zeilen stehen, wo das Original sie hinschreibt - Überschrift bei
   * y=50, Heimverein bei 100, "gegen" bei 128 und der Gast bei 156 (0x6737 ff.); "gegen" in
   * Beige (#d3c3b2), alles andere weiß. Die Schüsse laufen danach als Szenen der Konferenz (im
   * Original gemessen, GitLab #72).
   */
  drawElfmeter(e: LiveElfmeter): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#d3c3b2";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#000000";
    ctx.fillRect(1, 1, 318, 79);
    ctx.fillStyle = "#b20020";
    ctx.fillRect(1, 80, 318, 81);
    ctx.fillStyle = "#c37120";
    ctx.fillRect(1, 161, 318, 78);
    const gr = this.assets.gross;
    const f = this.assets.font;
    // Stammt der Textkatalog noch von vor #72, fehlt die Gruppe: dann bleibt die Tafel eben
    // ohne Überschrift, statt dass die Konferenz abstürzt
    let ueberschrift = "";
    let gegen = "";
    try {
      [ueberschrift, gegen] = shootoutTexts();
    } catch {
      /* alter Katalog */
    }
    gr.drawCenter(ctx, ueberschrift, 159, 50, COLORS.white, false);
    gr.drawCenter(ctx, toGame(e.homeName), 159, 100, COLORS.white, false);
    f.drawCenter(ctx, gegen, 159, 128, "#d3c3b2", false);
    gr.drawCenter(ctx, toGame(e.awayName), 159, 156, COLORS.white, false);
  }

  /** Konferenztafel eines Managerspiels (Grafik 38.VGA: Tafel 153x113, Ziffern 15x16 ab Zeile 113). */
  drawLivePanel(e: LiveEntry, x: number, y: number, hold = 0): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const g = this.game!;
    const pic = this.assets.img("38.VGA");
    // Die Tafel ist 114 Zeilen hoch: die unterste (113) ist ihre dunkle Kante, erst darunter
    // liegen im Bild die Ziffern. Wir haben sie bisher abgeschnitten (GitLab #56).
    if (pic) ctx.drawImage(pic, 0, 0, 153, 114, x, y, 153, 114);
    else panel(ctx, x, y, 153, 114);
    // Wie 0x1A8D0: erst ab mehr als 60 Punkten Breite in zwei Zeilen, getrennt am ersten
    // Leerzeichen; ohne Leerzeichen bleibt der Name einzeilig. Gemessen werden nur die ersten
    // Länge - 1 Zeichen (0x1A8E9 übergibt strlen - 1 an die Breitenroutine 0x38974)
    const lines = (n: string): string[] => {
      const t = toGame(n);
      if (s.width(t.slice(0, -1)) <= 60) return [t];
      const i = t.indexOf(" ");
      return i >= 0 ? [t.slice(0, i), t.slice(i + 1)] : [t];
    };
    // Die Vereinsnamen stehen in Palettenfarbe 11 auf Zeile 8 der Tafel (im Original gemessen);
    // was darüber liegt, ist das Punktmuster der Anzeigetafel
    // Ein zweizeiliger Name rückt nach oben: eine Zeile steht auf y+8, zwei auf y+3 und y+9
    // (im Original nachgemessen). Vorher standen sie auf y+8 und y+14, und die zweite Zeile
    // verschwand unter den Ziffern des Spielstands.
    const namensblock = (n: string, cx: number) => {
      const zs = lines(n);
      zs.forEach((l, i) => s.drawCenter(ctx, l, cx, y + 8 - 5 * (zs.length - 1) + 6 * i, "#a2a2c3"));
    };
    namensblock(e.homeName, x + 37);
    namensblock(e.awayName, x + 116);
    const digit = (d: number, dx: number) => {
      if (pic) ctx.drawImage(pic, 14 * d, 113, 14, 16, dx, y + 15, 14, 16);
      else this.assets.font.draw(ctx, String(d), dx + 4, y + 17, COLORS.white, false);
    };
    const score = (v: number, cx: number) => {
      if (v < 10) digit(v, cx - 7);
      else {
        digit(Math.trunc(v / 10), cx - 15);
        digit(v % 10, cx);
      }
    };
    // Solange die Torszene läuft, steht auf der Tafel noch der Spielstand davor. Die beiden
    // Ziffernfelder sitzen nicht spiegelbildlich: die einstellige Heimzahl steht bei 33, die
    // Auswärtszahl bei 111 (im Original nachgemessen, GitLab #56).
    score(Math.max(0, e.hg - (hold === 1 ? 1 : 0)), x + 40);
    score(Math.max(0, e.ag - (hold === 2 ? 1 : 0)), x + 118);
    const logoOf = (club: number) => this.assets.img((club < 64 ? 80 + g.clubs.at(club).status : 144 + Math.max(1, Math.min(3, e.cup ?? 3))) + ".VGA");
    // Die Wappen sind 38x38 und sitzen bei (19,35) und (98,35) der Tafel, ohne weißen Rand
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 19, y + 35, 38, 38);
    ctx.fillRect(x + 98, y + 35, 38, 38);
    const lh = logoOf(e.home);
    const la = logoOf(e.away);
    if (lh) ctx.drawImage(lh, x + 19, y + 35);
    if (la) ctx.drawImage(la, x + 98, y + 35);
    // Zuschauerfeld der Tafel: schwarzer Kasten (6,93) bis (48,100) in PIC/38.VGA. Rot steht
    // für ein ausverkauftes Haus, sonst weiß.
    const capacity = e.managerHome === null ? 0 : g.managers.at(e.managerHome).i32(350) + g.managers.at(e.managerHome).i32(358);
    const ausverkauft = !!e.attendance && capacity > 0 && e.attendance >= capacity;
    // Farben aus dem Original abgelesen: ausverkauft #920010, sonst #a2a2c3
    if (e.attendance) s.drawCenter(ctx, dm(e.attendance).replace(" DM", ""), x + 27, y + 94, ausverkauft ? "#920010" : "#a2a2c3");
    else s.drawCenter(ctx, "(AUSW.)", x + 27, y + 95, "#a2a2c3");
    const mine = this.myManagerLive();
    const heim = e.managerHome === mine || (e.managerAway !== mine && e.managerHome !== null);
    const side = e.managerHome === mine ? e.cards?.home : e.managerAway === mine ? e.cards?.away : e.cards?.home ?? e.cards?.away;
    // Die Tafel zeigt die Zahlen **einer** Mannschaft - der des Managers. Die Chancen zählten
    // bisher beide Mannschaften (von lhuno gemeldet).
    const chancen = e.chances.filter(([, seite]) => (heim ? seite === 0 : seite === 1)).length;
    const values = [String(side?.yellow ?? 0), String(side?.red ?? 0), String(side?.injured ?? 0), String(side?.players ?? 11), String(chancen)];
    // Die Zahlen stehen in Palettenfarbe 11 rechtsbündig bei 148, nicht in Weiß (im Original gemessen)
    values.forEach((v, i) => s.drawRight(ctx, v, x + 149, y + 78 + 7 * i, "#a2a2c3"));
    if (e.forfeit !== null && e.forfeit !== undefined) s.drawCenter(ctx, "0:2-WERTUNG", x + 76, y + 26, COLORS.red);
    if (e.managerHome === mine) this.hit(x + 19, y + 35, 38, 38, () => this.livePause());
    if (e.managerAway === mine) this.hit(x + 98, y + 35, 38, 38, () => this.livePause());
  }

  /** Konferenz wie im Original: oben die Tafeln der Managerspiele, unten Torszenen bzw. die Spielminute. */
  drawLive(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const live = this.live;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (!live) {
      f.drawCenter(ctx, "Warten auf die Konferenz...", 160, 110, COLORS.white);
      return;
    }
    if (live.announce && Date.now() - this.liveReceived < (live.announceLeft ?? 0)) {
      this.drawAnkuendigung(live.announce);
      return;
    }
    // Vor dem ersten Schuss deckt die Tafel des Elfmeterschießens die Konferenz zu (GitLab #72)
    if (live.elfmeter?.titel) {
      this.drawElfmeter(live.elfmeter);
      return;
    }
    const logoOf = (club: number, cup: number | null) => this.assets.img((club < 64 ? 80 + g.clubs.at(club).status : 144 + Math.max(1, Math.min(3, cup ?? 3))) + ".VGA");
    // Tafeln der Managerspiele (Original 4cb3:0632/063C: (0,0), (161,0), (0,115), (161,115))
    const managerEntries = live.entries.filter((e) => e.managerHome !== null || e.managerAway !== null);
    // Die Tafelgrafik sitzt drei Punkte rechts der Tafelecke (in DOSBox nachgemessen, #56)
    const slots: [number, number][] = [
      [3, 0],
      [164, 0],
      [3, 115],
      [164, 115],
    ];
    // Halbzeit und Schluss: das Original zeigt statt der Konferenz erst die Übersicht der
    // Ligen und nach dem Schlusspfiff zusätzlich die Tabelle jeder Liga
    if (live.paused && (live.pausedBy === "HALBZEIT" || live.pausedBy === "SCHLUSS")) {
      this.drawPause(live, live.pausedBy === "SCHLUSS");
      return;
    }
    // Anpfiff: das Original spielt zu Beginn jeder Halbzeit den ersten Klang (0x055DF)
    if (live.minute !== this.tonMinute) {
      if (live.minute === 0) this.tonKarten.clear();
      if (live.minute === 1 || live.minute === 46) this.klaenge.spiele("digi0");
      this.tonMinute = live.minute;
    }
    // Karte und Verletzung: das Original meldet beide mit einem Klang (0x1B718: Karten digi2,
    // Verletzung digi3)
    for (const e of live.entries) {
      for (const [seite, c] of [["H", e.cards?.home] as const, ["A", e.cards?.away] as const]) {
        if (!c) continue;
        const schluessel = e.key + seite;
        const jetzt: [number, number] = [c.yellow + c.red, c.injured];
        const vorher = this.tonKarten.get(schluessel);
        this.tonKarten.set(schluessel, jetzt);
        if (!vorher) continue;
        if (jetzt[1] > vorher[1]) this.klaenge.spiele("digi3");
        else if (jetzt[0] > vorher[0]) this.klaenge.spiele("digi2");
      }
    }
    const mineVorab = this.myManagerLive();
    // Karten und Verletzungen des eigenen Spiels: die neueste Meldung steht vier Sekunden unter
    // der Szene, Gelb in Gelb und Rot in Rot (im Original nachgesehen)
    const meine = (live.news ?? []).filter((n) => n.manager === mineVorab);
    if (meine.length > this.kartenGesehen) {
      const n = meine[meine.length - 1];
      // Wortlaut und Farbe des Originals: "Gelbe Karte: HOMBERG (2)" in Gelb, Rot in Rot
      const lt = liveTexts();
      const vorspann = n.kind === "yellow" ? lt[9] : n.kind === "red" ? lt[7] : n.kind === "yellowred" ? lt[8] : lt[10];
      const farbe = n.kind === "yellow" ? "#f3f300" : n.kind === "injury" ? COLORS.white : "#b20020";
      const bild = n.kind === "yellow" ? 0 : n.kind === "injury" ? 2 : 1;
      this.kartenMeldung = { text: toGame(`${vorspann}${cp437ToGame(n.name)}${n.count ? ` (${n.count})` : ""}`), farbe, bild, manager: n.manager, bis: Date.now() + 4000 };
    }
    this.kartenGesehen = meine.length;
    if (this.kartenMeldung && Date.now() > this.kartenMeldung.bis) this.kartenMeldung = null;
    const sceneActive = !!live.scene;
    // Ob die laufende Szene schon durch ist: erst dann zählt das Tor auf der Tafel
    let sceneDone = false;
    if (live.scene) {
      const el = Date.now() - this.liveReceived + (live.scene.now - live.scene.started);
      const tot = this.scenes.frames(live.scene.id);
      sceneDone = tot > 0 && Math.floor(el / SCENE_FRAME_MS) >= tot - 1;
    }
    const holdOf = (e: LiveEntry): number => {
      const sc = live.scene;
      if (!sc || !sc.goal || sceneDone || sc.key !== e.key) return 0;
      return sc.side === "home" ? 1 : 2;
    };
    managerEntries.slice(0, 4).forEach((e, i) => {
      const [x, y] = slots[i];
      if (sceneActive && y > 0) return;
      this.drawLivePanel(e, x, y, holdOf(e));
    });
    const mine = this.myManagerLive();
    if (managerEntries.length === 0) s.drawCenter(ctx, "HEUTE KEIN SPIEL IHRER MANNSCHAFT", 160, 50, COLORS.textDim);
    const bottomY = sceneActive || managerEntries.length <= 2 ? 115 : 230;
    if (sceneActive) {
      const sc = live.scene!;
      const entry = live.entries.find((e) => e.key === sc.key)!;
      // Das Szenenfeld ist im Original **schwarz** mit einem hellen Rahmen von (0,113) bis
      // (319,239); Wappen und Kopf stehen darin in eigenen Kästen in Palettenfarbe 2:
      // das Wappen (38x38) bei (20,118) im Rahmen (18,116)-(59,157), der Kopf (40x40) bei
      // (20,174) im Rahmen (18,172)-(60,215) - rechts spiegelbildlich (GitLab #56).
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(0, 113, 320, 127);
      const kasten = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.fillStyle = "#8282a2";
        ctx.fillRect(x1, y1, x2 - x1 + 1, 1);
        ctx.fillRect(x1, y2, x2 - x1 + 1, 1);
        ctx.fillRect(x1, y1, 1, y2 - y1 + 1);
        ctx.fillRect(x2, y1, 1, y2 - y1 + 1);
      };
      ctx.fillStyle = "#a2a2c3";
      ctx.fillRect(0, 113, 320, 1);
      ctx.fillRect(0, 239, 320, 1);
      ctx.fillRect(0, 113, 1, 127);
      ctx.fillRect(319, 113, 1, 127);
      kasten(18, 116, 59, 157);
      kasten(259, 116, 300, 157);
      kasten(18, 172, 60, 215);
      kasten(259, 172, 301, 215);
      const lh = logoOf(entry.home, entry.cup);
      const la = logoOf(entry.away, entry.cup);
      if (lh) ctx.drawImage(lh, 20, 118);
      if (la) ctx.drawImage(la, 261, 118);
      // Kasten unter dem Wappen: der Kopf des Managers, wenn die Mannschaft einen hat, sonst
      // bleibt er leer (von lhuno im Original nachgesehen)
      const faces = this.assets.img("0.VGA");
      const kopf = (links: boolean) => {
        const m = links ? entry.managerHome : entry.managerAway;
        if (m === null || m === undefined || !faces) return;
        // Hier greift das Original einen Punkt weiter rechts ins Gesichterband als im
        // Hauptmenü: bei BLACKY (Gesicht 1) zeichnet es die Spalten 1 bis 40 statt 0 bis 39.
        // Nachgemessen ist nur dieses eine Gesicht (GitLab #56).
        ctx.drawImage(faces, this.gesichtSpalte(m) + 1, 0, 40, 40, links ? 20 : 261, 174, 40, 40);
      };
      kopf(true);
      kopf(false);
      const elapsed = Date.now() - this.liveReceived + (sc.now - sc.started);
      const frame = Math.floor(elapsed / SCENE_FRAME_MS);
      const total = this.scenes.frames(sc.id);
      this.szeneTon(`${sc.key}:${sc.started}`, sc.id, frame, total, sc.goal);
      void sceneDone;
      ctx.fillStyle = "#1c4d1c";
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
      const drawn = this.scenes.draw(ctx, sc.id, frame, sc.mirror);
      if (drawn) this.letzteSzene = sc.id;
      if (!drawn) s.drawCenter(ctx, "SZENE WIRD GELADEN", VIEW.x + VIEW.w / 2, VIEW.y + 44, COLORS.white);
      const done = total > 0 && frame >= total - 1;
      // Ereignisbild unter dem Wappen: gelbe Karte, rote Karte, Foul/Verletzung oder die
      // Anzeigetafel "TOR!" - alle vier stehen in PIC/8.VGA im Streifen ab y 101
      const symbole = this.assets.img("8.VGA");
      const SYMBOL = [[0, 39], [39, 39], [78, 40], [118, 43]];
      const zeigeSymbol = (nr: number, links: boolean) => {
        const [sx, sw] = SYMBOL[nr];
        if (symbole) ctx.drawImage(symbole, sx, 101, sw, 41, links ? 14 : 266, 172, sw, 41);
      };
      // Das Bild steht unter dem Wappen der betroffenen Mannschaft: das Tor beim Torschützen,
      // die Karte bei der Mannschaft des Spielers (von lhuno im Original nachgesehen)
      const kmM = this.kartenMeldung?.manager;
      const kartenSeite = kmM === undefined ? null : entry.managerHome === kmM ? true : entry.managerAway === kmM ? false : null;
      if (this.kartenMeldung && kartenSeite !== null) zeigeSymbol(this.kartenMeldung.bild, kartenSeite);
      else if (done && sc.goal) zeigeSymbol(3, sc.side === "home");
      // Unter der Szene steht im Original entweder die Minute **oder** die Meldung - nie beides:
      // "Chance f}r ...", "Torsch}tze: ... (n)" mit dem Vorlagengeber darunter, "Chance vergeben"
      // (0x05186). Am Original gemessen (17.9.2026, Bildschirmfotos aus DOSBox): die erste Zeile
      // beginnt bei y 219, die zweite bei y 229, beide in der normalen Schrift. Vorher standen
      // Minute und Meldung übereinander und die zweite Zeile lief unten aus dem Bild.
      const lt = liveTexts();
      const zeilen: { text: string; farbe: string }[] = [];
      // Solange die Szene läuft, steht dort nur die Minute; die Meldung kommt erst am Ende
      if (!done) {
        // nichts
      } else if (sc.elfmeter !== undefined) {
        // Elfmeterschießen: nur beim Managerverein steht ein Name, ohne Torzahl und Vorlage;
        // beim Rechnerverein bleibt die Zeile ELFMETER (im Original gemessen, #72)
        if (sc.scorer) zeilen.push({ text: toGame((sc.goal ? lt[2] : lt[3]) + sc.scorer), farbe: COLORS.white });
      } else if (sc.goal) {
        const zeile = sc.scorer ? `${lt[2]}${sc.scorer}${sc.scorerGoals ? ` (${sc.scorerGoals})` : ""}` : `${entry.homeName} - ${entry.awayName} ${entry.hg}:${entry.ag}`;
        zeilen.push({ text: toGame(zeile), farbe: COLORS.white });
        if (sc.assist) zeilen.push({ text: toGame(lt[5] + sc.assist), farbe: COLORS.white });
      } else zeilen.push({ text: toGame(lt[3] + sc.clubName), farbe: COLORS.white });
      // Karte oder Verletzung kommt in die freie zweite Zeile
      if (this.kartenMeldung && zeilen.length < 2) zeilen.push({ text: this.kartenMeldung.text, farbe: this.kartenMeldung.farbe });
      if (zeilen.length === 0) {
        // Elfmeterszene (Kennung …E): Schriftzug ELFMETER statt der Minute (0x05186)
        // Die Minutenzeile steht tiefer als eine Meldung: oberste Zeile 226 (im Original
        // vermessen), flankiert von zwei Bällen.
        f.drawCenter(ctx, sc.id.endsWith("E") || sc.elfmeter !== undefined ? "ELFMETER" : `${sc.minute}.Minute`, 160, 226, COLORS.white);
        // Links und rechts der Minute steht je ein Ball aus PIC/8.VGA (163,102), 13x13
        if (symbole) {
          ctx.drawImage(symbole, 163, 102, 13, 13, 115, 221, 13, 13);
          ctx.drawImage(symbole, 163, 102, 13, 13, 193, 221, 13, 13);
        }
      } else zeilen.slice(0, 2).forEach((z, i) => f.drawCenter(ctx, z.text, 160, 219 + 10 * i, z.farbe, false));
      return;
    }
    const halftime = live.minute === 45 && !live.finished;
    const four = managerEntries.length > 2;
    if ((live.finished || halftime) && !four) {
      // Ergebnistafel (Option "Halbzeitstände"/"Ergebnisse" des Originals) für die Liga des Managers
      panel(ctx, 0, bottomY, 320, 240 - bottomY);
      f.drawCenter(ctx, halftime ? T("ui.live", 0) : "Ergebnisse", 160, bottomY + 3, COLORS.white, false);
      const myClub = mine !== null ? g.managers.at(mine).clubIndex : -1;
      const myLeague = myClub >= 0 ? (myClub < 18 ? 0 : myClub < 38 ? 1 : 2) : 0;
      const list = live.entries.filter((e) => e.kind !== "league" || e.league === myLeague).slice(0, Math.floor((232 - bottomY) / 7) - 1);
      let y = bottomY + 15;
      for (const e of list) {
        const c = e.managerHome !== null || e.managerAway !== null ? COLORS.white : COLORS.text;
        s.draw(ctx, toGame(`${e.homeName.slice(0, 16)} - ${e.awayName.slice(0, 16)}`), 6, y, c);
        s.drawRight(ctx, `${e.hg}:${e.ag}`, 300, y, c);
        y += 7;
      }
    }
    const label = live.paused ? `UNTERBROCHEN VON ${(live.pausedBy ?? "").toUpperCase()}` : live.finished ? "Schluss" : live.elfmeter ? "ELFMETER" : `${live.minute}.Minute`;
    // Unterbrechen und auswechseln geht, solange das Spiel läuft. Der Hinweis darauf stand
    // früher nur in der Aufteilung mit höchstens zwei Managerspielen - bei drei oder vier
    // Tafeln blieb der Weg zum Auswechseln unsichtbar.
    const unterbrechbar = !live.paused && !live.finished && !halftime && mine !== null;
    const hinweis = "WAPPEN ANKLICKEN: UNTERBRECHEN UND AUSWECHSELN";
    if (live.finished || halftime || four) {
      // Mit drei oder vier Tafeln steht die Minute unten in der großen Schrift auf Zeile 233,
      // links und rechts davon dieselben Halbzeitbalken wie sonst: (35,234) 92x4 und
      // (194,234) 94x4 (im Original nachgemessen, GitLab #56).
      if (this.kartenMeldung) s.drawCenter(ctx, this.kartenMeldung.text, 160, 232, this.kartenMeldung.farbe);
      else {
        f.drawCenter(ctx, toGame(label), 160, 233, COLORS.white, false);
        const [links, rechts] = halbzeitMinuten(live.minute);
        this.drawHalfBar(35, 234, 92, 2 * links);
        this.drawHalfBar(194, 234, 94, 2 * rechts, true);
      }
      // Der Hinweis aufs Auswechseln ist unsere Zutat; im Original steht dort nichts. Er passt
      // nur ins freie Viertel rechts unten, das es erst ab drei Tafeln und nur bis drei gibt.
      if (unterbrechbar && managerEntries.length === 3) {
        const teile = hinweis.split(": ");
        s.drawCenter(ctx, teile[0] + ":", 240, 166, COLORS.textDim);
        s.drawCenter(ctx, teile[1], 240, 174, COLORS.textDim);
        this.hit(164, 115, 153, 114, () => this.livePause());
      }
    } else {
      f.drawCenter(ctx, toGame(label), 160, bottomY + 100, COLORS.white, false);
      // Fortschritt der beiden Hälften links und rechts neben der Minute (im Original vermessen:
      // Balken bei (32,y) 92x4 und (192,y) 94x4, y vier unter der Zeile). Das Original setzt je
      // Minute eine 2 Pixel breite Marke (0x5186, 0x5B16): links von links nach rechts, rechts
      // **von rechts nach links** (0x55BD kehrt die Richtung je Hälfte um). Zu Beginn jeder
      // Hälfte leert 0x4EEF beide Balken und zeichnet die abgeschlossene linke Hälfte nach -
      // in der zweiten Halbzeit voll, ab der 106. Minute das Drittel aus 91..105. Die
      // Verlängerung füllt also je Hälfte nur 30 Pixel (GitLab #72).
      const [links, rechts] = halbzeitMinuten(live.minute);
      this.drawHalfBar(32, bottomY + 104, 92, 2 * links);
      this.drawHalfBar(192, bottomY + 104, 94, 2 * rechts, true);
      if (this.kartenMeldung) s.drawCenter(ctx, this.kartenMeldung.text, 160, bottomY + 112, this.kartenMeldung.farbe);
      else if (unterbrechbar) {
        s.drawCenter(ctx, hinweis, 160, bottomY + 112, COLORS.textDim);
        this.hit(0, bottomY + 109, 320, 10, () => this.livePause());
      }
    }
    if (live.paused && mine !== null) {
      button(ctx, f, "WEITER", 250, 218, 60, true);
      this.hit(250, 218, 60, 16, () => this.liveResume());
    }
  }

  /**
   * Halbzeit und Schluss wie im Original: eine Seite je Liga mit Paarung, Ergebnis und je
   * Verein einer Zeile "n. PLATZ, ST[RKE t (ko,te,fo)"; nach dem Schlusspfiff folgt auf jede
   * Übersicht die Tabelle derselben Liga. Maße aus dem Bildschirmfoto: Eintrag i mit der
   * Paarung bei y 3 + 17·i und den Angaben bei y 12 + 17·i, Heimname ab x 3, Gastname ab
   * x 133, Ergebnis rechtsbündig bis x 305, die Angaben rechtsbündig bis x 123 bzw. x 266.
   */
  drawPause(live: LiveState, schluss: boolean): void {
    // Die Seiten der Pause liegen im Original auf dem Marmor, nicht auf Schwarz - die Konferenz
    // selbst füllt den Bildschirm vorher schwarz (GitLab #56)
    const marmor = this.assets.img("22.CP");
    if (marmor) this.ctx.drawImage(marmor, 0, 0);
    // Welche Seiten überhaupt kommen, steht in den Einstellungen (im Original DGROUP 0x5FE ff.):
    // je Liga ein Schalter für die Halbzeitstände (0x5C93), einer für die Ergebnisse (0x5CB4)
    // und einer für die Tabelle (0x4C75), dazu DfB-Pokal (0x5D2F), Europapokale (0x5D41) und
    // die Zeitung.
    const flags = this.server.options?.flags ?? OPTION_DEFAULTS;
    const spielt = (l: number) => live.entries.some((e) => e.kind === "league" && e.league === l && !e.nachhol);
    const ligen = [0, 1, 2].filter((l) => spielt(l) && flags[l * 3 + (schluss ? 1 : 0)]);
    // Reihenfolge wie im Original: erst die Übersicht jeder Liga, danach die Tabellen und
    // zuletzt die Zeitungen der Manager
    const pokale = [0, 1, 2, 3].filter((c) => live.entries.some((e) => e.kind !== "league" && e.cup === c) && flags[c === 0 ? OPTION_DFB : OPTION_EUROPA]);
    const seiten: { art: "uebersicht" | "pokal" | "tabelle" | "zeitung" | "nachhol"; nr: number }[] = ligen.map((l) => ({ art: "uebersicht" as const, nr: l }));
    if (flags[OPTION_NACHHOL] && live.entries.some((e) => e.nachhol)) seiten.unshift({ art: "nachhol", nr: 0 });
    for (const c of pokale) seiten.push({ art: "pokal", nr: c });
    if (schluss) {
      for (const l of [0, 1, 2]) if (spielt(l) && flags[l * 3 + 2]) seiten.push({ art: "tabelle", nr: l });
      if (flags[OPTION_ZEITUNG]) for (const z of (this.server.zeitung ?? []).slice().sort((a, b) => a.manager - b.manager)) seiten.push({ art: "zeitung", nr: z.manager });
    }
    if (seiten.length === 0) {
      this.assets.micro.drawCenter(this.ctx, schluss ? "SCHLUSS" : "HALBZEIT", 160, 100, COLORS.white);
      seiten.push({ art: "uebersicht", nr: 0 });
    }
    const idx = Math.min(this.halfPage, seiten.length - 1);
    const fertig = !!this.player && (live.halfSeen ?? []).includes(this.player);
    const weiter = () => {
      this.blende();
      if (idx < seiten.length - 1) this.halfPage++;
      else {
        this.halfPage = 0;
        void this.post("api/live/resume", { manager: this.myManagerLive() ?? this.manager });
      }
    };
    const seite = seiten[idx];
    if (seite.art === "tabelle") {
      this.tableLeague = seite.nr;
      this.tableMode = "gesamt";
      this.drawTable(fertig ? null : weiter);
    } else if (seite.art === "nachhol") this.drawNachhol(live, fertig ? null : weiter);
    else if (seite.art === "pokal") this.drawCupDay(live, seite.nr, fertig ? null : weiter);
    else if (seite.art === "zeitung") this.drawZeitung(seite.nr, fertig ? null : weiter);
    else {
      // Überschrift wie im Original: "SPIELE Bundesliga 11.SPIELTAG 90.MINUTE"
      const g = this.game!;
      const md = live.entries.find((e) => e.league === seite.nr && e.spieltag)?.spieltag ?? g.nextMatchday(seite.nr);
      const liga = texte("ui.ligen")[seite.nr];
      this.drawLeagueOverview(live, seite.nr, fertig ? null : weiter, undefined, `SPIELE  ${liga}   ${md}.SPIELTAG    ${live.minute}.MINUTE`);
    }
    if (fertig) {
      const offen = this.server.managers.filter((m) => m.seat && !(live.halfSeen ?? []).includes(m.seat)).length;
      this.assets.micro.drawCenter(this.ctx, toGame(`WARTET AUF ${offen} MITSPIELER`), 160, 190, COLORS.textDim);
    }
  }

  /**
   * Pokaltag (im Original am 10.9.2026 vermessen): Kasten (4,33) bis (315,162), Titel bei y 36
   * mit Runde und Wettbewerb mittig bei x 123 und der Minute mittig bei x 265, Trennlinie bei
   * y 44, 16 Zeilen ab y 48 im Abstand 7. Je Zeile Heim mittig bei x 65, "GEGEN" bei x 140,
   * Gast bei x 205 und die beiden Spielstände bei x 258 und x 294.
   */
  drawCupDay(live: LiveState, cup: number, weiter: (() => void) | null): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const v = cupView(g, cup);
    // Kurznamen wie im Original (DGROUP 0x24DC), nicht die langen aus cupNames()
    const namen = ["DfB-Pokal", T("ui.cupday", 0), T("ui.cupday", 1), "UEFA-Pokal"];
    const INK = "#a2a2c3";
    const TITEL = "#d3c3b2";
    panel(ctx, 4, 33, 311, 129);
    f.drawCenter(ctx, toGame(`${v.round} ${namen[cup] ?? v.name}`), 123, 36, TITEL, false);
    f.drawCenter(ctx, toGame(`${live.minute}.Minute`), 265, 36, TITEL, false);
    hline(ctx, 6, 44, 307, INK);
    const rows = live.entries.filter((e) => e.kind !== "league" && e.cup === cup);
    rows.slice(0, 16).forEach((e, i) => {
      const y = 48 + 7 * i;
      const paar = v.pairs.find((x) => x.home === e.home && x.away === e.away);
      const hin = paar?.firstLeg && (paar.firstLeg[0] || paar.firstLeg[1]) ? paar.firstLeg : null;
      const stand1 = hin ?? [e.hg, e.ag];
      const stand2 = hin ? [e.hg, e.ag] : [0, 0];
      s.drawCenter(ctx, toGame(g.clubs.at(e.home).displayName), 65, y, INK);
      s.drawCenter(ctx, "GEGEN", 140, y, INK);
      s.drawCenter(ctx, toGame(g.clubs.at(e.away).displayName), 205, y, INK);
      s.drawCenter(ctx, `(${stand1[0]}:${stand1[1]})`, 258, y, INK);
      s.drawCenter(ctx, `(${stand2[0]}:${stand2[1]})`, 294, y, INK);
    });
    if (weiter) {
      this.iconFrame(268, 196);
      drawIcon(ctx, this.assets, "weiter", 277, 202);
      this.hit(268, 196, 46, 36, weiter);
    }
  }

  /**
   * Nachholspiele (0x5C1A): dieselbe Seite wie eine Ligaübersicht, nur mit dem Titel
   * "NACHHOLSPIELE" (4cb3:4B88) statt der Ligabezeichnung.
   */
  drawNachhol(live: LiveState, weiter: (() => void) | null): void {
    this.drawLeagueOverview(live, -1, weiter, live.entries.filter((e) => e.nachhol), T("ui.nachhol", 0));
  }

  /** Eine Seite der Spielübersicht (siehe drawPause). */
  drawLeagueOverview(live: LiveState, liga: number, weiter: (() => void) | null, eintraege?: LiveEntry[], titel?: string): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const rows = eintraege ?? live.entries.filter((e) => e.kind === "league" && e.league === liga && !e.nachhol);
    // Im Original nachgemessen (GitLab #56): Tafel (1,2) 315x186, Überschrift y 5 in
    // Palettenfarbe 11, darunter ein Strich über die ganze Breite bei y 14, Paarungen ab y 18
    // im Abstand 17 mit der Kennzeile neun Zeilen darunter.
    panel(ctx, 1, 2, 315, 186);
    if (titel) {
      // Überschrift mit Schatten in Farbe 7 ein Pixel rechts
      f.drawCenter(ctx, toGame(titel), 161, 5, "#303051", false);
      f.drawCenter(ctx, toGame(titel), 160, 5, "#a2a2c3", false);
      hline(ctx, 3, 14, 311, PLATE);
    }
    // Auf der Nachholseite können Vereine mehrerer Ligen stehen
    const stark = new Map<number, ReturnType<typeof strengthTable>[number]>();
    // Die Zahl vor "PLATZ" ist der Tabellenplatz (das Original setzt Tabellenbyte 46 + 1 ein,
    // 0x2C193), nicht der Rang in der Stärkeliste - die liefert nur die drei Werte.
    const platz = new Map<number, number>();
    for (const l of [0, 1, 2]) {
      if (liga >= 0 && l !== liga) continue;
      for (const r of strengthTable(g, l)) stark.set(r.club, r);
      tableOrder(g, l).forEach((club, i) => platz.set(club, i + 1));
    }
    const INK = "#a2a2c3";
    const INK_DIM = "#616182";
    const info = (club: number): string => {
      const r = stark.get(club);
      if (!r) return "";
      // Die Gesamtstärke mittelt alle neun Matrixwerte, nicht die drei Linienmittel (GitLab #55)
      return toGame(`${platz.get(club) ?? 0}. PLATZ, ST[RKE ${clubStrength(g, club).total} (${r.ko},${r.te},${r.fo})`);
    };
    rows.slice(0, 10).forEach((e, i) => {
      const y = (titel ? 18 : 3) + 17 * i;
      f.draw(ctx, toGame(e.homeName), 3, y, INK, false);
      f.draw(ctx, "- " + toGame(e.awayName), 136, y, INK, false);
      // Das Ergebnis steht linksbündig bei 288, nicht rechtsbündig
      f.draw(ctx, `${e.hg}:${e.ag}`, 288, y, INK, false);
      s.drawRight(ctx, info(e.home), 126, y + 9, INK_DIM);
      s.drawRight(ctx, info(e.away), 269, y + 9, INK_DIM);
    });
    if (weiter) {
      this.iconFrame(268, 196);
      drawIcon(ctx, this.assets, "weiter", 277, 202);
      this.hit(268, 196, 46, 36, weiter);
    }
  }

  /**
   * Fortschrittsbalken einer Halbzeit (im Original neben der Spielminute): 4 Pixel hoch, oben
   * und links hell (#a2a2c3), unten und rechts dunkel (#303051), leer #616182; der gefüllte
   * Teil ist in der oberen Innenzeile gelb (#f3f300) und in der unteren weiß (#f3f3f3).
   * `pixel` ist die gefüllte Breite (2 je Minute), `vonRechts` füllt vom rechten Rand her.
   */
  drawHalfBar(x: number, y: number, w: number, pixel: number, vonRechts = false): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#616182";
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = "#a2a2c3";
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, 4);
    ctx.fillStyle = "#303051";
    ctx.fillRect(x, y + 3, w, 1);
    ctx.fillRect(x + w - 1, y, 1, 4);
    const füllung = Math.max(0, Math.min(w - 2, Math.round(pixel)));
    if (füllung > 0) {
      const x0 = vonRechts ? x + w - 1 - füllung : x + 1;
      ctx.fillStyle = "#f3f300";
      ctx.fillRect(x0, y + 1, füllung, 1);
      ctx.fillStyle = "#f3f3f3";
      ctx.fillRect(x0, y + 2, füllung, 1);
    }
  }

  demoLive(sceneId: string, mirror: boolean, frame: number): void {
    const g = this.game!;
    const managerOf = new Map<number, number>();
    g.activeManagers().forEach((m, i) => managerOf.set(m.clubIndex, i));
    const names = (c: number) => g.clubs.at(c).displayName;
    const entries: LiveEntry[] = g.pairings(0).map(([home, away], i) => ({ key: `${home}-${away}`, kind: "league", league: 0, cup: null, home, away, homeName: names(home), awayName: names(away), hg: i % 2, ag: i % 3, minute: 23, managerHome: managerOf.get(home) ?? null, managerAway: managerOf.get(away) ?? null, attendance: managerOf.has(home) ? 24000 : null, chances: [[5, 0, 1]] }));
    const e = entries.find((x) => x.managerHome !== null) ?? entries[0];
    const now = Date.now();
    const started = frame >= 0 ? now - frame * SCENE_FRAME_MS : now;
    const scene: LiveScene = { id: sceneId, mirror, goal: sceneId.includes(".T"), minute: 23, side: "home", key: e.key, club: e.home, clubName: e.homeName, homeName: e.homeName, awayName: e.awayName, manager: e.managerHome ?? 0, started, until: now + 60000, now };
    this.server.managers = g.activeManagers().map((m, i) => ({ index: i, name: m.displayName, club: names(m.clubIndex), clubIndex: m.clubIndex, seat: i === 0 ? "demo" : null, done: false }));
    this.player = "demo";
    this.onLive({ minute: 23, paused: false, pausedBy: null, finished: false, scene: sceneId === "none" ? null : scene, entries, subs: {} });
    if (frame >= 0) this.animating = true; // Bild einfrieren
  }

  /** Text in Zeilen brechen, die in den Hinweiskasten passen (große Schrift, Breite in Punkten). */
  umbrechen(text: string, breite: number, maxZeilen: number): string[] {
    const f = this.assets.font;
    const zeilen: string[] = [];
    let zeile = "";
    for (const wort of text.split(/\s+/)) {
      const versuch = zeile ? zeile + " " + wort : wort;
      if (f.width(versuch) <= breite || !zeile) zeile = versuch;
      else {
        zeilen.push(zeile);
        zeile = wort;
      }
      if (zeilen.length === maxZeilen) break;
    }
    if (zeile && zeilen.length < maxZeilen) zeilen.push(zeile);
    return zeilen.map((z) => this.kuerzen(f, z, breite));
  }

  /** Text auf eine Breite kürzen; was nicht passt, endet mit "..". */
  kuerzen(f: Font, text: string, breite: number): string {
    if (f.width(text) <= breite) return text;
    let t = text;
    while (t.length > 1 && f.width(t + "..") > breite) t = t.slice(0, -1);
    return t.trimEnd() + "..";
  }

  drawSeat(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 20, 52, 280, 170);
    // Namen von Spielern, Vereinen und Dateien sind beliebig lang: alles wird auf den Platz
    // gekürzt, den es hat (der Kasten ist innen 276 breit)
    const titel = toGame("Wer spielt wen? (" + (this.server.file ?? "") + ")");
    f.drawCenter(ctx, f.width(titel) <= 268 ? titel : toGame("Wer spielt wen?"), 160, 60, COLORS.white);
    // Bei vier Managern rücken die Zeilen enger, sonst läge der Hinweis auf NEU / LADEN
    const abstand = this.server.managers.length > 3 ? 27 : 30;
    let y = 80;
    for (const m of this.server.managers) {
      const taken = m.seat ? `${toGame(m.seat)}` : m.ki ? toGame("Rechner (klicken zum \u00dcbernehmen)") : "frei";
      bevel(ctx, 30, y - 4, 260, 24);
      f.draw(ctx, this.kuerzen(f, toGame(m.name), 76), 40, y, COLORS.white, false);
      f.draw(ctx, this.kuerzen(f, toGame(m.club), 164), 120, y, COLORS.white, false);
      f.draw(ctx, this.kuerzen(f, taken, 244), 40, y + 9, m.seat === this.player && this.player ? COLORS.white : undefined, false);
      this.hit(30, y - 4, 260, 24, () => this.takeSeat(m.index));
      y += abstand;
    }
    // Zwei Zeilen statt einer: schon "Angemeldet als lars, klick auf deinen Manager" stieß an
    // den Rand. Die zweite endet über NEU / LADEN (y 200)
    // Reicht der Platz über NEU / LADEN nicht, rücken die Zeilen links neben den Knopf
    const mitte = y + 20 <= 200 ? 160 : 124;
    if (this.player) {
      f.drawCenter(ctx, this.kuerzen(f, toGame("Angemeldet als " + this.player), mitte === 160 ? 268 : 190), mitte, y + 2);
      f.drawCenter(ctx, toGame("Klick auf deinen Manager"), mitte, y + 12);
    } else f.drawCenter(ctx, toGame("Klick auf einen Manager"), mitte, y + 2);
    button(ctx, f, "NEU / LADEN", 220, 200, 76);
    this.hit(220, 200, 76, 16, () => this.go("start-online"));
    button(ctx, f, "LOBBY", 24, 200, 60);
    this.hit(24, 200, 60, 16, () => void this.zurueckZurLobby());
  }

  /**
   * Ergebnisse des zuletzt gespielten Tages. Die Ligen stehen wie im Original auf je einer
   * eigenen Seite in der Darstellung der Halbzeit- und Schlussübersicht (drawLeagueOverview):
   * Paarung mit Ergebnis und darunter je Verein "n. PLATZ, ST[RKE t (ko,te,fo)" - hier mit dem
   * Stand nach der Buchung des Spieltags. Pokale und Relegation folgen als Textseiten aus dem
   * Tagesprotokoll des Servers. Die eigene Liga steht vorn.
   */
  drawResults(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const eigene = this.leagueOf(this.manager);
    const namen = ["Bundesliga", "2. Liga", "Oberliga"];
    const INK = "#a2a2c3";
    const INK_DIM = "#616182";
    // Tagesprotokoll in Blöcke zerlegen: Überschrift, darunter die eingerückten Ergebniszeilen.
    // Verlegungen stehen ohne Einrückung, gehören aber zum Wettbewerb darüber.
    const lines = (this.server.lastDay ?? []).filter((l) => !l.startsWith("    ") && !l.startsWith("Saisonwechsel") && !/^\d+\.\d+\. /.test(l));
    const blocks: { title: string; rows: string[] }[] = [];
    for (const l of lines) {
      if (!l.startsWith("  ") && !l.startsWith("verlegt:")) blocks.push({ title: l, rows: [] });
      else if (blocks.length) blocks[blocks.length - 1].rows.push(l.trim().replace(/ \(\d+ Zuschauer.*\)$/, ""));
    }
    // Die Einstellungen gelten auch hier: wer die Ergebnisse einer Liga abgeschaltet hat, bekommt
    // ihre Seite nach dem Spieltag ebenso wenig zu sehen wie in der Konferenz (Schalter l·3 + 1).
    const flags = this.server.options?.flags ?? OPTION_DEFAULTS;
    const ligen = blocks.map((b) => namen.findIndex((n) => b.title.startsWith(n))).filter((l) => l >= 0 && flags[l * 3 + 1] !== false);
    ligen.sort((a, b) => Number(b === eigene) - Number(a === eigene));
    const seiten: { liga?: number; block?: { title: string; rows: string[] } }[] = ligen.map((l) => ({ liga: l }));
    for (const b of blocks) if (!namen.some((n) => b.title.startsWith(n))) seiten.push({ block: b });
    const idx = Math.min(this.resultPage, Math.max(0, seiten.length - 1));
    panel(ctx, 0, 0, 317, 175);
    if (seiten.length === 0) {
      f.drawCenter(ctx, toGame(`${namen[eigene]}  ${Math.max(0, g.nextMatchday(eigene) - 1)}. Spieltag`), 158, 2, "#d3c3b2", false);
      s.drawCenter(ctx, toGame("NOCH KEIN SPIELTAG GESPIELT"), 158, 80, INK_DIM);
    } else if (seiten[idx].liga !== undefined) {
      const liga = seiten[idx].liga!;
      const md = g.nextMatchday(liga) - 1;
      f.drawCenter(ctx, toGame(`${namen[liga]}  ${md}. Spieltag`), 158, 2, "#d3c3b2", false);
      const stark = new Map<number, ReturnType<typeof strengthTable>[number]>();
      for (const r of strengthTable(g, liga)) stark.set(r.club, r);
      const platz = new Map<number, number>();
      tableOrder(g, liga).forEach((club, i) => platz.set(club, i + 1));
      // Wie 0x2C128: die Stärke ist die Summe der neun Matrixbytes / 9, nicht das Mittel der
      // schon gekürzten Linienmittel
      const info = (club: number): string => {
        if (!stark.get(club)) return "";
        const r = clubStrength(g, club);
        return toGame(`${platz.get(club) ?? 0}. PLATZ, ST[RKE ${r.total} (${r.ko},${r.te},${r.fo})`);
      };
      matchdayView(g, liga, md).slice(0, 10).forEach((row, i) => {
        const y = 12 + 16 * i;
        f.draw(ctx, toGame(g.clubs.at(row.home).displayName), 3, y, INK, false);
        f.draw(ctx, "- " + toGame(g.clubs.at(row.away).displayName), 133, y, INK, false);
        f.drawRight(ctx, row.postponed ? toGame("verlegt") : row.result ? `${row.result.home}:${row.result.away}` : "-:-", 313, y, INK, false);
        s.drawRight(ctx, info(row.home), 123, y + 9, INK_DIM);
        s.drawRight(ctx, info(row.away), 266, y + 9, INK_DIM);
      });
    } else {
      const bl = seiten[idx].block!;
      f.drawCenter(ctx, toGame(bl.title), 158, 2, "#d3c3b2", false);
      let y = 16;
      for (const row of bl.rows) {
        if (y > 168) break;
        const own = g.activeManagers().some((m) => row.toUpperCase().includes(g.clubs.at(m.clubIndex).displayName.toUpperCase()));
        s.draw(ctx, toGame(row).slice(0, 70), 8, y, own ? COLORS.white : INK);
        y += 8;
      }
    }
    // Schalterzeile unter dem Kasten: Zeitung links, dann Tabelle, Blättern und Hauptmenü
    const paper = (this.server.zeitung ?? []).find((z) => z.manager === this.manager);
    if (paper && (this.server.options?.zeitung ?? true)) {
      button(ctx, f, "ZEITUNG", 8, 206, 60, true);
      this.hit(8, 206, 60, 16, () => this.go("zeitung"));
    }
    const knoepfe: { icon: Parameters<typeof drawIcon>[3]; action: () => void }[] = [{ icon: "tabBL", action: () => this.go("table") }];
    if (seiten.length > 1) {
      s.drawCenter(ctx, toGame(`Seite ${idx + 1} von ${seiten.length}`), 124, 208, INK_DIM);
      knoepfe.push({ icon: "weiter", action: () => { this.blende(); this.resultPage = (idx + 1) % seiten.length; } });
    }
    let bx = 270 - 52 * knoepfe.length;
    for (const k of knoepfe) {
      this.iconFrame(bx, 196);
      drawIcon(ctx, this.assets, k.icon, bx + 7, 202);
      this.hit(bx, 196, 46, 36, k.action);
      bx += 52;
    }
    this.sideButtons();
  }


  /**
   * Auslosung als Zeremonie (0x17C26 lädt die Tafel PIC/47.VGA, 0x184BA füllt sie):
   * 16 Zeilen im Abstand von 10 Pixeln, Namensfelder links 37..149 und rechts 167..279.
   * Die Namen erscheinen nacheinander, Heim vor Gast.
   */
  drawAuslosung(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const c = this.ceremonyPending() ? this.server.ceremony! : null;
    if (c) {
      this.cup = c.cup;
      this.forcedCeremony = true;
    }
    // Nach der Tafel zeigt das Original die Spielübersicht; auch sie bestätigt jeder selbst
    if (c && c.phase === "list") {
      this.drawCupList(c.cup);
      const open = this.server.managers.filter((m) => m.seat && !c.seen.includes(m.seat)).length;
      const mineDone = !!this.player && c.seen.includes(this.player);
      if (mineDone) s.drawCenter(ctx, toGame(`WARTET AUF ${open} MITSPIELER`), 160, 186, COLORS.textDim);
      else {
        button(ctx, f, "WEITER", 125, 184, 70, true);
        this.hit(125, 184, 70, 16, () => void this.post("api/ceremony", { manager: this.manager, player: this.player, cup: c.cup, phase: c.phase }));
      }
      return;
    }
    const v = cupView(g, this.cup);
    const board = this.assets.img("47.VGA");
    if (board) ctx.drawImage(board, BOARD.x, BOARD.y);
    f.drawCenter(ctx, toGame(`${v.round} ${v.name}`), 160, 2, COLORS.white);
    const total = v.pairs.length * 2;
    if (c) {
      if (!c.ready) {
        const open = this.server.managers.filter((m) => !m.seat).map((m) => dosText(m.name));
        this.drawDrum(toGame(`WARTET AUF: ${open.join(", ") || "..."}`));
        return;
      }
      if (c.startedAt === null) {
        if (this.player && this.player in c.votes) {
          const open = this.server.managers.filter((m) => m.seat && !(m.seat in c.votes)).length;
          this.drawDrum(toGame(`WARTET AUF ${open} MITSPIELER`));
        } else this.drawCeremonyPrompt(c.cup);
        return;
      }
    }
    // Zeitrechnung: der Server gibt die Startzeit vor, sonst läuft sie lokal
    const started = c ? c.startedAt : this.drawStartedAt;
    const skipped = c ? c.skipped : false;
    const elapsed = started ? Date.now() - started : 0;
    const placed = (i: number) => ({ x: i % 2 === 0 ? BOARD.left : BOARD.right, y: BOARD.row0 + Math.floor(i / 2) * BOARD.step });
    // Flugzeit hängt vom Weg ab: gleichbleibende Geschwindigkeit wie im Original
    const flyMs = (i: number) => {
      const d = placed(i);
      const steps = Math.ceil(Math.max(Math.abs(d.x - BOARD.drumX), Math.abs(d.y - (BOARD.drumTop - 7))) / FLY_PX_PER_STEP);
      return steps * FLY_STEP_MS;
    };
    let shown = 0;
    let localT = 0;
    if (skipped) shown = total;
    else {
      let acc = 0;
      while (shown < total && elapsed >= acc + DRUM_MS + flyMs(shown)) {
        acc += DRUM_MS + flyMs(shown);
        shown++;
      }
      localT = elapsed - acc;
    }
    this.drawStep = shown;
    for (let i = 0; i < shown && i < 32; i++) {
      const pos = placed(i);
      const pair = v.pairs[Math.floor(i / 2)];
      if (pair) this.drawPlate(pos.x, pos.y, i % 2 === 0 ? pair.home : pair.away);
    }
    if (shown < total) {
      // Der Verein steigt aus der Trommel und wandert dann schräg auf seinen Platz (im Original gemessen)
      const pair = v.pairs[Math.floor(shown / 2)];
      const club = shown % 2 === 0 ? pair.home : pair.away;
      const dest = placed(shown);
      const y0 = BOARD.drumTop - 7;
      if (localT < DRUM_MS) {
        // Das Schild steigt hinter der Trommel hervor: erst zeichnen, dann die Trommel darüber
        const p = Math.min(1, localT / DRUM_MS);
        this.drawPlate(BOARD.drumX, Math.round(BOARD.drumTop - 7 * p), club);
        if (board) ctx.drawImage(board, 0, BOARD.drumTop - BOARD.y, 283, 204 - (BOARD.drumTop - BOARD.y), BOARD.x, BOARD.drumTop, 283, 204 - (BOARD.drumTop - BOARD.y));
      } else {
        const p = Math.min(1, (localT - DRUM_MS) / flyMs(shown));
        this.drawPlate(Math.round(BOARD.drumX + (dest.x - BOARD.drumX) * p), Math.round(y0 + (dest.y - y0) * p), club);
      }
      if (!this.animating) this.animateAuslosung();
    } else if (c) {
      const wait = this.server.managers.filter((m) => m.seat && !c.seen.includes(m.seat)).length - 1;
      void wait;
      const mineDone = !!this.player && c.seen.includes(this.player);
      if (mineDone) this.drawDrum(toGame(`WARTET AUF ${wait + 1} MITSPIELER`));
      else {
        this.drawDrum(T("ui.auslosung", 0));
        this.hit(0, 0, W, H, () => void this.post("api/ceremony", { manager: this.manager, player: this.player, cup: c.cup, phase: c.phase }));
      }
    } else {
      this.drawDrum(T("ui.auslosung", 0));
      this.hit(0, 0, W, H, () => this.go("pokal"));
    }
    void s;
  }

  /** Namensschild: beiges Feld mit Vereinsname und Losnummer, Schriftfarbe nach Liga. */
  drawPlate(x: number, y: number, club: number): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const g = this.game!;
    ctx.fillStyle = PLATE;
    ctx.fillRect(x, y, BOARD.w, 7);
    const t = cp437ToGame(g.clubs.at(club).name) + ` (${leagueOfClub(club) + 1})`;
    const ink = club === g.managers.at(this.manager).clubIndex ? COLORS.red : LEAGUE_INK[leagueOfClub(club)];
    s.draw(ctx, t, x + Math.max(1, Math.round((BOARD.w - s.width(t)) / 2)), y + 1, ink, false);
  }

  /** Beschriftung auf der Lostrommel (Original: gezogener Verein, am Ende "TASTE DRÜCKEN"). */
  drawDrum(text: string): void {
    if (!text) return;
    this.assets.micro.drawCenter(this.ctx, text, 160, BOARD.drumY, COLORS.white);
  }

  /** Abfrage vor der Auslosung (0x17C26): ABER KLAR / KEIN GEDANKE. */
  drawCeremonyPrompt(cup: number): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    panel(ctx, 30, 78, 260, 84);
    this.hits = []; // Kasten schirmt den Bildschirm darunter ab (GitLab #46)
    f.drawCenter(ctx, T("ui.ceremonyprompt", 0), 160, 86, COLORS.white, false);
    f.drawCenter(ctx, cup === 0 ? T("ui.ceremonyprompt", 1) : T("ui.ceremonyprompt", 2), 160, 98, COLORS.white, false);
    f.drawCenter(ctx, T("ui.ceremonyprompt", 3), 160, 110, COLORS.white, false);
    button(ctx, f, T("ui.ceremonyprompt", 5), 46, 132, 100, true);
    button(ctx, f, T("ui.ceremonyprompt", 4), 174, 132, 100);
    const vote = (v: boolean) => () => void this.post("api/ceremony", { manager: this.manager, player: this.player, vote: v, cup, phase: "vote" });
    this.hit(46, 132, 100, 16, vote(true));
    this.hit(174, 132, 100, 16, vote(false));
    this.hit(0, 0, W, H, () => undefined);
  }

  /** Läuft die servergesteuerte Zeremonie, zeichnet der Client sie im Takt nach. */
  animateAuslosung(): void {
    this.animating = true;
    const step = () => {
      if (this.screen !== "auslosung") {
        this.animating = false;
        return;
      }
      this.render();
      setTimeout(step, 60);
    };
    setTimeout(step, 60);
  }

  /** Zeremonie von Hand starten (Pokalbildschirm): läuft wie die gemeinsame, nur ohne Server. */
  startAuslosung(): void {
    this.drawStep = 0;
    this.drawStartedAt = Date.now();
    this.go("auslosung");
    this.animateAuslosung();
    this.render();
  }

  /** Highscore (0x34616): Name, Verein, PUNKTE und (Meisterschaften/DFB-Pokale/Europapokale). */
  /**
   * Highscore (0x34616). Der ganze Bildschirm steckt in PIC/45.CP: Stadionbild, Kasten,
   * Überschrift "BUNDESLIGA-MANAGER HIGHSCORES" und die zwanzig nummerierten Zeilen samt ihren
   * Trennstrichen sind Teil des Bildes - eingetragen werden nur die Texte. Am Original
   * vermessen (GitLab #60): Zeile i mit der obersten Schriftzeile y = 28 + 10·i, Name ab x 56,
   * Verein ab 104, "PUNKTE:" ab 187, die Punktzahl rechtsbündig auf 242, dahinter die drei
   * Titelzähler ab 243. Alles in Palettenfarbe 4 und ohne Schatten; der eigene Eintrag ist
   * nicht hervorgehoben, und Knöpfe hat der Bildschirm keine.
   */
  drawHighscore(): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const bild = this.assets.img("45.CP");
    if (bild) ctx.drawImage(bild, 0, 0);
    else panel(ctx, 6, 6, 308, 226);
    const INK = "#717192";
    const list = this.server.highscore ?? [];
    list.slice(0, 20).forEach((e, i) => {
      const y = 28 + 10 * i;
      s.draw(ctx, cp437ToGame(e.name), 56, y, INK, false);
      s.draw(ctx, cp437ToGame(e.club), 104, y, INK, false);
      s.draw(ctx, "PUNKTE:", 187, y, INK, false);
      s.drawRight(ctx, String(e.points), 242, y, INK, false);
      s.draw(ctx, `(${e.titles[0]}/${e.titles[1]}/${e.titles[2]})`, 243, y, INK, false);
    });
    this.hit(0, 0, W, H, () => this.go("menu"));
  }

  /**
   * Sportzeitung (0x2F243), am Original Punkt für Punkt vermessen (GitLab #56).
   *
   * Hintergrund Palettenfarbe 9 (#929292), darauf das Papier (5,1) bis (314,238) in Farbe 15.
   * Der Kopf PIC/44.VGA (300x30) sitzt bei (10,3). Die Schlagzeile steht in der großen Schrift
   * mittig über x 159, oberste Zeile 35, zweite Zeile 45.
   *
   * Der Artikel steht in der kleinen Schrift ab (13,56) im Zeilenabstand 7 und ist **im
   * Blocksatz** gesetzt: die Lücken zwischen den Wörtern werden mit Leerzeichen (je zwei Punkte
   * breit) aufgefüllt, bis die Zeile 181 Punkte breit ist - die vorderen Lücken bekommen eines
   * mehr als die hinteren. Nur die letzte Zeile bleibt linksbündig.
   *
   * Die Aufstellung steht in drei Zeilen bei y 183, 190 und 197 und ist ebenso gesetzt, nur
   * über die volle Breite von 296 Punkten und mit den Einträgen als Bausteinen: die Lücke
   * zwischen Name und Rückennummer bleibt schmal, aufgefüllt wird nur hinter den Kommas.
   * Darunter die Torfolge bei y 205 und die Karten bei 226 und 233.
   *
   * Das Foto (PIC/200+n) sitzt mittig in einem Feld 107x106 bei (202,62) - x = 202 + (107 -
   * Breite)/2, y = 62 + (106 - Höhe)/2 - und trägt einen schwarzen Rahmen von (x-2,y-2) bis
   * (x+Breite+1, y+Höhe+1).
   */
  drawZeitung(manager = this.manager, weiter: (() => void) | null = null): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const z = (this.server.zeitung ?? []).find((x) => x.manager === manager);
    ctx.fillStyle = "#929292";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f3f3f3";
    ctx.fillRect(5, 1, 310, 238);
    // Der Kopf ist 300 Punkte breit, das Original zeichnet aber nur 299 davon (0x2F35F)
    const head = this.assets.img("44.VGA");
    if (head) ctx.drawImage(head, 0, 0, 299, head.height, 10, 3, 299, head.height);
    if (!z) {
      f.drawCenter(ctx, "KEINE ZEITUNG", 159, 120, COLORS.black, false);
      this.hit(0, 0, W, H, weiter ?? (() => this.go("menu")));
      return;
    }
    const photo = this.assets.img(`${200 + z.picture}.VGA`);
    if (photo) {
      const px = 202 + Math.trunc((107 - photo.width) / 2);
      const py = 62 + Math.trunc((106 - photo.height) / 2);
      ctx.fillStyle = COLORS.black;
      ctx.strokeStyle = COLORS.black;
      const x2 = px + photo.width + 1;
      const y2 = py + photo.height + 1;
      ctx.fillRect(px - 2, py - 2, x2 - px + 3, 1);
      ctx.fillRect(px - 2, y2, x2 - px + 3, 1);
      ctx.fillRect(px - 2, py - 2, 1, y2 - py + 3);
      ctx.fillRect(x2, py - 2, 1, y2 - py + 3);
      ctx.drawImage(photo, px, py);
    }
    z.headline.forEach((line, i) => f.drawCenter(ctx, cp437ToGame(line), 159, 35 + i * 10, COLORS.black, false));
    // Blocksatz: die Zusatzleerzeichen gleichmäßig auf die Lücken, der Rest von vorn
    const blocksatz = (teile: string[], breite: number): string => {
      if (teile.length < 2) return teile[0] ?? "";
      const luecken = teile.length - 1;
      const basis = teile.reduce((n, t) => n + s.width(t), 0) + 2 * luecken;
      const zusatz = Math.max(0, Math.trunc((breite - basis) / 2));
      const je = Math.trunc(zusatz / luecken);
      const rest = zusatz % luecken;
      return teile.map((t, i) => (i === luecken ? t : t + " ".repeat(1 + je + (i < rest ? 1 : 0)))).join("");
    };
    /** Zeilenumbruch nach Wörtern; die Zeile darf einfach gesetzt nicht breiter als `breite` sein. */
    const umbruch = (worte: string[], breite: number): string[][] => {
      const aus: string[][] = [];
      let zeile: string[] = [];
      for (const wort of worte) {
        const probe = [...zeile, wort];
        const w = probe.reduce((n, t) => n + s.width(t), 0) + 2 * (probe.length - 1);
        if (w > breite && zeile.length) {
          aus.push(zeile);
          zeile = [wort];
        } else zeile = probe;
      }
      if (zeile.length) aus.push(zeile);
      return aus;
    };
    // Umbruch, sobald die Probe breiter ist als 180 (0x2EB89, Artikel) bzw. 295 (Aufstellung) -
    // wie `artikelspalte` im Core; aufgefüllt wird wie bisher bis 181 bzw. 296 (0x2EBC5: bis die
    // Breite mindestens 180 erreicht, gleichwertig)
    const zeilen = umbruch(cp437ToGame(z.sentences.join(" ")).split(" ").filter((w) => w !== ""), 180);
    zeilen.slice(0, 17).forEach((teile, i) => {
      const letzte = i === zeilen.length - 1;
      s.draw(ctx, letzte ? teile.join(" ") : blocksatz(teile, 181), 13, 56 + i * 7, COLORS.black, false);
    });
    // Die Aufstellung bricht an den Kommas um; Vereinsname und jeder Eintrag sind ein Baustein
    const bausteine = cp437ToGame(z.lineup).split(", ").map((t, i, a) => (i < a.length - 1 ? t + "," : t));
    const auf = umbruch(bausteine, 295);
    auf.slice(0, 3).forEach((teile, i) => {
      const letzte = i === auf.length - 1;
      s.draw(ctx, letzte ? teile.join(" ") : blocksatz(teile, 296), 13, 183 + i * 7, COLORS.black, false);
    });
    s.draw(ctx, cp437ToGame(z.goals), 13, 205, COLORS.black, false);
    s.draw(ctx, cp437ToGame(z.yellow), 13, 226, COLORS.black, false);
    s.draw(ctx, cp437ToGame(z.red), 13, 233, COLORS.black, false);
    this.hit(0, 0, W, H, weiter ?? (() => this.go("menu")));
  }

  async openFile(f: File): Promise<void> {
    try {
      const data = new Uint8Array(await f.arrayBuffer());
      this.save = SaveFile.decode(data);
      this.game = new GameState(this.save);
      this.fileName = f.name;
      this.manager = Math.min(this.game.currentManager, this.save.managerCount - 1);
      this.screen = "menu";
      this.status = "";
      (document.getElementById("loader") as HTMLElement).hidden = true;
    } catch (err) {
      this.status = String((err as Error).message);
    }
    this.render();
  }

  /**
   * Speichern: im Mehrspielermodus legt der Server die Datei neben den anderen Spielständen ab
   * (/api/save), sonst lädt der Browser sie herunter.
   */
  async saveGame(): Promise<void> {
    if (!this.online) {
      this.download();
      return;
    }
    const vorgabe = this.fileName.toUpperCase().endsWith(".MAN") ? this.fileName.toUpperCase() : "SPIEL.MAN";
    const name = await new Promise<string>((fertig) => this.fragText("SPIELSTAND SPEICHERN", "DATEI", vorgabe.replace(/\.MAN$/, ""), 8, fertig));
    if (!name) return;
    const file = name.toUpperCase().endsWith(".MAN") ? name.toUpperCase() : name.toUpperCase() + ".MAN";
    await this.spielstandSchreiben(file, false);
  }

  /**
   * Spielstand auf dem Server ablegen. Der Vorrat der *.MAN ist allen Runden gemeinsam; gibt es
   * die Datei schon, fragt der Server zurueck, statt sie stillschweigend zu ueberschreiben - die
   * Rueckfrage stellt das Spiel in seinem eigenen Kasten (GitLab #36).
   */
  async spielstandSchreiben(file: string, ueberschreiben: boolean): Promise<void> {
    const r = await fetch("api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file, ueberschreiben }) });
    if (r.status === 401) {
      this.showLogin();
      return;
    }
    const antwort = (await r.json().catch(() => ({}))) as { error?: string; file?: string; vorhanden?: boolean };
    if (antwort.vorhanden) {
      this.fragJaNein([toGame(file), toGame("GIBT ES SCHON."), toGame("ÜBERSCHREIBEN?")], () => void this.spielstandSchreiben(file, true));
      this.render();
      return;
    }
    this.status = r.ok ? "Gespeichert als " + (antwort.file ?? file) : "Server: " + antwort.error;
    this.statusUntil = Date.now() + 6000;
    this.render();
  }

  download(): void {
    if (!this.save) return;
    const fresh = this.save.withFreshHeader();
    const blob = new Blob([fresh.encode()], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.fileName.toUpperCase().endsWith(".MAN") ? this.fileName : this.fileName + ".MAN";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.status = "Spielstand gespeichert: " + a.download;
    this.render();
  }

  /** Rechte Maustaste: Untermenü schließen, sonst zurück ins Hauptmenü (wie im Original). */
  onRightClick(): void {
    // Konferenz: "Der Erbauer der letzten gespielten Torszene war: ..." (0x562A). Das Original
    // prüft die Maustaste 3 und einen nicht leeren Urheber, dann kommt der Hinweiskasten 0x3174A
    // mit den drei Zeilen aus dem Programm und dem Namen als vierter Zeile. Vor der ersten
    // Szene passiert nichts. Die Konferenz läuft für die anderen weiter - im Original hielt der
    // Kasten das Spiel an, hier ist sie gemeinsam.
    if (this.screen === "live" && !this.hinweis) {
      const urheber = this.letzteSzene ? (this.scenes.data?.[this.letzteSzene]?.author ?? "").trim() : "";
      if (urheber) {
        this.hinweis = [T("live.erbauer", 0), T("live.erbauer", 1), T("live.erbauer", 2), urheber];
        this.render();
        return;
      }
    }
    // Stadion: der Rechtsklick im Kasten holt die Rückfrage zum Ausbau (im Original bestätigt
    // man so die am Regler eingestellte Menge)
    if (this.screen === "stadium" && this.stadiumPick > 0) {
      if (this.stadiumAsk) {
        this.stadiumAsk = false;
        if (this.stadiumPick >= 4) this.stadiumAmount = 0;
      } else if (this.stadiumPick < 8 && this.stadiumAmount > 0) {
        void this.rueckfrageOeffnen(this.stadiumPick);
        return;
      } else this.stadiumPick = 0;
      this.render();
      return;
    }
    // Hauptmenü: der Rechtsklick auf das Managersymbol rechts unten fragt, ob man aufhören will
    // (Original 0x0A7DD, Fenster an 266,196 = unser iconFrame(268,199))
    if (this.screen === "menu" && this.game && this.online) {
      const { x, y } = this.maus;
      if (x >= 268 && x < 314 && y >= 199 && y < 235) {
        this.endeDialog = true;
        this.render();
        return;
      }
    }
    if (this.endeDialog) {
      this.endeDialog = false;
      this.render();
      return;
    }
    // Erst zurück ins Hauptmenü (das Untermenü bleibt offen), dort schließt der Rechtsklick es
    if (this.screen !== "menu" && this.screen !== "seat" && this.screen !== "live" && this.screen !== "auslosung") this.go("menu");
    else if (this.submenu) this.submenu = null;
    this.render();
  }

  /** Zeigepunkt in Spielkoordinaten */
  point(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  /**
   * Zeile unter dem Zeiger für alle Bildschirme neu bestimmen; liefert true, wenn sich etwas
   * geändert hat. Das Original prüft die Zeigerposition bei jedem Bilddurchlauf, nicht nur bei
   * einer Mausbewegung - deshalb steht der Hinweis auch dann da, wenn der Zeiger schon an
   * seinem Platz liegt, während der Bildschirm wechselt.
   *
   * Stadion (0x0602): x 7..288, y 115..184, Zeile (y - 114) / 8.
   * Bank (0x130B2): x 161..258, y 31..92, Zeile (y - 31) / 11.
   * Trainingslager (0x113E5 ab 0x118F6): Zeile aus y (Zeile·52 + 9 bis + 41), darin links die
   * Balkentafel (x 6..44) und das Foto (52..130), rechts das Foto (137..216) und die Tafel
   * (223..261); über der Tafel steht der Kennwert der Spalte ((x - 6) mod 217 geteilt durch 8),
   * über dem Foto das Lager mit seinem Wochenpreis.
   */
  hoverZeile(): boolean {
    const { x, y } = this.maus;
    let stadium = -1;
    let bank = -1;
    let camp = -1;
    // Kaderbildschirm: Zeile und Spalte unter dem Zeiger (Hilfszeile wie im Original)
    let squad = -1;
    let spalte = -1;
    // Die Zeilen der Kaderliste stehen bei y = 30 + 6·i; anklickbar und "unter dem Zeiger" ist
    // das Band 29 + 6·i bis 34 + 6·i - der freie Punkt zwischen zwei Balken gehört zur unteren
    // Zeile. (Die Zeilen sind einmal um acht Punkte nach oben gerückt, ohne dass diese Rechnung
    // mitgezogen wurde; dadurch lag der gelbe Balken eine Zeile über dem Mauszeiger.)
    if (this.screen === "squad" && x >= 6 && x < 6 + (this.pitchOpen ? 180 : 232) && y >= 29) {
      const i = Math.trunc((y - 29) / 6);
      if (i >= 0 && i < this.squadRows().length) {
        squad = i;
        spalte = this.squadSpalteAt(x);
      }
    }
    if (this.screen === "stadium") {
      if (x > 6 && x < 289 && y > 114 && y < 185) stadium = Math.trunc((y - 114) / 8);
    } else if (this.screen === "bank") {
      if (x > 160 && x < 259 && y > 30 && y < 93) bank = Math.trunc((y - 31) / 11);
    } else if (this.screen === "camp") {
      const row = Math.trunc((y - 9) / 52);
      if (row >= 0 && row < 4 && y > row * 52 + 8 && y < row * 52 + 42) {
        if ((x > 5 && x < 45) || (x > 222 && x < 262)) camp = Math.trunc((Math.trunc(x - 6) % 217) / 8);
        else if (x > 51 && x < 131) camp = 5 + row;
        else if (x > 136 && x < 217) camp = 9 + row;
      }
    }
    const anders = stadium !== this.stadiumHover || bank !== this.bankHover || camp !== this.campHover || squad !== this.squadHover || spalte !== this.squadSpalte;
    this.stadiumHover = stadium;
    this.bankHover = bank;
    this.campHover = camp;
    this.squadHover = squad;
    this.squadSpalte = spalte;
    return anders;
  }

  /**
   * Spalte unter dem Zeiger im Kaderbildschirm; die Zahl ist der Platz im Textkatalog
   * (ui.kaderhilfe). Die Grenzen sind am 16.9.2026 im Original ausgemessen worden, indem der
   * Zeiger die Zeile entlanggefahren ist und die Hilfszeile beobachtet wurde.
   */
  squadSpalteAt(x: number): number {
    const felder: [number, number, number][] = this.squadView === "vertrag"
      ? [[6, 23, 18], [24, 84, 2], [85, 89, 6], [90, 102, 8], [103, 114, 12], [115, 158, 22], [159, 174, 15], [175, 200, 16], [201, 237, 17]]
      : [[6, 16, 0], [17, 34, 18], [35, 93, 2], [94, 106, 6], [107, 142, 7], [143, 154, 12], [155, 179, 13], [180, 218, 22], [219, 237, 15]];
    for (const [von, bis, nr] of felder) if (x >= von && x <= bis) return nr;
    return -1;
  }

  /**
   * Hilfszeile für die Spalte unter dem Zeiger. Im Original hängen fünf Spalten ihren Wert an:
   * Mannschaftsteil (nur der Name), Name mit Alter und Fuß, Stärken mit dem Durchschnitt,
   * Status und Tendenz. Die Erschöpfung steht nur in der Aufstellungsansicht dabei, in der
   * Vertragsansicht nicht (beides im Original nachgemessen).
   */
  squadHilfe(l: Lineup): string {
    const g = this.game!;
    const p = g.players.at(l.playerIndex);
    const hilfe = squadHelp();
    const nr = this.squadSpalte;
    if (nr < 0) return "";
    if (nr === 18) return hilfe[18 + ["TOR", "ABW", "MIT", "ANG"].indexOf(p.position)] ?? "";
    if (nr === 2) {
      const seite = p.u8(32);
      const fuss = seite < 5 ? (seite > 1 ? "L+R" : "L") : "R";
      return hilfe[2] + toGame(`${cp437ToGame(p.name)} (${p.age} JAHRE) (${fuss})`);
    }
    if (nr === 7) return `${hilfe[7]}(${l.overall})`;
    if (nr === 22) return hilfe[22] + (this.einsatzFlag(l) & 2 ? "VERL." : this.einsatzFlag(l) & 1 ? "GESP." : l.number === 0 ? "" : l.number > 11 ? "RESERVE" : "IM TEAM");
    if (nr === 15) {
      const w = tendencyWords();
      const stufe = Math.max(0, Math.min(2, Math.trunc((l.u8(14) - 30) / 13)));
      const wort = hilfe[15] + w[stufe];
      return this.squadView === "vertrag" ? wort : `${wort} (${w[3]}:${l.u8(19)})`;
    }
    return hilfe[nr] ?? "";
  }

  onMove(e: MouseEvent): void {
    this.maus = this.point(e);
    if (this.hoverZeile()) this.render();
  }

  /**
   * Zeiger über dem Spielfeld: das Original zeigt den Spieler unter dem Zeiger gelb in der
   * Liste und darunter seine Stärke, sein Alter und den Fuß.
   */
  onMovePitch(e: MouseEvent): void {
    if (this.screen !== "squad" || !this.pitchOpen) {
      if (!this.pitchHover) return;
      this.pitchHover = null;
      this.render();
      return;
    }
    const { x, y } = this.point(e);
    let hover: { col: number; row: number } | null = null;
    if (x >= 189 && x < 307 && y >= 94 && y < 214) {
      const col = Math.max(0, Math.min(6, Math.round((x - 208) / 14)));
      const row = Math.max(0, Math.min(7, Math.round((y - 106) / 14)));
      hover = { col, row };
    }
    if (hover?.col === this.pitchHover?.col && hover?.row === this.pitchHover?.row) return;
    this.pitchHover = hover;
    this.render();
  }

  onClick(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    for (const h of this.hits) {
      if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) {
        h.action(x, y);
        this.render();
        return;
      }
    }
  }

  hit(x: number, y: number, w: number, h: number, action: (cx: number, cy: number) => void): void {
    this.hits.push({ x, y, w, h, action });
  }

  /**
   * Bildschirm wechseln. Das offene Untermenü bleibt gemerkt: im Original landet man mit
   * HAUPT MENU oder einem Rechtsklick wieder in derselben Untermenü-Übersicht.
   */
  go(s: Screen): void {
    if (s !== this.screen) {
      this.blende();
      this.vertragsAntwort = "";
      this.resultPage = 0;
    }
    this.screen = s;
    this.selectedRow = -1;
    this.hoverZeile();
    this.musikPflegen();
  }

  /**
   * Klänge einer Torszene (0x0C7C4): erreicht die Bildnummer eine der vier Kopfbytes, fängt der
   * zugehörige Klang an - digi1 (Torjubel) bis digi4. Treffen mehrere auf dasselbe Bild, gewinnt
   * wie im Original der letzte.
   */
  szeneTon(schluessel: string, id: string, bild: number, bilder: number, tor: boolean): void {
    if (this.tonSzene !== schluessel) {
      this.tonSzene = schluessel;
      this.tonBild = -1;
      this.tonSchluss = false;
    }
    if (bild > this.tonBild) {
      const kopf = this.scenes.kopf(id);
      for (let b = this.tonBild + 1; b <= bild; b++) {
        let klang = -1;
        for (let i = 0; i < 4; i++) if (kopf[i] === b) klang = i;
        if (klang >= 0) this.klaenge.spiele("digi" + (klang + 1));
      }
      this.tonBild = bild;
    }
    // Nach der Szene kommt der Klang zum Ausgang (0x1BA40): Tor der Jubel, sonst der vierte Klang
    if (!this.tonSchluss && bilder > 0 && bild >= bilder - 1) {
      this.tonSchluss = true;
      this.klaenge.spiele(tor ? "digi1" : "digi4");
    }
  }

  /** Titelmusik läuft, solange das Titelbild steht - sobald ein Spiel läuft, ist Schluss. */
  musikPflegen(): void {
    const titel = this.screen === "start" || this.screen === "start-online" || this.screen === "newgame" || this.screen === "seat";
    if (titel) this.klaenge.musik("titel.mp3");
    else this.klaenge.musikAus();
  }

  /**
   * Überblendung (Schalter "Blenden", im Original 4cb3:060C): der neue Bildschirm kommt aus dem
   * Schwarz herauf. Das Original blendet über die Palette, im Browser legt sich stattdessen eine
   * schwarze Fläche darüber, die aufklart.
   */
  blende(): void {
    if (!(this.server.options?.flags ?? OPTION_DEFAULTS)[OPTION_BLENDEN]) return;
    this.blendeBis = Date.now() + BLENDE_MS;
    if (this.blendeLaeuft) return;
    this.blendeLaeuft = true;
    const schritt = () => {
      if (Date.now() >= this.blendeBis) {
        this.blendeLaeuft = false;
        this.render();
        return;
      }
      this.render();
      requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  }

  // ---- Zeichnen ----------------------------------------------------------

  /**
   * Bild aufbauen. Ein Fehler beim Zeichnen darf nicht das ganze Fenster lahmlegen: bisher blieb
   * nach einer Ausnahme das letzte Bild stehen, und mit ihm sahen auch alle Hinweiszeilen aus
   * wie eingefroren. Jetzt wird der Fehler abgefangen und oben angezeigt.
   */
  render(): void {
    try {
      this.zeichne();
      this.zeichenFehler = "";
    } catch (e) {
      const text = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      if (this.zeichenFehler !== text) console.error(e);
      this.zeichenFehler = text;
    }
    if (this.blendeBis > Date.now()) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (this.blendeBis - Date.now()) / BLENDE_MS);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.zeichenFehler) {
      const ctx = this.ctx;
      ctx.fillStyle = "#920010";
      ctx.fillRect(0, 0, W, 8);
      this.assets.micro.draw(ctx, upperGame(toGame(this.zeichenFehler)).slice(0, 62), 2, 1, "#f3f3f3", false);
    }
  }

  zeichne(): void {
    this.hits = [];
    const ctx = this.ctx;
    const bg = this.assets.img("22.CP");
    if (bg) ctx.drawImage(bg, 0, 0);
    else {
      ctx.fillStyle = "#506080";
      ctx.fillRect(0, 0, W, H);
    }
    switch (this.screen) {
      case "start":
        this.drawStart();
        break;
      case "menu":
        this.drawMenu();
        break;
      case "squad":
        this.drawSquad();
        break;
      case "table":
        this.drawTable();
        break;
      case "stadium":
        this.drawStadium();
        break;
      case "messages":
        this.drawMessages();
        break;
      case "seat":
        this.drawSeat();
        break;
      case "werbung":
        this.drawWerbung();
        break;
      case "verlauf":
        this.drawVerlauf();
        break;
      case "results":
        this.drawResults();
        break;
      case "zeitung":
        this.drawZeitung();
        break;
      case "highscore":
        this.drawHighscore();
        break;
      case "auslosung":
        this.drawAuslosung();
        break;
      case "live":
        this.drawLive();
        break;
      case "lobby":
        this.drawLobby();
        break;
      case "verwaltung":
        this.drawVerwaltung();
        break;
      case "zutritt":
        this.drawZutritt();
        break;
      case "start-online":
        this.drawStartOnline();
        break;
      case "training":
        this.drawTraining();
        break;
      case "bank":
        this.drawBank();
        break;
      case "medizin":
        this.drawMedizin();
        break;
      case "toreditor":
        this.drawToreditor();
        break;
      case "jugend":
        this.drawJugend();
        break;
      case "abwerben":
        this.drawAbwerben();
        break;
      case "extra2026":
        this.drawExtra2026();
        break;
      case "market":
        this.drawMarket();
        break;
      case "spiele":
        this.drawSpiele();
        break;
      case "staerken":
        this.drawStaerken();
        break;
      case "bestenliste":
        this.drawBestenliste();
        break;
      case "pokal":
        this.drawPokal();
        break;
      case "statistik":
        this.drawStatistik();
        break;
      case "ewige":
        this.drawEwige();
        break;
      case "optionen":
        this.drawOptionen();
        break;
      case "camp":
        this.drawCamp();
        break;
      case "newgame":
        this.drawNewGame();
        break;
    }
    if (this.screen === "live") this.drawTicker();
    if (this.vereinsInfo && (this.screen === "table" || this.screen === "spiele" || this.screen === "staerken")) this.drawVereinsInfo();
    else this.vereinsInfo = null;
    // Zahleneingaben und kurze Rückmeldungen liegen über dem Bildschirm, zu dem sie gehören
    this.drawEingabe();
    this.drawAbschluss();
    this.drawHinweis();
    this.drawFrage();
    const loader = document.getElementById("loader") as HTMLElement | null;
    if (loader) loader.hidden = this.online ? this.screen !== "start-online" : this.screen !== "start";
    this.drawStatus();
  }

  /**
   * Meldungszeile: sie steht auf einer eigenen Leinwand unter dem Spielbild, damit sie dem
   * Original nichts abschneidet (der Bildschirm des Originals hat sie nicht).
   */
  drawStatus(): void {
    const c = document.getElementById("status") as HTMLCanvasElement | null;
    if (!c) return;
    if (!this.status) {
      c.hidden = true;
      return;
    }
    c.hidden = false;
    const sc = c.getContext("2d")!;
    sc.fillStyle = COLORS.black;
    sc.fillRect(0, 0, W, 11);
    // Lange Meldungen liefen rechts aus dem Bild: passt es in der normalen Schrift nicht, kommt
    // die kleine, und erst dann wird gekürzt (von lhuno gemeldet)
    const text = toGame(this.status);
    const f = this.assets.font.width(text) <= W - 8 ? this.assets.font : this.assets.micro;
    f.draw(sc, this.kuerzen(f, text, W - 8), 4, f === this.assets.font ? 1 : 3, COLORS.white, false);
  }

  drawStart(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    panel(ctx, 40, 90, 240, 60);
    f.drawCenter(ctx, "BUNDESLIGA MANAGER PROFESSIONAL", 160, 100, COLORS.white);
    f.drawCenter(ctx, "Prototyp 0: Spielstand-Browser", 160, 114);
    f.drawCenter(ctx, toGame("Bitte einen Spielstand (*.MAN) wählen"), 160, 132);
  }

  drawMenuHeader(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const g = this.game!;
    const m = g.managers.at(this.manager);
    // Das Titelbild sitzt drei Zeilen über dem Bildschirmrand (im Original nachgemessen)
    const title = this.assets.img("4.VGA");
    if (title) ctx.drawImage(title, 0, -3);
    // Lage gegen das Originalbild gemessen; von den 320 Spalten zeichnet das Original nur 319 -
    // die letzte bleibt Marmor. Dasselbe tut es beim Zeitungskopf (44.VGA), es lohnt sich also,
    // bei jedem Bild nachzusehen (GitLab #56).
    const top = this.assets.img("23.VGA");
    if (top) ctx.drawImage(top, 0, 0, top.width - 1, top.height, 0, 41, top.width - 1, top.height);
    // Porträt
    const faces = this.assets.img("0.VGA");
    if (faces) ctx.drawImage(faces, this.gesichtSpalte(this.manager), 0, 40, 40, 15, 59, 40, 40);
    // nächster Termin und Name: normale Schrift, schwarz, ohne Schatten (gegen das Original gemessen)
    // Oberes Feld: Ereignis des Tages wie im Original ("10. Spieltag", "Spielfrei"), Mitte x=119
    // Mittig wie 0x074EC: x1 + (x2-x1)/2 - Breite/2, alles abgeschnitten. Das Ereignis steht
    // zwischen 74 und 165, der Name zwischen 62 und 178.
    const mitte = (t: string, x1: number, x2: number) => x1 + Math.trunc((x2 - x1) / 2) - Math.trunc(f.width(t) / 2);
    // Beide stehen schwarz mit einem Schatten in Palettenfarbe 4 ein Pixel weiter rechts
    const schatten = (t: string, x: number, y: number) => {
      f.draw(ctx, t, x + 1, y, "#616182", false);
      f.draw(ctx, t, x, y, COLORS.black, false);
    };
    const event = this.dayEvent(m.clubIndex);
    schatten(event, mitte(event, 74, 165), 52);
    const name = m.displayName === m.name ? m.name : toGame(m.displayName);
    schatten(name, mitte(name, 62, 178), 92);
    // Wappen
    const club = g.clubs.at(m.clubIndex);
    const logo = this.assets.img(80 + club.status + ".VGA");
    if (logo) ctx.drawImage(logo, 187, 60); // weiße Logofläche im Original x 187..224, y 60..97
    // Kalenderblatt (Teil von 23.VGA): normale Schrift in Graublau mit dunklem Schatten
    // einen Pixel rechts, Tageszahl doppelt so groß; Zeilen 54, 65, 84, 93 wie im Original
    const d = g.date;
    // Wochentag wie im Original (0x040EF): aus dem Saisontag, Index (Saisontag + 6) mod 7
    const weekday = DAYS[(seasonDay(dayIndex(g)) + 6) % 7];
    const paper = (t: string, y: number) => {
      const x = 232 + Math.trunc((316 - 232) / 2) - Math.trunc(f.width(t) / 2);
      f.draw(ctx, t, x + 1, y, COLORS.paperShadow, false);
      f.draw(ctx, t, x, y, COLORS.paperText, false);
    };
    paper(weekday, 54);
    const dayText = d.day + ".";
    // Die Tageszahl steht in der großen Schrift 3 (16 Zeilen) in Palettenfarbe 6 mit einem
    // Schatten in Farbe 8 ein Pixel rechts, mittig zwischen 243 und 304 (unterste Zeile 79)
    const gr = this.assets.gross;
    const gx = 243 + Math.trunc((304 - 243) / 2) - Math.trunc(gr.width(dayText) / 2);
    gr.draw(ctx, dayText, gx + 1, 65, "#000071", false);
    gr.draw(ctx, dayText, gx, 65, "#414161", false);
    paper(MONTHS[d.month - 1] ?? "", 84);
    paper(String(d.year), 94);
    // Klick aufs Kalenderblatt = Zug beenden (wie im Original)
    this.hit(244, 46, 70, 60, () => this.finishTurn());
    this.drawTabellenkurve(m);
  }

  /**
   * Tabellenverlauf im oberen Feld (0x09857 bis 0x09F72): das Original merkt sich nach jedem
   * Spieltag den Tabellenplatz des Vereins (Managerbyte 267 + Spieltag, geschrieben in 0x2DBC5)
   * und zieht daraus einen Linienzug in Farbe 11. Er beginnt links bei (63, Byte 267 + 64) und
   * geht bis (177, letzter Platz + 65); die Punkte liegen 116/(Spiele-1) Pixel auseinander, es
   * passen also erst gegen Saisonende alle hinein. Bei höchstens einem Spiel steht statt dessen
   * ein flacher Strich in Farbe 7.
   */
  drawTabellenkurve(m: ReturnType<GameState["managers"]["at"]>): void {
    const ctx = this.ctx;
    const g = this.game!;
    const s = g.standings.at(m.clubIndex);
    const spiele = s.u8(30) + s.u8(31);
    // Linie Pixel für Pixel wie der Zeichner des Originals (kein Kantenglätten)
    const linie = (x1: number, y1: number, x2: number, y2: number, color: string) => {
      ctx.fillStyle = color;
      let x = x1;
      let y = y1;
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const sx = dx >= 0 ? 1 : -1;
        for (let i = 0; i <= Math.abs(dx); i++) {
          x = x1 + i * sx;
          y = y1 + Math.trunc((i * sx * dy) / (dx || 1));
          ctx.fillRect(x, y, 1, 1);
        }
      } else {
        const sy = dy >= 0 ? 1 : -1;
        for (let i = 0; i <= Math.abs(dy); i++) {
          y = y1 + i * sy;
          x = x1 + Math.trunc((i * sy * dx) / (dy || 1));
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };
    if (spiele <= 1) {
      linie(63, 74, 177, 74, "#303051");
      return;
    }
    const schritt = 116 / (spiele - 1);
    let x1 = 63;
    let y1 = m.u8(267) + 64;
    let k = 0;
    let acc = 0;
    for (let i = 0; i < 115; i++) {
      if (acc > schritt) {
        acc -= schritt;
        const x2 = i + 62;
        const y2 = m.u8(268 + k) + 65;
        linie(x1, y1, x2, y2, "#d3c3b2");
        x1 = x2;
        y1 = y2;
        k++;
      }
      acc += 1;
    }
    linie(x1, y1, 177, m.u8(268 + k) + 65, "#d3c3b2");
  }

  /**
   * Ereignis des aktuellen Kalendertags für den Verein: Spieltag, Pokal, Europapokal oder
   * Spielfrei. Ein Pokaltag zählt nur, wenn dieser Manager dort noch dabei ist - sonst steht
   * auch im Original "Spielfrei" (Managerbytes 306..309, Runde 1..7).
   */
  dayEvent(club: number): string {
    const g = this.game!;
    const k = g.save.plain[34226];
    const flag = g.save.plain[34227 + k];
    const league = club < 18 ? 0 : club < 38 ? 1 : 2;
    if (flag & (1 << league)) return `${g.nextMatchday(league)}. Spieltag`;
    const manager = g.activeManagers().findIndex((m) => m.clubIndex === club);
    const dabei = (cup: number): boolean => {
      if (manager < 0) return false;
      const r = g.managers.at(manager).u8(306 + cup);
      return r > 0 && r < 8;
    };
    if (flag & 8 && dabei(0)) return "DFB-Pokal";
    for (let cup = 1; cup <= 3; cup++) if (flag & (8 << cup) && dabei(cup)) return "Europapokal";
    // Holt der eigene Verein heute ein Spiel nach, steht "Nachholspiel" (0x9C18 mit 0x310A)
    if (flag & 0x80 && replays(g).some((e) => e.dayIndex === k && e.league === league && (fixtures(e.league, e.matchday)[e.match] ?? []).includes(club)))
      return texte("ui.ankuendigung")[5];
    return "Spielfrei";
  }

  nextOpponent(club: number): string {
    const g = this.game!;
    const order = g.save.plain.subarray(27900, 27960);
    const league = club < 18 ? [0, 18] : club < 38 ? [20, 40] : [40, 60];
    for (let i = league[0]; i + 1 < league[1]; i += 2) {
      if (order[i] === club) return toGame(g.clubs.at(order[i + 1]).displayName) + " (H)";
      if (order[i + 1] === club) return toGame(g.clubs.at(order[i]).displayName) + " (A)";
    }
    return "Spielfrei";
  }

  drawMenu(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    this.drawMenuHeader();
    // Wie im Original (docs/original/menu-*.png): links Büro/Wappen/Trikots, rechts Pokal/Diskette/
    // Manager; ein Klick öffnet das Untermenü in den mittleren neun Feldern.
    type Icon = Parameters<typeof drawIcon>[3];
    // Felder des Untermenüs: die des Originals tragen ein Symbol, das Abwerben der Version 2026
    // hat keines und wird beschriftet
    type Cell = { icon: Icon; action: () => void } | { bild: string; action: () => void } | { label: string; action: () => void } | null;
    // Im Original vermessen: die Knöpfe der Außenspalten stehen bei x 7 und 268 mit y 113, 156
    // und 199, die neun Felder des Untermenüs bei x 84 + 54·Spalte und y 115 + 42·Zeile. Der
    // Punkt ist der von iconFrame, das Symbol liegt sieben rechts und sechs darunter.
    const seite = (col: number) => (col === 0 ? 7 : 268);
    const seiteY = (row: number) => 113 + 43 * row;
    const untenX = (col: number) => 84 + 54 * col;
    const untenY = (row: number) => 115 + 42 * row;
    const toggle = (sub: typeof this.submenu) => () => (this.submenu = this.submenu === sub ? null : sub);
    const side: { icon: Icon; col: number; row: number; action: () => void }[] = [
      { icon: "buero", col: 0, row: 0, action: toggle("buero") },
      { icon: "wappen", col: 0, row: 1, action: toggle("wappen") },
      { icon: "trikots", col: 0, row: 2, action: toggle("trikots") },
      { icon: "pokal", col: 4, row: 0, action: toggle("pokal") },
      { icon: "diskette", col: 4, row: 1, action: toggle("diskette") },
      { icon: "manager", col: 4, row: 2, action: () => this.go("messages") },
    ];
    for (const it of side) {
      const x = seite(it.col);
      const y = seiteY(it.row);
      // Der Knopf des offenen Untermenüs steht im Original eingedrückt (Bild PIC/25.VGA)
      this.iconFrame(x, y, this.submenu !== null && it.icon === this.submenu);
      drawIcon(ctx, this.assets, it.icon, x + 7, y + 6);
      this.hit(x, y, 46, 36, it.action);
    }
    const league = (i: number, screen: "table" | "spiele" | "staerken") => () => {
      if (screen === "table") this.tableLeague = i;
      else if (screen === "spiele") {
        this.spieleLeague = i;
        this.spieleMd = this.game!.nextMatchday(i);
      } else this.staerkenLeague = i;
      this.go(screen);
    };
    const cup = (c: number) => () => {
      this.cup = c;
      this.go("pokal");
    };
    // [Spalte][Zeile]
    const grids: Record<NonNullable<typeof this.submenu>, Cell[][]> = {
      buero: [
        [{ icon: "statistik", action: () => this.go("statistik") }, { icon: "ewige", action: () => this.go("ewige") }, { icon: "verlauf", action: () => this.go("verlauf") }],
        [{ icon: "stadion", action: () => this.go("stadium") }, { icon: "bank", action: () => this.go("bank") }, { icon: "werbung", action: () => this.go("werbung") }],
        // Jugendarbeit gibt es nur in der Version 2026 (sim/jugend.ts)
        [this.game && is2026(this.game) && this.online ? { bild: "jugend", action: () => void this.jugendOeffnen() } : null, null, null],
      ],
      wappen: [
        [{ icon: "tabBL", action: league(0, "table") }, { icon: "tab2", action: league(1, "table") }, { icon: "tab3", action: league(2, "table") }],
        [{ icon: "spBL", action: league(0, "spiele") }, { icon: "sp2", action: league(1, "spiele") }, { icon: "sp3", action: league(2, "spiele") }],
        [{ icon: "staBL", action: league(0, "staerken") }, { icon: "sta2", action: league(1, "staerken") }, { icon: "sta3", action: league(2, "staerken") }],
      ],
      trikots: [
        [
          {
            icon: "taktik",
            action: () => {
              this.squadView = "kader";
              this.go("squad");
            },
          },
          {
            // Die Vertragsakte führt im Original in dieselbe Mannschaftsansicht, nur mit der
            // Vertragstabelle
            icon: "vertrag",
            action: () => {
              this.squadView = "vertrag";
              this.vertragPlace = -1;
              this.go("squad");
            },
          },
          { icon: "transfer", action: () => this.go("market") },
        ],
        [{ icon: "training", action: () => this.go("training") }, { icon: "lager", action: () => this.go("camp") }, { icon: "beste", action: () => this.go("bestenliste") }],
        // Abwerben und die medizinische Versorgung gibt es nur in der Version 2026
        // (sim/abwerben.ts, sim/medizin.ts)
        [
          this.game && is2026(this.game) && this.online ? { bild: "abwerben", action: () => this.goAbwerben() } : null,
          this.game && is2026(this.game) && this.online ? { bild: "arzt", action: () => this.go("medizin") } : null,
          null,
        ],
      ],
      pokal: [
        [{ icon: "dfb", action: cup(0) }, { icon: "landesmeister", action: cup(1) }, { icon: "pokalsieger", action: cup(2) }],
        [{ icon: "uefa", action: cup(3) }, null, null],
        [null, null, null],
      ],
      diskette: [
        [{ icon: "laden", action: () => this.go(this.online ? "start-online" : "start") }, { icon: "speichern", action: () => void this.saveGame() }, { icon: "highscore", action: () => this.go("highscore") }],
        [
          { icon: "optionen", action: () => this.go("optionen") },
          { icon: "neu", action: () => this.go(this.online ? "start-online" : "start") },
          // Zusatzregeln der Version 2026 neben den Einstellungen
          this.game && is2026(this.game) && this.online ? { label: "2026", action: () => this.go("extra2026") } : null,
        ],
        // Torszenen-Editor (GitLab #6): eigenes Werkzeug, kein Teil des Originals
        [this.online ? { label: "SZENEN", action: () => void this.editorStarten() } : null, null, null],
      ],
    };
    if (this.live) {
      button(ctx, f, "ZUR KONFERENZ", 92, 100, 140, true);
      this.hit(92, 100, 140, 16, () => this.go("live"));
    }
    // Zu Beginn des Zuges zeigt das Original die Meldungen in den mittleren neun Feldern
    if (this.drawMeldungen()) {
      if (this.endeDialog) this.drawEndeDialog();
      return;
    }
    if (this.submenu) {
      const grid = grids[this.submenu];
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
          const x = untenX(col);
          const y = untenY(row);
          this.iconFrame(x, y);
          const cell = grid[col][row];
          // Leere Plätze zeigen im Original nur die Spinnwebe über dem blauen Feld
          if (cell && "icon" in cell) drawIcon(ctx, this.assets, cell.icon, x + 7, y + 6);
          else if (cell && "bild" in cell) {
            // Eigenes Symbol (Version 2026), gezeichnet wie die des Originals
            const bild = this.assets.img(cell.bild);
            if (bild) ctx.drawImage(bild, x + 7, y + 6);
          } else if (cell) this.assets.micro.drawCenter(ctx, cell.label, x + 23, y + 15, COLORS.white);
          else drawIconOver(ctx, this.assets, "leer", x + 7, y + 6);
          // Nach einem Trainingslager ist der Menüpunkt gesperrt (Managerbyte 313, 0x0A1E4):
          // das Original legt die Spinnwebe über das Symbol
          const gesperrt = cell !== null && "icon" in cell && cell.icon === "lager" && this.game !== undefined && this.game.managers.at(this.manager).u8(313) !== 0;
          if (gesperrt) drawIconOver(ctx, this.assets, "leer", x + 7, y + 6);
          if (cell && !gesperrt) this.hit(x, y, 46, 36, cell.action);
        }
      }
    }
    if (this.endeDialog) this.drawEndeDialog();
    else if (!this.drawKreditAnfrage()) this.drawAbwerbeAnfrage();
  }

  /**
   * Kreditanfrage eines Mitspielers (Version 2026): Im Original nimmt man sich das Geld eines
   * Mitspielers einfach, hier wird er gefragt. Laufzeit und Zins setzt der Geldgeber.
   * Liefert true, wenn eine Anfrage offen ist (dann steht der Kasten über dem Menü).
   */
  drawKreditAnfrage(): boolean {
    const g = this.game;
    const q = this.server.extra?.loanRequests?.find((r) => r.lender === this.manager);
    if (!g || !q) return false;
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    panel(ctx, 45, 104, 230, 72, "#610010");
    f.drawCenter(ctx, "KREDITANFRAGE", 159, 108, "#d3c3b2", false);
    hline(ctx, 47, 117, 226, "#d3c3b2");
    s.drawCenter(ctx, `${toGame(g.managers.at(q.borrower).displayName)} BITTET SIE UM`, 159, 124, "#b2a282", false);
    s.drawCenter(ctx, dm(q.amount).toUpperCase(), 159, 134, "#b2a282", false);
    s.drawCenter(ctx, `${T("ui.stadionkopf", 0)} ${dm(g.managers.at(this.manager).balance)}`, 159, 146, "#b2a282", false);
    this.knopf("GEBEN", 70, 156, "#920010");
    this.knopf("ABLEHNEN", 190, 156, false);
    this.hits = [];
    this.hit(70, 156, 57, 13, () =>
      this.fragZahlen(
        "KREDIT GEBEN",
        [
          { label: toGame(T("ui.kreditanfrage", 0)), wert: 12, max: 2 },
          { label: toGame(T("ui.askloan", 2)), wert: LOAN_RATE_MIN, max: 2 },
        ],
        ([months, rate]) => void this.post("api/loan/answer", { manager: this.manager, player: this.player, borrower: q.borrower, accept: true, months, rate }),
        "GEBEN",
      ),
    );
    this.hit(190, 156, 57, 13, () => void this.post("api/loan/answer", { manager: this.manager, player: this.player, borrower: q.borrower, accept: false }));
    this.hit(0, 0, W, H, () => undefined);
    return true;
  }

  /**
   * Gegenwehr beim Abwerben (Version 2026): Läuft ein Versuch gegen einen eigenen Spieler, steht
   * die Anfrage im Hauptmenü. Eine Gehaltserhöhung senkt die Zustimmung um ebenso viele Punkte
   * und bleibt danach stehen - sie kostet also auch dann, wenn der Spieler trotzdem geht.
   */
  drawAbwerbeAnfrage(): void {
    const g = this.game;
    const q = this.server.extra?.poachRequests?.find((r) => r.owner === this.manager);
    if (!g || !q) return;
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    panel(ctx, 45, 104, 230, 80, "#610010");
    this.hits = []; // Kasten schirmt den Bildschirm darunter ab (GitLab #46)
    f.drawCenter(ctx, "ABWERBEVERSUCH", 159, 108, "#d3c3b2", false);
    hline(ctx, 47, 117, 226, "#d3c3b2");
    const werber = toGame(g.managers.at(q.poacher).displayName);
    s.drawCenter(ctx, `${werber} WILL IHNEN`, 159, 122, "#b2a282", false);
    s.drawCenter(ctx, `${cp437ToGame(q.name)} ABWERBEN (${dm(poachAmount(g, q.owner, q.place, q.bonus))})`, 159, 130, "#b2a282", false);
    const chance = (counter: number) => poachChance(g, q.poacher, q.owner, q.place, q.bonus, counter);
    s.drawCenter(ctx, `ZUSTIMMUNG OHNE GEGENWEHR: ${chance(0)} %`, 159, 140, "#b2a282", false);
    const l = g.lineups.at(q.owner * 25 + q.place);
    const gehalt = l.isEmpty ? 0 : l.i32(40);
    const stufen: [string, number][] = [["NICHTS TUN", 0], ["+20% GEHALT", 20], [`+${POACH_COUNTER_MAX}% GEHALT`, POACH_COUNTER_MAX]];
    stufen.forEach(([label, counter], i) => {
      const x = 50 + 75 * i;
      this.knopf(label, x, 152, counter === 0 ? false : "#920010");
      s.draw(ctx, `${chance(counter)}%`, x + 20, 168, "#b2a282", false);
      if (counter > 0) s.draw(ctx, dm(Math.trunc((gehalt * (100 + counter)) / 100)).replace(" DM", ""), x + 2, 175, "#b2a282", false);
      this.hit(x, 152, 57, 13, () => void this.post("api/poach/answer", { manager: this.manager, player: this.player, playerIndex: q.playerIndex, counter }));
    });
    this.hits = this.hits.slice(-3);
    this.hit(0, 0, W, H, () => undefined);
    this.hit(0, 0, W, H, () => undefined);
  }

  /**
   * Rückfrage "Möchten Sie das Spiel wirklich beenden ?" (Original 0x0A7DD, im Hauptmenü mit der
   * rechten Maustaste auf das Managersymbol rechts unten). Im Original beendet LEIDER JA das
   * Programm; hier steigt nur dieser Manager aus und der Rechner führt seinen Verein weiter.
   *
   * Am Original vermessen: Kasten (75,110) 156x66 in Palettenfarbe 16, der Managername in der
   * normalen Schrift mittig bei y 113 in Farbe 11, Trennstriche bei y 121 und 155 von x 77 über
   * 152 Punkte, die drei Zeilen der Frage in der kleinen Schrift ab y 127 im Abstand 8 in Farbe
   * 24, die Knöpfe bei (89,160) und (159,160); "LEIDER JA" steht in Farbe 17.
   */
  drawEndeDialog(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    panel(ctx, 75, 110, 156, 66, "#610010");
    f.drawCenter(ctx, toGame(g.managers.at(this.manager).displayName), 154, 113, "#d3c3b2", false);
    hline(ctx, 77, 121, 152, "#d3c3b2");
    hline(ctx, 77, 155, 152, "#d3c3b2");
    [T("ui.endedialog", 2), T("ui.endedialog", 0), T("ui.endedialog", 3)].forEach((t, i) => s.drawCenter(ctx, t, 154, 127 + 8 * i, "#b2a282", false));
    this.knopf(T("ui.endedialog", 4), 89, 160, "#920010");
    this.knopf(T("ui.endedialog", 1), 159, 160, false);
    // Der Kasten liegt über allem: die Treffer des Menüs darunter zählen nicht mehr
    this.hits = [];
    this.hit(89, 160, 57, 12, () => {
      this.endeDialog = false;
      void this.post("api/quit", { manager: this.manager, player: this.player }).then(() => this.go("seat"));
    });
    this.hit(159, 160, 57, 12, () => (this.endeDialog = false));
    this.hit(0, 0, W, H, () => undefined);
  }

  /**
   * Meldungen zum Zugbeginn (Verletzungen, Randale, Vertragswünsche). Das Original zeigt sie im
   * Hauptmenü anstelle der neun Untermenüfelder: drei Kästen bei (57, 112 + 41·i), 187x41, mit
   * dunklem Rahmen, hellem Rand oben und links und grauer Füllung (Farbe 4). Darin bis zu vier
   * Zeilen mittig bei x 150 - das Datum bei y + 4 in Farbe 25, die Meldung ab y + 14 im Abstand
   * 8 in Farbe 24, beide mit schwarzem Schatten ein Pixel rechts. Rechts daneben bei x 244 die
   * Knöpfe Pfeil hoch, X (schließt) und Pfeil runter, je 19x41.
   */
  drawMeldungen(): boolean {
    if (!this.save) return false;
    const alle = this.save.messages().filter((m) => m.manager === this.manager);
    if (alle.length === 0) {
      this.msgTop = 0;
      return false;
    }
    const ctx = this.ctx;
    const f = this.assets.font;
    const top = Math.max(0, Math.min(this.msgTop, alle.length - 1));
    const zeige = alle.slice(top, top + 3);
    zeige.forEach((m, i) => {
      const y0 = 112 + 41 * i;
      ctx.fillStyle = "#616182";
      ctx.fillRect(57, y0, 187, 41);
      ctx.fillStyle = "#303051";
      if (i === 0) ctx.fillRect(57, y0, 187, 1);
      ctx.fillRect(57, y0, 1, 41);
      ctx.fillRect(243, y0 + 2, 1, 39);
      ctx.fillRect(59, y0 + 40, 185, 1);
      ctx.fillStyle = "#a2a2c3";
      ctx.fillRect(58, y0 + 1, 185, 1);
      ctx.fillRect(58, y0 + 1, 1, 39);
      ctx.fillStyle = "#8282a2";
      ctx.fillRect(243, y0 + 1, 1, 1);
      const zeilen = m.text.split("^").filter((l) => l.trim() !== "");
      // Version 2026: die Frage "Bieten Sie mit?" ist nicht nur Text - der Kasten führt in den
      // Transfermarkt zu dem Spieler, um den gerade geboten wird (#19)
      const gebot = zeilen.some((l) => dosText(l).trim() === "Bieten Sie mit?");
      zeilen.slice(0, 4).forEach((line, k) => {
        const t = toGame(dosText(line));
        const x = 151 - Math.trunc(f.width(t) / 2);
        const y = k === 0 ? y0 + 4 : y0 + 14 + 8 * (k - 1);
        f.draw(ctx, t, x + 1, y, COLORS.black, false);
        const aktion = gebot && dosText(line).trim() === "Bieten Sie mit?";
        f.draw(ctx, t, x, y, k === 0 ? "#928251" : aktion ? COLORS.highlight : "#b2a271", false);
      });
      if (gebot) this.hit(57, y0, 186, 41, () => this.mitbieten(zeilen));
    });
    const pfeile = this.assets.img("menu-scroll");
    for (let i = 0; i < 3; i++) {
      if (pfeile) ctx.drawImage(pfeile, 0, 41 * i, 19, 41, 244, 112 + 41 * i, 19, 41);
      this.hit(244, 112 + 41 * i, 19, 41, () => {
        if (i === 0) this.msgTop = Math.max(0, top - 1);
        else if (i === 2) this.msgTop = Math.min(Math.max(0, alle.length - 1), top + 1);
        else if (this.online) void this.post("api/messages/clear", { manager: this.manager, player: this.player });
        else this.msgTop = 0;
      });
    }
    return true;
  }

  /**
   * Bietgefecht (Version 2026): Klick auf die Meldung "... bietet auf ... Bieten Sie mit?" führt
   * in den Transfermarkt und wählt den Spieler aus, um den geboten wird. Der Name steht in der
   * dritten Zeile der Meldung; ist der Spieler nicht mehr auf dem Markt, sagt das ein Hinweis.
   */
  mitbieten(zeilen: string[]): void {
    const name = dosText(zeilen[2] ?? "").replace(/\.$/, "").trim().toUpperCase();
    const entries = this.server.market?.entries ?? [];
    const i = entries.findIndex((e) => dosText(e.name).trim().toUpperCase() === name);
    if (i < 0) {
      this.hinweis = [name, "IST NICHT MEHR AUF DEM MARKT"];
      return;
    }
    this.marketSel = i;
    this.marketMode = "kaufen";
    this.go("market");
  }

  nextManager(): void {
    if (!this.save) return;
    if (this.online) {
      this.go("seat");
      return;
    }
    this.manager = (this.manager + 1) % this.save.managerCount;
    this.status = "Manager gewechselt: " + this.game!.managers.at(this.manager).displayName;
  }

  /**
   * Symbolrahmen (0x06D17): das Original blittet das Bild PIC/24.VGA (50x41) auf den Knopfpunkt
   * und legt das Symbol in das schwarze Innenfeld (8,8) bis (41,32). Der hier übergebene Punkt
   * ist wie bisher der des Innenfelds minus (6,5), der Rahmen beginnt also zwei Pixel links und
   * drei darüber.
   */
  iconFrame(x: number, y: number, gedrueckt = false): void {
    const ctx = this.ctx;
    const frame = this.assets.img(gedrueckt ? "25.VGA" : "24.VGA");
    if (frame) ctx.drawImage(frame, x - 2, y - 3);
    else {
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(x + 6, y + 5, 34, 25);
    }
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x + 7, y + 6, 32, 23);
  }

  /**
   * Schaltfläche des Originals (0x31B4D): schwarzes Feld von (x,y) bis (x+56, y+11) mit hellem
   * Rand links und oben und dunklem rechts und unten; die Beschriftung steht in kleiner Schrift
   * bei x + 1 + (57 - Breite)/2 und y + 4, rot wenn gewählt, sonst hell.
   */
  /**
   * Medizinische Versorgung (Version 2026, GitLab #2): alle verletzten Spieler des eigenen
   * Kaders mit Art der Verletzung, Restwochen, Behandlungsstufe und Wochenkosten. Ein Klick
   * auf die Zeile schaltet die Stufe weiter; gebucht wird die Woche im Tageswechsel.
   */
  drawMedizin(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    const INK = "#a2a2c3";
    panel(ctx, 2, 4, 316, 232);
    f.drawCenter(ctx, "MEDIZINISCHE VERSORGUNG", 134, 8, COLORS.white);
    // Zwei Ansichten: die Behandlung der Verletzten und die Dopingkur (#3)
    this.knopf("ARZT", 8, 18, this.medView === "arzt");
    this.knopf("DOPING", 70, 18, this.medView === "doping");
    this.hit(8, 18, 57, 13, () => (this.medView = "arzt"));
    this.hit(70, 18, 57, 13, () => (this.medView = "doping"));
    if (this.medView === "doping") {
      this.drawDoping();
      return;
    }
    const zeilen = medRows(g, me);
    const hy = 38;
    s.draw(ctx, "NAME", 8, hy, COLORS.white);
    s.draw(ctx, "VERLETZUNG", 76, hy, COLORS.white);
    s.drawRight(ctx, "WOCHEN", 180, hy, COLORS.white);
    s.draw(ctx, "BEHANDLUNG", 188, hy, COLORS.white);
    s.drawRight(ctx, "DM/WOCHE", 310, hy, COLORS.white);
    hline(ctx, 8, hy + 8, 302);
    if (zeilen.length === 0) s.drawCenter(ctx, "KEIN SPIELER VERLETZT", 134, 70, COLORS.textDim);
    let y = 50;
    for (const z of zeilen) {
      const gewaehlt = z.place === this.medPlace;
      if (gewaehlt) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(6, y - 1, 306, 7);
      }
      const sch = !gewaehlt;
      const c = gewaehlt ? COLORS.black : z.level > 0 ? COLORS.white : COLORS.text;
      s.draw(ctx, toGame(z.name).slice(0, 16), 8, y, c, sch);
      s.draw(ctx, toGame(injuries()[z.kind]?.name ?? "?"), 76, y, c, sch);
      s.drawRight(ctx, String(z.weeks), 180, y, c, sch);
      s.draw(ctx, MED_LEVELS[z.level].name, 188, y, c, sch);
      s.drawRight(ctx, z.weeks > z.floor ? dm(MED_LEVELS[z.level].cost).replace(" DM", "") : "-", 310, y, c, sch);
      const pl = z.place;
      const stufe = z.level;
      this.hit(6, y - 1, 306, 7, () => {
        this.medPlace = pl;
        const neu = (stufe + 1) % MED_LEVELS.length;
        void this.post("api/medizin", { manager: me, player: this.player, place: pl, level: neu });
      });
      y += 7;
    }
    hline(ctx, 8, 190, 302);
    s.draw(ctx, "ZEILE ANKLICKEN SCHALTET DIE BEHANDLUNG WEITER.", 8, 196, COLORS.textDim);
    s.draw(ctx, "JE WOCHE WIRD GEW]RFELT, OB SIE ANSCHL[GT; SIE NIMMT DANN", 8, 204, COLORS.textDim);
    s.draw(ctx, "EINEN TEIL DER RESTZEIT, MINDESTENS EINE WOCHE.", 8, 212, COLORS.textDim);
    f.draw(ctx, `Kontostand: ${dm(g.managers.at(me).balance)}`, 8, 224, COLORS.white, false);
    const woche = medCost(g, me);
    // Über der Trennlinie, denn unten rechts sitzt der Symbolknopf und links der Kontostand
    if (woche > 0) s.drawRight(ctx, toGame(`BEHANDLUNG JE WOCHE ${dm(woche)}`), 310, 182, INK);
    this.sideButtons();
  }

  /**
   * Dopingansicht des Arztbildschirms (Version 2026, GitLab #3): der ganze Kader mit Stärke,
   * Einsätzen unter Doping, Risiko des nächsten Einsatzes und Zustand. Ein Klick schaltet die
   * Kur an oder ab; beim Anschalten fragt das Spiel nach und nennt das Risiko.
   */
  drawDoping(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    const hy = 38;
    s.draw(ctx, "NAME", 8, hy, COLORS.white);
    s.drawRight(ctx, "ST", 110, hy, COLORS.white);
    s.drawRight(ctx, "EINS[TZE", 168, hy, COLORS.white);
    s.drawRight(ctx, "RISIKO", 210, hy, COLORS.white);
    s.draw(ctx, "ZUSTAND", 220, hy, COLORS.white);
    hline(ctx, 8, hy + 8, 302);
    let y = 50;
    for (let place = 0; place < 25; place++) {
      const l = g.lineups.at(me * 25 + place);
      if (l.isEmpty) continue;
      const p = g.players.at(l.playerIndex);
      const kur = isDoped(l);
      const gesperrt = isDopeBanned(l);
      const gewaehlt = place === this.medPlace;
      if (gewaehlt) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(6, y - 1, 306, 7);
      }
      const sch = !gewaehlt;
      const c = gewaehlt ? COLORS.black : gesperrt ? COLORS.red : kur ? "#71a241" : (l.u8(9) & 3) !== 0 ? COLORS.textDim : COLORS.text;
      s.draw(ctx, cp437ToGame(p.name), 8, y, c, sch);
      s.drawRight(ctx, String(l.overall), 110, y, c, sch);
      s.drawRight(ctx, kur ? String(dopeApps(l)) : "-", 168, y, c, sch);
      s.drawRight(ctx, kur ? `${dopingRisk(dopeApps(l))}%` : "-", 210, y, c, sch);
      const zustand = gesperrt ? `GESPERRT, NOCH ${l.u8(13)} WOCHEN` : kur ? `KUR L[UFT (+${dopeBonus(l)})` : (l.u8(9) & 3) !== 0 ? "NICHT EINSATZF[HIG" : "";
      s.draw(ctx, zustand, 220, y, c, sch);
      const pl = place;
      this.hit(6, y - 1, 306, 7, () => {
        this.medPlace = pl;
        if (gesperrt) return;
        if ((l.u8(9) & 3) !== 0) return;
        if (kur) {
          void this.post("api/doping", { manager: me, player: this.player, place: pl, on: false });
          return;
        }
        this.fragJaNein(
          [
            `${cp437ToGame(p.name)} DOPEN?`,
            `KONDITION UND TECHNIK +${DOPING_BONUS}, FRISCHE +${DOPING_FRESH}.`,
            `SCHON DER ERSTE EINSATZ FLIEGT MIT ${dopingRisk(0)}% AUF,`,
            `JEDER WEITERE IST RISKANTER.`,
            `WER AUFFLIEGT: ${DOPING_BAN[0]} BIS ${DOPING_BAN[1]} WOCHEN SPERRE UND`,
            toGame(`${dm(dopingFine(g.managers.at(me).balance))} STRAFE (${DOPING_FINE_PERCENT}% VOM VERM|GEN).`),
          ],
          () => void this.post("api/doping", { manager: me, player: this.player, place: pl, on: true }),
        );
      });
      y += 7;
    }
    hline(ctx, 8, 190, 302);
    s.draw(ctx, "ZEILE ANKLICKEN: KUR AN ODER AUS. DIE WERTE STEIGEN SOFORT.", 8, 196, COLORS.textDim);
    s.draw(ctx, "NACH JEDEM EINSATZ WIRD GEPR]FT - DAS RISIKO STEIGT MIT JEDEM.", 8, 204, COLORS.textDim);
    s.draw(ctx, toGame(`WER AUFFLIEGT: ${DOPING_BAN[0]} BIS ${DOPING_BAN[1]} WOCHEN SPERRE, ${dm(dopingFine(g.managers.at(me).balance))} STRAFE.`), 8, 212, COLORS.textDim);
    f.draw(ctx, `Kontostand: ${dm(g.managers.at(me).balance)}`, 8, 224, COLORS.white, false);
    const laufend = dopingRows(g, me).filter((r) => r.state === "kur").length;
    // Höchstens drei Kuren gleichzeitig (GitLab #48) - die Zahl steht mit dabei
    if (laufend > 0) s.drawRight(ctx, toGame(`${laufend}/${DOPING_MAX_CURES} ${laufend === 1 ? "KUR L[UFT" : "KUREN LAUFEN"}`), 310, 182, COLORS.red);
    this.sideButtons();
  }

  /** Jugendbildschirm öffnen; beim ersten Mal legt der Server die Mannschaften an. */
  async jugendOeffnen(): Promise<void> {
    if (this.game && !jugendVorhanden(this.game)) await this.post("api/jugend", { manager: this.manager, player: this.player, was: "anlegen" });
    this.jugendPlatz = -1;
    this.go("jugend");
  }

  /**
   * Jugendarbeit (Version 2026, GitLab #4): drei Mannschaften, je zwölf Plätze. Die Liste zeigt
   * Alter, Position, Stärke, Förderung und den Verlauf der letzten vier Saisons - dafür ist der
   * Bildschirm da: man soll die Entwicklung sehen.
   */
  drawJugend(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    panel(ctx, 2, 4, 316, 232);
    f.drawCenter(ctx, "JUGENDARBEIT", 134, 8, COLORS.white);
    JUGEND_NAMEN.forEach((name, t) => {
      const x = 8 + 62 * t;
      this.knopf(name, x, 18, this.jugendTeam === t);
      this.hit(x, 18, 57, 13, () => {
        this.jugendTeam = t;
        this.jugendPlatz = -1;
        this.jugendMeldung = "";
      });
    });
    const alter = JUGEND_ALTER[this.jugendTeam];
    s.drawRight(ctx, toGame(`${alter[0]} UND ${alter[1]} JAHRE`), 310, 20, COLORS.textDim);
    const daten = jugendLesen(g);
    const team = daten[me]?.[this.jugendTeam] ?? [];
    // Ein Trainer schafft nicht zwölf: höchstens vier je Mannschaft stehen in der Förderung
    const inFoerderung = team.filter(wirdGefoerdert).length;
    const voll = inFoerderung >= JUGEND_MAX_FOERDERUNG;
    s.drawRight(ctx, toGame(`IN F\RDERUNG ${inFoerderung} VON ${JUGEND_MAX_FOERDERUNG}`), 310, 28, voll ? COLORS.red : COLORS.text);
    const hy = 38;
    s.draw(ctx, "NAME", 8, hy, COLORS.white);
    s.draw(ctx, "ALT", 78, hy, COLORS.white);
    s.draw(ctx, "POS", 96, hy, COLORS.white);
    s.drawRight(ctx, "ST", 130, hy, COLORS.white);
    s.draw(ctx, "VERLAUF", 136, hy, COLORS.white);
    s.draw(ctx, "GELD", 176, hy, COLORS.white);
    s.draw(ctx, "TRAINING", 208, hy, COLORS.white);
    s.drawRight(ctx, "RISIKO", 284, hy, COLORS.white);
    hline(ctx, 8, hy + 8, 302);
    // Die Liste steht nach Mannschaftsteilen: Tor, Abwehr, Mittelfeld, Sturm
    const gruppe = (art: number) => (art === 0 ? 0 : art <= 2 ? 1 : art <= 4 ? 2 : 3);
    const kuerzel = ["TOR", "ABW", "MIT", "ANG"];
    const zeilen = team
      .map((spieler, platz) => ({ spieler, platz }))
      .filter((x) => x.spieler.name !== "")
      .sort((a, b) => gruppe(a.spieler.art) - gruppe(b.spieler.art) || jugendStaerke(b.spieler) - jugendStaerke(a.spieler));
    let y = 50;
    for (const { spieler, platz } of zeilen) {
      const gewaehlt = platz === this.jugendPlatz;
      const reif = istReif(spieler, this.jugendTeam);
      if (gewaehlt) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(6, y - 1, 306, 7);
      }
      const sch = !gewaehlt;
      const c = gewaehlt ? COLORS.black : reif ? "#71a241" : spieler.foerderung ? COLORS.white : COLORS.text;
      const st = jugendStaerke(spieler);
      // Hinter dem Namen steht, aus welcher Jugend er aufgerückt ist: (C) in der B-Jugend,
      // (B) in der A-Jugend; ein Neuzugang bekommt nichts
      const her = jugendHerkunft(spieler);
      s.draw(ctx, toGame(her ? `${spieler.name} (${her})` : spieler.name), 8, y, c, sch);
      s.draw(ctx, String(spieler.alter), 78, y, c, sch);
      s.draw(ctx, kuerzel[gruppe(spieler.art)], 96, y, c, sch);
      s.drawRight(ctx, String(st), 130, y, c, sch);
      const verlauf = [...spieler.verlauf.slice(1), st];
      ctx.fillStyle = gewaehlt ? COLORS.black : "#303051";
      ctx.fillRect(136, y + 5, 15, 1);
      verlauf.forEach((v, i) => {
        if (v <= 0) return;
        const h = Math.max(1, Math.round((v / 60) * 6));
        ctx.fillStyle = gewaehlt ? COLORS.black : i === verlauf.length - 1 ? "#71a241" : "#8282a2";
        ctx.fillRect(136 + i * 4, y + 5 - h, 3, h);
      });
      s.draw(ctx, spieler.foerderung ? "JA" : "-", 176, y, c, sch);
      s.draw(ctx, JUGEND_TRAINING[spieler.training]?.name ?? "KEINS", 208, y, c, sch);
      const risiko = jugendRisiko(spieler);
      s.drawRight(ctx, risiko > 0 ? `${risiko}%` : "-", 284, y, gewaehlt ? COLORS.black : risiko >= 10 ? COLORS.red : c, sch);
      if (reif) s.draw(ctx, "REIF", 290, y, gewaehlt ? COLORS.black : "#71a241", sch);
      const pl = platz;
      this.hit(6, y - 1, 306, 7, () => {
        this.jugendPlatz = pl;
        this.jugendMeldung = "";
      });
      y += 7;
    }
    if (zeilen.length === 0) s.drawCenter(ctx, "KEINE SPIELER", 134, 70, COLORS.textDim);
    // Schalter für den gewählten Spieler
    const gewaehlt = team[this.jugendPlatz];
    const knopf = (label: string, x: number, breite: number, tun: () => void, aktiv = false) => {
      this.knopf(label, x, 168, aktiv, breite);
      this.hit(x, 168, breite, 13, tun);
    };
    if (gewaehlt && gewaehlt.name !== "") {
      // Der Server lehnt ab, wenn die vier Plätze belegt sind - die Antwort kommt in die
      // Meldungszeile, sonst bliebe der Knopf wirkungslos ohne Erklärung
      const stellen = (was: Record<string, unknown>) => {
        void this.post("api/jugend", { manager: me, player: this.player, was: "foerdern", team: this.jugendTeam, platz: this.jugendPlatz, ...was }).then((a) => {
          this.jugendMeldung = a.ok ? "" : (a.message ?? "").toUpperCase();
          this.render();
        });
      };
      knopf(gewaehlt.foerderung ? "GELD AUS" : "GELD AN", 8, 60, () => stellen({ geld: !gewaehlt.foerderung }), gewaehlt.foerderung);
      knopf(`TRAINING: ${JUGEND_TRAINING[gewaehlt.training]?.name ?? "KEINS"}`, 72, 100, () => stellen({ training: (gewaehlt.training + 1) % JUGEND_TRAINING.length }), gewaehlt.training > 0);
      // Zwischen dem Trainingsknopf (bis x 172) und AUFR]CKEN (ab x 248) bleiben nur rund 70
      // Punkte: die beiden Werte stehen deshalb untereinander
      s.draw(ctx, toGame(`CHANCE ${jugendChance(gewaehlt)}%`), 178, 168, COLORS.textDim);
      s.draw(ctx, toGame(`SPRUNG ${jugendSprung(gewaehlt)}%`), 178, 176, COLORS.textDim);
      if (istReif(gewaehlt, this.jugendTeam)) {
        knopf("AUFR]CKEN", 248, 64, () => {
          void this.post("api/jugend", { manager: me, player: this.player, was: "aufruecken", platz: this.jugendPlatz }).then((a) => {
            this.jugendMeldung = a.ok ? "AUFGER]CKT - DIE ANDEREN D]RFEN IHN HEUTE ABWERBEN" : (a.message ?? "").toUpperCase();
            this.jugendPlatz = -1;
            this.render();
          });
        }, true);
      }
    } else s.draw(ctx, "SPIELER ANKLICKEN", 8, 172, COLORS.textDim);
    hline(ctx, 8, 186, 302);
    // Ab y 196 steht rechts der Knopf HAUPT MENU (sideButtons, x 270..316): die Hinweiszeilen
    // müssen vor x 262 enden, sonst laufen sie darunter durch
    const text = this.jugendMeldung || "GELD BEZAHLT BETREUUNG, TRAINING TREIBT AN.";
    s.draw(ctx, toGame(text).slice(0, 58), 8, 192, this.jugendMeldung ? COLORS.white : COLORS.textDim);
    if (!this.jugendMeldung) {
      s.draw(ctx, toGame("NUR BEIDES ZUSAMMEN L[SST EIN TALENT WACHSEN -"), 8, 200, COLORS.textDim);
      // Die Grenze steht schon oben rechts ("IN F\RDERUNG n VON 4"); hier ist kein Platz mehr,
      // rechts daneben sitzt der Aufrückerzähler
      s.draw(ctx, toGame("WER ZU VIEL VERLANGT, VERLIERT DEN SPIELER."), 8, 208, COLORS.textDim);
    }
    f.draw(ctx, `Kontostand: ${dm(g.managers.at(me).balance)}`, 8, 220, COLORS.white, false);
    const kosten = jugendKosten(g, me);
    s.drawRight(ctx, toGame(`AUFR]CKER ${aufruecker(g, me)} VON ${JUGEND_MAX_AUFRUECKER}`), 262, 208, COLORS.textDim);
    // Über der Knopfreihe, sonst läuft die Zeile unter AUFR]CKEN durch
    if (kosten > 0) s.drawRight(ctx, toGame(`F\\RDERUNG JE MONAT ${dm(kosten)}`), 310, 156, COLORS.red);
    this.sideButtons();
  }

  // ---- Torszenen-Editor (GitLab #6, Stufe 2) -------------------------------------------

  /** Leere Szene zum Anfangen: zwei Figuren und ein Ball, damit sofort etwas zu sehen ist. */
  neueBeschreibung(): Beschreibung {
    return {
      name: "neu",
      autor: this.player ?? "REMAKE",
      bilder: 40,
      // Klangmarken wie im Original: digi1 ist der Torjubel (0x0C7C4)
      klaenge: [35, null, null, null],
      kamera: { art: "folgt", wem: "ball", ab: 4 },
      figuren: [
        { name: "schuetze", sprite: 3, pos: [80, 56], bahn: [{ art: "lauf", bis: 24, nach: [200, 52], phasen: [5, 4, 3] }] },
        { name: "torwart", sprite: 90, pos: [292, 48], bahn: [{ art: "halt", bis: 24 }, { art: "lauf", bis: 32, nach: [286, 56], phasen: [90, 91], takt: 3 }, { art: "halt", bis: 39 }] },
        // Der Ball muss ins Tor: das rechte Tor steht bei x 296..318 und y 19..39 (Sprites werden
        // bei y + 35 gezeichnet). In den Szenen des Originals endet er um (297..314, 21..32).
        { name: "ball", sprite: 142, pos: [86, 62], bahn: [{ art: "folgt", bis: 24, wem: "schuetze", versatz: [6, 6] }, { art: "flug", bis: 34, nach: [303, 26], hoehe: 18, schatten: 145 }] },
      ],
    };
  }

  /** Editor öffnen: die zuletzt gebaute Szene laden, sonst mit einer Vorlage anfangen. */
  async editorStarten(): Promise<void> {
    // Rasen, Sprites und Tore kommen aus demselben Satz wie in der Konferenz; ohne sie bliebe
    // das Spielfeld schwarz (im Testspiel aufgefallen)
    if (!this.scenes.ready) await this.scenes.load("");
    // Angefangen wird mit einer frischen Vorlage. Vorher lud der Editor immer die zuletzt
    // abgelegte Szene - solange es nur das Beispiel gab, kam damit jedes Mal "konter".
    // Gespeicherte Szenen holt man sich mit SZENE >.
    const b = this.neueBeschreibung();
    let namen: string[] = [];
    try {
      const liste = (await (await fetch("api/szene", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ was: "liste" }) })).json()) as { namen?: string[] };
      namen = liste.namen ?? [];
    } catch {
      /* ohne Server gibt es nur die Vorlage */
    }
        // Beim ersten Öffnen steht die Hilfe offen - ohne sie ist nicht zu erraten, dass ein Klick
    // ins Feld ein Schlüsselbild setzt
    this.editor = { b, szene: null, bild: 0, figur: 0, zwiebel: true, laeuft: false, ziehen: null, meldung: "", hilfe: !this.editorGesehen, wieImSpiel: false, namen };
    this.editorGesehen = true;
    this.editorBauen();
    this.go("toreditor");
    this.render();
  }

  /** Die Beschreibung in Bilder übersetzen; Fehler landen in der Meldungszeile. */
  editorBauen(): void {
    const e = this.editor;
    if (!e) return;
    const fehler = pruefeBeschreibung(e.b);
    if (fehler.length) {
      e.szene = null;
      e.meldung = fehler[0].toUpperCase();
      return;
    }
    e.szene = baueSzene(e.b);
    e.bild = Math.max(0, Math.min(e.bild, e.b.bilder - 1));
    if (!e.meldung.startsWith("GESPEICHERT")) e.meldung = "";
  }

  /** Ort einer Figur im aktuellen Bild (aus der gebauten Szene gelesen). */
  editorOrt(i: number): [number, number] | null {
    const e = this.editor;
    if (!e?.szene) return null;
    const bild = e.szene.frames[e.bild];
    if (!bild) return null;
    // Die Einträge stehen in der Reihenfolge der Figuren, Schatten stehen davor
    let k = 0;
    for (let n = 0; n < e.b.figuren.length; n++) {
      const figur = e.b.figuren[n];
      const sichtbar = e.bild >= (figur.ab ?? 0) && (figur.bis === undefined || e.bild <= figur.bis);
      if (!sichtbar) continue;
      const hatSchatten = (figur.bahn ?? []).some((a, j) => a.art === "flug" && a.schatten !== undefined && e.bild > (j === 0 ? 0 : (figur.bahn ?? [])[j - 1].bis) && e.bild <= a.bis);
      if (hatSchatten) k++;
      if (n === i) return [bild[1][k][0], bild[1][k][1]];
      k++;
    }
    return null;
  }

  /**
   * Eine Figur im aktuellen Bild an einen neuen Ort setzen: daraus wird ein Laufabschnitt, der
   * bis zu diesem Bild reicht. Das ist das Schlüsselbild - dazwischen rechnet der Übersetzer.
   */
  editorSetzen(i: number, x: number, y: number): void {
    const e = this.editor;
    if (!e) return;
    const figur = e.b.figuren[i];
    if (!figur) return;
    const bild = Math.max(1, e.bild);
    const bahn = (figur.bahn ?? []).filter((a) => a.bis < bild);
    const alt = (figur.bahn ?? []).find((a) => a.bis >= bild);
    const phasen = alt && alt.art === "lauf" ? alt.phasen : figur.sprite < 59 ? [figur.sprite + 2, figur.sprite + 1, figur.sprite] : undefined;
    bahn.push({ art: "lauf", bis: bild, nach: [Math.round(x), Math.round(y)], phasen });
    for (const a of figur.bahn ?? []) if (a.bis > bild) bahn.push(a);
    figur.bahn = bahn;
    this.editorBauen();
  }

  /** Torszenen-Editor: Spielfeld in ganzer Breite, darunter Zeitleiste und Schalter. */
  drawToreditor(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const e = this.editor;
    if (!e) return;
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(0, 0, W, H);
    const sc = this.scenes;
    // Zwei Ansichten: zum Arbeiten das ganze Feld (nur so lassen sich Figuren außerhalb des
    // späteren Ausschnitts setzen), mit WIE IM SPIEL der Kameraausschnitt der Konferenz
    if (e.wieImSpiel) {
      // Der Ausschnitt ist 182x96 (VIEW) und steht mittig über dem Bedienteil
      if (e.szene) sc.malen(ctx, e.szene as unknown as SceneData, e.bild, false, { x: VIEW.x, y: 8 });
      this.drawEditorTeil(e);
      return;
    }
    if (sc.pitch) ctx.drawImage(sc.pitch, 0, 0);
    const zeichneBild = (nr: number, alpha: number) => {
      if (!e.szene || !sc.sprites || !sc.goals) return;
      const bild = e.szene.frames[Math.max(0, Math.min(nr, e.szene.frames.length - 1))];
      if (!bild) return;
      ctx.globalAlpha = alpha;
      for (const [x, y, id] of bild[1]) {
        if (id >= 1000) {
          if (id === 1000) ctx.drawImage(sc.goals, 0, 0, 24, 20, 0, 54, 24, 20);
          else ctx.drawImage(sc.goals, 24, 0, 22, 20, 296, 54, 22, 20);
          continue;
        }
        const klein = id >= 142;
        const breite = klein ? 4 : 12;
        ctx.drawImage(sc.sprites, (id % 24) * 12 + (klein ? 4 : 0), Math.floor(id / 24) * 11, breite, 11, x, y + 35, breite, 11);
      }
      ctx.globalAlpha = 1;
    };
    if (e.zwiebel && e.bild > 0) zeichneBild(e.bild - 1, 0.35);
    zeichneBild(e.bild, 1);
    // Die gewählte Figur bekommt einen Rahmen und ihren Namen darüber, sonst ist im Gewimmel
    // nicht zu sehen, welche gerade am Zug ist
    const ort = this.editorOrt(e.figur);
    if (ort) {
      ctx.strokeStyle = COLORS.highlight;
      ctx.strokeRect(ort[0] - 1.5, ort[1] + 35 - 1.5, 15, 14);
      const beschriftung = (e.b.figuren[e.figur]?.name ?? "").toUpperCase();
      s.drawCenter(ctx, toGame(beschriftung), Math.max(20, Math.min(300, ort[0] + 7)), Math.max(1, ort[1] + 35 - 9), COLORS.highlight);
    }
    this.drawEditorTeil(e);
  }

  /** Bedienteil des Editors: Zeitleiste, Figurenzeile, Schalter und Hinweise. */
  drawEditorTeil(e: NonNullable<typeof this.editor>): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const sc = this.scenes;
    panel(ctx, 0, 114, 320, 126);
    s.drawRight(ctx, toGame(`BILD ${e.bild + 1} VON ${e.b.bilder}`), 314, 120, COLORS.white);
    // Zeitleiste
    const leiste = { x: 6, y: 132, w: 308, h: 7 };
    ctx.fillStyle = "#303051";
    ctx.fillRect(leiste.x, leiste.y, leiste.w, leiste.h);
    const pos = (nr: number) => leiste.x + Math.round((leiste.w - 2) * (nr / Math.max(1, e.b.bilder - 1)));
    // Schlüsselbilder der gewählten Figur eintragen
    ctx.fillStyle = "#616182";
    for (const a of e.b.figuren[e.figur]?.bahn ?? []) ctx.fillRect(pos(a.bis), leiste.y, 2, leiste.h);
    ctx.fillStyle = COLORS.highlight;
    ctx.fillRect(pos(e.bild), leiste.y - 2, 2, leiste.h + 4);
    this.hit(leiste.x, leiste.y - 3, leiste.w, leiste.h + 6, (cx) => {
      e.laeuft = false;
      e.bild = Math.max(0, Math.min(e.b.bilder - 1, Math.round(((cx - leiste.x) / (leiste.w - 2)) * (e.b.bilder - 1))));
    });
    // Figurenzeile
    const figur = e.b.figuren[e.figur];
    s.draw(ctx, toGame(`FIGUR ${e.figur + 1} VON ${e.b.figuren.length}: ${(figur?.name ?? "").toUpperCase()}`), 6, 144, COLORS.highlight);
    // Das Aussehen als Nummer allein sagt niemandem etwas: das Sprite steht daneben
    s.drawRight(ctx, toGame(`AUSSEHEN ${figur?.sprite ?? 0}`), 300, 144, COLORS.text);
    if (sc.sprites && figur) {
      const klein = figur.sprite >= 142;
      ctx.drawImage(sc.sprites, (figur.sprite % 24) * 12 + (klein ? 4 : 0), Math.floor(figur.sprite / 24) * 11, klein ? 4 : 12, 11, 304, 142, klein ? 4 : 12, 11);
    }
    // Schalter
    const knopf = (label: string, x: number, y: number, breite: number, tun: () => void, aktiv = false) => {
      this.knopf(label, x, y, aktiv, breite);
      this.hit(x, y, breite, 13, tun);
    };
    knopf("<<", 6, 152, 30, () => { e.laeuft = false; e.bild = 0; });
    knopf("<", 40, 152, 30, () => { e.laeuft = false; e.bild = Math.max(0, e.bild - 1); });
    knopf(e.laeuft ? "HALT" : "SPIEL", 74, 152, 40, () => {
      e.laeuft = !e.laeuft;
      if (e.laeuft) this.editorAbspielen();
    });
    knopf(">", 118, 152, 30, () => { e.laeuft = false; e.bild = Math.min(e.b.bilder - 1, e.bild + 1); });
    knopf(">>", 152, 152, 30, () => { e.laeuft = false; e.bild = e.b.bilder - 1; });
    knopf("ZWIEBEL", 190, 152, 60, () => (e.zwiebel = !e.zwiebel), e.zwiebel);
    knopf("FIGUR >", 254, 152, 60, () => (e.figur = (e.figur + 1) % Math.max(1, e.b.figuren.length)));
    knopf("AUSSEHEN -", 6, 170, 60, () => { if (figur) { figur.sprite = Math.max(0, figur.sprite - 1); this.editorBauen(); } });
    knopf("AUSSEHEN +", 70, 170, 60, () => { if (figur) { figur.sprite = Math.min(SZENE_GRENZEN.sprite, figur.sprite + 1); this.editorBauen(); } });
    // "BILD" hieß hier die Gesamtzahl und oben rechts das laufende Bild - das war nicht zu
    // unterscheiden, deshalb jetzt L[NGE
    knopf("L[NGE -", 134, 170, 50, () => { e.b.bilder = Math.max(2, e.b.bilder - 4); this.editorBauen(); });
    knopf("L[NGE +", 188, 170, 50, () => { e.b.bilder = Math.min(SZENE_GRENZEN.bilder, e.b.bilder + 4); this.editorBauen(); });
    knopf("MARKE WEG", 242, 170, 72, () => {
      if (!figur) return;
      figur.bahn = (figur.bahn ?? []).filter((a) => a.bis !== Math.max(1, e.bild));
      this.editorBauen();
    });
    knopf("+ FIGUR", 6, 188, 52, () => {
      const n = e.b.figuren.length + 1;
      e.b.figuren.push({ name: `figur${n}`, sprite: 3, pos: [40, 50], bahn: [{ art: "halt", bis: e.b.bilder - 1 }] });
      e.figur = e.b.figuren.length - 1;
      this.editorBauen();
    });
    knopf("- FIGUR", 62, 188, 52, () => {
      if (e.b.figuren.length <= 1) return;
      e.b.figuren.splice(e.figur, 1);
      e.figur = Math.max(0, e.figur - 1);
      this.editorBauen();
    });
    knopf("NAME", 118, 188, 44, () => {
      this.fragZahl("NAME DER SZENE", "NUMMER", 1, 3, (nr) => {
        e.b.name = `eigen${nr}`;
        this.editorBauen();
      });
    });
    knopf("HILFE", 166, 188, 44, () => (e.hilfe = true), e.hilfe);
    // Rechts ab x 268 sitzt der Symbolknopf, der Schalter endet davor
    knopf("SPEICHERN", 214, 188, 50, () => void this.editorSpeichern(), true);
    // Vierte Reihe: Ansicht und Szenenwahl
    knopf("WIE IM SPIEL", 6, 204, 70, () => {
      e.wieImSpiel = !e.wieImSpiel;
      e.meldung = e.wieImSpiel ? "AUSSCHNITT UND KL[NGE WIE IN DER KONFERENZ" : "";
    }, e.wieImSpiel);
    knopf("NEU", 80, 204, 40, () => {
      e.b = this.neueBeschreibung();
      e.figur = 0;
      e.bild = 0;
      e.meldung = "";
      this.editorBauen();
    });
    knopf(e.namen.length ? "SZENE >" : "KEINE", 124, 204, 52, () => {
      if (e.namen.length) void this.editorNaechsteSzene();
    });
    // Hinweiszeile: sie sagt, was der nächste Klick ins Feld bewirkt
    const fehler = pruefeBeschreibung(e.b);
    const wer = (figur?.name ?? "").toUpperCase();
    const marken = (e.b.figuren[e.figur]?.bahn ?? []).length;
    const text =
      e.meldung ||
      (fehler.length
        ? fehler[0].toUpperCase()
        : e.wieImSpiel
          ? "ZUM SETZEN ZUR]CK AUF DAS GANZE FELD SCHALTEN"
          : `KLICK INS FELD: ${wer} STEHT BEI BILD ${e.bild + 1} DORT`);
    s.draw(ctx, toGame(text).slice(0, 62), 6, 220, fehler.length ? COLORS.red : COLORS.text);
    s.drawRight(ctx, toGame(`${e.b.figuren.length} FIGUREN, ${marken} MARKEN`), 262, 204, COLORS.textDim);
    f.draw(ctx, toGame(`Szene: ${e.b.name}`), 6, 118, COLORS.white, false);
    // Klick ins Spielfeld: trifft er eine andere Figur, wählt er sie aus - sonst setzt er die
    // gewählte an diese Stelle. Ohne das Auswählen per Klick müsste man sich durchschalten.
    // Im Ausschnitt der Konferenz geht das nicht: dort stimmen die Koordinaten nicht überein.
    if (!e.wieImSpiel)
      this.hit(0, 0, 320, 112, (cx, cy) => {
        const treffer = e.b.figuren.findIndex((_, i) => {
          if (i === e.figur) return false;
          const o = this.editorOrt(i);
          return o !== null && cx >= o[0] - 2 && cx <= o[0] + 14 && cy >= o[1] + 33 && cy <= o[1] + 48;
        });
        if (treffer >= 0) {
          e.figur = treffer;
          return;
        }
        this.editorSetzen(e.figur, cx, cy - 35);
      });
    this.sideButtons();
    if (e.hilfe) this.drawEditorHilfe();
  }

  /** Die nächste auf dem Server abgelegte Szene laden (Schalter SZENE >). */
  async editorNaechsteSzene(): Promise<void> {
    const e = this.editor;
    if (!e || !e.namen.length) return;
    const i = e.namen.indexOf(e.b.name);
    const name = e.namen[(i + 1) % e.namen.length];
    try {
      const antwort = (await (await fetch("api/szene", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ was: "laden", name }) })).json()) as { beschreibung?: Beschreibung };
      if (antwort.beschreibung) {
        e.b = antwort.beschreibung;
        e.figur = 0;
        e.bild = 0;
        e.meldung = `GELADEN: ${name.toUpperCase()}`;
        this.editorBauen();
      } else e.meldung = `${name.toUpperCase()} NICHT GEFUNDEN`;
    } catch {
      e.meldung = "SERVER ANTWORTET NICHT";
    }
    this.render();
  }

  /**
   * Hilfeblatt des Editors. Ohne Erklärung ist der Editor nicht zu erraten: dass ein Klick ins
   * Feld ein Schlüsselbild setzt und das Spiel den Weg dazwischen rechnet, steht nirgends im
   * Bild. Beim ersten Öffnen liegt das Blatt deshalb von selbst oben.
   */
  drawEditorHilfe(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    // Das Blatt liegt über allem: die Schalter darunter dürfen nicht mehr treffen (der erste
    // Eintrag in hits gewinnt, siehe onClick)
    this.hits = [];
    panel(ctx, 2, 4, 316, 232);
    f.drawCenter(ctx, "SO ENTSTEHT EINE TORSZENE", 160, 8, COLORS.white);
    hline(ctx, 8, 22, 302);
    const zeilen: [string, string][] = [
      ["EINE SZENE IST EINE FOLGE VON BILDERN. SIE SAGEN NUR, WO EINE", "d"],
      ["FIGUR ZU WELCHEM BILD STEHT - DEN WEG DAZWISCHEN RECHNET DAS", "d"],
      ["SPIEL AUS. SO EIN PUNKT HEISST SCHL]SSELBILD UND STEHT ALS", "d"],
      ["MARKE AUF DER ZEITLEISTE.", "d"],
      ["", "d"],
      ["1. FIGUR ANKLICKEN ODER MIT FIGUR > DURCHSCHALTEN.", "h"],
      ["2. AUF DER ZEITLEISTE DAS BILD ANSTEUERN.", "h"],
      ["3. INS SPIELFELD KLICKEN - DORT STEHT SIE BEI DIESEM BILD.", "h"],
      ["4. WEITERE BILDER, WEITERE KLICKS: DAS ERGIBT DEN LAUFWEG.", "h"],
      ["5. SPIEL SPIELT DIE SZENE IM TAKT DES SPIELS AB.", "h"],
      ["6. SPEICHERN - SIE L[UFT SOFORT IN DER KONFERENZ MIT.", "h"],
      ["", "d"],
      ["ZWIEBEL LEGT DAS VORIGE BILD BLASS DARUNTER.", "d"],
      ["AUSSEHEN W[HLT DAS SPRITE: 0-58 UND 59-117 SIND SPIELER IN", "d"],
      ["BEIDE RICHTUNGEN, AB 142 KOMMT DER BALL.", "d"],
      ["L[NGE [NDERT, AUS WIE VIELEN BILDERN DIE SZENE BESTEHT.", "d"],
      ["MARKE WEG NIMMT DAS SCHL]SSELBILD DIESES BILDES ZUR]CK.", "d"],
      ["+ FIGUR UND - FIGUR LEGEN FIGUREN AN ODER R[UMEN SIE WEG.", "d"],
      ["", "d"],
      ["GESPEICHERT WIRD AUF DEM SERVER: DIE BESCHREIBUNG NACH", "d"],
      ["TORE-EIGEN, DIE FERTIGEN BILDER NACH ASSETS/EIGEN/TORE.", "d"],
    ];
    let y = 28;
    for (const [zeile, art] of zeilen) {
      if (zeile !== "") s.draw(ctx, toGame(zeile), 10, y, art === "h" ? COLORS.text : COLORS.textDim);
      y += 8;
    }
    this.knopf("WEITER", 130, 216, true);
    this.hit(130, 216, 57, 13, () => {
      if (this.editor) this.editor.hilfe = false;
    });
    this.hit(0, 0, W, H, () => undefined);
  }

  /**
   * Szene im Takt des Spiels abspielen (70 ms je Bild, dieselbe Zahl wie in der Konferenz), bis
   * HALT oder das Ende; danach läuft sie von vorn. Mit WIE IM SPIEL kommen die Klänge dazu: die
   * vier Kopfbytes der gebauten Szene nennen die Bilder, bei denen digi1..digi4 anfangen
   * (0x0C7C4) - genau wie szeneTon() es für die Konferenz macht.
   */
  editorAbspielen(): void {
    if (this.animating) return;
    this.animating = true;
    const schritt = () => {
      const e = this.editor;
      if (!e || !e.laeuft || this.screen !== "toreditor") {
        this.animating = false;
        if (e) e.laeuft = false;
        this.render();
        return;
      }
      const vorher = e.bild;
      e.bild = e.bild + 1 >= e.b.bilder ? 0 : e.bild + 1;
      if (e.wieImSpiel && e.szene) {
        const kopf = e.szene.header;
        // Beim Sprung ans Ende (Neubeginn) fängt die Tonspur wieder von vorn an
        const von = e.bild > vorher ? vorher + 1 : 0;
        for (let b = von; b <= e.bild; b++) {
          let klang = -1;
          for (let i = 0; i < 4; i++) if (kopf[i] === b) klang = i;
          if (klang >= 0) this.klaenge.spiele("digi" + (klang + 1));
        }
        if (e.bild === e.b.bilder - 1) this.klaenge.spiele("digi1");
      }
      this.render();
      setTimeout(schritt, SCENE_FRAME_MS);
    };
    schritt();
  }

  /** Beschreibung und beide Fassungen auf dem Server ablegen. */
  async editorSpeichern(): Promise<void> {
    const e = this.editor;
    if (!e) return;
    const antwort = await this.post("api/szene", { was: "speichern", beschreibung: e.b });
    e.meldung = antwort.ok ? `GESPEICHERT: ${e.b.name.toUpperCase()} (${e.b.bilder} BILDER)` : (antwort.message ?? "SPEICHERN FEHLGESCHLAGEN").toUpperCase();
    if (antwort.ok) await this.scenes.neuLaden("");
    this.render();
  }

  /** Kleiner Schrittschalter (+/-), so hoch wie eine Zeile der kleinen Schrift. */
  stufenKnopf(label: string, x: number, y: number, w = 11, h = 11): void {
    bevel(this.ctx, x, y, w, h, COLORS.black);
    this.assets.micro.drawCenter(this.ctx, label, x + Math.trunc(w / 2), y + Math.trunc((h - 6) / 2), COLORS.white, false);
  }

  /**
   * Schaltfläche im Stil des Originals. Die Knöpfe des Originals sind 57 breit; wo eine eigene
   * Beschriftung mehr braucht (Version 2026), nimmt `breite` den Platz, sonst stünde die
   * Schrift über dem Rand.
   */
  knopf(label: string, x: number, y: number, farbe: string | boolean, breite = 57): void {
    const c = typeof farbe === "string" ? farbe : farbe ? "#b20020" : "#a2a2c3";
    const ctx = this.ctx;
    const s = this.assets.micro;
    const innen = Math.max(1, breite - 2);
    ctx.fillStyle = "#8282a2";
    ctx.fillRect(x + 1, y, innen, 1);
    ctx.fillStyle = "#a2a2c3";
    ctx.fillRect(x, y + 1, 1, 10);
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x + 1, y + 1, innen, 10);
    ctx.fillStyle = "#303051";
    ctx.fillRect(x + breite - 1, y + 1, 1, 10);
    ctx.fillStyle = "#414161";
    ctx.fillRect(x + 1, y + 11, innen, 1);
    s.draw(ctx, label, x + 1 + Math.trunc((breite - s.width(label)) / 2), y + 4, c, false);
  }

  sideButtons(extra: { icon: Parameters<typeof drawIcon>[3]; action: () => void }[] = []): void {
    const ctx = this.ctx;
    const iconFrame = (x: number, y: number) => this.iconFrame(x, y);
    let y = 8;
    for (const e of extra) {
      iconFrame(270, y);
      drawIcon(ctx, this.assets, e.icon, 277, y + 6);
      this.hit(270, y, 46, 36, e.action);
      y += 44;
    }
    // Das Original nimmt dafür das Symbol aus PIC/3.VGA (Zeile 5, Spalte 5): "HAUPT MENU"
    // mit dem Pfeil darunter, 32x23 im selben Rahmen wie die übrigen Symbole
    iconFrame(270, 196);
    drawIcon(ctx, this.assets, "hauptmenu", 277, 202);
    this.hit(270, 196, 46, 36, () => this.go("menu"));
  }

  /**
   * Vertragsverlängerung (im Original vermessen): Kasten von (4,197) bis (250,232), links das
   * blaue Feld bis x 181 mit Name, Alter und Ligaspielen bei y 204, Trennlinie darunter,
   * "VERTRAGSDAUER (IN SAISONS)" bei y 213 und "GEHALT PRO MONAT (IN DM)" bei y 221, die Werte
   * hinter einem Doppelpunkt bei x 130. Rechts die Schaltflächen NEUER VERTRAG (184,202) und
   * ABBRUCH (184,216), je 60x12.
   */
  drawVertragsKasten(l: Lineup, place: number): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const g = this.game!;
    const p = g.players.at(l.playerIndex);
    bevel(ctx, 4, 197, 246, 36, COLORS.black);
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(6, 199, 176, 32);
    s.draw(ctx, toGame(`${cp437ToGame(p.name)}, ${p.age} ${T("ui.vertragskasten", 3)}${l.leagueApps}${T("ui.vertragskasten", 4)}`), 8, 203, COLORS.white);
    hline(ctx, 8, 210, 168);
    // Laufzeit und Gehalt stehen hinter dem Doppelpunkt und sind Eingabefelder: ein Klick auf
    // den Wert genügt, wie im Original (kein Umweg über NEUER VERTRAG)
    const ein = this.eingabe?.imKasten ? this.eingabe : null;
    s.draw(ctx, T("ui.vertragskasten", 0), 8, 213, COLORS.white);
    s.draw(ctx, ":", 130, 213, COLORS.white);
    s.draw(ctx, T("ui.vertragskasten", 1), 8, 221, COLORS.white);
    s.draw(ctx, ":", 130, 221, COLORS.white);
    if (ein) {
      [0, 1].forEach((i) => {
        this.zahlFeld(136, 213 + i * 8, ein.felder[i].wert, ein.feld === i, 44, () => {
          ein.feld = i;
          this.render();
        });
      });
    } else {
      [String(l.u8(11)), String(l.i32(40))].forEach((wert, i) => {
        s.draw(ctx, wert, 136, 213 + i * 8, COLORS.white);
        this.hit(135, 211 + i * 8, 44, 9, () => this.vertragEingabe(l, place, i));
      });
    }
    const knopf = (text: string, y: number, rot: boolean, action: () => void) => {
      bevel(ctx, 184, y, 62, 13, COLORS.black);
      s.drawCenter(ctx, text, 215, y + 3, rot ? "#920010" : COLORS.white, false);
      this.hit(184, y, 62, 13, action);
    };
    knopf(toGame(T("ui.vertragskasten", 2)), 202, true, () => {
      // NEUER VERTRAG schickt das Angebot ab; wer die Felder noch nicht angerührt hat, bekommt
      // sie damit zum Bearbeiten
      if (!this.eingabe?.imKasten) this.vertragEingabe(l, place, 0);
      else this.eingabeFertig();
    });
    if (this.vertragOffen(place)) {
      // Am Saisonende endet der Dialog des Originals entweder mit einer Einigung oder mit
      // "kein Angebot" - dann verlässt der Spieler den Verein (0x0DB40 -> 0x0DC6B)
      knopf("KEIN ANGEBOT", 216, true, () => {
        this.eingabe = null;
        this.vertragPlace = -1;
        void this.post("api/vertragsende", { manager: this.manager, player: this.player, place }).then(() => {
          const rest = this.offeneVertraege();
          if (rest.length) this.vertragOeffnen(rest[0].place);
        });
      });
    } else {
      knopf("ABBRUCH", 216, false, () => {
        this.eingabe = null;
        this.vertragPlace = -1;
      });
    }
  }

  /**
   * Laufzeit oder Gehalt im Vertragskasten bearbeiten. Im Original klickt man den Wert direkt
   * an; die Forderung rechnet sich dabei aus der Laufzeit (sim/contracts.ts salaryDemand).
   */
  vertragEingabe(l: Lineup, place: number, feld: number): void {
    const g = this.game!;
    const forderung = (jahre: number) => salaryDemand(g, this.manager, place, jahre);
    this.fragVertrag("", forderung(l.u8(11)), l.u8(11), true, (jahre, gehalt) => {
      const abs = contractRefusals();
      const name = cp437ToGame(g.players.at(l.playerIndex).name);
      void this.post("api/newcontract", { manager: this.manager, player: this.player, place, years: jahre, salary: gehalt }, true).then((antwort) => {
        // Wortlaut des Originals, unter der Tabelle: "Ihr Angebot wurde angenommen !" bzw.
        // "So dumm ist <Name> leider nicht..."
        this.vertragsAntwort = antwort.ok ? abs[8] : `${abs[9]} ${abs[10]} ${name} ${abs[11]}`;
        this.status = "";
        this.statusUntil = 0;
        this.render();
        // Am Saisonende arbeitet das Original einen Spieler nach dem anderen ab
        if (antwort.ok) {
          const rest = this.offeneVertraege().filter((v) => v.place !== place);
          if (rest.length) this.vertragOeffnen(rest[0].place);
        }
      });
      this.vertragPlace = -1;
    }, forderung);
    if (this.eingabe) this.eingabe.feld = feld;
    this.status = "ZIFFERN TIPPEN, NEUER VERTRAG SCHICKT DAS ANGEBOT";
    this.statusUntil = Date.now() + 20000;
    this.render();
  }

  /**
   * Spielfeld des Kaderbildschirms (PIC/6.VGA). Feld 118x120 bei (189,94), rechts im Bild die
   * drei Systemsymbole 32x23 (y 0, 24, 48), unten die Spielermarken 13x13 ab y 121. Die
   * Position eines Spielers steht in den Kaderbytes 25 (Spalte 0..6) und 26 (Reihe 0..7);
   * Reihe 0 ist vorn beim gegnerischen Tor, Reihe 7 das eigene. Die Marke sitzt bei
   * (189 + 19 + 14·Spalte, 94 + 12 + 14·Reihe).
   */
  drawPitch(): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const g = this.game!;
    const pic = this.assets.img("6.VGA");
    // Die Spielermarken haben Schwarz als Maskenfarbe; sonst steht ein schwarzer Kasten um
    // die Nummer
    const marken = this.assets.maskedImg("6.VGA", 0, 0, 0);
    // Im Original nachgemessen: Kasten (181,86) 133x133, das Feldbild 118x120 aus 6.VGA
    // sieben Punkte eingerückt bei (188,93)
    panel(ctx, 181, 86, 133, 133);
    if (pic) ctx.drawImage(pic, 0, 0, 120, 120, 188, 93, 120, 120);
    // Raster im Original nachgemessen: die 13x13-Marke steht bei (194 + 16·Spalte, 99 + 14·Reihe)
    const mitte = (col: number, row: number) => ({ x: 200 + 16 * col, y: 105 + 14 * row });
    const squad = g.squadOf(this.manager);
    squad.forEach((l, place) => {
      if (l.number < 1 || l.number > 11) return;
      const c = mitte(l.u8(25), l.u8(26));
      if (marken) ctx.drawImage(marken, 0, 121, 13, 13, c.x - 6, c.y - 6, 13, 13);
      if (place === this.pitchSel) {
        ctx.strokeStyle = "#f3f3f3";
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x - 7.5, c.y - 7.5, 15, 15);
      }
      // Die Nummer steht ohne Schatten in Palettenfarbe 11, einen Punkt rechts der Markenmitte
      s.drawCenter(ctx, String(l.number), c.x + 1, c.y - 2, "#d3c3b2", false);
    });
    // Zeigerkreis: der leere Ring (fünfte Marke im Bild, x 52) auf dem Feld unter dem Zeiger.
    // Er kommt nach den Spielermarken, sonst verschwindet er hinter einer Nummer.
    if (this.pitchHover && marken) {
      const c = mitte(this.pitchHover.col, this.pitchHover.row);
      ctx.drawImage(marken, 52, 121, 13, 13, c.x - 6, c.y - 6, 13, 13);
    }
    // Klickfelder des Rasters: erst einen Spieler wählen, dann das Ziel
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row < 8; row++) {
        const c = mitte(col, row);
        this.hit(c.x - 8, c.y - 7, 16, 14, () => {
          const hier = squad.findIndex((l) => l.number >= 1 && l.number <= 11 && l.u8(25) === col && l.u8(26) === row);
          // Jeder Klick aufs Spielfeld schaltet die Automatik ab, mit Hinweis (0x219EA -> 0x20197)
          if (this.online && g.save.plain[SYSTEM_OFFSET + 2 * this.manager] > 1) {
            this.hinweis = [texte("ui.automatik")[0], texte("ui.automatik")[1]];
            void this.post("api/system", { manager: this.manager, player: this.player, system: 1 }, true);
          }
          if (this.pitchSel < 0) {
            if (hier >= 0) this.pitchSel = hier;
            return;
          }
          const place = this.pitchSel;
          this.pitchSel = -1;
          void this.post("api/position", { manager: this.manager, player: this.player, place, col, row });
        });
      }
    }
    // Die drei Systeme als Symbole unten links. Im Original nachgemessen: es ist derselbe
    // Symbolknopf wie überall (PIC/24.VGA, gedrückt 25.VGA), das Bild sitzt bei (4 + 60·i, 192),
    // das Symbol 32x23 aus 6.VGA (Spalte 121, Zeile 24·i) bei (13 + 60·i, 201). Das eingestellte
    // System steht gedrückt: Managerbyte SYSTEM_OFFSET ist 2, 3 oder 4.
    const system = g.save.plain[SYSTEM_OFFSET + 2 * this.manager];
    for (let i = 0; i < 3; i++) {
      const x = 6 + 60 * i;
      this.iconFrame(x, 195, system === i + 2);
      if (pic) ctx.drawImage(pic, 121, 24 * i, 32, 23, x + 7, 201, 32, 23);
      // Im laufenden Spiel nimmt das Original die Knöpfe nicht an (0x216DD)
      if (!this.live) this.hit(x, 195, 46, 36, () => void this.post("api/system", { manager: this.manager, player: this.player, system: i + 2 }));
    }
  }

  /**
   * Der Kader steht im Original in der gespeicherten Reihenfolge der Kaderplätze, nicht nach
   * Nummern sortiert: Torhüter, Abwehr, Mittelfeld, Angriff, und innerhalb davon so, wie die
   * Plätze belegt sind (im Vergleich mit CLAUDE.MAN Zeile für Zeile geprüft).
   */
  /**
   * Tendenz eines Spielers (0x1FB33): aus dem Trainingswert (Kaderbyte 14) wird (Wert - 30) / 13
   * und damit "-", "O" oder "+" gewählt. Rot wird sie, wenn Kaderbyte 19 über 130 liegt.
   */
  tendenz(l: Lineup): string {
    return ["-", "O", "+"][Math.max(0, Math.min(2, Math.trunc((l.u8(14) - 30) / 13)))];
  }

  squadRows(): Lineup[] {
    return this.game!.squadOf(this.manager);
  }

  drawSquad(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const g = this.game!;
    const s = this.assets.micro;
    // Im Original nachgemessen (Kaderliste ohne und mit Spielfeld gleich): Kasten (2,7) 239x182,
    // Überschrift Grundlinie y 10, Kopfzeile y 20, Trennstriche y 26 und y 176 von x 6 bis 236,
    // zwanzig Zeilen ab y 30 im Abstand 6, Hilfszeile darunter bei y 180 in Palettenfarbe 11
    // (#a2a2c3). Überschrift, Kopfzeile und Striche stehen ebenfalls in Palettenfarbe, nicht in
    // Weiß. (Eine Messung vom 16.9.2026 hatte alles unter der Überschrift um acht Zeilen zu
    // tief; der Ausschnitt der Aufnahme war verrutscht - GitLab #56.)
    const INK_KOPF = "#d3c3b2";
    // Die Zeile unter der Tabelle steht in Palettenfarbe 11, nicht in Weiß (im Original gemessen)
    const INK_HILFE = "#a2a2c3";
    // Zeilenfarbe nach Mannschaftsteil, im Original abgelesen: Tor am dunkelsten, Angriff am
    // hellsten. Die Nummer eines Ersatzspielers steht gedämpft, verletzt/gesperrt in Rot.
    const NR_ERSATZ = "#616182";
    const ROT = "#b20020";
    panel(ctx, 2, 7, 239, 182);
    // Die Überschrift trägt ihren Schatten in derselben Zeile bei x+1 (Palettenfarbe 7)
    f.drawCenter(ctx, T("ui.squad", 0), 122, 10, "#303051", false);
    f.drawCenter(ctx, T("ui.squad", 0), 121, 10, INK_KOPF, false);
    const cols = { nr: 16, art: 17, name: 35, sp: 102, st: 116, to: 152, gk: 165, rk: 177, status: 182, td: 222 };
    const hy = 20;
    // Vertragsansicht (Symbol Vertragsakte): andere Spalten, am Original vermessen
    const vertrag = this.squadView === "vertrag";
    if (vertrag) {
      s.draw(ctx, "ART", 6, hy, INK_KOPF, false);
      s.draw(ctx, "NAME", 24, hy, INK_KOPF, false);
      s.draw(ctx, "SP", 77, hy, INK_KOPF, false);
      s.draw(ctx, "ST", 90, hy, INK_KOPF, false);
      s.draw(ctx, "TO", 103, hy, INK_KOPF, false);
      s.draw(ctx, "STATUS", 115, hy, INK_KOPF, false);
      s.draw(ctx, "TD", 154, hy, INK_KOPF, false);
      s.draw(ctx, "V.DAUER", 164, hy, INK_KOPF, false);
      s.draw(ctx, "GEHALT", 201, hy, INK_KOPF, false);
    } else {
    s.draw(ctx, "NR", 6, hy, INK_KOPF, false);
    s.draw(ctx, "ART", cols.art, hy, INK_KOPF, false);
    s.draw(ctx, "NAME", cols.name, hy, INK_KOPF, false);
    s.draw(ctx, "SP", 94, hy, INK_KOPF, false);
    s.draw(ctx, "ST[RKEN", 107, hy, INK_KOPF, false);
    s.draw(ctx, "TO", 143, hy, INK_KOPF, false);
    s.draw(ctx, "GK", 155, hy, INK_KOPF, false);
    s.draw(ctx, "RK", 167, hy, INK_KOPF, false);
    s.draw(ctx, "STATUS", 180, hy, INK_KOPF, false);
    s.draw(ctx, "TD", 219, hy, INK_KOPF, false);
    }
    hline(ctx, 6, 26, 231, INK_KOPF);
    const rows = this.squadRows();
    let y = 30;
    rows.forEach((l, i) => {
      const p = g.players.at(l.playerIndex);
      const zeiger = this.pitchOpen && this.pitchHover !== null && l.number >= 1 && l.number <= 11 && l.u8(25) === this.pitchHover.col && l.u8(26) === this.pitchHover.row;
      // Im Original ist die Zeile unter der Maus gelb - genauso wie die ausgewählte
      const sel = i === this.selectedRow || zeiger || i === this.squadHover;
      if (sel) {
        // Farben und Maße aus dem Original abgelesen: Balken #f3f300, genau die fünf Zeilen der
        // Schrift hoch (im Original y..y+4), Schrift darauf #414161
        ctx.fillStyle = "#f3f300";
        ctx.fillRect(6, y, 232, 5);
      }
      // Beide Ansichten färben die Zeile nach dem Mannschaftsteil und zeichnen ohne Schatten.
      // Wer nach einem abgelehnten Angebot nicht mehr verhandelt, steht in der Vertragsansicht
      // blau (Farbton noch nicht am Original nachgemessen).
      const stur = vertrag && l.u8(24) > 0 && !(l.u8(24) & 0x80);
      // Gedopte Spieler stehen grün, damit man die laufende Kur nicht vergisst (Version 2026, #3)
      const c = sel ? "#414161" : stur ? "#5151d3" : isDoped(l) ? "#71a241" : (GRUPPENFARBE[p.position] ?? COLORS.text);
      const sh = false;
      // RESERVE steht nur bei den Ersatzleuten mit Nummer (12..15); wer keine Nummer hat, hat
      // im Original auch keinen Status. Eine Dopingsperre benutzt die Mechanik der Verletzung,
      // heißt aber anders (#3).
      const ef = this.einsatzFlag(l);
      // Wie 0x21E40: Text 4cb3:22FC[Byte 9 & 3], bei der Sperre mit der Dauer (Byte 13) in Klammern
      const st = isDopeBanned(l) ? "DOPING" : ef === 3 ? " " : ef === 2 ? "VERL." : ef === 1 ? `GESP.(${l.u8(13)})` : l.number === 0 ? "" : l.number > 11 ? "RESERVE" : "IM TEAM";
      const [ko, te, fo] = l.strength;
      if (vertrag) {
        const td = this.tendenz(l);
        const jahre = l.u8(11);
        s.draw(ctx, p.position, 6, y, c, sh);
        s.draw(ctx, cp437ToGame(p.name), 24, y, c, sh);
        s.drawRight(ctx, String(l.leagueApps + l.cupApps), 85, y, c, sh);
        s.drawRight(ctx, String(Math.trunc((ko + te + fo) / 3)), 99, y, c, sh);
        s.drawRight(ctx, String(l.leagueGoals + l.cupGoals), 111, y, c, sh);
        s.draw(ctx, st, 114, y, !sel && ef ? ROT : c, sh);
        // Die Tendenz steht auch hier rot, wenn Kaderbyte 19 über 130 liegt (im Original gesehen)
        s.draw(ctx, td, 154, y, !sel && l.u8(19) > 130 ? ROT : c, sh);
        // Ein abgelaufener Vertrag (0 Jahre) steht rot: über ihn wird noch verhandelt
        s.draw(ctx, toGame(`${jahre} JAHR${jahre === 1 ? "" : "E"}`), 167, y, !sel && jahre === 0 ? ROT : c, sh);
        s.drawRight(ctx, `${l.i32(40)} DM`, 239, y, c, sh);
      } else {
      // Ohne Nummer bleibt das Feld im Original leer, kein Strich
      if (l.number) s.drawRight(ctx, String(l.number), cols.nr, y, !sel && l.number > 11 ? NR_ERSATZ : c, sh);
      s.draw(ctx, p.position, cols.art, y, c, sh);
      s.draw(ctx, cp437ToGame(p.name), cols.name, y, c, sh);
      s.drawRight(ctx, String(l.leagueApps + l.cupApps), cols.sp, y, c, sh);
      s.drawRight(ctx, String(ko), cols.st, y, c, sh);
      s.drawRight(ctx, String(te), cols.st + 12, y, c, sh);
      s.drawRight(ctx, String(fo), cols.st + 24, y, c, sh);
      s.drawRight(ctx, String(l.leagueGoals + l.cupGoals), cols.to, y, c, sh);
      s.drawRight(ctx, String(l.yellowCards), cols.gk, y, c, sh);
      s.drawRight(ctx, String(l.redCards), cols.rk, y, c, sh);
      s.draw(ctx, st, cols.status, y, !sel && ef ? ROT : c, sh);
      s.draw(ctx, this.tendenz(l), cols.td, y, !sel && l.u8(19) > 130 ? ROT : c, sh);
      }
      // Mit eingeblendetem Spielfeld endet die Liste vor dem Feld, sonst würden ihre
      // Klickflächen die linke Spalte des Feldes verdecken
      this.hit(6, y - 1, this.pitchOpen ? 180 : 232, 6, () => {
        if (vertrag) {
          // In der Vertragsansicht öffnet ein Klick die Verlängerung, nicht die Spielerinfo.
          // Vorher die Absagen des Originals (0x251FF): ausgeliehen und "nicht verhandlungsbereit"
          // (Kaderbyte 24 zählt nach einem abgelehnten Angebot herunter).
          const abs = contractRefusals();
          const name = cp437ToGame(g.players.at(l.playerIndex).name);
          if (l.u8(12) !== 0) {
            this.hinweis = [`${name} ${abs[3]}`, abs[4]];
            this.vertragPlace = -1;
            return;
          }
          if (l.u8(24) > 0 && !(l.u8(24) & 0x80)) {
            this.hinweis = [`${name} ${abs[0]}`, abs[1].replace(/-$/, "") + abs[2]];
            this.vertragPlace = -1;
            return;
          }
          this.vertragPlace = this.vertragPlace === i ? -1 : i;
          return;
        }
        this.pickRow(i);
      });
      y += 6;
    });
    hline(ctx, 6, 176, 231, INK_KOPF);
    // Zeiger über dem Spielfeld: Stärke, Alter und Fuß des Spielers darunter (0x21567 mit
    // 0x04D22: Spielerbyte 32, unter 5 heißt links, über 1 rechts, dazwischen beides)
    const hoverPlace = this.pitchOpen && this.pitchHover ? rows.findIndex((l) => l.number >= 1 && l.number <= 11 && l.u8(25) === this.pitchHover!.col && l.u8(26) === this.pitchHover!.row) : -1;
    if (hoverPlace >= 0) {
      const l = rows[hoverPlace];
      const p = g.players.at(l.playerIndex);
      const st = Math.trunc((l.u8(16) + l.u8(17) + l.u8(18)) / 3);
      const seite = p.u8(32);
      const fuss = seite < 5 ? (seite > 1 ? "L+R" : "L") : "R";
      s.drawCenter(ctx, toGame(`ST[RKE:${st}, ${p.age} JAHRE (${fuss})`), 122, 180, INK_HILFE);
    } else if (vertrag && this.vertragPlace >= 0 && rows[this.vertragPlace]) {
      const l = rows[this.vertragPlace];
      const p = g.players.at(l.playerIndex);
      const seite = p.u8(32);
      const fuss = seite < 5 ? (seite > 1 ? "L+R" : "L") : "R";
      s.drawCenter(ctx, toGame(`NAME: ${cp437ToGame(p.name)} (${p.age} JAHRE) (${fuss})`), 122, 180, INK_HILFE);
    } else if (this.squadHover >= 0 && rows[this.squadHover] && this.squadSpalte >= 0) {
      // Hilfszeile zur Spalte unter dem Zeiger (0x21567 ff.); sie verdrängt die Antwort der
      // letzten Verhandlung, sobald der Zeiger wieder über der Liste steht
      s.drawCenter(ctx, this.squadHilfe(rows[this.squadHover]), 122, 180, INK_HILFE);
    } else if (this.vertragsAntwort) {
      // Antwort der Vertragsverhandlung: im Original steht sie hier unter der Tabelle
      s.drawCenter(ctx, toGame(this.vertragsAntwort), 122, 180, INK_HILFE);
    } else if (this.selectedRow >= 0 && rows[this.selectedRow]) {
      const p = g.players.at(rows[this.selectedRow].playerIndex);
      s.drawCenter(ctx, `NAME: ${cp437ToGame(p.name)} (${p.age} JAHRE) - ZWEITEN ZUM TAUSCH W[HLEN`, 122, 180, INK_HILFE);
    }
    // Einsatzregler (Grafik PIC/37.VGA, oberer Teil): Managerbyte 305, 0..34. Der Keil steht
    // links flach und rechts hoch; bis zum eingestellten Wert liegt ein heller Balken darüber.
    const regler = this.assets.img("37.VGA");
    const einsatz = Math.max(0, Math.min(34, g.managers.at(this.manager).u8(305)));
    // Systemwahl (0x21776): MANUELL oder automatische Aufstellung 1-4-4-2 / 1-3-5-2 / 1-3-4-3
    const sysNow = g.save.plain[SYSTEM_OFFSET + 2 * this.manager];
    const sysIdx = sysNow >= 1 && sysNow <= 4 ? sysNow : 1;
    // Das System wählt man im Original über die Symbole auf dem Spielfeld, nicht hier
    void sysIdx;
    // Spielerinfo (0x15346): ein zweiter Klick auf denselben Spieler öffnet sie
    if (this.infoPlace >= 0) this.drawPlayerInfo(this.manager * 25 + this.infoPlace);
    // Rechte Spalte wie im Original: oben der Einsatzregler, darunter vier Symbole mit den
    // schwarzen Innenfeldern bei y 49, 94, 139 und 184 (Rahmen also ab y 44 im Abstand 45).
    // Mit eingeblendetem Spielfeld verdeckt das Feld die unteren drei.
    if (regler) {
      ctx.drawImage(regler, 0, 0, 50, 31, 267, 5, 50, 31);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(275, 25, einsatz + 1, 2);
    }
    this.hit(275, 18, 34, 14, (cx) => {
      const v = Math.max(0, Math.min(34, Math.round(cx - 275)));
      void this.post("api/einsatz", { manager: this.manager, player: this.player, value: v });
    });
    // Das Symbol des gerade gezeigten Bildschirms steht gedrückt (im Original nachgemessen:
    // TAKTIK ist es sowohl mit als auch ohne eingeblendetes Spielfeld)
    const symbol = (y: number, icon: Parameters<typeof drawIcon>[3], action: () => void, gedrueckt = false) => {
      this.iconFrame(270, y, gedrueckt);
      drawIcon(ctx, this.assets, icon, 277, y + 6);
      // Mit eingeblendetem Spielfeld liegen die unteren drei darunter: sie bleiben sichtbar
      // (im Original ragen ihre beiden rechten Spalten hervor), sind aber nicht anklickbar
      if (!this.pitchOpen || y === 44) this.hit(270, y, 46, 36, action);
    };
    symbol(
      44,
      "taktik",
      () => {
        this.pitchOpen = false;
        this.pitchSel = -1;
        this.squadView = "kader";
      },
      !vertrag,
    );
    symbol(89, "spielfeld", () => {
      this.pitchOpen = true;
      this.pitchSel = -1;
    });
    symbol(134, "vertrag", () => (this.squadView = "vertrag"), vertrag);
    // Während der Unterbrechung führt dasselbe Symbol zurück ins Spiel: das Original ruft aus
    // der Konferenz (0x1C52F) denselben Kaderbildschirm auf wie das Hauptmenü (0xA6C2), und
    // beim Verlassen wird die Stärke neu berechnet (0x21190).
    symbol(179, "hauptmenu", () => (this.live ? this.liveResume() : this.go("menu")));
    if (this.pitchOpen) this.drawPitch();
    if (vertrag && this.vertragPlace >= 0 && rows[this.vertragPlace]) this.drawVertragsKasten(rows[this.vertragPlace], this.vertragPlace);
  }

  /** Vereinsinfo aus einer Liste öffnen (Tabelle 0x2D0BA, Spielplan 0x2C089, Stärkeliste 0x2E38A). */
  oeffneVereinsInfo(club: number, modus: number, versatz: number, platz?: number): void {
    if (!this.game) return;
    this.vereinsInfo = { club, modus, versatz, platz, rest: false, rueck: restStartRueck(this.game, club) };
  }

  /**
   * Tafel "Info über <Verein>" bzw. Restprogramm: Tafel wie 0x06C7:00A7 bei (0x59 + 2 · Versatz,
   * 0x37), 225 x 175; die Zeichenbefehle mit den Koordinaten des Originals liefert der Kern
   * (sim/vereinsinfo.ts). Die Tafel schirmt den Bildschirm darunter ab.
   */
  drawVereinsInfo(): void {
    const v = this.vereinsInfo!;
    const g = this.game!;
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    this.hits = [];
    panel(ctx, infoX(v.versatz), INFO_Y, INFO_BREITE, INFO_HOEHE);
    const FARBE: Record<number, string> = { 1: "#a2a2c3", 2: "#8282a2", 10: "#b2a282", 11: "#d3c3b2", 17: "#920010" };
    const befehle: InfoBefehl[] = v.rest ? restprogramm(g, v.club, v.versatz, v.rueck) : vereinsInfo(g, v.club, v.modus, v.versatz, this.manager, v.platz);
    // Mittig wie 0x06C7:087C: x1 + (x2 - x1) / 2 - Breite / 2
    const mitte = (w: number, x1: number, x2: number) => x1 + Math.trunc((x2 - x1) / 2) - Math.trunc(w / 2);
    for (const b of befehle) {
      if (b.art === "titel") {
        const t = cp437ToGame(b.text);
        f.draw(ctx, t, mitte(f.width(t), b.x, b.bis), b.y, FARBE[11], COLORS.black);
      } else if (b.art === "linie") hline(ctx, b.x, b.y, b.bis - b.x + 1, FARBE[b.farbe]);
      else if (b.art === "text") {
        const t = cp437ToGame(b.text);
        const x = b.bis !== undefined ? mitte(s.width(t), b.x, b.bis) : b.x;
        s.draw(ctx, t, x, b.y, FARBE[b.farbe], b.schatten ? COLORS.black : false);
      } else {
        this.knopf(cp437ToGame(b.text), b.x, b.y, FARBE[b.farbe]);
        this.hit(b.x, b.y, 57, 12, () => {
          if (b.aktion === "zu") this.vereinsInfo = null;
          else if (b.aktion === "rest") v.rest = true;
          else if (b.aktion === "info") v.rest = false;
          else if (b.aktion === "haelfte") v.rueck = !v.rueck;
          else void this.post("api/anzeigen", { manager: this.manager, player: this.player, club: v.club }, true);
        });
      }
    }
    // Ein Klick neben die Knöpfe bleibt ohne Wirkung
    this.hit(0, 0, W, H, () => {});
  }

  /** Spielerinfo-Tafel (0x15346): AHA!-Zeile, Status, Tore/Spiele, DATEN, Tendenz und Erschöpfung. */
  drawPlayerInfo(lineupIndex: number): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const info = playerInfo(this.game!, lineupIndex);
    panel(ctx, 4, 14, 258, 212);
    f.drawCenter(ctx, "Info }ber " + cp437ToGame(info.name), 133, 18, COLORS.white);
    s.draw(ctx, "AHA !", 10, 32, COLORS.highlight);
    s.draw(ctx, cp437ToGame(info.ageLine), 10, 40, COLORS.text);
    s.draw(ctx, cp437ToGame(info.status), 10, 48, COLORS.text);
    hline(ctx, 8, 58, 250);
    s.draw(ctx, "LIGA", 90, 62, COLORS.white);
    s.draw(ctx, "DFB-POKAL", 140, 62, COLORS.white);
    s.draw(ctx, "TORE:", 10, 70, COLORS.text);
    s.draw(ctx, "SPIELE:", 10, 78, COLORS.text);
    s.drawRight(ctx, String(info.goals[0]), 108, 70, COLORS.text);
    s.drawRight(ctx, String(info.goals[1]), 178, 70, COLORS.text);
    s.drawRight(ctx, String(info.apps[0]), 108, 78, COLORS.text);
    s.drawRight(ctx, String(info.apps[1]), 178, 78, COLORS.text);
    s.draw(ctx, "DATEN:", 10, 90, COLORS.white);
    info.data.forEach(([k, v], i) => {
      const x = i < 5 ? 10 : 132;
      const y = 98 + (i % 5) * 8;
      s.draw(ctx, k, x, y, COLORS.text);
      s.drawRight(ctx, cp437ToGame(v), x + 118, y, COLORS.white);
    });
    const bar = (label: string, value: number, y: number) => {
      s.draw(ctx, label, 10, y, COLORS.white);
      for (let i = 0; i < 8; i++) {
        const on = i <= Math.trunc(value / 12);
        bevel(ctx, 84 + i * 12, y - 1, 10, 7, on ? COLORS.highlight : COLORS.panel, on);
      }
    };
    bar("TENDENZ", info.tendency, 146);
    bar("ERSCH|PFUNG", info.exhaustion, 158);
    button(ctx, f, "WEITER", 180, 200, 70, true);
    this.hit(4, 14, 258, 212, () => {
      this.infoPlace = -1;
      this.render();
    });
  }

  /**
   * Byte 9 & 3 eines eigenen Kaderplatzes, wie ihn die Kaderliste zeigt: an einem DFB-Pokaltag,
   * an dem der Verein in der Runde steht (4238:513E), steht ein gesperrter Spieler ohne Vermerk
   * (0x1F1A8, 0x21ED5; #100).
   */
  einsatzFlag(l: Lineup): number {
    const f = l.u8(9) & 3;
    return f === 1 && this.game !== undefined && sperreAusgesetzt(this.game, this.manager) ? 0 : f;
  }

  pickRow(i: number): void {
    // Bei eingeschalteter Automatik nimmt die Kaderliste keinen Klick an (0x2084F)
    if (this.online && this.save!.plain[SYSTEM_OFFSET + 2 * this.manager] > 1) {
      this.hinweis = [texte("ui.automatik")[0], texte("ui.automatik")[2]];
      this.selectedRow = -1;
      return;
    }
    if (this.selectedRow < 0) {
      this.selectedRow = i;
      return;
    }
    if (this.selectedRow === i) {
      // Zweiter Klick auf denselben Spieler: Spielerinfo (0x15346)
      const rows = this.squadRows();
      const chosen = rows[i].playerIndex;
      this.infoPlace = this.game!.squadOf(this.manager).findIndex((l) => l.playerIndex === chosen);
      this.selectedRow = -1;
      return;
    }
    if (this.selectedRow !== i) {
      const rows = this.squadRows();
      const a = rows[this.selectedRow];
      const b = rows[i];
      const n = a.number;
      a.number = b.number;
      b.number = n;
      if (this.online) void this.sendSquad();
      else this.status = "Nummern getauscht. Mit der Diskette im Hauptmenü speichern.";
    }
    this.selectedRow = -1;
  }

  /**
   * Tabelle (im Original am 10.9.2026 vermessen): Panel ab y 7, Titel "Tabelle GESAMT
   * n.SPIELTAG" bei y 9, Spaltenkopf bei y 18, Trennlinie bei y 25, 18 bzw. 20 Zeilen ab y 28
   * im Abstand 7, Trennlinie bei y 169, die Knöpfe HEIM/GESAMT/AUSW[RTS bei y 175 an x 31, 133
   * und 235 (je 55 breit, kleine Schrift), darunter die Beschriftung bei y 212. Der Platz ist
   * grün (#71a241) für Aufstiegs- bzw. Europaplätze und rot (#920010) für Abstiegsplätze.
   */
  drawTable(weiter: (() => void) | null = null): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const m = g.managers.at(this.manager);
    const league = this.tableLeague >= 0 ? this.tableLeague : m.clubIndex < 18 ? 0 : m.clubIndex < 38 ? 1 : 2;
    const [from, to] = [[0, 18], [18, 38], [38, 58]][league];
    // Minuspunkte gibt es nur im Original; mit drei Punkten je Sieg steht nur der Punktestand
    const punkteJeSieg = winPoints(g);
    const rows: { club: number; s: Standing; games: number; w: number; d: number; l: number; pts: number; pa: number; gf: number; ga: number }[] = [];
    for (let c = from; c < to; c++) {
      const st = g.standings.at(c);
      const home = this.tableMode !== "auswaerts";
      const away = this.tableMode !== "heim";
      const games = (home ? st.homeGames : 0) + (away ? st.awayGames : 0);
      const w = (home ? st.homeWins : 0) + (away ? st.awayWins : 0);
      const l = (home ? st.homeLosses : 0) + (away ? st.awayLosses : 0);
      const pts = (home ? st.homePoints : 0) + (away ? st.awayPoints : 0);
      const gf = (home ? st.homeGoalsFor : 0) + (away ? st.awayGoalsFor : 0);
      const ga = (home ? st.homeGoalsAgainst : 0) + (away ? st.awayGoalsAgainst : 0);
      rows.push({ club: c, s: st, games, w, d: games - w - l, l, pts, pa: punkteJeSieg * games - pts, gf, ga });
    }
    // Reihenfolge: die Gesamttabelle steht als Platz im Spielstand (Standing-Byte 46) und wird
    // nach jedem Spieltag fortgeschrieben (sim/standings.ts). Gleichauf liegende Vereine
    // behalten dadurch eine feste Reihenfolge, die ein einfaches Sortieren nicht trifft. Heim-
    // und Auswärtstabelle sortiert das Original mit derselben Routine (0x2D143, Art 0 bzw. 2)
    // ab der Gesamtreihenfolge: Punkte, weniger Spiele, Tordifferenz, Tore. Dass es dabei die
    // Reihenfolgeliste im Spielstand umschreibt, macht das Remake nicht nach (ABWEICHUNGEN).
    if (this.tableMode === "gesamt") rows.sort((a, b) => a.s.u8(46) - b.s.u8(46));
    else {
      const folge = tableOrder(g, league, this.tableMode === "heim" ? 0 : 2);
      rows.sort((a, b) => folge.indexOf(a.club) - folge.indexOf(b.club));
    }
    const matchday = Math.max(...rows.map((r) => r.s.homeGames + r.s.awayGames));
    const INK = "#a2a2c3";
    const SHADOW = "#303051";
    const GRUEN = "#719241";
    const OLIV = "#516110";
    const ROT = "#920010";
    panel(ctx, 5, 8, 309, 181);
    const modeLabel = { gesamt: "GESAMT", heim: "HEIM", auswaerts: "AUSW[RTS" }[this.tableMode];
    const titel = toGame(`Tabelle ${modeLabel}   ${matchday}.SPIELTAG`);
    const tx = Math.round(159 - f.width(titel) / 2);
    f.draw(ctx, titel, tx + 1, 10, SHADOW, false);
    f.draw(ctx, titel, tx, 10, INK, false);
    // Spalten im Original nachgemessen (GitLab #56)
    const hy = 19;
    s.draw(ctx, "PL.", 9, hy, INK, false);
    s.draw(ctx, "VEREIN", 29, hy, INK, false);
    s.draw(ctx, "BILANZ", 110, hy, INK, false);
    s.draw(ctx, "SP", 153, hy, INK, false);
    s.draw(ctx, "S-U-N", 176, hy, INK, false);
    s.draw(ctx, "PUNKTE", 211, hy, INK, false);
    s.draw(ctx, "TORE", 248, hy, INK, false);
    s.draw(ctx, "TORDIFF.", 276, hy, INK, false);
    hline(ctx, 7, 25, 305, INK);
    // Auf- und Abstieg mit den Farben des Originals, in DOSBox nachgemessen (GitLab #55): der
    // helle Grünton steht nur dem Meister der Bundesliga zu, Oliv den Aufstiegs- und
    // Europaplätzen (Bundesliga 2.-5., 2. Liga 1.-3. mit der Relegation, Oberliga 1.-4.), Rot
    // den Abstiegsplätzen aus der Tabelle 4cb3:2266 = [3, 4, 4] - auch in der Oberliga.
    const [hell, oliv, rotAb] = [[1, 4, 3], [0, 3, 4], [0, 4, 4]][league];
    let y = 29;
    rows.forEach((r, i) => {
      const own = g.activeManagers().some((mm) => mm.clubIndex === r.club);
      // Der eigene Verein steht in Palettenfarbe 12, nicht in Weiß
      const c = own ? PLATE : INK;
      const farbe = i < hell ? GRUEN : i < hell + oliv ? OLIV : rotAb > 0 && i >= rows.length - rotAb ? ROT : null;
      if (farbe) {
        ctx.fillStyle = farbe;
        ctx.fillRect(9, y - 1, 11, 7);
      }
      // Die Zeilen tragen im Original keinen Schatten
      // Die Platzziffer steht weiß, unabhängig von der Farbe der Zeile (im Original gemessen)
      s.drawRight(ctx, i + 1 + ".", 21, y, COLORS.white, false);
      s.draw(ctx, toGame(g.clubs.at(r.club).displayName), 21, y, c, false);
      s.draw(ctx, r.s.lastResults, 103, y, c, false);
      s.drawRight(ctx, String(r.games), 159, y, c, false);
      s.drawRight(ctx, String(r.w), 179, y, c, false);
      s.drawRight(ctx, String(r.d), 191, y, c, false);
      s.drawRight(ctx, String(r.l), 203, y, c, false);
      if (punkteJeSieg === 2) {
        s.drawRight(ctx, String(r.pts), 221, y, c, false);
        s.draw(ctx, ":", 221, y, c, false);
        s.drawRight(ctx, String(r.pa), 234, y, c, false);
      } else s.drawRight(ctx, String(r.pts), 227, y, c, false);
      s.drawRight(ctx, String(r.gf), 257, y, c, false);
      s.draw(ctx, ":", 257, y, c, false);
      s.drawRight(ctx, String(r.ga), 275, y, c, false);
      const diff = r.gf - r.ga;
      // Das Plusminus liegt in der Schrift des Spiels auf '#'
      s.draw(ctx, diff > 0 ? "+" : diff < 0 ? "-" : "#", 287, y, c, false);
      s.drawRight(ctx, String(Math.abs(diff)), 301, y, c, false);
      // Ein Klick auf die Zeile öffnet "Info über <Verein>" (0x2D0BA): Modus nach der Ansicht
      // (4cb3:5538), der Platz ist der gezeigte
      if (!weiter) {
        const modus = this.tableMode === "heim" ? 0 : this.tableMode === "auswaerts" ? 1 : 2;
        this.hit(7, y - 1, 306, 7, () => this.oeffneVereinsInfo(r.club, modus, 0, i + 1));
      }
      y += 7;
    });
    hline(ctx, 7, 169, 305, INK);
    // Knopfrahmen des Originals (in DOSBox nachgemessen): 57x12 mit schwarzer Füllung, oben
    // #8282a2, links #a2a2c3, rechts #303051 und unten #414161 - je einen Punkt breit
    const knopf = (label: string, x: number, aktiv: boolean, action: () => void) => {
      const y0 = 174;
      const w = 57;
      const h = 12;
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(x + 1, y0 + 1, w - 2, h - 2);
      ctx.fillStyle = "#8282a2";
      ctx.fillRect(x + 1, y0, w - 2, 1);
      ctx.fillStyle = "#a2a2c3";
      ctx.fillRect(x, y0 + 1, 1, h - 2);
      ctx.fillStyle = "#303051";
      ctx.fillRect(x + w - 1, y0 + 1, 1, h - 2);
      ctx.fillStyle = "#414161";
      ctx.fillRect(x + 1, y0 + h - 1, w - 2, 1);
      // Der gewählte Knopf trägt ein helleres Rot als die Abstiegsmarke (#b20020 statt #920010)
      s.drawCenter(ctx, toGame(label), x + 29, 178, aktiv ? "#b20020" : INK, false);
      this.hit(x, y0, w, h, action);
    };
    knopf("HEIM", 30, this.tableMode === "heim", () => (this.tableMode = "heim"));
    knopf("GESAMT", 132, this.tableMode === "gesamt", () => (this.tableMode = "gesamt"));
    knopf("AUSW[RTS", 234, this.tableMode === "auswaerts", () => (this.tableMode = "auswaerts"));
    // Unter der Tafel steht "Tabelle" und der Name der Liga aus dem Katalog, mittig über
    // x 134 (nicht über die ganze Breite - rechts steht der Knopf zum Hauptmenü), oberste
    // Zeile 214, mit Schatten
    f.drawCenter(ctx, toGame(`Tabelle ${texte("ui.ligen")[league]}`), 134, 214, PLATE);
    if (weiter) {
      this.iconFrame(268, 196);
      drawIcon(ctx, this.assets, "weiter", 277, 202);
      this.hit(268, 196, 46, 36, weiter);
    } else this.sideButtons();
  }

  /** Einfaches Untermenü als Liste, bis die Originalbildschirme nachgebaut sind. */
  drawListMenu(title: string, entries: [string, () => void][]): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    panel(ctx, 40, 30, 200, 24 + entries.length * 20);
    f.drawCenter(ctx, title, 140, 36, COLORS.white);
    let y = 54;
    for (const [label, action] of entries) {
      bevel(ctx, 50, y - 3, 180, 16);
      f.draw(ctx, label, 58, y + 1, COLORS.white, false);
      this.hit(50, y - 3, 180, 16, action);
      y += 20;
    }
    this.sideButtons();
  }

  /**
   * Verlauf: Erfolge und Gesamtentwicklung (0x29C30), am Original vermessen. Oben der Kasten
   * (5,8) 309x144 mit der Kopfzeile "Sais. Pl.   Liga       DfB-Pokal       Europapokal" bei
   * x 10 (unterste Zeile 17) in Farbe 11 und einem Strich bei y 19 von x 5 bis 312. Ohne
   * abgeschlossene Saison steht dort in kleiner Schrift mittig über die ganze Breite (Zeile 29)
   * "NOCH HABEN SIE KEINE HISTORISCH SONDERLICH WICHTIGEN ERFOLGE ERZIELT...". Unten der
   * schwarze Kasten (5,157) 258x73 mit der Überschrift "Gesamtentwicklung" mittig zwischen 6
   * und 262 (Zeile 165) und einem Strich bei y 167.
   */
  drawVerlauf(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const m = g.managers.at(this.manager);
    const h = m.history(g.save.plain[34224] | (g.save.plain[34225] << 8));
    const gelb = "#d3c3b2";
    const hell = "#a2a2c3";
    panel(ctx, 5, 8, 309, 144);
    f.draw(ctx, T("ui.verlauf", 0), 10, 11, gelb, false);
    hline(ctx, 5, 19, 308, gelb);
    if (h.length === 0) {
      const t = T("ui.verlauf", 1);
      const x = 160 - Math.trunc(s.width(t) / 2);
      s.draw(ctx, t, x + 1, 25, "#303051", false);
      s.draw(ctx, t, x, 25, hell, false);
    }
    // Spalten am Original vermessen: Saison links bei 12, Platz links bei 42, die drei
    // Textspalten mittig über 85, 143 und 246 (GitLab #56). Inhalt wie 0x29F11 bis 0x2A2C9:
    // Saison = 1963, ab einem Startjahr nach 1970 1991, + Managerbyte 315 + Zeile; Platz = Rang
    // minus Ligaversatz, gelb (Farbe 11) für den Meister; Liga aus Byte 63; DFB-Pokal aus Byte 64
    // (Bit 7 "SIEGER" gelb, sonst Rundentext 4cb3:24C0[b & 7]); Europapokal aus Byte 65 (Bit 7
    // "SIEGER", sonst Rundentext 24C4[b & 7], dazu der Wettbewerb, Landesmeister und
    // Pokalsieger gekürzt; ohne Wettbewerbsbits "nicht im wettbewerb"). Alles in Großbuchstaben
    // (0x3196D). 16 Saisons je Seite, ein Klick blättert weiter.
    const seiten = Math.max(1, Math.ceil(h.length / 16));
    if (this.verlaufSeite >= seiten) this.verlaufSeite = 0;
    const saisons = g.save.plain[34224] | (g.save.plain[34225] << 8);
    const jahr0 = 1963 + (g.year - saisons > 1970 ? 28 : 0) + m.u8(315);
    const gross = (t: string) => t.toUpperCase();
    const dfbText = texte("verlauf.dfb");
    const sieger = texte("verlauf.sieger");
    h.forEach((e, i) => {
      if (Math.trunc(i / 16) !== this.verlaufSeite) return;
      const y = 25 + 8 * (i % 16);
      s.draw(ctx, String(jahr0 + i), 12, y, hell, false);
      if (e.rank === 0xff) {
        s.draw(ctx, texte("verlauf.nochnicht")[0], 42, y, hell, false);
      } else {
        // Den Platz füllt das Original links mit '^' auf zwei Stellen auf - das Zeichen ist leer
        // und so breit wie eine Ziffer, die einstelligen Plätze rücken damit um fünf Punkte ein
        s.draw(ctx, `${"^".repeat(Math.max(0, 2 - String(e.place).length))}${e.place}.`, 42, y, e.rank === 1 && e.league === 0 ? gelb : hell, false);
        const liga = gross(texte("ui.ligen")[e.league] ?? "");
        s.drawCenter(ctx, liga, 85, y, hell, false);
        const dfb = e.dfb & 0x80 ? sieger[0] : gross(dfbText[e.dfb & 7] ?? "");
        s.drawCenter(ctx, dfb, 143, y, e.dfb & 0x80 ? gelb : hell, false);
        // Der Rundentext steht im selben Puffer wie vorher der DFB-Text (bzw. beim DFB-Sieger der
        // Liganame): ohne Runde und ohne Siegerbit bleibt der stehen
        let europa = e.dfb & 0x80 ? (texte("ui.ligen")[e.league] ?? "") : (dfbText[e.dfb & 7] ?? "");
        if (e.europe & 0x80) europa = sieger[1];
        else if (e.europe & 7) europa = dfbText[(e.europe & 7) + 1] ?? "";
        if ((e.europe & 0xf8) === 0) europa = T("ui.verlauf", 3);
        else {
          const w = (e.europe & 0x18) >> 3;
          let name = texte("verlauf.europa")[w] ?? "";
          if (w === 1 || w === 2) name = name.slice(0, 18 - w) + ".";
          europa += name;
        }
        s.drawCenter(ctx, gross(europa), 246, y, e.europe & 0x80 ? gelb : hell, false);
      }
      // Unter jeder Saison ein Strich in Palettenfarbe 6, von x 6 über 307 Punkte
      hline(ctx, 6, y + 6, 307, "#414161");
    });
    if (seiten > 1) this.hit(5, 8, 309, 144, () => (this.verlaufSeite = (this.verlaufSeite + 1) % seiten));
    panel(ctx, 5, 157, 259, 74, COLORS.black);
    const t2 = T("ui.verlauf", 2);
    f.draw(ctx, t2, 6 + Math.trunc(256 / 2) - Math.trunc(f.width(t2) / 2), 159, gelb, false);
    hline(ctx, 6, 167, 257, gelb);
    // Gesamtentwicklung: je Saison ein Balken, fünf Punkte breit und ohne Lücke ab x 7. Die
    // Höhe kommt aus dem Rang über alle drei Ligen (1 bis 58): der Balken beginnt bei
    // y = 170 + Rang und endet auf 228. Die Farbe hängt nicht am Balken, sondern an der Höhe:
    // das Feld ist in drei waagerechte Bänder geteilt (Rang 1..18, 19..38, 39..58), und ein
    // Balken, der durch mehrere läuft, wechselt dabei die Farbe. So sieht man auf einen Blick,
    // in welcher Liga der Verein stand. Palettenfarben 25, 26, 27; die 25 für die Bundesliga
    // ist die einzige, die im Original noch nicht nachgemessen ist.
    const ligafarbe = ["#928251", "#826141", "#614130"];
    h.forEach((e, i) => {
      for (let y = 170 + Math.max(1, e.rank); y <= 228; y++) {
        const rang = y - 170;
        ctx.fillStyle = ligafarbe[rang > 38 ? 2 : rang > 18 ? 1 : 0];
        ctx.fillRect(7 + i * 5, y, 5, 1);
      }
    });
    this.sideButtons([]);
  }

  /**
   * Büro "Statistik" (0x26E90), Punkt für Punkt am Original vermessen (GitLab #56).
   *
   * Alle Beschriftungen stehen im Original in einer Tabelle (4cb3:2448) und werden von einer
   * einzigen Schleife (0x276C4) gesetzt; ein '!' davor macht eine Überschrift daraus. Daraus
   * ergibt sich das ganze Raster:
   *
   *   Überschrift (0x27712): y += 6, Text mit der Unterkante auf y-2 in der großen Schrift,
   *     darunter ein Strich auf y von x bis x + Textbreite, danach y += 11.
   *   Beschriftung (0x26F88): kleine Schrift, Unterkante auf y, danach y += 8; ab !ZUSCHAUER
   *     y += 15, weil der Wert dort eine Zeile tiefer steht (0x2769E).
   *
   * Die linke Spalte beginnt bei (8,16), die rechte bei (209,16), der Kasten unten bei (8,197);
   * nach MINUSKULISSE bleiben 18 Punkte für die Zuschauergrafik frei (0x276BF). Die Werte der
   * linken Spalte stehen bei x = 84 + 34·Spalte (0x270CF), die der Monatsbilanz bei x = 148
   * (0x26FC7). Farben: Überschriften Palette 11, Beschriftungen 1, Werte 2 - nirgends Weiß und
   * nirgends ein Schatten.
   */
  drawStatistik(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    // Der Guthabenzins der Monatsvorschau hängt an der laufenden Tagessumme des Servers
    const summe = this.server.kontosummen?.[this.manager];
    const st = statistics(g, this.manager, summe === undefined ? undefined : { sum: summe, tag: g.date.day });
    const club = (c: number | null) => (c === null ? "" : cp437ToGame(g.clubs.at(c).name));
    // Zahlen füllt das Original links mit '^' auf zwei Stellen auf (Mindestbreite 4cb3:079C,
    // in 0x26FDB auf 2 gesetzt); die Null zeigt es als "^@", und '@' ist in der Schrift ein
    // Strich. '^' ist an dieser Stelle breit wie eine Ziffer, so stehen die Klammern im Raster.
    const pad = (n: number) => (n ? "^".repeat(Math.max(0, 2 - String(n).length)) + n : "^@");
    const fmt = (cur: number, rec: number) => `${pad(cur)}(${pad(rec)})`;
    const fuell = (x1: number, y1: number, x2: number, y2: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    };
    const rahmen = (x1: number, y1: number, x2: number, y2: number, c: string) => {
      fuell(x1, y1, x2, y1, c);
      fuell(x1, y2, x2, y2, c);
      fuell(x1, y1, x1, y2, c);
      fuell(x2, y1, x2, y2, c);
    };
    let x = 8;
    let y = 16;
    const ueberschrift = (t: string) => {
      y += 6;
      f.draw(ctx, t, x, y - 8, PLATE, false);
      hline(ctx, x, y, f.width(t) + 1, PLATE);
      y += 11;
    };
    const zeile = (t: string, wert: (oben: number) => void, schritt = 8) => {
      s.draw(ctx, t, x, y - 4, BESCHRIFTUNG, false);
      wert(y - 4);
      y += schritt;
    };
    const spalten = (v: (c: number) => string) => (oben: number) =>
      [0, 1, 2].forEach((c) => s.draw(ctx, v(c), 84 + 34 * c, oben, WERT, false));

    panel(ctx, 5, 8, 196, 181);
    ueberschrift("SERIEN");
    st.series.forEach((r, i) => zeile(seriesRows()[i], spalten((c) => fmt(r.current[c], r.record[c]))));
    // Tore und Gegentore je Spiel stehen mit zwei Leerzeichen davor (0x26FF3)
    zeile("TORE/SPIEL", spalten((c) => `  ${st.goalsPerGame[c].toFixed(1)}`));
    zeile(T("ui.statistik", 0), spalten((c) => `  ${st.againstPerGame[c].toFixed(1)}`));
    ueberschrift("REKORDE");
    st.records.forEach((r, i) =>
      zeile(recordRows()[i], (oben) =>
        s.draw(ctx, r.text ? `${r.text} (${club(r.opponent)})` : T("ui.statistik", 1), 84, oben, WERT, false)));
    // Die Spaltenköpfe setzt das Original erst nach der Schleife in der großen Schrift (0x277FD)
    f.draw(ctx, "G       H       A", 92, 14, PLATE, false);

    panel(ctx, 205, 8, 109, 181);
    x = 209;
    y = 16;
    const a = st.attendance;
    const rechts = (t: string, v: string) => zeile(t, (oben) => s.draw(ctx, v, x, oben + 6, WERT, false), 15);
    // Zahlen wie 0x7D31: Tausenderpunkte, links mit '^' auf die Mindestbreite 4cb3:079C
    // aufgefüllt (Punkte zählen mit), die Null als "0"; negative ohne Auffüllen
    const zahl = (n: number, breite = 2) => {
      if (n < 0) return "-" + dm(-n).replace(" DM", "");
      const t = n === 0 ? "0" : dm(n).replace(" DM", "");
      return "^".repeat(Math.max(0, breite - t.length)) + t;
    };
    const [keine, keiner] = texte("ui.nochkeine");
    ueberschrift("ZUSCHAUER");
    // Vor dem ersten Heimspiel stehen statt der Zahlen Hinweise (0x271FB, 0x27242)
    rechts(T("ui.statistik", 5), a.games === 0 ? keine : zahl(a.total));
    rechts(T("ui.statistik", 6), a.games === 0 ? keiner : zahl(a.average));
    rechts(T("ui.statistik", 7), zahl(a.needed));
    // Bei diesen beiden steht die Zahl noch in derselben Zeile hinter der Beschriftung - und
    // zwar schon in der Wertfarbe -, der Gegner eine Zeile tiefer. Ohne Rekord (0 bzw. 99999)
    // steht dort nur der Hinweis, keine Zahl (0x272B1, 0x27333)
    const rekord = (t: string, wert: number, gegner: number | null, leer: string) =>
      zeile(t, (oben) => {
        if (gegner === null) {
          s.draw(ctx, leer, x, oben + 6, WERT, false);
          return;
        }
        s.draw(ctx, zahl(wert), x + s.width(t), oben, WERT, false);
        s.draw(ctx, `(${club(gegner)})`, x, oben + 6, WERT, false);
      }, 15);
    rekord("ZUSCHAUERREKORD: ", a.record, a.record === 0 ? null : a.recordOpponent, keiner);
    rekord("MINUSKULISSE: ", a.minus, a.minusOpponent, keine);
    y += 18;
    ueberschrift("FINANZEN");
    rechts("KONTOSTAND", `${zahl(st.balance)} DM`);
    rechts(T("ui.statistik", 8), `${zahl(st.debt)} DM`);

    panel(ctx, 5, 192, 196, 40);
    x = 8;
    y = 197;
    ueberschrift(T("ui.statistik", 2));
    // Monatsbilanz mit Mindestbreite 7 (0x27587)
    zeile(T("ui.statistik", 3), (oben) => s.draw(ctx, `${zahl(st.income, 7)} DM`, 148, oben, WERT, false));
    zeile(T("ui.statistik", 4), (oben) => s.draw(ctx, `${zahl(st.expenses, 7)} DM`, 148, oben, WERT, false));

    // Zuschauergrafik (0x2785F): Rahmen (208,104) bis (305,119), Innenfläche schwarz. Je
    // Heimspiel ein Balken der Höhe (Wert - kleinster)·11/Spanne + 2, gemessen von y 118 nach
    // oben: erst der Umriss (209+5i,118-h) bis (214+5i,118), dann gefüllt ab (210+5i,119-h).
    // Die Balken stehen im Abstand 5 und sind 6 breit, der nächste Umriss deckt also die
    // rechte Kante des vorigen zu. Nur die linke und die obere Kante bleiben sichtbar.
    rahmen(208, 104, 305, 119, RAHMEN);
    fuell(209, 105, 304, 118, COLORS.black);
    if (a.history.length) {
      const klein = Math.min(...a.history);
      const spanne = Math.max(...a.history) - klein || 1;
      a.history.forEach((v, i) => {
        const h = Math.trunc(((v - klein) * 11) / spanne) + 2;
        rahmen(209 + 5 * i, 118 - h, 214 + 5 * i, 118, SKALA[2]);
        fuell(210 + 5 * i, 119 - h, 214 + 5 * i, 118, "#920010");
      });
    }

    // Farbskala (0x27A5D): Rahmen (208,170) bis (305,185), Innenfläche schwarz. Von x 209 bis
    // 304 läuft eine Schwelle von -2.375.000 DM in Schritten von 50.000 mit; alle sieben Punkte
    // rückt die Farbe eine Stufe weiter, die letzte reicht bis zum Rand. Die Spalte, in deren
    // Schritt Kontostand minus Schulden fällt, geht über die volle Höhe 171..184, alle anderen
    // nur von 174 bis 181. Liegt der Betrag darunter oder darüber, setzt das Original die Marke
    // zusätzlich ganz links bzw. ganz rechts (0x27B17, 0x27B4C).
    rahmen(208, 170, 305, 185, RAHMEN);
    fuell(209, 171, 304, 184, COLORS.black);
    const stand = st.balance - st.debt;
    let stufe = 0;
    let schwelle = -2375000;
    for (let px = 209; px < 305; px++) {
      const marke = stand < schwelle && stand + 50000 >= schwelle;
      fuell(px, marke ? 171 : 174, px, marke ? 184 : 181, SKALA[stufe]);
      if ((px + 1 - 209) % 7 === 0 && stufe < 12) stufe++;
      schwelle += 50000;
    }
    if (stand <= -2375000) fuell(209, 171, 209, 184, SKALA[0]);
    if (stand > 2325000) fuell(304, 171, 304, 184, SKALA[12]);
    this.sideButtons([]);
  }

  /**
   * Ewige Tabelle und Ewige Bilanz (0x27C98), am Original vermessen. Links der Kasten (5,8)
   * 136x223: Überschrift mittig zwischen 5 und 140 (unterste Zeile 17), Strich bei y 19, dann
   * ab y 27 im Abstand 7 die Vereine - Platz und Name bei x 9, die Punkte (Tabellensatz i32 bei
   * 50, modulo 100000) bei x 111, beide links mit '^' aufgefüllt. Gezeigt werden die ersten 23
   * Plätze; die Vereine der Manager stehen darunter hinter einer senkrechten Punktreihe bei
   * x 13 in Farbe 11.
   *
   * Rechts der Kasten (145,8) 169x181 mit den Kränzen aus PIC/36.VGA (21x113) bei (155,22) und
   * (281,22), fünf Titelzeilen bei y 30 + 23·i mit dem Wert darunter bei y 38 + 23·i und
   * darunter die Bilanz: Kopfzeile bei x 183 (Zeile 147), Zeilen ab Zeile 156 im Abstand 7 mit
   * dem Bezeichner bei x 148. Punkte und Tore stehen als zwei Zahlen bei x 169 + 48·k (mit
   * Doppelpunkt) und 192 + 48·k, Siege, Niederlagen und Unentschieden einzeln bei 179 + 48·k.
   */
  drawEwige(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const hell = "#a2a2c3";
    const gelb = "#d3c3b2";
    const managerClubs = new Set(g.activeManagers().map((m) => m.clubIndex));
    const pad = (n: number, breite: number) => "^".repeat(Math.max(0, breite - String(n).length)) + n;
    // Links: Ewige Tabelle
    panel(ctx, 5, 8, 136, 223);
    const t1 = T("ui.ewige", 0);
    f.draw(ctx, t1, 5 + Math.trunc(135 / 2) - Math.trunc(f.width(t1) / 2), 11, gelb, false);
    hline(ctx, 6, 19, 134, gelb);
    // Wie 0x281EA: alle 64 Sätze, Platz = Stelle + 1. Ein Managerverein zählt nur unter den
    // ersten 23 mit; gezeigt wird bis Stelle 23 + gezählt und jeder Managerverein. Nach der
    // Zeile an Stelle gezählt + 22 folgt die Punktreihe, wenn noch ein Managerverein fehlt.
    // Punkte mit Tausenderpunkten (4cb3:07B2 = 0), Mindestbreite 4
    const tabelle = allTimeTable(g, true);
    const punkte = (n: number) => pad(n, 4).replace(/\d+$/, (z) => z.replace(/\B(?=(\d{3})+$)/g, "."));
    let zeile = 0;
    let gezeigt = 0;
    tabelle.forEach((r, i) => {
      const eigener = managerClubs.has(r.club);
      if (eigener && i < 23) gezeigt++;
      if (i >= 23 + gezeigt && !eigener) return;
      const y = 23 + 7 * zeile;
      const c = eigener ? gelb : hell;
      s.draw(ctx, `${pad(i + 1, 2)}. ${cp437ToGame(g.clubs.at(r.club).name)}`, 9, y, c, false);
      s.draw(ctx, punkte(r.points), 111, y, c, false);
      zeile++;
      if (i === gezeigt + 22 && managerClubs.size !== gezeigt) {
        const y0 = 22 + 7 * zeile;
        ctx.fillStyle = hell;
        for (let k = 0; k < 6; k++) ctx.fillRect(13, y0 + 2 * k, 1, 1);
        zeile += 2;
      }
    });
    // Rechts: Ewige Bilanz
    panel(ctx, 145, 8, 169, 181);
    const t2 = T("ui.ewige", 1);
    f.draw(ctx, t2, 145 + Math.trunc(168 / 2) - Math.trunc(f.width(t2) / 2), 11, gelb, false);
    hline(ctx, 146, 19, 167, gelb);
    const kraenze = this.assets.img("36.VGA");
    if (kraenze) {
      ctx.drawImage(kraenze, 0, 0, 21, 113, 155, 22, 21, 113);
      ctx.drawImage(kraenze, 0, 0, 21, 113, 281, 22, 21, 113);
    }
    // Ring um den linken Kranz (0x28455): grün, solange der Titel noch zu holen ist, sonst rot
    const mgr = g.managers.at(this.manager);
    // Kreis mit Halbmesser 11 wie der Zeichner des Originals, je Zeile die x-Abstände
    const RING = [[11], [11], [11], [11], [10], [10], [9], [8], [7, 8], [6], [4, 5], [0, 1, 2, 3]];
    const kreis = (cx: number, cy: number, color: string) => {
      ctx.fillStyle = color;
      RING.forEach((dxs, dy) => {
        for (const dx of dxs) for (const sy of dy === 0 ? [0] : [-dy, dy]) for (const sx of dx === 0 ? [0] : [-dx, dx]) ctx.fillRect(cx + sx, cy + sy, 1, 1);
      });
    };
    // Grün (0x283D9 bis 0x2847E): Meisterschaft, solange der Verein in der Bundesliga spielt
    // und sie nicht verspielt ist (Merkbit 0 von 4238:4BEC); Pokale, solange das Pokalbyte des
    // Managers die laufende Runde 4238:0008.. trägt
    const merk = this.server.merkbits?.[this.manager] ?? 0;
    for (let i = 0; i < 5; i++) {
      const offen = i === 0 ? mgr.u8(312) === 0 && (merk & 1) === 0 : mgr.u8(305 + i) === g.save.plain[28232 + i];
      kreis(165, 32 + 23 * i, offen ? "#617120" : "#b20020");
    }
    const bal = allTimeBalance(g, this.manager);
    // Titel und Wert stehen in kleiner Schrift mit schwarzem Schatten ein Pixel rechts
    const mittig = (text: string, x1: number, x2: number, y: number, color: string) => {
      const x = x1 + Math.trunc((x2 - x1) / 2) - Math.trunc(s.width(text) / 2);
      s.draw(ctx, text, x + 1, y, COLORS.black, false);
      s.draw(ctx, text, x, y, color, false);
    };
    [T("ui.ewige", 2), "DFB-POKALE", T("ui.ewige", 3), T("ui.ewige", 4), "UEFA-POKALE"].forEach((t, i) => {
      mittig(t, 176, 286, 26 + 23 * i, hell);
      const n = bal.titles[i];
      mittig(n ? String(n) : T("ui.ewige", 5), 176, 281, 34 + 23 * i, n ? gelb : hell);
    });
    s.draw(ctx, toGame(T("ui.ewige", 6)), 183, 143, hell, false);
    bal.rows.forEach((r, i) => {
      const y = 152 + 7 * i;
      s.draw(ctx, r.label, 148, y, hell, false);
      r.columns.forEach(([a, b], k) => {
        if (b === null) s.draw(ctx, pad(a, 4), 179 + 48 * k, y, hell, false);
        else {
          s.draw(ctx, `${pad(a, 4)}:`, 169 + 48 * k, y, hell, false);
          s.draw(ctx, pad(b, 4), 192 + 48 * k, y, hell, false);
        }
      });
    });
    this.sideButtons([]);
  }

  /**
   * Werbung (Bildschirm 0x28ED8): Hintergrund PIC/46.CP, Sponsorenlogos PIC/32.VGA, Pfeile und
   * Schaltflächen PIC/31.VGA. Alle Maße stammen aus dem Original:
   *
   *   Bandenfeld i (0x28CE6/0x28D40): Logo 38x30 bei (52·i + 8, 19); ohne Vertrag füllt eine
   *     Fläche in Farbe 9 den Kasten (52·i + 8, 19) bis (52·i + 46, 49).
   *   Auswahlrand (0x286D4): nur untere und rechte Kante, y 50 von x 52·i + 5 bis 52·i + 54 und
   *     x 52·i + 54 von y 19 bis 50, Farbe 29 (gewählt) bzw. 28.
   *   Foto: Rahmen (5,59) bis (110,229), dieselben Farben; das Trikotlogo (0x287DD) ist das
   *     kleine Logo 26x16 bei (51,110).
   *   Vertragskasten: Logo 38x30 bei (127,67) (0x2877A), Text bei y 62, Betrag bei y 74,
   *     mittig zwischen x 217 und 313 (0x28841). Pfeile 30x23 bei (181,60) und (181,84),
   *     OK und NEIN 48x16 bei (217,91) und (265,91) aus PIC/31.VGA.
   *   Einnahmen und Ausgaben rechtsbündig bis x 308.
   *
   * Die Werbeausgaben ändert ein Klick um 2500 DM; über 50.000 springt der Wert auf 2.500
   * zurück (0x29455).
   */
  drawWerbung(): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const g = this.game!;
    const m = this.manager;
    const bg = this.assets.img("46.CP");
    if (bg) ctx.drawImage(bg, 0, 0);
    else panel(ctx, 2, 2, 316, 236);
    const page = this.werbungPage;
    const logos = this.assets.img("32.VGA");
    const ui = this.assets.img("31.VGA");
    // Palette 1.PAL: 9 = Feldfüllung, 28 = Rand, 29 = gewählter Rand
    const FIELD = "#907050";
    const EDGE = "#503020";
    const EDGE_SEL = "#f2f2f2";
    /** Sponsorenlogo aus PIC/32.VGA: groß 38x30 (Spaltenbreite 39), klein 26x16 (Breite 28). */
    const smallLogos = this.assets.maskedImg("32.VGA", 240, 240, 0);
    const drawLogo = (sp: number, x: number, y: number, small: boolean) => {
      const col = sp % 5;
      if (small) {
        if (smallLogos) ctx.drawImage(smallLogos, col * 28, sp < 5 ? 67 : 85, 26, 16, x, y, 26, 16);
      } else if (logos) ctx.drawImage(logos, col * 39, sp < 5 ? 1 : 34, 38, 30, x, y, 38, 30);
    };
    // Sechs Bandenfelder; der belegte zeigt das große Logo seines Sponsors
    for (let i = 0; i < 6; i++) {
      const x = 52 * i;
      const c = boardContract(g, m, i);
      if (c.months > 0) drawLogo(c.sponsor, x + 8, 19, false);
      else {
        ctx.fillStyle = FIELD;
        ctx.fillRect(x + 8, 19, 39, 31);
      }
      ctx.fillStyle = page === 1 && this.werbungSlot === i ? EDGE_SEL : EDGE;
      ctx.fillRect(x + 5, 50, 50, 1);
      ctx.fillRect(x + 54, 19, 1, 32);
      this.hit(x + 5, 16, 50, 35, () => {
        this.werbungPage = 1;
        this.werbungSlot = i;
        this.werbungOffer = 0;
        this.werbungActive = false;
      });
    }
    // Foto links: Trikotsponsor; das Logo sitzt auf dem Trikot des Spielers
    const shirtC = shirtContract(g, m);
    if (shirtC.months > 0) drawLogo(shirtC.sponsor, 51, 110, true);
    ctx.strokeStyle = page === 0 ? EDGE_SEL : EDGE;
    ctx.lineWidth = 1;
    ctx.strokeRect(5.5, 59.5, 105, 170);
    this.hit(5, 56, 107, 174, () => {
      this.werbungPage = 0;
      this.werbungOffer = 0;
      this.werbungActive = false;
    });
    // Angebot: erst ein Klick auf den Kasten öffnet die Sponsorenansicht (wie im Original),
    // danach blättern die Pfeile durch alle zehn Sponsoren
    const cur = page === 0 ? shirtC : boardContract(g, m, this.werbungSlot);
    this.hit(127, 67, 38, 30, () => {
      this.werbungActive = true;
      this.werbungOffer = 0;
    });
    if (cur.months > 0) {
      // Laufender Vertrag: das Original nennt hier die Restmonate (0x28841 mit Monatsform)
      drawLogo(cur.sponsor, 127, 67, false);
      s.drawCenter(ctx, toGame(`VERTRAG: ${cur.months} MONAT${cur.months === 1 ? "" : "E"}`), 265, 62, COLORS.white);
      s.drawCenter(ctx, dm(advertisingAmount(g, m, page === 0 ? 0 : 1 + this.werbungSlot)), 265, 74, COLORS.white);
    } else if (!this.werbungActive) {
      s.drawCenter(ctx, "SPONSOREN ANSEHEN", 265, 68, COLORS.textDim);
    } else {
      // Durchgeblättert werden alle zehn Sponsoren; ohne Angebot steht dort "KEIN INTERESSE..."
      const sp = ((this.werbungOffer % 10) + 10) % 10;
      const amount = offerAmount(g, m, page, sp);
      const years = offerYears(g, m, page, sp);
      drawLogo(sp, 127, 67, false);
      if (ui) {
        ctx.drawImage(ui, 0, 0, 30, 23, 181, 60, 30, 23);
        ctx.drawImage(ui, 0, 23, 30, 23, 181, 84, 30, 23);
        const sx = amount === 0 ? 96 : 0;
        ctx.drawImage(ui, sx, 47, 48, 16, 217, 91, 48, 16);
        ctx.drawImage(ui, sx, 63, 48, 16, 265, 91, 48, 16);
      }
      this.hit(181, 60, 30, 23, () => (this.werbungOffer = (this.werbungOffer + 9) % 10));
      this.hit(181, 84, 30, 23, () => (this.werbungOffer = (this.werbungOffer + 1) % 10));
      if (amount === 0) s.drawCenter(ctx, T("ui.werbung", 0), 265, 78, COLORS.textDim);
      else {
        s.drawCenter(ctx, toGame(`VERTRAG: ${years} JAHR${years === 1 ? "" : "E"}`), 265, 62, COLORS.white);
        s.drawCenter(ctx, dm(amount), 265, 74, COLORS.white);
        this.hit(217, 91, 48, 16, () => this.signSponsor(sp));
        this.hit(265, 91, 48, 16, () => (this.werbungActive = false));
      }
    }
    // Einnahmen und Ausgaben in den schwarzen Feldern des Hintergrunds
    const boards = [1, 2, 3, 4, 5, 6].reduce((n, i) => n + advertisingAmount(g, m, i), 0);
    const shirt = advertisingAmount(g, m, 0);
    const tv = advertisingAmount(g, m, 7);
    const spend = advertisingAmount(g, m, 8);
    s.drawRight(ctx, dm(shirt), 308, 130, COLORS.white);
    s.drawRight(ctx, dm(boards), 308, 144, COLORS.white);
    s.drawRight(ctx, dm(tv), 308, 158, COLORS.white);
    s.drawRight(ctx, dm(spend), 308, 187, COLORS.white);
    s.drawRight(ctx, dm(shirt + boards + tv - spend), 308, 212, COLORS.white);
    // Werbeausgaben ändern: links weniger, rechts mehr (2500 DM je Klick)
    this.hit(199, 185, 55, 11, () => void this.post("api/werbebudget", { manager: m, player: this.player, up: 0 }));
    this.hit(254, 185, 55, 11, () => void this.post("api/werbebudget", { manager: m, player: this.player, up: 1 }));
    // Das Original hat hier keine Schaltfläche; man verlässt den Bildschirm mit der rechten Maustaste
  }

  /** Angebot annehmen: Trikot direkt, Bande auf den ersten freien Platz. */
  signSponsor(sponsor: number): void {
    if (!this.online) {
      this.status = "Vertragsabschluss nur im Mehrspielermodus";
      return;
    }
    const g = this.game!;
    if (this.werbungPage === 0) {
      void this.post("api/werbung", { manager: this.manager, kind: "shirt", sponsor });
      return;
    }
    // Der Vertrag gilt dem ausgewählten Bandenplatz, nicht irgendeinem freien
    const slot = this.werbungSlot;
    if (boardContract(g, this.manager, slot).months !== 0) {
      this.status = "Dieser Platz ist schon vergeben";
      return;
    }
    void this.post("api/werbung", { manager: this.manager, kind: "board", slot, sponsor }).then(() => (this.werbungActive = false));
  }

  /**
   * Stadion (0x0602). Maße aus dem Original: drei Rahmen bei (6,15) 139x82 (Stadionbild),
   * (150,15) 139x82 (Angebotskasten) und (6,104) 283x82 (Übersicht); die Schaltfläche
   * HAUPTMENÜ steht bei (268,193).
   *
   * Übersicht: neun Zeilen ab y 114 im Abstand 8, Zeile 0 ist die Gesamtkapazität, 1..8 sind
   * die Ausbauarten. Bezeichner ab x 9, MOMENTAN ab x 117, NACH AUSBAU ab x 190. Fährt die
   * Maus über eine Zeile, steht ihr Name unten groß im Bild und der Kasten rechts zeigt die
   * Angaben dazu: Titel bei y 22, Trennlinie bei y 24 und y 66, darunter "KOSTET ... DM PRO
   * 1000" bzw. "... DM PRO PUNKT" (y 73), "MAX. GRÖSSE: ..." (y 80), " KOSTEN: ..." (y 87)
   * und "IHR KONTOSTAND: ..." (y 94).
   *
   * Das Stadionbild richtet sich nach der Kapazität (0x16E3): PIC/9.VGA, dazu je eine Nummer
   * mehr über 14.000, 34.000 und 54.000 Plätzen.
   */
  /**
   * Flutlichtmasten und Anzeigetafel über dem Grundbild des Stadions (GitLab #63). Beide liegen
   * in PIC/40.VGA, je drei Größen mal drei Farben: blaugrau für ein neues Stadion, gemischt und
   * braun für ein verrostetes. Am Original vermessen: die kleine Anzeigetafel (17x15) sitzt
   * Punkt für Punkt mittig über x 75 mit dem Fuß auf Zeile 35, die kleinen Masten (8x28) mittig
   * über x 23 und x 125 mit dem Fuß auf Zeile 50 - gezeichnet werden sie aber nur bis Zeile 37,
   * darunter steckt der Mast hinter der Tribüne.
   *
   * Nachgemessen ist nur die kleine Ausführung bei Zustand BEFRIEDIGEND; dass die größeren
   * ebenso mittig und fußbündig stehen und dass die Farbe in Zweierschritten am Zustand hängt,
   * ist daraus geschlossen und noch zu prüfen.
   */
  drawStadiumAufsaetze(st: { kind: number; value: number }[]): void {
    const bild = this.assets.img("40.VGA.a");
    if (!bild) return;
    const zustand = st[5]?.value ?? 0;
    const farbe = zustand >= 5 ? 0 : zustand >= 3 ? 1 : 2;
    // x, y, Breite, Höhe der drei Größen im Bild (Masten unten bündig auf Zeile 36)
    const MAST = [[38, 9, 8, 28], [18, 7, 14, 30], [1, 1, 14, 36]];
    const TAFEL = [[8, 45, 17, 15], [5, 63, 22, 19], [1, 84, 30, 20]];
    const flut = st[3]?.value ?? 0;
    const tafel = st[4]?.value ?? 0;
    const ctx = this.ctx;
    if (flut >= 1 && flut <= 3) {
      const [sx, sy, w, h] = MAST[flut - 1];
      const oben = 51 - h;
      const sicht = Math.max(0, Math.min(h, 38 - oben));
      for (const mitte of [23, 125]) {
        ctx.drawImage(bild, sx + 51 * farbe, sy, w, sicht, mitte - Math.trunc(w / 2), oben, w, sicht);
      }
    }
    if (tafel >= 1 && tafel <= 3) {
      const [sx, sy, w, h] = TAFEL[tafel - 1];
      ctx.drawImage(bild, sx + 33 * farbe, sy, w, h, 75 - Math.trunc(w / 2), 36 - h, w, h);
    }
  }

  drawStadium(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const m = g.managers.at(this.manager);
    const st = stadiumState(g, this.manager);
    // Farben des Bildschirms aus dem Original (1.PAL): hell, Tabelle, gedämpft, NACH AUSBAU
    const INK = "#a2a2c3";
    const INK_MID = "#8282a2";
    const INK_DIM = "#717192";
    const INK_FAR = "#616182";
    const seats = st[0].value;
    const total = seats + st[1].value;
    // Das Grundbild wählt das Original aus **zwei** Angaben (0x1781): der Kapazität und dem
    // Zustand. Die Kapazität gibt die Dreiergruppe (Schwellen 14.000, 34.000 und 54.000), der
    // Zustand die Nummer darin - je besser, desto niedriger:
    //   Bild = 9 + 3·Gruppe + 2 - (Zustand - 1)/2
    // Damit kommen alle Bilder von 9 bis 18 vor; wir kannten nur 9 bis 12 und haben deshalb
    // bei jedem größeren Stadion die falschen Tribünen gezeigt (GitLab #63).
    const gruppe = (total > 14000 ? 1 : 0) + (total > 34000 ? 1 : 0) + (total > 54000 ? 1 : 0);
    const zustand = st[5].value;
    const pic = this.assets.img(`${9 + 3 * gruppe + 2 - ((zustand - 1) >> 1)}.VGA`);
    // Die drei Kästen tragen denselben Rahmen wie alle Tafeln des Originals (links #a2a2c3,
    // oben #8282a2, rechts #303051, unten #414161) - nicht den erfundenen Blaugrau-Rahmen
    panel(ctx, 6, 15, 140, 83);
    // Das Grundbild füllt den Kasten ganz aus: 138x81 ab (7,16), nicht 137x80
    if (pic) ctx.drawImage(pic, 0, 0, 138, 81, 7, 16, 138, 81);
    this.drawStadiumAufsaetze(st);
    panel(ctx, 150, 15, 140, 83);
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(151, 16, 137, 80);
    // Übersicht
    panel(ctx, 6, 104, 284, 83);
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(7, 105, 281, 80);
    // Die Übersicht trägt im Original keinen Schatten
    s.draw(ctx, T("ui.stadionkopf", 1), 118, 107, INK, false);
    s.draw(ctx, T("ui.stadionkopf", 2), 192, 107, INK, false);
    const { jetzt: cap, nachAusbau: capAfter } = stadiumCapacity(g, this.manager);
    const num = (v: number) => v.toLocaleString("de-DE");
    const rowText = (row: number): [string, string, string] => {
      if (row === 0) return [T("ui.stadium", 0), num(cap), num(capAfter)];
      if (row === 8) return [T("ui.stadium", 1), `${m.ticketPrice} DM`, `${m.ticketPrice} DM`];
      const k = stadiumKinds()[row - 1];
      const e = st[row - 1];
      const names = k.kind <= 5 ? sizeNames() : statusNames();
      const show = (v: number) => (k.perThousand ? num(v) : (names[v] ?? String(v)));
      return [k.label, show(e.value), show(e.value + e.pending)];
    };
    for (let row = 0; row < 9; row++) {
      const [label, a, b] = rowText(row);
      const y = 115 + 8 * row;
      s.draw(ctx, cp437ToGame(label), 10, y, INK_MID, false);
      s.draw(ctx, a, 118, y, INK_MID, false);
      // Was sich durch einen laufenden Ausbau ändert, steht im Original hell, der Rest gedämpft
      s.draw(ctx, cp437ToGame(b), 192, y, a === b ? INK_FAR : INK_MID, false);
      // Rechts daneben die Restzeit des Baus, aufgerundet auf Wochen (0x0602; GitLab #55)
      const e = row >= 1 && row <= 7 ? st[row - 1] : null;
      if (e && e.days > 0) s.draw(ctx, toGame(`${buildWeeks(e.days)}${T("ui.wochen", 0)}`), 244, y, INK_MID, false);
    }
    for (let row = 1; row < 9; row++) this.hit(7, 114 + 8 * row, 281, 8, () => this.pickStadium(row));
    // Kasten rechts: das Original zeigt die Angaben erst nach dem Anklicken einer Zeile, beim
    // bloßen Überfahren bleibt er leer (in DOSBox nachgesehen, GitLab #55)
    // Der Kontostand steht immer unten im rechten Kasten, mit einem Strich darüber: Strich auf
    // y 84 von x 151 über 138 Punkte in Palettenfarbe 12, die Zeile ab (154,90) in Farbe 1 ohne
    // Schatten. In allen Aufnahmen des Originals ist er da, auch ohne angeklickte Zeile (#63).
    hline(ctx, 151, 84, 138, PLATE);
    s.draw(ctx, toGame(`${T("ui.stadionkopf", 0)}${num(m.balance)} DM`), 154, 90, INK, false);
    const shown = this.stadiumPick;
    if (shown) {
      const isPrice = shown === 8;
      const k = isPrice ? null : stadiumKinds()[shown - 1];
      const e = isPrice ? null : st[shown - 1];
      s.drawCenter(ctx, cp437ToGame(isPrice ? T("ui.stadium", 2) : k!.name), 220, 18, INK);
      hline(ctx, 151, 24, 138);
      hline(ctx, 151, 66, 138);
      if (k && e) {
        const cur = e.value + e.pending;
        const points = Math.trunc(m.balance / k.price);
        // Höchstwert: was gebaut werden darf und was der Kontostand hergibt (0x0F82)
        const max = k.perThousand
          ? Math.max(0, Math.min(e.max, points * 1000))
          : Math.max(cur, Math.min(e.max, cur + Math.min(e.max, points)));
        if (!(this.stadiumPick === shown && this.stadiumAsk)) {
          const names = k.kind <= 5 ? sizeNames() : statusNames();
          const cost = k.perThousand ? Math.trunc(max / 1000) * k.price : (max - cur) * k.price;
          s.draw(ctx, toGame(`KOSTET ${num(k.price)} DM PRO ${k.perThousand ? "1000" : "PUNKT"}`), 154, 69, INK);
          if (k.perThousand) {
            s.draw(ctx, toGame(`MAX. GR|~E: ${num(max)}`), 154, 76, INK);
            s.draw(ctx, toGame(` KOSTEN: ${num(cost)} DM.`), 154, 83, INK);
          } else {
            s.draw(ctx, toGame(`${k.kind <= 5 ? T("ui.stadium", 3) : T("ui.stadium", 4)}${cp437ToGame(names[max] ?? "")}`), 154, 76, INK);
            s.draw(ctx, toGame(`(KOSTEN: ${num(cost)} DM)`), 154, 83, INK);
          }
        }
        if (this.stadiumPick === shown) this.drawStadiumPick(k, e, max);
      } else {
        // Eintrittspreis: das Original zeigt nur den Regler; der Kontostand steht ohnehin da
        if (this.stadiumPick === 8) {
          const set = (p: number) => void this.post("api/ticket", { manager: this.manager, price: p });
          this.drawSpinner(
            String(m.ticketPrice),
            () => set(Math.min(TICKET_RANGE.max, m.ticketPrice + 1)),
            () => set(Math.max(TICKET_RANGE.min, m.ticketPrice - 1)),
          );
        }
      }
    }
    // Unten der Name der Zeile unter dem Zeiger, wie im Original in großer Schrift
    if (this.stadiumHover > 0) {
      const name = this.stadiumHover === 8 ? T("ui.stadium", 2) : stadiumKinds()[this.stadiumHover - 1].name;
      f.drawCenter(ctx, cp437ToGame(name), 148, 218, INK);
    }
    // Das Original hat auf diesem Bildschirm nur die Schaltfläche HAUPTMENÜ
    this.sideButtons([]);
  }

  /**
   * Menge des Ausbaus einstellen. Das Original zeigt dafür einen Regler bei (184,27), 70x34,
   * mit dem Wert in einem dunklen Balken; danach kommt die Rückfrage (Routine 0x0000):
   * Kasten (151,27) bis (288,95) mit "AUSBAU UM n AUF " (y 37), Menge und Bezeichner (46),
   * " KOSTEN: ... DM" (55), "BAUZEIT: CIRKA ..." (64), "... WOCHEN" (73) sowie den
   * Schaltflächen "NA KLAR !" (158,81) und "ACH NEE..." (227,81).
   */
  drawStadiumPick(k: ReturnType<typeof stadiumKinds>[number], e: { value: number; pending: number; max: number }, max: number): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const INK = "#a2a2c3";
    const INK_DIM = "#717192";
    const step = k.perThousand ? 1000 : 1;
    const amount = Math.max(0, Math.min(max, this.stadiumAmount));
    const cur = e.value + e.pending;
    const names = k.kind <= 5 ? sizeNames() : statusNames();
    const num = (v: number) => v.toLocaleString("de-DE");
    if (this.stadiumAsk) {
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(151, 27, 138, 69);
      if (k.perThousand) {
        s.drawCenter(ctx, toGame(`${T("ui.ausbaukasten", 0)}${num(amount)}${T("ui.ausbaukasten", 1)}`), 220, 33, INK);
        s.drawCenter(ctx, toGame(`${num(cur + amount)} ${cp437ToGame(k.label)}`), 220, 42, INK);
      } else {
        s.drawCenter(ctx, toGame(k.kind <= 5 ? T("ui.stadiumpick", 0) : T("ui.stadiumpick", 1)), 220, 33, INK);
        s.drawCenter(ctx, cp437ToGame(names[cur + amount] ?? ""), 220, 42, INK);
      }
      s.drawCenter(ctx, toGame(`KOSTEN: ${num((amount / step) * k.price)} DM`), 220, 51, INK);
      s.drawCenter(ctx, T("ui.stadiumpick", 2), 220, 60, INK);
      // Die Bauzeit würfelt der Server, sobald die Rückfrage aufgeht, und hält sie bis zum
      // Tageswechsel fest - genau die steht hier und wird beim Zuschlag übernommen (GitLab #55)
      s.drawCenter(ctx, toGame(`${buildWeeks(this.bauTage[k.kind] ?? 7 * k.base)} WOCHEN`), 220, 69, INK);
      button(ctx, s, T("ui.ausbaukasten", 2), 158, 81, 57, true);
      button(ctx, s, T("ui.ausbaukasten", 3), 227, 81, 57);
      this.hit(158, 81, 57, 14, () => {
        void this.post("api/stadium", { manager: this.manager, kind: k.kind, amount: k.perThousand ? amount : cur + amount });
        this.stadiumPick = 0;
        this.stadiumAsk = false;
        this.stadiumAmount = 0;
      });
      this.hit(227, 81, 57, 14, () => {
        // Wie im Original: wer ablehnt, bekommt heute keine Baufirma mehr für diese Ausbauart
        void this.post("api/stadium/decline", { manager: this.manager, player: this.player, kind: k.kind });
        this.stadiumAsk = false;
        if (!k.perThousand) this.stadiumAmount = 0;
      });
      return;
    }
    if (k.perThousand) {
      this.drawSpinner(
        num(amount),
        () => (this.stadiumAmount = Math.min(max, amount + step)),
        () => (this.stadiumAmount = Math.max(0, amount - step)),
      );
      return;
    }
    // Stufen als Liste (0x0FDE für Größen, 0x114E für Status): Name bei x 154, Betrag
    // rechtsbündig bis x 268, Zeile di bei y 7·di + 25 bzw. 7·di + 18, jeweils vier höher.
    const first = k.kind <= 5 ? 1 : 2;
    const base = k.kind <= 5 ? 25 : 18;
    for (let di = first; di <= e.max; di++) {
      const y = 7 * di + base - 4;
      const reachable = di > cur && di <= max;
      s.draw(ctx, cp437ToGame(names[di] ?? ""), 154, y, reachable ? INK : INK_DIM);
      if (di > cur) s.drawRight(ctx, toGame(`${num((di - cur) * k.price)} DM`), 268, y, reachable ? INK : INK_DIM);
      // Ein Klick auf eine erreichbare Stufe führt gleich zur Rückfrage; bei den Plätzen
      // übernimmt das der Rechtsklick nach dem Regler.
      if (reachable) {
        this.hit(152, y - 1, 136, 7, () => {
          this.stadiumAmount = di - cur;
          void this.rueckfrageOeffnen(k.kind);
        });
      }
    }
  }

  /**
   * Regler des Originals (0x0602 zeichnet ihn bei (184,27), 70x34): eine Raute mit dem Wert in
   * einem dunklen Balken. Die obere Hälfte erhöht, die untere senkt - im Original sind das die
   * beiden Pfeile über und unter dem Betrag.
   */
  drawSpinner(text: string, up: () => void, down: () => void): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    const poly = (pts: number[][], color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    };
    poly([[184, 45], [219, 28], [254, 45], [219, 62]], COLORS.frameDark);
    poly([[184, 44], [219, 27], [254, 44], [219, 61]], COLORS.frameLight);
    poly([[184, 44], [219, 61], [254, 44]], COLORS.frame);
    ctx.fillStyle = COLORS.frameLight;
    ctx.fillRect(184, 38, 70, 14);
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(185, 39, 68, 12);
    s.drawCenter(ctx, text, 219, 41, COLORS.text);
    this.hit(184, 27, 70, 12, up);
    this.hit(184, 51, 70, 11, down);
  }

  /**
   * Rückfrage zum Ausbau aufmachen. Das Original würfelt die Bauzeit schon hier und nennt sie
   * als "BAUZEIT: CIRKA ... WOCHEN" - also holt der Server sie, bevor der Kasten steht, und
   * hält sie bis zum Tageswechsel fest (Ausbauart 1..7, gleich der Zeilennummer).
   */
  async rueckfrageOeffnen(kind: number): Promise<void> {
    const r = await fetch("api/stadium/bauzeit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manager: this.manager, player: this.player, kind }),
    });
    const daten = r.ok ? ((await r.json().catch(() => ({}))) as { days?: number }) : {};
    if (typeof daten.days === "number") this.bauTage[kind] = daten.days;
    this.stadiumAsk = true;
    this.render();
  }

  /** Eine Zeile der Übersicht anklicken: läuft dort schon ein Ausbau, weist das Original ab. */
  pickStadium(row: number): void {
    if (row < 8) {
      const e = stadiumState(this.game!, this.manager)[row - 1];
      // Es baut schon jemand an dieser Stelle, oder das Angebot ist heute schon abgelehnt worden
      const abgelehnt = (this.server.extra?.bauAbgelehnt ?? []).includes(`${this.manager}:${row}`);
      if (e.days || abgelehnt) {
        const abs = stadiumMessages();
        this.hinweis = [abs[2], abs[3]];
        this.render();
        return;
      }
    }
    this.stadiumAsk = false;
    this.stadiumPick = this.stadiumPick === row ? 0 : row;
    this.stadiumAmount = 0;
  }

  /**
   * Kredite (0x1291F). Vier Fenster wie im Original: links oben (6,15) 139x82 mit dem Bankbild
   * (PIC/7.VGA, 138x81 nach (7,16)), rechts oben (150,15) 109x82 die Zinstafel, links unten
   * (6,104) 139x82 die Kreditliste mit der Rollspalte (7.VGA ab x 139, 14x81 nach (131,105))
   * und rechts unten (150,104) 109x82 der Kontostand.
   *
   * Rechts stehen die Geldgeber als Symbolknöpfe ab (268,15) im Abstand 45: je ein Mitspieler
   * mit seinem Bild aus PIC/0.VGA (32x23 ab Spalte Nr.·41 + 5, Zeile 8), zuletzt die Bank mit
   * dem Bild aus 7.VGA (ab Spalte 155). Der gewählte Knopf steht gedrückt (25.VGA).
   *
   * Zinstafel: "Dauer  Zinssatz" bei (160,24), sechs Zeilen bei y 37 + 11·i, die Laufzeit
   * (i+1)·3 Monate links (x 160, zweistellig 157) und der Satz bei x 223, dazwischen Striche
   * bei y 39 + 11·i. Ein Klick auf eine Zeile nimmt den Kredit auf.
   *
   * Kreditliste: drei Fächer, getrennt bei y 132 und 159, je drei Zeilen ab y 112, 139 und 168
   * im Abstand 8: Aufnahmedatum mit Summe und Satz, "FÄLLIG AM ..." und "ZINSEN PRO MONAT: ...".
   * Ein Klick auf die Mitte der Rollspalte blendet stattdessen die Summe beim gewählten
   * Geldgeber ein ("SCHULDEN HIER" / "ZINSEN HIER").
   */
  drawBank(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const m = g.managers.at(this.manager);
    // Farben der Fenster aus dem Original: Füllung 7, Trennstriche 6, Schrift 1 bzw. 2
    const BOX = "#303051";
    const LINE = "#414161";
    const INK = "#a2a2c3";
    const INK2 = "#8282a2";
    const text = (font: Font, str: string, x: number, y: number, color: string) => {
      font.draw(ctx, str, x + 1, y, COLORS.black, false);
      font.draw(ctx, str, x, y, color, false);
    };
    const center = (font: Font, str: string, x1: number, x2: number, y: number, color: string) => {
      text(font, str, x1 + Math.trunc((x2 - x1) / 2) - Math.trunc(font.width(str) / 2), y, color);
    };
    panel(ctx, 6, 15, 140, 83, BOX);
    panel(ctx, 150, 15, 110, 83, BOX);
    panel(ctx, 6, 104, 140, 83, BOX);
    panel(ctx, 150, 104, 110, 83, BOX);
    const pic = this.assets.img("7.VGA");
    if (pic) {
      ctx.drawImage(pic, 0, 0, 138, 81, 7, 16, 138, 81);
      ctx.drawImage(pic, 139, 0, 14, 81, 131, 105, 14, 81);
    }
    // Geldgeber: erst die Mitspieler, dann die Bank
    const faces = this.assets.img("0.VGA");
    const lenders: number[] = [];
    for (let i = 0; i < g.save.managerCount; i++) if (i !== this.manager) lenders.push(i);
    lenders.push(BANK);
    lenders.forEach((lender, row) => {
      const y = 18 + 45 * row;
      this.iconFrame(270, y, lender === this.bankLender);
      if (lender === BANK) {
        if (pic) ctx.drawImage(pic, 155, 0, 31, 23, 277, y + 6, 31, 23);
      } else if (faces) ctx.drawImage(faces, this.gesichtSpalte(lender) + 5, 8, 32, 23, 277, y + 6, 32, 23);
      this.hit(270, y, 46, 36, () => {
        this.bankLender = lender;
        this.bankSummary = false;
      });
    });
    // Zinstafel der Bank
    f.draw(ctx, T("ui.bank", 0), 160, 18, INK, false);
    LOAN_MONTHS.forEach((months, i) => {
      const y = 31 + 11 * i;
      f.draw(ctx, `${months < 10 ? " " : ""}${months} Mon.`, months < 10 ? 160 : 157, y, INK2, false);
      f.draw(ctx, ` ${loanRate(g, i)}%`, 223, y, INK2, false);
      if (i < 5) hline(ctx, 151, y + 8, 108, LINE);
    });
    this.hit(161, 31, 98, 62, (_cx, cy) => this.askLoan(Math.max(0, Math.min(5, Math.trunc((cy - 31) / 11)))));
    // Kreditliste des gewählten Geldgebers
    hline(ctx, 7, 132, 124, LINE);
    hline(ctx, 7, 159, 124, LINE);
    if (this.bankSummary) {
      s.draw(ctx, `${T("ui.bankzeilen", 0)}${dm(lenderDebt(g, this.manager, this.bankLender))}`, 9, 139, INK, false);
      s.draw(ctx, `${T("ui.bankzeilen", 1)}${dm(lenderDebt(g, this.manager, this.bankLender, true))}`, 9, 148, INK, false);
    } else {
      m.loans(this.bankLender).slice(0, 3).forEach((l, row) => {
        const y = [108, 135, 164][row];
        s.draw(ctx, `${l.startDay}.${l.startMonth + 1}.${l.startYear}: ${dm(l.amount)} (${l.ratePercent}%)`, 9, y, INK, false);
        s.draw(ctx, toGame(`${T("ui.bankzeilen", 3)}${l.dueDay}.${l.dueMonth + 1}.${l.dueYear}`), 9, y + 8, INK, false);
        s.draw(ctx, `${T("ui.bankzeilen", 2)}${dm(l.monthlyInterest)}`, 9, y + 16, INK, false);
      });
    }
    this.hit(132, 132, 14, 27, () => (this.bankSummary = !this.bankSummary));
    // Kontostand, Gesamtschulden und Zinsen
    hline(ctx, 151, 132, 108, LINE);
    hline(ctx, 151, 159, 108, LINE);
    const block: [string, number][] = [
      ["Kontostand:", m.balance],
      [T("ui.bank", 1), m.debt.total],
      [T("ui.bank", 2), m.debt.monthlyInterest],
    ];
    block.forEach(([label, value], i) => {
      center(f, label, 151, 259, 108 + 27 * i, INK);
      center(f, dm(value), 151, 259, 120 + 27 * i, INK);
    });
    // Hinweiszeile wie im Original (0x243F, Kennung 0x17)
    if (this.bankHover >= 0) {
      const line =
        this.bankLender === BANK
          ? `${T("ui.bankzeilen", 4)}${loanRate(g, this.bankHover)}${T("ui.bankzeilen", 5)}`
          : `${T("ui.bankzeilen", 6)}${dosText(g.managers.at(this.bankLender).name)}${T("ui.bankzeilen", 7)}`;
      center(f, toGame(line), 0, 266, 219, INK);
    }
    this.sideButtons([]);
  }

  /**
   * Kredit aufnehmen: bei der Bank stehen Laufzeit und Satz in der Tafel, bei einem Mitspieler
   * fragt das Original beides ab (0x13387: höchstens 24 Monate, 3 bis 13 Prozent).
   */
  askLoan(row: number): void {
    const g = this.game!;
    const lender = this.bankLender;
    // Version 2026: der Mitspieler wird nur nach der Summe gefragt, Laufzeit und Zins setzt er
    const nurSumme = lender === BANK || is2026(g);
    const felder = [{ label: toGame(T("ui.askloan", 0)), wert: 500000, max: 8 }];
    if (!nurSumme) {
      felder.push({ label: toGame(T("ui.askloan", 1)), wert: LOAN_MONTHS[row], max: 2 });
      felder.push({ label: toGame(T("ui.askloan", 2)), wert: LOAN_RATE_MIN, max: 2 });
    }
    this.fragZahlen(
      "KREDIT AUFNEHMEN",
      felder,
      (werte) => {
        const amount = werte[0];
        if (!amount) return;
        // Unter dem Mindestzins fragt das Original nicht weiter, sondern zeigt den Kasten
        // "Mindest-Prozentsatz: minimale 3 Prozent." (0x1356A; GitLab #36)
        if (!nurSumme && werte[2] < LOAN_RATE_MIN) {
          this.hinweis = [...texte("ui.mindestzins")];
          this.render();
          return;
        }
        if (lender !== BANK && is2026(g)) {
          void this.post("api/loan", { manager: this.manager, player: this.player, amount, lender });
          return;
        }
        const months = nurSumme ? LOAN_MONTHS[row] : werte[1];
        const rate = nurSumme ? loanRate(g, row) : werte[2];
        void this.post("api/loan", { manager: this.manager, player: this.player, amount, months, rate, lender });
      },
      "KREDIT",
    );
  }

  /** Transfermarkt (0x22C15): links der Kader, rechts der Markt mit LEIHEN/KAUFEN, unten Angebot und Kontostand. */
  /** Abwerben öffnen: der erste Mitspieler ist vorgewählt. */
  goAbwerben(): void {
    const g = this.game;
    if (!g) return;
    const andere = g.activeManagers().map((_, i) => i).filter((i) => i !== this.manager);
    this.abwerbenOwner = andere[0] ?? -1;
    this.abwerbenPlace = -1;
    this.abwerbenBonus = 0;
    this.go("abwerben");
  }

  /**
   * Spieler abwerben (Version 2026, sim/abwerben.ts). Eigener Bildschirm, im Original gibt es
   * ihn nicht: oben die Mitspieler, darunter deren Kader, unten Ablöse, Aufschlag und die
   * Wahrscheinlichkeit, mit der der Spieler zusagt. Wer zusagt, wechselt sofort - der Werbende
   * zahlt und kann nicht mehr zurück.
   */
  drawAbwerben(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    panel(ctx, 2, 4, 316, 232);
    f.drawCenter(ctx, "SPIELER ABWERBEN", 134, 8, COLORS.white);
    const andere = g.activeManagers().map((_, i) => i).filter((i) => i !== me);
    if (andere.length === 0) {
      s.drawCenter(ctx, "KEIN MITSPIELER DA", 134, 100, COLORS.textDim);
      this.sideButtons();
      return;
    }
    if (!andere.includes(this.abwerbenOwner)) this.abwerbenOwner = andere[0];
    andere.forEach((m, i) => {
      const x = 8 + 62 * i;
      const gewaehlt = m === this.abwerbenOwner;
      this.knopf(cp437ToGame(g.clubs.at(g.managers.at(m).clubIndex).displayName).slice(0, 13), x, 18, gewaehlt);
      this.hit(x, 18, 57, 13, () => {
        this.abwerbenOwner = m;
        this.abwerbenPlace = -1;
        this.abwerbenBonus = 0;
      });
    });
    const owner = this.abwerbenOwner;
    // Jedem Manager lassen sich je Saison nur zwei Spieler abwerben, und gewildert wird nur nach
    // oben: der Besitzer muss in einer höheren Liga oder vor einem in der Tabelle stehen
    const offen = poachLeft(g, me, owner);
    const erlaubt = poachAllowedFrom(g, me, owner);
    // Frisch aus der Jugend aufgerückte Spieler stehen bis zum Tageswechsel allen offen (#4,
    // Stufe 2): eigene Grenze von einem je Saison, und ohne die Richtungsregel von oben
    const frisch = (this.server.extra?.jugendFrisch ?? []).filter((x) => x.manager === owner);
    const istFrisch = (platz: number): boolean => frisch.some((x) => x.place === platz);
    const jugendOffen = JUGEND_MAX_ABWERBEN - jugendAbwerbungen(g, me);
    // Die Hinweiszeile steht unter den Vereinsknöpfen (die reichen von y 18 bis 31), sonst
    // schreibt sie quer über sie hinweg
    s.drawRight(ctx, `NOCH ${offen} VON ${POACH_MAX_PER_OWNER}`, 260, 33, offen > 0 && erlaubt ? COLORS.white : COLORS.red);
    if (!erlaubt) s.draw(ctx, "NUR NACH OBEN: DIESER VEREIN STEHT HINTER IHNEN", 8, 33, COLORS.red);
    else if (frisch.length > 0) s.draw(ctx, toGame("GRÜN: FRISCH AUS DER JUGEND - EIGENE GRENZE"), 8, 33, "#71a241");
    const hy = 41;
    s.draw(ctx, "ART", 8, hy, COLORS.white);
    s.draw(ctx, "NAME", 26, hy, COLORS.white);
    s.draw(ctx, "SP", 84, hy, COLORS.white);
    s.draw(ctx, "ST[RKEN", 98, hy, COLORS.white);
    s.draw(ctx, "TO", 138, hy, COLORS.white);
    s.draw(ctx, "J.", 152, hy, COLORS.white);
    s.drawRight(ctx, "ABL\\SE", 214, hy, COLORS.white);
    s.drawRight(ctx, "JA%", 260, hy, COLORS.white);
    hline(ctx, 8, hy + 8, 252);
    let y = 53;
    for (let place = 0; place < 25; place++) {
      const l = g.lineups.at(owner * 25 + place);
      if (l.isEmpty) continue;
      const p = g.players.at(l.playerIndex);
      const gewaehlt = place === this.abwerbenPlace;
      if (gewaehlt) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(6, y - 1, 254, 7);
      }
      const c = gewaehlt ? COLORS.black : istFrisch(place) ? "#71a241" : l.number > 11 || l.number === 0 ? COLORS.textDim : COLORS.text;
      // Die markierte Zeile steht schwarz auf gelb - mit dem schwarzen Schatten der Schrift
      // würde sie zum Klumpen, deshalb dort ohne
      const sch = !gewaehlt;
      s.draw(ctx, p.position, 8, y, c, sch);
      s.draw(ctx, cp437ToGame(p.name), 26, y, c, sch);
      s.drawRight(ctx, String(l.leagueApps + l.cupApps), 92, y, c, sch);
      const [ko, te, fo] = l.strength;
      s.drawRight(ctx, String(ko), 110, y, c, sch);
      s.drawRight(ctx, String(te), 122, y, c, sch);
      s.drawRight(ctx, String(fo), 134, y, c, sch);
      s.drawRight(ctx, String(l.leagueGoals + l.cupGoals), 146, y, c, sch);
      s.drawRight(ctx, String(p.age), 158, y, c, sch);
      s.drawRight(ctx, dm(poachAmount(g, owner, place, this.abwerbenBonus)).replace(" DM", ""), 214, y, c, sch);
      s.drawRight(ctx, `${poachChance(g, me, owner, place, this.abwerbenBonus)}%`, 260, y, c, sch);
      const pl = place;
      this.hit(6, y - 1, 254, 6, () => {
        this.abwerbenPlace = this.abwerbenPlace === pl ? -1 : pl;
      });
      y += 6;
    }
    hline(ctx, 8, 190, 252);
    const place = this.abwerbenPlace;
    const l = place >= 0 ? g.lineups.at(owner * 25 + place) : null;
    if (!l || l.isEmpty) {
      s.draw(ctx, "SPIELER ANKLICKEN. DIE ABL\\SE IST SEIN MARKTWERT,", 8, 196, COLORS.textDim);
      s.draw(ctx, `DARAUF SIND BIS ZU ${POACH_MAX_BONUS}% AUFSCHLAG M\\GLICH.`, 8, 204, COLORS.textDim);
      // Länger darf die Zeile nicht werden, sonst läuft sie unter den Symbolknopf rechts
      s.draw(ctx, `WER ZUSAGT, WECHSELT SOFORT - SIE ZAHLEN. JE MANAGER UND SAISON ${POACH_MAX_PER_OWNER}.`, 8, 212, COLORS.textDim);
      f.draw(ctx, `Kontostand: ${dm(g.managers.at(me).balance)}`, 8, 224, COLORS.white, false);
      this.sideButtons();
      return;
    }
    const p = g.players.at(l.playerIndex);
    const basis = poachPrice(g, owner, place);
    const betrag = poachAmount(g, owner, place, this.abwerbenBonus);
    const chance = poachChance(g, me, owner, place, this.abwerbenBonus);
    const ausJugend = istFrisch(place);
    s.draw(ctx, `${cp437ToGame(p.name)}, ${p.age} J., VERTRAG ${l.u8(11)} JAHRE`, 8, 196, ausJugend ? "#71a241" : COLORS.white);
    s.draw(ctx, `MARKTWERT ${dm(basis)}`, 8, 204, COLORS.text);
    s.draw(ctx, `AUFSCHLAG ${this.abwerbenBonus}%`, 8, 212, COLORS.text);
    // Die Schrittschalter sind auf die Zeilenhöhe der kleinen Schrift zugeschnitten; mit
    // button() wären sie 16 hoch und ragten in die Kontostandzeile
    this.stufenKnopf("-", 76, 211);
    this.stufenKnopf("+", 89, 211);
    this.hit(76, 211, 11, 11, () => (this.abwerbenBonus = Math.max(0, this.abwerbenBonus - 1)));
    this.hit(89, 211, 11, 11, () => (this.abwerbenBonus = Math.min(POACH_MAX_BONUS, this.abwerbenBonus + 1)));
    s.draw(ctx, `ABL\\SE ${dm(betrag)}`, 112, 204, COLORS.white);
    s.draw(ctx, `ZUSTIMMUNG ${chance}%`, 112, 212, chance >= 50 ? "#71a241" : COLORS.red);
    f.draw(ctx, `Kontostand: ${dm(g.managers.at(me).balance)}`, 8, 224, COLORS.white, false);
    if (ausJugend) s.drawRight(ctx, `JUGEND: NOCH ${Math.max(0, jugendOffen)} VON ${JUGEND_MAX_ABWERBEN}`, 260, 196, jugendOffen > 0 ? "#71a241" : COLORS.red);
    // Für einen frisch Aufgerückten gilt das eigene Kontingent, nicht das des Kaderabwerbens
    const reicht = g.managers.at(me).balance >= betrag && (ausJugend ? jugendOffen > 0 : offen > 0 && erlaubt);
    this.knopf("ABWERBEN", 200, 222, reicht);
    if (reicht)
      this.hit(200, 222, 57, 13, () => {
        const bonus = this.abwerbenBonus;
        const frage = ausJugend ? "ER KOMMT GERADE AUS DER JUGEND." : "SAGT ER ZU, IST DER WECHSEL BINDEND.";
        this.fragJaNein([`${cp437ToGame(p.name)} ABWERBEN?`, `ABL\\SE ${dm(betrag)}.`, frage], () => {
          this.abwerbenPlace = -1;
          if (ausJugend) void this.post("api/jugend", { manager: me, player: this.player, was: "abwerben", owner, place, bonus });
          else void this.post("api/poach", { manager: me, player: this.player, owner, place, bonus });
        });
      });
    this.sideButtons();
  }

  /**
   * Zusatzregeln der Version 2026 auf einem Bildschirm: die Kaufsperre als Stand, der
   * Derby-Einsatz zum Einstellen und die ablösefreien Spieler zum Bieten.
   */
  drawExtra2026(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    const x = this.server.extra;
    panel(ctx, 2, 4, 316, 232);
    f.drawCenter(ctx, "REGELN 2026", 134, 8, COLORS.white);
    // Stand: Kaufsperre bei Überschuldung
    if (x?.blocked?.[me]) s.draw(ctx, "KAUFSPERRE: KONTO STAND AM MONATSENDE ZU TIEF IM MINUS", 8, 28, COLORS.red);
    else s.draw(ctx, toGame(`Kontostand ${dm(g.managers.at(me).balance)} - unter -1.000.000 DM gibt es 3 Punkte Abzug`), 8, 28, COLORS.textDim);
    hline(ctx, 8, 40, 252);
    // Derby-Einsatz
    s.draw(ctx, "DERBY-EINSATZ GEGEN ANDERE MANAGER (ES GILT DER KLEINERE BETRAG)", 8, 46, COLORS.white);
    const stufe = x?.derby?.[me] ?? 0;
    DERBY_STAKES.forEach((betrag, i) => {
      const bx = 8 + 62 * i;
      this.knopf(dm(betrag).replace(" DM", ""), bx, 54, i === stufe);
      this.hit(bx, 54, 57, 13, () => void this.post("api/derby", { manager: me, player: this.player, level: i }));
    });
    const andere = g.activeManagers().map((_, i) => i).filter((i) => i !== me);
    // Wie hoch die anderen setzen, bleibt verdeckt - es gilt ohnehin der kleinere Betrag
    s.draw(ctx, toGame(`MINDESTEINSATZ ${dm(DERBY_STAKES[0])} - WIE HOCH DIE ANDEREN SETZEN, SEHEN SIE ERST BEIM SPIEL`), 8, 72, COLORS.textDim);
    hline(ctx, 8, 82, 252);
    // Ablösefreie Spieler
    s.draw(ctx, "ABL\\SEFREIE SPIELER - IHR ANGEBOT IST DAS MONATSGEHALT", 8, 88, COLORS.white);
    const frei = x?.freeAgents ?? [];
    if (frei.length === 0) s.draw(ctx, "ZURZEIT IST NIEMAND ABL\\SEFREI. AM SAISONENDE WERDEN ES MEHR.", 8, 100, COLORS.textDim);
    const hy = 100;
    if (frei.length) {
      s.draw(ctx, "ART", 8, hy, COLORS.white);
      s.draw(ctx, "NAME", 26, hy, COLORS.white);
      s.draw(ctx, "ST[RKEN", 86, hy, COLORS.white);
      s.draw(ctx, "J.", 126, hy, COLORS.white);
      s.drawRight(ctx, "BISHER", 180, hy, COLORS.white);
      s.drawRight(ctx, "IHR ANGEBOT", 258, hy, COLORS.white);
      hline(ctx, 8, hy + 8, 252);
    }
    let y = hy + 12;
    frei.forEach((a) => {
      const gewaehlt = a.playerIndex === this.freiSel;
      if (gewaehlt) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(6, y - 1, 254, 7);
      }
      const mein = a.bids.find((b) => b.manager === me);
      const c = gewaehlt ? COLORS.black : COLORS.text;
      s.draw(ctx, a.position, 8, y, c);
      s.draw(ctx, cp437ToGame(a.name), 26, y, c);
      s.drawRight(ctx, String(a.strength[0]), 98, y, c);
      s.drawRight(ctx, String(a.strength[1]), 110, y, c);
      s.drawRight(ctx, String(a.strength[2]), 122, y, c);
      s.drawRight(ctx, String(a.age), 134, y, c);
      s.drawRight(ctx, dm(a.salary).replace(" DM", ""), 180, y, c);
      const eigener = a.from === me;
      s.drawRight(ctx, eigener ? "IHR SPIELER" : mein ? dm(mein.salary).replace(" DM", "") : "-", 258, y, gewaehlt ? COLORS.black : mein ? "#71a241" : COLORS.textDim);
      const pi = a.playerIndex;
      // Den eigenen, gerade abgegebenen Spieler kann man nicht zurückbieten (#95)
      if (!eigener) this.hit(6, y - 1, 254, 6, () => {
        this.freiSel = pi;
        const bisher = a.bids.find((b) => b.manager === me)?.salary ?? a.salary;
        this.fragZahl(toGame(`GEBOT F]R ${dosText(a.name)}`), "GEHALT JE MONAT", bisher, 8, (salary) =>
          void this.post("api/free/bid", { manager: me, player: this.player, playerIndex: pi, salary }),
        );
      });
      y += 7;
    });
    if (frei.length) s.draw(ctx, "DER ZUSCHLAG F[LLT BEIM N[CHSTEN TAGESWECHSEL. H\\HERE LIGA Z[HLT WIE +10%.", 8, y + 6, COLORS.textDim);
    this.sideButtons();
  }

  drawMarket(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    const mk = this.server.market;
    const entries: MarketEntry[] = mk?.entries ?? [];
    const clubName = (c: number) => (c < 200 ? cp437ToGame(g.clubs.at(c).name) : `VEREIN ${c}`);
    // Kader
    // Im Original nachgemessen (GitLab #56): linke Tafel (0,13) 158x182, Überschrift bei y 16
    // mittig über 1..156, Kopfzeile y 26, Strich y 32 von x 4 bis 153, fünfzehn Zeilen ab y 36
    // im Abstand 6 und ein zweiter Strich bei y 182.
    panel(ctx, 0, 13, 158, 182);
    // Überschrift mit Schatten in Farbe 7 ein Pixel rechts, Kopfzeile und Zeilen ohne Schatten
    f.drawCenter(ctx, T("ui.market", 0), 79, 16, "#303051", false);
    f.drawCenter(ctx, T("ui.market", 0), 78, 16, PLATE, false);
    const hy = 26;
    s.draw(ctx, "ART", 4, hy, PLATE, false);
    s.draw(ctx, "NAME", 22, hy, PLATE, false);
    s.draw(ctx, "SP", 81, hy, PLATE, false);
    s.draw(ctx, "ST[RKEN", 94, hy, PLATE, false);
    s.draw(ctx, "TO", 130, hy, PLATE, false);
    s.draw(ctx, "TD", 142, hy, PLATE, false);
    hline(ctx, 4, 32, 150, PLATE);
    let y = 36;
    for (let place = 0; place < 25; place++) {
      const l = g.lineups.at(me * 25 + place);
      if (l.isEmpty) continue;
      const p = g.players.at(l.playerIndex);
      const offer = (l.u8(9) & OFFER_SQUAD) !== 0;
      const c = offer ? COLORS.highlight : (GRUPPENFARBE[p.position] ?? COLORS.text);
      s.draw(ctx, p.position, 4, y, c, false);
      s.draw(ctx, cp437ToGame(p.name), 22, y, c, false);
      s.drawRight(ctx, String(l.leagueApps + l.cupApps), 89, y, c, false);
      const [ko, te, fo] = l.strength;
      s.drawRight(ctx, String(ko), 103, y, c, false);
      s.drawRight(ctx, String(te), 115, y, c, false);
      s.drawRight(ctx, String(fo), 127, y, c, false);
      s.drawRight(ctx, String(l.leagueGoals + l.cupGoals), 139, y, c, false);
      // Die letzte Spalte ist die Tendenz wie im Kaderbildschirm, kein Leih- oder Angebotszeichen
      s.draw(ctx, this.tendenz(l), 142, y, l.u8(19) > 130 ? "#b20020" : c, false);
      const pl = place;
      this.hit(4, y - 1, 150, 6, () => this.marketSquadClick(pl, offer));
      y += 6;
    }
    hline(ctx, 4, 182, 150, PLATE);
    // Markt
    // Rechte Tafel (161,13) 156x113: Überschrift y 15 mittig über 162..315, Kopfzeile y 25,
    // Strich y 31, sechs Zeilen ab y 35, darunter ein Strich bei y 107 und die beiden Knöpfe.
    panel(ctx, 161, 13, 156, 113);
    f.drawCenter(ctx, T("ui.market", 1), 240, 15, "#303051", false);
    f.drawCenter(ctx, T("ui.market", 1), 239, 15, PLATE, false);
    s.draw(ctx, "ART", 163, 25, PLATE, false);
    s.draw(ctx, "NAME", 181, 25, PLATE, false);
    s.draw(ctx, "ST[RKEN", 234, 25, PLATE, false);
    s.drawRight(ctx, "WERT", 298, 25, PLATE, false);
    hline(ctx, 163, 31, 153, PLATE);
    y = 35;
    // Die Spalte WERT zeigt bei LEIHEN ein Drittel des Preises (0x1F37F ab 0x1FC29)
    const wert = (e: MarketEntry) => (this.marketMode === "leihen" ? Math.trunc(e.price / 3) : e.price);
    entries.forEach((e, i) => {
      const sel = i === this.marketSel;
      if (sel) {
        ctx.fillStyle = COLORS.highlight;
        ctx.fillRect(163, y - 1, 151, 7);
      }
      const mine = e.owner === me;
      const c = sel ? COLORS.black : mine ? (e.offer ? COLORS.highlight : COLORS.white) : e.rejectedBy.includes(me) ? COLORS.textDim : (GRUPPENFARBE[e.position] ?? COLORS.text);
      const sch = false; // wie im Original: die Zeilen tragen keinen Schatten
      s.draw(ctx, e.position, 163, y, c, sch);
      s.draw(ctx, toGame(e.name), 181, y, c, sch);
      s.drawRight(ctx, String(e.strength[0]), 242, y, c, sch);
      s.drawRight(ctx, String(e.strength[1]), 254, y, c, sch);
      s.drawRight(ctx, String(e.strength[2]), 266, y, c, sch);
      const auk = this.server.market?.auctions?.find((a) => a.slot === e.slot);
      if (auk && auk.anzahl > 0) {
        // Verdecktes Bietgefecht: das eigene Gebot steht da, von den anderen nur die Zahl
        const text = auk.mein !== null ? `${auk.mein} DM` : `${auk.anzahl} GEBOT${auk.anzahl > 1 ? "E" : ""}`;
        s.drawRight(ctx, text, 317, y, sel ? COLORS.black : auk.mein !== null ? "#71a241" : COLORS.highlight, sch);
      } else s.drawRight(ctx, `${wert(e)} DM`, 317, y, c, sch);
      this.hit(163, y - 1, 151, 7, () => this.marketClick(i, e));
      y += 6;
    });
    if (entries.length === 0) s.drawCenter(ctx, this.online ? "KEINE SPIELER AUF DEM MARKT" : "NUR IM MEHRSPIELER-MODUS", 238, 60, COLORS.textDim);
    hline(ctx, 163, 107, 153, PLATE);
    // Im Original bei (175,110) und (245,110), das gewählte rot (0x22DD6)
    this.knopf("LEIHEN", 175, 110, this.marketMode === "leihen");
    this.knopf("KAUFEN", 245, 110, this.marketMode === "kaufen");
    this.hit(175, 110, 57, 13, () => (this.marketMode = "leihen"));
    this.hit(245, 110, 57, 13, () => (this.marketMode = "kaufen"));
    // Angebot und Kontostand
    panel(ctx, 161, 131, 156, 50);
    const sel = entries[this.marketSel];
    if (sel) {
      // Läuft ein Bietgefecht, steht in der Liste die Zahl der Gebote statt des Preises - der
      // Wert gehört dann hierher, sonst könnte man nicht abschätzen, was man bieten muss.
      const auk = mk?.auctions?.find((a) => a.slot === sel.slot);
      const bietet = !!auk && auk.anzahl > 0;
      s.draw(ctx, `VON ${clubName(sel.club)}, ${sel.age} J.${bietet ? ` - ${wert(sel)} DM` : ""}`, 163, 135, COLORS.white);
      if (sel.owner === me) s.draw(ctx, sel.offer ? "ANGEBOT LIEGT VOR - ANKLICKEN" : "IHR SPIELER - KLICK HOLT ZUR]CK", 163, 143, COLORS.text);
      else if (sel.rejectedBy.includes(me)) s.draw(ctx, "ANGEBOT WURDE BEREITS ABGELEHNT", 163, 143, COLORS.red);
      else {
        // Version 2026: läuft auf den Spieler ein Bietgefecht, steht das hier ausdrücklich (#19)
        s.draw(ctx, bietet ? "MITBIETEN - ANKLICKEN" : `${this.marketMode === "leihen" ? "LEIHGEB]HR" : "IHR ANGEBOT"} - ANKLICKEN`, 163, 143, COLORS.text);
        if (bietet) s.draw(ctx, "BIETGEFECHT BIS ZUM TAGESWECHSEL", 163, 151, COLORS.highlight);
        else if (sel.owner !== MARKET_MANAGER) s.draw(ctx, `VON ${toGame(g.managers.at(sel.owner).displayName)}`, 163, 151, COLORS.textDim);
      }
    }
    // Version 2026: Kaufsperre bei Überschuldung (das Bietgefecht steht in der Liste)
    const x2026 = this.server.extra;
    if (x2026 && is2026(g) && x2026.blocked?.[me]) s.draw(ctx, "KAUFSPERRE (KONTO IM MINUS)", 163, 151, COLORS.red);
    // "Kontostand:" y 158, Strich y 166, Betrag y 170 in Palettenfarbe 11 (im Original gemessen)
    f.draw(ctx, "Kontostand:", 165, 158, PLATE, false);
    hline(ctx, 163, 166, 152, PLATE);
    f.draw(ctx, dm(g.managers.at(me).balance), 165, 170, "#a2a2c3", false);
    this.sideButtons([]);
    this.drawMarketDialogs(mk);
  }

  marketClick(i: number, e: MarketEntry): void {
    if (!this.online) return;
    const me = this.manager;
    if (this.marketSel !== i) {
      this.marketSel = i;
      return;
    }
    if (e.owner === me) {
      if (e.offer) void this.post("api/market/offer", { manager: me, player: this.player, where: "market", place: e.slot });
      else this.fragJaNein([`${cp437ToGame(e.name)}`, "VOM TRANSFERMARKT ZUR]CKHOLEN?"], () => void this.post("api/market/takeback", { manager: me, player: this.player, slot: e.slot }));
      return;
    }
    const loan = this.marketMode === "leihen";
    const preis = loan ? Math.trunc(e.price / 3) : e.price;
    this.fragZahl(`${loan ? "LEIHGEB]HR" : "IHR ANGEBOT"} F]R ${cp437ToGame(e.name)}`, loan ? "LEIHGEB]HR (IN DM)" : "ANGEBOT (IN DM)", preis, 8, (betrag) => {
      void this.post("api/market/buy", { manager: me, player: this.player, slot: e.slot, amount: betrag, loan });
    });
  }

  marketSquadClick(place: number, offer: boolean): void {
    if (!this.online) return;
    const me = this.manager;
    const name = dosText(this.game!.players.at(this.game!.lineups.at(me * 25 + place).playerIndex).name);
    if (offer) void this.post("api/market/offer", { manager: me, player: this.player, where: "squad", place });
    else this.fragJaNein([toGame(name), "AUF DEN TRANSFERMARKT SETZEN?"], () => void this.post("api/market/list", { manager: me, player: this.player, place }));
  }

  /**
   * Zahleneingabe im Spielbild: Ziffern tippen, RÜCKTASTE löscht, TAB oder EINGABE springt zum
   * nächsten Feld, EINGABE im letzten Feld bestätigt, ESC bricht ab.
   */
  onKey(e: KeyboardEvent): void {
    // Den Hinweiskasten schließt im Original jede Taste
    if (this.hinweis || this.serverHinweis()) {
      this.hinweisSchliessen();
      return;
    }
    const ein = this.eingabe;
    if (!ein) return;
    const f = ein.felder[ein.feld];
    if (e.key >= "0" && e.key <= "9") {
      if (f.wert.length < f.max) f.wert += e.key;
    } else if (f.text && e.key.length === 1 && (f.roh ? /[A-Za-z0-9._@+-]/ : /[A-Za-z0-9 ._-]/).test(e.key)) {
      // Adressen kommen unverändert ins Feld: das Original kennt nur Großbuchstaben, ein
      // Postfach nicht (GitLab #65)
      if (f.wert.length < f.max) f.wert += f.roh ? e.key : e.key.toUpperCase();
    } else if (e.key === "Backspace") f.wert = f.wert.slice(0, -1);
    else if (e.key === "Tab" || e.key === "ArrowDown") ein.feld = (ein.feld + 1) % ein.felder.length;
    else if (e.key === "ArrowUp") ein.feld = (ein.feld + ein.felder.length - 1) % ein.felder.length;
    else if (e.key === "Enter") {
      if (ein.feld < ein.felder.length - 1) ein.feld++;
      else this.eingabeFertig();
    } else if (e.key === "Escape") this.eingabe = null;
    else return;
    // Wie im Original (0x25B8D -> 0x25C27): sobald die Laufzeit steht, rechnet das Spiel die
    // Gehaltsforderung aus und schreibt sie ins zweite Feld. Wer will, überschreibt sie.
    if (ein.gehaltFuer && ein.feld === 0 && ein.felder.length > 1) {
      const jahre = Math.trunc(Number(ein.felder[0].wert || "0"));
      if (jahre >= 1) ein.felder[1].wert = String(ein.gehaltFuer(jahre));
    }
    e.preventDefault();
    this.render();
  }

  eingabeFertig(): void {
    const ein = this.eingabe;
    if (!ein) return;
    this.eingabe = null;
    ein.ok(ein.felder.map((f) => Math.trunc(Number(f.wert.replace(/[^0-9-]/g, "") || "0"))), ein.felder.map((f) => f.wert));
    this.render();
  }

  /** Vertragsangebot eingeben (Vertragsdialog 0x251FF: VERTRAGSDAUER (IN SAISONS), GEHALT PRO MONAT (IN DM)). */
  fragVertrag(titel: string, salary: number, years: number, imKasten: boolean, ok: (jahre: number, gehalt: number) => void, gehaltFuer?: (jahre: number) => number): void {
    this.eingabe = {
      titel,
      gehaltFuer,
      felder: [
        { label: T("ui.vertragskasten", 0), wert: String(years), max: 1 },
        { label: T("ui.vertragskasten", 1), wert: String(salary), max: 7 },
      ],
      feld: 0,
      imKasten,
      ok: (werte) => {
        if (!(werte[0] >= 1) || !(werte[1] >= 0)) {
          this.status = "Angabe ung}ltig";
          this.statusUntil = Date.now() + 6000;
          return;
        }
        ok(werte[0], werte[1]);
      },
    };
    this.status = "ZIFFERN TIPPEN, EINGABE WEITER, ESC ABBRUCH";
    this.statusUntil = Date.now() + 20000;
    this.render();
  }

  /** Eine einzelne Zahl abfragen (Angebot, Leihgebühr) - gleicher Kasten wie beim Vertrag. */
  /** Mehrere Felder im Kasten des Spiels; das Original fragt so nach Summe, Laufzeit und Zins. */
  fragZahlen(titel: string, felder: { label: string; wert: number; max: number }[], ok: (werte: number[]) => void, okLabel = "OKAY"): void {
    this.eingabe = { titel, felder: felder.map((f) => ({ label: f.label, wert: String(f.wert), max: f.max })), feld: 0, imKasten: false, okLabel, ok };
    this.status = "ZIFFERN TIPPEN, EINGABE BEST[TIGT, ESC BRICHT AB";
    this.statusUntil = Date.now() + 20000;
    this.render();
  }

  /** Texteingabe im Kasten des Spiels (Managername, Dateiname) - keine Browserfenster. */
  fragText(titel: string, label: string, wert: string, max: number, ok: (text: string) => void, roh = false): void {
    this.eingabe = {
      titel,
      felder: [{ label, wert: roh ? wert : wert.toUpperCase(), max, text: true, roh }],
      feld: 0,
      imKasten: false,
      okLabel: "OKAY",
      ok: (_werte, texte) => ok(texte[0].trim()),
    };
    this.status = "TIPPEN, EINGABE BEST[TIGT, ESC BRICHT AB";
    this.statusUntil = Date.now() + 20000;
    this.render();
  }

  fragZahl(titel: string, label: string, wert: number, max: number, ok: (zahl: number) => void): void {
    this.eingabe = {
      titel,
      felder: [{ label, wert: String(wert), max }],
      feld: 0,
      imKasten: false,
      ok: (werte) => ok(werte[0]),
    };
    this.status = "ZIFFERN TIPPEN, EINGABE BEST[TIGT, ESC BRICHT AB";
    this.statusUntil = Date.now() + 20000;
    this.render();
  }

  /**
   * Ein Eingabefeld zeichnen: der Wert steht wie im Original hinter dem Doppelpunkt, das
   * bearbeitete Feld bekommt einen Balken als Schreibmarke und lässt sich anklicken.
   */
  zahlFeld(x: number, y: number, wert: string, aktiv: boolean, breite: number, fokus: () => void): void {
    const ctx = this.ctx;
    const s = this.assets.micro;
    if (aktiv) {
      ctx.fillStyle = "#414161";
      ctx.fillRect(x - 1, y - 1, breite, 7);
    }
    s.draw(ctx, wert, x, y, aktiv ? "#f3f300" : COLORS.white, false);
    if (aktiv) {
      ctx.fillStyle = "#f3f300";
      ctx.fillRect(x + s.width(wert) + 1, y - 1, 1, 7);
    }
    this.hit(x - 1, y - 2, breite, 9, fokus);
  }

  /** Kurze Rückmeldung mit einem Knopf, wie sie das Original für Absagen zeigt. */
  /**
   * Hinweiskasten des Originals (0x3174A, aufgerufen als 3091:0E3A an 25 Stellen: Absagen am
   * Transfermarkt, Kalendermeldungen aus 0x143ED, ...). Im Code nachgelesen (GitLab #31):
   *
   * - Fenster (60,110) 185x65 im Stil der blauen Fenster (0x6D17, Stil 1), gefüllt mit Farbe 16
   * - vier Zeilen in der großen Schrift, mittig zwischen 60 und 245, unterste Zeilen 123, 133,
   *   143 und 153, Farbe 10, ohne Schatten
   * - OKAY bei (178,160) über 0x31B4D, Beschriftung in Farbe 26
   * - geschlossen wird mit OKAY oder einer Taste
   *
   * Das Original setzt dazu den Mauszeiger auf den Knopf und danach wieder zurück - einen
   * Rechnerzeiger kann eine Webseite nicht versetzen.
   */
  /**
   * Abschlussbild (0x1A36D): Deutschlandfahne mit dem Vereinsnamen oben, "gewinnt die" bzw.
   * "gewinnt den" darunter, dem Pokal in der Mitte (PIC/50..54.VGA, 88x88 bei 116,84) und dem
   * Titel unten. Im Original in DOSBox nachgemessen: heller Rahmen ein Pixel rings herum,
   * Schwarz bis Zeile 79, Rot bis 160, Gold bis 238; der Vereinsname sitzt in der großen
   * Schrift bei y 18, "gewinnt die" in der normalen bei 54, der Titel wieder groß bei 206.
   * Ein Klick irgendwohin schließt es, dann geht es weiter.
   */
  drawAbschluss(): void {
    const eintrag = (this.server.abschluss ?? []).find((a) => a.manager === this.manager);
    if (!eintrag || !this.online || this.live) return;
    const ctx = this.ctx;
    // Das Bild liegt über allem: darunter trifft kein Klick mehr
    this.hits = [];
    ctx.fillStyle = "#d3c3b2";
    ctx.fillRect(0, 0, W, H);
    const band = (y0: number, y1: number, farbe: string) => {
      ctx.fillStyle = farbe;
      ctx.fillRect(1, y0, W - 2, y1 - y0 + 1);
    };
    band(1, 79, COLORS.black);
    band(80, 160, "#b20020");
    band(161, 238, "#c37120");
    const pokal = this.assets.img(`${50 + eintrag.kind}.VGA`);
    if (pokal) ctx.drawImage(pokal, 116, 84);
    const gross = this.assets.gross;
    const f = this.assets.font;
    // Vereinsname, dazwischen "gewinnt die/den", unten der Titel
    const titel = eintrag.kind === 0 ? T("quell.server", 5) : cupNames()[eintrag.kind - 1];
    // Mittig über die ganze Breite wie im Original, und die große Schrift trägt ihren Schatten
    // ein Pixel rechts, nicht rechts unten
    const mitte = (font: Font, text: string) => Math.trunc((W - 1 - font.width(text)) / 2);
    const grossMitte = (text: string, y: number) => {
      const x = mitte(gross, text);
      gross.draw(ctx, text, x + 1, y, COLORS.black, false);
      gross.draw(ctx, text, x, y, COLORS.white, false);
    };
    grossMitte(toGame(eintrag.verein), 19);
    const zwischen = T("quell.server", eintrag.kind === 0 ? 8 : 7);
    f.draw(ctx, zwischen, mitte(f, zwischen), 54, COLORS.white, false);
    grossMitte(toGame(titel.toUpperCase()), 207);
    this.hit(0, 0, W, H, () => void this.post("api/abschluss", { manager: this.manager, player: this.player }));
  }

  drawHinweis(): void {
    const zeilen = this.hinweis ?? this.serverHinweis()?.zeilen;
    if (!zeilen) return;
    const ctx = this.ctx;
    const f = this.assets.font;
    // Der Kasten liegt über allem: darunter trifft kein Klick mehr
    this.hits = [];
    panel(ctx, 60, 110, 185, 65, "#610010");
    zeilen.slice(0, 4).forEach((zeile, i) => {
      const t = toGame(dosText(zeile));
      f.draw(ctx, t, 60 + Math.trunc(185 / 2) - Math.trunc(f.width(t) / 2), 117 + 10 * i, "#b1a282", false);
    });
    this.knopf("OKAY", 178, 160, "#826141");
    this.hit(178, 160, 57, 12, () => this.hinweisSchliessen());
    this.hit(0, 0, W, H, () => undefined);
  }

  /**
   * Kalendermeldung des Servers, die für diesen Manager ansteht. Das Original zeigt sie beim
   * ersten Öffnen des Hauptmenüs im Zug (0x9FCF ruft 0x143ED einmal je Aufruf des Menüs) -
   * hier also nur im Hauptmenü und nicht mitten in einer Konferenz.
   */
  serverHinweis(): { manager: number; zeilen: string[] } | undefined {
    if (this.screen !== "menu" || this.live || !this.online) return undefined;
    const liste = (this.server.hinweise ?? []).filter((h) => h.manager === this.manager);
    // Nach OKAY bleibt der Kasten weg, bis der Server den Hinweis gestrichen hat
    return liste.length > 0 && this.hinweisQuittiert !== liste.length ? liste[0] : undefined;
  }

  hinweisSchliessen(): void {
    if (this.hinweis) {
      this.hinweis = null;
      this.render();
      return;
    }
    const liste = (this.server.hinweise ?? []).filter((h) => h.manager === this.manager);
    if (!liste.length) return;
    this.hinweisQuittiert = liste.length;
    this.render();
    void this.post("api/hinweis", { manager: this.manager, player: this.player });
  }

  /** Rückfrage stellen; beantwortet wird sie im Kasten des Originals (drawFrage). */
  fragJaNein(zeilen: string[], ja: () => void): void {
    this.frage = { zeilen, ja };
  }

  /**
   * Rückfrage mit JA und NEIN im Kasten des Originals - das Spiel hat keine Browserfenster.
   * Sie liegt über allem: solange sie steht, ist alles darunter tot (die Trefferliste wird
   * geleert, sonst käme der Klick bei der Schaltfläche darunter an).
   */
  drawFrage(): void {
    if (!this.frage) return;
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const zeilen = this.frage.zeilen;
    const h = 48 + 8 * zeilen.length;
    const y = 120 - Math.trunc(h / 2);
    this.hits = [];
    bevel(ctx, 40, y, 240, h, COLORS.black);
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(42, y + 2, 236, h - 4);
    ctx.strokeStyle = "#a2a2c3";
    ctx.strokeRect(42.5, y + 2.5, 235, h - 5);
    zeilen.forEach((z, i) => s.drawCenter(ctx, toGame(z), 160, y + 12 + i * 8, i === 0 ? COLORS.white : COLORS.text));
    const by = y + h - 24;
    button(ctx, f, "JA", 72, by, 60, true);
    button(ctx, f, "NEIN", 188, by, 60);
    this.hit(72, by, 60, 16, () => {
      const ja = this.frage!.ja;
      this.frage = null;
      ja();
    });
    this.hit(188, by, 60, 16, () => {
      this.frage = null;
    });
  }

  /** Eingabekasten für Angebote außerhalb des Kaderbildschirms (gleicher Look wie das Original). */
  drawEingabe(): void {
    const ein = this.eingabe;
    if (!ein || ein.imKasten) return;
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    // Der Kasten liegt über dem Bildschirm: darunter trifft kein Klick mehr. Vorher gewann die
    // zuerst angemeldete Fläche - ein Klick in den Kasten landete in der Liste dahinter
    // (GitLab #46: "IHR ANGEBOT FÜR CRIENS" mit der Frage nach DEMANDT darin).
    this.hits = [];
    panel(ctx, 40, 70, 240, 86);
    f.drawCenter(ctx, toGame(ein.titel), 160, 76, COLORS.white, false);
    ein.felder.forEach((feld, i) => {
      const y = 96 + i * 12;
      s.draw(ctx, feld.label, 50, y, COLORS.white);
      s.draw(ctx, ":", 196, y, COLORS.white);
      this.zahlFeld(202, y, feld.wert, ein.feld === i, 60, () => {
        ein.feld = i;
        this.render();
      });
    });
    button(ctx, f, "ABBRUCH", 50, 130, 90);
    button(ctx, f, ein.okLabel ?? "ANGEBOT", 160, 130, 90, true);
    this.hit(50, 130, 90, 16, () => {
      this.eingabe = null;
      this.render();
    });
    this.hit(160, 130, 90, 16, () => this.eingabeFertig());
    this.hit(0, 0, W, H, () => undefined);
  }

  /** Verkaufsdialog (0x242CF), Vertragsverhandlung nach dem Kauf und Angebote anderer Manager. */
  drawMarketDialogs(mk: MarketState | undefined): void {
    if (!mk) return;
    // Wie beim Eingabekasten: ein offener Dialog schirmt die Listen darunter ab (GitLab #46)
    const abschirmen = (): void => {
      this.hits = [];
    };
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const me = this.manager;
    const sale = mk.sales.find((o) => o.manager === me);
    const purchase = mk.purchases.find((o) => o.manager === me);
    const incoming = mk.offers.filter((o) => o.owner === me);
    const outgoing = mk.offers.filter((o) => o.buyer === me);
    if (sale) {
      panel(ctx, 40, 60, 240, 90);
      abschirmen();
      f.drawCenter(ctx, cp437ToGame(g.clubs.at(sale.club).name), 160, 66, COLORS.white);
      f.drawCenter(ctx, "bietet f}r " + cp437ToGame(sale.name), 160, 78, COLORS.text, false);
      f.drawCenter(ctx, "Angebot: " + dm(sale.amount), 160, 92, COLORS.white, false);
      f.drawCenter(ctx, `Abl|se: ${dm(sale.fee)} (${sale.years} Jahre Vertrag)`, 160, 104, COLORS.text, false);
      button(ctx, f, "BEHALTEN", 60, 124, 90);
      button(ctx, f, "VERKAUFEN", 170, 124, 90, true);
      this.hit(60, 124, 90, 16, () => void this.post("api/market/decide", { manager: me, player: this.player, sell: false }));
      this.hit(170, 124, 90, 16, () => void this.post("api/market/decide", { manager: me, player: this.player, sell: true }));
      this.hit(0, 0, W, H, () => undefined);
      return;
    }
    if (purchase) {
      panel(ctx, 40, 50, 240, 120);
      abschirmen();
      f.drawCenter(ctx, cp437ToGame(purchase.name) + " kommt f}r " + dm(purchase.amount), 160, 56, COLORS.white, false);
      f.drawCenter(ctx, "Vertrag: Gehalt je Monat", 160, 68, COLORS.text, false);
      purchase.demands.forEach((d, i) => {
        const y = 82 + i * 12;
        button(ctx, f, `${i + 1} JAHR${i ? "E" : ""}  ${dm(d)}`, 60, y, 200);
        this.hit(60, y, 200, 12, () => void this.post("api/market/contract", { manager: me, player: this.player, years: i + 1, accept: true }));
      });
      button(ctx, f, "EIGENES ANGEBOT", 60, 132, 98);
      this.hit(60, 132, 98, 16, () => {
        this.fragVertrag(`ANGEBOT AN ${cp437ToGame(purchase.name)}`, purchase.demands[0], 1, false, (jahre, gehalt) => {
          void this.post("api/market/contract", { manager: me, player: this.player, years: jahre, salary: gehalt, accept: true });
        });
      });
      button(ctx, f, "KEIN VERTRAG", 162, 132, 98);
      this.hit(162, 132, 98, 16, () => void this.post("api/market/contract", { manager: me, player: this.player, accept: false }));
      this.hit(0, 0, W, H, () => undefined);
      return;
    }
    const subsidy = mk.subsidies?.find((o) => o.manager === me);
    if (subsidy) {
      // Sponsor-Zuschuss nach dem Kauf (0x0272D)
      panel(ctx, 40, 60, 240, 84);
      abschirmen();
      f.drawCenter(ctx, T("ui.marketdialogs", 0), 160, 66, COLORS.white);
      f.drawCenter(ctx, `ZUSCHU~ VON ${dm(subsidy.amount)} AN ?`, 160, 80, COLORS.white);
      button(ctx, f, T("ui.marketdialogs", 3), 60, 118, 90, true);
      button(ctx, f, T("ui.marketdialogs", 1), 170, 118, 90);
      this.hit(60, 118, 90, 16, () => void this.post("api/market/subsidy", { manager: me, player: this.player, accept: true }));
      this.hit(170, 118, 90, 16, () => void this.post("api/market/subsidy", { manager: me, player: this.player, accept: false }));
      this.hit(0, 0, W, H, () => undefined);
      return;
    }
    if (incoming.length > 0) {
      const o = incoming[0];
      panel(ctx, 40, 60, 240, 84);
      abschirmen();
      f.drawCenter(ctx, T("ui.marketdialogs", 2), 160, 66, COLORS.white);
      f.drawCenter(ctx, `(${dm(o.amount)}${o.loan ? ", LEIHE" : ""})`, 160, 78, COLORS.white);
      f.drawCenter(ctx, `VON ${toGame(g.managers.at(o.buyer).displayName)} F]R ${cp437ToGame(o.name)} AN ?`, 160, 90, COLORS.text);
      button(ctx, f, "NEIN !", 60, 118, 90);
      button(ctx, f, "NA GUT.", 170, 118, 90, true);
      this.hit(60, 118, 90, 16, () => void this.post("api/market/answer", { manager: me, player: this.player, buyer: o.buyer, slot: o.slot, accept: false }));
      this.hit(170, 118, 90, 16, () => void this.post("api/market/answer", { manager: me, player: this.player, buyer: o.buyer, slot: o.slot, accept: true }));
      this.hit(0, 0, W, H, () => undefined);
      return;
    }
    if (outgoing.length > 0) s.drawCenter(ctx, `ANGEBOT AN ${toGame(g.managers.at(outgoing[0].owner).displayName)} F]R ${cp437ToGame(outgoing[0].name)} L[UFT`, 240, 160, COLORS.highlight);
  }

  /** Wappen-Untermenü "Spiele": Paarungen eines Spieltags mit Platz, Stärke und Ergebnis (docs/original/wappen-1-0.png). */
  drawSpiele(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const L = this.spieleLeague;
    const days = LEAGUES[L].matchdays;
    if (this.spieleMd < 1) this.spieleMd = 1;
    if (this.spieleMd > days) this.spieleMd = days;
    const md = this.spieleMd;
    panel(ctx, 2, 4, 316, 184);
    // Wie bei den Pokalrunden nennt das Original hinter dem Spieltag dessen Datum
    const datum = matchdayDate(g, L, md);
    f.drawCenter(ctx, toGame(`SPIELE ${texte("ui.ligen")[L]}   ${md}.SPIELTAG${datum ? ` ${datum.day}.${datum.month0 + 1}.` : ""}`), 160, 8, COLORS.white);
    let y = 20;
    for (const r of matchdayView(g, L, md)) {
      const c = this.game!.managers.at(this.manager).clubIndex;
      const mine = r.home === c || r.away === c;
      const col = mine ? COLORS.white : COLORS.text;
      f.draw(ctx, cp437ToGame(g.clubs.at(r.home).name), 6, y, col, false);
      f.draw(ctx, "- " + cp437ToGame(g.clubs.at(r.away).name), 146, y, col, false);
      f.drawRight(ctx, r.result ? `${r.result.home}:${r.result.away}` : r.postponed ? "verlegt" : "-:-", 312, y, col, false);
      const info = (club: number, place: number) => {
        const st = clubStrength(g, club);
        return `${place}. PLATZ, ST[RKE ${st.total} (${st.ko},${st.te},${st.fo})`;
      };
      s.draw(ctx, info(r.home, r.homePlace), 10, y + 9, COLORS.textDim);
      s.draw(ctx, info(r.away, r.awayPlace), 152, y + 9, COLORS.textDim);
      // Klick auf eine Paarung (0x2C089): links der Heimverein mit der Heimansicht, rechts
      // (x > 0x8C) der Gast mit der Auswärtsansicht; die Tafel steht zwei Punkte weiter rechts
      this.hit(2, y - 1, 139, 16, () => this.oeffneVereinsInfo(r.home, 0, 1));
      this.hit(141, y - 1, 176, 16, () => this.oeffneVereinsInfo(r.away, 1, 1));
      y += 16;
    }
    bevel(ctx, 6, 196, 46, 38);
    bevel(ctx, 9, 199, 40, 32, COLORS.panel, true);
    drawIcon(ctx, this.assets, "links", 13, 203);
    this.hit(6, 196, 46, 38, () => (this.spieleMd = Math.max(1, this.spieleMd - 1)));
    bevel(ctx, 60, 196, 46, 38);
    bevel(ctx, 63, 199, 40, 32, COLORS.panel, true);
    drawIcon(ctx, this.assets, "rechts", 67, 203);
    this.hit(60, 196, 46, 38, () => (this.spieleMd = Math.min(days, this.spieleMd + 1)));
    this.sideButtons([]);
  }

  /**
   * Stärketabelle (0x2DCA1), am Original vermessen: Kasten (61,17) bis (248,195), darin die
   * Trennstriche bei y 35 und y 178 von x 63 bis 246. Überschrift in großer Schrift mittig
   * zwischen 61 und 248 (unterste Zeile 25), Kopfzeile und Zeilen in kleiner Schrift bei x 65
   * (Platz und Verein) und x 162 (die drei Werte im Abstand von 12 Leerzeichen); Zeile i steht
   * bei y = (i + 6)·7. Zahlen füllt das Original links mit '^' auf zwei Stellen auf - in der
   * kleinen Schrift ist das ein leeres Zeichen von Ziffernbreite, die Spalten stehen also
   * bündig. Unter dem Strich wechselt ein Knopf (133,181) bis (189,192) reihum zwischen
   * GESAMT, ABWEHR, MITTELFELD und STURM.
   */
  drawStaerken(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const L = this.staerkenLeague;
    const rows = strengthTable(g, L, this.staerkenMode);
    panel(ctx, 61, 17, 188, 179);
    const hell = "#a2a2c3";
    const titel = toGame(`ST[RKEN ${texte("ui.ligen")[L]}`);
    const tx = 61 + Math.trunc(187 / 2) - Math.trunc(f.width(titel) / 2);
    f.draw(ctx, titel, tx + 1, 19, "#303051", false);
    f.draw(ctx, titel, tx, 19, hell, false);
    s.draw(ctx, T("ui.staerken", 1), 65, 29, hell, false);
    hline(ctx, 63, 35, 184, hell);
    hline(ctx, 63, 178, 184, hell);
    // Die Vereine der Manager stehen in Farbe 11 statt 1
    const managerClubs = new Set(g.activeManagers().map((m) => m.clubIndex));
    const pad = (n: number) => "^".repeat(Math.max(0, 2 - String(n).length)) + n;
    rows.forEach((r, i) => {
      const y = (i + 6) * 7 - 4;
      const c = managerClubs.has(r.club) ? "#d3c3b2" : hell;
      s.draw(ctx, `${pad(r.place)}. ${cp437ToGame(g.clubs.at(r.club).name)}`, 65, y, c, false);
      s.draw(ctx, `${pad(r.ko)}            ${pad(r.te)}            ${pad(r.fo)}`, 162, y, c, false);
      // Klick auf einen Verein (0x2E38A): Vereinsinfo in der Gesamtansicht
      this.hit(63, y - 1, 184, 7, () => this.oeffneVereinsInfo(r.club, 2, 0));
    });
    this.knopf(strengthModes()[this.staerkenMode], 133, 181, true);
    this.hit(133, 178, 57, 16, () => (this.staerkenMode = (this.staerkenMode + 1) % 4));
    this.sideButtons([]);
  }

  /**
   * Bestenliste (0x16515), am Original vermessen: Kasten (35,8) bis (285,189), Überschrift
   * "Die Besten der Liga" bzw. "... der Spieler" mittig zwischen 35 und 285 (unterste Zeile 16,
   * Farbe 1 mit Schatten 7). Kopfzeilen in kleiner Schrift bei x 38 und x 210 (Zeile 24), in der
   * Ligaansicht darunter ein Strich bei y 26 von x 36 bis 284. Die Einträge stehen bei
   * y = 34 + 7·i mit den Spalten 38 (Platz und Name), 114 (Verein), 212 (Tore) und 252
   * (Tore/Spiel); Platz und Tore füllt das Original links mit '^' auf zwei Stellen auf.
   * Vereine der Manager stehen in Farbe 11. Unten die Schaltflächen LIGA (54,175) und
   * SPIELER (212,175), die gewählte in Farbe 17, die andere in Farbe 10.
   */
  drawBestenliste(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    if (this.bestLeague < 0) this.bestLeague = this.leagueOf(this.manager);
    const liga = this.bestMode === "liga";
    // Beide Listen kommen aus der Bestenliste der Liga; SPIELER zeigt daraus nur die Vereine
    // der Mitspieler, mit den Plätzen der Ligaliste (GitLab #55)
    const rows = liga ? leagueScorers(g, this.bestLeague) : playerScorers(g, this.bestLeague);
    panel(ctx, 35, 8, 251, 182);
    const hell = "#a2a2c3";
    const titel = `${T("ui.bestenkopf")}${liga ? "Liga" : "Spieler"}`;
    const tx = 35 + Math.trunc(250 / 2) - Math.trunc(f.width(titel) / 2);
    f.draw(ctx, titel, tx + 1, 10, "#303051", false);
    f.draw(ctx, titel, tx, 10, hell, false);
    s.draw(ctx, T("ui.bestenliste", 0), 38, 20, hell, false);
    s.draw(ctx, T("ui.bestenliste", 1), 210, 20, hell, false);
    hline(ctx, 36, 26, 249, hell);
    const managerClubs = new Set(g.activeManagers().map((m) => m.clubIndex));
    const pad = (n: number) => "^".repeat(Math.max(0, 2 - String(n).length)) + n;
    rows.slice(0, 20).forEach((r, i) => {
      const y = 30 + 7 * i;
      const c = managerClubs.has(r.club) ? "#d3c3b2" : hell;
      s.draw(ctx, `${pad(r.place)}. ${toGame(r.name)}`, 38, y, c, false);
      s.draw(ctx, cp437ToGame(g.clubs.at(r.club).name), 114, y, c, false);
      s.draw(ctx, pad(r.goals), 212, y, c, false);
      // Tore je Spiel mit einer Nachkommastelle (10·Tore/Einsätze)
      const zehntel = r.apps ? Math.trunc((10 * r.goals) / r.apps) : 10 * r.goals;
      s.draw(ctx, `${Math.trunc(zehntel / 10)}.${zehntel % 10}`, 252, y, c, false);
    });
    if (rows.length === 0) {
      const leer = toGame(T("ui.bestenliste", 2));
      s.draw(ctx, leer, 35 + Math.trunc(250 / 2) - Math.trunc(s.width(leer) / 2), 34, hell, false);
    }
    this.knopf("LIGA", 54, 175, liga ? "#920010" : "#b2a282");
    this.knopf("SPIELER", 212, 175, liga ? "#b2a282" : "#920010");
    this.hit(54, 175, 57, 13, () => (this.bestMode = "liga"));
    this.hit(212, 175, 57, 13, () => (this.bestMode = "spieler"));
    this.sideButtons([]);
  }

  /**
   * Pokalspiele (0x198EB): nach Ligapaarung sortiert. Das Original bildet je Paarung den Wert
   * (Ligabit Heim << 3) | Ligabit Gast (Bundesliga 1, Zweite Liga 2, Am.-Oberliga 4) und ordnet
   * ihn über die Tabellen 4cb3:0654/065C sechs Gruppen zu, jede mit eigener Überschrift.
   * Spalten im Original vermessen (GitLab #56): Heim mittig bei 65, GEGEN bei 140, Gast bei 205,
   * Ergebnis rechtsbündig bei 287, Zeilen ab y = 49 im Abstand 7, Überschriften mittig bei 149.
   * Der Knopf AUSLOSUNG ist unsere Zutat: im Original läuft die Auslosung von selbst, hier
   * muss sie jemand anstoßen, weil alle Mitspieler dabei zusehen.
   */
  drawPokal(): void {
    this.drawCupList(this.cup);
    const f = this.assets.font;
    if (cupView(this.game!, this.cup).pairs.length > 0) {
      button(this.ctx, f, "AUSLOSUNG", 8, 186, 70, true);
      this.hit(8, 186, 70, 16, () => this.startAuslosung());
    }
    this.sideButtons([]);
  }

  /** Spielübersicht eines Wettbewerbs, nach Ligapaarung gruppiert (0x198EB). */
  drawCupList(cup: number): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const v = cupView(g, cup);
    const d = nextCupDate(g, cup);
    const SCHATTEN = "#303051";
    // Hervorgehoben sind die Vereine **aller** Manager, nicht nur der eigene (im Original gesehen)
    const mine = new Set(g.activeManagers().map((m) => m.clubIndex));
    const rows: { head?: string; leer?: boolean; pair?: (typeof v.pairs)[number] }[] = [];
    if (cup === 0) {
      for (const [a, b] of LEAGUE_GROUPS) {
        const inGroup = v.pairs.filter((r) => {
          const l = [leagueOfClub(r.home), leagueOfClub(r.away)].sort();
          return l[0] === a && l[1] === b;
        });
        // Auch leere Gruppen bekommen ihre Überschrift; darunter steht eine Strichzeile
        rows.push({ head: `${LEAGUE_CAPS[a]} GEGEN ${LEAGUE_CAPS[b]}:` });
        if (inGroup.length === 0) rows.push({ leer: true });
        for (const r of inGroup) rows.push({ pair: r });
      }
    } else for (const r of v.pairs) rows.push({ pair: r });
    /**
     * Die Tafel wächst mit ihrem Inhalt (0x199EF bis 0x19A7A): das Original zählt die Paarungen
     * und schlägt für jede **leere** Ligagruppe eine Zeile drauf (deren Strichzeile), rechnet
     * Höhe = 7·Zeilen + 58 - die 58 fassen Titel, Strich und die sechs Überschriften - und setzt
     * die Tafel senkrecht mittig: y = (233 - Höhe)/2 - 20, gezeichnet ab y+5 mit Höhe-8.
     *
     * Gegenprobe mit der Messung aus #56: elf Zeilen ergeben Höhe 135, also Tafel (5,34) 308x127
     * - genau das war dort abgelesen. Vorher stand die Tafel fest auf diesem einen Fall, und ein
     * volles Erstrundenfeld fiel unten heraus: bei sechzehn Paarungen fehlten vier Spiele
     * Oberliga gegen Oberliga (GitLab #68).
     *
     * Für die Europapokale bleibt es beim festen Kasten: dort gibt es keine Überschriften, die
     * Runde hat höchstens sechzehn Paarungen, und die passen hinein. Die Formel des Originals
     * rechnet dort mit anderen Vorgaben, die hier nicht nachgemessen sind.
     */
    const leereGruppen = cup === 0 ? rows.filter((r) => r.leer).length : 0;
    const hoehe = cup === 0 ? 7 * (v.pairs.length + 1 + leereGruppen) + 58 : 135;
    const tafel = Math.trunc((233 - hoehe) / 2) - 20 + 5;
    panel(ctx, 5, tafel, 309, hoehe - 7);
    // Das Original zeigt hinter dem Titel den Spieltag ("1.Runde DfB-Pokal   26.8.")
    f.drawCenter(ctx, toGame(`${v.round} ${v.name}${d ? `    ${d.day}.${d.month0 + 1}.` : ""}`), 159, tafel + 2, PLATE, SCHATTEN);
    hline(ctx, 7, tafel + 10, 305, PLATE);
    const unten = tafel + hoehe - 14;
    let y = tafel + 15;
    for (const row of rows) {
      if (y > unten) break;
      if (row.head) s.drawCenter(ctx, toGame(row.head), 149, y, "#8282a2");
      // Neun Striche ab x 118; das Original nimmt dafür '@', den langen Strich der Schrift
      else if (row.leer) s.draw(ctx, "@@@@@@@@@", 118, y, "#8282a2", SCHATTEN);
      else {
        const r = row.pair!;
        // Der eigene Verein steht in Palettenfarbe 12, nicht in Weiß
        const col = (club: number) => (mine.has(club) ? PLATE : "#a2a2c3");
        s.drawCenter(ctx, cp437ToGame(g.clubs.at(r.home).name), 65, y, col(r.home), SCHATTEN);
        s.drawCenter(ctx, "GEGEN", 140, y, "#717192");
        s.drawCenter(ctx, cp437ToGame(g.clubs.at(r.away).name), 205, y, col(r.away), SCHATTEN);
        s.drawRight(ctx, `(${r.result[0]}:${r.result[1]})`, 287, y, "#a2a2c3", false);
        if (cup > 0) s.drawRight(ctx, `(${r.firstLeg ? r.firstLeg.join(":") : "0:0"})`, 313, y, "#a2a2c3", false);
      }
      y += 7;
    }
    if (v.pairs.length === 0) s.drawCenter(ctx, "KEINE PAARUNGEN", 160, tafel + 66, COLORS.textDim);
  }

  /**
   * Einstellungen (0x264A8). Im Original nachgemessen: Kasten (13,13) 294x169 in Farbe 8,
   * Kopfzeile "V2.0 - ENDE: ... (LEVEL n)" in der kleinen Schrift bei (16,23), Trennstriche bei
   * y 17 (Farbe 1) sowie y 98 und y 180 (weiss), je von x 16 bis 304. Die Ligaköpfe stehen bei
   * (125,29), (184,29) und (242,29).
   *
   * Fünfzehn Schalter (Werte im Original in DGROUP 0x5FE): drei Zeilen je Liga - Halbzeitstände,
   * Ergebnisse, Tabelle - und darunter Torszenen, DfB-Pokal, Europapokale, Nachholspiele links
   * sowie Zeitung und Blenden rechts. Ihre Plätze stehen im Original in zwei Tabellen
   * (x 4cb3:5454, y 4cb3:5464); AN sitzt bei (x,y), AUS 26 Punkte weiter rechts, beide 24x17 aus
   * PIC/33.VGA (AN hell ab Spalte 100, AUS hell ab 124, AN gedrückt ab 148, AUS gedrückt ab 172).
   * Darunter der Geschwindigkeitsregler: Leiste 100x19 aus derselben Grafik bei (190,155), der
   * Knopf als Balken bei (202 + Wert, 161) auf der Bahn 202..277.
   */
  drawOptionen(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    const s = this.assets.micro;
    const g = this.game!;
    const o = this.server.options ?? { tempo: 6, scenes: true, zeitung: true, flags: OPTION_DEFAULTS.slice() };
    const flags = o.flags ?? OPTION_DEFAULTS.slice();
    const level = 5 - g.save.plain[34062];
    const INK = "#a2a2c3";
    panel(ctx, 13, 13, 294, 169);
    s.draw(ctx, toGame(`V2.0 - ENDE:  NIE. (LEVEL ${level})`), 16, 19, "#717192", false);
    // Regelwerk des Spielstands: nur wenn es nicht das Original ist, steht es rechts daneben
    if (is2026(g)) s.drawRight(ctx, ruleName(g), 303, 19, "#b20020", false);
    hline(ctx, 16, 17, 289, INK);
    hline(ctx, 16, 98, 289, COLORS.white);
    hline(ctx, 16, 180, 289, COLORS.white);
    ["1.Liga", "2.Liga", "3.Liga"].forEach((t, i) => f.draw(ctx, t, [125, 184, 242][i], 23, INK, false));
    // Die Beschriftungen tragen ihren schwarzen Schatten wie im Original in derselben Zeile bei x+1
    const mitte = (text: string, x1: number, x2: number, y: number) => {
      const t = toGame(text);
      const x = x1 + Math.trunc((x2 - x1) / 2) - Math.trunc(f.width(t) / 2);
      f.draw(ctx, t, x + 1, y - 6, COLORS.black, false);
      f.draw(ctx, t, x, y - 6, COLORS.white, false);
    };
    mitte(T("ui.optionen", 0), 22, 121, 46);
    mitte("Ergebnisse", 22, 121, 64);
    mitte("Tabelle", 22, 121, 83);
    mitte("Torszenen", 22, 121, 111);
    mitte("DfB-Pokal", 22, 121, 130);
    mitte(T("ui.optionen", 1), 22, 121, 148);
    mitte(T("ui.optionen", 2), 22, 121, 168);
    mitte("Zeitung", 172, 237, 111);
    mitte("Blenden", 172, 237, 130);
    mitte(T("ui.optionen", 3), 182, 300, 150);
    // Die Schalter
    const pic = this.assets.img("33.VGA");
    OPTION_PLACES.forEach(([x, y], i) => {
      const an = flags[i];
      if (pic) {
        ctx.drawImage(pic, an ? 148 : 100, 0, 24, 17, x, y, 24, 17);
        ctx.drawImage(pic, an ? 124 : 172, 0, 24, 17, x + 26, y, 24, 17);
      }
      this.hit(x, y, 24, 17, () => void this.post("api/options", { manager: this.manager, player: this.player, flag: i, value: true }));
      this.hit(x + 26, y, 24, 17, () => void this.post("api/options", { manager: this.manager, player: this.player, flag: i, value: false }));
    });
    // Geschwindigkeit: im Original ein Wert 0..75 auf der Bahn, hier die neun Stufen des Servers
    if (pic) ctx.drawImage(pic, 0, 0, 100, 19, 190, 155, 100, 19);
    // Bahn freiräumen und den Knopf setzen (0x26376): 6x7 in Rot mit hellem Rand rechts unten
    ctx.fillStyle = "#515171";
    ctx.fillRect(202, 161, 76, 8);
    const wert = Math.round(((o.tempo - 1) * 75) / 8);
    const kx = 202 + wert;
    ctx.fillStyle = "#b20020";
    ctx.fillRect(kx, 161, 6, 7);
    ctx.fillStyle = "#920010";
    ctx.fillRect(kx, 161, 6, 1);
    ctx.fillRect(kx, 161, 1, 7);
    ctx.fillStyle = "#c37120";
    ctx.fillRect(kx + 5, 162, 1, 6);
    ctx.fillRect(kx + 1, 167, 5, 1);
    ctx.fillStyle = "#610010";
    ctx.fillRect(kx, 161, 1, 1);
    this.hit(202, 158, 82, 13, (cx) => {
      const t = Math.max(1, Math.min(9, Math.round(((cx - 202) * 8) / 75) + 1));
      void this.post("api/options", { manager: this.manager, player: this.player, tempo: t });
    });
    this.sideButtons([]);
  }

  drawMessages(): void {
    const ctx = this.ctx;
    const f = this.assets.font;
    this.drawMenuHeader();
    panel(ctx, 60, 112, 200, 122);
    const msgs = this.save!.messages().filter((m) => m.manager === this.manager);
    let y = 118;
    if (msgs.length === 0) f.drawCenter(ctx, T("ui.messages", 0), 160, y);
    for (const m of msgs) {
      for (const line of m.text.split("^")) {
        if (!line.trim()) continue;
        f.drawCenter(ctx, line, 160, y, COLORS.white);
        y += 10;
      }
      y += 6;
    }
    if (this.online && msgs.length > 0) {
      bevel(ctx, 268, 150, 46, 30);
      bevel(ctx, 271, 153, 40, 24, COLORS.panel, true);
      f.drawCenter(ctx, "GELESEN", 291, 161, COLORS.white);
      this.hit(268, 150, 46, 30, () => void this.post("api/messages/clear", { manager: this.manager, player: this.player }));
    }
    bevel(ctx, 268, 196, 46, 38);
    bevel(ctx, 271, 199, 40, 32, COLORS.panel, true);
    f.drawCenter(ctx, "HAUPT", 291, 202, COLORS.white);
    f.drawCenter(ctx, "MENU", 291, 212, COLORS.white);
    this.hit(268, 196, 46, 38, () => this.go("menu"));
  }
}

const app = new App();
(globalThis as unknown as { app: App }).app = app; // Entwicklung: Zugriff aus der Konsole
(window as unknown as { app: App }).app = app;
void app.init();
