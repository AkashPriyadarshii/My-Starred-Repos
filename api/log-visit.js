/**
 * /api/log-visit
 * Accepts a POST from the public dashboard and writes one visit row to Supabase.
 * For Vercel Serverless Functions.
 */

const https = require('https');

function getCorsHeaders(req) {
  const allowedOrigins = [
    'https://akashpriyadarshii.github.io',
    'http://localhost',
    'http://127.0.0.1'
  ];
  const origin = req.headers.origin;
  let corsOrigin = 'https://akashpriyadarshii.github.io'; // fallback
  
  if (origin) {
    const isAllowed = allowedOrigins.some(ao => origin.startsWith(ao)) || origin === 'null';
    if (isAllowed) {
      corsOrigin = origin;
    }
  }
  
  return {
    'Access-Control-Allow-Origin':  corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    // Prepare headers and calculate content length if body exists
    const headers = { ...(options.headers || {}) };
    const reqBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    
    if (reqBody) {
      headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: 443,
      method: options.method || 'GET',
      headers: headers
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => {
            try {
              return Promise.resolve(JSON.parse(data));
            } catch {
              return Promise.resolve({});
            }
          }
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

module.exports = async function handler(req, res) {
  const corsHeaders = getCorsHeaders(req);

  try {
    // Handle CORS Pre-flight
    if (req.method === 'OPTIONS') {
      Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));
      return res.status(200).end();
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

    const response = await makeRequest(
      `${SUPABASE_URL}/rest/v1/visits?on_conflict=session_id`,
      {
        method: 'POST',
        headers: {
          'apikey':          SUPABASE_SERVICE_KEY,
          'Authorization':   `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':    'application/json',
          'Prefer':          'resolution=merge-duplicates'
        }
      },
      payload
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[log-visit] Supabase error:', response.status, errText);
      return res.status(502).json({ error: 'Database write failed' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[log-visit] Global handler error:', err);
    Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: err.message,
      stack: err.stack
    });
  }
};
