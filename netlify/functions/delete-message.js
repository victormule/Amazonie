const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

exports.handler = async (event) => {
  try {
    const { id, delete_token } = JSON.parse(event.body)
    if (!id || !delete_token) return { statusCode: 400, body: 'missing fields' }

    /* 1. Récupérer la ligne + vérifier le token */
    const { data: msg, error: err1 } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .eq('delete_token', delete_token)
      .single()

    if (err1) return { statusCode: 403, body: 'invalid token or id' }

    /* 2. Supprimer la ligne */
    const { error: err2 } = await supabase
      .from('messages')
      .delete()
      .eq('id', id)

    if (err2) return { statusCode: 500, body: err2.message }

    /* 3. Effacer l’audio */
    if (msg.audio_path) {
      await supabase.storage.from('recordings').remove([msg.audio_path])
    }

    return { statusCode: 200, body: 'ok' }
  } catch (e) {
    return { statusCode: 500, body: e.message }
  }
}

