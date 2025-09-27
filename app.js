/* =========================================================
   Quai Branly – Memória & Alma
   App JS (frontend)
   ========================================================= */

/* ======= CONFIG ======= */
const SUPABASE_URL = "https://mzcepywscpmbzvcouwuj.supabase.co";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;     // 4 MB (frontend)
const WARNING_THRESHOLD = 0.8 * MAX_AUDIO_BYTES;
const CRITICAL_THRESHOLD = 0.95 * MAX_AUDIO_BYTES;
const RECORDING_TIMESLICE = 1000;            // ms

// Artefacts de la galerie
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

/* ======= STATE ======= */
const gallery = $("#gallery");
const loadingIndicator = $("#loading-indicator");
const messageCache = {};     // { `${artefactId}-${page}` : [messages] }
let currentIndex = 0;        // pour la galerie
let isLoading = false;

/* =========================================================
   RENDER DES MESSAGES
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

    // Audio (lazy)
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

    // Image
    if (m.image_path) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "comment-media";
      const img = document.createElement("img");
      img.src = `${SUPABASE_URL}/storage/v1/object/public/comment-images/${m.image_path}`;
      img.alt = "imagem do comentário";
      imgWrap.appendChild(img);
      div.appendChild(imgWrap);
    }

    // Bouton supprimer si message de l'utilisateur
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
   RENDER D’UN ARTEFACT (image + panneau de commentaires)
   ========================================================= */

