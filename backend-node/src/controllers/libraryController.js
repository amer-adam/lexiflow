const libraryService = require('../services/libraryService');
const { formatDuration } = require('../utils/helpers');

async function getLibrary(req, res) {
    try {
        const { user_id } = req.query;
        const { results, userJobIds, userJobPrivacy } = await libraryService.getLibrary(user_id);

        const response = results.map(r => {
            let is_private = false;
            if (userJobPrivacy[r.job_id] !== undefined) {
                is_private = userJobPrivacy[r.job_id];
            }

            return {
                id: r.job_id,
                url: r.url,
                title: r.title || 'Local Document or Unknown Title',
                description: r.result?.description || '',
                thumbnail: r.thumbnail || r.result?.thumbnail || '',
                dateAdded: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : 'Unknown',
                duration: formatDuration(r.duration || r.result?.duration),
                progress: 100,
                is_private: is_private,
                requested_by_user: userJobIds.has(r.job_id)
            }
        });
        res.json(response);
    } catch (error) {
        console.error('Error fetching library:', error);
        res.status(500).json({ error: 'Failed to fetch library' });
    }
}

async function searchSubtitles(req, res) {
    const { word, user_id } = req.query;
    if (!word) return res.status(400).json({ error: "Word parameter is required" });
    try {
        const matchedSegments = await libraryService.searchSubtitles(word, user_id);
        res.json({ results: matchedSegments });
    } catch (error) {
        console.error('Error querying subtitles:', error);
        res.status(500).json({ error: 'Failed to query subtitles' });
    }
}

module.exports = {
    getLibrary,
    searchSubtitles
};
