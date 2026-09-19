# Betrieb: Server, Anmeldung, Reverse Proxy

## Server starten

```
node packages/server/server.ts [--load DATEI.MAN] [--port 8765] [--fresh]
```

Umgebung: `BMP_DIR` (Ordner mit den Spielständen, Standard `../bmp`), `PORT`,
`BMP_USERS` (Benutzerdatei, Standard `BMP_DIR/users.json`), `BMP_SESSIONS`
(Sitzungsdatei, Standard `BMP_DIR/sessions.json`), `BMP_TEMPO_MS` (Millisekunden je
Spielminute in der Live-Konferenz, Standard 900). Der Client-Bundle entsteht mit
`npm run build` in `packages/web` (esbuild), Node 24 wird vorausgesetzt.

### Hinter einem Reverse Proxy

Zwei Angaben sind dort **nötig**, sonst ist der Betrieb unsicher oder unbequem:

```
BMP_BASE_URL=https://bmp.example.org   # Adresse für die Links in den Mails
BMP_PROXY_IPS=10.0.0.2                 # Adressen der eigenen Proxys, Liste mit Komma
```

`BMP_BASE_URL` legt fest, worauf der Link in einer Einladung zeigt. Ohne die Angabe
käme der Host aus der Anfrage - und den schreibt der Anfragende selbst: wer ein
Zurücksetzen für einen anderen anstößt und einen fremden Host einträgt, schickt dem
Opfer eine echte Mail mit gültiger Marke, die auf seinen eigenen Rechner zeigt.
Ersatzweise nimmt `BMP_HOSTS` (Liste mit Komma) eine Erlaubnisliste von Hostnamen.

`BMP_PROXY_IPS` sagt, von welchen Adressen die `X-Forwarded-*`-Köpfe geglaubt werden.
Nur von dort zählt der **hinterste** Eintrag aus `X-Forwarded-For` als Adresse des
Anfragenden (nginx hängt sie mit `$proxy_add_x_forwarded_for` an); von allen anderen
zählt die Adresse der Verbindung. Ohne die Angabe hinter einem Proxy sähe der Dienst
alle Anfragen unter derselben Adresse, und die Bremse nach fünf Fehlversuchen träfe
alle Mitspieler gemeinsam.

`BMP_LOKAL_OHNE_ANMELDUNG=1` liefert `/saves/*` auch ohne Anmeldung aus, wenn die
Gegenstelle lokal ist - nur für den Prototypen auf dem eigenen Rechner gedacht, und
schon gar nicht, wenn der Proxy auf demselben Rechner läuft.

## Runden

