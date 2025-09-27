const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY         // lecture publique
)

exports.handler = async (event) => {
  const artefact = event.queryStringParameters.artefact;
  const page = parseInt(event.queryStringParameters.page || '0');
  const limit = parseInt(event.queryStringParameters.limit || '10');
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('artefact_id', artefact)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) return { statusCode: 500, body: error.message };
  return { statusCode: 200, body: JSON.stringify(data) };
}

console.log('SUPABASE_URL =', process.env.SUPABASE_URL);
console.log('ANON length =', (process.env.SUPABASE_ANON_KEY || '').length);
