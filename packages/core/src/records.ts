/**
 * Typisierte Sichten auf die Tabellen im Spielstand-Abbild.
 *
 * Jede Tabelle ist ein Block fester Länge mit Datensätzen fester Größe
 * (docs/MEMORY-MAP.md). Die Sichten schreiben direkt ins Abbild, damit ein
 * geänderter Spielstand wieder als Originaldatei gespeichert werden kann.
 * Felder, deren Bedeutung noch offen ist, sind über `raw` erreichbar.
 */
import { dosText, type SaveFile } from "./savefile.ts";

export interface Table {
  /** Offset im Spielstand */
  offset: number;
  /** Blocklänge in Bytes */
  length: number;
  /** Datensatzgröße in Bytes */
  record: number;
  /** Speicheradresse im Original als "seg:off" */
  address: string;
}

export const TABLES = {
  managers: { offset: 2345, length: 3112, record: 778, address: "4238:2242" },
  clubs: { offset: 5557, length: 6800, record: 34, address: "4238:3066" },
  standings: { offset: 12357, length: 3456, record: 54, address: "4238:0ecc" },
  players: { offset: 15813, length: 5587, record: 37, address: "4238:57dd" },
  lineups: { offset: 21400, length: 6500, record: 52, address: "4238:774a" },
  tableOrder: { offset: 27900, length: 60, record: 60, address: "4238:4b5e" },
  /** Ergebnisse der Saison: [liga 0..2][spieltag 0..37][spiel 0..9][heim, gast], 0xFF = offen */
  results: { offset: 59, length: 2280, record: 20, address: "4238:6ddc" },
  money80: { offset: 33598, length: 320, record: 4, address: "4238:002e" },
  /** Werbung je Manager: Trikot, 6 Banden, TV, Werbeausgaben (je i32). */
  advertising: { offset: 33918, length: 144, record: 36, address: "4cb3:066c" },
} as const satisfies Record<string, Table>;

export const SCALARS = {
  currentManager: 49,
  managerCount: 2339,
  day: 27960,        // Tag im Monat (bestätigt: 11)
  monthIndex: 27964, // Monat 0-basiert (bestätigt: 10 = November)
  year: 27968,       // bestätigt: 1997
  counter: 27972,    // 105, Bedeutung offen
  year16: 27976,
  nextMatchday: 28432, // 3 Bytes, je Liga 1-basiert (bestätigt: 16, 19, 19)
} as const;

function cstring(b: Uint8Array): string {
  const end = b.indexOf(0);
  let s = "";
  for (const c of end < 0 ? b : b.subarray(0, end)) s += String.fromCharCode(c);
  return s;
}

export class Record {
  protected readonly buf: Uint8Array;
  readonly index: number;
  protected readonly base: number;
  readonly size: number;

  constructor(buf: Uint8Array, index: number, base: number, size: number) {
    this.buf = buf;
    this.index = index;
    this.base = base;
    this.size = size;
  }

  get raw(): Uint8Array {
    return this.buf.subarray(this.base, this.base + this.size);
  }

  u8(off: number): number {
    return this.buf[this.base + off];
  }

  i8(off: number): number {
    return (this.buf[this.base + off] << 24) >> 24;
  }

  setU8(off: number, v: number): void {
    this.buf[this.base + off] = v & 0xff;
  }

  u16(off: number): number {
    return this.buf[this.base + off] | (this.buf[this.base + off + 1] << 8);
  }

  i16(off: number): number {
    return (this.u16(off) << 16) >> 16;
  }

  setU16(off: number, v: number): void {
    this.buf[this.base + off] = v & 0xff;
    this.buf[this.base + off + 1] = (v >> 8) & 0xff;
  }

  i32(off: number): number {
    return new DataView(this.buf.buffer, this.buf.byteOffset).getInt32(this.base + off, true);
  }

  setI32(off: number, v: number): void {
    new DataView(this.buf.buffer, this.buf.byteOffset).setInt32(this.base + off, v, true);
  }

  str(off: number, len: number): string {
    return cstring(this.buf.subarray(this.base + off, this.base + off + len));
  }
}

