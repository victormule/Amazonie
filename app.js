/* =========================================================
   Quai Branly – Memória & Alma  |  app.js
   ========================================================= */

/* ======= CONFIG ======= */
const SUPABASE_URL = "https://mzcepywscpmbzvcouwuj.supabase.co";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;     // 4 MB (frontend)
const WARNING_THRESHOLD = 0.8 * MAX_AUDIO_BYTES;
const CRITICAL_THRESHOLD = 0.95 * MAX_AUDIO_BYTES;
const RECORDING_TIMESLICE = 1000;            // ms

// Artefatos da galeria
const IMAGES = [
  { src: "assets/image1.png",  alt: "Peitoral de penas e contas" },
  { src: "assets/image2.png",  alt: "Cinto trançado com penas" },
  { src: "assets/image3.png",  alt: "Coroa cerimonial" },
  { src: "assets/image4.png",  alt: "Cesto ritual" },
  { src: "assets/image5.png",  alt: "Pente frontal" },
  { src: "assets/image6.png",  alt: "Brincos de penas" },
  { src: "assets/image7.png",  alt: "Coroa cerimonial" },
  { src: "assets/image8.png",  alt: "Cesto ritual" },
  { src: "assets/image9.png",  alt: "Pente frontal" },
  { src: "assets/image10.png", alt: "Brincos de penas" }
];

/* ======= HELPERS ======= */
const $ = (sel, el = document) => el.querySelector(sel);

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });

const formatTime = (sec) => {
  if (!Number.isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + " KB";
  const mb = kb / 1024;
  return mb.toFixed(2) + " MB";
};

/* ---- compressão de imagem ≤ 400 KB --------------------- */
async function compressImage(file, {
  maxWidth = 1600,
  maxHeight = 1600,
  maxBytes = 400 * 1024,     // <= 400 KB
  preferType = 'image/webp',
  initialQuality = 0.92,
} = {}) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  URL.revokeObjectURL(url);

  const toBlob = (canvas, type, q) =>
    new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));

  // tipo de saída (WebP se suportado)
  let outType = preferType;
  try {
    const probe = document.createElement('canvas').toDataURL(preferType);
    if (!probe.startsWith(`data:${preferType}`)) outType = 'image/jpeg';
  } catch { outType = 'image/jpeg'; }

  // 1) Redimensionar
  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  let w = Math.max(1, Math.round(img.width * scale));
  let h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = w; canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  // 2) Ajustar qualidade e dimensões até caber
  let q = initialQuality;
  let blob = await toBlob(canvas, outType, q);
  while (blob && blob.size > maxBytes && q > 0.4) {
    q -= 0.08;
    blob = await toBlob(canvas, outType, q);
  }
  let dimIter = 0;
  while (blob && blob.size > maxBytes && dimIter < 5) {
    dimIter++;
    w = Math.max(640, Math.round(w * 0.85));
    h = Math.max(640, Math.round(h * 0.85));
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    q = Math.min(q, 0.85);
    blob = await toBlob(canvas, outType, q);
    while (blob && blob.size > maxBytes && q > 0.4) {
      q -= 0.08;
      blob = await toBlob(canvas, outType, q);
    }
  }

  return { blob, mime: outType, width: w, height: h, quality: q };
}
// Normalise toutes les clés d'ID pour les Maps/objets
const keyId = (v) => String(v);


/* ======= STATE ======= */
const gallery = $("#gallery");
const loadingIndicator = $("#loading-indicator");
const messageCache = {};     // { `${artefactId}-${page}` : [messages] }
let currentIndex = 0;        // para a galeria
let isLoading = false;

/* =========================================================
   RENDER DE MENSAGENS
   ========================================================= */

