const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

exports.handler = async (event) => {
  try {
    const { id, delete_token } = JSON.parse(event.body)
    if (!id || !delete_token) {
      return { statusCode: 400, body: 'missing fields' }
    }

    /* 1. Récupérer la ligne + vérifier le token */
    const { data: msg, error: err1 } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .eq('delete_token', delete_token)
      .single()

    if (err1 || !msg) {
      return { statusCode: 403, body: 'invalid token or id' }
    }

    /* 2. Supprimer la ligne */
    const { error: err2 } = await supabase
      .from('messages')
      .delete()
      .eq('id', id)

    if (err2) {
      return { statusCode: 500, body: err2.message }
    }

    /* 3. Effacer les fichiers associés (audio + image) */
    try {
      if (msg.audio_path) {
        await supabase.storage.from('recordings').remove([msg.audio_path])
      }
      if (msg.image_path) {
        await supabase.storage.from('comment-images').remove([msg.image_path])
      }
    } catch (storageErr) {
      console.error('Storage cleanup error:', storageErr)
      // pas bloquant, on ne renvoie pas d’erreur si la suppression storage échoue
    }

    return { statusCode: 200, body: 'ok' }
  } catch (e) {
    console.error('Delete message error:', e)
    return { statusCode: 500, body: e.message }
  }
}


