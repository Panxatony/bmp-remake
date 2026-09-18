#!/bin/bash
# Screenshot des DOSBox-Fensters: shot.sh DATEI.png
export DISPLAY=:99
W=$(xdotool search --name DOSBox | head -1)
[ -n "$W" ] && xdotool windowactivate "$W" 2>/dev/null
scrot -o "$1"
