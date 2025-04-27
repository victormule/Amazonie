// netlify/functions/get-location.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const artefact = event.queryStringParameters.artefact;
  const { data, error } = await supabase
       .from('locations')
       .select('*')
       .eq('artefact_id', artefact)
       .single();
  if (error) return { statusCode: 404, body: '{}' };
  return { statusCode: 200, body: JSON.stringify(data) };
};