function renderMessages(messages, container, artefactId, loadMoreBtn, clearContainer = true) {
  if (clearContainer) container.innerHTML = "";
  if (!messages.length && clearContainer) {
    container.innerHTML = '<p class="note">Nenhum comentário por enquanto…</p>';
    return;
  }

  const userMessages = JSON.parse(localStorage.getItem("userMessages") || "{}");

  messages.forEach((m) => {
    const div = document.createElement("div");
    div.className = "note";
    div.innerHTML = `<strong>${m.author}</strong> – <em>${new Date(m.created_at).toLocaleString('pt-BR')}</em><br>`;

    if (m.comment) {
      div.innerHTML += `<p style="margin:0 0 .5rem">${m.comment}</p>`;
    }

    // Áudio (lazy)
    if (m.audio_path) {
      const audioContainer = document.createElement("div");
      audioContainer.className = "audio-lazy";
      audioContainer.innerHTML = `<button class="play-audio">▶️ Ouvir áudio</button>`;
      audioContainer.dataset.src = `${SUPABASE_URL}/storage/v1/object/public/recordings/${m.audio_path}`;
      audioContainer.querySelector("button").addEventListener("click", function () {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = audioContainer.dataset.src;
        this.replaceWith(audio);
        audio.play();
      });
      div.appendChild(audioContainer);
    }

    // Imagem
    if (m.image_path) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "comment-media";
      const img = document.createElement("img");
      img.src = `${SUPABASE_URL}/storage/v1/object/public/comment-images/${m.image_path}`;
      img.alt = "imagem do comentário";
      img.addEventListener("error", () => {
        console.warn("[messages] image failed to load:", img.src);
      });
      imgWrap.appendChild(img);
      div.appendChild(imgWrap);
    }

    // Excluir (se a mensagem pertence ao usuário)
    if (userMessages[m.id]) {
      const del = document.createElement("button");
      del.className = "delete-btn";
      del.textContent = "🗑️ Excluir";
      del.onclick = () =>
        deleteMessage(m.id, userMessages[m.id], artefactId, container, loadMoreBtn);
      div.appendChild(del);
    }

    container.appendChild(div);
  });
}

async function loadMessages(artefactId, upper, page = 0, limit = 10) {
  const cacheKey = `${artefactId}-${page}`;
  if (messageCache[cacheKey]) {
    renderMessages(messageCache[cacheKey], upper, artefactId, null, page === 0);
    return messageCache[cacheKey].length === limit;
  }
  const res = await fetch(
    `/.netlify/functions/get-messages?artefact=${encodeURIComponent(artefactId)}&page=${page}&limit=${limit}`
  );
  const data = await res.json();
  messageCache[cacheKey] = data;
  renderMessages(data, upper, artefactId, null, page === 0);
  return data.length === limit;
}

