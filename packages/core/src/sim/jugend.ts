/**
 * Jugendarbeit (nur Version 2026, sim/regeln.ts; GitLab #4, Stufen 1 und 2).
 *
 * Im Original ist die Jugend eine Zahl im Etat (Managerbyte 319) und gelegentlich ein Talent,
 * das aus dem Nichts im Kader steht (0x0CE84). In der Version 2026 hat jeder Manager **drei
 * Jugendmannschaften**, deren Spieler er über Jahre begleitet:
 *
 *   C-Jugend 13/14 Jahre, B-Jugend 15/16, A-Jugend 16/17, je zwölf Plätze.
 *
 * Der Reiz liegt nicht in fertigen Stars: auch nach Jahren voller Förderung kommt ein Spieler
 * bei einer Stärke um die 45 heraus - brauchbar für die Oberliga, für die Bundesliga zu schwach
 * (so wie der Jugendspieler des Originals, siehe die Messung in GitLab #4). Der Gewinn liegt im
 * niedrigen Gehalt, im Potenzial und darin, die Entwicklung selbst gesehen zu haben.
 *
 * **Speicherung.** Drei Mannschaften je Manager passen in keine Tabelle des Originals. Sie
 * stehen deshalb in einem **Anhang hinter dem Dateiende** (savefile.ts), den nur das Remake
 * liest. Ein Spielstand des Originals lädt mit Anhang unverändert - im DOSBox-Versuch geprüft.
 * Aufbau:
 *
 *   Kennung "BMP2026-JUGEND\0"   15 Bytes
 *   Fassung                       1 Byte (1)
 *   Manager                       1 Byte
 *   je Manager 3 Mannschaften zu 12 Plätzen zu 24 Bytes:
 *     0..11  Name in der Kodierung des Spiels, mit Null gefüllt (leerer Platz: Name leer)
 *     12     Alter
 *     13     Positionsart 0..6 (wie im Original: Positionswert = Art · 14 + Zufall(0,10))
 *     14     Kondition   15 Technik   16 Form
 *     17     Potenzial (Zielstärke, verdeckt)
 *     18     Bit 0 Geldförderung, Bits 4..5 Trainingsstufe 0..3,
 *            Bits 6..7 Herkunft (0 Neuzugang, sonst Mannschaft + 1)
 *     19     Jahre im Verein
 *     20..23 Verlauf: Gesamtstärke der letzten vier Saisons, 0 = noch keine
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { is2026 } from "./regeln.ts";
import { texte } from "../data/texte.ts";
import { addBalance, slotBytes, setSlotBytes, assignNumber, removePlace } from "./transfer.ts";
import { addToSquad } from "./seasonEvents.ts";
import { sortIntoSquad } from "./lineup.ts";
import { poachPrice, poachAmount, poachChance } from "./abwerben.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const JUGEND_KENNUNG = "BMP2026-JUGEND\0";
export const JUGEND_FASSUNG = 1;
/** C-, B- und A-Jugend. */
export const JUGEND_TEAMS = 3;
/** Plätze je Mannschaft (lhunos Entscheidung vom 17.9.2026). */
export const JUGEND_PLAETZE = 12;
export const JUGEND_SATZ = 24;
export const JUGEND_NAMEN = ["C-JUGEND", "B-JUGEND", "A-JUGEND"] as const;
/** Altersgrenzen je Mannschaft. */
export const JUGEND_ALTER: readonly (readonly [number, number])[] = [
  [13, 14],
  [15, 16],
  [16, 17],
] as const;
/** Höchstens so viele Spieler steigen je Mannschaft und Saison auf. */
export const JUGEND_AUFSTIEGE = 2;
/** Förderung je Spieler und Monat. */
export const JUGEND_KOSTEN = 2_000;
/**
 * So viele Spieler je Mannschaft darf ein Manager gleichzeitig fördern (lhunos Vorgabe vom
 * 17.9.2026). Wer die Wahl hat, muss sie treffen: die übrigen acht entwickeln sich mit der
 * Grundchance weiter.
 */
