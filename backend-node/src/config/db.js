const { MongoClient, ServerApiVersion } = require('mongodb');
const env = require('./env');

const collections = {
    db: null,
    jobsCollection: null,
    resultsCollection: null,
    userVideosCollection: null,
    translationReportsCollection: null,
    segmentReviewsCollection: null
};

async function connectToMongoDB() {
    const client = new MongoClient(env.MONGO_URI, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
        // Fail fast if Mongo is unreachable so the API can boot in degraded mode
        // instead of hanging on the default 30s selection timeout.
        serverSelectionTimeoutMS: 8000,
    });

    try {
        await client.connect();
        collections.db = client.db(env.DB_NAME);
        collections.jobsCollection = collections.db.collection(env.JOBS_COLLECTION);
        collections.resultsCollection = collections.db.collection(env.RESULTS_COLLECTION);
        collections.userVideosCollection = collections.db.collection(env.USER_VIDEOS_COLLECTION);
        collections.translationReportsCollection = collections.db.collection('translation_reports');
        collections.segmentReviewsCollection = collections.db.collection('segment_ai_reviews');

        // Create indexes
        await collections.resultsCollection.createIndex({ video_id: 1 }, { unique: true });
        await collections.jobsCollection.createIndex({ job_id: 1 }, { unique: true });
        await collections.userVideosCollection.createIndex({ user_id: 1, job_id: 1 }, { unique: true });
        await collections.translationReportsCollection.createIndex({ job_id: 1, segment_index: 1 });
        await collections.translationReportsCollection.createIndex({ job_id: 1, segment_index: 1, user_id: 1 }, { unique: true });
        await collections.segmentReviewsCollection.createIndex({ id: 1 }, { unique: true });
        await collections.segmentReviewsCollection.createIndex({ job_id: 1, segment_index: 1 });

        // Clear jobs table on start (DISABLED in production, but was in original code)
        // await collections.jobsCollection.deleteMany({});
        // await collections.resultsCollection.deleteMany({});

        await client.db(env.DB_NAME).command({ ping: 1 });
        console.log('Connected to MongoDB');

        return client;
    } catch (err) {
        // Let the caller decide how to handle this instead of killing the whole
        // process — the PostgreSQL-backed API can still serve without Mongo.
        console.error('Error connecting to MongoDB:', err.message);
        throw err;
    }
}

module.exports = { connectToMongoDB, collections };
