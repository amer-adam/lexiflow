const app = require('./app');
const env = require('./config/env');
const { connectToMongoDB } = require('./config/db');
const { agenda, startAgenda } = require('./config/agenda');
const { startCleanupJob } = require('./services/cleanupService');
const workerRouter = require('./services/workerRouter');

async function startServer() {
    try {
        await connectToMongoDB();
        await startAgenda();
        startCleanupJob();

        // Run autoscale check on startup and every 30 seconds
        workerRouter.autoscaleSalad(agenda);
        setInterval(() => workerRouter.autoscaleSalad(agenda), 30 * 1000);

        app.listen(env.PORT, () => {
            console.log(`Server running on port ${env.PORT}`);
        });
    } catch (error) {
        console.error('Failed to start the server:', error);
        process.exit(1);
    }
}

startServer();
