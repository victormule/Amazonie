const { createClient } = require('@supabase/supabase-js')

/* Connexion Supabase (variables d’environnement Netlify) */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY        // rôle service → insert / delete
)

/* Taille maximale du son : 5 Mo */
const MAX_BYTES = 5 * 1024 * 1024         // 5 × 1024 × 1024 octets

exports.handler = async (event) => {
  try {
    const { artefact_id, author, comment, audioBase64 } = JSON.parse(event.body)

    /* -------- 1. Vérifier / stocker l’audio éventuel -------- */
if (audioBase64) {
  /* taille réelle du fichier (après décodage base64) */
  const rawBytes = Buffer.byteLength(audioBase64, 'base64')
  if (rawBytes > MAX_BYTES) {
    return { statusCode: 413, body: 'audio too large' } // 413 = Payload Too Large
  }

  try {
    const fileName = `${artefact_id}/${Date.now()}.webm`
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    
    // Vérifier que le buffer est valide
    if (!audioBuffer || audioBuffer.length === 0) {
      return { statusCode: 400, body: 'invalid audio data' }
    }
    
    const { error: uploadErr } = await supabase
      .storage.from('recordings')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/webm'
      })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return { statusCode: 500, body: JSON.stringify({ error: uploadErr.message }) }
    }
    audio_path = fileName
  } catch (uploadError) {
    console.error('Error during upload:', uploadError)
    return { statusCode: 500, body: JSON.stringify({ error: uploadError.message }) }
  }
}

    /* -------- 2. Insérer le message et récupérer id + delete_token -------- */
    const { data, error: insertErr } = await supabase
      .from('messages')
      .insert({ artefact_id, author, comment, audio_path })
      .select('id, delete_token')
      .single()

    if (insertErr) {
      return { statusCode: 500, body: insertErr.message }
    }

    /* -------- 3. Réponse OK -------- */
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id: data.id,
        delete_token: data.delete_token
      })
    }
  } catch (e) {
    return { statusCode: 400, body: 'Bad request' }
  }
}