export const JUGEND_MAX_FOERDERUNG = 4;
/**
 * Entwicklung und Risiko. Zwei Hebel, die sich gegenseitig ausgleichen sollen (lhunos Vorgabe
 * vom 17.9.2026): **Geld** bezahlt gute Betreuung, **Training** treibt an - wer aber von einem
 * jungen Spieler zu viel verlangt, riskiert, dass er die Lust verliert und aufhört.
 *
 * Grundchance auf Entwicklung je Saison: 35 Prozent. Geld legt 35 Punkte drauf, das Training je
 * nach Stufe bis zu 24. Dafür steigt mit dem Training das Risiko, und Geld dämpft es um ein
 * Drittel - gute Betreuung fängt hartes Training ein Stück weit auf.
 */
export const JUGEND_CHANCE = { grund: 35, geld: 35 } as const;
/**
 * `sprung` ist die Chance, dass ein Spieler **über sein ursprüngliches Potenzial hinauswächst** -
 * aber nur, wenn beides zusammenkommt: bezahlte Betreuung **und** Training. Damit kann aus der
 * richtigen Mischung ein sehr guter Jugendspieler werden (lhunos Vorgabe vom 17.9.2026), und
 * genau dieser Weg trägt das Risiko, ihn unterwegs zu verlieren.
 */
export const JUGEND_TRAINING: readonly { name: string; chance: number; risiko: number; sprung: number }[] = [
  { name: "KEINS", chance: 0, risiko: 0, sprung: 0 },
  { name: "NORMAL", chance: 8, risiko: 3, sprung: 18 },
  { name: "VIEL", chance: 16, risiko: 9, sprung: 30 },
  { name: "HART", chance: 24, risiko: 20, sprung: 40 },
] as const;
/** Höher als das kommt auch das größte Talent nicht. */
export const JUGEND_SPITZE = 75;
/**
 * Zähler im ungenutzten Bereich des Spielstands (wie das Regelbyte 34099; in allen 40
 * vorliegenden Ständen 0): je Manager ein Byte für die Aufrücker und eins für die
 * Jugendabwerbungen dieser Saison.
 */
export const JUGEND_AUFRUECKER_OFFSET = 34122;
export const JUGEND_ABWERB_OFFSET = 34126;
/** So viele Jugendspieler darf ein Manager je Saison in die Männermannschaft holen. */
export const JUGEND_MAX_AUFRUECKER = 5;
/** So oft darf ein Manager je Saison einen frisch aufgerückten Jugendspieler abwerben. */
export const JUGEND_MAX_ABWERBEN = 1;

/**
 * Nachnamen für neue Jugendspieler. Eigene Liste, kein Inhalt des Originals - damit lassen sich
 * die Mannschaften auch in einer Fassung ohne die Dateien des Originals füllen (siehe #5).
 */
const NACHNAMEN = [
  "ADLER", "BAUMANN", "BERGER", "BRANDT", "DEHNE", "EBERT", "ENGEL", "FICHTNER",
  "FRENZEL", "GERBER", "GRAF", "HAAS", "HABERL", "HEIDER", "HELLER", "HOFER",
  "JANSEN", "KAISER", "KELLNER", "KIRSCH", "KLEIN", "KRAMER", "LAMPE", "LEHMANN",
  "LORENZ", "MAHLER", "MERTENS", "NAGEL", "NEUBERT", "OSTER", "PAULSEN", "PROBST",
  "RAABE", "REINERS", "RICHTER", "ROTH", "SANDER", "SCHIELE", "SEIFERT", "SOMMER",
  "STADLER", "STEIN", "THIEL", "VOGEL", "WAGNER", "WEIDNER", "WENDT", "ZIMMER",
] as const;
const VORNAMEN = "ABCDEFGHJKLMNPRSTUVW";

