exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://akashpriyadarshii.github.io',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  const { code } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, body: JSON.stringify({ error: 'Missing code' }) };

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code
    })
  });

  const data = await response.json();
  if (data.error) return {
    statusCode: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://akashpriyadarshii.github.io' },
    body: JSON.stringify(data)
  };

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://akashpriyadarshii.github.io',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_token: data.access_token })
  };
};
