const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key no configurada en el servidor' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Body inválido: ' + e.message })
    };
  }

  const userMessage = body.messages[0].content;

  const payload = JSON.stringify({
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 4000,
    temperature: 0.1
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://avance-siembra.netlify.app',
        'X-Title': 'Avance Siembra Parser',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (!data || data.trim() === '') {
          resolve({
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Respuesta vacía (status ' + res.statusCode + ')' })
          });
          return;
        }
        try {
          const resp = JSON.parse(data);
          if (resp.error) {
            resolve({
              statusCode: 400,
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'OpenRouter: ' + (resp.error.message || JSON.stringify(resp.error)) })
            });
            return;
          }
          const text = resp.choices?.[0]?.message?.content || '';
          resolve({
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ content: [{ type: 'text', text: text }] })
          });
        } catch(e) {
          resolve({
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Parse error: ' + e.message + ' | Raw: ' + data.substring(0,300) })
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Request error: ' + e.message })
      });
    });

    req.write(payload);
    req.end();
  });
};
