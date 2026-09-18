/*
 * cmf2wav - rendert eine Creative Music File (CMF) mit einem OPL2/3-Emulator in eine WAV-Datei.
 *
 * OPL-Emulation: Nuked-OPL3 (opl3.c/opl3.h, MIT).
 * Abspiel-Logik portiert aus AdPlug (src/cmf.cpp, GPL-2+, Malvineous u.a.) samt der dort aus
 * Creatives SBFMDRV uebernommenen Frequenztabellen. Reines Werkzeug, nicht Teil des Spiels.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "opl3.h"
#include "tables.h"

#define BASE_CHAR_MULT  0x20
#define BASE_SCAL_LEVL  0x40
#define BASE_ATCK_DCAY  0x60
#define BASE_SUST_RLSE  0x80
#define BASE_FNUM_L     0xA0
#define BASE_KEYON_FREQ 0xB0
#define BASE_RHYTHM     0xBD
#define BASE_WAVE       0xE0
#define BASE_FEED_CONN  0xC0
#define OPLBIT_KEYON    0x20
#define OPLOFFSET(c)    (((c)/3)*8 + ((c)%3))

typedef struct { uint8_t charMult, scal, atk, sus, wave; } op_t;
typedef struct { op_t op[2]; uint8_t conn; } sbi_t;

static opl3_chip chip;
static uint8_t regs[256];
static sbi_t inst[256];
static int instCount;
static uint8_t *data; static long songLen; static long pp;
static int percussive;
static struct { int noteStart, midiNote, midiChannel, patch; } chOPL[9];
static struct { int patch, pitchbend, transpose; } chMIDI[16];
static int noteCount;
static uint8_t notePlaying[16]; static int noteFix[16];

static void wr(uint8_t r, uint8_t v) { OPL3_WriteRegBuffered(&chip, r, v); regs[r] = v; }

static uint32_t readNum(void) {
  uint32_t v = 0;
  for (int i = 0; i < 4; i++) { uint8_t n = pp < songLen ? data[pp++] : 0; v = (v << 7) | (n & 0x7f); if (!(n & 0x80)) break; }
  return v;
}

static void getFreq(int ch, int note, uint8_t *block, uint16_t *fnum) {
  if (note < 0) note = 0; if (note > 127) note = 127;
  uint8_t bn = block_note_tbl[note];
  int blk = (bn & 0x70) >> 4;
  int idx = (bn & 0x0f) << 6;
  idx += chMIDI[ch].transpose / 4;
  idx += (chMIDI[ch].pitchbend - 8192) / 128;
  if (idx < 0) { idx += 768; blk--; if (blk < 0) { idx = 0; blk = 0; } }
  if (idx >= 768) { idx -= 768; blk++; if (blk > 7) { idx = 767; blk = 7; } }
  *block = (uint8_t)blk; *fnum = fnum_tbl[idx];
}

static void writeInstr(int ch, int src, int dst, int i) {
  uint8_t o = OPLOFFSET(ch); if (dst) o += 3;
  wr(BASE_CHAR_MULT + o, inst[i].op[src].charMult);
  wr(BASE_SCAL_LEVL + o, inst[i].op[src].scal);
  wr(BASE_ATCK_DCAY + o, inst[i].op[src].atk);
  wr(BASE_SUST_RLSE + o, inst[i].op[src].sus);
  wr(BASE_WAVE + o, inst[i].op[src].wave);
  wr(BASE_FEED_CONN + ch, inst[i].conn);
}

static int percChannel(int ch) {
  switch (ch) { case 11: return 6; case 12: return 7; case 13: return 8; case 14: return 8; case 15: return 7; }
  return 0;
}

static void changeInstrument(int oplCh, int midiCh, int n) {
  if (midiCh > 10 && percussive) {
    switch (midiCh) {
      case 11: writeInstr(6, 0, 0, n); writeInstr(6, 1, 1, n); break;
      case 12: writeInstr(7, 0, 1, n); break;
      case 13: writeInstr(8, 0, 0, n); break;
      case 14: writeInstr(8, 0, 1, n); break;
      case 15: writeInstr(7, 0, 0, n); break;
    }
    chOPL[oplCh].patch = n;
  } else {
    writeInstr(oplCh, 0, 0, n); writeInstr(oplCh, 1, 1, n); chOPL[oplCh].patch = n;
  }
}

static void resetMelodic(void) {
  wr(0x08, 0x00);
  for (int i = 0; i < 9; i++) {
    uint8_t o = OPLOFFSET(i);
    wr(BASE_CHAR_MULT + o, cInitInstrument[0]);  wr(BASE_CHAR_MULT + o + 3, cInitInstrument[1]);
    wr(BASE_SCAL_LEVL + o, cInitInstrument[2]);  wr(BASE_SCAL_LEVL + o + 3, cInitInstrument[3]);
    wr(BASE_ATCK_DCAY + o, cInitInstrument[4]);  wr(BASE_ATCK_DCAY + o + 3, cInitInstrument[5]);
    wr(BASE_SUST_RLSE + o, cInitInstrument[6]);  wr(BASE_SUST_RLSE + o + 3, cInitInstrument[7]);
    wr(BASE_WAVE + o, cInitInstrument[8]);       wr(BASE_WAVE + o + 3, cInitInstrument[9]);
    wr(BASE_FEED_CONN + i, cInitInstrument[10]);
  }
}

static void rhythmModeReset(int perc) {
  percussive = perc;
  resetMelodic();
  for (int i = 0; i < 9; i++) { chOPL[i].noteStart = 0; chOPL[i].midiNote = -1; chOPL[i].midiChannel = -1; chOPL[i].patch = -1; }
  for (int i = 0; i < 16; i++) chMIDI[i].patch = 0;
  wr(BASE_RHYTHM, perc ? 0xE0 : 0xC0);
}

static void noteOn(int ch, int note, int vel) {
  uint8_t block = 0; uint16_t fnum = 0;
  getFreq(ch, note, &block, &fnum);
  if (ch > 10 && percussive) {
    int pc = percChannel(ch);
    changeInstrument(pc, ch, chMIDI[ch].patch);
    uint8_t cs = inst[chMIDI[ch].patch].op[1].scal;
    uint8_t base = 63 - (cs & 0x3f), ksl = cs & 0xc0;
    uint8_t lvl = (63 - (((vel | 0x80) * base) >> 8)) | ksl;
    int o = BASE_SCAL_LEVL + OPLOFFSET(pc); if (ch == 11) o += 3;
    wr(o, lvl);
    wr(BASE_FNUM_L + pc, fnum & 0xff);
    wr(BASE_KEYON_FREQ + pc, (block << 2) | ((fnum >> 8) & 3));
    uint8_t bit = 1 << (15 - ch);
    if (regs[BASE_RHYTHM] & bit) wr(BASE_RHYTHM, regs[BASE_RHYTHM] & ~bit);
    wr(BASE_RHYTHM, regs[BASE_RHYTHM] | bit);
    chOPL[pc].noteStart = ++noteCount; chOPL[pc].midiChannel = ch; chOPL[pc].midiNote = note;
    return;
  }
  int n = percussive ? 6 : 9, c = -1;
  for (int i = 0; i < n && c < 0; i++) if (!chOPL[i].noteStart && chOPL[i].midiChannel == ch) c = i;
  for (int i = 0; i < n && c < 0; i++) if (chOPL[i].midiChannel == -1) c = i;
  for (int i = 0; i < n && c < 0; i++) if (!chOPL[i].noteStart) c = i;
  if (c < 0) {
    c = 0; int e = chOPL[0].noteStart;
    for (int i = 1; i < n; i++) if (chOPL[i].noteStart < e) { c = i; e = chOPL[i].noteStart; }
    wr(BASE_KEYON_FREQ + c, regs[BASE_KEYON_FREQ + c] & ~OPLBIT_KEYON);
  }
  if (chOPL[c].midiChannel != ch) changeInstrument(c, ch, chMIDI[ch].patch);
  chOPL[c].noteStart = ++noteCount; chOPL[c].midiChannel = ch; chOPL[c].midiNote = note;
  uint8_t cs = inst[chMIDI[ch].patch].op[1].scal;
  uint8_t base = 63 - (cs & 0x3f), ksl = cs & 0xc0;
  uint8_t lvl = (63 - (((vel | 0x80) * base) >> 8)) | ksl;
  wr(BASE_SCAL_LEVL + OPLOFFSET(c) + 3, lvl);
  wr(BASE_FNUM_L + c, fnum & 0xff);
  wr(BASE_KEYON_FREQ + c, OPLBIT_KEYON | (block << 2) | ((fnum & 0x300) >> 8));
}

static void noteOff(int ch, int note) {
  if (ch > 10 && percussive) {
    int pc = percChannel(ch);
    if (chOPL[pc].midiNote != note) return;
    wr(BASE_RHYTHM, regs[BASE_RHYTHM] & ~(1 << (15 - ch)));
    chOPL[pc].noteStart = 0;
    return;
  }
  int n = percussive ? 6 : 9;
  for (int i = 0; i < n; i++)
    if (chOPL[i].midiChannel == ch && chOPL[i].midiNote == note && chOPL[i].noteStart) {
      chOPL[i].noteStart = 0;
      wr(BASE_KEYON_FREQ + i, regs[BASE_KEYON_FREQ + i] & ~OPLBIT_KEYON);
    }
}

static void noteUpdate(int ch) {
  uint8_t block = 0; uint16_t fnum = 0;
  if (ch > 10 && percussive) {
    int pc = percChannel(ch);
    getFreq(ch, chOPL[pc].midiNote, &block, &fnum);
    wr(BASE_FNUM_L + pc, fnum & 0xff);
    wr(BASE_KEYON_FREQ + pc, (block << 2) | ((fnum >> 8) & 3));
    return;
  }
  int n = percussive ? 6 : 9;
  for (int i = 0; i < n; i++)
    if (chOPL[i].midiChannel == ch && chOPL[i].noteStart > 0) {
      getFreq(ch, chOPL[i].midiNote, &block, &fnum);
      wr(BASE_FNUM_L + i, fnum & 0xff);
      wr(BASE_KEYON_FREQ + i, OPLBIT_KEYON | (block << 2) | ((fnum & 0x300) >> 8));
    }
}

static void controller(int ch, int c, int v) {
  switch (c) {
    case 0x63: wr(BASE_RHYTHM, v ? ((regs[BASE_RHYTHM] & ~0xc0) | (v << 6)) : (regs[BASE_RHYTHM] & ~0xc0)); break;
    case 0x67: rhythmModeReset(v != 0); break;
    case 0x68: chMIDI[ch].transpose = v; noteUpdate(ch); break;
    case 0x69: chMIDI[ch].transpose = -v; noteUpdate(ch); break;
    default: break;
  }
}

/* Ein Event abarbeiten; liefert die Ticks bis zum naechsten Event, -1 am Songende. */
static int songEnd;
static long step(void) {
  static uint8_t prev = 0;
  uint8_t cmd = pp < songLen ? data[pp++] : 0;
  if (!(cmd & 0x80)) { pp--; cmd = prev; } else prev = cmd;
  int ch = cmd & 0x0f;
  switch (cmd & 0xf0) {
    case 0x80: { int n = data[pp++]; pp++; noteOff(ch, n); break; }
    case 0x90: {
      int n = data[pp++], v = data[pp++];
      if (v) { if (notePlaying[ch] == n) { v = 0; noteFix[ch] = 1; } }
      else if (noteFix[ch]) { v = 127; noteFix[ch] = 0; }
      notePlaying[ch] = v ? n : 255;
      if (v) noteOn(ch, n, v); else noteOff(ch, n);
      break;
    }
    case 0xa0: pp += 2; break;
    case 0xb0: { int c = data[pp++], v = data[pp++]; controller(ch, c, v); break; }
    case 0xc0: {
      int p = data[pp++];
      p = instCount > 0 ? p % instCount : 0;
      chMIDI[ch].patch = p;
      if (!percussive || ch < 11) {
        int n = percussive ? 6 : 9;
        for (int i = 0; i < n; i++) if (!chOPL[i].noteStart && chOPL[i].midiChannel == ch) chOPL[i].midiChannel = -1;
        for (int i = 0; i < n; i++) if (chOPL[i].noteStart > 0 && chOPL[i].midiChannel == ch) changeInstrument(i, ch, p);
      } else changeInstrument(percChannel(ch), ch, p);
      break;
    }
    case 0xd0: pp++; break;
    case 0xe0: { int lsb = data[pp++], msb = data[pp++]; chMIDI[ch].pitchbend = (msb << 7) | lsb; noteUpdate(ch); break; }
    case 0xf0:
      if (cmd == 0xf0 || cmd == 0xf7) { uint32_t l = readNum(); pp += l; }
      else if (cmd == 0xff) { uint8_t e = data[pp++]; uint32_t l = readNum(); if (e == 0x2f) songEnd = 1; else pp += l; }
      else if (cmd == 0xfc) songEnd = 1;
      else if (cmd == 0xf1 || cmd == 0xf3) pp++;
      else if (cmd == 0xf2) pp += 2;
      break;
    default: break;
  }
  if (pp >= songLen) songEnd = 1;
  return songEnd ? -1 : (long)readNum();
}

