const { collections } = require('../config/db');
const { isActuallyPrivate } = require('../utils/helpers');

async function getLibrary(userId) {
    let results = await collections.resultsCollection.find({}).sort({ updated_at: -1 }).toArray();
    const allLinks = await collections.userVideosCollection.find({}).toArray();
    
    const linkedJobIds = new Set(allLinks.map(l => l.job_id));
    const publicJobIds = new Set();
    const userJobIds = new Set();
    const userJobPrivacy = {};

    allLinks.forEach(link => {
        if (!isActuallyPrivate(link.is_private)) {
            publicJobIds.add(link.job_id);
        }
        if (userId && link.user_id === userId) {
            userJobIds.add(link.job_id);
            userJobPrivacy[link.job_id] = isActuallyPrivate(link.is_private);
        }
    });

    results = results.filter(r => {
        if (!linkedJobIds.has(r.job_id)) return true;
        return publicJobIds.has(r.job_id) || userJobIds.has(r.job_id);
    });

    return { results, userJobIds, userJobPrivacy };
}

async function searchSubtitles(word, userId) {
    const query = {
        $or: [
            { "result.segments.text": { $regex: word, $options: "i" } },
            { "result.segments.translated_text": { $regex: word, $options: "i" } },
            { "result.segments.pinyin": { $regex: word, $options: "i" } }
        ]
    };
    let results = await collections.resultsCollection.find(query).toArray();

    const allLinks = await collections.userVideosCollection.find({}).toArray();
    const linkedJobIds = new Set(allLinks.map(l => l.job_id));
    const publicJobIds = new Set();
    const userJobIds = new Set();

    allLinks.forEach(link => {
        if (!isActuallyPrivate(link.is_private)) {
            publicJobIds.add(link.job_id);
        }
        if (userId && link.user_id === userId) {
            userJobIds.add(link.job_id);
        }
    });

    results = results.filter(r => {
        if (!linkedJobIds.has(r.job_id)) return true;
        return publicJobIds.has(r.job_id) || userJobIds.has(r.job_id);
    });

    let matchedSegments = [];
    results.forEach(r => {
        if (r.result && r.result.segments) {
            const matches = r.result.segments.filter(s =>
                (s.text && s.text.includes(word)) ||
                (s.translated_text && s.translated_text.toLowerCase().includes(word.toLowerCase())) ||
                (s.pinyin && s.pinyin.toLowerCase().includes(word.toLowerCase()))
            );
            matches.forEach(m => {
                matchedSegments.push({
                    job_id: r.job_id,
                    title: r.title || r.result?.title || 'Unknown Title',
                    segment: m
                });
            });
        }
    });

    return matchedSegments;
}

module.exports = {
    getLibrary,
    searchSubtitles
};
