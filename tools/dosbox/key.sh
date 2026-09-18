#!/bin/bash
# Tasten oder Mausklick an DOSBox senden (Xvfb :99).
#   key.sh key Return          key.sh type "TEXT"
#   key.sh click X Y           X,Y in Spielkoordinaten (320x240); DOSBox: relative Maus, Faktor 0,5
export DISPLAY=:99
W=$(xdotool search --name DOSBox | head -1)
xdotool windowactivate --sync "$W" 2>/dev/null
mv() { for i in $(seq 1 $3); do xdotool mousemove_relative -- $1 $2; sleep 0.015; done; }
case "$1" in
  key) xdotool key --window "$W" "$2" ;;
  type) xdotool type --window "$W" --delay 60 "$2" ;;
  grab) xdotool mousemove 352 304 click 1 ;;
  park) mv -40 -40 40; mv 0 20 24 ;;         # Zeiger nach links unten, weg vom Kalender
  move)
    mv -40 -40 40                       # Zeiger in die linke obere Ecke drücken
    X=$(( $2 * 2 )); Y=$(( $3 * 2 ))
    mv 20 0 $((X / 20)); mv $((X % 20)) 0 1
    mv 0 20 $((Y / 20)); mv 0 $((Y % 20)) 1 ;;
  click|rclick)
    mv -40 -40 40                       # Zeiger in die linke obere Ecke drücken
    X=$(( $2 * 2 )); Y=$(( $3 * 2 ))
    mv 20 0 $((X / 20)); mv $((X % 20)) 0 1
    mv 0 20 $((Y / 20)); mv 0 $((Y % 20)) 1
    sleep 0.2
    [ "$1" = rclick ] && xdotool click 3 || xdotool click 1 ;;
esac
