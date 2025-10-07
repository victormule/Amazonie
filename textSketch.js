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

/* Bandes VERTICALES (sur le texte) */
const VSTRIPE_COUNT_MIN   = 2;
const VSTRIPE_COUNT_MAX   = 5;
const VSTRIPE_WIDTH_MIN   = 2;   // px
const VSTRIPE_WIDTH_MAX   = 8;   // px
const VSTRIPE_OFFSET_MAX  = 10;  // px

/* Couleur de référence (orange “memoria & Alma”) */
const BASE_ORANGE = '#e39220';

/* Hover */
const HOVER_WORD = "AMAZONAS";
const HOVER_GLITCH_BOOST = 1.35; // glitch un peu plus fort en hover
const HOVER_ITALIC = false;      // si tu ajoutes dubellit.ttf, tu peux passer à true

/* Padding (hauteur du canvas) */
const PAD_X = 16; // px
const PAD_Y = 26;  // px



/* Optimisations Mobile */
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const LITE_FRAME_MOD = IS_MOBILE ? 2 : 1; // sur mobile: glitch “lourd” 1 frame/2

/* ===================== STATE ===================== */

let noms = null, scrambler, nextChangeAt = 0;
let pg, baseTextSize;
let hoverNow = false, hoverPrev = false;

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

  // ⚠️ on n’appelle textFont QUE si la fonte est chargée
  if (fontRegular) textFont(fontRegular);
  textAlign(CENTER, CENTER);

  if (!Array.isArray(noms)) noms = Object.values(noms);

  scrambler = new TextScrambler("");
  changeToRandomName();

  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  if (fontRegular) pg.textFont(fontRegular);
  pg.textAlign(CENTER, CENTER);

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

  // utiliser la même fonte pour les mesures, si dispo
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
      const perCharMax = IS_MOBILE ? Math.max(6, PER_CHAR_MAX - 2) : PER_CHAR_MAX; // un peu plus court sur mobile
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

function randomChar() {
  return LETTERS.charAt(Math.floor(random(LETTERS.length)));
}

/* ===================== RENDU & HITBOX ===================== */

function renderTextToBuffer(buffer, textStr, sizePx, hoverMode) {
  buffer.clear();
  buffer.push();
  // police : si pas chargée, on laisse le canvas utiliser la police par défaut
  if (fontRegular) buffer.textFont((hoverMode && HOVER_ITALIC /* && fontItalic */) ? /* fontItalic || */ fontRegular : fontRegular);
  buffer.textSize(sizePx);
  buffer.noStroke();
  buffer.fill(255); // texte blanc (les halos/couleurs sont gérés dans glitch)
  // micro jitter
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
function makeWarmTones(intensity = 1) {
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
  const time = millis() * 0.001;
  const wave = Math.sin(time * 2.5) * 0.5 + 0.5;      // 0..1 respiration douce
  const intensity = lerp(0.35, 0.9, wave) * boost;
  const offset = 1.2 * intensity;

  // jitter global léger
  const jx = random(-0.3, 0.3) * boost;
  const jy = random(-0.3, 0.3) * boost;

  // COUCHES PRINCIPALES
  push();
  translate(jx, jy);

  if (hoverMode) {
    // Blanc (hover) — 2 couches suffisent
    tint(255, 230); image(src, 0, 0);
    tint(255, 160); image(src,  offset, -offset);
  } else {
    // Orange (normal) — variations légères
    const [c1, c2, c3] = makeWarmTones(intensity);
    if (IS_MOBILE) {
      tint(c1); image(src,  offset, -offset);
      tint(c2); image(src, -offset,  offset);
    } else {
      tint(c1); image(src,  offset, -offset);
      tint(c2); image(src, -offset,  offset);
      tint(c3); image(src,  0,       0);
    }
  }
  pop();
  noTint();

  // BANDES VERTICALES (rapides, sans get()):
  const stripes = Math.floor(
    random(
      Math.max(1, VSTRIPE_COUNT_MIN - (IS_MOBILE ? 1 : 0)),
      VSTRIPE_COUNT_MAX + 1 - (IS_MOBILE ? 1 : 0)
    )
  );

  for (let i = 0; i < stripes; i++) {
    const sw = Math.floor(random(VSTRIPE_WIDTH_MIN, VSTRIPE_WIDTH_MAX + 1));
    const sx = Math.floor(random(0, width - sw));
    const dx = Math.floor(
      sx + random(-VSTRIPE_OFFSET_MAX, VSTRIPE_OFFSET_MAX) * intensity * (hoverMode ? 1.4 : 1.0)
    );

    // décale de fines colonnes du buffer texte directement sur le canvas
    copy(src, sx, 0, sw, height, dx, 0, sw, height);
  }
}

/* ===================== OUTILS TEXTE ===================== */

function getWidestString(strings) {
  if (fontRegular) textFont(fontRegular);
  push();
  textSize(200); // mesure stable
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




