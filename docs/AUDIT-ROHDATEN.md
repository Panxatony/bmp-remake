# Audit der Routinen von BMMAIN.EXE (Rohdaten)

Erzeugt von tools/audit.py. Routinen = `push %bp; mov %sp,%bp`. 408 Routinen, davon 106 mit genannter Adresse.

## Segmente

| Segment | Routinen | Bytes | abgebildet | Art |
|---|---:|---:|---:|---|
| 0000 | 10 | 13042 | 7 | Spiel |
| 0310 | 34 | 14885 | 20 | Spiel |
| 06c7 | 8 | 2552 | 1 | Zeichnen |
| 076b | 17 | 5301 | 1 | Oberfläche |
| 08bc | 16 | 16286 | 5 | Spiel |
| 0cb5 | 8 | 13573 | 4 | Spiel |
| 0f9d | 5 | 4675 | 4 | Spiel |
| 112a | 12 | 14240 | 7 | Spiel |
| 14a4 | 23 | 13972 | 13 | Spiel |
| 17c2 | 14 | 9535 | 10 | Spiel |
| 1a58 | 11 | 19810 | 5 | Spiel |
| 1ecd | 17 | 13307 | 3 | Spiel |
| 2277 | 11 | 15226 | 8 | Spiel |
| 262f | 16 | 16682 | 4 | Spiel |
| 2a41 | 22 | 25024 | 8 | Spiel |
| 2e3a | 2 | 818 | 0 | Spiel |
| 3091 | 19 | 6631 | 3 | Spiel |
| 322b | 12 | 20121 | 3 | Spiel |
| 35ac | 42 | 8595 | 0 | Grafikkern |
| 3930 | 34 | 3784 | 0 | Datei/Speicher |
| 3a01 | 75 | 117845 | 0 | C-Bibliothek |

## Routinen (ohne Bibliotheken)