/** Vereinsdatensatz (34 Bytes). 200 Einträge, Bundesliga, 2. Liga, Ausland. */
export class Club extends Record {
  static NAME_LEN = 23;
  get name(): string {
    return this.str(0, Club.NAME_LEN);
  }
  get displayName(): string {
    return dosText(this.name);
  }
  /**
   * Drei Dreiergruppen (Bytes 24..26, 27..29, 30..32), aus denen das Spiel
   * Kondition, Technik und Form des Vereins bildet. Form = Durchschnitt der
   * dritten Gruppe (bestätigt), Kondition und Technik weichen vom einfachen
   * Durchschnitt um 1..2 Punkte ab, Gewichtung noch offen.
   */
  get strengthGroups(): number[][] {
    return [
      [this.u8(24), this.u8(25), this.u8(26)],
      [this.u8(27), this.u8(28), this.u8(29)],
      [this.u8(30), this.u8(31), this.u8(32)],
    ];
  }
  /** Stärkematrix für die Simulation (Bytes 23..32). */
  get strengthMatrix(): { base: number; ko: [number, number, number]; te: [number, number, number]; fo: [number, number, number] } {
    return {
      base: this.u8(23),
      ko: [this.u8(24), this.u8(25), this.u8(26)],
      te: [this.u8(27), this.u8(28), this.u8(29)],
      fo: [this.u8(30), this.u8(31), this.u8(32)],
    };
  }
  /** Form des Vereins (bestätigt: Werder 51, Dortmund 51, Kaiserslautern 50). */
  get form(): number {
    return Math.round((this.u8(30) + this.u8(31) + this.u8(32)) / 3);
  }
  /** Status/Liga, Zugriffe bei "Restprogramm" und "Anzeigen". */
  get status(): number {
    return this.u8(33);
  }
  get isEmpty(): boolean {
    return this.buf[this.base] === 0;
  }
}

/** Spielerdatensatz (37 Bytes). 151 Einträge: Kader der Manager und Transfermarkt. */
export class Player extends Record {
  static NAME_LEN = 26;
  get name(): string {
    return this.str(0, Player.NAME_LEN);
  }
  get displayName(): string {
    return dosText(this.name);
  }
  /** Alter in Jahren (bestätigt: Köpke 24). */
  get age(): number {
    return this.u8(26);
  }
  /** Kondition, Technik, Form, wie sie der Transfermarkt anzeigt (bestätigt für Sundermann,
   *  Gründel, K.Allofs). Für Spieler im eigenen Kader zeigt das Spiel stattdessen die
   *  Werte des Kaderplatzes (Lineup.strength). */
  get condition(): number {
    return this.u8(28);
  }
  get technique(): number {
    return this.u8(29);
  }
  get form(): number {
    return this.u8(30);
  }
  get field27(): number {
    return this.u8(27);
  }
  /**
   * Positionswert 0..99: 0..24 Torwart, 25..49 Abwehr, 50..74 Mittelfeld, 75..99 Angriff.
   * Bestätigt mit 20 Spielern aus RIED-CLI.MAN (Köpke 0, Dittwar 29, Gründel 50, Eckstein 75).
   */
  get positionValue(): number {
    return this.u8(31);
  }
  get position(): "TOR" | "ABW" | "MIT" | "ANG" {
    const v = this.u8(31);
    return v < 25 ? "TOR" : v < 50 ? "ABW" : v < 75 ? "MIT" : "ANG";
  }
  /** Managerindex des Besitzers 0..3, 5 = kein Manager (aus 0x1C633). */
  get managerIndex(): number {
    return this.u8(33);
  }
  /** Ligatore (bestätigt: Dittwar 1, Bäurle 4). */
  get goals(): number {
    return this.u8(34);
  }
  /** Ligaeinsätze (bestätigt: Köpke 15, Kreuzer 4). */
  get appearances(): number {
    return this.u8(35);
  }
  /** Vereinsindex in der Vereinstabelle (bestätigt: 15 = 1.FC Nürnberg). */
  get owner(): number {
    return this.u8(36);
  }
  get isEmpty(): boolean {
    return this.buf[this.base] === 0;
  }
}

/**
 * Kredit (18 Bytes), aus der Kreditaufnahme-Routine bei 0x122D9 rekonstruiert.
 * Liegt im Managerdatensatz ab Byte 508: 5 Geldgeber x 3 Kredite x 18 Bytes.
 */
