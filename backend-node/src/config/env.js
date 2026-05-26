const path = require('path');
const fs = require('fs');

// Look for .env in the current working directory (where the app was started)
let envPath = path.join(process.cwd(), '.env');

// Fallback: If it's not found there, check one directory up (../.env)
if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '../.env');
}

require('dotenv').config({ path: envPath });
module.exports = {
    PORT: 4556,
    PROCESSING_RATE: 12, // seconds per minute of video
    MONGO_URI: process.env.MONGO_URI || 'mongodb+srv://ameradam6a_db_user:FQ5y6hnE1vKPpmEi@lexiflow.2uerdjh.mongodb.net/?appName=lexiflow',
    DB_NAME: process.env.DB_NAME || 'lexiflow',
    JOBS_COLLECTION: process.env.JOBS_COLLECTION || 'jobs',
    RESULTS_COLLECTION: process.env.RESULTS_COLLECTION || 'results',
    AGENDA_COLLECTION: process.env.AGENDA_COLLECTION || 'agendaJobs',
    USER_VIDEOS_COLLECTION: 'user_videos',
    // AI Worker Routing Config
    PYTHON_API_LOCAL: process.env.PYTHON_API_LOCAL || 'http://localhost:4557', // Your local PC (via Tailscale/Ngrok/IP)
    PYTHON_API_SALAD: process.env.PYTHON_API_SALAD || 'https://your-salad-pod-url.salad.cloud',

    // Salad Cloud Config
    SALAD_API_KEY: process.env.SALAD_API_KEY || '',
    SALAD_ORGANIZATION_NAME: process.env.SALAD_ORGANIZATION_NAME || 'your-org',
    SALAD_PROJECT_NAME: process.env.SALAD_PROJECT_NAME || 'default',
    SALAD_CONTAINER_GROUP_NAME: process.env.SALAD_CONTAINER_GROUP_NAME || 'lexiflow-worker',
    MIN_JOBS_FOR_SALAD: parseInt(process.env.MIN_JOBS_FOR_SALAD || '5', 10),
    DATABASE_URL: process.env.DATABASE_URL
};
