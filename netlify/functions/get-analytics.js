/**
 * /.netlify/functions/get-analytics
 * Returns all visit rows from Supabase for the admin dashboard.
 * Protected by ADMIN_SECRET header check so only the dashboard can read it.
 *
 * GET /.netlify/functions/get-analytics
 * Headers: { x-admin-secret: <value of ADMIN_SECRET env var> }
 *
 * Query params (optional):
 *   ?from=YYYY-MM-DD   filter visits >= this date
 *   ?to=YYYY-MM-DD     filter visits <= this date
 *
 * SECRETS: SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_SECRET — all Netlify env vars.
 */

const CORS_ORIGIN = 'https://akashpriyadarshii.github.io';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event) => {
  // ── Pre-flight ─────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // ── Env guard ───────────────────────────────────────────────
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Analytics backend not configured' })
    };
  }

  // ── Auth guard ──────────────────────────────────────────────
  const providedSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  if (!ADMIN_SECRET || providedSecret !== ADMIN_SECRET) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // ── Build Supabase query ────────────────────────────────────
  const { from, to } = event.queryStringParameters || {};
  let url = `${SUPABASE_URL}/rest/v1/visits?select=*&order=timestamp.desc&limit=10000`;
  if (from) url += `&timestamp=gte.${encodeURIComponent(from + 'T00:00:00Z')}`;
  if (to)   url += `&timestamp=lte.${encodeURIComponent(to   + 'T23:59:59Z')}`;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[get-analytics] Supabase error:', res.status, errText);
      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Database read failed' })
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('[get-analytics] Fetch error:', err.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal error' })
    };
  }
};