export class Loan extends Record {
  get isEmpty(): boolean {
    return this.i32(0) === 0;
  }
  /** Kreditsumme in DM. */
  get amount(): number {
    return this.i32(0);
  }
  /** Zinsen pro Monat = Summe * Prozentsatz / 100, bei Aufnahme berechnet. */
  get monthlyInterest(): number {
    return this.i32(4);
  }
  /** Aufnahmetag, Fälligkeitstag (auf Monatslänge begrenzt). */
  get startDay(): number {
    return this.u8(8);
  }
  get dueDay(): number {
    return this.u8(9);
  }
  /** Monat 0-basiert bei Aufnahme und bei Fälligkeit. */
  get startMonth(): number {
    return this.u8(10);
  }
  get dueMonth(): number {
    return this.u8(11);
  }
  /** Zinssatz in Prozent (Bank: 3 Mon. 7, 6 Mon. 5, 9 Mon. 3, ab 12 Mon. 2). */
  get ratePercent(): number {
    return this.u8(12);
  }
  get startYear(): number {
    return this.u16(14);
  }
  get dueYear(): number {
    return this.u16(16);
  }
}

/** Managerdatensatz (778 Bytes). 4 Einträge. */
export class Manager extends Record {
  static NAME_LEN = 29;
  get name(): string {
    return this.str(0, Manager.NAME_LEN);
  }
  get displayName(): string {
    return dosText(this.name);
  }
  get clubIndex(): number {
    return this.u8(30);
  }
  /** Kontostand in DM (bestätigt: 973.860 DM bei NORMI in RIED-CLI.MAN). */
  get balance(): number {
    return this.i32(496);
  }
  set balance(v: number) {
    this.setI32(496, v);
  }
  /**
   * Saisonverlauf: je 4 Bytes ab Byte 62, eine Zeile je gespielte Saison (Saisonzähler 4cb3:07E2,
   * höchstens 50; so zählt der Bildschirm 0x29BFE). rank = Gesamtrang 1..58 (Bundesliga 1..18,
   * Zweite Liga 19..38, Oberliga 39..58), 0xFF = noch nicht Manager; league = Liga 0..2
   * (Byte 63); dfb = DFB-Pokal (Byte 64: Runde + 1, Bit 7 Sieger); europe = Europapokal
   * (Byte 65: Wettbewerb · 8 + Runde, Bit 7 Sieger, 0 nicht dabei). Geschrieben in season.ts.
   */
  history(seasons: number): { rank: number; place: number; league: number; dfb: number; europe: number }[] {
    const out = [];
    for (let i = 0; i < Math.min(50, seasons); i++) {
      const o = 62 + 4 * i;
      const rank = this.u8(o);
      const league = this.u8(o + 1);
      out.push({ rank, place: rank - ([0, 18, 38][league] ?? 0), league, dfb: this.u8(o + 2), europe: this.u8(o + 3) });
    }
    return out;
  }
  /** Kredite: 5 Geldgeber (0 = Bank) x 3 Plätze, leere Plätze ausgelassen. */
  loans(lender?: number): Loan[] {
    const out: Loan[] = [];
    for (let g = 0; g < 5; g++) {
      if (lender !== undefined && g !== lender) continue;
      for (let i = 0; i < 3; i++) {
        const l = new Loan(this.buf, g * 3 + i, this.base + 508 + (g * 3 + i) * 18, 18);
        if (!l.isEmpty) out.push(l);
      }
    }
    return out;
  }
  /** Gesamtschulden und Zinsen pro Monat wie im Bankbildschirm. */
  get debt(): { total: number; monthlyInterest: number } {
    const ls = this.loans();
    return {
      total: ls.reduce((a, l) => a + l.amount, 0),
      monthlyInterest: ls.reduce((a, l) => a + l.monthlyInterest, 0),
    };
  }
  /**
   * Eintrittspreis in DM. Maßgeblich ist Byte 266: ein frisches Spiel des Originals hat dort
   * 10 und in 348 noch 0 (TEST-LAS); erst beim Ändern schreibt es beide Felder.
   */
  get ticketPrice(): number {
    return this.u8(266);
  }
  /** Stadion: Sitzplätze, Stehplätze, überdachte Plätze, je mit geplantem Ausbau (bestätigt). */
  get stadium(): { seats: number; seatsPlanned: number; standing: number; standingPlanned: number; roofed: number; roofedPlanned: number } {
    return {
      seats: this.i32(350), seatsPlanned: this.i32(354),
      standing: this.i32(358), standingPlanned: this.i32(362),
      roofed: this.i32(366), roofedPlanned: this.i32(370),
    };
  }
  /** Saison-Besucherzahl gesamt (bestätigt: 171.302). */
  get attendanceTotal(): number {
    return this.i32(484);
  }
  /** Zuschauerrekord und Gegner-Vereinsindex (bestätigt: 24.000 gegen Verein 13). */
  get attendanceRecord(): { value: number; opponent: number } {
    return { value: this.i32(488), opponent: this.i32(500) };
  }
  /** Minuskulisse und Gegner-Vereinsindex (bestätigt: 12.747 gegen VfB Stuttgart = 12). */
  get attendanceLow(): { value: number; opponent: number } {
    return { value: this.i32(492), opponent: this.i32(504) };
  }
  /**
   * Verein des Managers. Seine Liga (Byte 312) hängt daran und wird mitgezogen: in allen 41
   * vorhandenen Spielständen des Originals stimmt sie mit dem Ligaband des Vereinsindex
   * überein, und beim Saisonwechsel zieht das Original sie nach (0x1E3A4). Bis GitLab #76
   * blieb sie im Remake stehen - ein Aufsteiger wäre dauerhaft Zweitligist geblieben.
   */
  set clubIndex(v: number) {
    this.setU8(30, v);
    this.setU8(312, v < 18 ? 0 : v < 38 ? 1 : 2);
  }
  get isEmpty(): boolean {
    return this.buf[this.base] === 0;
  }
}

