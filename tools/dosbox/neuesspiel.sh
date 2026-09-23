#!/bin/bash
# neuesspiel.sh NAME [VEREINSKLICKS] - im Original (BMP_CONF) ein neues Spiel mit einem Manager
# "TEST" anlegen und als NAME speichern. Ablauf (von lhuno bestätigt): Name eintippen, Wappen
# anklicken (dreht die Leiste), Platz anklicken, rechte Maustaste = Optionen, rechte Maustaste =
# Start; Auslosungsfragen mit KEIN GEDANKE, Nachrichtentafel schließen, speichern.
cd "$(dirname "$0")"
K="env DISPLAY=:99 ./key.sh"
./start.sh bmmain >/dev/null; sleep 7
$K grab; sleep 0.5
$K click 40 229; sleep 1; $K type "TEST"; sleep 0.5; $K key Return; sleep 1
for i in $(seq 1 "${2:-1}"); do $K click 160 63; sleep 1; done
$K click 40 130; sleep 1.5
$K rclick 160 120; sleep 3; $K rclick 160 120; sleep 4
for i in 1 2 3 4 5 6; do $K click 205 166; sleep 3; done
$K click 253 172; sleep 1.5
$K click 290 175; sleep 2; $K click 110 175; sleep 2; $K click 100 178; sleep 0.5
$K type "$1"; sleep 0.5; $K key Return; sleep 3
pkill -x dosbox; pkill -x Xvfb
