const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { uploadDir } = require('../../middlewares/upload');
const env = require('../../config/env');

const ttsDir = path.join(uploadDir, 'tts');
if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });

function hashFor(text, voice) {
    return crypto.createHash('sha256').update(`${voice || 'default'}::${text}`).digest('hex');
}

/**
 * Synthesize (or return cached) audio for a piece of Mandarin text.
 *
 * backend-node never talks to the CosyVoice container directly — it calls
 * backend-fastapi's /tts route (same pattern as translation), which proxies
 * to tts-service (the official CosyVoice FastAPI server) and hands back a
 * ready-to-cache .wav.
 */
async function synthesize(text, { voice } = {}) {
    if (!text || !text.trim()) {
        const err = new Error('text is required');
        err.status = 400;
        throw err;
    }

    const hash = hashFor(text, voice);
    const filePath = path.join(ttsDir, `${hash}.wav`);
    const mediaUrl = `/media/tts/${hash}.wav`;

    if (fs.existsSync(filePath)) {
        return { url: mediaUrl, cached: true };
    }

    if (!env.PYTHON_API) {
        const err = new Error('TTS service is not configured (PYTHON_API missing)');
        err.status = 503;
        throw err;
    }

    const response = await axios.get(`${env.PYTHON_API}/tts`, {
        params: { text, voice: voice || undefined },
        timeout: 30000,
        responseType: 'arraybuffer',
    });

    fs.writeFileSync(filePath, Buffer.from(response.data));
    return { url: mediaUrl, cached: false };
}

module.exports = { synthesize };
