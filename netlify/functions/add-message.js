const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY      // clé secrète
)

exports.handler = async (event) => {
  try {
    const { artefact_id, author, comment, audioBase64 } = JSON.parse(event.body)

    let audio_path = null
    if (audioBase64) {
      const fileName = `${artefact_id}/${Date.now()}.webm`
      const { error } = await supabase
        .storage.from('recordings')
        .upload(fileName, Buffer.from(audioBase64, 'base64'), {
          contentType: 'audio/webm'
        })
      if (error) return { statusCode: 500, body: error.message }
      audio_path = fileName
    }

    const { error } = await supabase
      .from('messages')
      .insert({ artefact_id, author, comment, audio_path })

    if (error) return { statusCode: 500, body: error.message }
    return { statusCode: 200, body: 'ok' }
  } catch (err) {
    return { statusCode: 400, body: 'Bad request' }
  }
}