/**
 * Tabellenstand eines Vereins (54 Bytes), Index = Vereinsindex. Heim und
 * Auswärts getrennt, jeder Wert liegt doppelt vor (zweite Kopie wohl Stand des
 * Vorspieltags). Bestätigt mit Tabelle GESAMT und HEIM aus RIED-CLI.MAN.
 */
export class Standing extends Record {
  get homePoints(): number {
    return this.u8(0);
  }
  get awayPoints(): number {
    return this.u8(1);
  }
  /** Letzte acht Ergebnisse, S/U/N; Kleinbuchstaben = Heimspiel, Großbuchstaben = Auswärtsspiel. */
  get lastResults(): string {
    return this.str(4, 9);
  }
  get homeGoalsFor(): number {
    return this.u8(22);
  }
  get awayGoalsFor(): number {
    return this.u8(23);
  }
  get homeGoalsAgainst(): number {
    return this.u8(26);
  }
  get awayGoalsAgainst(): number {
    return this.u8(27);
  }
  get homeGames(): number {
    return this.u8(30);
  }
  get awayGames(): number {
    return this.u8(31);
  }
  get homeWins(): number {
    return this.u8(38);
  }
  get awayWins(): number {
    return this.u8(39);
  }
  get homeLosses(): number {
    return this.u8(42);
  }
  get awayLosses(): number {
    return this.u8(43);
  }
  /** Punkte in der ewigen Tabelle (bestätigt: Werder 359, Nürnberg 154). */
  get allTimePoints(): number {
    return this.i32(50);
  }
  /** Zusammenfassung wie in der Tabelle GESAMT (Zwei-Punkte-Regel). */
  get total(): { games: number; wins: number; draws: number; losses: number; points: number; pointsAgainst: number; goalsFor: number; goalsAgainst: number } {
    const games = this.homeGames + this.awayGames;
    const wins = this.homeWins + this.awayWins;
    const losses = this.homeLosses + this.awayLosses;
    const points = this.homePoints + this.awayPoints;
    return {
      games, wins, losses, draws: games - wins - losses,
      points, pointsAgainst: 2 * games - points,
      goalsFor: this.homeGoalsFor + this.awayGoalsFor,
      goalsAgainst: this.homeGoalsAgainst + this.awayGoalsAgainst,
    };
  }
}

/** Werbeeinnahmen und -ausgaben eines Managers (36 Bytes, bestätigt mit RIED-CLI.MAN). */
export class Advertising extends Record {
  get shirt(): number {
    return this.i32(0);
  }
  get boards(): number[] {
    return [1, 2, 3, 4, 5, 6].map((i) => this.i32(4 * i));
  }
  get boardsTotal(): number {
    return this.boards.reduce((a, b) => a + b, 0);
  }
  get tv(): number {
    return this.i32(28);
  }
  get expenses(): number {
    return this.i32(32);
  }
}