export interface Jugendspieler {
  name: string;
  alter: number;
  art: number;
  ko: number;
  te: number;
  fo: number;
  potenzial: number;
  /** Geldförderung: bezahlt Betreuung, erhöht die Entwicklungschance und dämpft das Risiko. */
  foerderung: boolean;
  /** Trainingsstufe 0..3: treibt die Entwicklung, erhöht aber das Risiko der Aufgabe. */
  training: number;
  /**
   * Mannschaft, aus der er aufgestiegen ist, plus 1 (0 = von außen gekommen). In der Liste steht
   * sie als Kürzel hinter dem Namen: wer aus der C-Jugend in die B-Jugend aufrückt, heißt dort
   * "NAME (C)" (lhunos Vorgabe vom 17.9.2026).
   */
  herkunft: number;
  jahre: number;
  verlauf: number[];
}

/** Gesamtstärke wie im Kader: ganzzahliger Durchschnitt der drei Werte. */
export const jugendStaerke = (s: Jugendspieler): number => div(s.ko + s.te + s.fo, 3);

const leer = (): Jugendspieler => ({ name: "", alter: 0, art: 0, ko: 0, te: 0, fo: 0, potenzial: 0, foerderung: false, training: 0, herkunft: 0, jahre: 0, verlauf: [0, 0, 0, 0] });

/** Kürzel der Mannschaft, aus der er kommt ("C", "B", "A"), oder "" für einen Neuzugang. */
export const jugendHerkunft = (s: Jugendspieler): string => (s.herkunft > 0 ? JUGEND_NAMEN[s.herkunft - 1]?.[0] ?? "" : "");

function lesePlatz(a: Uint8Array, o: number): Jugendspieler {
  let name = "";
  for (let i = 0; i < 12 && a[o + i] !== 0; i++) name += String.fromCharCode(a[o + i]);
  return {
    name,
    alter: a[o + 12],
    art: a[o + 13],
    ko: a[o + 14],
    te: a[o + 15],
    fo: a[o + 16],
    potenzial: a[o + 17],
    foerderung: (a[o + 18] & 1) !== 0,
    training: (a[o + 18] >> 4) & 3,
    herkunft: (a[o + 18] >> 6) & 3,
    jahre: a[o + 19],
    verlauf: [a[o + 20], a[o + 21], a[o + 22], a[o + 23]],
  };
}

function schreibePlatz(a: Uint8Array, o: number, s: Jugendspieler): void {
  for (let i = 0; i < 12; i++) a[o + i] = i < s.name.length ? s.name.charCodeAt(i) & 0xff : 0;
  a[o + 12] = s.alter & 0xff;
  a[o + 13] = s.art & 0xff;
  a[o + 14] = s.ko & 0xff;
  a[o + 15] = s.te & 0xff;
  a[o + 16] = s.fo & 0xff;
  a[o + 17] = s.potenzial & 0xff;
  a[o + 18] = (s.foerderung ? 1 : 0) | ((s.training & 3) << 4) | ((s.herkunft & 3) << 6);
  a[o + 19] = s.jahre & 0xff;
  for (let i = 0; i < 4; i++) a[o + 20 + i] = s.verlauf[i] & 0xff;
}

/** Alle Jugendmannschaften: [Manager][Mannschaft][Platz]. Leere Plätze haben einen leeren Namen. */
export function jugendLesen(g: GameState): Jugendspieler[][][] {
  const n = g.activeManagers().length;
  const leerAlle = (): Jugendspieler[][][] =>
    Array.from({ length: n }, () => Array.from({ length: JUGEND_TEAMS }, () => Array.from({ length: JUGEND_PLAETZE }, leer)));
  const a = g.save.anhang;
  const kennung = JUGEND_KENNUNG;
  if (a.length < kennung.length + 2) return leerAlle();
  for (let i = 0; i < kennung.length; i++) if (a[i] !== kennung.charCodeAt(i)) return leerAlle();
  if (a[kennung.length] !== JUGEND_FASSUNG) return leerAlle();
  const manager = a[kennung.length + 1];
  const daten = leerAlle();
  let o = kennung.length + 2;
  for (let m = 0; m < manager; m++) {
    for (let t = 0; t < JUGEND_TEAMS; t++) {
      for (let p = 0; p < JUGEND_PLAETZE; p++) {
        if (o + JUGEND_SATZ <= a.length && m < n) daten[m][t][p] = lesePlatz(a, o);
        o += JUGEND_SATZ;
      }
    }
  }
  return daten;
}

