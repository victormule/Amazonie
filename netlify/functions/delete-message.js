const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY     // rôle service pour DELETE + storage
)

exports.handler = async (event) => {
  try {
    const { id, delete_token } = JSON.parse(event.body)

    if (!id || !delete_token) {
      return { statusCode: 400, body: 'missing id or token' }
    }

    // Fournir le token à la policy via le header JWT virtual claim
    supabase.auth.setAuth(`anon`, { delete_token })

    // 1) récupérer la ligne pour connaître audio_path
    const { data: msg, error: err1 } = await supabase
      .from('messages').select('*').eq('id', id).single()

    if (err1) return { statusCode: 404, body: 'not found' }

    // 2) supprimer la ligne (policy vérifie le token)
    const { error: err2 } = await supabase
      .from('messages').delete().eq('id', id)

    if (err2) return { statusCode: 403, body: 'invalid token' }

    // 3) supprimer le fichier audio si présent
    if (msg.audio_path) {
      await supabase.storage.from('recordings').remove([msg.audio_path])
    }

    return { statusCode: 200, body: 'ok' }
  } catch (e) {
    return { statusCode: 500, body: e.message }
  }
}
