const axios = require('axios');

// Groq exposes an OpenAI-compatible Chat Completions endpoint, so no SDK is
// needed — any other OpenAI-compatible provider (or OpenAI itself) could
// reuse this exact same module shape with a different baseUrl/key/model.
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * @param {{ system: string, user: string, jsonMode?: boolean }} params
 * @returns {Promise<string>} the raw assistant message content
 */
async function chatComplete({ system, user, jsonMode = false }) {
  if (!API_KEY) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  const res = await axios.post(
    API_URL,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    },
    {
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    }
  );
  return res.data?.choices?.[0]?.message?.content ?? '';
}

module.exports = { chatComplete, name: 'groq', model: MODEL };