/**
 * Kaderplatz eines Managers (52 Bytes). 125 Einträge, je Manager 25 Plätze.
 * Quelle des Bildschirms "IHRE MANNSCHAFT"; Felder mit RIED-CLI.MAN gegen das
 * Original abgeglichen.
 */
export class Lineup extends Record {
  /**
   * Leer ist ein Kaderplatz ohne Spieler (Byte 15 = 0) - so zählt das Original (0x31A19,
   * 0x1FDBE). Eine liegengebliebene Rückennummer (Byte 10) macht ihn nicht zu einem Spieler:
   * bis #99 galt so ein Platz als belegt, mit Spieler 0, und wurde mittrainiert.
   */
  get isEmpty(): boolean {
    return this.u8(15) === 0;
  }
  /** Gelbe Karten (bestätigt). */
  get yellowCards(): number {
    return this.u8(1);
  }
  get field2(): number {
    return this.u8(2);
  }
  /**
   * Glatt Rote Karten (Byte 0). Die Spalte RK im Kaderbildschirm zeigt **nur** diese: im
   * Original steht dort für einen Spieler mit Gelb-Rot (Byte 2) eine 0, nachgemessen an TEST4
   * in DOSBox (WIRSCHING: Byte 2 = 1, RK = 0; GitLab #55).
   */
  get redCards(): number {
    return this.u8(0);
  }
  /** Gelb-Rote Karten (Byte 2); die Spielerinfo führt sie in einer eigenen Zeile. */
  get yellowRedCards(): number {
    return this.u8(2);
  }
  /** Ligatore + Pokaltore = Anzeige "TO". */
  get leagueGoals(): number {
    return this.u8(3);
  }
  get cupGoals(): number {
    return this.u8(4);
  }
  /** Ligaeinsätze + Pokaleinsätze = Anzeige "SP". */
  get leagueApps(): number {
    return this.u8(6);
  }
  get cupApps(): number {
    return this.u8(7);
  }
  /** Bits 0..1: Positionsart, ausgewertet vom Mannschaftsbildschirm. */
  get positionFlags(): number {
    return this.u8(9);
  }
  /** Sperre in Spielen, zählt je Ligaspiel herunter (0x1C633). */
  get suspension(): number {
    return this.u8(13);
  }
  /** Frische 50..150, steigt je Einsatz um 6 + Zufall(2..4) (0x1C633). */
  get freshness(): number {
    return this.u8(19);
  }
  /** Linie auf dem Spielfeld 0..7 (Taktikbildschirm). */
  get fieldLine(): number {
    return this.u8(26);
  }
  /** Vertragsdauer in Saisons (bestätigt: Köpke 2, Friedmann 4, Bäurle 3). */
  get contractYears(): number {
    return this.u8(11);
  }
  set contractYears(v: number) {
    this.setU8(11, v);
  }
  /** Gehalt pro Monat in DM (bestätigt: Köpke 21.605, Dittwar 7.546). */
  get salary(): number {
    return this.u16(40);
  }
  set salary(v: number) {
    this.setU16(40, v);
  }
  /** Rückennummer: 1..11 "IM TEAM", ab 12 "RESERVE". */
  get number(): number {
    return this.u8(10);
  }
  set number(v: number) {
    this.setU8(10, v);
  }
  /** Index in der Spielertabelle (bestätigt). */
  get playerIndex(): number {
    return this.u8(15);
  }
  /** Kondition, Technik, Form wie angezeigt (bestätigt: Köpke 89 97 55). */
  get strength(): number[] {
    return [this.u8(16), this.u8(17), this.u8(18)];
  }
  /** Gesamtstärke "ST" = ganzzahliger Durchschnitt der drei Werte (bestätigt: Köpke 80). */
  get overall(): number {
    return Math.trunc((this.u8(16) + this.u8(17) + this.u8(18)) / 3);
  }
}

export class TableView<T extends Record> {
  private readonly buf: Uint8Array;
  readonly table: Table;
  private readonly ctor: new (buf: Uint8Array, index: number, base: number, size: number) => T;

  constructor(
    buf: Uint8Array,
    table: Table,
    ctor: new (buf: Uint8Array, index: number, base: number, size: number) => T,
  ) {
    this.buf = buf;
    this.table = table;
    this.ctor = ctor;
  }

