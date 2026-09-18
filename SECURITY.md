# Sicherheit

## Was hier läuft

bmp-remake ist ein selbst betriebenes Spiel: ein Node-Server hält einen Spielstand, mehrere
Manager spielen ihn im Browser. Es gibt eine Anmeldung mit Benutzername und Passwort
(scrypt-Hash in `users.json`), Sitzungen in einem HttpOnly-Cookie und einen Spielstand, den
angemeldete Benutzer hoch- und herunterladen können. Der Server ist für kleine, private Runden
gedacht und gehört nicht ungeschützt ins offene Netz.

## Lücken melden

Bitte **nicht** als öffentliches Issue. Stattdessen:

- auf GitHub: *Security* → *Report a vulnerability* (private Sicherheitsmeldung), oder
- auf GitLab: ein **vertrauliches** Issue anlegen (Haken "Dieses Issue ist vertraulich").

Hilfreich sind: eine kurze Beschreibung, die betroffene Datei oder Schnittstelle, die Schritte
zum Nachstellen und - falls vorhanden - ein Vorschlag zur Behebung. Eine erste Antwort gibt es
in der Regel innerhalb von zwei Wochen; das hier ist ein Freizeitprojekt ohne Bereitschaft und
ohne Prämien.

Bitte keine fremden Server angreifen, keine Daten anderer Spieler abgreifen und keine
Verfügbarkeit stören - eine lokale Installation genügt zum Nachweis.

## Im Blick

Besonders interessant sind Meldungen zu:

- Anmeldung, Sitzungen, Cookies und der Bindung eines Sitzplatzes an einen Benutzer
  (`packages/server/users.ts`, `packages/server/server.ts`),
- den Schnittstellen unter `/api/`: darf ein Manager etwas tun, was nur einem anderen zusteht
  (fremde Aufstellung, fremdes Geld, fremde Spieler)? Sieht jemand verdeckte Informationen,
  etwa fremde Gebote im Bietgefecht?
- dem Ausliefern von Dateien (`/saves/`, statische Dateien): Pfade, die aus dem vorgesehenen
  Ordner herausführen,
- dem Einlesen von Spielständen und `MANA.DAT`: fehlerhafte oder bösartig gebaute Dateien
  dürfen den Server nicht zum Schreiben außerhalb des Spielstandordners bringen.

## Außerhalb des Rahmens

- Fehler im Original von 1991, die wir absichtlich nachbilden.
- Gestaltung des Betriebs beim Betreiber: TLS, Reverse Proxy, Zugriff aufs Netz, Sicherungen.
  Hinweise dazu stehen in `docs/BETRIEB.md`.
- Schwache Passwörter, die jemand selbst für seine Runde vergibt.