function renderArtefact({ src, alt }) {
  const artefactId = src.split("/").pop();

  const row = document.createElement("div");
  row.className = "artefact";

  const img = document.createElement("img");
  img.alt = alt;
  img.src = src;
  img.loading = "lazy";
  row.appendChild(img);

  const panel = document.createElement("div");
  panel.className = "panel";

  const upper = document.createElement("div");
  upper.className = "panel-upper";
  panel.appendChild(upper);

  const lower = document.createElement("div");
  lower.className = "panel-lower";
  lower.innerHTML = `
    <input type="text" placeholder="Seu nome (opcional)" maxlength="50" />
    <textarea placeholder="Adicionar um comentário…" maxlength="1000"></textarea>
    <div class="char-count">0 / 1000</div>

    <button data-publish>Publicar</button>
    <button style="margin-left:.5rem" data-audio>🗣️ Gravar</button>
    <button style="margin-left:.5rem" data-image>🖼️ Importar imagem</button>
    <input type="file" accept="image/png,image/jpeg,image/webp" data-image-input style="display:none" />

    <button style="margin-left:.5rem" class="loc-btn" data-artefact="${artefactId}">📍 Localizar</button>

    <div class="rec-info"><span class="rec-time"></span><span class="file-size"></span></div>
    <div class="preview" data-preview></div>
  `;
  panel.appendChild(lower);
  row.appendChild(panel);
  gallery.appendChild(row);

  // Bouton charger plus
  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.textContent = "Carregar mais comentários";
  loadMoreBtn.className = "load-more-comments";
  loadMoreBtn.style.display = "none";
  upper.after(loadMoreBtn);

  // Références
  const nameInput = lower.querySelector("input");
  const textarea = lower.querySelector("textarea");
  const publishBtn = lower.querySelector("[data-publish]");
  const audioBtn = lower.querySelector("[data-audio]");
  const imageBtn = lower.querySelector("[data-image]");
  const imageInput = lower.querySelector("[data-image-input]");
  const preview = lower.querySelector("[data-preview]");
  const charCount = lower.querySelector(".char-count");
  const recInfo = lower.querySelector(".rec-info");
  const timerSpan = lower.querySelector(".rec-time");
  const fileSize = lower.querySelector(".file-size");

  /* ---- State local pour CE panneau ---- */
  let currentPage = 0;

  // Audio
  let recorder = null, chunks = [];
  let tempBlob = null, tempURL = null;
  let startTime = null, timerId = null, recordingDuration = 0, currentSize = 0;

  // Image
  let tempImageBlob = null, tempImageURL = null;

  /* ---- UI : compteur caractères ---- */
  charCount.textContent = `${textarea.value.length} / 1000`;
  textarea.addEventListener("input", () => {
    charCount.textContent = `${textarea.value.length} / 1000`;
  });

  /* ---- Préviews : audio (n’efface pas l’image) ---- */
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

  /* ---- Préviews : image ---- */
  function resetImagePreview() {
    if (tempImageURL) URL.revokeObjectURL(tempImageURL);
    tempImageURL = null;
    tempImageBlob = null;
    const box = preview.querySelector(".img-preview");
    if (box) box.remove();
  }
  function renderImagePreview() {
    resetImagePreview();
    if (!tempImageBlob) return;
    tempImageURL = URL.createObjectURL(tempImageBlob);

    const wrap = document.createElement("div");
    wrap.className = "img-preview";

    const img = document.createElement("img");
    img.src = tempImageURL;
    img.style.maxWidth = "160px";
    img.style.maxHeight = "120px";
    img.style.objectFit = "contain";
    img.style.border = "1px solid var(--border)";
    img.style.borderRadius = "4px";

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.title = "Excluir a imagem";
    del.onclick = resetImagePreview;

    wrap.append(img, del);
    preview.appendChild(wrap);
  }

  imageBtn.addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    const f = imageInput.files && imageInput.files[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
      alert("Formato não suportado. Use PNG, JPG ou WebP.");
      imageInput.value = "";
      return;
    }
    const MAX_IMAGE_BYTES = 800 * 1024;
    if (f.size > MAX_IMAGE_BYTES) {
      alert("Imagem muito pesada (máx. 800KB).");
      imageInput.value = "";
      return;
    }
    tempImageBlob = f;
    renderImagePreview();
  });

  /* ---- Audio : enregistrement ---- */
  recInfo.style.display = "none";

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
            alert("O áudio é muito grande (máx. 4 MB). Grave novamente.");
            resetAudioPreview();
            return;
          }
          tempURL = URL.createObjectURL(tempBlob);
          renderAudioPreview();
        });

        recorder.start(RECORDING_TIMESLICE);
        audioBtn.textContent = "⏹️ Parar";
      } catch (err) {
        console.error("microfone:", err);
        alert("Não foi possível acessar o microfone");
        recInfo.style.display = "none";
      }
    } else {
      stopRecording();
    }
  });

  /* ---- Charger les messages ---- */
  loadMessages(artefactId, upper).then((hasMore) => {
    if (hasMore) loadMoreBtn.style.display = "block";
  });
  loadMoreBtn.addEventListener("click", async () => {
    currentPage++;
    const hasMore = await loadMessages(artefactId, upper, currentPage);
    if (!hasMore) loadMoreBtn.style.display = "none";
  });

  /* ---- Publier ---- */
  publishBtn.addEventListener("click", async () => {
    publishBtn.disabled = true;
    await stopRecording();

    const comment = textarea.value.trim();

    // audio -> base64 pur
    let audioBase64 = null;
    if (tempBlob) {
      if (tempBlob.size === 0) {
        alert("Áudio vazio / corrompido. Grave novamente.");
        publishBtn.disabled = false;
        return;
      }
      if (tempBlob.size > MAX_AUDIO_BYTES) {
        alert("O áudio é muito grande (máx. 4 MB).");
        publishBtn.disabled = false;
        return;
      }
      audioBase64 = await blobToBase64(tempBlob);
    }

    // image -> dataURL
    let imageBase64 = null;
    if (tempImageBlob) {
      const b64 = await blobToBase64(tempImageBlob);
      imageBase64 = `data:${tempImageBlob.type};base64,${b64}`;
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

    console.log(
      "Envoi des données:",
      audioBase64 ? "(audio)" : "sans audio",
      imageBase64 ? "+ image" : ""
    );

    try {
      const res = await fetch("/.netlify/functions/add-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Erreur serveur (${res.status}): ${t}`);
      }
      const { success, id, delete_token } = await res.json();
      if (!success) throw new Error("Réponse invalide");

      // Mémoriser le token de suppression
      const userMessages = JSON.parse(localStorage.getItem("userMessages") || "{}");
      userMessages[id] = delete_token;
      localStorage.setItem("userMessages", JSON.stringify(userMessages));

      // Reset UI
      textarea.value = "";
      nameInput.value = "";
      resetAudioPreview();
      resetImagePreview();
      imageInput.value = "";

      // Invalider le cache & recharger
      Object.keys(messageCache).forEach((k) => k.startsWith(artefactId) && delete messageCache[k]);
      currentPage = 0;
      loadMessages(artefactId, upper).then((hasMore) => {
        loadMoreBtn.style.display = hasMore ? "block" : "none";
      });
    } catch (error) {
      console.error("Erro ao publicar:", error);
      alert("Erro ao publicar: " + error.message);
    } finally {
      publishBtn.disabled = false;
    }
  });
}