async function deleteMessage(messageId, secretKey, artefactId, upperPanel, loadMoreBtn) {
  if (!confirm("Tem certeza que deseja excluir este comentário?")) return;
  try {
    const res = await fetch("/.netlify/functions/delete-message", {
      method: "POST",
      body: JSON.stringify({ id: messageId, delete_token: secretKey }),
    });
    const result = await res.text();
    if (result === "ok") {
      const userMessages = JSON.parse(localStorage.getItem("userMessages") || "{}");
      delete userMessages[messageId];
      localStorage.setItem("userMessages", JSON.stringify(userMessages));
      Object.keys(messageCache).forEach((k) => k.startsWith(artefactId) && delete messageCache[k]);
      loadMessages(artefactId, upperPanel).then((hasMore) => {
        if (loadMoreBtn) loadMoreBtn.style.display = hasMore ? "block" : "none";
      });
    } else {
      alert("Erro ao excluir: chave inválida ou mensagem não encontrada");
    }
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

/* =========================================================
   RENDER DE UM ARTEFATO (imagem + painel de comentários)
   ========================================================= */

function renderArtefact({ src, alt }) {
  const artefactId = src.split('/').pop();

  // ---- outer card + grid ----
  const card  = document.createElement('div');
  card.className = 'artefact-card';

  const grid  = document.createElement('div');
  grid.className = 'artefact__grid';
  card.appendChild(grid);

  // ---- left: image ----
  const media = document.createElement('div');
  media.className = 'artefact__media';
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  media.appendChild(img);
  grid.appendChild(media);

  // ---- right: panel ----
  const panel = document.createElement('div');
  panel.className = 'panel collapsed';

  // top toolbar (toggle button lives here)
  const toolbar = document.createElement('div');
  toolbar.className = 'panel-toolbar';
  toolbar.innerHTML = `<button type="button" class="toggle-mode" aria-expanded="false">✎ Escrever</button>`;
  panel.appendChild(toolbar);

  // list of comments
  const upper = document.createElement('div');
  upper.className = 'panel-upper';
  panel.appendChild(upper);

  // editor area
  const lower = document.createElement('div');
  lower.className = 'panel-lower';
  lower.innerHTML = `
    <input type="text" placeholder="Seu nome (opcional)" maxlength="50" />
    <textarea placeholder="Adicionar um comentário…" maxlength="1000"></textarea>
    <div class="char-count">0 / 1000</div>

    <div class="actions">
      <button data-publish>Publicar</button>
      <button data-audio>🗣️ Gravar</button>
      <button data-image>🖼️ Importar imagem</button>
      <button class="loc-btn" data-artefact="${artefactId}">📍 Localizar</button>
      <input type="file" accept="image/png,image/jpeg,image/webp" data-image-input style="display:none" />
    </div>

    <div class="rec-info" style="display:none">
      <span class="rec-time"></span>
      <span class="file-size"></span>
    </div>
    <div class="preview" data-preview></div>
  `;
  panel.appendChild(lower);
  grid.appendChild(panel);

  gallery.appendChild(card);

  // “load more” button, under the list
  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.textContent = "Carregar mais comentários";
  loadMoreBtn.className = "load-more-comments";
  loadMoreBtn.style.display = "none";
  upper.after(loadMoreBtn);

  /* --- refs --- */
  const nameInput = lower.querySelector('input[type="text"]');
  const textarea  = lower.querySelector("textarea");
  const publishBtn= lower.querySelector("[data-publish]");
  const audioBtn  = lower.querySelector("[data-audio]");
  const imageBtn  = lower.querySelector("[data-image]");
  const imageInput= lower.querySelector("[data-image-input]");
  const preview   = lower.querySelector("[data-preview]");
  const charCount = lower.querySelector(".char-count");
  const recInfo   = lower.querySelector(".rec-info");
  const timerSpan = lower.querySelector(".rec-time");
  const fileSize  = lower.querySelector(".file-size");
  const toggleBtn = toolbar.querySelector('.toggle-mode');

  /* ---- collapsed by default (comments first) ---- */
  let collapsed = true;
  panel.classList.toggle('collapsed', collapsed);
  toggleBtn.textContent = collapsed ? '✎ Escrever' : '🗂️ Comentários';
  toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    panel.classList.toggle('collapsed', collapsed);
    toggleBtn.textContent = collapsed ? '✎ Escrever' : '🗂️ Comentários';
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });

  /* ---- live char counter ---- */
  charCount.textContent = `${textarea.value.length} / 1000`;
  textarea.addEventListener("input", () => {
    charCount.textContent = `${textarea.value.length} / 1000`;
  });

  /* ==== AUDIO record / preview (unchanged logic) ==== */
  let recorder = null, chunks = [];
  let tempBlob = null, tempURL = null;
  let startTime = null, timerId = null, recordingDuration = 0, currentSize = 0;
  recInfo.style.display = "none";

  function resetAudioPreview() {
    if (tempURL) { URL.revokeObjectURL(tempURL); tempURL = null; }
    tempBlob = null;
    const audioWrap = preview.querySelector(".audio-preview");
    if (audioWrap) audioWrap.remove();
  }
  function renderAudioPreview() {
    if (!tempURL) return;
    const old = preview.querySelector(".audio-preview");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.className = "audio-preview";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = ".5rem";

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = tempURL;

    const dur = document.createElement("span");
    dur.textContent = ` ${formatTime(recordingDuration)}`;
    dur.style.fontSize = ".8rem";
    dur.style.color = "#aaa";

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.title = "Excluir a gravação";
    del.onclick = resetAudioPreview;

    wrap.append(audio, dur, del);
    preview.appendChild(wrap);
  }

  function stopRecording(reason = "manual") {
    return new Promise((resolve) => {
      if (!recorder || recorder.state !== "recording") return resolve();
      if (startTime) recordingDuration = Math.floor((Date.now() - startTime) / 1000);

      const onStop = () => {
        recorder.removeEventListener("stop", onStop);
        if (timerId) { clearInterval(timerId); timerId = null; }
        recInfo.style.display = "none";
        audioBtn.textContent = "🗣️ Gravar";
        resolve();
      };
      recorder.addEventListener("stop", onStop, { once: true });

      try {
        recorder.stop();
        if (reason === "size_limit") {
          setTimeout(() => alert("Gravação parou automaticamente antes de atingir o limite de 4 MB."), 400);
        }
      } catch {}
      if (recorder.stream) {
        try { recorder.stream.getTracks().forEach((t) => t.stop()); } catch {}
      }
    });
  }

  audioBtn.addEventListener("click", async () => {
    if (!recorder || recorder.state === "inactive") {
      try {
        resetAudioPreview();
        chunks = []; currentSize = 0; recordingDuration = 0;

        recInfo.style.display = "flex";
        timerSpan.textContent = "00:00";
        fileSize.textContent = "(0 B / 4 MB)";
        fileSize.className = "";

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recorder.stream = stream;

        startTime = Date.now();
        timerId = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          timerSpan.textContent = formatTime(elapsed);
        }, 1000);

        recorder.addEventListener("dataavailable", (e) => {
          if (!e.data || !e.data.size) return;
          chunks.push(e.data);
          currentSize += e.data.size;
          fileSize.textContent = `(${formatFileSize(currentSize)} / 4 MB)`;
          if (currentSize >= CRITICAL_THRESHOLD) {
            fileSize.className = "size-critical";
            stopRecording("size_limit");
          } else if (currentSize >= WARNING_THRESHOLD) {
            fileSize.className = "size-warning";
          } else {
            fileSize.className = "";
          }
        });

        recorder.addEventListener("stop", () => {
          if (timerId) { clearInterval(timerId); timerId = null; }
          if (startTime) recordingDuration = Math.floor((Date.now() - startTime) / 1000);
          startTime = null;
          try { recorder.stream.getTracks().forEach((t) => t.stop()); } catch {}

          tempBlob = new Blob(chunks, { type: "audio/webm" });
          if (tempBlob.size > MAX_AUDIO_BYTES) {
            alert("O áudio é muito grande (máx. 4 MB).");
            resetAudioPreview();
            return;
          }
          tempURL = URL.createObjectURL(tempBlob);
          renderAudioPreview();
        });

        recorder.start(RECORDING_TIMESLICE);
        audioBtn.textContent = "⏹️ Parar";
      } catch (err) {
        alert("Não foi possível acessar o microfone");
        recInfo.style.display = "none";
      }
    } else {
      stopRecording();
    }
  });

  /* ==== Image compress + preview ==== */
  imageBtn.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", async () => {
    const f = imageInput.files && imageInput.files[0];
    if (!f) return;

    try {
      const { blob: comp } = await compressImage(f, {
        maxWidth: 1600, maxHeight: 1600, maxBytes: 400 * 1024,
        preferType: 'image/webp', initialQuality: 0.92,
      });
      if (!comp) { alert("Não foi possível comprimir a imagem."); imageInput.value = ""; return; }

      imageInput._blob = comp;
      if (imageInput._url) URL.revokeObjectURL(imageInput._url);
      imageInput._url = URL.createObjectURL(comp);

      const old = preview.querySelector(".img-preview");
      if (old) old.remove();

      const wrap = document.createElement("div");
      wrap.className = "img-preview";
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = ".5rem";

      const pimg = document.createElement("img");
      pimg.src = imageInput._url;
      pimg.style.maxWidth = "160px";
      pimg.style.maxHeight = "120px";
      pimg.style.objectFit = "contain";
      pimg.style.border = "1px solid var(--border)";
      pimg.style.borderRadius = "4px";

      const del = document.createElement("button");
      del.textContent = "🗑️";
      del.title = "Excluir a imagem";
      del.onclick = () => {
        if (imageInput._url) URL.revokeObjectURL(imageInput._url);
        imageInput._url = null;
        imageInput._blob = null;
        const box = preview.querySelector(".img-preview");
        if (box) box.remove();
        imageInput.value = "";
      };

      wrap.append(pimg, del);
      preview.appendChild(wrap);
    } catch {
      alert("Erro ao processar a imagem.");
      imageInput.value = "";
    }
  });

  /* ==== Messages ==== */
  let currentPage = 0;
  loadMessages(artefactId, upper).then((hasMore) => {
    if (hasMore) loadMoreBtn.style.display = "block";
  });
  loadMoreBtn.addEventListener("click", async () => {
    currentPage++;
    const hasMore = await loadMessages(artefactId, upper, currentPage);
    if (!hasMore) loadMoreBtn.style.display = "none";
  });

  /* ==== Publish ==== */
  publishBtn.addEventListener("click", async () => {
    publishBtn.disabled = true;
    await stopRecording();

    const comment = textarea.value.trim();

    // audio -> base64
    let audioBase64 = null;
    if (tempBlob) {
      if (tempBlob.size === 0 || tempBlob.size > MAX_AUDIO_BYTES) {
        alert("Áudio inválido (vazio ou > 4 MB).");
        publishBtn.disabled = false;
        return;
      }
      audioBase64 = await blobToBase64(tempBlob);
    }

    // image -> dataURL
    let imageBase64 = null;
    const picked = imageInput._blob;
    if (picked) {
      const b64 = await blobToBase64(picked);
      imageBase64 = `data:${picked.type};base64,${b64}`;
    }

    if (!comment && !audioBase64 && !imageBase64) {
      alert("Adicione um comentário, grave um áudio, ou importe uma imagem.");
      publishBtn.disabled = false;
      return;
    }

    const payload = {
      artefact_id: artefactId,
      author: nameInput.value.trim() || "Anônimo",
      comment,
      audioBase64,
      imageBase64,
    };

    try {
      const res = await fetch("/.netlify/functions/add-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} – ${txt}`);

      const json = JSON.parse(txt);
      const { success, id, delete_token } = json;
      if (!success) throw new Error("Falha ao publicar");

      const userMessages = JSON.parse(localStorage.getItem("userMessages") || "{}");
      userMessages[id] = delete_token;
      localStorage.setItem("userMessages", JSON.stringify(userMessages));

      // reset
      textarea.value = "";
      nameInput.value = "";
      resetAudioPreview();
      if (imageInput._url) URL.revokeObjectURL(imageInput._url);
      imageInput._url = null;
      imageInput._blob = null;
      const iPrev = preview.querySelector(".img-preview");
      if (iPrev) iPrev.remove();
      imageInput.value = "";

      // reload list
      Object.keys(messageCache).forEach((k) => k.startsWith(artefactId) && delete messageCache[k]);
      currentPage = 0;
      loadMessages(artefactId, upper).then((hasMore) => {
        loadMoreBtn.style.display = hasMore ? "block" : "none";
      });
    } catch (error) {
      alert("Erro ao publicar: " + error.message);
    } finally {
      publishBtn.disabled = false;
    }
  });
}