  get count(): number {
    return Math.floor(this.table.length / this.table.record);
  }

  at(index: number): T {
    if (index < 0 || index >= this.count) throw new RangeError(`Index ${index} außerhalb 0..${this.count - 1}`);
    return new this.ctor(this.buf, index, this.table.offset + index * this.table.record, this.table.record);
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this.count; i++) yield this.at(i);
  }

  toArray(): T[] {
    return [...this];
  }
}

/** Bündelt alle Tabellen eines Spielstands. */
export class GameState {
  readonly clubs: TableView<Club>;
  readonly players: TableView<Player>;
  readonly managers: TableView<Manager>;
  readonly standings: TableView<Standing>;
  readonly lineups: TableView<Lineup>;
  readonly advertising: TableView<Advertising>;
  readonly save: SaveFile;

  constructor(save: SaveFile) {
    this.save = save;
    const b = save.plain;
    this.clubs = new TableView(b, TABLES.clubs, Club);
    this.players = new TableView(b, TABLES.players, Player);
    this.managers = new TableView(b, TABLES.managers, Manager);
    this.standings = new TableView(b, TABLES.standings, Standing);
    this.lineups = new TableView(b, TABLES.lineups, Lineup);
    this.advertising = new TableView(b, TABLES.advertising, Advertising);
  }

  private dv(): DataView {
    return new DataView(this.save.plain.buffer, this.save.plain.byteOffset);
  }

  /** Spieldatum (bestätigt: 11. November 1997 in RIED-CLI.MAN). */
  get date(): { day: number; month: number; year: number } {
    const dv = this.dv();
    return {
      day: dv.getInt32(SCALARS.day, true),
      month: dv.getInt32(SCALARS.monthIndex, true) + 1,
      year: dv.getInt32(SCALARS.year, true),
    };
  }

  get year(): number {
    return this.dv().getInt32(SCALARS.year, true);
  }

  get currentManager(): number {
    return this.save.plain[SCALARS.currentManager];
  }

  /** Vereinsindizes in Tabellenreihenfolge: 18 Bundesliga, dann 20 + 20 Zweite Liga. */
  get tableOrder(): { bundesliga: number[]; second: number[][] } {
    const b = this.save.plain.subarray(TABLES.tableOrder.offset, TABLES.tableOrder.offset + 60);
    return {
      bundesliga: [...b.subarray(0, 18)],
      second: [[...b.subarray(20, 40)], [...b.subarray(40, 60)]],
    };
  }

  activeManagers(): Manager[] {
    return this.managers.toArray().slice(0, this.save.managerCount);
  }

  playersOf(club: number): Player[] {
    return this.players.toArray().filter((p) => !p.isEmpty && p.owner === club);
  }

  /** Nächster Spieltag einer Liga, 1-basiert; gespielt sind die Spieltage davor. */
  nextMatchday(league: number): number {
    return this.save.plain[SCALARS.nextMatchday + league];
  }

  /**
   * Ergebnis eines Spiels der Saison (Spieltag 0-basiert). null, wenn der
   * Spieltag noch nicht gespielt ist; postponed, wenn das Spiel verlegt wurde
   * (Heimtore = 30 im Original).
   */
  result(league: number, matchday: number, match: number): { home: number; away: number; postponed: boolean } | null {
    if (matchday >= this.nextMatchday(league) - 1) return null;
    const o = TABLES.results.offset + (league * 38 + matchday) * 20 + match * 2;
    const h = this.save.plain[o];
    const a = this.save.plain[o + 1];
    return h === 30 ? { home: 0, away: 0, postponed: true } : { home: h, away: a, postponed: false };
  }

  /** Paarungen des aktuellen Spieltags je Liga als [heim, gast]. */
  pairings(league: number): [number, number][] {
    const b = this.save.plain.subarray(TABLES.tableOrder.offset, TABLES.tableOrder.offset + 60);
    const [from, n] = [[0, 9], [20, 10], [40, 10]][league];
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) out.push([b[from + 2 * i], b[from + 2 * i + 1]]);
    return out;
  }

  /** Die 25 Kaderplätze eines Managers. */
  squadOf(manager: number): Lineup[] {
    const out: Lineup[] = [];
    for (let i = 0; i < 25; i++) out.push(this.lineups.at(manager * 25 + i));
    return out.filter((l) => !l.isEmpty);
  }
}
