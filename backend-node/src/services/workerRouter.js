const axios = require('axios');
const env = require('../config/env');
const saladService = require('./saladService');

// State tracking
let localWorkerOnline = false;
let saladWorkerOnline = false;

async function isWorkerOnline(baseUrl) {
    try {
        // FastAPI generates /docs automatically, which is a good health check
        await axios.get(`${baseUrl}/docs`, { timeout: 2000 });
        return true;
    } catch (error) {
        // If we get a 404, the server is still online. We only fail on network errors/timeouts.
        if (error.response) return true;
        return false;
    }
}

/**
 * Update the health status of our workers.
 */
async function checkWorkerHealth() {
    localWorkerOnline = await isWorkerOnline(env.PYTHON_API);

    // Only check Salad if we need to or if it was recently started
    if (!localWorkerOnline && env.SALAD_API_KEY) {
        saladWorkerOnline = await isWorkerOnline(env.PYTHON_API_SALAD);
    } else {
        saladWorkerOnline = false;
    }

    console.log(`[Health] Local Worker: ${localWorkerOnline ? 'ONLINE' : 'OFFLINE'} | Salad Worker: ${saladWorkerOnline ? 'ONLINE' : 'OFFLINE'}`);
}

/**
 * Get the currently active worker URL.
 * Prefers local PC. If local is off, prefers Salad if it is online.
 * Returns null if no worker is currently available to accept jobs.
 */
function getActiveWorkerUrl() {
    if (localWorkerOnline) return env.PYTHON_API;
    if (saladWorkerOnline) return env.PYTHON_API_SALAD;
    return null;
}

/**
 * Autoscale logic based on queue size and local worker health.
 */
async function autoscaleSalad(agenda) {
    try {
        // 1. Check health
        await checkWorkerHealth();

        // 2. Count pending jobs in queue
        const pendingJobsCount = await agenda._collection.countDocuments({
            lastFinishedAt: { $exists: false },
            nextRunAt: { $ne: null }
        });

        const activeJobsCount = await agenda._collection.countDocuments({
            lastFinishedAt: { $exists: false },
            nextRunAt: null
        });

        const totalJobs = pendingJobsCount + activeJobsCount;

        // 3. Autoscale logic
        if (localWorkerOnline) {
            // If local is online, we definitely don't need Salad.
            if (env.SALAD_API_KEY) {
                const saladStatus = await saladService.getSaladStatus();
                if (['running', 'starting', 'deploying'].includes(saladStatus)) {
                    console.log('[Autoscale] Local PC is online. Stopping Salad pod to save costs.');
                    await saladService.stopSaladContainer();
                }
            }
        } else {
            // Local is offline.
            if (!env.SALAD_API_KEY) {
                // Wait forever until local PC is up
                return;
            }

            // Check if we need Salad.
            const saladStatus = await saladService.getSaladStatus();

            if (totalJobs >= env.MIN_JOBS_FOR_SALAD) {
                // We have enough jobs. Is Salad running?
                if (['stopped', 'failed', 'unknown'].includes(saladStatus)) {
                    console.log(`[Autoscale] Queue size (${totalJobs}) >= ${env.MIN_JOBS_FOR_SALAD}. Starting Salad pod...`);
                    await saladService.startSaladContainer();
                }
            } else if (totalJobs === 0) {
                // Queue is empty. Spin down Salad to save money.
                if (['running', 'starting', 'deploying'].includes(saladStatus)) {
                    console.log('[Autoscale] Queue is empty. Stopping Salad pod...');
                    await saladService.stopSaladContainer();
                }
            }
        }
    } catch (error) {
        console.error('[Autoscale] Error during autoscaling check:', error);
    }
}

module.exports = {
    getActiveWorkerUrl,
    checkWorkerHealth,
    autoscaleSalad
};
