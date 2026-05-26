/**
 * /api/oauth
 * Swaps a GitHub temporary OAuth code for an access token.
 * For Vercel Serverless Functions.
 */

const https = require('https');

const CORS_ORIGIN = 'https://akashpriyadarshii.github.io';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

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
  // Always wrap in try-catch to guarantee CORS headers are sent on failure (preventing CORS-related "Failed to Fetch")
  try {
    // Handle CORS Pre-flight
    if (req.method === 'OPTIONS') {
      return res.status(200).set(corsHeaders).end();
    }

    // Set response headers
    Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[oauth] Missing environment variables GITHUB_OAUTH_CLIENT_ID or GITHUB_OAUTH_CLIENT_SECRET');
      return res.status(500).json({ error: 'Server configuration error (missing OAuth secrets)' });
    }

    const response = await makeRequest('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 
        'Accept': 'application/json', 
        'Content-Type': 'application/json' 
      }
    }, {
      client_id: clientId,
      client_secret: clientSecret,
      code
    });

    const data = await response.json();
    if (data.error) {
      return res.status(400).json(data);
    }

    if (!data.access_token) {
      return res.status(500).json({ 
        error: 'No access token returned from GitHub', 
        rawResponse: data 
      });
    }

    return res.status(200).json({ access_token: data.access_token });

  } catch (err) {
    console.error('[oauth] Global handler error:', err);
    // Explicitly write headers on error response so browser doesn't block the actual error message with CORS errors
    Object.entries(corsHeaders).forEach(([key, val]) => res.setHeader(key, val));
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: err.message,
      stack: err.stack
    });
  }
};
