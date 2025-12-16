// textSketch.js (p5.js)

const paragraphs = [
  `Écoutez ! Les objets parlent. Ils ont traversé les mers, ils ont été pris, emportés, pillés. Ils ont quitté les mains qui les ont faits. Mais leur voix attend. Leur souffle attend. Leur esprit attend. Assez de silence ! Assez de possessions sans mémoire ! Nous appelons les peuples autochtones, les porteurs de chants et de récits, les gardiens des noms, des histoires, des mémoires.`,
  `Racontez ! Chantez ! Écrivez ! Souvenez-vous ! Insufflez à ces objets leur vie ! Faites-les parler à nouveau ! Chaque mot est un souffle, chaque chant est un vent qui traverse les vitrines, chaque souvenir est un pont jeté entre hier et aujourd’hui. Écoutez ! Ils appartiennent à ceux qui les ont créés. Ils appartiennent aux voix qui ne veulent pas se taire.`,
  `Partout où ils sont – musée, collection, cabinet – leurs voix peuvent résonner. Rejoignez-nous ! Chantez, criez, racontez, écrivez ! Rendez à chaque objet son âme, sa mémoire, sa dignité. Faites de ces lieux des espaces de rencontre, de dialogue, d’écho. Chaque voix compte. Chaque souffle compte. Chaque objet compte. Le silence est fini. Le manifeste est vivant. Les objets parlent. Écoutez-les.`,
  `Les objets exposés dans les musées ne sont pas seulement des choses à regarder. Ils ont une histoire. Beaucoup ont été arrachés à leur lieu d’origine, transportés loin de ceux qui les avaient créés, souvent sans leur consentement. Les objets ne sont pas silencieux : ils portent en eux la mémoire des peuples, des gestes et des savoirs qui leur ont donné naissance.`,
  `Aujourd’hui, on les contemple comme des vestiges, les témoins de votre histoire vivante, enfermés dans des cages de verre, au milieu de nos institutions faites de marbre et d’acier.`
];

// Réglages
const TYPE_SPEED_MS = 18;     // vitesse de frappe (plus petit = plus rapide)
const HOLD_MS = 2600;         // temps d'attente après texte complet
const FADE_MS = 900;          // durée du fade-out
const SIDE_PADDING = 24;
const TOP_PADDING = 18;
const MAX_TEXT_WIDTH = 860;   // largeur max du texte (style "max-width:800px" similaire)

let host, cnv;
let idx = 0;           // index paragraphe
let charCount = 0;     // combien de caractères affichés
let phase = "typing";  // "typing" -> "hold" -> "fade"
let phaseStart = 0;
let lastTypeAt = 0;
let alpha = 255;

function setup() {
  host = document.getElementById("p5-hero");
  const w = Math.min(windowWidth, MAX_TEXT_WIDTH + SIDE_PADDING * 2);
  const h = 230; // hauteur du "bloc" (ajustable)

  cnv = createCanvas(w, h);
  cnv.parent(host);

  pixelDensity(1);

  textFont("system-ui, -apple-system, Segoe UI, Roboto, Arial");
  textSize(18);
  textLeading(28);
  textAlign(LEFT, TOP);
  textWrap(WORD);

  phaseStart = millis();
  lastTypeAt = millis();
}

function draw() {
  clear(); // canvas transparent (si tu veux un fond, remplace par background(...))

  const now = millis();

  // machine à écrire
  if (phase === "typing") {
    if (now - lastTypeAt >= TYPE_SPEED_MS) {
      charCount = Math.min(charCount + 1, paragraphs[idx].length);
      lastTypeAt = now;

      if (charCount >= paragraphs[idx].length) {
        phase = "hold";
        phaseStart = now;
      }
    }
    alpha = 255;
  }

  // pause
  if (phase === "hold") {
    if (now - phaseStart >= HOLD_MS) {
      phase = "fade";
      phaseStart = now;
    }
    alpha = 255;
  }

  // fade out
  if (phase === "fade") {
    const t = (now - phaseStart) / FADE_MS;
    alpha = Math.round(255 * (1 - constrain(t, 0, 1)));

    if (t >= 1) {
      // prochain paragraphe
      idx = (idx + 1) % paragraphs.length;
      charCount = 0;
      phase = "typing";
      phaseStart = now;
      lastTypeAt = now;
      alpha = 255;
    }
  }

  // rendu texte
  const shown = paragraphs[idx].slice(0, charCount);

  push();
  fill(255, alpha); // texte blanc (si ton fond est clair, change en 0)
  noStroke();

  // zone texte centrée
  const textBoxW = Math.min(width - SIDE_PADDING * 2, MAX_TEXT_WIDTH);
  const x = (width - textBoxW) / 2;
  const y = TOP_PADDING;

  text(shown, x, y, textBoxW, height - TOP_PADDING * 2);
  pop();
}

function windowResized() {
  const w = Math.min(windowWidth, MAX_TEXT_WIDTH + SIDE_PADDING * 2);
  resizeCanvas(w, height);
}
