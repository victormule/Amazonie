const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto') 


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
    const delete_token = randomUUID()
    const { data, error } = await supabase
    .from('messages')
    .insert({ artefact_id, author, comment, audio_path, delete_token })
    .select('id')                                // ← récupérer l’id
    
    if (error) return { statusCode: 500, body: error.message }
    return {
    statusCode: 200,
    body: JSON.stringify({ success: true, id: data[0].id, delete_token })
   }
  } catch (err) {
    return { statusCode: 400, body: 'Bad request' }
  }
}
