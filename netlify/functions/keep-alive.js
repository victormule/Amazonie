// netlify/functions/keep-alive.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // un simple select, donc anon suffit
);

exports.handler = async () => {
  try {
    // On fait une requête ultra légère
    const { error } = await supabase.from('messages').select('id').limit(1);

    if (error) {
      console.error('Keep-alive error:', error);
      return { statusCode: 500, body: 'Ping failed: ' + error.message };
    }

    return { statusCode: 200, body: 'Supabase pinged successfully!' };
  } catch (e) {
    console.error('Keep-alive crash:', e);
    return { statusCode: 500, body: 'Unexpected error: ' + e.message };
  }
};
