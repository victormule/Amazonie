/* ===================== CONFIG ===================== */

/* Police Dafont (mets le fichier dans /fonts) */
const FONT_REGULAR_PATH = 'fonts/HighVoltage Rough.ttf';   // assure-toi que ce chemin existe dans le repo
// const FONT_ITALIC_PATH  = 'fonts/dubellit.ttf'; // optionnel si tu veux un style hover italic

/* Animation */
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZàâäçéèêëîïôöùûüáíóúãõñ -";
const INTERVAL_BETWEEN_WORDS = 600;
const PER_CHAR_MIN = 6;
const PER_CHAR_MAX = 14;
const FPS = 60;

/* Bandes VERTICALES (sur le texte) — discrètes, desktop only */
const VSTRIPE_COUNT_MIN   = 1;
const VSTRIPE_COUNT_MAX   = 3;
const VSTRIPE_WIDTH_MIN   = 2;   // px
const VSTRIPE_WIDTH_MAX   = 6;   // px
const VSTRIPE_OFFSET_MAX  = 10;  // px

/* Couleur de référence (orange “Memoria & Alma”) */
const BASE_ORANGE = '#e39220';

/* Hover */
const HOVER_WORD = "AMAZONAS";
const HOVER_GLITCH_BOOST = 1.35; // glitch un peu plus fort en hover
const HOVER_ITALIC = false;      // si tu ajoutes dubellit.ttf, tu peux passer à true

/* Padding (hauteur du canvas) */
const PAD_X = 16; // px
const PAD_Y = 26; // px

/* Optimisations Mobile */
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const LITE_FRAME_MOD = IS_MOBILE ? 2 : 1; // sur mobile: glitch “lourd” 1 frame/2

/* Scanlines (overlay subtil) */
const SCANLINE_ALPHA = 10;  // 0 = désactiver
const SCANLINE_STEP  = 3;   // espacement en px

/* Ghosting de base */
const BASE_OFFSET = 1.2;    // décalage copies (px)

/* Glitch avancé (bandes ondulées + gros tears) */
const WAVE_SLICE_COUNT = 4;   // nb de bandes ondulées
const WAVE_MIN_H       = 6;   // hauteur min bande
const WAVE_MAX_H       = 22;  // hauteur max bande
const WAVE_FREQ        = 0.035;// fréquence sinusoïde
const WAVE_SPEED       = 2.8;  // vitesse onde
const WAVE_AMP         = 6;    // amplitude max (px)

const BIG_TEAR_CHANCE  = 0.025;// proba/frame
const BIG_TEAR_MS      = 140;  // durée d’un tear
const BIG_TEAR_MAX_DX  = 18;   // décalage max
const BIG_TEAR_BANDS   = 3;    // nb de bandes tear

/* Ghosting opacités */
const GHOST_ALPHA_MAIN  = 180; // couche principale
const GHOST_ALPHA_GHOST = 110; // copies ghost (utilisé via makeWarmTones)

/* ===================== STATE ===================== */
let noms = null, scrambler, nextChangeAt = 0;
let pg, baseTextSize;
let hoverNow = false, hoverPrev = false;
let scanlines;       // overlay
let bigTearUntil = 0;

/* Fonts */
let fontRegular = null;
// let fontItalic  = null;

/* ===================== p5 LIFECYCLE ===================== */
function preload() {
  // charge la police; en cas d’échec, on garde fontRegular = null (fallback)
  fontRegular = loadFont(
    FONT_REGULAR_PATH,
    ()=>{},
    (e)=>{ console.warn('[textSketch] Police regular introuvable:', e); fontRegular = null; }
  );
  // fontItalic  = loadFont(FONT_ITALIC_PATH, ()=>{}, ()=>{});

  // charge le JSON
  noms = loadJSON("noms.json");
}

