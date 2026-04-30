const Agenda = require('agenda');
const axios = require('axios');
const env = require('./env');
const { collections } = require('./db');
const { extractVideoId } = require('../utils/helpers');

const agenda = new Agenda({
    db: { address: env.MONGO_URI, collection: env.AGENDA_COLLECTION, db: env.DB_NAME },
    processEvery: '1 second',
    maxConcurrency: 1,
    defaultConcurrency: 1,
});

const workerRouter = require('../services/workerRouter');

async function monitorJobProgress(jobId, url, workerUrl) {
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const pythonStatus = await axios.get(`${workerUrl}/status/${jobId}`);

                await collections.jobsCollection.updateOne(
                    { job_id: jobId },
                    {
                        $set: {
                            status: pythonStatus.data.status,
                            progress: pythonStatus.data.progress,
                            current_step: pythonStatus.data.current_step,
                            result: pythonStatus.data.result || null,
                            updated_at: new Date(),
                        },
                    }
                );

                if (pythonStatus.data.status === 'completed') {
                    clearInterval(checkInterval);
                    // Cache the result
                    const job = await collections.jobsCollection.findOne({ job_id: jobId });
                    if (job && job.url) {
                        await collections.resultsCollection.updateOne(
                            { video_id: job.video_id || extractVideoId(job.url) },
                            {
                                $set: {
                                    job_id: jobId,
                                    video_id: job.video_id || extractVideoId(job.url),
                                    url: job.url,
                                    title: job.title || '',
                                    thumbnail: job.thumbnail || '',
                                    duration: job.duration || null,
                                    result: pythonStatus.data.result,
                                    created_at: new Date(),
                                    updated_at: new Date(),
                                }
                            },
                            { upsert: true }
                        );
                    }
                    resolve();
                } else if (pythonStatus.data.status === 'failed') {
                    clearInterval(checkInterval);
                    reject(new Error(`Job ${jobId} failed`));
                }
            } catch (error) {
                console.error(`Error monitoring job ${jobId}:`, error);
                clearInterval(checkInterval);
                reject(error);
            }
        }, 10000); // Check every 10 seconds
    });
}

agenda.define('process video', { concurrency: 1, lockLifetime: 3600000 }, async (job) => {
    const { jobId, url, duration, is_local, title } = job.attrs.data;

    try {
        const activeUrl = workerRouter.getActiveWorkerUrl();
        if (!activeUrl) {
            console.log(`[Agenda] No worker online. Delaying job ${jobId} for 1 minute.`);
            job.schedule('in 1 minute');
            await job.save();
            return;
        }

        console.log(`[Agenda] Routing job ${jobId} to ${activeUrl}`);
        // Start processing with Python API
        const response = await axios.post(`${activeUrl}/process`, { url, job_id: jobId, is_local: is_local || false });

        // Update job status in MongoDB
        await collections.jobsCollection.updateOne(
            { job_id: jobId },
            {
                $set: {
                    status: response.data.status,
                    progress: response.data.progress,
                    current_step: response.data.current_step,
                    updated_at: new Date(),
                },
            }
        );

        // Monitor job progress
        await monitorJobProgress(jobId, url, activeUrl);
    } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        await collections.jobsCollection.updateOne(
            { job_id: jobId },
            { $set: { status: 'failed', updated_at: new Date() } }
        );
    }
});

async function startAgenda() {
    const numRemoved1 = await agenda.purge();
    const numRemoved2 = await agenda.cancel({ "name": "process video" });
    console.log(`Purged ${numRemoved1} jobs and cancelled ${numRemoved2} jobs from Agenda`);
    await agenda.start();
    console.log('Agenda started');
}

module.exports = { agenda, startAgenda };
