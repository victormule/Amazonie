// manifes.js (p5 instance mode) — hauteur FIXE calculée sur le texte le plus long
(() => {
const paragraphs = [
  `Escutem! Os objetos falam. Atravessaram os mares, foram levados, tomados, saqueados. Saíram das mãos que os criaram. Mas suas vozes esperam. Sua respiração espera. Seu espírito espera. Chega de silêncio! Chega de posses sem memória! Chamamos os povos indígenas, os guardiões de cantos e narrativas, os guardiões dos nomes, das histórias, das memórias.`,
  `Contem! Cantem! Escrevam! Lembrem-se! Devolvam a vida a esses objetos! Façam-nos falar de novo! Cada palavra é um sopro, cada canto é um vento que atravessa as vitrines, cada lembrança é uma ponte entre ontem e hoje. Escutem! Eles pertencem a quem os criou. Pertencem às vozes que se recusam a se calar.`,
  `Onde quer que estejam — museu, coleção, gabinete — suas vozes podem ressoar. Juntem-se a nós! Cantem, gritem, contem, escrevam! Devolvam a cada objeto sua alma, sua memória, sua dignidade. Transformem esses lugares em espaços de encontro, de diálogo, de eco. Cada voz importa. Cada sopro importa. Cada objeto importa. O silêncio acabou. O manifesto está vivo. Os objetos falam. Escutem-nos.`,
  `Os objetos expostos nos museus não são apenas coisas para olhar. Eles têm uma história. Muitos foram arrancados de seus lugares de origem, levados para longe de quem os criou, muitas vezes sem consentimento. Os objetos não são silenciosos: carregam em si a memória dos povos, dos gestos e dos saberes que lhes deram origem.`,
  `Hoje, nós os observamos como vestígios, testemunhas de uma história ainda viva, presos em caixas de vidro, no meio de instituições de mármore e aço.`
];

  // Réglages
  const TYPE_SPEED_MS = 18;
  const HOLD_MS = 2600;
  const FADE_MS = 900;

  const MAX_TEXT_WIDTH = 860;
  const SIDE_PADDING = 24;
  const TOP_PADDING = 8;
  const MIN_CANVAS_H = 160; // hauteur minimale "safe"

  const mountId = "manifeste";

  new p5((p) => {
    let idx = 0;
    let charCount = 0;
    let phase = "typing"; // typing -> hold -> fade
    let phaseStart = 0;
    let lastTypeAt = 0;
    let alpha = 255;

    let fixedH = 200; // calculée une fois (ou au resize)

    function computeCanvasWidth() {
      const host = document.getElementById(mountId);
      if (!host) return Math.min(window.innerWidth, MAX_TEXT_WIDTH + SIDE_PADDING * 2);
      const w = host.clientWidth || window.innerWidth;
      return Math.min(w, MAX_TEXT_WIDTH + SIDE_PADDING * 2);
    }

    function applyTypography() {
      const isMobile = p.width < 520;
      p.textFont("system-ui, -apple-system, Segoe UI, Roboto, Arial");
      p.textSize(isMobile ? 15 : 18);
      p.textLeading(isMobile ? 22 : 28);
      p.textAlign(p.LEFT, p.TOP);
      p.textWrap(p.WORD);
    }

    // Mesure "à la main" : combien de lignes pour un texte donné dans la largeur actuelle
    function measureLines(text, textBoxW) {
      const words = (text || "").trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return 1;

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
      return lines;
    }

    function computeFixedHeightForAllParagraphs() {
      const textBoxW = Math.min(p.width - SIDE_PADDING * 2, MAX_TEXT_WIDTH);
      let maxLines = 1;

      for (const t of paragraphs) {
        const lines = measureLines(t, textBoxW);
        if (lines > maxLines) maxLines = lines;
      }

      const leading = p.textLeading();
      const pad = TOP_PADDING * 2 + 16; // marge bas "safe"
      return Math.max(MIN_CANVAS_H, Math.ceil(maxLines * leading + pad));
    }

    function recomputeCanvasSize() {
      const w = computeCanvasWidth();
      p.resizeCanvas(w, p.height);

      applyTypography();

      fixedH = computeFixedHeightForAllParagraphs();
      p.resizeCanvas(w, fixedH);
    }

    p.setup = () => {
      const host = document.getElementById(mountId);
      const w = computeCanvasWidth();

      // hauteur temporaire; on calcule la vraie juste après
      const cnv = p.createCanvas(w, 200);
      if (host) cnv.parent(host);

      p.pixelDensity(1);

      applyTypography();
      fixedH = computeFixedHeightForAllParagraphs();
      p.resizeCanvas(w, fixedH);

      phaseStart = p.millis();
      lastTypeAt = p.millis();
    };

    p.draw = () => {
      p.clear();
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

      const textBoxW = Math.min(p.width - SIDE_PADDING * 2, MAX_TEXT_WIDTH);
      const x = (p.width - textBoxW) / 2;
      const y = TOP_PADDING;

      p.push();
      p.fill(255, alpha);
      p.noStroke();
      p.text(shown, x, y, textBoxW, p.height - TOP_PADDING * 2);
      p.pop();
    };

    p.windowResized = () => {
      // uniquement lors d’un vrai changement de largeur (resize/orientation)
      recomputeCanvasSize();
    };
  });
})();
