const axios = require('axios');
const env = require('../../config/env');

// Ad-hoc string translations (e.g. video titles) don't change once
// translated, so cache them in memory for the life of the process —
// avoids re-hitting backend-fastapi/libretranslate every time a client
// toggles a title or reloads the library.
const cache = new Map();

function cacheKey(text, source, target) {
    return `${source}::${target}::${text}`;
}

async function translate(text, { source = 'zh', target = 'en' } = {}) {
    if (!text || !text.trim()) {
        const err = new Error('text is required');
        err.status = 400;
        throw err;
    }

    const key = cacheKey(text, source, target);
    if (cache.has(key)) return { translatedText: cache.get(key), cached: true };

    if (!env.PYTHON_API) {
        const err = new Error('Translation service is not configured (PYTHON_API missing)');
        err.status = 503;
        throw err;
    }

    const response = await axios.get(`${env.PYTHON_API}/translate-text`, {
        params: { text, source, target },
        timeout: 15000,
    });

    const translatedText = response.data?.translatedText ?? text;
    cache.set(key, translatedText);
    return { translatedText, cached: false };
}

module.exports = { translate };