/* =========================================================
   GALERIA + INFINITE SCROLL
   ========================================================= */

function loadArtefacts(count = 3) {
  if (isLoading || currentIndex >= IMAGES.length) return;
  isLoading = true;
  loadingIndicator.style.display = "block";

  const nextImages = IMAGES.slice(currentIndex, currentIndex + count);
  currentIndex += count;

  setTimeout(() => {
    nextImages.forEach(renderArtefact);
    isLoading = false;
    loadingIndicator.style.display = "none";
    checkScrollPosition();
  }, 200);
}

function checkScrollPosition() {
  if (isLoading || currentIndex >= IMAGES.length) return;
  const scrollPosition = window.innerHeight + window.scrollY;
  const bodyHeight = document.body.offsetHeight;
  if (scrollPosition > bodyHeight - 500) loadArtefacts();
}
window.addEventListener("scroll", checkScrollPosition);

/* =========================================================
   MODAL MAPA (Leaflet) — Mapa por padrão + DELETE (ao vivo)
   ========================================================= */

let map;                       // instance Leaflet
let osmLayer, esriSatLayer;    // camadas de tiles
let currentMarker = null;      // marcador temporário
let currentArtefactId = null;  // artefato atual
const markersById = new Map(); // id(normalizado) -> marker exibido

