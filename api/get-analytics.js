/**
 * /api/get-analytics
 * Returns all visit rows from Supabase for the admin dashboard.
 * For Vercel Serverless Functions.
 */

const https = require('https');

const CORS_ORIGIN = 'https://akashpriyadarshii.github.io';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: 443,
      method: options.method || 'GET',
      headers: options.headers || {}
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

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // Handle CORS Pre-flight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(corsHeaders).end();
  }

  // Set response headers
  Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Env guard
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Analytics backend not configured' });
  }

  // Auth guard
  const providedSecret = req.headers['x-admin-secret'] || req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || providedSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Build Supabase query
  const { from, to } = req.query || {};
  let url = `${SUPABASE_URL}/rest/v1/visits?select=*&order=timestamp.desc&limit=10000`;
  if (from) url += `&timestamp=gte.${encodeURIComponent(from + 'T00:00:00Z')}`;
  if (to)   url += `&timestamp=lte.${encodeURIComponent(to   + 'T23:59:59Z')}`;

  try {
    const response = await makeRequest(url, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[get-analytics] Supabase error:', response.status, errText);
      return res.status(502).json({ error: 'Database read failed' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[get-analytics] Fetch error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};
