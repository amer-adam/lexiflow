const { MongoClient } = require('mongodb');
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const Agenda = require('agenda');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, 'temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname))
    }
})

const upload = multer({ storage: storage })

const app = express();
app.use(cors());
app.use(express.json());
app.use('/media', express.static(uploadDir));

const PORT = 4556;

const PROCESSING_RATE = 15; // seconds per minute of video

// MongoDB connection
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'lexiflow';
const JOBS_COLLECTION = 'jobs';
const RESULTS_COLLECTION = 'results';
const AGENDA_COLLECTION = 'agendaJobs';
const USER_VIDEOS_COLLECTION = 'user_videos';
const PYTHON_API = 'http://localhost:4557';
let db, jobsCollection, resultsCollection, userVideosCollection;

const extractVideoId = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return ytMatch ? ytMatch[1] : url;
};

const resolveYouTubeMetadata = async (url) => {
    try {
        const videoId = extractVideoId(url);
        // Ensure we only use it nicely if it's exactly 11 chars
        let thumbnail = (videoId && videoId.length === 11) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
        let title = '';

        try {
            const { data } = await axios.get(url, { timeout: 5000 });
            const titleMatch = data.match(/<title>(.*?)<\/title>/);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].replace(' - YouTube', '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
            }
        } catch (e) {
            console.error(`[DEBUG] Error scraping title for ${url}:`, e.message);
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

// Job Queue System

const agenda = new Agenda({
    db: { address: MONGO_URI, collection: AGENDA_COLLECTION, db: DB_NAME },
    processEvery: '1 second',
    maxConcurrency: 1,       // Max total concurrency (for all jobs)
    defaultConcurrency: 1,    // Max concurrency per job type
});

agenda.define('process video', { concurrency: 1, lockLifetime: 3600000 }, async (job) => {
    const { jobId, url, duration, is_local, title } = job.attrs.data;

    try {
        // Start processing with Python API
        const response = await axios.post(`${PYTHON_API}/process`, { url, job_id: jobId, is_local: is_local || false });

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
        const jobVideoId = job.attrs.data?.video_id || extractVideoId(job.attrs.data?.url);
        const urlVideoId = extractVideoId(url);

        const jobDuration = job.attrs.data?.duration || 60;
        const jobMinutes = jobDuration / 60;
        const jobETA = Math.ceil(jobMinutes * 15);

        if (jobVideoId === urlVideoId && urlVideoId !== null) {
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
        const jobVideoId = job.data?.video_id || extractVideoId(job.data?.url);
        const urlVideoId = extractVideoId(url);

        const jobDuration = job.data?.duration || 60; // fallback to 1 min if missing
        const jobMinutes = jobDuration / 60;
        const jobETA = Math.ceil(jobMinutes * PROCESSING_RATE);

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

// Normalize is_private regardless of how it was stored (bool, string, etc.)
function isActuallyPrivate(val) {
    return val === true || val === 'true' || val === 1;
}

async function linkUserToVideo(jobId, userId, isPrivate) {
    if (!userId) return;
    const isPrivateBool = isPrivate === 'true' || isPrivate === true;
    await userVideosCollection.updateOne(
        { user_id: userId, job_id: jobId },
        { $set: { is_private: isPrivateBool, updated_at: new Date() } },
        { upsert: true }
    );
}


async function connectToMongoDB() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        db = client.db(DB_NAME);
        jobsCollection = db.collection(JOBS_COLLECTION);
        resultsCollection = db.collection(RESULTS_COLLECTION);
        userVideosCollection = db.collection(USER_VIDEOS_COLLECTION);

        // Create indexes
        await resultsCollection.createIndex({ video_id: 1 }, { unique: true });
        await jobsCollection.createIndex({ job_id: 1 }, { unique: true });
        await userVideosCollection.createIndex({ user_id: 1, job_id: 1 }, { unique: true });

        // Clear jobs table on start (DISABLED)
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
        const { url, user_id, is_private } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const videoId = extractVideoId(url);

        // Check if we already have a result for this URL matches 
        const existingResult = await resultsCollection.findOne({ video_id: videoId });
        if (existingResult) {
            await linkUserToVideo(existingResult.job_id, user_id, is_private);
            return res.status(200).json({
                job_id: existingResult.job_id,
                status: 'completed',
                from_cache: true,
                result: existingResult.result,
                eta: 0 // Immediately available
            });
        }


        const jobQueue = await jobsCollection.findOne({ video_id: videoId });
        if (jobQueue) {
            // Check if job is already in queue
            const existingJob = await checkJobInQueue(url);
            if (existingJob.found) {
                await linkUserToVideo(jobQueue.job_id, user_id, is_private);
                return res.status(201).json({
                    status: 'queued',
                    eta: existingJob.eta,
                    job_id: jobQueue.job_id,
                    queue_position: existingJob.position,
                    message: 'This URL is already in the queue'
                });
            }
        }


        const response = await axios.post(`${PYTHON_API}/duration`, { url });
        const duration = response.data.duration_seconds; // Duration in seconds
        if (duration <= 0) return res.status(400).json({ error: 'Invalid video duration' });

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

        await jobsCollection.insertOne(job);
        await linkUserToVideo(jobId, user_id, is_private);

        await agenda.now('process video', { jobId, url, video_id: videoId, duration, title, thumbnail });

        const [eta, queueNumber] = await estimateWaitTime(jobId);
        console.log(`queue ${queueNumber}: eta ${eta} seconds`);

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
            result: job.result || null,
            url: job.url || null
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

// New Endpoint: Upload local content
app.post('/lexiflow/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        // User must insert their title directly from frontend
        const title = req.body.title || req.file.originalname;
        const durationStr = req.body.duration || '60';
        const user_id = req.body.user_id;
        const is_private = req.body.is_private;
        let duration = parseInt(durationStr, 10);
        if (isNaN(duration) || duration <= 0) duration = 60;

        const jobId = uuidv4();
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

        await jobsCollection.insertOne(job);
        await linkUserToVideo(jobId, user_id, is_private);
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
});

// New Endpoint: Fetch library videos
app.get('/lexiflow/library', async (req, res) => {
    try {
        const { user_id } = req.query;
        let results = await resultsCollection.find({}).sort({ updated_at: -1 }).toArray();

        const allLinks = await userVideosCollection.find({}).toArray();
        const linkedJobIds = new Set(allLinks.map(l => l.job_id));
        const publicJobIds = new Set();
        const userJobIds = new Set();
        const userJobPrivacy = {};

        allLinks.forEach(link => {
            // Only treat as private when is_private is unambiguously true
            if (!isActuallyPrivate(link.is_private)) {
                publicJobIds.add(link.job_id);
            }
            if (user_id && link.user_id === user_id) {
                userJobIds.add(link.job_id);
                userJobPrivacy[link.job_id] = isActuallyPrivate(link.is_private);
            }
        });

        results = results.filter(r => {
            if (!linkedJobIds.has(r.job_id)) return true; // Legacy / no ownership record = public
            // A video is accessible if it is public OR the requesting user explicitly requested it
            return publicJobIds.has(r.job_id) || userJobIds.has(r.job_id);
        });

        const response = results.map(r => {
            let is_private = false;
            // Check if this job is private specifically for this user
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
});

// New Endpoint: Fetch dictionary definition
app.get('/lexiflow/dictionary', async (req, res) => {
    const { word } = req.query;
    if (!word) return res.status(400).json({ error: "Word parameter is required" });
    try {
        const response = await axios.get(`${PYTHON_API}/dictionary/${encodeURIComponent(word)}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error hitting python dictionary:', error.message);
        res.status(500).json({ error: 'Failed to find in dictionary' });
    }
});

// New Endpoint: Search word in translated subtitles
app.get('/lexiflow/search', async (req, res) => {
    const { word, user_id } = req.query;
    if (!word) return res.status(400).json({ error: "Word parameter is required" });
    try {
        const query = {
            $or: [
                { "result.segments.text": { $regex: word, $options: "i" } },
                { "result.segments.translated_text": { $regex: word, $options: "i" } },
                { "result.segments.pinyin": { $regex: word, $options: "i" } }
            ]
        };
        let results = await resultsCollection.find(query).toArray();

        // Apply access control logic
        const allLinks = await userVideosCollection.find({}).toArray();
        const linkedJobIds = new Set(allLinks.map(l => l.job_id));
        const publicJobIds = new Set();
        const userJobIds = new Set();

        allLinks.forEach(link => {
            // Only treat as private when is_private is unambiguously true
            if (!isActuallyPrivate(link.is_private)) {
                publicJobIds.add(link.job_id);
            }
            if (user_id && link.user_id === user_id) {
                userJobIds.add(link.job_id);
            }
        });

        results = results.filter(r => {
            if (!linkedJobIds.has(r.job_id)) return true; // Legacy / no ownership record = public
            // A video is accessible if it is public OR the requesting user explicitly requested it
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
        res.json({ results: matchedSegments });
    } catch (error) {
        console.error('Error querying subtitles:', error);
        res.status(500).json({ error: 'Failed to query subtitles' });
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
