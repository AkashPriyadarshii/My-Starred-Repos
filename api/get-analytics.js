/**
 * /api/get-analytics
 * Returns all visit rows from Supabase for the admin dashboard.
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
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    console.error('[get-analytics] Global handler error:', err);
    Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: err.message,
      stack: err.stack
    });
  }
};
