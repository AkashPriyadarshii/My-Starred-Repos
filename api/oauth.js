/**
 * /api/oauth
 * Swaps a GitHub temporary OAuth code for an access token.
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

  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 
        'Accept': 'application/json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(400).json(data);
    }

    return res.status(200).json({ access_token: data.access_token });
  } catch (err) {
    console.error('[oauth] Exchange error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