function setup() {
  const holder = document.getElementById("p5-hero");
  if (!holder) {
    console.error("[textSketch] Element #p5-hero introuvable.");
    return;
  }

  const w = holder.clientWidth || window.innerWidth;
  const h = 100; // temporaire, ajusté juste après
  const c = createCanvas(w, h);
  c.parent("p5-hero");

  frameRate(IS_MOBILE ? 50 : FPS);
  pixelDensity(1);

  if (fontRegular) textFont(fontRegular);
  textAlign(CENTER, CENTER);

  if (!Array.isArray(noms)) noms = Object.values(noms);

  scrambler = new TextScrambler("");
  changeToRandomName();

  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  if (fontRegular) pg.textFont(fontRegular);
  pg.textAlign(CENTER, CENTER);

  // overlay scanlines
  scanlines = createGraphics(width, height);
  buildScanlines();

  layoutToHolder(); // ajuste la taille/hauteur au texte
}

function windowResized() {
  layoutToHolder();
}

function draw() {
  clear(); // canvas 100% transparent

  const currentText = scrambler.output;
  const currentSize = baseTextSize;

  hoverPrev = hoverNow;
  hoverNow = isMouseOverText(currentText, currentSize);

  // en entrant en hover: scramble vers AMAZONAS (puis fige une fois fini)
  if (hoverNow && !hoverPrev) scrambler.setText(HOVER_WORD);

  if (hoverNow) {
    if (!scrambler.done) scrambler.update();
  } else {
    scrambler.update();
  }

  // rendu du texte (blanc) dans le buffer transparent
  renderTextToBuffer(pg, scrambler.output, currentSize, hoverNow);

  // Mobile: on allège 1 frame sur 2 (texte simple sans glitch)
  if (IS_MOBILE && (frameCount % LITE_FRAME_MOD !== 0)) {
    image(pg, 0, 0);
  } else {
    const boost = hoverNow ? HOVER_GLITCH_BOOST : 1.0;
    drawGlitch(pg, boost, hoverNow);
  }

  // cycle des mots uniquement hors hover
  if (!hoverNow && scrambler.done && millis() >= nextChangeAt) changeToRandomName();
}

/* ===================== LAYOUT ===================== */
function layoutToHolder() {
  const holder = document.getElementById("p5-hero");
  if (!holder) return;

  const w = holder.clientWidth || window.innerWidth;

  if (fontRegular) textFont(fontRegular);

  const candidates = (noms || []).concat([HOVER_WORD]);
  const widest = getWidestString(candidates.length ? candidates : [HOVER_WORD]);

  baseTextSize = fitTextSizeToWidth(widest, w - 2 * PAD_X);

  textSize(baseTextSize);
  const th = textAscent() + textDescent();
  const h = Math.ceil(th + 2 * PAD_Y);

  resizeCanvas(w, h);

  pg = createGraphics(w, h);
  pg.pixelDensity(1);
  if (fontRegular) pg.textFont(fontRegular);
  pg.textAlign(CENTER, CENTER);
  pg.textSize(baseTextSize);

  // rebuild scanlines à la nouvelle taille
  scanlines = createGraphics(w, h);
  buildScanlines();
}

function buildScanlines() {
  scanlines.clear();
  if (SCANLINE_ALPHA > 0) {
    scanlines.stroke(255, SCANLINE_ALPHA);
    for (let y = 0; y < scanlines.height; y += SCANLINE_STEP) {
      scanlines.line(0, y + 0.5, scanlines.width, y + 0.5);
    }
  }
}

