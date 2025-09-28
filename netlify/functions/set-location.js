const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const { artefact_id, lat, lng, author } = JSON.parse(event.body || '{}');
    if (!artefact_id || typeof lat !== 'number' || typeof lng !== 'number') {
      return { statusCode: 400, body: 'missing fields' };
    }
    const delete_token = randomUUID();

    const { data, error } = await supabase
      .from('locations')
      .insert({ artefact_id, lat, lng, author, delete_token })
      .select('id, delete_token')
      .single();

    if (error) return { statusCode: 500, body: error.message };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: data.id, delete_token: data.delete_token })
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
