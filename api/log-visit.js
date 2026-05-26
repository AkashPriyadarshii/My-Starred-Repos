/**
 * /api/log-visit
 * Accepts a POST from the public dashboard and writes one visit row to Supabase.
 * For Vercel Serverless Functions.
 */

const CORS_ORIGIN = 'https://akashpriyadarshii.github.io';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export default async function handler(req, res) {
  // Handle CORS Pre-flight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(corsHeaders).end();
  }

  // Set response headers
  Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Env guard
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[log-visit] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
    return res.status(503).json({ error: 'Analytics backend not configured' });
  }

  const {
    session_id,
    timestamp,
    theme      = null,
    device     = null,
    referrer   = null,
    repo_clicked  = null,
    duration_ms   = 0
  } = req.body || {};

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

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
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/visits?on_conflict=session_id`,
      {
        method: 'POST',
        headers: {
          'apikey':          SUPABASE_SERVICE_KEY,
          'Authorization':   `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':    'application/json',
          'Prefer':          'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[log-visit] Supabase error:', response.status, errText);
      return res.status(502).json({ error: 'Database write failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[log-visit] Fetch error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
