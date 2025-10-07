// ---------------- Paramètres de l’animation
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZàâäçéèêëîïôöùûüáíóúãõñ() -";
const INTERVAL_BETWEEN_WORDS = 500;
const PER_CHAR_MIN = 6;
const PER_CHAR_MAX = 18;
const FPS = 60;

// ---------------- Paramètres GLITCH (mode normal orangé doux)
const SCANLINE_ALPHA = 10;   // 0 pour désactiver
const BASE_OFFSET = 1.5;     // décalage couches (px)
const BASE_SLICE_DX = 6;     // décalage horizontal max des bandes (px)
const BASE_SLICE_COUNT_MIN = 1;
const BASE_SLICE_COUNT_MAX = 2;

// ---------------- Survol
const HOVER_WORD = "AMAZONAS";
const HOVER_GLITCH_BOOST = 1.6; // intensification douce du glitch en hover

let noms = null;
let scrambler;
let nextChangeAt = 0;

let pg;          // buffer texte
let scanlines;   // overlay scanlines
let baseTextSize;

let hoverNow = false;      // état hover courant
let hoverPrev = false;     // état hover frame précédente

function preload() {
  // Charge un tableau JSON ["Aikanã", ...] (ou remplace par un tableau inline)
  noms = loadJSON("noms.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(FPS);
  pixelDensity(1);

  textFont("monospace");
  textAlign(CENTER, CENTER);
  baseTextSize = min(width, height) * 0.08;
  textSize(baseTextSize);

  if (!Array.isArray(noms)) {
    noms = Object.values(noms);
  }

  scrambler = new TextScrambler("");
  changeToRandomName();

  // Buffer offscreen
  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.textFont("monospace");
  pg.textAlign(CENTER, CENTER);
  pg.textSize(baseTextSize);

  // Scanlines
  scanlines = createGraphics(width, height);
  scanlines.pixelDensity(1);
  scanlines.clear();
  if (SCANLINE_ALPHA > 0) {
    scanlines.stroke(255, SCANLINE_ALPHA);
    for (let y = 0; y < height; y += 3) {
      scanlines.line(0, y + 0.5, width, y + 0.5);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseTextSize = min(width, height) * 0.08;
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
    for (let y = 0; y < height; y += 3) {
      scanlines.line(0, y + 0.5, width, y + 0.5);
    }
  }
}

function draw() {
  background(20, 10, 5); // fond brun-rouge doux

  // texte courant & taille (même taille en hover)
  const currentText = hoverNow ? scrambler.output : scrambler.output;
  const currentSize = baseTextSize;

  // Détection de survol par rapport au texte affiché
  hoverPrev = hoverNow;
  hoverNow = isMouseOverText(currentText, currentSize);

  // Transition: quand on ENTRE en hover, on lance un scramble vers AMAZONAS
  if (hoverNow && !hoverPrev) {
    scrambler.setText(HOVER_WORD);
  }

  // Update du scramble:
  // - en hover: on continue à mettre à jour jusqu'à ce que "AMAZONAS" soit fini, puis on fige
  // - hors hover: animation normale
  if (hoverNow) {
    if (!scrambler.done) scrambler.update();
    // une fois fini, on ne touche plus (figé sur AMAZONAS tant qu'on survole)
  } else {
    scrambler.update();
  }

  // Affichage: buffer texte (toujours même taille)
  renderTextToBuffer(pg, scrambler.output, currentSize, hoverNow);

  // Glitch: blanc (boosté) en hover, orangé doux sinon
  const boost = hoverNow ? HOVER_GLITCH_BOOST : 1.0;
  drawGlitch(pg, boost, hoverNow);

  // Changement de mot uniquement hors hover
  if (!hoverNow && scrambler.done && millis() >= nextChangeAt) {
    changeToRandomName();
  }
}

function changeToRandomName() {
  const target = random(noms);
  scrambler.setText(target);
  nextChangeAt = millis() + INTERVAL_BETWEEN_WORDS;
}

// ----------- Scrambler (inchangé)
class TextScrambler {
  constructor(initialText = "") {
    this.current = initialText;
    this.output = initialText;
    this.queue = [];
    this.frame = 0;
    this.done = true;
  }

  setText(newText) {
    const from = this.current;
    const to = newText;
    const maxLen = max(from.length, to.length);

    this.queue = [];
    for (let i = 0; i < maxLen; i++) {
      const fromChar = from[i] || "";
      const toChar   = to[i] || "";
      const start = floor(random(0, PER_CHAR_MIN));
      const end   = start + floor(random(PER_CHAR_MIN, PER_CHAR_MAX));
      this.queue.push({ fromChar, toChar, start, end, char: "" });
    }

    this.frame = 0;
    this.done = false;
    this.current = to;
  }

  update() {
    if (this.queue.length === 0) {
      this.output = this.current;
      this.done = true;
      return;
    }

    let complete = 0;
    let result = "";

    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];

      if (this.frame < item.start) {
        result += item.fromChar || " ";
      } else if (this.frame >= item.end) {
        result += item.toChar || " ";
        complete++;
      } else {
        if (frameCount % 2 === 0 || !item.char) {
          item.char = randomChar();
        }
        result += item.char;
      }
    }

    this.output = rtrim(result);
    this.frame++;

    if (complete === this.queue.length) {
      this.done = true;
    }
  }
}