/** Mannschaften in den Anhang schreiben. */
export function jugendSchreiben(g: GameState, daten: Jugendspieler[][][]): void {
  const kennung = JUGEND_KENNUNG;
  const groesse = kennung.length + 2 + daten.length * JUGEND_TEAMS * JUGEND_PLAETZE * JUGEND_SATZ;
  const a = new Uint8Array(groesse);
  for (let i = 0; i < kennung.length; i++) a[i] = kennung.charCodeAt(i);
  a[kennung.length] = JUGEND_FASSUNG;
  a[kennung.length + 1] = daten.length;
  let o = kennung.length + 2;
  for (const manager of daten) {
    for (const team of manager) {
      for (const spieler of team) {
        schreibePlatz(a, o, spieler);
        o += JUGEND_SATZ;
      }
    }
  }
  g.save.anhang = a;
}

/** Hat dieser Spielstand schon Jugendmannschaften? */
export function jugendVorhanden(g: GameState): boolean {
  return jugendLesen(g).some((m) => m.some((t) => t.some((s) => s.name !== "")));
}

/** Ein neuer Jugendspieler für die genannte Mannschaft. */
export function neuerJugendspieler(g: GameState, manager: number, team: number, rng: Rng): Jugendspieler {
  const regler = g.managers.at(manager).u8(319);
  const [min, max] = JUGEND_ALTER[team];
  // Das Potenzial hängt am Jugendregler: ohne Etat kommt nichts, bei vollem Regler pendelt sich
  // die Stärke um die 45 ein (Messung in #4)
  const potenzial = clamp(rng(18, 30) + div(regler, 2), 15, 60);
  // Wer schon älter ist, hat einen Teil des Weges hinter sich: die C-Jugend startet weit unter
  // ihrem Potenzial, die A-Jugend dicht darunter
  const abstand = [rng(10, 18), rng(6, 12), rng(2, 7)][team] ?? rng(6, 12);
  const start = clamp(potenzial - abstand, 8, potenzial);
  return {
    name: `${VORNAMEN[rng(0, VORNAMEN.length - 1)]}.${NACHNAMEN[rng(0, NACHNAMEN.length - 1)]}`.slice(0, 12),
    alter: rng(min, max),
    art: rng(0, 6),
    ko: clamp(start + rng(-3, 3), 5, 99),
    te: clamp(start + rng(-3, 3), 5, 99),
    fo: rng(45, 55),
    potenzial,
    foerderung: false,
    training: 0,
    herkunft: 0,
    jahre: 0,
    verlauf: [0, 0, 0, 0],
  };
}

/** Drei Mannschaften anlegen (beim ersten Öffnen oder beim neuen Spiel). */
export function jugendAnlegen(g: GameState, rng: Rng): void {
  if (!is2026(g)) return;
  const daten = jugendLesen(g);
  g.activeManagers().forEach((_, m) => {
    for (let t = 0; t < JUGEND_TEAMS; t++) {
      for (let p = 0; p < JUGEND_PLAETZE; p++) {
        // Nicht jeder Platz ist besetzt, das sieht lebendiger aus
        daten[m][t][p] = rng(0, 9) < 8 ? neuerJugendspieler(g, m, t, rng) : leer();
      }
    }
  });
  jugendSchreiben(g, daten);
}

/** Chance in Prozent, dass sich dieser Spieler in einer Saison entwickelt. */
export function jugendChance(s: Jugendspieler): number {
  const t = JUGEND_TRAINING[clamp(s.training, 0, JUGEND_TRAINING.length - 1)];
  return Math.min(100, JUGEND_CHANCE.grund + (s.foerderung ? JUGEND_CHANCE.geld : 0) + t.chance);
}

