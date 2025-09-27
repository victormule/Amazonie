const { createClient } = require('@supabase/supabase-js')

/* Connexion Supabase (variables d'environnement Netlify) */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY        // rôle service → insert / delete
)

/* Tailles maximales */
const MAX_AUDIO_BYTES = 6 * 1024 * 1024   // 6 Mo
const MAX_IMAGE_BYTES = 800 * 1024        // 800 Ko

exports.handler = async (event) => {
  try {
    const { artefact_id, author, comment, audioBase64, imageBase64 } = JSON.parse(event.body)
    let audio_path = null
    let image_path = null

    /* -------- 1. Vérifier / stocker l'audio éventuel -------- */
    if (audioBase64) {
      const rawBytes = Buffer.byteLength(audioBase64, 'base64')
      if (rawBytes > MAX_AUDIO_BYTES) {
        return { statusCode: 413, body: 'audio too large' }
      }

      try {
        const fileName = `${artefact_id}/aud-${Date.now()}.webm`
        const audioBuffer = Buffer.from(audioBase64, 'base64')

        if (!audioBuffer || audioBuffer.length === 0) {
          return { statusCode: 400, body: 'invalid audio data' }
        }

        const { error: uploadErr } = await supabase
          .storage.from('recordings')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/webm'
          })

        if (uploadErr) {
          console.error('Upload audio error:', uploadErr)
          return { statusCode: 500, body: JSON.stringify({ error: uploadErr.message }) }
        }
        audio_path = fileName
      } catch (uploadError) {
        console.error('Error during audio upload:', uploadError)
        return { statusCode: 500, body: JSON.stringify({ error: uploadError.message }) }
      }
    }

    /* -------- 2. Vérifier / stocker l’image éventuelle -------- */
    if (imageBase64) {
      try {
        // dataURL ou juste base64 : on normalise
        const match = imageBase64.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/i)
        if (!match) {
          return { statusCode: 415, body: 'unsupported image format' }
        }
        const mime = match[1]
        const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg'
                  : mime.includes('webp') ? 'webp'
                  : 'png'
        const b64 = match[3]
        const imgBuffer = Buffer.from(b64, 'base64')

        if (imgBuffer.length > MAX_IMAGE_BYTES) {
          return { statusCode: 413, body: 'image too large' }
        }

        const fileName = `${artefact_id}/img-${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase
          .storage.from('comment-images')
          .upload(fileName, imgBuffer, {
            contentType: mime
          })

        if (uploadErr) {
          console.error('Upload image error:', uploadErr)
          return { statusCode: 500, body: JSON.stringify({ error: uploadErr.message }) }
        }
        image_path = fileName
      } catch (uploadError) {
        console.error('Error during image upload:', uploadError)
        return { statusCode: 500, body: JSON.stringify({ error: uploadError.message }) }
      }
    }

    /* -------- 3. Insérer le message -------- */
    const { data, error: insertErr } = await supabase
      .from('messages')
      .insert({ artefact_id, author, comment, audio_path, image_path })
      .select('id, delete_token')
      .single()

    if (insertErr) {
      console.error('DB insert error:', insertErr)
      return { statusCode: 500, body: insertErr.message }
    }

    /* -------- 4. Réponse OK -------- */
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id: data.id,
        delete_token: data.delete_token
      })
    }
  } catch (e) {
    console.error('Error processing request:', e)
    return { statusCode: 400, body: 'Bad request' }
  }
}

