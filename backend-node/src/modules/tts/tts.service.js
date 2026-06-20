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

// backend-fastapi's /tts can come from either TTS backend (see its
// TTS_BACKEND switch) and they don't return the same container — CosyVoice
// always returns wav, but edge-tts returns mp3 unless its -ffmpeg image
// variant is used. express.static (serving /media) picks Content-Type from
// the file extension, so the cached file's extension must match what was
// actually written or playback breaks; we read it off the real response.
const EXT_BY_CONTENT_TYPE = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3' };

function extFor(contentType) {
    const base = (contentType || '').split(';')[0].trim();
    return EXT_BY_CONTENT_TYPE[base] || 'wav';
}

function findCached(hash) {
    for (const ext of new Set(Object.values(EXT_BY_CONTENT_TYPE))) {
        const filePath = path.join(ttsDir, `${hash}.${ext}`);
        if (fs.existsSync(filePath)) return { filePath, ext };
    }
    return null;
}

/**
 * Synthesize (or return cached) audio for a piece of Mandarin text.
 *
 * backend-node never talks to a TTS engine directly — it calls
 * backend-fastapi's /tts route (same pattern as translation), which proxies
 * to whichever TTS backend is configured there and hands back a
 * ready-to-cache audio file.
 */
async function synthesize(text, { voice } = {}) {
    if (!text || !text.trim()) {
        const err = new Error('text is required');
        err.status = 400;
        throw err;
    }

    const hash = hashFor(text, voice);
    const cached = findCached(hash);
    if (cached) {
        return { url: `/media/tts/${hash}.${cached.ext}`, cached: true };
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

    const ext = extFor(response.headers['content-type']);
    const filePath = path.join(ttsDir, `${hash}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(response.data));
    return { url: `/media/tts/${hash}.${ext}`, cached: false };
}

module.exports = { synthesize };