/** Chance in Prozent, dass das Potenzial in dieser Saison wächst (nur mit Geld und Training). */
export function jugendSprung(s: Jugendspieler): number {
  if (!s.foerderung) return 0;
  return JUGEND_TRAINING[clamp(s.training, 0, JUGEND_TRAINING.length - 1)].sprung;
}

/** Risiko in Prozent, dass dieser Spieler die Lust verliert und aufhört. Geld dämpft es. */
export function jugendRisiko(s: Jugendspieler): number {
  const t = JUGEND_TRAINING[clamp(s.training, 0, JUGEND_TRAINING.length - 1)];
  return s.foerderung ? div(t.risiko * 2, 3) : t.risiko;
}

/** Geldförderung und Trainingsstufe eines Spielers setzen. */
/** Ein Spieler gilt als gefördert, sobald einer der beiden Hebel steht. */
export const wirdGefoerdert = (s: Jugendspieler): boolean => s.name !== "" && (s.foerderung || s.training > 0);

/** So viele Spieler einer Mannschaft sind gerade in der Förderung. */
export const gefoerderte = (g: GameState, manager: number, team: number): number =>
  (jugendLesen(g)[manager]?.[team] ?? []).filter(wirdGefoerdert).length;

export function foerdern(g: GameState, manager: number, team: number, platz: number, geld?: boolean, training?: number): { ok: boolean; error?: string } {
  if (!is2026(g)) return { ok: false, error: "Nur in der Version 2026" };
  const daten = jugendLesen(g);
  const mannschaft = daten[manager]?.[team];
  const s = mannschaft?.[platz];
  if (!s || s.name === "") return { ok: false, error: "Kein Spieler" };
  const vorher = wirdGefoerdert(s);
  const geldNeu = geld === undefined ? s.foerderung : geld;
  const trainingNeu = training === undefined ? s.training : clamp(Math.trunc(training), 0, JUGEND_TRAINING.length - 1);
  // Ein Trainer kann sich nicht um jeden kümmern: höchstens JUGEND_MAX_FOERDERUNG Spieler je
  // Mannschaft stehen in der Förderung (lhunos Vorgabe vom 17.9.2026). Die übrigen entwickeln
  // sich mit der Grundchance weiter.
  const nachher = geldNeu || trainingNeu > 0;
  if (!vorher && nachher) {
    const offen = JUGEND_MAX_FOERDERUNG - mannschaft.filter(wirdGefoerdert).length;
    if (offen <= 0) return { ok: false, error: `H|chstens ${JUGEND_MAX_FOERDERUNG} Spieler je Jugend` };
  }
  s.foerderung = geldNeu;
  s.training = trainingNeu;
  jugendSchreiben(g, daten);
  return { ok: true };
}

/** Monatliche Kosten der Förderung eines Managers. */
export function jugendKosten(g: GameState, manager: number): number {
  const daten = jugendLesen(g);
  let n = 0;
  for (const team of daten[manager] ?? []) for (const s of team) if (s.name !== "" && s.foerderung) n++;
  return n * JUGEND_KOSTEN;
}

/** Kosten der Förderung buchen (Monatsabrechnung). */
export function jugendMonat(g: GameState, manager: number): number {
  if (!is2026(g)) return 0;
  const betrag = jugendKosten(g, manager);
  if (betrag > 0) addBalance(g, manager, -betrag);
  return betrag;
}

export interface JugendEreignis {
  manager: number;
  kind: "aufstieg" | "abgang" | "reif" | "neu" | "aufgabe" | "sprung";
  name: string;
  von?: number;
  nach?: number;
  staerke?: number;
}

/**
 * Saisonwechsel: alle werden ein Jahr älter, entwickeln sich, steigen auf oder gehen.
 *
 * - Entwicklung: mit Förderung schlägt sie in 70 von 100 Saisons an, ohne in 35. Sie schiebt
 *   Kondition und Technik ein Stück Richtung Potenzial - wer nicht gefördert wird, versandet
 *   also öfter, kommt aber nicht höher hinaus.
 * - Aufgabe: wer zu hart trainiert wird, verliert mit dem Risiko seiner Stufe die Lust und hört
 *   auf. Geldförderung dämpft das um ein Drittel.
 * - Aufstieg: höchstens zwei je Mannschaft und Saison, die stärksten zuerst. Wer zu alt ist und
 *   nicht aufsteigt, geht.
 * - Aus der A-Jugend herausgewachsene Spieler stehen als "reif" bereit; der Übergang in die
 *   Männermannschaft ist Stufe 2.
 */
