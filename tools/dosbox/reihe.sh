#!/bin/bash
# reihe.sh SPIELSTAND ANZAHL PREFIX - Zuschauermessung mehrfach, danach ein Sammelbild.
set -e
NAME=$1; N=$2; PRE=$3
for i in $(seq 1 "$N"); do
  timeout 400 python3 mess.py "$NAME" "${PRE}-$i.png" || echo "Lauf $i fehlgeschlagen"
  sleep 1
done
python3 - "$PRE" "$N" <<'PY'
import sys
from PIL import Image
pre, n = sys.argv[1], int(sys.argv[2])
bilder = []
for i in range(1, n + 1):
    try: bilder.append(Image.open("%s-%d.png" % (pre, i)))
    except OSError: pass
if bilder:
    b = max(x.width for x in bilder)
    zus = Image.new("RGB", (b, sum(x.height for x in bilder)))
    y = 0
    for x in bilder:
        zus.paste(x, (0, y)); y += x.height
    zus.save(pre + "-alle.png")
    print("Sammelbild:", pre + "-alle.png", zus.size)
PY
