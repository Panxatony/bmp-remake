/**
 * Texte der Einladungs- und Rücksetzmails (GitLab #65).
 *
 * Die Einladung spricht den Empfänger in seiner Rolle an: der Präsident bekommt das Büro, der
 * Trainer die Bank, der Spieler das Trikot. Neben dem Spaß steht in jeder Mail, was die Rolle
 * darf - wer eingeladen wird, soll nicht erst im Spiel herausfinden, wo für ihn Schluss ist.
 */

export type MailRolle = "praesident" | "trainer" | "spieler";

export interface Post {
  betreff: string;
  text: string;
}

const GUELTIG_EINLADUNG = "Der Link gilt sieben Tage und lässt sich nur einmal benutzen.";

const EINLADUNGEN: Record<MailRolle, (name: string) => Post> = {
  praesident: (name) => ({
    betreff: "Willkommen im Präsidentenbüro",
    text: `Hallo ${name},

herzlichen Glückwunsch, Sie sind Präsident.

Das Büro liegt im ersten Stock, der Schreibtisch ist aus Eiche, und der Schlüssel zum
Vereinstresor hängt an Ihrem Bund. Dafür sind Sie auch derjenige, den die Presse fragt,
warum schon wieder ein Trainer gehen musste.

Was Ihnen offensteht: Benutzer anlegen und wieder loswerden, Rollen verteilen, Runden
eröffnen - und jede Runde wieder schließen, auch die, die Ihnen nicht gehört.

Eines fehlt noch, und ohne das kommen Sie nicht einmal an der Pforte vorbei: ein Passwort.
Hier setzen Sie es:`,
  }),
  trainer: (name) => ({
    betreff: "Ihr Vertrag als Trainer liegt bereit",
    text: `Hallo ${name},

der Verein hat sich für Sie entschieden. Zwei Jahre, mit Option - wobei Trainerverträge
bekanntlich nicht in Jahren gerechnet werden, sondern in Spieltagen.

Ihr Arbeitsplatz ist die Bank, Ihr Werkzeug die Taktiktafel. Läuft es, war es die
Mannschaft; läuft es nicht, waren Sie es.

Was Ihnen offensteht: eine eigene Runde eröffnen, einen Spielstand laden oder hochladen,
Ihre Runde einstellen und wieder schließen. An fremde Runden und an die Benutzerliste
kommen Sie nicht - dafür gibt es den Präsidenten, und der wacht darüber wie über die
Kaffeekasse.

Vor der ersten Trainingseinheit brauchen wir noch ein Passwort von Ihnen:`,
  }),
  spieler: (name) => ({
    betreff: "Willkommen in der Kabine",
    text: `Hallo ${name},

Ihr Name steht auf dem Aufgebot. Trikot, Stollenschuhe und ein Haken an der Kabinenwand
sind Ihnen sicher.

Was Ihnen nicht gehört, ist der Schlüssel zur Geschäftsstelle: Runden eröffnen und
Spielstände tauschen sind Sache von Präsident und Trainer. Sie treten einer Runde bei,
suchen sich einen Verein und spielen - also genau der Teil, wegen dem das Ganze überhaupt
erfunden wurde.

Bevor es auf den Platz geht, fehlt noch ein Passwort:`,
  }),
};

export function einladungsPost(name: string, rolle: MailRolle, link: string): Post {
  const p = (EINLADUNGEN[rolle] ?? EINLADUNGEN.spieler)(name);
  return { betreff: p.betreff, text: `${p.text}\n\n${link}\n\n${GUELTIG_EINLADUNG}\n` };
}

export function ruecksetzPost(name: string, link: string): Post {
  return {
    betreff: "Neues Passwort für den Bundesliga Manager",
    text: `Hallo ${name},

das Passwort ist abhanden gekommen. Das passiert in den besten Vereinen, und zwar
zuverlässig am Tag vor einem wichtigen Spiel.

Hier ist ein neuer Schlüssel für den Kabinentrakt:

${link}

Der Link gilt eine Stunde und lässt sich nur einmal benutzen. Haben Sie ihn nicht
angefordert, ist nichts geschehen - dann werfen Sie diese Nachricht einfach weg.
`,
  };
}
