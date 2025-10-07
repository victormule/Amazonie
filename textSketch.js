// ---------- Paramètres animation
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZàâäçéèêëîïôöùûüáíóúãõñ() -";
const INTERVAL_BETWEEN_WORDS = 500;
const PER_CHAR_MIN = 6;
const PER_CHAR_MAX = 18;
const FPS = 60;

// ---------- Glitch
const SCANLINE_ALPHA = 10;
const BASE_OFFSET = 1.5;
const BASE_SLICE_DX = 6;
const BASE_SLICE_COUNT_MIN = 1;
const BASE_SLICE_COUNT_MAX = 2;

// ---------- Hover
const HOVER_WORD = "AMAZONAS";
const HOVER_GLITCH_BOOST = 1.6;

let noms = null, scrambler, nextChangeAt = 0;
let pg, scanlines, baseTextSize;
let hoverNow = false, hoverPrev = false;

function preload() {
  noms = loadJSON("noms.json");
}

function setup() {
  // ancre le canvas dans #p5-hero
  const holder = document.getElementById("p5-hero");
  const w = holder.clientWidth || window.innerWidth;
  const h = holder.clientHeight || Math.max(260, window.innerHeight * 0.35);

  const c = createCanvas(w, h);
  c.parent("p5-hero");

  frameRate(FPS);
  pixelDensity(1);
  textFont("monospace");
  textAlign(CENTER, CENTER);
  baseTextSize = Math.min(width, height) * 0.32; // plus grand car c'est un titre
  textSize(baseTextSize);

  if (!Array.isArray(noms)) noms = Object.values(noms);

  scrambler = new TextScrambler("");
  changeToRandomName();

  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.textFont("monospace");
  pg.textAlign(CENTER, CENTER);
  pg.textSize(baseTextSize);

  scanlines = createGraphics(width, height);
  scanlines.pixelDensity(1);
  scanlines.clear();
  if (SCANLINE_ALPHA > 0) {
    scanlines.stroke(255, SCANLINE_ALPHA);
    for (let y = 0; y < height; y += 3) scanlines.line(0, y + 0.5, width, y + 0.5);
  }
}

function windowResized() {
  const holder = document.getElementById("p5-hero");
  const w = holder.clientWidth || window.innerWidth;
  const h = holder.clientHeight || Math.max(260, window.innerHeight * 0.35);

  resizeCanvas(w, h);
  baseTextSize = Math.min(width, height) * 0.32;
  textSize(baseTextSize);

  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.textFont("monospace");
  pg.textAlign(CENTER, CENTER);
  pg.textSize(baseTextSize);

  scanlines = createGraphics(width, height);
  scanlines.pixelDensity(1);
  scanlines.clear();
  if (SCANLINE_ALPHA > 0) {
    scanlines.stroke(255, SCANLINE_ALPHA);
    for (let y = 0; y < height; y += 3) scanlines.line(0, y + 0.5, width, y + 0.5);
  }
}

function draw() {
  clear(); // fond transparent pour épouser le hero existant

  // texte courant
  const currentText = scrambler.output;
  const currentSize = baseTextSize;

  // survol basé sur la bounding box du texte centré
  hoverPrev = hoverNow;
  hoverNow = isMouseOverText(currentText, currentSize);

  // si on vient d'entrer en hover -> scramble vers AMAZONAS
  if (hoverNow && !hoverPrev) scrambler.setText(HOVER_WORD);

  // update (en hover, on fige une fois AMAZONAS atteint)
  if (hoverNow) {
    if (!scrambler.done) scrambler.update();
  } else {
    scrambler.update();
  }

  // rendu texte -> buffer
  renderTextToBuffer(pg, scrambler.output, currentSize, hoverNow);

  // glitch : blanc boosté en hover, orangé doux sinon
  const boost = hoverNow ? HOVER_GLITCH_BOOST : 1.0;
  drawGlitch(pg, boost, hoverNow);

  // cycle mots seulement hors hover
  if (!hoverNow && scrambler.done && millis() >= nextChangeAt) changeToRandomName();
}

