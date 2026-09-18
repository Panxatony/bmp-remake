#!/usr/bin/env python3
"""
Zwei Bilder des Spielbildschirms (320x240) Punkt für Punkt vergleichen (GitLab #56).

    tools/bildvergleich.py ORIGINAL.png REMAKE.png [x0,y0,x1,y1 ...]

Das erste Bild kommt aus DOSBox (Ausschnitt 192,184 bis 512,424 der Aufnahme von
tools/dosbox/shot.sh), das zweite aus dem Browser (canvas.toDataURL). Weitere Angaben sind
Rechtecke, die außen vor bleiben - etwa die Ecke, in der der Mauszeiger des Originals parkt.

Ausgegeben werden die Zahl der abweichenden Punkte und die größten zusammenhängenden Klumpen;
daneben entsteht ORIGINAL-diff.png mit beiden Bildern übereinander und den Abweichungen in
Magenta.
"""
import sys
from PIL import Image

def gruppen(diff):
    """Benachbarte Abweichungen zu Klumpen zusammenfassen."""
    rest = set(diff); aus = []
    while rest:
        start = rest.pop(); klumpen = [start]; rand = [start]
        while rand:
            x, y = rand.pop()
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    p = (x + dx, y + dy)
                    if p in rest:
                        rest.discard(p); klumpen.append(p); rand.append(p)
        xs = [p[0] for p in klumpen]; ys = [p[1] for p in klumpen]
        aus.append((len(klumpen), min(xs), min(ys), max(xs), max(ys)))
    return sorted(aus, reverse=True)

a = Image.open(sys.argv[1]).convert('RGB')
b = Image.open(sys.argv[2]).convert('RGB')
maske = [tuple(int(v) for v in m.split(',')) for m in sys.argv[3:]]
diff = []
for y in range(240):
    for x in range(320):
        if a.getpixel((x, y)) == b.getpixel((x, y)): continue
        if any(mx <= x <= mx2 and my <= y <= my2 for mx, my, mx2, my2 in maske): continue
        diff.append((x, y))
print("abweichende Punkte:", len(diff), "von 76800")
for n, x0, y0, x1, y1 in gruppen(diff)[:15]:
    print(f"  {n:5d} Punkte  x {x0}..{x1}  y {y0}..{y1}")
if diff:
    out = Image.new('RGB', (320, 240 * 2 + 4), (255, 0, 0))
    out.paste(a, (0, 0)); out.paste(b, (0, 244))
    for x, y in diff:
        out.putpixel((x, y), (255, 0, 255))
    out.resize((640, (240 * 2 + 4) * 2), Image.NEAREST).save(sys.argv[1].rsplit('.', 1)[0] + '-diff.png')