/* tokens de exclusão para marcadores do usuário */
function getUserLocationsMap(){
  return JSON.parse(localStorage.getItem('userLocations') || '{}'); // { id: delete_token }
}
function setUserLocationToken(id, token){
  const bag = getUserLocationsMap();
  bag[id] = token;
  localStorage.setItem('userLocations', JSON.stringify(bag));
}
function removeUserLocationToken(id){
  const bag = getUserLocationsMap();
  delete bag[id];
  localStorage.setItem('userLocations', JSON.stringify(bag));
}
function getUserToken(id){
  return getUserLocationsMap()[id] || null;
}

/* --- Icônes de marqueurs (SVG inline) --- */
function svgPin({ fill = '#3b82f6', stroke = '#111827' } = {}) {
  const path = "M16,1 C7.7,1 1,7.7 1,16 c0,10.5 15,31 15,31 s15-20.5 15-31 C31,7.7 24.3,1 16,1 z";
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='32' height='48' viewBox='0 0 32 48'>
      <path d='${path}' fill='${fill}' stroke='${stroke}' stroke-width='2'/>
      <circle cx='16' cy='16' r='5' fill='white' />
    </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const iconOther = L.icon({
  iconUrl: svgPin({ fill: '#3b82f6' }),      // bleu = autres
  iconSize: [32,48], iconAnchor: [16,47], popupAnchor: [0,-40]
});
const iconMine = L.icon({
  iconUrl: svgPin({ fill: '#f59e0b' }),      // orange = mes marqueurs
  iconSize: [32,48], iconAnchor: [16,47], popupAnchor: [0,-40]
});
const iconTemp = L.icon({
  iconUrl: svgPin({ fill: '#10b981' }),      // vert = marqueur temporaire (drag)
  iconSize: [32,48], iconAnchor: [16,47], popupAnchor: [0,-40]
});

async function openMap(artefactId) {
  currentArtefactId = artefactId;
  const modal = document.getElementById('map-modal');
  modal.style.display = 'flex';
  modal.removeAttribute('aria-hidden');
  modal.removeAttribute('inert');
  document.getElementById('closeMap').onclick = closeMap;

  // cria o mapa 1x — default = OSM (Mapa)
  if (!map) {
    osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19
    });
    esriSatLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri", maxZoom: 19 }
    );
    map = L.map("leaflet-container", { center: [-3, -63], zoom: 5, layers: [osmLayer] });
    L.control.layers({ "Mapa": osmLayer, "Satélite": esriSatLayer }).addTo(map);

    // click → coloca/ move marcador temporário (icone vert)
    map.on("click", (e) => {
      if (currentMarker) map.removeLayer(currentMarker);
      currentMarker = L.marker(e.latlng, { draggable: true, icon: iconTemp }).addTo(map);
    });

    // ESC fecha
    document.addEventListener('keydown', (ev) => {
      if (modal.style.display !== 'none' && ev.key === 'Escape') closeMap();
    });
  } else {
    // força OSM ao abrir
    if (!map.hasLayer(osmLayer)) {
      if (map.hasLayer(esriSatLayer)) map.removeLayer(esriSatLayer);
      osmLayer.addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 100);
  }

  // limpa marcadores antigos (mantém tiles)
  map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
  markersById.clear();
  currentMarker = null;

  // carrega pontos existentes
  try {
    const url = `/.netlify/functions/get-locations?artefact=${artefactId}`;
    const res = await fetch(url, { cache: "no-store" });
    const points = res.ok ? await res.json() : [];

    points.forEach((p) => {
      const owned = !!getUserToken(p.id);
      // icône orange si c'est “à moi”, sinon bleu
      const m = L.marker([p.lat, p.lng], { icon: owned ? iconMine : iconOther }).addTo(map);
      const k = keyId(p.id);                    // normalise en string
      markersById.set(k, m);

      const dateStr = new Date(p.created_at).toLocaleDateString();
      const controls = owned
        ? `<div style="margin-top:.4rem"><button class="loc-del" data-id="${k}">🗑️ Excluir</button></div>`
        : "";
      m.bindPopup(`${p.author || "Anônimo"}<br>${dateStr}${controls}`);
    });

    // ajusta bounds
    const liveMarkers = [];
    map.eachLayer(l => { if (!(l instanceof L.TileLayer)) liveMarkers.push(l); });
    if (liveMarkers.length) {
      const grp = L.featureGroup(liveMarkers);
      map.fitBounds(grp.getBounds().pad(0.25));
    } else {
      map.setView([-3, -63], 5);
    }
  } catch (e) {
    console.error("[map] error", e);
  }
}

