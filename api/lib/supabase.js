const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

function getSupabaseAdminClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}

async function insertOrder(orderRecord) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('orders').insert([orderRecord]);
  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
}

async function findOrderBySessionId(stripeSessionId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, stripe_session_id, status')
    .eq('stripe_session_id', stripeSessionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase read failed: ${error.message}`);
  }

  return data || null;
}

module.exports = {
  getSupabaseAdminClient,
  insertOrder,
  findOrderBySessionId,
};
