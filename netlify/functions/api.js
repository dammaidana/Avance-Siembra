const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = event.headers['x-api-key'] || '';
  if (!apiKey) {
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key requerida' })
    };
  }

  const body = JSON.parse(event.body);
  const userMessage = body.messages[0].content;

  const geminiPayload = JSON.stringify({
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4000 }
  });

  const path = `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(geminiPayload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const geminiResp = JSON.parse(data);
          const text = geminiResp.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
            body: JSON.stringify({ error: 'Error procesando respuesta: ' + e.message })
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message })
      });
    });

    req.write(geminiPayload);
    req.end();
  });
};
