const { MongoClient } = require('mongodb');
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const Agenda = require('agenda');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4556;

const PROCESSING_RATE = 15; // seconds per minute of video

// MongoDB connection
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'lexiflow';
const JOBS_COLLECTION = 'jobs';
const RESULTS_COLLECTION = 'results';
const AGENDA_COLLECTION = 'agendaJobs';
const PYTHON_API = 'http://localhost:4557';


let db, jobsCollection, resultsCollection;

// Job Queue System

const agenda = new Agenda({
    db: { address: MONGO_URI, collection: AGENDA_COLLECTION, db: DB_NAME },
    processEvery: '1 second',
    maxConcurrency: 1,       // Max total concurrency (for all jobs)
    defaultConcurrency: 1,    // Max concurrency per job type
});

agenda.define('process video', { concurrency: 1, lockLifetime: 200000 }, async (job) => {
    const { jobId, url } = job.attrs.data;

    try {
        // Start processing with Python API
        const response = await axios.post(`${PYTHON_API}/process`, { url, job_id: jobId });

        // Update job status in MongoDB
        await jobsCollection.updateOne(
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
        await monitorJobProgress(jobId, url);
    } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        await jobsCollection.updateOne(
            { job_id: jobId },
            { $set: { status: 'failed', updated_at: new Date() } }
        );
    }
});

async function monitorJobProgress(jobId, url) {
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const pythonStatus = await axios.get(`${PYTHON_API}/status/${jobId}`);

                await jobsCollection.updateOne(
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
                    const job = await jobsCollection.findOne({ job_id: jobId });
                    if (job && job.url) {
                        await resultsCollection.updateOne(
                            { url: job.url },
                            {
                                $set: {
                                    job_id: jobId,
                                    result: pythonStatus.data.result,
                                    created_at: new Date(),
                                    updated_at: new Date(),
                                },
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
        }, 2000); // Check every 2 seconds
    }
    );
}

async function checkJobInQueue(url) {
    const queuedJobs = await agenda.jobs({ name: 'process video', nextRunAt: { $ne: null } });

    let totalETA = 0;
    for (let i = 0; i < queuedJobs.length; i++) {
        const job = queuedJobs[i];
        const jobUrl = job.attrs.data?.url;
        const jobDuration = job.attrs.data?.duration || 60;
        const jobMinutes = jobDuration / 60;
        const jobETA = Math.ceil(jobMinutes * 15);

        if (jobUrl === url) {
            return {
                found: true,
                eta: totalETA,
                position: i
            };
        }

        totalETA += jobETA;
    }

    // If we reach here, the job was not found in the queue
    // check if its an active job
    const jobsActive = agenda._collection.find({
        lastFinishedAt: { $exists: false },
        nextRunAt: null
    });
    for await (const job of jobsActive) {
        const jobUrl = job.data?.url;
        const jobDuration = job.data?.duration || 60; // fallback to 1 min if missing
        const jobMinutes = jobDuration / 60;
        const jobETA = Math.ceil(jobMinutes * PROCESSING_RATE);

        if (jobUrl === url) {
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

    // // Count how many pending jobs were created before this one
    // const jobsAhead = await agenda._collection.countDocuments({
    //     lastFinishedAt: { $exists: false }, // Pending jobs
    //     nextRunAt: { $lt: targetJob.nextRunAt } ||  // Use lastRunAt if exists
    //         { _id: { $lt: targetJob._id } }  // Fallback to insertion order
    // });

    // Find all jobs that are pending (lastFinishedAt doesn't exist) and nextRunAt is null
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
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    for await (const job of jobsActive) {
        const jobDuration = job.data?.duration || 60; // fallback to 1 min if missing
        const jobMinutes = jobDuration / 60;
        totalETA += Math.ceil(jobMinutes * PROCESSING_RATE);
        // jobsAheadCount++;
        activeJobId = job.data.jobId;
        console.log(`ACTIVE JOB: ${job.data.jobId} - EST TIME: ${jobDuration}s - TOTAL EST: ${totalETA} seconds`);
    }
    for await (const job of jobsQueueBefore) {
        if (job.data.jobId === activeJobId) {
            continue; // Skip the active job already counted
        }
        const jobDuration = job.data?.duration || 60; // fallback to 1 min if missing
        const jobMinutes = jobDuration / 60;
        totalETA += Math.ceil(jobMinutes * PROCESSING_RATE);
        jobsAheadCount++;
        console.log(`QUEUE JOB: ${job.data.jobId} - EST TIME: ${jobDuration}s - TOTAL EST: ${totalETA} seconds`);
    }
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    if (totalETA < 0) {
        totalETA = 0; // Ensure non-negative ETA
    } else if (totalETA < 60) {
        totalETA = 60; // Minimum ETA of 1 minute
    }


    return [totalETA, jobsAheadCount]; // in seconds
}


async function connectToMongoDB() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        db = client.db(DB_NAME);
        jobsCollection = db.collection(JOBS_COLLECTION);
        resultsCollection = db.collection(RESULTS_COLLECTION);

        // Create indexes
        await resultsCollection.createIndex({ url: 1 }, { unique: true });
        await jobsCollection.createIndex({ job_id: 1 }, { unique: true });

        // Clear jobs table on start
        await jobsCollection.deleteMany({});
        await resultsCollection.deleteMany({});


        console.log('Connected to MongoDB');

        const numRemoved1 = await agenda.purge();
        const numRemoved2 = await agenda.cancel({ "name": "process video" });
        console.log(`Purged ${numRemoved1} jobs and cancelled ${numRemoved2} jobs from Agenda`);
        await agenda.start();
        console.log('Agenda started'); 1
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }
}


