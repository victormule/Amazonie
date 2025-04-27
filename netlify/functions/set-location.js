const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // rôle service
);

exports.handler = async (event) => {
  try {
    const { artefact_id, lat, lng, author } = JSON.parse(event.body);

    if (!artefact_id || !lat || !lng)
      return { statusCode: 400, body: 'missing fields' };

    // upsert : insert ou remplace
    const { error } = await supabase.from('locations').insert({
      artefact_id, lat, lng, author
    });

    if (error)  return { statusCode: 500, body: error.message };

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
