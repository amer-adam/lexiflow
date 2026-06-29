const axios = require('axios');

const BILIBILI_RE = /bilibili\.com\/video\/(BV[0-9A-Za-z]+)/;

const isBilibiliUrl = (url) => BILIBILI_RE.test(url || '');

const extractVideoId = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) return ytMatch[1];
    const biliMatch = url.match(BILIBILI_RE);
    if (biliMatch) return biliMatch[1];
    return url;
};

const resolveBilibiliMetadata = async (url) => {
    const bvMatch = url.match(BILIBILI_RE);
    const bvid = bvMatch ? bvMatch[1] : null;
    let title = 'Bilibili Video';
    let thumbnail = '';

    if (bvid) {
        try {
            const response = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { timeout: 3000 });
            const data = response.data && response.data.data;
            if (data) {
                title = data.title || title;
                thumbnail = data.pic || thumbnail;
            }
        } catch (e) {
            console.error(`[DEBUG] Bilibili metadata extraction failed for ${url}:`, e.message);
        }
    }

    return { title, thumbnail };
};

const resolveVideoMetadata = async (url) => {
    if (isBilibiliUrl(url)) return resolveBilibiliMetadata(url);
    return resolveYouTubeMetadata(url);
};

const resolveYouTubeMetadata = async (url) => {
    try {
        const videoId = extractVideoId(url);
        // Default thumbnail based on ID
        let thumbnail = (videoId && videoId.length === 11) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
        let title = 'YouTube Video';

        try {
            // Try YouTube's official oEmbed first
            let response = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { timeout: 3000 });

            // If that fails or doesn't have a title, try noembed.com
            if (!response.data || !response.data.title) {
                response = await axios.get(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { timeout: 3000 });
            }

            if (response.data && response.data.title) {
                title = response.data.title;
            }
            if (response.data && response.data.thumbnail_url) {
                thumbnail = response.data.thumbnail_url;
            }
        } catch (e) {
            console.error(`[DEBUG] Metadata extraction failed for ${url}:`, e.message);
        }

        return { title, thumbnail };
    } catch (e) {
        return { title: 'YouTube Video', thumbnail: '' };
    }
};

const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    if (seconds < 60) return Math.round(seconds) + 's';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

// Normalize is_private regardless of how it was stored (bool, string, etc.)
const isActuallyPrivate = (val) => {
    return val === true || val === 'true' || val === 1;
};

module.exports = {
    extractVideoId,
    resolveYouTubeMetadata,
    resolveVideoMetadata,
    isBilibiliUrl,
    formatDuration,
    isActuallyPrivate
};