/* =========================================================
   GALERIE + INFINITE SCROLL
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
   MODALE CARTE (Leaflet)
   ========================================================= */

let map;                       // instance Leaflet
let drawnMarkers = [];         // marqueurs existants enregistrés
let currentMarker = null;      // marqueur en cours de placement
let currentArtefactId = null;  // artefact courant

async function openMap(artefactId) {
  currentArtefactId = artefactId;
  const modal = $("#map-modal");
  modal.style.display = "flex";

  $("#closeMap").onclick = closeMap;

  // Init carte 1 seule fois
  if (!map) {
    // couches
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    });
    const esriSat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri", maxZoom: 19 }
    );
    map = L.map("leaflet-container", {
      center: [-3, -63],
      zoom: 5,
      layers: [esriSat],
    });
    L.control.layers({ Carte: osm, Satellite: esriSat }).addTo(map);
    map.on("click", (e) => {
      if (currentMarker) map.removeLayer(currentMarker);
      currentMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
    });
  } else {
    setTimeout(() => map.invalidateSize(), 100);
  }

  // Purge des anciennes couches (hors tuiles)
  map.eachLayer((l) => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
  drawnMarkers = [];
  currentMarker = null;

  // Charger points existants
  try {
    const res = await fetch(`/.netlify/functions/get-locations?artefact=${artefactId}`, { cache: "no-store" });
    const points = res.ok ? await res.json() : [];
    points.forEach((p) => {
      const m = L.marker([p.lat, p.lng]).addTo(map)
        .bindPopup(`${p.author || "Anônimo"}<br>${new Date(p.created_at).toLocaleDateString()}`);
      drawnMarkers.push(m);
    });
    if (points.length) {
      const group = L.featureGroup(drawnMarkers);
      map.fitBounds(group.getBounds().pad(0.25));
    } else {
      map.setView([-3, -63], 5);
    }
  } catch (e) {
    console.error(e);
  }
}

function closeMap() {
  $("#map-modal").style.display = "none";
  if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
}

$("#saveLoc").addEventListener("click", async () => {
  if (!currentMarker) {
    alert("Clique na carta para escolher o ponto.");
    return;
  }
  const { lat, lng } = currentMarker.getLatLng();
  const author = prompt("Seu nome (opcional)", "") || "Anônimo";

  const res = await fetch("/.netlify/functions/set-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artefact_id: currentArtefactId, lat, lng, author }),
  });

  if (res.ok) {
    alert("Localização salva!");
    currentMarker = null;
    closeMap();
  } else {
    alert("Erro: " + (await res.text()));
  }
});

/* Délégation de clic pour les boutons localisation créés dynamiquement */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".loc-btn");
  if (btn) openMap(btn.dataset.artefact);
});

/* =========================================================
   BOOT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  loadArtefacts(); // charge les 3 premiers; l’infinite scroll fera le reste
});