/* ===================== SCRAMBLER ===================== */
class TextScrambler {
  constructor(initialText = "") {
    this.current = initialText;
    this.output = initialText;
    this.queue = [];
    this.frame = 0;
    this.done = true;
  }
  setText(newText) {
    const from = this.current, to = newText;
    const maxLen = Math.max(from.length, to.length);
    this.queue = [];
    for (let i = 0; i < maxLen; i++) {
      const fromChar = from[i] || "";
      const toChar   = to[i] || "";
      const start = Math.floor(random(0, PER_CHAR_MIN));
      const perCharMax = IS_MOBILE ? Math.max(6, PER_CHAR_MAX - 2) : PER_CHAR_MAX;
      const end   = start + Math.floor(random(PER_CHAR_MIN, perCharMax));
      this.queue.push({ fromChar, toChar, start, end, char: "" });
    }
    this.frame = 0; this.done = false; this.current = to;
  }
  update() {
    if (this.queue.length === 0) { this.output = this.current; this.done = true; return; }
    let complete = 0, result = "";
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (this.frame < item.start)       result += item.fromChar || " ";
      else if (this.frame >= item.end) { result += item.toChar || " "; complete++; }
      else {
        const mod = IS_MOBILE ? 3 : 2; // random un peu moins souvent sur tel
        if (frameCount % mod === 0 || !item.char) item.char = randomChar();
        result += item.char;
      }
    }
    this.output = result.replace(/\s+$/g, "");
    this.frame++;
    if (complete === this.queue.length) this.done = true;
  }
}
function randomChar() { return LETTERS.charAt(Math.floor(random(LETTERS.length))); }

/* ===================== RENDU & HITBOX ===================== */
function renderTextToBuffer(buffer, textStr, sizePx, hoverMode) {
  buffer.clear();
  buffer.push();
  if (fontRegular) buffer.textFont((hoverMode && HOVER_ITALIC /* && fontItalic */) ? /* fontItalic || */ fontRegular : fontRegular);
  buffer.textSize(sizePx);
  buffer.noStroke();
  buffer.fill(255); // texte blanc (couleurs / halos gérés dans glitch)
  const jx = random(-0.25, 0.25), jy = random(-0.25, 0.25);
  buffer.translate(jx, jy);
  buffer.text(textStr, buffer.width / 2, buffer.height / 2);
  buffer.pop();
}
function isMouseOverText(textStr, sizePx) {
  if (fontRegular) textFont(fontRegular);
  push();
  textSize(sizePx);
  const tw = textWidth(textStr || "A");
  const th = textAscent() + textDescent();
  pop();
  const cx = width / 2, cy = height / 2;
  const x1 = cx - tw / 2, y1 = cy - th / 2, x2 = cx + tw / 2, y2 = cy + th / 2;
  const pad = 6;
  return (mouseX >= x1 - pad && mouseX <= x2 + pad && mouseY >= y1 - pad && mouseY <= y2 + pad);
}

/* ===================== GLITCH ===================== */
// variations orangées autour de BASE_ORANGE (HSB)
// -> sur mobile: AUCUNE variation (couleur fixe) pour éviter le flicker
function makeWarmTones(intensity = 1) {
  if (IS_MOBILE) {
    const base = color(BASE_ORANGE);
    return [
      color(red(base), green(base), blue(base), 150),
      color(red(base), green(base), blue(base), 130),
      color(red(base), green(base), blue(base), 110),
    ];
  }
  push();
  colorMode(HSB, 360, 100, 100, 255);
  const base = color(BASE_ORANGE);
  const h = hue(base), s = saturation(base), b = brightness(base);
  const c1 = color(h + random(-2, 2), s * 1.00, constrain(b + random(4, 12), 0, 100), 150 * intensity);
  const c2 = color(h + random(-2, 2), s * 0.96, constrain(b + random(2, 10), 0, 100), 130 * intensity);
  const c3 = color(h + random(-1, 1), s * 0.92, constrain(b + random(0, 8),  0, 100), 110 * intensity);
  pop();
  return [c1, c2, c3];
}

