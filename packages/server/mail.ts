/**
 * Kleiner SMTP-Absender (GitLab #65). Der Server verschickt nur zwei Sorten Post - eine
 * Einladung und ein Zurücksetzen des Passworts -, dafür lohnt keine Abhängigkeit.
 *
 * Verschlüsselt wird immer: Port 465 spricht sofort TLS, sonst wird nach dem EHLO auf STARTTLS
 * umgeschaltet. Bietet der Server keins an, bricht der Versand ab, statt im Klartext
 * weiterzureden - Zugangsdaten gehören nicht offen über die Leitung.
 *
 * Umgebung: BMP_SMTP_HOST, BMP_SMTP_USER, BMP_SMTP_PASS, BMP_SMTP_PORT (Vorgabe 587),
 * BMP_SMTP_FROM (Vorgabe: der Benutzername). Fehlt eines davon, ist der Versand abgeschaltet;
 * der Server schreibt den Link dann ins Protokoll, damit die Entwicklung ohne Postfach geht.
 */
import { createConnection, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { hostname } from "node:os";
import { randomBytes } from "node:crypto";

export interface SmtpZugang {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function smtpZugang(): SmtpZugang | undefined {
  const host = process.env.BMP_SMTP_HOST;
  const user = process.env.BMP_SMTP_USER;
  const pass = process.env.BMP_SMTP_PASS;
  if (!host || !user || !pass) return undefined;
  return { host, port: Number(process.env.BMP_SMTP_PORT ?? 587), user, pass, from: process.env.BMP_SMTP_FROM ?? user };
}

type Leitung = Socket | TLSSocket;

/** Eine Antwort ist vollständig, wenn ihre letzte Zeile "250 " statt "250-" beginnt. */
function vollstaendig(text: string): boolean {
  if (!text.endsWith("\r\n")) return false;
  const zeilen = text.split("\r\n").filter((z) => z !== "");
  return zeilen.length > 0 && /^\d{3} /.test(zeilen[zeilen.length - 1]);
}

function leser(sock: Leitung): () => Promise<string> {
  let puffer = "";
  let auf: ((s: string) => void) | undefined;
  sock.setEncoding("utf8");
  sock.on("data", (d: string) => {
    puffer += d;
    if (auf && vollstaendig(puffer)) {
      const fertig = auf;
      auf = undefined;
      const text = puffer;
      puffer = "";
      fertig(text);
    }
  });
  return () =>
    new Promise<string>((gut, schlecht) => {
      if (vollstaendig(puffer)) {
        const text = puffer;
        puffer = "";
        gut(text);
        return;
      }
      auf = gut;
      sock.once("error", schlecht);
      setTimeout(() => schlecht(new Error("SMTP: keine Antwort")), 20000).unref?.();
    });
}

async function sprich(sock: Leitung, lies: () => Promise<string>, befehl?: string, erwartet = /^[23]\d\d/): Promise<string> {
  if (befehl !== undefined) sock.write(befehl + "\r\n");
  const antwort = await lies();
  // Beim Anmelden steht das Passwort im Befehl: es darf nicht in eine Fehlermeldung geraten
  if (!erwartet.test(antwort)) throw new Error(`SMTP ${befehl?.split(" ")[0] ?? "Antwort"}: ${antwort.trim().split("\r\n")[0]}`);
  return antwort;
}

function warteAuf(sock: Leitung, ereignis: string): Promise<void> {
  return new Promise((gut, schlecht) => {
    sock.once(ereignis, () => gut());
    sock.once("error", schlecht);
  });
}

/** Betreff nach RFC 2047, damit Umlaute ankommen. */
function kopfzeile(text: string): string {
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function nachricht(zugang: SmtpZugang, an: string, betreff: string, text: string): string {
  const koerper = Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
  return [
    `From: Bundesliga Manager <${zugang.from}>`,
    `To: <${an}>`,
    `Subject: ${kopfzeile(betreff)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(12).toString("hex")}@${zugang.from.split("@")[1] ?? "localhost"}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    koerper,
  ].join("\r\n");
}

export async function sendeMail(zugang: SmtpZugang, an: string, betreff: string, text: string): Promise<void> {
  const name = hostname() || "localhost";
  let sock: Leitung = zugang.port === 465 ? tlsConnect({ host: zugang.host, port: zugang.port, servername: zugang.host }) : createConnection({ host: zugang.host, port: zugang.port });
  await warteAuf(sock, zugang.port === 465 ? "secureConnect" : "connect");
  try {
    let lies = leser(sock);
    await sprich(sock, lies);
    let angebot = await sprich(sock, lies, `EHLO ${name}`);
    if (zugang.port !== 465) {
      if (!/STARTTLS/i.test(angebot)) throw new Error("SMTP: der Server bietet kein STARTTLS an");
      await sprich(sock, lies, "STARTTLS");
      const klar = sock as Socket;
      sock = tlsConnect({ socket: klar, servername: zugang.host });
      await warteAuf(sock, "secureConnect");
      lies = leser(sock);
      angebot = await sprich(sock, lies, `EHLO ${name}`);
    }
    if (/AUTH[ =\-][^\r\n]*PLAIN/i.test(angebot)) {
      await sprich(sock, lies, `AUTH PLAIN ${Buffer.from(`\0${zugang.user}\0${zugang.pass}`, "utf8").toString("base64")}`);
    } else {
      await sprich(sock, lies, "AUTH LOGIN", /^334/);
      await sprich(sock, lies, Buffer.from(zugang.user, "utf8").toString("base64"), /^334/);
      await sprich(sock, lies, Buffer.from(zugang.pass, "utf8").toString("base64"));
    }
    await sprich(sock, lies, `MAIL FROM:<${zugang.from}>`);
    await sprich(sock, lies, `RCPT TO:<${an}>`);
    await sprich(sock, lies, "DATA", /^354/);
    sock.write(nachricht(zugang, an, betreff, text) + "\r\n.\r\n");
    await sprich(sock, lies);
    await sprich(sock, lies, "QUIT").catch(() => undefined);
  } finally {
    sock.end();
  }
}