function closeMap() {
  const modal = document.getElementById('map-modal');
  // a11y: evitar foco oculto
  if (modal.contains(document.activeElement)) {
    document.activeElement.blur();
    document.body.focus?.();
  }
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('inert', '');
  if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
}

/* Salvar novo ponto */
document.getElementById('saveLoc').addEventListener('click', async () => {
  if (!currentMarker) {
    alert("Clique no mapa para escolher o ponto.");
    return;
  }
  const { lat, lng } = currentMarker.getLatLng();
  const author = prompt("Seu nome (opcional)", "") || "Anônimo";
  const payload = { artefact_id: currentArtefactId, lat, lng, author };

  try {
    const res = await fetch("/.netlify/functions/set-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(txt);

    // espera { success, id, delete_token }
    let json = {};
    try { json = JSON.parse(txt); } catch {}
    if (json && json.success && json.id && json.delete_token) {
      setUserLocationToken(json.id, json.delete_token);

      // adiciona imediatamente o novo marcador “do usuário” (icone orange)
      const k = keyId(json.id);
      const m = L.marker([lat, lng], { icon: iconMine }).addTo(map);
      markersById.set(k, m);

      const dateStr = new Date().toLocaleDateString();
      m.bindPopup(`${author || "Anônimo"}<br>${dateStr}
        <div style="margin-top:.4rem"><button class="loc-del" data-id="${k}">🗑️ Excluir</button></div>`);

      map.removeLayer(currentMarker);
      currentMarker = null;
    } else {
      alert("Localização salva!");
      openMap(currentArtefactId); // fallback: recarrega
      return;
    }

    alert("Localização salva!");
  } catch (err) {
    alert("Erro: " + err.message);
  }
});

/* === Listener global (delegado) para excluir marcador === */
if (!window.__locDelBound) {
  window.__locDelBound = true;
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest('.loc-del');
    if (!btn) return;

    const id = btn.dataset.id;              // string desde data-id
    const k  = keyId(id);                   // normalizado (string)

    const token = getUserToken(id);
    if (!token) { alert("Token ausente para este marcador."); return; }
    if (!confirm('Tem certeza que deseja excluir este marcador?')) return;

    try {
      const r = await fetch('/.netlify/functions/delete-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, delete_token: token })
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt);

      // remoção imediata
      const m = markersById.get(k);
      if (m) {
        try { m.closePopup(); } catch {}
        m.remove();
        markersById.delete(k);
      } else {
        // fallback: varre os layers para remover aquele cujo popup contém o data-id
        map.eachLayer(l => {
          if (l instanceof L.Marker && l.getPopup()) {
            const html = l.getPopup().getContent();
            if (typeof html === 'string' && html.includes(`data-id="${k}"`)) {
              l.remove();
            }
          }
        });
      }
      removeUserLocationToken(id);
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  });
}

/* Abrir o mapa ao clicar em “Localizar” (delegação global) */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".loc-btn");
  if (btn) openMap(btn.dataset.artefact);
});


/* =========================================================
   BOOT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  loadArtefacts(); // carrega os 3 primeiros; o infinite scroll faz o resto
});




