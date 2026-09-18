# CMF nach WAV

Wandelt die Titelmusik `SOUND/BM2TITLE.CMF` des Originals in Ton um.

    gcc -O2 -o cmf2wav cmf2wav.c opl3.c -lm
    ./cmf2wav ../../../bmp/SOUND/BM2TITLE.CMF titel.wav
    ffmpeg -y -i titel.wav -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k ../../assets/sound/titel.mp3

`opl3.c`/`opl3.h` ist Nuked-OPL3 (MIT). Die Abspiellogik in `cmf2wav.c` und die Tabellen in
`tables.h` sind aus AdPlug (`src/cmf.cpp`, GPL-2+) portiert, das sie seinerseits aus Creatives
SBFMDRV übernommen hat. Das Werkzeug läuft nur hier, das Spiel selbst bindet nichts davon ein.

Lizenzen: Nuked-OPL3 (MIT) und der aus AdPlug portierte Teil (GPL-2.0-or-later) sind in
`../../LICENSE` unter "Ausnahmen und fremde Bestandteile" beschrieben.
