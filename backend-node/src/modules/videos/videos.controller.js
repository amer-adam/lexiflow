const videosService = require('./videos.service');
const videoProgressService = require('./video-progress.service');
const videoProgressRepository = require('./video-progress.repository');
const { formatDuration } = require('../../utils/helpers');

/**
 * Handle GET /library request.
 */
async function getLibrary(req, res) {
    try {
        const userId = req.userId;
        const { results, userJobIds, userJobPrivacy } = await videosService.getLibrary(userId);

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
            };
        });
        res.json(response);
    } catch (error) {
        console.error('Error fetching library:', error);
        res.status(500).json({ error: 'Failed to fetch library' });
    }
}

/**
 * Handle GET /search request.
 */
async function searchSubtitles(req, res) {
    const { word } = req.query;
    const userId = req.userId;
    if (!word) {
        return res.status(400).json({ error: "Word parameter is required" });
    }
    
    try {
        const matchedSegments = await videosService.searchSubtitles(word, userId);
        res.json({ results: matchedSegments });
    } catch (error) {
        console.error('Error querying subtitles:', error);
        res.status(500).json({ error: 'Failed to query subtitles' });
    }
}

/**
 * Handle POST /jobs request.
 */
async function createJob(req, res) {
    try {
        const { url, is_private } = req.body;
        const userId = req.userId;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const result = await videosService.createJob({ url, user_id: userId, is_private });

        if (result.status === 'completed_cached') {
            return res.status(200).json({
                job_id: result.job_id,
                status: 'completed',
                from_cache: true,
                result: result.result,
                eta: 0
            });
        }

        if (result.status === 'already_queued') {
            return res.status(201).json({
                status: 'queued',
                eta: result.eta,
                job_id: result.job_id,
                queue_position: result.queue_position,
                message: 'This URL is already in the queue'
            });
        }

        return res.status(201).json({
            job_id: result.job_id,
            status: 'queued',
            queue_number: result.queue_number,
            eta: result.eta,
            progress: 0,
            title: result.title,
            thumbnail: result.thumbnail,
            current_step: null
        });
    } catch (error) {
        if (error.message === 'Invalid video duration') {
            return res.status(400).json({ error: 'Invalid video duration' });
        }
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
}

/**
 * Handle GET /jobs/:jobId request.
 */
async function getJobStatus(req, res) {
    try {
        const { jobId } = req.params;
        const result = await videosService.getJobStatus(jobId);

        if (!result) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (result.error) {
            return res.status(404).json({ error: result.error });
        }

        return res.json(result.responseJSON);
    } catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
}

/**
 * Handle POST /upload request.
 */
async function uploadJob(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.userId;
        const result = await videosService.uploadJob({
            file: req.file,
            title: req.body.title,
            durationStr: req.body.duration,
            user_id: userId,
            is_private: req.body.is_private
        });

        res.status(201).json({
            job_id: result.job_id,
            status: 'queued',
            queue_number: result.queue_number,
            eta: result.eta,
            progress: 0,
            title: result.title,
            current_step: null
        });
    } catch (error) {
        console.error('Error uploading job:', error);
        res.status(500).json({ error: 'Failed to upload job' });
    }
}

/**
 * Handle POST /videos/:videoId/progress request.
 */
async function saveProgress(req, res) {
    try {
        const userId = req.userId;
        const { videoId } = req.params;
        const { currentTime, duration } = req.body;

        if (currentTime === undefined || duration === undefined) {
            return res.status(400).json({ error: 'currentTime and duration are required' });
        }

        const result = await videoProgressService.saveProgressAndSyncVocab(
            userId,
            videoId,
            parseFloat(currentTime),
            parseFloat(duration)
        );
        res.json(result);
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
}

/**
 * Handle GET /videos/:videoId/progress request.
 */
async function getProgress(req, res) {
    try {
        const userId = req.userId;
        const { videoId } = req.params;

        const progress = await videoProgressRepository.getProgress(userId, videoId);
        if (!progress) {
            return res.json({
                userId,
                videoId,
                currentTime: 0,
                duration: 0,
                lastSegmentIndexSeen: -1
            });
        }
        res.json(progress);
    } catch (error) {
        console.error('Error getting progress:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
}

/**
 * Handle DELETE /library/:jobId request.
 */
async function deleteVideo(req, res) {
    try {
        const userId = req.userId;
        const { jobId } = req.params;
        await videosService.deleteVideo(jobId, userId);
        res.json({ success: true });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error deleting video:', error);
        res.status(500).json({ error: 'Failed to delete video' });
    }
}

module.exports = {
    getLibrary,
    searchSubtitles,
    createJob,
    getJobStatus,
    uploadJob,
    deleteVideo,
    saveProgress,
    getProgress
};