function changeToRandomName() {
  const target = random(noms);
  scrambler.setText(target);
  nextChangeAt = millis() + INTERVAL_BETWEEN_WORDS;
}

// ---------- Scrambler
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
      const end   = start + Math.floor(random(PER_CHAR_MIN, PER_CHAR_MAX));
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
        if (frameCount % 2 === 0 || !item.char) item.char = randomChar();
        result += item.char;
      }
    }
    this.output = result.replace(/\s+$/g, "");
    this.frame++;
    if (complete === this.queue.length) this.done = true;
  }
}

function randomChar() { return LETTERS.charAt(Math.floor(random(LETTERS.length))); }

// ---------- helpers rendu & hitbox
function renderTextToBuffer(buffer, textStr, sizePx, hoverMode) {
  buffer.clear();
  buffer.push();
  buffer.textSize(sizePx);
  buffer.noStroke();
  buffer.fill(255); // texte blanc (les halos/couleurs sont gérés après)
  const jx = random(-0.3, 0.3), jy = random(-0.3, 0.3);
  buffer.translate(jx, jy);
  buffer.text(textStr, buffer.width / 2, buffer.height / 2);
  buffer.pop();
}

function isMouseOverText(textStr, sizePx) {
  push();
  textSize(sizePx);
  const tw = textWidth(textStr || "A");
  const th = textAscent() + textDescent();
  pop();
  const cx = width / 2, cy = height / 2;
  const x1 = cx - tw / 2, y1 = cy - th / 2, x2 = cx + tw / 2, y2 = cy + th / 2;
  const pad = 8;
  return (mouseX >= x1 - pad && mouseX <= x2 + pad && mouseY >= y1 - pad && mouseY <= y2 + pad);
}

// ---------- GLITCH
function drawGlitch(src, boost = 1.0, hoverMode = false) {
  const time = millis() * 0.001;
  const wave = Math.sin(time * 2.5) * 0.5 + 0.5;   // 0..1
  const intensity = lerp(0.4, 1.0, wave) * boost;
  const offset = BASE_OFFSET * intensity;

  if (hoverMode) {
    const jx = random(-0.4, 0.4) * boost, jy = random(-0.4, 0.4) * boost;
    push(); translate(jx, jy);
    tint(255, 230); image(src, 0, 0);
    tint(255, 160); image(src,  offset, -offset);
    tint(255, 140); image(src, -offset,  offset);
    pop(); noTint();

    const slices = Math.floor(random(BASE_SLICE_COUNT_MIN + 1, BASE_SLICE_COUNT_MAX + 2));
    for (let i = 0; i < slices; i++) {
      const sh = Math.floor(random(4, 12));
      const sy = Math.floor(random(0, height - sh));
      const dx = random(-BASE_SLICE_DX * 1.5, BASE_SLICE_DX * 1.5) * intensity;
      push(); tint(255, 150); copy(src, 0, sy, width, sh, dx, sy, width, sh); pop();
    }
  } else {
    const col1 = color(255,180,100, 150 * intensity);
    const col2 = color(255,100, 50, 140 * intensity);
    const col3 = color(255,220,160, 120 * intensity);
    const jx = random(-0.3, 0.3), jy = random(-0.3, 0.3);
    push(); translate(jx, jy);
    tint(col1); image(src,  offset, -offset);
    tint(col2); image(src, -offset,  offset);
    tint(col3); image(src,  0,       0);
    pop(); noTint();

    const sliceCount = Math.floor(random(BASE_SLICE_COUNT_MIN, BASE_SLICE_COUNT_MAX + 1));
    for (let i = 0; i < sliceCount; i++) {
      const sh = Math.floor(random(3, 10));
      const sy = Math.floor(random(0, height - sh));
      const dx = random(-BASE_SLICE_DX, BASE_SLICE_DX) * intensity;
      push(); tint(255, 120); copy(src, 0, sy, width, sh, dx, sy, width, sh); pop();
    }
    // halo orangé très léger
    push(); noStroke(); fill(255,150,80, 8 * intensity); rect(0,0,width,height); pop();
  }

  if (SCANLINE_ALPHA > 0) {
    push(); blendMode(OVERLAY); image(scanlines, 0, 0); pop();
  }
}