int main(int argc, char **argv) {
  if (argc < 3) { fprintf(stderr, "cmf2wav <in.cmf> <out.wav> [extra-seconds]\n"); return 1; }
  double tail = argc > 3 ? atof(argv[3]) : 2.0;
  FILE *f = fopen(argv[1], "rb");
  if (!f) { perror(argv[1]); return 1; }
  fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
  uint8_t *buf = malloc(len); if (fread(buf, 1, len, f) != (size_t)len) return 1; fclose(f);
  if (memcmp(buf, "CTMF", 4)) { fprintf(stderr, "keine CMF-Datei\n"); return 1; }
  int ver = buf[4] | (buf[5] << 8);
  int instOff = buf[6] | (buf[7] << 8), musOff = buf[8] | (buf[9] << 8);
  int ticksPerSec = buf[12] | (buf[13] << 8);
  instCount = ver == 0x0100 ? buf[36] : (buf[36] | (buf[37] << 8));
  if (instCount <= 0 || instCount > 256) instCount = 128;
  for (int i = 0; i < instCount; i++) {
    uint8_t *p = buf + instOff + 16 * i;
    inst[i].op[0].charMult = p[0]; inst[i].op[1].charMult = p[1];
    inst[i].op[0].scal = p[2];     inst[i].op[1].scal = p[3];
    inst[i].op[0].atk = p[4];      inst[i].op[1].atk = p[5];
    inst[i].op[0].sus = p[6];      inst[i].op[1].sus = p[7];
    inst[i].op[0].wave = p[8];     inst[i].op[1].wave = p[9];
    inst[i].conn = p[10];
  }
  data = buf + musOff; songLen = len - musOff;
  if (ticksPerSec <= 0) ticksPerSec = 96;

  const int rate = 49716; /* native OPL-Rate, wird spaeter mit ffmpeg resampelt */
  OPL3_Reset(&chip, rate);
  memset(regs, 0, sizeof regs);
  wr(0x01, 0x20); wr(0x05, 0x00); wr(0x08, 0x00);
  resetMelodic();
  wr(0xBD, 0xC0);
  for (int i = 0; i < 9; i++) { chOPL[i].noteStart = 0; chOPL[i].midiNote = -1; chOPL[i].midiChannel = -1; chOPL[i].patch = -1; }
  for (int i = 0; i < 16; i++) { chMIDI[i].patch = 0; chMIDI[i].pitchbend = 8192; chMIDI[i].transpose = 0; }
  memset(notePlaying, 255, sizeof notePlaying);
  memset(noteFix, 0, sizeof noteFix);
  pp = 0;

  long cap = 0, used = 0;
  int16_t *pcm = NULL;
  double carry = 0;
  long delay = (long)readNum();
  for (;;) {
    double secs = (double)delay / ticksPerSec;
    double fs = secs * rate + carry;
    long ns = (long)fs; carry = fs - ns;
    if (used + 2 * ns + 16 > cap) { cap = (used + 2 * ns + 16) * 2; pcm = realloc(pcm, cap * sizeof(int16_t)); }
    if (ns > 0) { OPL3_GenerateStream(&chip, pcm + used, (uint32_t)ns); used += 2 * ns; }
    delay = step();
    if (delay < 0) break;
    if (used > (long)rate * 2 * 600) break; /* Sicherheitsnetz: 10 Minuten */
  }
  long ns = (long)(tail * rate);
  pcm = realloc(pcm, (used + 2 * ns + 16) * sizeof(int16_t));
  OPL3_GenerateStream(&chip, pcm + used, (uint32_t)ns); used += 2 * ns;

  FILE *o = fopen(argv[2], "wb");
  long bytes = used * 2;
  uint32_t v; uint16_t w;
  fwrite("RIFF", 1, 4, o); v = 36 + bytes; fwrite(&v, 4, 1, o); fwrite("WAVEfmt ", 1, 8, o);
  v = 16; fwrite(&v, 4, 1, o); w = 1; fwrite(&w, 2, 1, o); w = 2; fwrite(&w, 2, 1, o);
  v = rate; fwrite(&v, 4, 1, o); v = rate * 4; fwrite(&v, 4, 1, o); w = 4; fwrite(&w, 2, 1, o); w = 16; fwrite(&w, 2, 1, o);
  fwrite("data", 1, 4, o); v = bytes; fwrite(&v, 4, 1, o);
  fwrite(pcm, 1, bytes, o); fclose(o);
  fprintf(stderr, "%s: %d Instrumente, %d Ticks/s, %.2f s\n", argv[1], instCount, ticksPerSec, (double)(used / 2) / rate);
  return 0;
}
