const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const { agenda } = require('../config/agenda');
const jobService = require('../services/jobService');
const { checkJobInQueue, estimateWaitTime } = require('../utils/queue');
const { extractVideoId, resolveYouTubeMetadata } = require('../utils/helpers');
const workerRouter = require('../services/workerRouter');

async function createJob(req, res) {
    try {
        const { url, user_id, is_private } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const videoId = extractVideoId(url);

        const existingResult = await jobService.getResultByVideoId(videoId);
        if (existingResult) {
            await jobService.linkUserToVideo(existingResult.job_id, user_id, is_private);
            return res.status(200).json({
                job_id: existingResult.job_id,
                status: 'completed',
                from_cache: true,
                result: existingResult.result,
                eta: 0
            });
        }

        const jobQueue = await jobService.getJobQueueByVideoId(videoId);
        if (jobQueue) {
            const existingJob = await checkJobInQueue(url);
            if (existingJob.found) {
                await jobService.linkUserToVideo(jobQueue.job_id, user_id, is_private);
                return res.status(201).json({
                    status: 'queued',
                    eta: existingJob.eta,
                    job_id: jobQueue.job_id,
                    queue_position: existingJob.position,
                    message: 'This URL is already in the queue'
                });
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

        if (duration < 0) return res.status(400).json({ error: 'Invalid video duration' });

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

        await jobService.insertJob(job);
        await jobService.linkUserToVideo(jobId, user_id, is_private);

        await agenda.now('process video', { jobId, url, video_id: videoId, duration, title, thumbnail });

        const [eta, queueNumber] = await estimateWaitTime(jobId);
        
        res.status(201).json({
            job_id: jobId,
            status: 'queued',
            queue_number: queueNumber,
            eta: eta,
            progress: 0,
            title: title,
            thumbnail: thumbnail,
            current_step: null
        });

    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
}

async function getJobStatus(req, res) {
    try {
        const { jobId } = req.params;
        const job = await jobService.getJobById(jobId);

        if (!job) return res.status(404).json({ error: 'Job not found' });

        const responseJSON = {
            job_id: job.job_id,
            status: job.status,
            progress: job.progress || 0,
            current_step: job.current_step || null,
            result: job.result || null,
            url: job.url || null
        };

        if (job.status === 'completed') {
            return res.json(responseJSON);
        }

        const [eta, queueNumber] = await estimateWaitTime(jobId);
        responseJSON.eta = eta;
        responseJSON.queue_number = queueNumber;

        const targetJob = await agenda._collection.findOne({ 'data.jobId': jobId });
        if (!targetJob) {
            return res.status(404).json({ error: 'Job not found in queue' });
        } else if (targetJob.nextRunAt !== null) {
            responseJSON.status = 'queued';
        }

        return res.json(responseJSON);

    } catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: 'Failed to get job status' });
    }
}

async function uploadJob(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const title = req.body.title || req.file.originalname;
        const durationStr = req.body.duration || '60';
        const user_id = req.body.user_id;
        const is_private = req.body.is_private;
        let duration = parseInt(durationStr, 10);
        if (isNaN(duration) || duration <= 0) duration = 60;

        const jobId = uuidv4();
        // Since it's local, we use a unique video_id like jobId
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

        await jobService.insertJob(job);
        await jobService.linkUserToVideo(jobId, user_id, is_private);
        await agenda.now('process video', { jobId, url: filePath, video_id: videoId, duration, is_local: true, title });

        const [eta, queueNumber] = await estimateWaitTime(jobId);

        res.status(201).json({
            job_id: jobId,
            status: 'queued',
            queue_number: queueNumber,
            eta: eta,
            progress: 0,
            title: title,
            current_step: null
        });
    } catch (error) {
        console.error('Error uploading job:', error);
        res.status(500).json({ error: 'Failed to upload job' });
    }
}

module.exports = {
    createJob,
    getJobStatus,
    uploadJob
};
