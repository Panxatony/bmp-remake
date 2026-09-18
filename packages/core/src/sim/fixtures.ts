/**
 * Spielplan (0x2B4F3): Buchstabentabellen aus DGROUP 0x6FC (18 Vereine, 17 Spieltage)
 * und 0x744 (20 Vereine, 19 Spieltage). Je Spieltag ein String, Buchstabenpaare
 * (minus 'a') sind die Plätze der Vereine innerhalb der Liga; in der Rückrunde
 * werden Heim und Gast getauscht. Gegen alle vorliegenden Spielstände geprüft.
 */

const TABLE18 = ["abcdefghijklmnopqr", "ronklijghefcdabqpm", "afchejglinkpmrbdqo", "rknglejchafbdqompi", "ajclengpirkodfbhqm", "rgnclajbhdfqmkoipe", "fhancpergoimdjblqk", "rcnbldjfhqkimgoepa", "arcoemgkhjfldnbpqi", "rbnflhjqigkemcoapd", "amckeijlhnfpdrboqg", "rfnjlqgeickambodph", "aicglnjphrfodmbkqe", "rjnqecgaibkdmfohpl", "aecqlrjohmfkdibgpn", "rncaebgdifkhmjolqp", "aqnolmjkhifgdebcpr"];

const TABLE20 = ["abcdefghijklmnopqrst", "dahcnklibetqropmjgfs", "caglinkpqfsbedhjmrot", "dstmlhbqrkpingjcaefo", "gpceobsairktmfqdjlhn", "phaqdotirgnjesfklcbm", "oahrcsgtifkbqelnjpmd", "bithrjampleofgdksqnc", "mecqlrgbkaosjtnpidhf", "tlaibhqofjdgrnpcsmek", "mqhdcoientjbksgaprlf", "sitpegdjrcomahfnblqk", "hecmnbgsiqkopfldrtja", "mktcejbpoiqgaldnshfr", "nagoimrbjsckpdhqtfle", "slendrkiapfcqjbtmgoh", "hmpetdnsgkralqicjofb", "mjdfqnatcbkholspiger", "lmbdrsnojkfahigctepq"];

/** Vereinsindex-Basis und Größe je Liga: Bundesliga 0..17, 2. Liga 18..37, Oberliga 38..57 */
export const LEAGUES = [
  { base: 0, teams: 18, matchdays: 34 },
  { base: 18, teams: 20, matchdays: 38 },
  { base: 38, teams: 20, matchdays: 38 },
] as const;

/** Paarungen [heim, gast] als Vereinsindizes für einen Spieltag (1-basiert). */
export function fixtures(league: number, matchday: number): [number, number][] {
  const L = LEAGUES[league];
  const half = L.matchdays / 2;
  let md = matchday;
  let swap = false;
  if (md > half) {
    md -= half;
    swap = true;
  }
  if (md > half) md = half;
  const row = (L.teams === 18 ? TABLE18 : TABLE20)[md - 1];
  const out: [number, number][] = [];
  for (let i = 0; i < L.teams / 2; i++) {
    let a = row.charCodeAt(2 * i) - 97;
    let b = row.charCodeAt(2 * i + 1) - 97;
    if (swap) [a, b] = [b, a];
    out.push([L.base + a, L.base + b]);
  }
  return out;
}