Der Server hält bis zu **vier Spielrunden gleichzeitig** (GitLab #65). Jede hat ihren
eigenen Ordner `BMP_DIR/runden/<kennung>` mit ihrem `SERVER.MAN`; das Verzeichnis steht
in `BMP_DIR/runden.json`. Gemeinsam bleiben `MANA.DAT`, die `*.MAN` zum Laden und
Sichern und die Bestenliste `HIGH.0x` - das ist die Installation, nicht die Partie.

Der laufende Stand einer Runde wird wenige Sekunden nach der letzten Änderung und beim
Beenden des Dienstes gesichert. Ein `SERVER.MAN` aus der Zeit vor den Runden wird beim
ersten Start zur ersten Runde; die alte Datei bleibt dabei liegen. `--load DATEI` legt
nur dann eine Runde an, wenn es noch keine gibt, `--fresh` übergeht `runden.json`.
Gelöschte Runden werden in `<kennung>.geloescht` umbenannt, nicht entfernt.

Pfade: `GET /api/rooms` (Liste mit Datum, Spieltag und Besetzung), `POST /api/rooms/join {id}`,
`POST /api/rooms/leave`, `POST /api/rooms/delete {id}`. Alle übrigen Pfade beziehen sich auf
die Runde, in der der angemeldete Benutzer gerade sitzt; sie steht in seiner Sitzung und
übersteht einen Neustart.

### Geschlossene Runden

Eine Runde ist offen oder geschlossen (`privat` in `runden.json`). In eine geschlossene kommt,
wer sie angelegt hat, wer in ihrer Gästeliste steht, und der Präsident. Wer nicht hinein darf,
sieht in der Lobby nur, dass es sie gibt und wem sie gehört - nicht, wie weit sie ist und wer
mitspielt.

Eingestellt wird sie von ihrem Ersteller (und vom Präsidenten) über `POST /api/rooms/zutritt
{id, privat}` und `POST /api/rooms/gast {id, name, dazu}`; im Spiel führt der Schalter AUF/ZU in
der Lobbyzeile dorthin. Beim Zuschließen werden alle, die gerade drin sitzen, eingeladen -
sonst stünde jemand mitten im Spiel vor verschlossener Tür. Wer ausgeladen wird, verlässt die
Runde, sein Platz wird frei. `GET /api/spieler` liefert die Namen der Konten für die Gästeliste
(Präsident und Trainer).

Eine Runde aus der Zeit davor hat keinen Ersteller; sie lässt sich von jedem einstellen, bis in
`runden.json` ein `creator` eingetragen ist.

## Benutzer

```
node packages/server/users.ts add NAME PASSWORT [ROLLE|EMAIL]   # anlegen oder Passwort setzen
node packages/server/users.ts rolle NAME praesident|trainer|spieler
node packages/server/users.ts email NAME ADRESSE
node packages/server/users.ts remove NAME
node packages/server/users.ts list
```

### Rollen

| | Präsident | Trainer | Spieler |
|---|---|---|---|
| Benutzer anlegen, Passwort setzen, Rolle ändern | ja | nein | nein |
| Runde anlegen, Spielstand laden und hochladen | ja | ja | nein |
| **Fremde** Runde löschen und ersetzen | ja | nein | nein |
| **Eigene** Runde löschen und ersetzen | ja | ja | - |
| Beitreten, Platz nehmen, spielen | ja | ja | ja |

Die oberste Rolle heißt Präsident und nicht Manager: "Manager" ist im Spielstand schon
der geführte Verein. Einträge ohne Rollenfeld gelten als Spieler, eine `users.json` aus
der Zeit davor bleibt also lesbar. Der erste angelegte Benutzer wird Präsident, sonst
käme niemand an die Verwaltung heran.

Im Browser verwaltet der Präsident die Benutzer über den Schalter BENUTZER in der Lobby:
anlegen, Rolle weiterschalten, Adresse setzen, Einladung neu schicken, entfernen. Der
letzte Präsident kann sich die Rolle nicht selbst nehmen, und niemand entfernt sich
selbst. Pfade: `GET /api/users`, `POST /api/users/add {name, email, rolle}`,
`.../rolle {name, rolle}`, `.../email {name, email}`, `.../einladen {name}`,
`.../entfernen {name}`.

### Einladung und Passwort

Ein neu angelegtes Konto hat **kein** Passwort und kann sich nicht anmelden. Der Server
schickt an die hinterlegte Adresse einen einmaligen Link auf `/einladung?t=...`; erst dort
setzt der Eingeladene sein Passwort. "Passwort vergessen" im Anmeldefenster geht denselben
Weg (`POST /api/passwort/vergessen {name}`, Antwort immer `ok` - sie verrät nicht, ob es das
Konto gibt). Gesetzt wird mit `POST /api/passwort/setzen {token, password}`, mindestens acht
Zeichen; danach ist der Link verbraucht und alle alten Sitzungen des Kontos enden.

Die Marken stehen als SHA-256-Hash in `BMP_DIR/tokens.json` (`BMP_TOKENS`): wer die Datei
liest, kann damit kein Konto übernehmen. Eine Einladung gilt sieben Tage, ein Zurücksetzen
eine Stunde, und je Konto ist immer nur die neueste gültig.

Mailversand über SMTP, eingerichtet über die Umgebung:

```
BMP_SMTP_HOST=mail.example.org
BMP_SMTP_PORT=587          # Vorgabe 587 mit STARTTLS; 465 spricht sofort TLS
BMP_SMTP_USER=post@example.org
BMP_SMTP_PASS=...
BMP_SMTP_FROM=post@example.org   # Vorgabe: der Benutzername
```

Verschlüsselt wird immer: bietet der Server auf 587 kein STARTTLS an, bricht der Versand ab,
statt im Klartext weiterzureden. Fehlt eines der drei Pflichtfelder, ist der Versand
abgeschaltet und der Link steht im Protokoll des Servers - damit lässt sich ohne Postfach
entwickeln. Das Passwort gehört **nicht** in die Unit, sondern in eine `EnvironmentFile` mit
`chmod 600`.
Passwörter liegen als scrypt-Hash in `users.json`, Format `scrypt2$N$r$p$Salz$Hash` mit
N=65536 (rund 64 MiB und eine Zehntelsekunde je Anmeldung). Die Kosten stehen im Hash, damit
sie sich später anheben lassen; ein Hash nach der alten Form `scrypt$Salz$Hash` wird weiter
geprüft und beim nächsten richtigen Passwort stillschweigend erneuert. Die Anmeldung setzt ein HttpOnly-
Cookie `bmp_session` (30 Tage, `Secure` hinter HTTPS); Sitzungen überstehen einen
Neustart (`sessions.json`). Nach fünf Fehlversuchen in zehn Minuten wird eine Adresse
abgewiesen; dazu kommt je Konto eine Wartezeit, die mit jedem Fehlversuch wächst (bis fünf
Sekunden) und niemanden aussperrt. Jeder POST muss vom eigenen Ursprung kommen: ein `Origin`,
der nicht zum Host passt, wird abgewiesen (fehlt er ganz, kommt die Anfrage nicht aus einem
Browser - Werkzeuge wie curl bleiben bedienbar). Der Sitzplatz eines Managers ist an den angemeldeten Benutzer gebunden; ein
belegter Platz kann nicht übernommen werden.

Neues Spiel und Hochladen: `GET /api/mana` (Vereinsliste), `POST /api/newgame {managers:[{name, club, portrait}], level, runde}`
und `POST /api/upload {name, data, runde}` legen eine Runde an oder ersetzen die eigene
(Präsident und Trainer, nicht während der Konferenz); `MANA.DAT` muss im Spielstandordner liegen.

Speichern: `POST /api/save {file, ueberschreiben}` legt den Stand neben die anderen `*.MAN`.
Der Vorrat ist allen Runden gemeinsam, deshalb antwortet der Server auf einen vorhandenen Namen
mit `409 {vorhanden: true}` statt zu überschreiben; das Spiel fragt dann nach. `SERVER.MAN`
bleibt dem Dienst vorbehalten.

Aufstellung: `POST /api/squad {manager, data}` nimmt den ganzen Kaderblock des eigenen Managers
entgegen, übernimmt daraus aber **nur die Rückennummern** (1 bis 11 in der Mannschaft, ab 12 auf
der Bank) - und auch die nur, wenn dieselben Nummern herauskommen wie vorher, nur anders
verteilt. Stärken, Alter, Vertrag, Gehalt und welcher Spieler überhaupt im Kader steht, kommen
aus dem Spielstand des Servers und werden aus der Einsendung nicht gelesen. Wer seinen Kader im
Browser frisiert, ändert damit nichts.

Transfermarkt: `POST /api/market/list {place}` (eigenen Spieler anbieten), `/api/market/takeback {slot}`,
`/api/market/offer {where: squad|market, place}` würfelt das KI-Angebot (Dialog), `/api/market/decide {sell}`,
`/api/market/buy {slot, amount, loan}` (KI entscheidet; Kauf liefert die Gehaltsforderungen für 1..4 Jahre),
`/api/market/contract {years, accept}`, `/api/market/answer {buyer, slot, accept}` (Angebote anderer Manager;
bei Annahme eines Kaufs verhandelt der Käufer anschließend den Vertrag im Marktbildschirm).
Optionen: `POST /api/options {tempo 1..9, scenes}` gelten für den Raum (Spielgeschwindigkeit der Konferenz,
Torszenen an/aus), auch während einer laufenden Konferenz; Vorgabe der Geschwindigkeit aus `BMP_TEMPO_MS`.
Offene Dialoge und Angebote sind Laufzeitdaten und verfallen mit dem Tageswechsel.

Schnittstelle: `POST /api/login {user, password}`, `POST /api/logout`, `GET /api/me`;
alles andere unter `/api/` und `/saves/` verlangt eine Sitzung (401 sonst).

## Dauerbetrieb (systemd)

Für eine Runde, die über Tage läuft, gehört der Server hinter einen Dienst. Beispiel für einen
systemd-Dienst (`/etc/systemd/system/bmp-remake.service`, Platzhalter ersetzen):

```
[Unit]
Description=bmp-remake
After=network-online.target

[Service]
Type=simple
User=SPIELER
WorkingDirectory=/pfad/zu/bmp-remake
Environment=BMP_DIR=/pfad/zu/bmp
Environment=PORT=8765
Environment=BMP_BASE_URL=https://bmp.example.org
Environment=BMP_PROXY_IPS=10.0.0.2
# Zugangsdaten des Postfachs gehören nicht in die Unit, sondern in eine Datei mit chmod 600
EnvironmentFile=-/etc/bmp-remake.env
ExecStart=/usr/bin/node packages/server/server.ts --load SPIELSTAND.MAN
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`--load` legt nur dann eine Runde an, wenn es noch keine gibt; sonst werden die Runden aus
`BMP_DIR/runden.json` geladen. `/etc/bmp-remake.env` enthält die `BMP_SMTP_*`-Zeilen aus dem
Abschnitt "Einladung und Passwort". Der Client-Bundle muss vor dem Start gebaut sein.
Aktualisieren vom Entwicklungsrechner, ohne `node_modules` und `.git` zu übertragen:

```
tar cz --exclude=node_modules --exclude=.git packages assets docs tools package.json README.md \
  | ssh SERVER 'tar xz -C ~/bmp-remake'
ssh SERVER 'cd ~/bmp-remake && npm install --no-audit --no-fund \
  && (cd packages/web && npm run build) && sudo systemctl restart bmp-remake'
```

`assets/` gehört mit übertragen, wenn der Server die Bilder, Klänge und Texte ausliefern soll -
erzeugt wird es einmalig aus der eigenen Installation (`npm run assets`, siehe README).

## Reverse Proxy (NGINX)

Der Server spricht HTTP und bringt kein TLS mit; im Netz gehört er hinter einen Proxy. Beispiel:

```
location / {
    proxy_pass http://SPIELSERVER:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;   # steuert das Secure-Cookie
    client_max_body_size 4m;                      # Spielstand-Upload
    include snippets/bmp-zugriff.conf;            # allow/deny, abschließend "deny all"
}

location /api/events {                            # Server-Sent-Events, darf nicht puffern
    proxy_pass http://SPIELSERVER:8765;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
}
```

Worauf es ankommt:

- `X-Forwarded-Proto` setzen, sonst fehlt dem Sitzungs-Cookie hinter HTTPS das `Secure`.
- `/api/events` ungepuffert durchreichen, sonst kommt die Live-Konferenz stockend an; der
  Server sendet dazu selbst `X-Accel-Buffering: no`.
- `client_max_body_size` groß genug für einen hochgeladenen Spielstand.
- Zugang beschränken: das Spiel ist für eine feste kleine Runde gedacht - IP-Filter,
  VPN-Mesh oder beides, dazu die Anmeldung des Servers.
- Der Client benutzt nur relative Pfade (`api/...`, `dist/...`, `assets/...`); die Seite muss
  deshalb unter einem Pfad mit abschließendem `/` erreichbar sein.

Eigene Namen, Adressen und Pfade gehören nicht in diese Datei: `docs/original/` ist über
`.gitignore` vom Repo ausgeschlossen und der richtige Platz dafür.
