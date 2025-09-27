const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Limites
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;   // 6MB (backend)
const MAX_IMAGE_BYTES = 800 * 1024;        // 800KB (backend)

exports.handler = async (event) => {
  const HEADERS = { 'Content-Type': 'application/json' };
  try {
    console.log("ADD-MESSAGE v3  bodyLen=", event.body ? event.body.length : 0);

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      console.error("JSON parse error:", e);
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "invalid json" }) };
    }

    const { artefact_id, author, comment, audioBase64, imageBase64 } = payload;
    console.log("fields:", { artefact_id, hasAudio: !!audioBase64, hasImage: !!imageBase64 });

    let audio_path = null;
    let image_path = null;

    /* --------- AUDIO --------- */
    if (audioBase64) {
      const rawBytes = Buffer.byteLength(audioBase64, 'base64');
      console.log("audio bytes(base64-decoded) =", rawBytes);
      if (rawBytes > MAX_AUDIO_BYTES) {
        return { statusCode: 413, headers: HEADERS, body: JSON.stringify({ error: 'audio too large' }) };
      }
      try {
        const fileName = `${artefact_id}/aud-${Date.now()}.webm`;
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        if (!audioBuffer || !audioBuffer.length) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid audio data' }) };
        }
        const { error: upErr } = await supabase
          .storage.from('recordings')
          .upload(fileName, audioBuffer, { contentType: 'audio/webm' });

        if (upErr) {
          console.error("audio upload error:", upErr);
          return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: upErr.message }) };
        }
        audio_path = fileName;
        console.log("audio uploaded ->", audio_path);
      } catch (e) {
        console.error("audio upload exception:", e);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
      }
    }

    /* --------- IMAGE --------- */
    if (imageBase64) {
      try {
        console.log("image prefix:", imageBase64.slice(0, 40));
        let mime = 'image/jpeg';
        let ext = 'jpg';
        let b64 = imageBase64;

        const m = imageBase64.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/i);
        if (m) {
          mime = m[1];
          ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
          b64 = m[3];
          console.log("image detected as dataURL:", mime, "ext:", ext);
        } else {
          console.log("image looks like raw base64; will assume jpeg");
        }

        const imgBuffer = Buffer.from(b64, 'base64');
        console.log("image decoded bytes =", imgBuffer.length);
        if (!imgBuffer.length) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid image data' }) };
        }
        if (imgBuffer.length > MAX_IMAGE_BYTES) {
          return { statusCode: 413, headers: HEADERS, body: JSON.stringify({ error: 'image too large' }) };
        }

        const fileName = `${artefact_id}/img-${Date.now()}.${ext}`;
        const { error: imgErr } = await supabase
          .storage.from('comment-images')
          .upload(fileName, imgBuffer, { contentType: mime });

        if (imgErr) {
          console.error("image upload error:", imgErr);
          return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: imgErr.message }) };
        }
        image_path = fileName;
        console.log("image uploaded ->", image_path);
      } catch (e) {
        console.error("image upload exception:", e);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
      }
    }

    /* --------- DB INSERT --------- */
    const row = { artefact_id, author, comment, audio_path, image_path };
    console.log("DB insert row =", row);

    const { data, error: insertErr } = await supabase
      .from('messages')
      .insert(row)
      .select('id, delete_token, image_path, audio_path')
      .single();

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: insertErr.message }) };
    }

    console.log("DB inserted id =", data.id, "image_path =", data.image_path, "audio_path =", data.audio_path);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, id: data.id, delete_token: data.delete_token })
    };
  } catch (e) {
    console.error("TOP-LEVEL ERROR:", e);
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: e.message || 'server error' };
  }
};