function randomChar() {
  const idx = floor(random(LETTERS.length));
  return LETTERS.charAt(idx);
}
function rtrim(str) {
  return str.replace(/\s+$/g, "");
}

// -------------------- helpers rendu & hitbox
function renderTextToBuffer(buffer, textStr, sizePx, hoverMode) {
  buffer.clear(); // transparent
  buffer.push();
  buffer.textSize(sizePx);
  buffer.noStroke();
  buffer.fill(255); // texte blanc (le halo/couleur est géré dans le glitch)

  // micro jitter
  const jx = random(-0.3, 0.3);
  const jy = random(-0.3, 0.3);
  buffer.translate(jx, jy);
  buffer.text(textStr, buffer.width / 2, buffer.height / 2);
  buffer.pop();
}

function isMouseOverText(textStr, sizePx) {
  push();
  textSize(sizePx);
  const tw = textWidth(textStr || "A"); // valeur non nulle
  const th = textAscent() + textDescent();
  pop();

  const cx = width / 2;
  const cy = height / 2;

  const x1 = cx - tw / 2;
  const y1 = cy - th / 2;
  const x2 = cx + tw / 2;
  const y2 = cy + th / 2;

  const pad = 8;
  return (mouseX >= x1 - pad && mouseX <= x2 + pad && mouseY >= y1 - pad && mouseY <= y2 + pad);
}

// -------------------- GLITCH renderer
// boost > 1 => plus fort (utilisé au survol)
// hoverMode = true => glitch blanc, sinon orangé doux
function drawGlitch(src, boost = 1.0, hoverMode = false) {
  const time = millis() * 0.001;
  const wave = sin(time * 2.5) * 0.5 + 0.5;          // 0..1
  const intensity = lerp(0.4, 1.0, wave) * boost;

  const offset = BASE_OFFSET * intensity;

  if (hoverMode) {
    // --- MODE SURVOL : tout en BLANC, un peu plus fort ---
    const jitterX = random(-0.4, 0.4) * boost;
    const jitterY = random(-0.4, 0.4) * boost;

    push();
    translate(jitterX, jitterY);

    // couche principale blanche
    tint(255, 230);
    image(src, 0, 0);

    // copies légères pour halo
    tint(255, 160); image(src,  offset, -offset);
    tint(255, 140); image(src, -offset,  offset);
    pop();

    noTint();

    // bandes discrètes
    const slices = floor(random(BASE_SLICE_COUNT_MIN + 1, BASE_SLICE_COUNT_MAX + 2));
    for (let i = 0; i < slices; i++) {
      const sh = floor(random(4, 12));
      const sy = floor(random(0, height - sh));
      const dx = random(-BASE_SLICE_DX * 1.5, BASE_SLICE_DX * 1.5) * intensity;

      push();
      tint(255, 150);
      copy(src, 0, sy, width, sh, dx, sy, width, sh);
      pop();
    }

  } else {
    // --- MODE NORMAL : palette orangée douce ---
    const col1 = color(255, 180, 100, 150 * intensity);
    const col2 = color(255, 100,  50, 140 * intensity);
    const col3 = color(255, 220, 160, 120 * intensity);

    const jitterX = random(-0.3, 0.3);
    const jitterY = random(-0.3, 0.3);

    push();
    translate(jitterX, jitterY);

    tint(col1); image(src,  offset, -offset);
    tint(col2); image(src, -offset,  offset);
    tint(col3); image(src,  0,       0);
    pop();

    noTint();

    const sliceCount = floor(random(BASE_SLICE_COUNT_MIN, BASE_SLICE_COUNT_MAX + 1));
    for (let i = 0; i < sliceCount; i++) {
      const sh = floor(random(3, 10));
      const sy = floor(random(0, height - sh));
      const dx = random(-BASE_SLICE_DX, BASE_SLICE_DX) * intensity;
      push();
      tint(255, 120);
      copy(src, 0, sy, width, sh, dx, sy, width, sh);
      pop();
    }

    // halo orangé très léger
    push();
    noStroke();
    fill(255, 150, 80, 8 * intensity);
    rect(0, 0, width, height);
    pop();
  }

  // scanlines discrètes
  if (SCANLINE_ALPHA > 0) {
    push();
    blendMode(OVERLAY);
    image(scanlines, 0, 0);
    pop();
  }
}