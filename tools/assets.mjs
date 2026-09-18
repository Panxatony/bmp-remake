/**
 * assets.mjs - erzeugt alle Spieldateien aus einer eigenen Installation des Originals.
 *
 *     npm run assets -- /pfad/zur/bmp
 *
 * Erwartet wird der Ordner mit BMMAIN.EXE, BMLOADER.EXE, MANA.DAT, PIC/, TORE/ und SOUND/.
 * Nichts davon liegt im Repo: Bilder, Schriften, Klänge, Titelmusik, Torszenen und die Texte
 * des Spiels entstehen erst hier, in `assets/`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const wurzel = resolve(import.meta.dirname, "..");
const quelle = resolve(process.argv[2] ?? process.env.BMP_DIR ?? join(wurzel, "..", "bmp"));
const assets = join(wurzel, "assets");

const noetig = ["BMMAIN.EXE", "BMLOADER.EXE", "PIC", "TORE", "SOUND"];
const fehlt = noetig.filter((f) => !existsSync(join(quelle, f)));
if (fehlt.length) {
  console.error(`In ${quelle} fehlen: ${fehlt.join(", ")}`);
  console.error("Aufruf: npm run assets -- /pfad/zur/installation");
  process.exit(1);
}

const py = (...args) => execFileSync("python3", args, { cwd: wurzel, stdio: ["ignore", "inherit", "inherit"] });
const schritt = (name) => console.log(`\n== ${name}`);

schritt("Bilder aus PIC/");
mkdirSync(join(assets, "pic"), { recursive: true });
py("tools/vga.py", "--all", join(quelle, "PIC"), join(assets, "pic"));

schritt("Schriften aus BMLOADER.EXE und BMMAIN.EXE");
const tmp = mkdtempSync(join(tmpdir(), "bmp-"));
py("tools/unexepack.py", join(quelle, "BMMAIN.EXE"), join(tmp, "bmmain"));
py("tools/fonts.py", join(quelle, "BMLOADER.EXE"), join(assets, "font"), join(tmp, "bmmain.bin"));

schritt("Texte aus BMMAIN.EXE");
py("tools/texte.py", join(quelle, "BMMAIN.EXE"));

schritt("Klänge aus SOUND/DIGI.VOC");
py("tools/digi.py", quelle);

schritt("Torszenen aus TORE/");
py("tools/tore.py", quelle);

schritt("Titelmusik aus SOUND/BM2TITLE.CMF");
try {
  execFileSync("gcc", ["-O2", "-o", join(tmp, "cmf2wav"), "tools/cmf/cmf2wav.c", "tools/cmf/opl3.c", "-lm"], { cwd: wurzel, stdio: "inherit" });
  execFileSync(join(tmp, "cmf2wav"), [join(quelle, "SOUND", "BM2TITLE.CMF"), join(tmp, "titel.wav")], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", join(tmp, "titel.wav"), "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k", join(assets, "sound", "titel.mp3")], { stdio: "inherit" });
  console.log("titel.mp3 geschrieben");
} catch {
  console.warn("Titelmusik übersprungen (gcc und ffmpeg werden dafür gebraucht) - das Spiel läuft auch ohne.");
}

// Stand festhalten: wann erzeugt und mit welchem Stand der Werkzeuge. Der Server vergleicht das
// beim Start und warnt, wenn die Werkzeuge seither geändert wurden - sonst laufen alte Bilder
// weiter (so war monatelang die bunte statt der grauen Zeitungspalette im Einsatz).
const werkzeugstand = Math.max(
  ...readdirSync(join(wurzel, "tools"))
    .filter((f) => f.endsWith(".py") || f.endsWith(".mjs"))
    .map((f) => statSync(join(wurzel, "tools", f)).mtimeMs),
);
writeFileSync(join(assets, "stand.json"), JSON.stringify({ erzeugt: new Date().toISOString(), quelle, werkzeuge: Math.round(werkzeugstand) }, null, 2) + "\n");

console.log("\nFertig. Die Spieldateien liegen in assets/ und bleiben dort (sie gehören nicht ins Repo).");
