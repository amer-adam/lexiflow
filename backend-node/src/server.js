const app = require('./app');
const env = require('./config/env');
const { connectToMongoDB } = require('./config/db');
const { agenda, startAgenda } = require('./config/agenda');
const { startCleanupJob } = require('./services/cleanupService');
const workerRouter = require('./services/workerRouter');

async function startServer() {
    // MongoDB powers only the video-processing job queue. If it's unreachable
    // (e.g. Atlas IP allow-list / paused cluster), boot in DEGRADED mode so the
    // PostgreSQL-backed API (vocabulary, lists, flashcards, quizzes) still works.
    try {
        await connectToMongoDB();
        await startAgenda();
        startCleanupJob();

        // Run autoscale check on startup and every 30 seconds
        workerRouter.autoscaleSalad(agenda);
        setInterval(() => workerRouter.autoscaleSalad(agenda), 30 * 1000);
        console.log('MongoDB + job pipeline initialised.');
    } catch (error) {
        console.warn(
            '\n⚠️  DEGRADED MODE: MongoDB/job-pipeline init failed — the video pipeline (library, processing) is disabled, but PostgreSQL features still work.\n   Cause:',
            error.message,
            '\n   Fix: add this server\'s IP to the Atlas Network Access allow-list (or un-pause the cluster).\n'
        );
    }

    app.listen(env.PORT, () => {
        console.log(`Server running on port ${env.PORT}`);
    });
}

startServer();
