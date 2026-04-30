const { MongoClient, ServerApiVersion } = require('mongodb');
const env = require('./env');

const collections = {
    db: null,
    jobsCollection: null,
    resultsCollection: null,
    userVideosCollection: null
};

async function connectToMongoDB() {
    const client = new MongoClient(env.MONGO_URI, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    try {
        await client.connect();
        collections.db = client.db(env.DB_NAME);
        collections.jobsCollection = collections.db.collection(env.JOBS_COLLECTION);
        collections.resultsCollection = collections.db.collection(env.RESULTS_COLLECTION);
        collections.userVideosCollection = collections.db.collection(env.USER_VIDEOS_COLLECTION);

        // Create indexes
        await collections.resultsCollection.createIndex({ video_id: 1 }, { unique: true });
        await collections.jobsCollection.createIndex({ job_id: 1 }, { unique: true });
        await collections.userVideosCollection.createIndex({ user_id: 1, job_id: 1 }, { unique: true });

        // Clear jobs table on start (DISABLED in production, but was in original code)
        await collections.jobsCollection.deleteMany({});
        await collections.resultsCollection.deleteMany({});

        await client.db(env.DB_NAME).command({ ping: 1 });
        console.log('Connected to MongoDB');
        
        return client;
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }
}

module.exports = { connectToMongoDB, collections };