function drawGlitch(src, boost = 1.0, hoverMode = false) {
  const t = millis() * 0.001;
  const wavePhase = Math.sin(t * 2.5) * 0.5 + 0.5;
  const baseIntensity = IS_MOBILE ? 0.7 : lerp(0.35, 0.9, wavePhase);
  const intensity = baseIntensity * boost;
  const offset = BASE_OFFSET * intensity;

  // déclenchement ponctuel d’un gros "tear"
  if (!IS_MOBILE && random() < BIG_TEAR_CHANCE) {
    bigTearUntil = millis() + BIG_TEAR_MS;
  }
  const tearActive = millis() < bigTearUntil;

  // — Ghosting / copies — même teinte (pas de RGB split)
  const jitterX = random(-0.3, 0.3) * boost;
  const jitterY = random(-0.3, 0.3) * boost;

  push();
  translate(jitterX, jitterY);
  if (hoverMode) {
    // Blanc (hover), lisible et énergique
    tint(255, 230); image(src, 0, 0);
    tint(255, 160); image(src,  offset, -offset);
  } else {
    const [c1, c2, c3] = makeWarmTones(intensity);
    tint(red(c1), green(c1), blue(c1), GHOST_ALPHA_MAIN); image(src, 0, 0);
    tint(c2); image(src,  offset, -offset);
    tint(c3); image(src, -offset,  offset);
  }
  pop();
  noTint();

  // — Bandes ondulées (WAVE)
  if (!IS_MOBILE || frameCount % 2 === 0) {
    for (let i = 0; i < WAVE_SLICE_COUNT; i++) {
      const sh = floor(random(WAVE_MIN_H, WAVE_MAX_H));
      const sy = floor(random(0, height - sh));
      const phase = t * WAVE_SPEED + sy * WAVE_FREQ;
      const amp = WAVE_AMP * intensity * (hoverMode ? 1.2 : 1.0);
      const dx = Math.sin(phase) * amp;
      copy(src, 0, sy, width, sh, dx, sy, width, sh);
    }
  }

  // — Gros tears ponctuels
  if (tearActive && !IS_MOBILE) {
    for (let i = 0; i < BIG_TEAR_BANDS; i++) {
      const sh = floor(random(height * 0.08, height * 0.22));
      const sy = floor(random(0, height - sh));
      const dx = random(-BIG_TEAR_MAX_DX, BIG_TEAR_MAX_DX) * (hoverMode ? 1.3 : 1.0);
      copy(src, 0, sy, width, sh, dx, sy, width, sh);
    }
  } else {
    // petites tranches classiques
    const sliceCount = floor(random(1, 3));
    for (let i = 0; i < sliceCount; i++) {
      const sh = floor(random(3, 10));
      const sy = floor(random(0, height - sh));
      const dx = random(-6, 6) * intensity;
      copy(src, 0, sy, width, sh, dx, sy, width, sh);
    }
  }

  // — Bandes VERTICALES très légères (desktop only)
  if (!IS_MOBILE) {
    const stripes = Math.floor(random(VSTRIPE_COUNT_MIN, VSTRIPE_COUNT_MAX + 1));
    for (let i = 0; i < stripes; i++) {
      const sw = Math.floor(random(VSTRIPE_WIDTH_MIN, VSTRIPE_WIDTH_MAX + 1));
      const sx = Math.floor(random(0, width - sw));
      const dx = Math.floor(sx + random(-VSTRIPE_OFFSET_MAX, VSTRIPE_OFFSET_MAX) * intensity * (hoverMode ? 1.2 : 1.0));
      copy(src, sx, 0, sw, height, dx, 0, sw, height);
    }
  }

  // — Scanlines subtiles
  if (SCANLINE_ALPHA > 0) {
    push();
    blendMode(OVERLAY);
    image(scanlines, 0, 0);
    pop();
  }
}

/* ===================== OUTILS TEXTE ===================== */
function getWidestString(strings) {
  if (fontRegular) textFont(fontRegular);
  push();
  textSize(200);
  let maxW = -1, widest = strings[0] || "";
  for (const s of strings) {
    const w = textWidth(s);
    if (w > maxW) { maxW = w; widest = s; }
  }
  pop();
  return widest;
}
function fitTextSizeToWidth(textStr, targetWidth) {
  if (fontRegular) textFont(fontRegular);
  let lo = 6, hi = 3000, best = 32;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    textSize(mid);
    const tw = textWidth(textStr);
    if (tw <= targetWidth) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return best;
}

/* ===================== FLUX ===================== */
function changeToRandomName() {
  const target = random(noms);
  scrambler.setText(target);
  nextChangeAt = millis() + INTERVAL_BETWEEN_WORDS;
}
