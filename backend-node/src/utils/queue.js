const { agenda } = require('../config/agenda');
const { extractVideoId } = require('./helpers');
const env = require('../config/env');

async function checkJobInQueue(url) {
    const queuedJobs = await agenda.jobs({ name: 'process video', nextRunAt: { $ne: null } });

    let totalETA = 0;
    for (let i = 0; i < queuedJobs.length; i++) {
        const job = queuedJobs[i];
        const jobVideoId = job.attrs.data?.video_id || extractVideoId(job.attrs.data?.url);
        const urlVideoId = extractVideoId(url);

        const jobDuration = job.attrs.data?.duration || 60;
        const jobMinutes = jobDuration / 60;
        const jobETA = Math.ceil(jobMinutes * 15); // Hardcoded 15 in original

        if (jobVideoId === urlVideoId && urlVideoId !== null) {
            return {
                found: true,
                eta: totalETA,
                position: i
            };
        }

        totalETA += jobETA;
    }

    // check if its an active job
    const jobsActive = agenda._collection.find({
        lastFinishedAt: { $exists: false },
        nextRunAt: null
    });
    for await (const job of jobsActive) {
        const jobVideoId = job.data?.video_id || extractVideoId(job.data?.url);
        const urlVideoId = extractVideoId(url);

        const jobDuration = job.data?.duration || 60; // fallback to 1 min if missing
        const jobMinutes = jobDuration / 60;
        const jobETA = Math.ceil(jobMinutes * env.PROCESSING_RATE);

        if (jobVideoId === urlVideoId && urlVideoId !== null) {
            return {
                found: true,
                eta: totalETA,
                position: -1 // Active jobs are not in the queue
            };
        }

        totalETA += jobETA;
    }

    return { found: false };
}

async function estimateWaitTime(jobId) {
    const targetJob = await agenda._collection.findOne({ 'data.jobId': jobId });

    if (!targetJob) {
        throw new Error(`Job ${jobId} not found in queue`);
    }

    const jobsActive = agenda._collection.find({
        lastFinishedAt: { $exists: false },
        nextRunAt: null
    });

    const jobsQueueBefore = agenda._collection.find({
        lastFinishedAt: { $exists: false },
        nextRunAt: { $lte: targetJob.nextRunAt }
    });

    let totalETA = 0;
    let jobsAheadCount = 0;
    let activeJobId = null;
    
    // console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    for await (const job of jobsActive) {
        const jobDuration = job.data?.duration || 60;
        const jobMinutes = jobDuration / 60;
        totalETA += Math.ceil(jobMinutes * env.PROCESSING_RATE);
        activeJobId = job.data.jobId;
        // console.log(`ACTIVE JOB: ${job.data.jobId} - EST TIME: ${jobDuration}s - TOTAL EST: ${totalETA} seconds`);
    }
    for await (const job of jobsQueueBefore) {
        if (job.data.jobId === activeJobId) {
            continue; // Skip the active job already counted
        }
        const jobDuration = job.data?.duration || 60;
        const jobMinutes = jobDuration / 60;
        totalETA += Math.ceil(jobMinutes * env.PROCESSING_RATE);
        jobsAheadCount++;
        // console.log(`QUEUE JOB: ${job.data.jobId} - EST TIME: ${jobDuration}s - TOTAL EST: ${totalETA} seconds`);
    }
    // console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    if (totalETA < 0) {
        totalETA = 0;
    } else if (totalETA < 60) {
        totalETA = 60;
    }

    return [totalETA, jobsAheadCount];
}

module.exports = {
    checkJobInQueue,
    estimateWaitTime
};