// Create a new processing job or return existing result
app.post('/lexiflow/jobs', async (req, res) => {
    try {
        const { url } = req.body; // Now expecting duration in minutes
        if (!url) return res.status(400).json({ error: 'URL is required' });


        // Check if we already have a result for this URL
        const existingResult = await resultsCollection.findOne({ url });
        if (existingResult) {
            return res.status(200).json({
                job_id: existingResult.job_id,
                status: 'completed',
                from_cache: true,
                result: existingResult.result,
                eta: 0 // Immediately available
            });
        }


        const jobQueue = await jobsCollection.findOne({ url });
        if (jobQueue) {
            // Check if job is already in queue
            const existingJob = await checkJobInQueue(url);
            if (existingJob.found) {
                console.log(job.job_id);
                return res.status(201).json({
                    status: 'queued',
                    eta: existingJob.eta,
                    job_id: job.job_id,
                    queue_position: existingJob.position,
                    message: 'This URL is already in the queue'
                });
            }
        }


        const response = await axios.post(`${PYTHON_API}/duration`, { url });
        const duration = response.data.duration_seconds; // Duration in seconds
        if (duration <= 0) return res.status(400).json({ error: 'Invalid video duration' });

        const jobId = uuidv4();
        const job = {
            job_id: jobId,
            url: url,
            status: 'created',
            duration: duration,
            progress: 0,
            current_step: null,
            created_at: new Date(),
            updated_at: new Date(),
            result: null
        };

        await jobsCollection.insertOne(job);

        await agenda.now('process video', { jobId, url, duration });

        const [eta, queueNumber] = await estimateWaitTime(jobId);
        console.log(`queue ${queueNumber}: eta ${eta} seconds`);

        res.status(201).json({
            job_id: jobId,
            status: 'queued',
            queue_number: queueNumber,
            eta: eta,
            progress: 0,
            current_step: null
        });

    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

// Get job status and result
app.get('/lexiflow/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await jobsCollection.findOne({ job_id: jobId });

        if (!job) return res.status(404).json({ error: 'Job not found' });

        const responseJSON = {
            job_id: job.job_id,
            status: job.status,
            progress: job.progress || 0,
            current_step: job.current_step || null,
            result: job.result || null
        };


        // If job is completed locally, return the result
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

        // If Python service is down but we have the job locally
        // if (error.response?.status === 404) {
        //     const localJob = await jobsCollection.findOne({ job_id: jobId });
        //     if (localJob) {
        //         return res.json({
        //             job_id: jobId,
        //             status: localJob.status || 'unknown',
        //             progress: localJob.progress || 0,
        //             current_step: localJob.current_step,
        //             result: localJob.result
        //         });
        //     }
        // }

        res.status(500).json({ error: 'Failed to get job status' });
    }
});

// Background worker to clean up old jobs (optional)
async function cleanupOldJobs() {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7); // 7 days ago

        await jobsCollection.deleteMany({
            status: { $in: ['completed', 'failed'] },
            updated_at: { $lt: cutoff }
        });

        console.log('Cleaned up old jobs');
    } catch (error) {
        console.error('Error cleaning up old jobs:', error);
    }
}

// Run cleanup every 24 hours
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

connectToMongoDB().then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)));