export function jugendSaison(g: GameState, rng: Rng): JugendEreignis[] {
  const ereignisse: JugendEreignis[] = [];
  if (!is2026(g)) return ereignisse;
  const daten = jugendLesen(g);
  daten.forEach((mannschaften, m) => {
    // 1. Älter werden und entwickeln
    for (const team of mannschaften) {
      for (const s of team) {
        if (s.name === "") continue;
        s.alter++;
        s.jahre++;
        if (rng(1, 100) <= jugendChance(s)) {
          const luecke = s.potenzial - div(s.ko + s.te, 2);
          if (luecke > 0) {
            // Eine geglückte Saison schließt etwa die Hälfte des Weges zum Potenzial
            const lo = Math.max(1, div(luecke, 3));
            const hi = Math.max(lo, div(2 * luecke, 3));
            s.ko = clamp(s.ko + rng(lo, hi), 5, 99);
            s.te = clamp(s.te + rng(lo, hi), 5, 99);
          }
        }
        // Entwicklungssprung: die richtige Mischung hebt das Potenzial selbst
        const sprung = jugendSprung(s);
        if (sprung > 0 && rng(1, 100) <= sprung && s.potenzial < JUGEND_SPITZE) {
          s.potenzial = clamp(s.potenzial + rng(4, 10), 0, JUGEND_SPITZE);
          ereignisse.push({ manager: m, kind: "sprung", name: s.name, staerke: s.potenzial });
        }
        s.fo = clamp(s.fo + rng(-2, 2), 45, 55);
        s.verlauf = [...s.verlauf.slice(1), jugendStaerke(s)];
      }
    }
    // 2. Wer überfordert wird, verliert die Lust (lhunos Vorgabe: Training muss ausgewogen sein)
    for (let t = 0; t < JUGEND_TEAMS; t++) {
      for (let p = 0; p < JUGEND_PLAETZE; p++) {
        const s = mannschaften[t][p];
        if (s.name === "") continue;
        const risiko = jugendRisiko(s);
        if (risiko > 0 && rng(1, 100) <= risiko) {
          ereignisse.push({ manager: m, kind: "aufgabe", name: s.name, von: t, staerke: jugendStaerke(s) });
          mannschaften[t][p] = leer();
        }
      }
    }
    // 3. Aufstiege und Abgänge, von der A-Jugend abwärts, damit Platz entsteht
    for (let t = JUGEND_TEAMS - 1; t >= 0; t--) {
      const grenze = JUGEND_ALTER[t][1];
      const zuAlt = mannschaften[t]
        .map((s, p) => ({ s, p }))
        .filter((x) => x.s.name !== "" && x.s.alter > grenze)
        .sort((a, b) => jugendStaerke(b.s) - jugendStaerke(a.s));
      let aufgestiegen = 0;
      for (const { s, p } of zuAlt) {
        const nach = t + 1;
        if (nach >= JUGEND_TEAMS) {
          // Aus der A-Jugend herausgewachsen: der Manager hat eine Saison Zeit, ihn in die
          // Männermannschaft zu holen (jugendAufruecken). Wer dann immer noch da ist, geht.
          if (s.alter > grenze + 1) {
            ereignisse.push({ manager: m, kind: "abgang", name: s.name, von: t, staerke: jugendStaerke(s) });
            mannschaften[t][p] = leer();
          } else {
            ereignisse.push({ manager: m, kind: "reif", name: s.name, staerke: jugendStaerke(s) });
          }
          continue;
        }
        const frei = mannschaften[nach].findIndex((x) => x.name === "");
        if (aufgestiegen < JUGEND_AUFSTIEGE && frei >= 0) {
          // Woher er kommt, bleibt am Spieler hängen: in der B-Jugend steht hinter dem Namen (C)
          s.herkunft = t + 1;
          mannschaften[nach][frei] = s;
          ereignisse.push({ manager: m, kind: "aufstieg", name: s.name, von: t, nach, staerke: jugendStaerke(s) });
          aufgestiegen++;
        } else {
          ereignisse.push({ manager: m, kind: "abgang", name: s.name, von: t, staerke: jugendStaerke(s) });
        }
        mannschaften[t][p] = leer();
      }
    }
    // 4. Die C-Jugend füllt sich wieder auf
    for (let p = 0; p < JUGEND_PLAETZE; p++) {
      if (mannschaften[0][p].name !== "" || rng(0, 2) === 0) continue;
      const neu = neuerJugendspieler(g, m, 0, rng);
      neu.alter = JUGEND_ALTER[0][0];
      mannschaften[0][p] = neu;
      ereignisse.push({ manager: m, kind: "neu", name: neu.name, nach: 0 });
    }
  });
  jugendSchreiben(g, daten);
  return ereignisse;
}

