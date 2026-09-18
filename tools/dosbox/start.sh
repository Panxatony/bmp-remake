#!/bin/bash
# Startet Xvfb :99 und DOSBox mit dem Spiel (Arbeitskopie bmp-work).
#   start.sh [DOS-Befehl]   z.B. start.sh bmmain
export DISPLAY=:99
pkill -x Xvfb 2>/dev/null; pkill -x dosbox 2>/dev/null; sleep 0.5
Xvfb :99 -screen 0 1024x768x24 >/dev/null 2>&1 &
sleep 1
cd "$(dirname "$0")"
dosbox -conf "${BMP_CONF:-bmp.conf}" -c "${1:-bmmain}" >/dev/null 2>&1 &
sleep 4
xdotool search --name DOSBox | head -1
