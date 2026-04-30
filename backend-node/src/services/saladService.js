const axios = require('axios');
const env = require('../config/env');

const saladApi = axios.create({
    baseURL: 'https://api.salad.com/api/public',
    headers: {
        'Salad-Api-Key': env.SALAD_API_KEY,
        'Content-Type': 'application/json'
    }
});

const getContainerPath = () => {
    return `/organizations/${env.SALAD_ORGANIZATION_NAME}/projects/${env.SALAD_PROJECT_NAME}/containers/${env.SALAD_CONTAINER_GROUP_NAME}`;
};

/**
 * Get the current status of the Salad container group.
 * @returns {Promise<string>} e.g., 'running', 'stopped', 'starting', etc.
 */
async function getSaladStatus() {
    if (!env.SALAD_API_KEY) return 'unconfigured';
    try {
        const response = await saladApi.get(getContainerPath());
        return response.data.current_state?.status || 'unknown';
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return 'not_found';
        }
        console.error('Error fetching Salad status:', error.message);
        return 'error';
    }
}

/**
 * Start the Salad container group.
 */
async function startSaladContainer() {
    if (!env.SALAD_API_KEY) return;
    try {
        await saladApi.post(`${getContainerPath()}/start`);
        console.log(`[Salad] Container group ${env.SALAD_CONTAINER_GROUP_NAME} is STARTING.`);
    } catch (error) {
        console.error('[Salad] Error starting container:', error.response?.data || error.message);
    }
}

/**
 * Stop the Salad container group.
 */
async function stopSaladContainer() {
    if (!env.SALAD_API_KEY) return;
    try {
        await saladApi.post(`${getContainerPath()}/stop`);
        console.log(`[Salad] Container group ${env.SALAD_CONTAINER_GROUP_NAME} is STOPPING.`);
    } catch (error) {
        console.error('[Salad] Error stopping container:', error.response?.data || error.message);
    }
}

module.exports = {
    getSaladStatus,
    startSaladContainer,
    stopSaladContainer
};