// ---- Stufe 2: Übergang in die Männermannschaft und Abwerben ------------------------------

/** Ist der Spieler aus der A-Jugend herausgewachsen und damit bereit für den Kader? */
export function istReif(spieler: Jugendspieler, team: number): boolean {
  return spieler.name !== "" && team === JUGEND_TEAMS - 1 && spieler.alter > JUGEND_ALTER[team][1];
}

/** Wie viele Jugendspieler dieser Manager in dieser Saison schon geholt hat. */
export const aufruecker = (g: GameState, manager: number): number => g.save.plain[JUGEND_AUFRUECKER_OFFSET + manager] ?? 0;
/** Wie oft dieser Manager in dieser Saison schon einen Aufrücker abgeworben hat. */
export const jugendAbwerbungen = (g: GameState, manager: number): number => g.save.plain[JUGEND_ABWERB_OFFSET + manager] ?? 0;

/** Beide Zähler leeren (Saisonwechsel). */
export function jugendZaehlerLeeren(g: GameState): void {
  for (let m = 0; m < 4; m++) {
    g.save.plain[JUGEND_AUFRUECKER_OFFSET + m] = 0;
    g.save.plain[JUGEND_ABWERB_OFFSET + m] = 0;
  }
}

/** Einen freien Spielerdatensatz suchen (wie im Original, 0x0CE84). */
function freierSpieler(g: GameState, rng: Rng): number {
  for (let versuch = 0; versuch < 2000; versuch++) {
    const i = rng(1, 150);
    if (g.players.at(i).u8(33) === 5) return i;
  }
  return -1;
}

export type AufrueckErgebnis =
  | { ok: false; error: string }
  | { ok: true; playerIndex: number; place: number; name: string; staerke: number };

/**
 * Einen reifen Jugendspieler in die Männermannschaft holen. Er kommt mit den Werten, die er sich
 * erspielt hat, einem Vertrag über zwei bis drei Jahre und **der halben Gehaltsbasis** - wie der
 * Jugendspieler des Originals (0x0CE84). In der Startelf steht er damit nicht, dafür kostet er
 * fast nichts.
 */
