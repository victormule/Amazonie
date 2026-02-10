// manifes.js (p5 instance mode) — n'interfère pas avec textSketch.js

(() => {
  const paragraphs = [
    `Écoutez ! Les objets parlent. Ils ont traversé les mers, ils ont été pris, emportés, pillés. Ils ont quitté les mains qui les ont faits. Mais leur voix attend. Leur souffle attend. Leur esprit attend. Assez de silence ! Assez de possessions sans mémoire ! Nous appelons les peuples autochtones, les porteurs de chants et de récits, les gardiens des noms, des histoires, des mémoires.`,
    `Racontez ! Chantez ! Écrivez ! Souvenez-vous ! Insufflez à ces objets leur vie ! Faites-les parler à nouveau ! Chaque mot est un souffle, chaque chant est un vent qui traverse les vitrines, chaque souvenir est un pont jeté entre hier et aujourd’hui. Écoutez ! Ils appartiennent à ceux qui les ont créés. Ils appartiennent aux voix qui ne veulent pas se taire.`,
    `Partout où ils sont – musée, collection, cabinet – leurs voix peuvent résonner. Rejoignez-nous ! Chantez, criez, racontez, écrivez ! Rendez à chaque objet son âme, sa mémoire, sa dignité. Faites de ces lieux des espaces de rencontre, de dialogue, d’écho. Chaque voix compte. Chaque souffle compte. Chaque objet compte. Le silence est fini. Le manifeste est vivant. Les objets parlent. Écoutez-les.`,
    `Les objets exposés dans les musées ne sont pas seulement des choses à regarder. Ils ont une histoire. Beaucoup ont été arrachés à leur lieu d’origine, transportés loin de ceux qui les avaient créés, souvent sans leur consentement. Les objets ne sont pas silencieux : ils portent en eux la mémoire des peuples, des gestes et des savoirs qui leur ont donné naissance.`,
    `Aujourd’hui, on les contemple comme des vestiges, les témoins de votre histoire vivante, enfermés dans des cages de verre, au milieu de nos institutions faites de marbre et d’acier.`
  ];

  // Réglages
  const TYPE_SPEED_MS = 18;
  const HOLD_MS = 2600;
  const FADE_MS = 900;

  const MAX_TEXT_WIDTH = 860;
  const SIDE_PADDING = 24;
  const TOP_PADDING = 8;

  const mountId = "manifeste";

  new p5((p) => {
    let idx = 0;
    let charCount = 0;
    let phase = "typing"; // typing -> hold -> fade
    let phaseStart = 0;
    let lastTypeAt = 0;
    let alpha = 255;

    function computeCanvasWidth() {
      const host = document.getElementById(mountId);
      if (!host) return Math.min(window.innerWidth, MAX_TEXT_WIDTH + SIDE_PADDING * 2);
      const w = host.clientWidth || window.innerWidth;
      return Math.min(w, MAX_TEXT_WIDTH + SIDE_PADDING * 2);
    }

    function applyTypography() {
      // Typo responsive
      const isMobile = p.width < 520;
      p.textFont("system-ui, -apple-system, Segoe UI, Roboto, Arial");
      p.textSize(isMobile ? 15 : 18);
      p.textLeading(isMobile ? 22 : 28);
      p.textAlign(p.LEFT, p.TOP);
      p.textWrap(p.WORD);
    }

    function computeCanvasHeightFor(text) {
      const textBoxW = Math.min(p.width - SIDE_PADDING * 2, MAX_TEXT_WIDTH);

      const words = (text || "").trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return Math.max(140, TOP_PADDING * 2 + 24);

      let lines = 1;
      let line = "";

      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (p.textWidth(test) <= textBoxW) {
          line = test;
        } else {
          lines++;
          line = w;
        }
      }

      const leading = p.textLeading(); // ex 22/28
      const pad = TOP_PADDING * 2 + 16; // marge bas “safe”
      return Math.max(140, Math.ceil(lines * leading + pad));
    }

    function resizeToFitCurrentText() {
      const shown = paragraphs[idx].slice(0, charCount);
      const neededH = computeCanvasHeightFor(shown);
      const w = computeCanvasWidth();

      // 1) s'assurer que la largeur est bonne
      if (p.width !== w) {
        p.resizeCanvas(w, p.height);
        applyTypography(); // la largeur a changé => mesures changent
      }

      // 2) ajuster la hauteur
      if (p.height !== neededH) {
        p.resizeCanvas(w, neededH);
      }
    }

    p.setup = () => {
      const host = document.getElementById(mountId);

      const w = computeCanvasWidth();
      // hauteur initiale "safe" ; on ajustera ensuite
      const h = 180;

      const cnv = p.createCanvas(w, h);
      if (host) cnv.parent(host);

      // évite le flou sur certains mobiles (si tu veux ultra sharp, commente)
      p.pixelDensity(1);

      applyTypography();

      phaseStart = p.millis();
      lastTypeAt = p.millis();
    };

    p.draw = () => {
      p.clear(); // canvas transparent
      const now = p.millis();

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

      if (phase === "hold") {
        if (now - phaseStart >= HOLD_MS) {
          phase = "fade";
          phaseStart = now;
        }
        alpha = 255;
      }

      if (phase === "fade") {
        const t = (now - phaseStart) / FADE_MS;
        alpha = Math.round(255 * (1 - p.constrain(t, 0, 1)));

        if (t >= 1) {
          idx = (idx + 1) % paragraphs.length;
          charCount = 0;
          phase = "typing";
          phaseStart = now;
          lastTypeAt = now;
          alpha = 255;
        }
      }

      const shown = paragraphs[idx].slice(0, charCount);

      // Ajuste dynamique du canvas (important sur mobile)
      resizeToFitCurrentText();

      const textBoxW = Math.min(p.width - SIDE_PADDING * 2, MAX_TEXT_WIDTH);
      const x = (p.width - textBoxW) / 2;
      const y = TOP_PADDING;

      p.push();
      // Couleur du texte : blanc (255) — ajuste si besoin
      p.fill(255, alpha);
      p.noStroke();
      p.text(shown, x, y, textBoxW, p.height - TOP_PADDING * 2);
      p.pop();
    };

    p.windowResized = () => {
      // sur resize/orientation change, recalcul complet
      const w = computeCanvasWidth();

      p.resizeCanvas(w, p.height);
      applyTypography();

      const shown = paragraphs[idx].slice(0, charCount);
      const neededH = computeCanvasHeightFor(shown);
      p.resizeCanvas(w, neededH);
    };
  });
})();
