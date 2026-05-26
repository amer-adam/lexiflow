const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { uploadDir } = require('./middlewares/upload');
const vocabularyRoutes = require('./modules/vocabulary/vocabulary.routes');

const app = express();

// Configure CORS to trust the frontend URL
const corsOptions = {
    origin: [
        env.FRONTEND_URL,          // Uses https://test.amerai.top from your .env
        'http://localhost:4555'    // Keeps local development working automatically
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
};

// Apply CORS middleware BEFORE your routes
app.use(cors(corsOptions));
app.use(express.json());
app.use('/media', express.static(uploadDir));
app.use('/api/vocabulary', vocabularyRoutes);

// Register all routes under /lexiflow
app.use('/lexiflow', routes);

module.exports = app;
