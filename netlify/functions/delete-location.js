const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  try {
    const { id, delete_token } = JSON.parse(event.body || '{}');
    if (!id || !delete_token) return { statusCode: 400, body: 'missing fields' };

    const { data: row, error: e1 } = await supabase
      .from('locations')
      .select('id')
      .eq('id', id)
      .eq('delete_token', delete_token)
      .single();

    if (e1 || !row) return { statusCode: 403, body: 'invalid token or id' };

    const { error: e2 } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (e2) return { statusCode: 500, body: e2.message };

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
