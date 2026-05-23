const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const env = require('../../config/env');
const { agenda } = require('../../config/agenda');
const videosRepository = require('./videos.repository');
const workerRouter = require('../../services/workerRouter');
const { checkJobInQueue, estimateWaitTime } = require('../../utils/queue');
const { extractVideoId, resolveYouTubeMetadata, isActuallyPrivate } = require('../../utils/helpers');

/**
 * Retrieve user and public video results in the library.
 */
async function getLibrary(userId) {
    let results = await videosRepository.getAllResults();
    const allLinks = await videosRepository.getAllUserVideos();
    
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

/**
 * Search subtitle text in cached segments for a user's accessible library.
 */
async function searchSubtitles(word, userId) {
    const query = {
        $or: [
            { "result.segments.text": { $regex: word, $options: "i" } },
            { "result.segments.translated_text": { $regex: word, $options: "i" } },
            { "result.segments.pinyin": { $regex: word, $options: "i" } }
        ]
    };
    let results = await videosRepository.searchResults(query);

    const allLinks = await videosRepository.getAllUserVideos();
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

/**
 * Create a new video processing job or return cache/queue state.
 */
async function createJob({ url, user_id, is_private }) {
    const videoId = extractVideoId(url);

    const existingResult = await videosRepository.getResultByVideoId(videoId);
    if (existingResult) {
        await videosRepository.linkUserToVideo(existingResult.job_id, user_id, is_private);
        return {
            status: 'completed_cached',
            job_id: existingResult.job_id,
            result: existingResult.result
        };
    }

    const jobQueue = await videosRepository.getJobQueueByVideoId(videoId);
    if (jobQueue) {
        const existingJob = await checkJobInQueue(url);
        if (existingJob.found) {
            await videosRepository.linkUserToVideo(jobQueue.job_id, user_id, is_private);
            return {
                status: 'already_queued',
                job_id: jobQueue.job_id,
                eta: existingJob.eta,
                queue_position: existingJob.position
            };
        }
    }

    let duration = 0;
    const activeUrl = workerRouter.getActiveWorkerUrl();
    if (activeUrl) {
        try {
            const response = await axios.post(`${activeUrl}/duration`, { url });
            duration = response.data.duration_seconds;
        } catch (err) {
            console.warn('Could not fetch duration from active worker, defaulting to 0');
        }
    } else {
        console.log('No worker online to fetch duration. Job queued with duration 0.');
    }

    if (duration < 0) {
        throw new Error('Invalid video duration');
    }

    const { title, thumbnail } = await resolveYouTubeMetadata(url);

    const jobId = uuidv4();
    const job = {
        job_id: jobId,
        video_id: videoId,
        url: url,
        status: 'created',
        duration: duration,
        title: title,
        thumbnail: thumbnail,
        progress: 0,
        current_step: null,
        created_at: new Date(),
        updated_at: new Date(),
        result: null
    };

    await videosRepository.insertJob(job);
    await videosRepository.linkUserToVideo(jobId, user_id, is_private);

    await agenda.now('process video', { jobId, url, video_id: videoId, duration, title, thumbnail });

    const [eta, queueNumber] = await estimateWaitTime(jobId);
    
    return {
        status: 'queued',
        job_id: jobId,
        queue_number: queueNumber,
        eta: eta,
        title,
        thumbnail
    };
}

/**
 * Retrieve status of a video job.
 */
async function getJobStatus(jobId) {
    const job = await videosRepository.getJobById(jobId);
    if (!job) return null;

    const responseJSON = {
        job_id: job.job_id,
        status: job.status,
        progress: job.progress || 0,
        current_step: job.current_step || null,
        result: job.result || null,
        url: job.url || null,
        duration: job.duration || 0
    };

    if (job.status === 'completed') {
        return { job, responseJSON };
    }

    const [eta, queueNumber] = await estimateWaitTime(jobId);
    responseJSON.eta = eta;
    responseJSON.queue_number = queueNumber;

    const targetJob = await agenda._collection.findOne({ 'data.jobId': jobId });
    if (!targetJob) {
        return { job: null, error: 'Job not found in queue' };
    } else if (targetJob.nextRunAt !== null) {
        responseJSON.status = 'queued';
    }

    return { job, responseJSON };
}

/**
 * Handle a locally uploaded video/file job creation.
 */
async function uploadJob({ file, title: reqTitle, durationStr, user_id, is_private }) {
    const filePath = file.path;
    const title = reqTitle || file.originalname;
    let duration = parseInt(durationStr, 10);
    if (isNaN(duration) || duration <= 0) duration = 60;

    const jobId = uuidv4();
    const videoId = jobId; 

    const job = {
        job_id: jobId,
        video_id: videoId,
        url: filePath,
        is_local: true,
        title: title,
        status: 'created',
        duration: duration,
        progress: 0,
        current_step: null,
        created_at: new Date(),
        updated_at: new Date(),
        result: null
    };

    await videosRepository.insertJob(job);
    await videosRepository.linkUserToVideo(jobId, user_id, is_private);
    await agenda.now('process video', { jobId, url: filePath, video_id: videoId, duration, is_local: true, title });

    const [eta, queueNumber] = await estimateWaitTime(jobId);

    return {
        job_id: jobId,
        status: 'queued',
        queue_number: queueNumber,
        eta: eta,
        title
    };
}

module.exports = {
    getLibrary,
    searchSubtitles,
    createJob,
    getJobStatus,
    uploadJob
};