| Adresse | Größe | Seg | Aufrufer | random | Tabellen | Texte | Status |
|---|---:|---|---:|---:|---|---|---|
| 0x00000 | 1538 | 0000 | 1 | 3 | manager | Kleingeld vorhanden...; Zu wenig; AUSBAU UM ;  AUF  | abgebildet (0x0) |
| 0x00602 | 4321 | 0000 | 1 | 0 | manager | Stadion; Baufirma aufzutreiben.; Im Moment keine; KOSTET  | abgebildet (0x602, 0x76B, 0xECC, 0x1416, 0x146C) |
| 0x016E3 | 870 | 0000 | 1 | 0 |  |  |  |
| 0x01A49 | 1688 | 0000 | 1 | 0 | club,manager | IHR KONTOSTAND:;  DM; MOMENTAN; NACH AUSBAU | abgebildet (0x1A4C, 0x1AE6, 0x1D34) |
| 0x020E1 | 701 | 0000 | 1 | 0 | manager | Flutlichtmasten; Anzeigetafel; Stadion-Komforts; ist abgeschlossen. | abgebildet (0x20E1, 0x2242, 0x225A, 0x2262, 0x2272, 0x2273) |
| 0x0239E | 161 | 0000 | 2 | 0 |  |  | abgebildet (0x23B4) |
| 0x0243F | 750 | 0000 | 3 | 0 | manager |  DM/Woche.; Kredit zu ; % aufnehmen.; Kredit von  | abgebildet (0x24C8) |
| 0x0272D | 360 | 0000 | 1 | 2 | manager |  DM AN ?; LIEBER NICHT.; ABER IMMER!; ZUSCHU~ VON |  |
| 0x02895 | 47 | 0000 | 2 | 0 | manager |  |  |
| 0x028C4 | 2606 | 0000 | 1 | 0 | manager,pairings | R}ck; Hin; spiele ; REICHT MIR | abgebildet (0x2E8E, 0x2EBA, 0x304A, 0x3066, 0x3091) |
| 0x032F2 | 111 | 0310 | 7 | 0 |  |  |  |
| 0x03361 | 47 | 0310 | 1 | 0 | manager | DFB-Pokal |  |
| 0x03390 | 47 | 0310 | 1 | 0 | manager | Europapokal |  |
| 0x033BF | 420 | 0310 | 1 | 0 | manager | Relegationsspiel | abgebildet (0x33C0) |
| 0x03563 | 398 | 0310 | 1 | 3 | manager |  | abgebildet (0x3563) |
| 0x036F1 | 433 | 0310 | 1 | 0 | manager,pairings |  | abgebildet (0x36F1) |
| 0x038A2 | 499 | 0310 | 1 | 0 | manager,pairings | Nachholspiele | abgebildet (0x3930, 0x3A01) |
| 0x03A95 | 48 | 0310 | 1 | 0 |  | Ligaspiel |  |
| 0x03AC5 | 291 | 0310 | 2 | 2 | manager |  | abgebildet (0x3AC5) |
| 0x03BE8 | 60 | 0310 | 1 | 0 |  |  |  |
| 0x03C24 | 1056 | 0310 | 3 | 0 | manager,player |  | abgebildet (0x3C24) |
| 0x04044 | 114 | 0310 | 1 | 0 | history |  |  |
| 0x040B6 | 474 | 0310 | 1 | 0 | manager |  | abgebildet (0x4238) |
| 0x04290 | 323 | 0310 | 5 | 0 |  |  | abgebildet (0x4290) |
| 0x043D3 | 43 | 0310 | 1 | 1 |  |  |  |
| 0x043FE | 362 | 0310 | 2 | 1 | club |  | abgebildet (0x43FF) |
| 0x04568 | 198 | 0310 | 4 | 0 | club |  | abgebildet (0x4568) |
| 0x0462E | 173 | 0310 | 1 | 0 | results |  | abgebildet (0x462F) |
| 0x046DB | 1532 | 0310 | 5 | 0 | manager,pairings |  | abgebildet (0x46DB, 0x4A28, 0x4B5E, 0x4CB3) |
| 0x04CD7 | 75 | 0310 | 3 | 0 | player,squad |  | abgebildet (0x4CD7) |
| 0x04D22 | 177 | 0310 | 3 | 0 | player,squad |  |  |
| 0x04DD3 | 114 | 0310 | 3 | 0 | player,squad |  | abgebildet (0x4DD3) |
| 0x04E45 | 170 | 0310 | 1 | 3 |  |  |  |
| 0x04EEF | 504 | 0310 | 4 | 0 |  |  |  |
| 0x050E7 | 159 | 0310 | 9 | 0 | manager |  |  |
| 0x05186 | 637 | 0310 | 3 | 0 | manager | Minute; ELFMETER |  |
| 0x05403 | 2455 | 0310 | 1 | 0 | manager,pairings | Torszene war:; letzten gespielten; Der Erbauer der | abgebildet (0x5404, 0x543E, 0x5714, 0x57DD) |
| 0x05D9A | 587 | 0310 | 1 | 4 | player |  | abgebildet (0x5D9A) |
| 0x05FE5 | 839 | 0310 | 1 | 3 | club,manager |  | abgebildet (0x5FE5) |
| 0x0632C | 133 | 0310 | 3 | 0 |  |  |  |
| 0x063B1 | 99 | 0310 | 17 | 0 | manager |  | abgebildet (0x63B1) |
| 0x06414 | 363 | 0310 | 1 | 0 |  |  | abgebildet (0x6414) |
| 0x0657F | 238 | 0310 | 2 | 0 |  |  |  |
| 0x0666D | 1706 | 0310 | 1 | 4 | manager | !    Elfmeterschiessen    !; gegen; Endergebnis:;  :  | abgebildet (0x666D) |
| 0x08BC4 | 503 | 08bc | 1 | 0 |  |  |  |
| 0x08DBB | 244 | 08bc | 1 | 0 | history,manager |  | abgebildet (0x8DBB) |
| 0x08EAF | 94 | 08bc | 3 | 0 |  | KEINE BEMERKENSWERTE SERIE VORHANDEN. |  |
| 0x08F0D | 203 | 08bc | 4 | 0 |  |  |  |
| 0x08FD8 | 1242 | 08bc | 1 | 0 | manager | SERIEN  | abgebildet (0x8FD8, 0x9336) |
| 0x094B2 | 369 | 08bc | 1 | 0 |  | alleine !; Spiele nicht; weiter !; Spiele automatisch |  |
| 0x09623 | 252 | 08bc | 2 | 2 | manager |  | abgebildet (0x9623) |
| 0x0971F | 4286 | 08bc | 1 | 0 | manager,squad,standing | autosave.man; SAISONENDE;  Spieltag; DFB-Pokal | abgebildet (0xA7A0) |
| 0x0A7DD | 192 | 08bc | 1 | 0 |  | KEIN GEDANKE; LEIDER JA; BEENDEN ?; DAS SPIEL WIRKLICH |  |
| 0x0A89D | 278 | 08bc | 1 | 0 |  |  |  |
| 0x0A9B3 | 130 | 08bc | 1 | 0 |  |  |  |
| 0x0AA35 | 33 | 08bc | 1 | 0 |  |  |  |
| 0x0AA56 | 302 | 08bc | 1 | 0 |  |  | Anzeige (abgleich/restroutinen.md) |
| 0x0AB84 | 157 | 08bc | 1 | 0 |  |  |  |
| 0x0AC21 | 291 | 08bc | 1 | 0 |  |  |  |
| 0x0AD44 | 7710 | 08bc | 2 | 5 | club,history,manager,player,squad | SERIEN  | abgebildet (0xAD44, 0xBDB8, 0xC7C4) |
| 0x0CB62 | 5035 | 0cb5 | 1 | 16 | manager,player,squad | Gratulation zum Aufstieg (800.000 DM).; bleiben solange erhalten.; zu k}ndigen. Die Einnahmen; es, die Vertr{ge jederzeit | abgebildet (0xCB62, 0xCB63, 0xCC34, 0xCE84, 0xD3ED, 0xD475, 0xDB40) |
| 0x0DF0D | 4632 | 0cb5 | 1 | 36 | club,manager,player | Randalierer im Stadion; richteten einen Sachschaden; von ;  DM an. | abgebildet (0xDF0D, 0xDF0E, 0xDF8F, 0xE668, 0xE76F, 0xEBB2, 0xEC0C, 0xEC50, 0xECEB, 0xEFEE, 0xF04D, 0xF08F, 0xF09F) |
| 0x0F125 | 385 | 0cb5 | 1 | 0 | player |  |  |
| 0x0F2A6 | 561 | 0cb5 | 1 | 1 | manager,player |  |  |
| 0x0F4D7 | 180 | 0cb5 | 2 | 6 | manager |  |  |
| 0x0F58B | 333 | 0cb5 | 2 | 0 | club,manager |  |  |
| 0x0F6D8 | 113 | 0cb5 | 2 | 0 |  |  | abgebildet (0xF6D8) |
| 0x0F749 | 2334 | 0cb5 | 1 | 7 | club,manager,player |  | abgebildet (0xF9D2, 0xFB5B, 0xFBE4, 0xFD3C, 0xFD40, 0xFFAD, 0xFFFF) |
| 0x10067 | 594 | 0f9d | 2 | 5 | club |  | abgebildet (0x10067) |
| 0x102B9 | 850 | 0f9d | 2 | 14 | manager |  | abgebildet (0x102BA) |
| 0x1060B | 1255 | 0f9d | 1 | 5 | club,manager,pairings |  - ;     | abgebildet (0x1060C) |
| 0x10AF2 | 190 | 0f9d | 1 | 0 |  |  |  |
| 0x10BB0 | 1786 | 0f9d | 1 | 4 | club,manager,standing |  | abgebildet (0x10BB0) |
| 0x112AA | 170 | 112a | 2 | 1 | club |  |  |
| 0x11354 | 145 | 112a | 2 | 0 | player,squad |  |  |
| 0x113E5 | 1512 | 112a | 1 | 0 | manager | Trainingslager; hat nicht ge/ffnet...; reicht doch...; Einmal pro Woche | abgebildet (0x113E5, 0x118AD) |
| 0x119CD | 832 | 112a | 1 | 7 | manager |  | abgebildet (0x119CD) |
| 0x11D0D | 1312 | 112a | 1 | 4 | manager | wurde heute f{llig.; Ihr Kredit von; der Bank | abgebildet (0x11D0D, 0x11E42) |
| 0x1222D | 172 | 112a | 6 | 0 |  |  | abgebildet (0x1222D) |
| 0x122D9 | 354 | 112a | 1 | 0 |  | aufgenommen.; Schon 3 Kredite | abgebildet (0x122D9) |
| 0x1243B | 1252 | 112a | 1 | 0 | manager |  DM (; F[LLIG AM ; ZINSEN PRO MONAT: ;  DM |  |
| 0x1291F | 3404 | 112a | 1 | 0 | manager | Kredite; Dauer  Zinssatz;  Mon.; SCHULDEN HIER:  | abgebildet (0x1291F) |
| 0x1366B | 897 | 112a | 1 | 0 | manager | Kontostand:;  DM; Gesamtschulden:; Zinsen/Monat: |  |
| 0x139EC | 2561 | 112a | 1 | 0 | manager | Training; Intensit{t | abgebildet (0x139EC) |
| 0x143ED | 1629 | 112a | 1 | 0 | manager,standing | Viel Gl}ck.; Relegationsspiel.; bestreitet das; Ihre Mannschaft |  |
| 0x14A4A | 73 | 14a4 | 1 | 0 |  |  |  |
| 0x14A93 | 966 | 14a4 | 1 | 0 |  | GELBE KARTEN:  | abgebildet (0x14A93) |
| 0x14E59 | 347 | 14a4 | 1 | 0 |  | tore\anzahl |  |
| 0x14FB4 | 120 | 14a4 | 1 | 0 |  | Spiel austauschen !; Bitte nach diesem; ist offenbar defekt.; Ihre Torszenen-Diskette |  |
| 0x1502C | 794 | 14a4 | 1 | 4 |  | ROTE KARTEN  : ; tore\ | abgebildet (0x1502C) |
| 0x15346 | 3022 | 14a4 | 3 | 0 | manager,player | Info ]ber ; AHA !;  IST ;  JAHRE ALT,  |  |
| 0x15F14 | 398 | 14a4 | 1 | 7 | player |  |  |
| 0x160A2 | 236 | 14a4 | 1 | 0 | manager,pairings |  |  |
| 0x1618E | 74 | 14a4 | 1 | 1 |  |  |  |
| 0x161D8 | 611 | 14a4 | 2 | 2 | manager,player |  |  |
| 0x1643B | 218 | 14a4 | 1 | 0 | player |  | abgebildet (0x1643B) |
| 0x16515 | 2309 | 14a4 | 2 | 0 | manager,player,squad | Torsch}tzenliste; Die Besten der ; PL. SPIELER                 VEREIN; TORE       TORE/SPIEL | abgebildet (0x16515) |
| 0x16E1A | 229 | 14a4 | 1 | 3 |  |  | abgebildet (0x16E1A) |
| 0x16EFF | 201 | 14a4 | 2 | 1 |  |  | abgebildet (0x16EFF) |
| 0x16FC8 | 130 | 14a4 | 1 | 0 | player |  | abgebildet (0x16FC8) |
| 0x1704A | 44 | 14a4 | 1 | 0 |  |  |  |
| 0x17076 | 492 | 14a4 | 3 | 0 | club,manager |  | abgebildet (0x17076) |
| 0x17262 | 755 | 14a4 | 3 | 0 | manager,player,squad |  | abgebildet (0x17262) |
| 0x17555 | 165 | 14a4 | 1 | 0 | manager |  | abgebildet (0x17555) |
| 0x175FA | 250 | 14a4 | 2 | 0 |  |  | abgebildet (0x175FA) |
| 0x176F4 | 1051 | 14a4 | 2 | 8 | manager |  | abgebildet (0x176F4) |
| 0x17B0F | 1161 | 14a4 | 2 | 6 | manager,player | DFB-Pokal Auslosung; KEIN GEDANKE; ABER KLAR; M/CHTEN SIE DEM UN]BERTROFFENEM | abgebildet (0x17B0F) |
| 0x17F98 | 1314 | 17c2 | 2 | 0 | club |  |  |
| 0x184BA | 326 | 14a4 | 3 | 0 | manager | TASTE DR]CKEN |  |
| 0x18600 | 1298 | 17c2 | 2 | 3 | manager |  | abgebildet (0x18600) |
| 0x18B12 | 661 | 17c2 | 2 | 0 |  |  | abgebildet (0x18B12) |
| 0x18DA7 | 96 | 17c2 | 2 | 0 |  |  | abgebildet (0x18DA8) |
| 0x18E07 | 63 | 17c2 | 2 | 0 |  |  | abgebildet (0x18E07) |
| 0x18E46 | 380 | 17c2 | 1 | 0 |  |  | abgebildet (0x18E46) |
| 0x18FC2 | 582 | 17c2 | 1 | 2 |  |  | abgebildet (0x18FC2) |
| 0x19208 | 244 | 17c2 | 3 | 0 |  |  | abgebildet (0x19208) |
| 0x192FC | 1169 | 17c2 | 1 | 0 | manager |  | abgebildet (0x192FC, 0x196E6) |
| 0x1978D | 72 | 17c2 | 3 | 0 |  |  | abgebildet (0x1978D) |
| 0x197D5 | 59 | 17c2 | 7 | 0 |  |  | abgebildet (0x197D5) |
| 0x19810 | 219 | 17c2 | 1 | 0 | manager |  GEGEN  |  |
| 0x198EB | 2690 | 17c2 | 4 | 0 | manager | Pokalspiele; Relegationsspiel; Relegation;      |  |
| 0x1A36D | 688 | 17c2 | 2 | 0 | manager | Deutsche Meisterschaft; gewinnt die; gewinnt den; ENDE |  |
| 0x1A61D | 433 | 1a58 | 3 | 0 | manager |  |  |
| 0x1A7CE | 258 | 1a58 | 2 | 0 |  |  |  |
| 0x1A8D0 | 223 | 1a58 | 1 | 0 |  |  |  |
| 0x1A9AF | 2164 | 1a58 | 4 | 0 | club,manager,pairings | (AUSW.) |  |
| 0x1B223 | 4818 | 1a58 | 3 | 2 | manager,player,squad | Chance f]r ; Elfmeter f]r ; Torsch}tze: ; Chance vergeben:  | abgebildet (0x1B223, 0x1B224) |
| 0x1C4F5 | 220 | 1a58 | 2 | 0 |  |  | abgebildet (0x1C4F5) |
| 0x1C5D1 | 97 | 1a58 | 1 | 0 | manager | 200.000 DM Strafe; gewertet. Sie zahlen; Ihr Spiel wird mit 0:2 |  |
| 0x1C632 | 2388 | 1a58 | 1 | 4 | manager,player,standing |  | abgebildet (0x1C632, 0x1C633, 0x1C737, 0x1C798, 0x1C858, 0x1CC4A, 0x1CEA7) |
| 0x1CF86 | 1904 | 1a58 | 1 | 3 | manager | Frohe Weihnachten !; BUNDESLIGA: ;  DM, 2.LIGA: ;  DM, |  |
| 0x1D6F6 | 5153 | 1a58 | 1 | 2 | manager,squad,standing | WINTERPAUSE | abgebildet (0x1D6F7, 0x1D8D1, 0x1DBFE, 0x1E3DA, 0x1E4A0, 0x1EA3B) |
| 0x1EB17 | 2152 | 1a58 | 1 | 0 | manager,player,standing | SAISONENDE;  (AUSGEL.); NAME: ;  JAHRE) | abgebildet (0x1EF4D) |
| 0x1F37F | 2623 | 1ecd | 3 | 0 | manager,player | TRANSFERMARKT; IHRE MANNSCHAFT; NR ; ART    |  |
| 0x1FDBE | 267 | 1ecd | 3 | 0 | player,squad |  | abgebildet (0x1FDBE) |
| 0x1FEC9 | 109 | 1ecd | 1 | 0 | squad |  |  |
| 0x1FF36 | 196 | 1ecd | 0 | 0 | player,squad |  |  |
| 0x1FFFA | 267 | 1ecd | 0 | 0 | squad |  |  |
| 0x20105 | 146 | 1ecd | 1 | 0 |  |  |  |
| 0x20197 | 153 | 1ecd | 2 | 0 |  | ist deaktiviert !; Auto-Aufstellung |  |
| 0x20230 | 3949 | 1ecd | 2 | 1 | manager,player,squad | ist aktiviert !; Auto-Aufstellung; Spieler ist; nicht aufgestellt | abgebildet (0x20DBC, 0x21190) |
| 0x2119D | 395 | 1ecd | 3 | 0 | player,squad |  |  |
| 0x21328 | 142 | 1ecd | 2 | 0 | squad |  |  |
| 0x213B6 | 433 | 1ecd | 2 | 0 | squad |  |  |
| 0x21567 | 303 | 1ecd | 1 | 0 | manager,player | ST[RKE:;  JAHRE |  |
| 0x21696 | 1962 | 1ecd | 3 | 0 | squad |  |  |
| 0x21E40 | 496 | 1ecd | 2 | 0 | manager,player,squad |  |  |
| 0x22030 | 725 | 1ecd | 7 | 0 | squad |  |  |
| 0x22305 | 419 | 1ecd | 1 | 0 | player |  |  |
| 0x224A8 | 722 | 1ecd | 5 | 1 | manager,player,squad | dem Transfermarkt; Schon 12 Mann auf; im Team; Schon 24 Mann | abgebildet (0x224A8) |
| 0x2277A | 119 | 2277 | 3 | 4 |  |  | abgebildet (0x2277A) |
| 0x227F1 | 296 | 2277 | 1 | 0 | manager |  |  |
| 0x22919 | 124 | 2277 | 1 | 0 | manager |  | abgebildet (0x22919) |
| 0x22995 | 640 | 2277 | 1 | 0 |  |  |  |
| 0x22C15 | 5818 | 2277 | 1 | 2 | manager,player,squad | Transfermarkt; Kontostand:; LEIHEN; KAUFEN | abgebildet (0x22C15, 0x23655, 0x23816, 0x23B90, 0x23E58, 0x23F7E, 0x2411C) |
| 0x242CF | 729 | 2277 | 1 | 0 | manager | Angebot; Abl/se;  DM.; BEHALTEN | abgebildet (0x242CF) |
| 0x245A8 | 825 | 2277 | 2 | 9 | club,manager,player,squad |  | abgebildet (0x245A8) |
| 0x248E1 | 255 | 2277 | 1 | 3 | squad |  | abgebildet (0x248E1) |
| 0x249E0 | 878 | 2277 | 1 | 2 | manager,player,squad |  |  |
| 0x24D4E | 1201 | 2277 | 11 | 3 | player |  | abgebildet (0x24D4E) |
| 0x251FF | 4341 | 2277 | 3 | 1 | manager,player,squad | nur ausgeliehen.; ist leider von; zur Ruhe setzen.; Ablauf des Vertrages | abgebildet (0x251FF, 0x25C27) |
| 0x262F4 | 130 | 262f | 2 | 0 |  |  |  |
| 0x26376 | 306 | 262f | 1 | 0 |  |  |  |
| 0x264A8 | 2279 | 262f | 2 | 0 | club,manager,squad | Einstellungen; V2.0 - ENDE: ;  NIE.;  (LEVEL  |  |
| 0x26D8F | 88 | 262f | 2 | 0 | manager |  |  |
| 0x26DE7 | 3568 | 262f | 1 | 0 | club,history,manager | Statistik;  DM; G       H       A | abgebildet (0x26F88) |
| 0x27BD7 | 2298 | 262f | 1 | 0 | club,manager,standing | Ewige Tabelle/Bilanz; Ewige Tabelle; Ewige Bilanz;  KOMMT VIELLEICHT NOCH... | abgebildet (0x27C98, 0x27DC9) |
| 0x284D1 | 515 | 262f | 2 | 0 | standing |  |  |
| 0x286D4 | 166 | 262f | 1 | 0 |  |  |  |
| 0x2877A | 99 | 262f | 2 | 0 |  |  |  |
| 0x287DD | 100 | 262f | 1 | 0 |  |  |  |
| 0x28841 | 718 | 262f | 3 | 0 | club,manager | VERTRAG: ;  JAHR;  MONAT; K}NDBAR |  |
| 0x28B0F | 393 | 262f | 1 | 0 | club | KEIN INTERESSE... |  |
| 0x28C98 | 576 | 262f | 1 | 0 |  |  |  |
| 0x28ED8 | 2820 | 262f | 1 | 0 |  |  (H); unter Vertrag; Sie stehen noch | abgebildet (0x291CD, 0x29242) |
| 0x299DC | 546 | 262f | 1 | 2 | club,manager | mana.dat; @@@@@@@@ | abgebildet (0x299DC) |
| 0x29BFE | 2080 | 262f | 1 | 0 | club,manager | Damals... Ihre Erfolge; Sais. Pl.   Liga       DfB-Pokal       Europapokal; Gesamtentwicklung; EXISTIERTEN SIE NOCH GAR NICHT ALS MANAGER... |  |
| 0x2A41E | 3840 | 2a41 | 4 | 0 | club,history,manager,pairings | Info ]ber ; REICHT MIR; IHRE SP[HER K/NNEN LEIDER NUR; AUF DEUTSCHEM BODEN OPERIEREN... | abgebildet (0x2AB35) |
| 0x2B31E | 469 | 2a41 | 2 | 0 | history,pairings | NOCH KEINE EINTRAGUNG. | abgebildet (0x2B31E) |
| 0x2B4F3 | 295 | 2a41 | 6 | 0 | manager,pairings |  | abgebildet (0x2B4F3) |
| 0x2B61A | 2830 | 2a41 | 2 | 0 | club,manager,pairings | Spielplan; SPIELE  ;    ; SPIELTAG   |  |
| 0x2C128 | 476 | 2a41 | 2 | 0 | pairings,standing | PLATZ, ST[RKE  |  |
| 0x2C304 | 188 | 2a41 | 1 | 0 | standing |  | abgebildet (0x2C304) |
| 0x2C3C0 | 60 | 2a41 | 1 | 0 |  |  |  |
| 0x2C3FC | 135 | 2a41 | 1 | 1 | club |  |  |
| 0x2C483 | 217 | 2a41 | 1 | 0 | history |  |  |
| 0x2C55C | 3047 | 2a41 | 2 | 0 | manager,pairings,standing | Tabelle ;    ; SPIELTAG;       |  |
| 0x2D143 | 2716 | 2a41 | 4 | 0 | history,manager,pairings,results,standing |  | abgebildet (0x2D144, 0x2D182) |
| 0x2DBDF | 194 | 2a41 | 1 | 0 | history |  | abgebildet (0x2DBDF) |
| 0x2DCA1 | 3337 | 2a41 | 1 | 0 | club,manager,squad | St{rketabelle; ST[RKEN ; PL.     VEREIN               KONDITION   TECHNIK    FORM;              | abgebildet (0x2DD9D) |
| 0x2E9AA | 213 | 2a41 | 1 | 0 |  |  |  |
| 0x2EA7F | 570 | 2a41 | 3 | 0 |  |  |  |
| 0x2ECB9 | 75 | 2a41 | 1 | 0 |  |  |  |
| 0x2ED04 | 679 | 2a41 | 3 | 1 |  |  |  |
| 0x2EFAB | 296 | 2a41 | 0 | 1 | manager |  |  |
| 0x2F0D3 | 135 | 2a41 | 1 | 0 |  |  |  |
| 0x2F15A | 233 | 2a41 | 0 | 0 |  |  |  |
| 0x2F243 | 4940 | 2a41 | 0 | 25 | player,squad |  | abgebildet (0x2F244, 0x2F617) |
| 0x3058F | 79 | 2a41 | 1 | 2 |  |  |  |
| 0x305DE | 364 | 2e3a | 1 | 0 |  |  |  |
| 0x3074A | 454 | 2e3a | 1 | 0 |  |  |  |
| 0x30910 | 68 | 3091 | 2 | 0 |  |  |  |
| 0x30954 | 332 | 3091 | 7 | 0 |  |  |  |
| 0x30AA0 | 930 | 3091 | 4 | 1 | manager |  | abgebildet (0x30AA0) |
| 0x30E42 | 146 | 3091 | 2 | 0 |  |  |  |
| 0x30ED4 | 1367 | 3091 | 4 | 0 | manager | Keine Nachricht vorhanden. |  |
| 0x3142B | 138 | 3091 | 1 | 0 | manager |  |  |
| 0x314B5 | 661 | 3091 | 2 | 0 | manager |  |  |
| 0x3174A | 463 | 3091 | 10 | 0 | manager | OKAY |  |
| 0x31919 | 42 | 3091 | 17 | 0 |  |  | abgebildet (0x31919) |
| 0x31943 | 42 | 3091 | 0 | 0 |  |  |  |
| 0x3196D | 120 | 3091 | 11 | 0 |  |  |  |
| 0x319E5 | 52 | 3091 | 9 | 0 |  |  | abgebildet (0x319E5) |
| 0x31A19 | 195 | 3091 | 29 | 0 | squad |  |  |
| 0x31ADC | 113 | 3091 | 9 | 0 |  |  |  |
| 0x31B4D | 559 | 3091 | 13 | 0 |  |  |  |
| 0x31D7C | 694 | 3091 | 6 | 0 | manager | An Alle: |  |
| 0x32032 | 149 | 3091 | 17 | 0 |  |  |  |
| 0x320C7 | 165 | 3091 | 1 | 0 |  |  |  |
| 0x3216C | 395 | 3091 | 3 | 0 |  | Diskettenzugriff !; Fehler beim; Achtung ! |  |
| 0x322F7 | 248 | 322b | 1 | 0 |  |  |  |
| 0x323EF | 145 | 322b | 1 | 0 |  |  |  |
| 0x32480 | 94 | 322b | 2 | 0 |  |  | abgebildet (0x32480) |
| 0x324DE | 302 | 322b | 1 | 2 | manager,player |  | abgebildet (0x324DE) |
| 0x3260C | 1186 | 322b | 1 | 12 | manager,player,squad |  | abgebildet (0x3260C) |
| 0x32AAE | 2574 | 322b | 2 | 4 | manager | Spielstand Speichern; BLO~ NICHT !; ACH BITTE !; ]BERSCHREIBEN ? |  |
| 0x334BC | 4024 | 322b | 2 | 0 | club,manager,squad | Spielstand Laden; !!!; Spielstand.; Bundesliga Manager Prof. |  |
| 0x34474 | 418 | 322b | 2 | 0 |  | HIGH.00 |  |
| 0x34616 | 1278 | 322b | 3 | 0 | manager | PUNKTE:; (X/X/X) |  |
| 0x34B14 | 454 | 322b | 1 | 0 | manager,standing |  |  |
| 0x34CDA | 404 | 322b | 2 | 0 | manager |  |  |
| 0x34E6E | 8994 | 322b | 2 | 0 | manager | *.*; VERZEICHNIS: ; FILENAME      :; SEITE:  |  |

## Nicht abgebildete Routinen ab 100 Bytes (nach Größe)

| Adresse | Größe | Seg | Aufrufer | random | Tabellen | Texte |
|---|---:|---|---:|---:|---|---|
| 0x34E6E | 8994 | 322b | 0x32AAE,0x334BC | 0 | manager | *.*; VERZEICHNIS: ; FILENAME      :; SEITE: ; .MAN; OH NEIN! |
| 0x334BC | 4024 | 322b | 0x971F,0xAD44 | 0 | club,manager,squad | Spielstand Laden; !!!; Spielstand.; Bundesliga Manager Prof.; Kein; >V2 |
| 0x2C55C | 3047 | 2a41 | 0x46DB,0x971F | 0 | manager,pairings,standing | Tabelle ;    ; SPIELTAG;      ;     ;        |
| 0x15346 | 3022 | 14a4 | 0x16515,0x22C15,0x251FF | 0 | manager,player | Info ]ber ; AHA !;  IST ;  JAHRE ALT, ; STATUS: ; IST F]R'S N[CHSTE SPIEL EINGEPLANT (NR. |
| 0x2B61A | 2830 | 2a41 | 0x5403,0x971F | 0 | club,manager,pairings | Spielplan; SPIELE  ;    ; SPIELTAG  ; NACHHOLSPIELE  ; MINUTE |
| 0x198EB | 2690 | 17c2 | 0x46DB,0x5403,0x971F,0x184BA | 0 | manager | Pokalspiele; Relegationsspiel; Relegation;     ; Minute; GEGEN |
| 0x1F37F | 2623 | 1ecd | 0xCB62,0x22C15,0x251FF | 0 | manager,player | TRANSFERMARKT; IHRE MANNSCHAFT; NR ; ART   ; NAME                    ; SP   |
| 0x32AAE | 2574 | 322b | 0x87FC,0x971F | 4 | manager | Spielstand Speichern; BLO~ NICHT !; ACH BITTE !; ]BERSCHREIBEN ?; BEREITS.; FILE EXISTIERT |
| 0x264A8 | 2279 | 262f | 0x5403,0x971F | 0 | club,manager,squad | Einstellungen; V2.0 - ENDE: ;  NIE.;  (LEVEL ; Halbzeitst{nde; Ergebnisse |
| 0x1A9AF | 2164 | 1a58 | 0x5403,0x632C,0x666D,0x1C4F5 | 0 | club,manager,pairings | (AUSW.) |
| 0x29BFE | 2080 | 262f | 0x971F | 0 | club,manager | Damals... Ihre Erfolge; Sais. Pl.   Liga       DfB-Pokal       Europapokal; Gesamtentwicklung; EXISTIERTEN SIE NOCH GAR NICHT ALS MANAGER...; SIEGER; SIEGER  |
| 0x21696 | 1962 | 1ecd | 0x20230,0x21696,0x251FF | 0 | squad |  |
| 0x1CF86 | 1904 | 1a58 | 0x1D6F6 | 3 | manager | Frohe Weihnachten !; BUNDESLIGA: ;  DM, 2.LIGA: ;  DM,; AMATEUR-OBERLIGA: ;  DM (INCL. MWST.) |
| 0x143ED | 1629 | 112a | 0x971F | 0 | manager,standing | Viel Gl}ck.; Relegationsspiel.; bestreitet das; Ihre Mannschaft; Winterpause.; Spieltag vor der |
| 0x30ED4 | 1367 | 3091 | 0x94B2,0x971F,0xCB62,0x30AA0 | 0 | manager | Keine Nachricht vorhanden. |
| 0x17F98 | 1314 | 17c2 | 0x18600,0x18FC2 | 0 | club |  |
| 0x34616 | 1278 | 322b | 0x971F,0x1D6F6,0x34616 | 0 | manager | PUNKTE:; (X/X/X) |
| 0x1243B | 1252 | 112a | 0x1291F | 0 | manager |  DM (; F[LLIG AM ; ZINSEN PRO MONAT: ;  DM |
| 0x1366B | 897 | 112a | 0x1291F | 0 | manager | Kontostand:;  DM; Gesamtschulden:; Zinsen/Monat: |
| 0x249E0 | 878 | 2277 | 0x251FF | 2 | manager,player,squad |  |
| 0x016E3 | 870 | 0000 | 0x602 | 0 |  |  |
| 0x22030 | 725 | 1ecd | 0x971F,0xAD44,0xDF0D,0xF6D8 | 0 | squad |  |
| 0x28841 | 718 | 262f | 0x28B0F,0x28C98,0x28ED8 | 0 | club,manager | VERTRAG: ;  JAHR;  MONAT; K}NDBAR;  DM |
| 0x31D7C | 694 | 3091 | 0x272D,0xA7DD,0x17B0F,0x22C15 | 0 | manager | An Alle: |
| 0x1A36D | 688 | 17c2 | 0x192FC,0x1D6F6 | 0 | manager | Deutsche Meisterschaft; gewinnt die; gewinnt den; ENDE |
| 0x2ED04 | 679 | 2a41 | 0x2ED04,0x2EFAB,0x2F15A | 1 |  |  |
| 0x314B5 | 661 | 3091 | 0x602,0x334BC | 0 | manager |  |
| 0x22995 | 640 | 2277 | 0x139EC | 0 |  |  |
| 0x05186 | 637 | 0310 | 0x4EEF,0x5403,0x1B223 | 0 | manager | Minute; ELFMETER |
| 0x161D8 | 611 | 14a4 | 0xF2A6,0x1643B | 2 | manager,player |  |
| 0x28C98 | 576 | 262f | 0x28ED8 | 0 |  |  |
| 0x2EA7F | 570 | 2a41 | 0x2DCA1,0x2EFAB,0x2F0D3 | 0 |  |  |
| 0x0F2A6 | 561 | 0cb5 | 0xCB62 | 1 | manager,player |  |
| 0x31B4D | 559 | 3091 | 0x0,0x28C4,0x15346,0x16515 | 0 |  |  |
| 0x284D1 | 515 | 262f | 0x26DE7,0x2A41E | 0 | standing |  |
| 0x04EEF | 504 | 0310 | 0x5403,0x632C,0x1060B,0x1A9AF | 0 |  |  |
| 0x08BC4 | 503 | 08bc | 0x8FD8 | 0 |  |  |
| 0x21E40 | 496 | 1ecd | 0x20230,0x21696 | 0 | manager,player,squad |  |
| 0x2C128 | 476 | 2a41 | 0x28C4,0x2B61A | 0 | pairings,standing | PLATZ, ST[RKE  |
| 0x3174A | 463 | 3091 | 0x5403,0xCB62,0x11D0D,0x1291F | 0 | manager | OKAY |
| 0x3074A | 454 | 2e3a | 0x46DB | 0 |  |  |
| 0x34B14 | 454 | 322b | 0x34CDA | 0 | manager,standing |  |
| 0x1A61D | 433 | 1a58 | 0x666D,0x1060B,0x1A9AF | 0 | manager |  |
| 0x213B6 | 433 | 1ecd | 0x20230,0x251FF | 0 | squad |  |
| 0x22305 | 419 | 1ecd | 0x22030 | 0 | player |  |
| 0x34474 | 418 | 322b | 0x1D6F6,0x34616 | 0 |  | HIGH.00 |
| 0x34CDA | 404 | 322b | 0x1D6F6,0x34616 | 0 | manager |  |
| 0x15F14 | 398 | 14a4 | 0x160A2 | 7 | player |  |
| 0x2119D | 395 | 1ecd | 0x20230,0x21696,0x22030 | 0 | player,squad |  |
| 0x3216C | 395 | 3091 | 0x20E1,0x11D0D,0x1704A | 0 |  | Diskettenzugriff !; Fehler beim; Achtung ! |
| 0x28B0F | 393 | 262f | 0x28ED8 | 0 | club | KEIN INTERESSE... |
| 0x0F125 | 385 | 0cb5 | 0x22030 | 0 | player |  |
| 0x094B2 | 369 | 08bc | 0x971F | 0 |  | alleine !; Spiele nicht; weiter !; Spiele automatisch |
| 0x305DE | 364 | 2e3a | 0x1B223 | 0 |  |  |
| 0x0272D | 360 | 0000 | 0x22C15 | 2 | manager |  DM AN ?; LIEBER NICHT.; ABER IMMER!; ZUSCHU~ VON; NEHMEN SIE EINEN SPONSOR- |
| 0x14E59 | 347 | 14a4 | 0x8FD8 | 0 |  | tore\anzahl |
| 0x0F58B | 333 | 0cb5 | 0xF2A6,0x1643B | 0 | club,manager |  |
| 0x30954 | 332 | 3091 | 0x20E1,0x239E,0xCB62,0xDF0D | 0 |  |  |
| 0x184BA | 326 | 14a4 | 0x17B0F,0x18600,0x18FC2 | 0 | manager | TASTE DR]CKEN |
| 0x26376 | 306 | 262f | 0x264A8 | 0 |  |  |
| 0x21567 | 303 | 1ecd | 0x21696 | 0 | manager,player | ST[RKE:;  JAHRE |
| 0x0AA56 | 302 | 08bc | 0xAD44 | 0 |  |  |
| 0x227F1 | 296 | 2277 | 0x139EC | 0 | manager |  |
| 0x2EFAB | 296 | 2a41 |  | 1 | manager |  |
| 0x0AC21 | 291 | 08bc | 0xAD44 | 0 |  |  |
| 0x0A89D | 278 | 08bc | 0xAD44 | 0 |  |  |
| 0x1FFFA | 267 | 1ecd |  | 0 | squad |  |
| 0x1A7CE | 258 | 1a58 | 0x1A9AF,0x1B223 | 0 |  |  |
| 0x322F7 | 248 | 322b | 0x32AAE | 0 |  |  |
| 0x0657F | 238 | 0310 | 0x5403,0x6414 | 0 |  |  |
| 0x160A2 | 236 | 14a4 | 0x5403 | 0 | manager,pairings |  |
| 0x2F15A | 233 | 2a41 |  | 0 |  |  |
| 0x1A8D0 | 223 | 1a58 | 0x1A9AF | 0 |  |  |
| 0x19810 | 219 | 17c2 | 0x198EB | 0 | manager |  GEGEN  |
| 0x2C483 | 217 | 2a41 | 0x2D143 | 0 | history |  |
| 0x2E9AA | 213 | 2a41 | 0x2EA7F | 0 |  |  |
| 0x08F0D | 203 | 08bc | 0x46DB,0x8FD8,0x971F,0x1D6F6 | 0 |  |  |
| 0x1FF36 | 196 | 1ecd |  | 0 | player,squad |  |
| 0x31A19 | 195 | 3091 | 0x4E45,0x5D9A,0x5FE5,0x971F | 0 | squad |  |
| 0x0A7DD | 192 | 08bc | 0x971F | 0 |  | KEIN GEDANKE; LEIDER JA; BEENDEN ?; DAS SPIEL WIRKLICH; M/CHTEN SIE |
| 0x10AF2 | 190 | 0f9d | 0x139EC | 0 |  |  |
| 0x0F4D7 | 180 | 0cb5 | 0xF2A6,0x1643B | 6 | manager |  |
| 0x04D22 | 177 | 0310 | 0x1EB17,0x21567,0x22C15 | 0 | player,squad |  |
| 0x04E45 | 170 | 0310 | 0x5FE5 | 3 |  |  |
| 0x112AA | 170 | 112a | 0xAD44,0x11D0D | 1 | club |  |
| 0x286D4 | 166 | 262f | 0x28ED8 | 0 |  |  |
| 0x320C7 | 165 | 3091 | 0xCB62 | 0 |  |  |
| 0x050E7 | 159 | 0310 | 0x40B6,0x5186,0x971F,0xCB62 | 0 | manager |  |
| 0x0AB84 | 157 | 08bc | 0xAD44 | 0 |  |  |
| 0x20197 | 153 | 1ecd | 0x20230,0x21696 | 0 |  | ist deaktiviert !; Auto-Aufstellung |
| 0x32032 | 149 | 3091 | 0x602,0x971F,0x113E5,0x1291F | 0 |  |  |
| 0x20105 | 146 | 1ecd | 0x20230 | 0 |  |  |
| 0x30E42 | 146 | 3091 | 0x87FC,0x334BC | 0 |  |  |
| 0x11354 | 145 | 112a | 0xCB62,0x224A8 | 0 | player,squad |  |
| 0x323EF | 145 | 322b | 0x334BC | 0 |  |  |
| 0x21328 | 142 | 1ecd | 0x20230,0x21696 | 0 | squad |  |
| 0x3142B | 138 | 3091 | 0x314B5 | 0 | manager |  |
| 0x2C3FC | 135 | 2a41 | 0x2D143 | 1 | club |  |
| 0x2F0D3 | 135 | 2a41 | 0x2EFAB | 0 |  |  |
| 0x0632C | 133 | 0310 | 0x5FE5,0x666D,0x1060B | 0 |  |  |
| 0x0A9B3 | 130 | 08bc | 0xAD44 | 0 |  |  |
| 0x262F4 | 130 | 262f | 0xAD44,0x264A8 | 0 |  |  |
| 0x14FB4 | 120 | 14a4 | 0x1502C | 0 |  | Spiel austauschen !; Bitte nach diesem; ist offenbar defekt.; Ihre Torszenen-Diskette |
| 0x3196D | 120 | 3091 | 0xCB62,0x113E5,0x15346,0x19810 | 0 |  |  |
| 0x04044 | 114 | 0310 | 0x3C24 | 0 | history |  |
| 0x31ADC | 113 | 3091 | 0x0,0x28C4,0x15346,0x16515 | 0 |  |  |
| 0x032F2 | 111 | 0310 | 0x3361,0x3390,0x33BF,0x38A2 | 0 |  |  |
| 0x1FEC9 | 109 | 1ecd | 0x1FF36 | 0 | squad |  |
| 0x287DD | 100 | 262f | 0x28C98 | 0 |  |  |
| 0x2877A | 99 | 262f | 0x28C98,0x28ED8 | 0 |  |  |
| 0x1C5D1 | 97 | 1a58 | 0x1C632 | 0 | manager | 200.000 DM Strafe; gewertet. Sie zahlen; Ihr Spiel wird mit 0:2 |
| 0x08EAF | 94 | 08bc | 0x46DB,0x971F,0x1D6F6 | 0 |  | KEINE BEMERKENSWERTE SERIE VORHANDEN. |
| 0x26D8F | 88 | 262f | 0x15346,0x26DE7 | 0 | manager |  |
| 0x3058F | 79 | 2a41 | 0x2F243 | 2 |  |  |
| 0x2ECB9 | 75 | 2a41 | 0x2EA7F | 0 |  |  |
| 0x1618E | 74 | 14a4 | 0x161D8 | 1 |  |  |
| 0x14A4A | 73 | 14a4 | 0xF749 | 0 |  |  |
| 0x30910 | 68 | 3091 | 0x239E,0xDF0D | 0 |  |  |
| 0x03BE8 | 60 | 0310 | 0x3C24 | 0 |  |  |
| 0x2C3C0 | 60 | 2a41 | 0x2D143 | 0 |  |  |
