# Betrieb: Server, Anmeldung, Reverse Proxy

## Server starten

```
node packages/server/server.ts [--load DATEI.MAN] [--port 8765] [--fresh]
```

Umgebung: `BMP_DIR` (Ordner mit den Spielständen, Standard `../bmp`), `PORT`,
`BMP_USERS` (Benutzerdatei, Standard `BMP_DIR/users.json`), `BMP_SESSIONS`
(Sitzungsdatei, Standard `BMP_DIR/sessions.json`), `BMP_TEMPO_MS` (Millisekunden je
Spielminute in der Live-Konferenz, Standard 900). Der laufende Stand wird nach jedem
Tageswechsel als `SERVER.MAN` gesichert und beim nächsten Start bevorzugt geladen;
`--fresh` lädt stattdessen die Datei aus `--load`. Der Client-Bundle entsteht mit
`npm run build` in `packages/web` (esbuild), Node 24 wird vorausgesetzt.

## Benutzer

```
node packages/server/users.ts add NAME PASSWORT    # anlegen oder Passwort setzen
node packages/server/users.ts remove NAME
node packages/server/users.ts list
```

Passwörter liegen als scrypt-Hash in `users.json`. Die Anmeldung setzt ein HttpOnly-
Cookie `bmp_session` (30 Tage, `Secure` hinter HTTPS); Sitzungen überstehen einen
Neustart (`sessions.json`). Nach fünf Fehlversuchen in zehn Minuten wird eine Adresse
abgewiesen. Der Sitzplatz eines Managers ist an den angemeldeten Benutzer gebunden; ein
belegter Platz kann nicht übernommen werden.

Neues Spiel und Hochladen: `GET /api/mana` (Vereinsliste), `POST /api/newgame {managers:[{name, club, portrait}], level}`
und `POST /api/upload {name, data}` ersetzen das laufende Spiel (jeder angemeldete Benutzer,
nicht während der Konferenz); `MANA.DAT` muss im Spielstandordner liegen.

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
ExecStart=/usr/bin/node packages/server/server.ts --load SPIELSTAND.MAN
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`--load` greift nur beim ersten Start oder mit `--fresh`; sonst wird der gesicherte Stand
`SERVER.MAN` aus `BMP_DIR` geladen. Der Client-Bundle muss vor dem Start gebaut sein.
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
