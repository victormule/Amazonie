const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY       // lecture publique
)

exports.handler = async (event) => {
  try {
    const artefact = event.queryStringParameters.artefact
    if (!artefact) {
      return { statusCode: 400, body: 'artefact query param missing' }
    }

    // ----- pagination -----
    const limit = parseInt(event.queryStringParameters.limit || '20', 10)
    const page  = parseInt(event.queryStringParameters.page  || '1', 10)
    const from  = (page - 1) * limit
    const to    = from + limit - 1
    // -----------------------

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('artefact_id', artefact)
      .order('created_at', { ascending: true })
      .range(from, to)                 // <-- renvoie de `from` à `to`

    if (error) throw error
    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (err) {
    return { statusCode: 500, body: err.message }
  }
}
