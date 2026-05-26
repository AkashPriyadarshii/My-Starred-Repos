/**
 * /.netlify/functions/log-visit
 * Accepts a POST from the public dashboard and writes one visit row to Supabase.
 * SECRETS: SUPABASE_URL and SUPABASE_SERVICE_KEY are Netlify env vars (never committed).
 *
 * Body schema (JSON):
 *   { session_id, timestamp, theme, device, referrer, repo_clicked, duration_ms }
 *
 * Deduplication: session_id has a UNIQUE constraint in Supabase — duplicate POSTs
 * are silently ignored via ON CONFLICT DO NOTHING.
 */

const CORS_ORIGIN = 'https://akashpriyadarshii.github.io';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  // ── Pre-flight ─────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // ── Env guard ───────────────────────────────────────────────
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[log-visit] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
    return {
      statusCode: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Analytics backend not configured' })
    };
  }

  // ── Parse body ──────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const {
    session_id,
    timestamp,
    theme      = null,
    device     = null,
    referrer   = null,
    repo_clicked  = null,
    duration_ms   = 0
  } = body;

  if (!session_id) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'session_id is required' })
    };
  }

  // ── Upsert into Supabase via REST API ───────────────────────
  // ON CONFLICT (session_id) DO UPDATE allows us to patch repo_clicked / duration_ms
  // on a subsequent call from the same session without creating a duplicate row.
  const payload = {
    session_id,
    timestamp: timestamp || new Date().toISOString(),
    theme,
    device,
    referrer,
    repo_clicked,
    duration_ms
  };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/visits?on_conflict=session_id`,
      {
        method: 'POST',
        headers: {
          'apikey':          SUPABASE_SERVICE_KEY,
          'Authorization':   `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':    'application/json',
          'Prefer':          'resolution=merge-duplicates'   // UPSERT
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[log-visit] Supabase error:', res.status, errText);
      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Database write failed' })
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error('[log-visit] Fetch error:', err.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal error' })
    };
  }
};
