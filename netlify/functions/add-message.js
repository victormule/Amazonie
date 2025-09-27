const { createClient } = require('@supabase/supabase-js');

/* Connexion Supabase (variables d'environnement Netlify) */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service_role (server only)
);

/* Constantes */
const MAX_AUDIO_BYTES = 6 * 1024 * 1024; // 6 Mo
const MAX_IMAGE_BYTES = 800 * 1024;      // 800 Ko
const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

/* Preflight CORS */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...HEADERS,
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    /* ---------- 0) Parse & validation d’entrée ---------- */
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Bad JSON' }) };
    }

    let { artefact_id, author, comment, audioBase64, imageBase64 } = payload;

    artefact_id = (artefact_id || '').toString().trim();
    author      = (author || '').toString().trim();
    comment     = (comment || '').toString().trim();

    if (!artefact_id) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'artefact_id is required' }) };
    }

    // autoriser publication avec au moins un des trois
    if (!comment && !audioBase64 && !imageBase64) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'nothing to publish' }) };
    }

    // petites limites côté serveur
    if (author.length > 50)   author  = author.slice(0, 50);
    if (comment.length > 1000) comment = comment.slice(0, 1000);

    let audio_path = null;
    let image_path = null;

    /* ---------- 1) Upload AUDIO (optionnel) ---------- */
    if (audioBase64) {
      // côté front tu envoies du base64 "pur" (pas dataURL) → OK
      const rawBytes = Buffer.byteLength(audioBase64, 'base64');
      if (rawBytes > MAX_AUDIO_BYTES) {
        return { statusCode: 413, headers: HEADERS, body: JSON.stringify({ error: 'audio too large' }) };
      }

      const audioBuffer = Buffer.from(audioBase64, 'base64');
      if (!audioBuffer.length) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid audio data' }) };
      }

      const fileName = `${artefact_id}/aud-${Date.now()}.webm`;
      const { error: uploadErr } = await supabase
        .storage.from('recordings')
        .upload(fileName, audioBuffer, { contentType: 'audio/webm' });

      if (uploadErr) {
        console.error('Upload audio error:', uploadErr);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: uploadErr.message }) };
      }
      audio_path = fileName;
    }

    /* ---------- 2) Upload IMAGE (optionnel) ---------- */
    if (imageBase64) {
      // attendu: dataURL "data:image/png|jpeg|webp;base64,...."
      const m = imageBase64.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/i);
      if (!m) {
        return { statusCode: 415, headers: HEADERS, body: JSON.stringify({ error: 'unsupported image format' }) };
      }
      const mime = m[1];
      const ext  = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg'
                 : mime.includes('webp') ? 'webp'
                 : 'png';
      const b64  = m[3];

      const imgBuffer = Buffer.from(b64, 'base64');
      if (imgBuffer.length > MAX_IMAGE_BYTES) {
        return { statusCode: 413, headers: HEADERS, body: JSON.stringify({ error: 'image too large' }) };
      }

      const fileName = `${artefact_id}/img-${Date.now()}.${ext}`;
      const { error: imgErr } = await supabase
        .storage.from('comment-images')
        .upload(fileName, imgBuffer, { contentType: mime });

      if (imgErr) {
        console.error('Upload image error:', imgErr);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: imgErr.message }) };
      }
      image_path = fileName;
    }

    /* ---------- 3) Insert DB ---------- */
    const { data, error: insertErr } = await supabase
      .from('messages')
      .insert({ artefact_id, author, comment, audio_path, image_path })
      .select('id, delete_token')
      .single();

    if (insertErr) {
      console.error('DB insert error:', insertErr);
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: insertErr.message }) };
    }

    /* ---------- 4) Réponse ---------- */
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, id: data.id, delete_token: data.delete_token })
    };

  } catch (e) {
    console.error('Error processing request:', e);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message || 'server error' }) };
  }
};

