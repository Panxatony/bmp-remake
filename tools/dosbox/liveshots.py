#!/usr/bin/env python3
"""liveshots.py NAME OUTDIR SEKUNDEN - Spielstand laden, Tag starten und die Live-Konferenz
in Bildern festhalten (alle 0,4 s), ohne die Optionen zu verstellen (Torszenen bleiben an)."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive
name, out, secs = sys.argv[1], sys.argv[2], int(sys.argv[3])
os.makedirs(out, exist_ok=True)
if not drive.load(name):
    print("Laden unklar")
n = 0
t0 = None
for step in range(2000):
    im = drive.screen()
    st = drive.probe(im)
    if st == "menu-panel":
        drive.dismiss_panel(); time.sleep(0.8); continue
    if st == "menu" and t0 is None:
        drive.click(270, 75); time.sleep(2.5); continue
    if t0 is None and st in ("live", "other", "optionen", "dialog"):
        t0 = time.time()
    if t0 is not None:
        im.save(os.path.join(out, "%04d-%s.png" % (n, st))); n += 1
        if time.time() - t0 > secs: break
        time.sleep(0.4)
        continue
    time.sleep(1)
print("Bilder:", n)