export function jugendAufruecken(g: GameState, manager: number, platz: number, rng: Rng): AufrueckErgebnis {
  if (!is2026(g)) return { ok: false, error: "Nur in der Version 2026" };
  const daten = jugendLesen(g);
  const team = JUGEND_TEAMS - 1;
  const s = daten[manager]?.[team]?.[platz];
  if (!s || s.name === "") return { ok: false, error: "Kein Spieler" };
  if (!istReif(s, team)) return { ok: false, error: "Erst wenn er aus der A-Jugend herausgewachsen ist" };
  if (aufruecker(g, manager) >= JUGEND_MAX_AUFRUECKER) return { ok: false, error: `H|chstens ${JUGEND_MAX_AUFRUECKER} Jugendspieler je Saison` };
  if (g.squadOf(manager).length >= 24) return { ok: false, error: "Ihr Kader ist voll" };
  const idx = freierSpieler(g, rng);
  if (idx < 0) return { ok: false, error: "Kein Platz in der Spielertabelle" };
  // Spielerdatensatz aus dem Jugendspieler füllen
  const p = g.players.at(idx);
  for (let i = 0; i < 26; i++) p.setU8(i, i < s.name.length ? s.name.charCodeAt(i) & 0xff : 0);
  p.setU8(26, s.alter);
  p.setU8(28, s.ko);
  p.setU8(29, s.te);
  p.setU8(30, s.fo);
  p.setU8(32, s.art);
  p.setU8(31, clamp(s.art * 14 + rng(0, 10), 0, 99));
  const place = addToSquad(g, manager, idx, rng);
  if (place < 0) return { ok: false, error: "Ihr Kader ist voll" };
  daten[manager][team][platz] = leer();
  jugendSchreiben(g, daten);
  g.save.plain[JUGEND_AUFRUECKER_OFFSET + manager] = aufruecker(g, manager) + 1;
  return { ok: true, playerIndex: idx, place, name: s.name, staerke: jugendStaerke(s) };
}

export type JugendAbwerbung =
  | { ok: false; error: string }
  | { ok: true; agreed: boolean; amount: number; chance: number; place?: number };

/**
 * Einen frisch aufgerückten Jugendspieler abwerben (lhunos Entscheidung vom 17.9.2026: eigene
 * Grenze, einer je Manager und Saison - getrennt vom Abwerben aus dem Kader, #1). Anders als
 * dort gibt es hier **keine Richtungsregel**: wer jahrelang ausgebildet hat, muss auch nach unten
 * aufpassen. Ablöse und Zustimmung rechnen wie beim Abwerben aus dem Kader.
 */
export function jugendAbwerben(g: GameState, poacher: number, owner: number, place: number, bonus: number, rng: Rng): JugendAbwerbung {
  if (!is2026(g)) return { ok: false, error: "Nur in der Version 2026" };
  if (poacher === owner) return { ok: false, error: "Das ist Ihr eigener Spieler" };
  if (jugendAbwerbungen(g, poacher) >= JUGEND_MAX_ABWERBEN) return { ok: false, error: "Diese Saison haben Sie schon einen Jugendspieler geholt" };
  const l = g.lineups.at(owner * 25 + place);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  let frei = 0;
  while (frei < 24 && !g.lineups.at(poacher * 25 + frei).isEmpty) frei++;
  if (frei >= 24) return { ok: false, error: "Ihr Kader ist voll" };
  const amount = poachAmount(g, owner, place, bonus);
  if (g.managers.at(poacher).balance < amount) return { ok: false, error: texte("ui.zuwenig").join(" ") };
  const chance = poachChance(g, poacher, owner, place, bonus);
  if (rng(0, 99) >= chance) return { ok: true, agreed: false, amount, chance };
  const bytes = slotBytes(g, owner * 25 + place);
  bytes[10] = 0;
  bytes[9] &= 0x3f;
  setSlotBytes(g, poacher * 25 + frei, bytes);
  const ziel = sortIntoSquad(g, poacher, frei);
  assignNumber(g, poacher, ziel);
  removePlace(g, owner * 25, place, 25);
  addBalance(g, poacher, -amount);
  addBalance(g, owner, amount);
  const spieler = l.playerIndex;
  const p = g.players.at(spieler);
  p.setU8(33, poacher);
  p.setU8(36, g.managers.at(poacher).clubIndex);
  g.save.plain[JUGEND_ABWERB_OFFSET + poacher] = jugendAbwerbungen(g, poacher) + 1;
  return { ok: true, agreed: true, amount, chance, place: ziel };
}

/** Ablöse, die ein Aufrücker kosten würde (für die Anzeige beim Abwerben). */
export const jugendPreis = (g: GameState, owner: number, place: number): number => poachPrice(g, owner, place);
