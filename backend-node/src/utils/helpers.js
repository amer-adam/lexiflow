const axios = require('axios');

const extractVideoId = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return ytMatch ? ytMatch[1] : url;
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
    formatDuration,
    isActuallyPrivate
};
